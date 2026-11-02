/**
 * fetch-github-data.ts — Fetch repo metadata + README HTML from GitHub API
 *
 * Called only by explicit collection to produce repos.json for the project map and
 * per-repo landing pages. Auth token resolution order:
 *   1. TIKOCI_GITHUB_TOKEN env var (CI override secret, when set)
 *   2. GITHUB_TOKEN env var (CI / explicit)
 *   3. `gh auth token` CLI fallback (local dev)
 *   4. Anonymous (60 req/hr rate limit — falls back to cache on failure)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { REPO_OVERRIDES, EXCLUDE_REPOS, MIN_STARS, RELATIONSHIPS, REPO_SYMBOLS, DEFAULT_SYMBOL } from "../data/repo-config";
import type { ExternalLink } from "../data/repo-config";

const OWNER = "tikoci";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Resolve a GitHub token: TIKOCI_GITHUB_TOKEN → GITHUB_TOKEN → gh CLI → undefined.
 * The first name is the repo-wide CI override: if the default github.token ever
 * proves unable to read cross-repo settings, setting a TIKOCI_GITHUB_TOKEN repo
 * secret fixes collection with no code change.
 */
function resolveGitHubToken(): string | undefined {
    if (process.env.TIKOCI_GITHUB_TOKEN) return process.env.TIKOCI_GITHUB_TOKEN;
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
    try {
        const token = execSync("gh auth token", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
        if (token) {
            console.log("  Using token from gh CLI");
            return token;
        }
    } catch {
        // gh not installed or not authenticated — continue without token
    }
    return undefined;
}

let resolvedToken: string | undefined;
let tokenResolved = false;
function getGitHubToken() {
    if (!tokenResolved) { resolvedToken = resolveGitHubToken(); tokenResolved = true; }
    return resolvedToken;
}

export interface RepoData {
    name: string;
    description: string;
    stars: number;
    language: string | null;
    topics: string[];
    homepage: string | null;
    html_url: string;
    created_at: string;
    updated_at: string;
    default_branch: string;
    readmeHtml: string;
    enrichment?: { observedAt: string; error: string | null; retainedObservedAt?: string };
    bonusDocs: { name: string; path: string; url: string }[];
    category?: string;
    /** VS Code Marketplace extension ID (passthrough from config) */
    vscodeExtensionId?: string;
    /** Docker Hub image names (passthrough from config) */
    dockerImages?: string[];
    /** External links (passthrough from config) */
    externalLinks?: ExternalLink[];
    /** Whether the repo has a Dockerfile in the root */
    hasDockerfile: boolean;
    /** Dockerfile raw content (if present and fetchable) */
    dockerfileContent?: string;
    /** Viewable file contents fetched at build time (markdown rendered to HTML) */
    viewableFileContents: { name: string; html: string }[];
    /** SEO meta description override from repo-config (120–160 chars) */
    metaDescription?: string;
}

export interface GraphData {
    nodes: {
        id: string;
        name: string;
        description: string;
        stars: number;
        language: string | null;
        topics: string[];
        url: string;
        pageUrl: string;
        category?: string;
        symbol: string;
    }[];
    links: {
        source: string;
        target: string;
        type: string;
    }[];
}

/** Shared auth headers for GitHub API calls (also used by fetch-dashboard-data.ts) */
export function githubHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "tikoci-website-build",
    };
    const token = getGitHubToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

function readmeHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github.html+json",
        "User-Agent": "tikoci-website-build",
    };
    const token = getGitHubToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

async function fetchRepoList(): Promise<any[]> {
    const url = `https://api.github.com/users/${OWNER}/repos?per_page=100&sort=updated`;
    const resp = await fetch(url, { headers: githubHeaders() });
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${resp.statusText}`);
    return resp.json();
}

async function fetchReadmeHtml(repo: string): Promise<string> {
    const url = `https://api.github.com/repos/${OWNER}/${repo}/readme`;
    const resp = await fetch(url, { headers: readmeHeaders() });
    if (resp.status === 404) return "";
    if (!resp.ok) throw new Error(`README HTTP ${resp.status}`);
    return resp.text();
}

async function checkBonusDoc(repo: string, path: string, defaultBranch: string): Promise<{ name: string; path: string; url: string } | null> {
    const url = `https://api.github.com/repos/${OWNER}/${repo}/contents/${path}`;
    const resp = await fetch(url, { headers: githubHeaders() });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Content HTTP ${resp.status}`);
    return {
        name: path,
        path,
        url: `https://github.com/${OWNER}/${repo}/blob/${defaultBranch}/${path}`,
    };
}

/** Check if a file exists in a repo's root */
async function fileExists(repo: string, path: string): Promise<boolean> {
    const url = `https://api.github.com/repos/${OWNER}/${repo}/contents/${path}`;
    const resp = await fetch(url, { headers: githubHeaders(), method: "HEAD" });
    if (resp.status === 404) return false;
    if (!resp.ok) throw new Error(`File probe HTTP ${resp.status}`);
    return true;
}

/** Fetch raw text content of a file from a repo */
async function fetchRawFile(repo: string, path: string, defaultBranch: string): Promise<string | null> {
    const url = `https://raw.githubusercontent.com/${OWNER}/${repo}/${defaultBranch}/${path}`;
    const resp = await fetch(url);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Content HTTP ${resp.status}`);
    return resp.text();
}

/** Fetch a markdown file and get GitHub-rendered HTML */
async function fetchFileAsHtml(repo: string, path: string): Promise<string | null> {
    const url = `https://api.github.com/repos/${OWNER}/${repo}/contents/${path}`;
    const resp = await fetch(url, { headers: readmeHeaders() });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Content HTTP ${resp.status}`);
    return resp.text();
}

/**
 * Sanitize GitHub-rendered README HTML:
 * - Strip <script> tags (defense-in-depth)
 * - Rewrite relative image URLs to absolute raw.githubusercontent.com URLs
 * - Downshift headings (h1→h2 … h5→h6) so README h1s don't compete with the page h1
 * - Add alt="" to any <img> missing an alt attribute
 */
function sanitizeReadmeHtml(html: string, repo: string, defaultBranch: string): string {
    // Strip script tags
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    // Downshift headings so README h1 doesn't clash with page h1 (SEO/a11y)
    clean = clean.replace(/<(\/?)h([1-5])(\s|>)/gi, (_, slash, level, rest) =>
        `<${slash}h${Number(level) + 1}${rest}`
    );
    // Rewrite relative image src to absolute
    const rawBase = `https://raw.githubusercontent.com/${OWNER}/${repo}/${defaultBranch}`;
    clean = clean.replace(
        /(<img\s[^>]*src=")(?!https?:\/\/|data:)([^"]+)(")/gi,
        (_, pre, src, post) => {
            const cleanSrc = src.replace(/^\.\//, "");
            return `${pre}${rawBase}/${cleanSrc}${post}`;
        }
    );
    // Add alt="" to images that are missing an alt attribute
    clean = clean.replace(/<img\b(?![^>]*\balt=)([^>]*?)(\s*\/?>)/gi, '<img alt=""$1$2');
    // Also rewrite relative href for links to images/docs
    clean = clean.replace(
        /(<a\s[^>]*href=")(?!https?:\/\/|#|mailto:)([^"]+)(")/gi,
        (_, pre, href, post) => {
            const cleanHref = href.replace(/^\.\//, "");
            return `${pre}https://github.com/${OWNER}/${repo}/blob/${defaultBranch}/${cleanHref}${post}`;
        }
    );
    return clean;
}

interface CacheData {
    timestamp: number;
    repos: RepoData[];
}

function readCache(cachePath: string, allowStale = false): RepoData[] | null {
    if (!existsSync(cachePath)) return null;
    try {
        const data: CacheData = JSON.parse(readFileSync(cachePath, "utf-8"));
        if (allowStale || Date.now() - data.timestamp < CACHE_MAX_AGE_MS) {
            return data.repos;
        }
    } catch { /* cache corrupt, refetch */ }
    return null;
}

function writeCache(cachePath: string, repos: RepoData[]) {
    const data: CacheData = { timestamp: Date.now(), repos };
    writeFileSync(cachePath, JSON.stringify(data), "utf-8");
}

/**
 * Re-apply config-driven overrides (externalLinks, dockerImages, etc.) over
 * cached repo data so that changes to repo-config.ts take effect without
 * requiring a full GitHub API re-fetch.
 */
export function applyConfigOverrides(repos: RepoData[]): RepoData[] {
    return repos.map(repo => {
        const override = REPO_OVERRIDES[repo.name];
        if (!override) return repo;
        return {
            ...repo,
            category: override.category ?? repo.category,
            vscodeExtensionId: override.vscodeExtensionId ?? repo.vscodeExtensionId,
            dockerImages: override.dockerImages ?? repo.dockerImages,
            externalLinks: override.externalLinks ?? repo.externalLinks,
            metaDescription: override.metaDescription ?? repo.metaDescription,
        };
    });
}

/**
 * Main entry: fetch all repo data and produce repos.json + graph data.
 * @param distDir - The dist/ output directory
 * @returns The full array of RepoData for page generation
 */
export async function fetchGitHubData(distDir: string, onPartialFailure: (message: string) => void = () => {}): Promise<RepoData[]> {
    const dataDir = join(distDir, "published");
    mkdirSync(dataDir, { recursive: true });
    // Cache lives outside dist/ so it survives the dist/ clean step between builds.
    // This prevents repeated builds from exhausting the anonymous GitHub API rate limit.
    const cachePath = join(distDir, ".github-cache.json");

    // Try cache first (dev mode optimization)
    const forceRefresh = !!process.env.CI || process.argv.includes("--fresh");
    if (!forceRefresh) {
        const cached = readCache(cachePath);
        if (cached) {
            console.log("  Using cached GitHub data (< 1 hour old)");
            const repos = applyConfigOverrides(cached);
            writeReposJson(dataDir, repos);
            return repos;
        }
    }

    console.log("  Fetching repos from GitHub API...");
    let rawRepos: any[];
    try {
        rawRepos = await fetchRepoList();
    } catch (err) {
        console.warn(`  GitHub API fetch failed: ${err}`);
        const cached = readCache(cachePath, true);
        if (cached) {
            console.log("  Falling back to stale cache");
            const repos = applyConfigOverrides(cached);
            writeReposJson(dataDir, repos);
            return repos;
        }
        console.warn("  No cache available — building with empty repo data");
        writeReposJson(dataDir, []);
        return [];
    }

    // Filter repos (include forks — some like netinstall are active projects)
    const filtered = rawRepos.filter(r =>
        r.stargazers_count >= MIN_STARS &&
        !EXCLUDE_REPOS.includes(r.name)
    );

    console.log(`  ${filtered.length} repos qualify (${MIN_STARS}+ stars)`);

    const prior = readCache(cachePath, true) ?? [];
    const priorTimestamp = prior.length ? JSON.parse(readFileSync(cachePath, "utf-8")).timestamp : null;
    // Fetch README + bonus docs + enrichments for each repo
    const repos: RepoData[] = [];
    for (const r of filtered) {
        const override = REPO_OVERRIDES[r.name] || {};
        console.log(`  Fetching README for ${r.name}...`);

        const old = prior.find(repo => repo.name === r.name);
        let failed = false;
        const attempt = async <T>(request: () => Promise<T>, fallback: T): Promise<T> => {
            try { return await request(); }
            catch { failed = true; onPartialFailure("Repository enrichment partially failed; retained available prior content"); return fallback; }
        };
        const readmeHtml = await attempt(() => fetchReadmeHtml(r.name), old?.readmeHtml ?? "");
        const cleanHtml = readmeHtml === old?.readmeHtml ? readmeHtml : sanitizeReadmeHtml(readmeHtml, r.name, r.default_branch);

        // Check bonus docs
        const bonusDocs: { name: string; path: string; url: string }[] = [];
        if (override.bonusDocs) {
            for (const docPath of override.bonusDocs) {
                const doc = await attempt(() => checkBonusDoc(r.name, docPath, r.default_branch), old?.bonusDocs.find(doc => doc.path === docPath) ?? null);
                if (doc) bonusDocs.push(doc);
            }
        }

        // Detect Dockerfile in root
        let hasDockerfile = false;
        let dockerfileContent: string | undefined;
        if (await attempt(() => fileExists(r.name, "Dockerfile"), old?.hasDockerfile ?? false)) {
            hasDockerfile = true;
            const raw = await attempt(() => fetchRawFile(r.name, "Dockerfile", r.default_branch), old?.dockerfileContent ?? null);
            if (raw) dockerfileContent = raw;
            console.log(`    Dockerfile detected in ${r.name}`);
        }

        // Fetch viewable file contents (rendered as HTML for markdown)
        const viewableFileContents: { name: string; html: string }[] = [];
        if (override.viewableFiles) {
            for (const filePath of override.viewableFiles) {
                const html = await attempt(() => fetchFileAsHtml(r.name, filePath), old?.viewableFileContents.find(file => file.name === filePath)?.html ?? null);
                if (html) {
                    const cleanViewable = html === old?.viewableFileContents.find(file => file.name === filePath)?.html ? html : sanitizeReadmeHtml(html, r.name, r.default_branch);
                    viewableFileContents.push({ name: filePath, html: cleanViewable });
                    console.log(`    Fetched viewable: ${filePath}`);
                }
            }
        }

        repos.push({
            name: r.name,
            description: r.description || "",
            stars: r.stargazers_count,
            language: r.language,
            topics: r.topics || [],
            homepage: r.homepage || null,
            html_url: r.html_url,
            created_at: r.created_at,
            updated_at: r.updated_at,
            default_branch: r.default_branch,
            readmeHtml: cleanHtml,
            enrichment: { observedAt: new Date().toISOString(), error: failed ? "Partial enrichment failure; retained available prior content" : null,
                ...(failed && old ? { retainedObservedAt: old.enrichment?.retainedObservedAt ?? old.enrichment?.observedAt ?? new Date(priorTimestamp).toISOString() } : {}) },
            bonusDocs,
            category: override.category,
            vscodeExtensionId: override.vscodeExtensionId,
            dockerImages: override.dockerImages,
            externalLinks: override.externalLinks,
            hasDockerfile,
            dockerfileContent,
            viewableFileContents,
            metaDescription: override.metaDescription,
        });
    }

    // Cache for dev
    writeCache(cachePath, repos);
    writeReposJson(dataDir, repos);

    return repos;
}

export function writeReposJson(dataDir: string, repos: RepoData[]) {
    // Write a slimmed version for the map (no readmeHtml to keep size small)
    const slim = repos.map(r => ({
        name: r.name,
        description: r.description,
        stars: r.stars,
        language: r.language,
        topics: r.topics,
        html_url: r.html_url,
        category: r.category,
    }));
    writeFileSync(join(dataDir, "repos.json"), JSON.stringify(slim, null, 2), "utf-8");
}

/**
 * Build graph data for the D3 force-directed map.
 * Filters relationships to only include repos that actually exist in the dataset.
 */
export function buildGraphData(repos: RepoData[]): GraphData {
    const repoNames = new Set(repos.map(r => r.name));

    const nodes = repos.map(r => ({
        id: r.name,
        name: r.name,
        description: r.description,
        stars: r.stars,
        language: r.language,
        topics: r.topics,
        url: r.html_url,
        pageUrl: `p/${r.name}.html`,
        category: r.category,
        symbol: REPO_SYMBOLS[r.name] || DEFAULT_SYMBOL,
    }));

    const links = RELATIONSHIPS
        .filter(rel => repoNames.has(rel.source) && repoNames.has(rel.target))
        .map(rel => ({
            source: rel.source,
            target: rel.target,
            type: rel.type,
        }));

    return { nodes, links };
}
