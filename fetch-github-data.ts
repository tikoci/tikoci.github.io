/**
 * fetch-github-data.ts — Fetch repo metadata + README HTML from GitHub API
 *
 * Called during build to produce repos.json for the project map and
 * per-repo landing pages. Uses GITHUB_TOKEN env var when available
 * (CI) for higher rate limits. Falls back to cached data when API
 * fails (dev mode).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_OVERRIDES, EXCLUDE_REPOS, MIN_STARS, RELATIONSHIPS, REPO_SYMBOLS, DEFAULT_SYMBOL } from "./repo-config";

const OWNER = "tikoci";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

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
    const token = process.env.GITHUB_TOKEN;
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
    const token = process.env.GITHUB_TOKEN;
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
 * Main entry: fetch all repo data and produce repos.json + graph data.
 * @param distDir - The dist/ output directory
 * @returns The full array of RepoData for page generation
 */
export async function fetchGitHubData(distDir: string): Promise<RepoData[]> {
    const dataDir = join(distDir, "data");
    mkdirSync(dataDir, { recursive: true });
    const cachePath = join(dataDir, ".cache.json");

    // Try cache first (dev mode optimization)
    const forceRefresh = !!process.env.CI || process.argv.includes("--fresh");
    if (!forceRefresh) {
        const cached = readCache(cachePath);
        if (cached) {
            console.log("  Using cached GitHub data (< 1 hour old)");
            writeReposJson(dataDir, cached);
            return cached;
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
            writeReposJson(dataDir, cached);
            return cached;
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

    // Fetch README + bonus docs for each repo
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
