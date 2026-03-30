/**
 * fetch-github-data.ts — Fetch repo metadata + README HTML from GitHub API
 *
 * Called during build to produce repos.json for the project map and
 * per-repo landing pages. Auth token resolution order:
 *   1. GITHUB_TOKEN env var (CI / explicit)
 *   2. `gh auth token` CLI fallback (local dev)
 *   3. Anonymous (60 req/hr rate limit — falls back to cache on failure)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { REPO_OVERRIDES, EXCLUDE_REPOS, MIN_STARS, RELATIONSHIPS, REPO_SYMBOLS, DEFAULT_SYMBOL } from "./repo-config";
import type { ExternalLink } from "./repo-config";

const OWNER = "tikoci";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/** Resolve a GitHub token: GITHUB_TOKEN env → gh CLI fallback → undefined */
function resolveGitHubToken(): string | undefined {
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

const GITHUB_TOKEN = resolveGitHubToken();

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

function githubHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "tikoci-website-build",
    };
    if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }
    return headers;
}

function readmeHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github.html+json",
        "User-Agent": "tikoci-website-build",
    };
    if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
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
    if (!resp.ok) return "";
    return resp.text();
}

async function checkBonusDoc(repo: string, path: string, defaultBranch: string): Promise<{ name: string; path: string; url: string } | null> {
    const url = `https://api.github.com/repos/${OWNER}/${repo}/contents/${path}`;
    const resp = await fetch(url, { headers: githubHeaders() });
    if (!resp.ok) return null;
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
    return resp.ok;
}

/** Fetch raw text content of a file from a repo */
async function fetchRawFile(repo: string, path: string, defaultBranch: string): Promise<string | null> {
    const url = `https://raw.githubusercontent.com/${OWNER}/${repo}/${defaultBranch}/${path}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return resp.text();
}

/** Fetch a markdown file and get GitHub-rendered HTML */
async function fetchFileAsHtml(repo: string, path: string): Promise<string | null> {
    const url = `https://api.github.com/repos/${OWNER}/${repo}/contents/${path}`;
    const resp = await fetch(url, { headers: readmeHeaders() });
    if (!resp.ok) return null;
    return resp.text();
}

/**
 * Sanitize GitHub-rendered README HTML:
 * - Strip <script> tags (defense-in-depth)
 * - Rewrite relative image URLs to absolute raw.githubusercontent.com URLs
 */
function sanitizeReadmeHtml(html: string, repo: string, defaultBranch: string): string {
    // Strip script tags
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    // Rewrite relative image src to absolute
    const rawBase = `https://raw.githubusercontent.com/${OWNER}/${repo}/${defaultBranch}`;
    clean = clean.replace(
        /(<img\s[^>]*src=")(?!https?:\/\/|data:)([^"]+)(")/gi,
        (_, pre, src, post) => {
            const cleanSrc = src.replace(/^\.\//, "");
            return `${pre}${rawBase}/${cleanSrc}${post}`;
        }
    );
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

function readCache(cachePath: string): RepoData[] | null {
    if (!existsSync(cachePath)) return null;
    try {
        const data: CacheData = JSON.parse(readFileSync(cachePath, "utf-8"));
        if (Date.now() - data.timestamp < CACHE_MAX_AGE_MS) {
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
function applyConfigOverrides(repos: RepoData[]): RepoData[] {
    return repos.map(repo => {
        const override = REPO_OVERRIDES[repo.name];
        if (!override) return repo;
        return {
            ...repo,
            category: override.category ?? repo.category,
            vscodeExtensionId: override.vscodeExtensionId ?? repo.vscodeExtensionId,
            dockerImages: override.dockerImages ?? repo.dockerImages,
            externalLinks: override.externalLinks ?? repo.externalLinks,
        };
    });
}

/**
 * Main entry: fetch all repo data and produce repos.json + graph data.
 * @param distDir - The dist/ output directory
 * @returns The full array of RepoData for page generation
 */
export async function fetchGitHubData(distDir: string): Promise<RepoData[]> {
    const dataDir = join(distDir, "data");
    mkdirSync(dataDir, { recursive: true });
    // Cache lives outside dist/ so it survives the dist/ clean step between builds.
    // This prevents repeated builds from exhausting the anonymous GitHub API rate limit.
    const cachePath = join(import.meta.dirname, ".github-cache.json");

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
        const cached = readCache(cachePath);
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

    // Fetch README + bonus docs + enrichments for each repo
    const repos: RepoData[] = [];
    for (const r of filtered) {
        const override = REPO_OVERRIDES[r.name] || {};
        console.log(`  Fetching README for ${r.name}...`);

        const readmeHtml = await fetchReadmeHtml(r.name);
        const cleanHtml = sanitizeReadmeHtml(readmeHtml, r.name, r.default_branch);

        // Check bonus docs
        const bonusDocs: { name: string; path: string; url: string }[] = [];
        if (override.bonusDocs) {
            for (const docPath of override.bonusDocs) {
                const doc = await checkBonusDoc(r.name, docPath, r.default_branch);
                if (doc) bonusDocs.push(doc);
            }
        }

        // Detect Dockerfile in root
        let hasDockerfile = false;
        let dockerfileContent: string | undefined;
        if (await fileExists(r.name, "Dockerfile")) {
            hasDockerfile = true;
            const raw = await fetchRawFile(r.name, "Dockerfile", r.default_branch);
            if (raw) dockerfileContent = raw;
            console.log(`    Dockerfile detected in ${r.name}`);
        }

        // Fetch viewable file contents (rendered as HTML for markdown)
        const viewableFileContents: { name: string; html: string }[] = [];
        if (override.viewableFiles) {
            for (const filePath of override.viewableFiles) {
                const html = await fetchFileAsHtml(r.name, filePath);
                if (html) {
                    const cleanViewable = sanitizeReadmeHtml(html, r.name, r.default_branch);
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
            bonusDocs,
            category: override.category,
            vscodeExtensionId: override.vscodeExtensionId,
            dockerImages: override.dockerImages,
            externalLinks: override.externalLinks,
            hasDockerfile,
            dockerfileContent,
            viewableFileContents,
        });
    }

    // Cache for dev
    writeCache(cachePath, repos);
    writeReposJson(dataDir, repos);

    return repos;
}

function writeReposJson(dataDir: string, repos: RepoData[]) {
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
