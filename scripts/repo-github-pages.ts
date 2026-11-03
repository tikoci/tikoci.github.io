/** Detailed maintainer survey; invoked by collect-pages.ts, which publishes a
 * public field projection. Durable source: data/repo-github-pages.json.
 * Weekly/manual refresh: bun run survey:pages. See docs/refresh-data.md.
 * Per-repo failures stay explicit; listing failure retains the prior snapshot.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { githubHeaders } from "./fetch-github-data";

const OWNER = "tikoci";

/** Current repo-github-pages.json contract version. Bump on breaking shape changes. */
export const PAGES_SURVEY_SCHEMA_VERSION = 1;

const OUTFILE = join(import.meta.dirname, "../data/repo-github-pages.json");

const MAX_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 15_000;
/** Total published pages fetched per site, root included (depth-1 crawl). */
const HTML_PAGE_CAP = 10;
/** Conventional files proving a root-404 site still serves its tree. */
const REPO_AS_WEB_PROBES = ["README.md", "package.json", "index.html"];

// ---------------------------------------------------------------------------
// Public types (this is the repo-github-pages.json schema)
// ---------------------------------------------------------------------------

/** Per-repo collection state. Mirrors the dashboard signal vocabulary. */
export type PagesRepoState = "ok" | "partial" | "unknown" | "error";

/** What the published site actually does for a visitor. */
export type ServeKind = "site" | "repo-as-web" | "empty" | "unknown";

export interface ServeSurvey {
    kind: ServeKind;
    /** HTTP status of GET html_url (null when the fetch itself failed). */
    root: number | null;
    /** Decoded <title> of the root page (404 boilerplate titles included — they are evidence). */
    title: string | null;
    /** First probe path that served 200 (repo-as-web evidence); null when none did. */
    probeFile: string | null;
}

export interface DeploySurvey {
    at: string;
    /** Deployment ref, or "(legacy build)" for legacy sites (branch/path is in `source`). */
    ref: string;
    sha: string;
    /** Deployment/status state: success, built, failure, ... */
    state: string;
}

export interface PlausibleSurvey {
    present: boolean;
    /** Snippet build: "pa-hash" (our install), "tagged-events", another filename, or null. */
    script: string | null;
    /** First data-domain seen (null for hash-scoped installs, which need none). */
    dataDomain: string | null;
    /** Every distinct data-domain seen — cross-page drift is itself a signal. */
    dataDomains: string[];
    /** Published paths fetched, origin-absolute (site root first). */
    pagesChecked: string[];
    /** Pages carrying a Plausible snippet (per-page detail lives here only). */
    pagesWithSnippet: string[];
    /** True when the crawl cap cut the sweep short (counts are lower bounds). */
    truncated: boolean;
    /** Unique custom plausible('Event') names across checked pages. */
    events: string[];
}

export interface PagesRepoSurvey {
    name: string;
    /** False = API 404 (Pages off). Null = could not determine (auth/network). */
    hasPages: boolean | null;
    state: PagesRepoState;
    buildType?: string | null;
    source?: { branch: string; path: string } | null;
    htmlUrl?: string | null;
    /** Legacy build status ("built"/"building"/"errored"); null for workflow sites. */
    status?: string | null;
    cname?: string | null;
    custom404?: boolean | null;
    httpsEnforced?: boolean | null;
    public?: boolean | null;
    serve?: ServeSurvey;
    /** Latest deployment (null when none ever ran — the never-deployed signal). */
    latestDeploy?: DeploySurvey | null;
    plausible?: PlausibleSurvey;
    error?: string;
}

export interface PagesFinding {
    /** Stable: "<rule>" (one finding per rule, repos listed). */
    id: string;
    rule: string;
    severity: "failure" | "gap" | "pending" | "info";
    repos: string[];
    summary: string;
    detail: string;
}

export interface PagesSurveyFile {
    schemaVersion: number;
    generatedAt: string;
    generatedBy: string;
    collection: { mode: "manual"; auth: "token" | "anonymous"; note: string };
    budgets: {
        githubApiCalls: number;
        otherHttpCalls: number;
        maxConcurrency: number;
        timeoutMsPerRequest: number;
        rateLimitRemaining: number | null;
    };
    sources: Record<string, string>;
    coverage: { repos: string[]; withPages: number; note: string };
    repos: Record<string, PagesRepoSurvey>;
    findings: PagesFinding[];
}

// ---------------------------------------------------------------------------
// Auth comes from the shared resolver in fetch-github-data.ts
// (TIKOCI_GITHUB_TOKEN -> GITHUB_TOKEN -> gh CLI -> anonymous).
// ---------------------------------------------------------------------------

/** The survey's auth mode, recorded in `collection` (coverage is token-scoped). */
const AUTH_MODE: "token" | "anonymous" = "Authorization" in githubHeaders() ? "token" : "anonymous";

/** True when a 403 is rate limiting (transient), not a permissions fact. */
function isRateLimited(resp: Response): boolean {
    return resp.status === 403 && resp.headers.get("x-ratelimit-remaining") === "0";
}

// ---------------------------------------------------------------------------
// I/O: budgeted fetching (same pattern as fetch-dashboard-data.ts)
// ---------------------------------------------------------------------------

const stats = {
    githubApiCalls: 0,
    otherHttpCalls: 0,
    rateLimitRemaining: null as number | null,
};

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: ctrl.signal });
    } catch (err) {
        if (ctrl.signal.aborted) throw new Error(`timeout after ${REQUEST_TIMEOUT_MS}ms for ${url}`);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Read a response body under the same budget — the fetch timeout above only
 * covers dispatch, so a slow-drip body gets its own deadline.
 */
async function readBody<T>(url: string, read: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`body timeout after ${REQUEST_TIMEOUT_MS}ms for ${url}`)), REQUEST_TIMEOUT_MS);
    });
    try {
        return await Promise.race([read(), deadline]);
    } finally {
        clearTimeout(timer);
    }
}

async function fetchApi(url: string): Promise<Response> {
    stats.githubApiCalls++;
    const resp = await fetchWithTimeout(url, { headers: githubHeaders() });
    const remaining = resp.headers.get("x-ratelimit-remaining");
    if (remaining !== null) {
        const n = Number(remaining);
        if (Number.isFinite(n)) {
            stats.rateLimitRemaining = stats.rateLimitRemaining === null ? n : Math.min(stats.rateLimitRemaining, n);
        }
    }
    return resp;
}

/** Plain-visitor fetch of published Pages HTML (no auth — this is what the world sees). */
async function fetchPublished(url: string): Promise<{ status: number; finalUrl: string; text: string }> {
    stats.otherHttpCalls++;
    const resp = await fetchWithTimeout(url, { headers: { "User-Agent": "tikoci-pages-survey" } });
    return { status: resp.status, finalUrl: resp.url || url, text: await readBody(url, () => resp.text()) };
}

/** GitHub API fetch returning response + parsed JSON (throws on transport/timeout only). */
async function fetchApiJson(url: string): Promise<{ resp: Response; json: unknown }> {
    const resp = await fetchApi(url);
    return { resp, json: await readBody(url, () => resp.json()) };
}

/** Bounded-concurrency map; results keep input order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return out;
}

// ---------------------------------------------------------------------------
// Pure mappers (no I/O — the survey's testable core)
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&middot;": "·",
    "&hellip;": "…",
    "&mdash;": "—",
    "&nbsp;": " ",
};

/** Extract and entity-decode the <title> (null when absent). */
export function extractTitle(html: string): string | null {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (!m) return null;
    const decoded = m[1]
        .replace(/&[a-z]+;/gi, (e) => HTML_ENTITIES[e.toLowerCase()] ?? e)
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));
    return decoded.trim() || null;
}

/** Strip HTML comments so commented-out tags and links never count as live. */
export function stripComments(html: string): string {
    return html.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Scan one HTML document for Plausible. Defensive by design: real-world tags
 * break attributes across lines, use either quote style or uppercase, and
 * may carry `>` inside earlier attributes — so the tag pattern is
 * case-insensitive and quote-aware, and comments are stripped first.
 */
export function scanPlausibleHtml(html: string): { present: boolean; script: string | null; dataDomain: string | null; events: string[] } {
    const live = stripComments(html);
    const events = [...new Set([...live.matchAll(/plausible\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]))];
    let script: string | null = null;
    let dataDomain: string | null = null;
    for (const tag of live.matchAll(/<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
        const src = /src=(["'])([^"']*plausible\.io\/js\/[^"']+)\1/i.exec(tag[0]);
        if (!src) continue;
        const file = (src[2].split("/").pop() ?? src[2]).split(/[?#]/)[0];
        script = file.startsWith("pa-") ? "pa-hash" : file;
        dataDomain = /data-domain=(["'])([^"']+)\1/i.exec(tag[0])?.[2] ?? null;
        break;
    }
    return { present: script !== null, script, dataDomain, events };
}

/**
 * Same-origin *.html links on a page, resolved to paths (depth-1 crawl
 * seeds). Query strings and fragments are stripped; the page itself is
 * excluded. Depth 1 is deliberate: it covers tool-page collections linked
 * from an index (restraml's 6 pages) without wandering into versioned or
 * generated trees.
 */
export function extractCrawlPaths(html: string, pageUrl: string): string[] {
    const base = new URL(pageUrl);
    const seen = new Set<string>();
    for (const m of stripComments(html).matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*?href=(["'])([^"'#]+)(?:[?#][^"']*)?\1/gi)) {
        let url: URL;
        try {
            url = new URL(m[2], base);
        } catch {
            continue;
        }
        if (url.origin !== base.origin || !url.pathname.toLowerCase().endsWith(".html")) continue;
        // Trailing /index.html is the directory itself — normalize so the
        // caller dedupes it against the already-fetched directory page.
        const path = url.pathname.replace(/\/index\.html$/i, "/");
        if (path === base.pathname) continue;
        seen.add(path);
    }
    return [...seen].sort();
}

/**
 * Classify what the published site does for a visitor.
 *   - site: root serves 200 (a real page, whatever its content).
 *   - repo-as-web: root 404s but a conventional tree file serves — the
 *     deliberate whole-repo-publish pattern (upload-pages-artifact '.').
 *   - empty: root 404s and no probe file serves. Paired with latestDeploy
 *     it separates "never deployed" (null) from "deploys but serves nothing".
 *   - unknown: the serve fetch itself failed (transport, not verdict).
 */
export function classifyServe(rootStatus: number | null, probeHit: string | null): ServeKind {
    if (rootStatus === null) return "unknown";
    if (rootStatus === 200) return "site";
    if (rootStatus === 404) return probeHit ? "repo-as-web" : "empty";
    return "unknown";
}

/**
 * True when a Plausible data-domain names a DIFFERENT tikoci repo than the
 * one serving the page — the copy-paste drift signature. Matches on
 * path-segment boundaries (not bare substrings) so short repo names can't
 * false-positive inside unrelated words.
 */
export function isStaleDomain(dataDomain: string, repo: string, orgRepos: string[]): boolean {
    const segments = dataDomain.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
    return orgRepos.some((other) => {
        const name = other.toLowerCase();
        return name !== repo.toLowerCase() && segments.includes(name);
    });
}

const SEVERITY_ORDER = ["failure", "gap", "pending", "info"];

/**
 * Derive grouped findings from surveyed repos (pure — needs only the data +
 * org names). Rules only fire on fully-answered repos (state "ok"): a failed
 * lookup must never read as a verdict (never-deployed, missing tag).
 */
export function deriveFindings(repos: PagesRepoSurvey[], orgRepos: string[]): PagesFinding[] {
    const findings: PagesFinding[] = [];

    const neverDeployed = repos.filter((r) => r.state === "ok" && r.hasPages && r.latestDeploy === null).map((r) => r.name);
    if (neverDeployed.length) {
        findings.push({
            id: "pages-never-deployed",
            rule: "pages-never-deployed",
            severity: "gap",
            repos: neverDeployed,
            summary: `${neverDeployed.join(", ")} ${neverDeployed.length === 1 ? "has" : "have"} Pages enabled but no deployment has ever run`,
            detail: "Pages is enabled (workflow build) but the repo has zero github-pages deployments, so the site serves GitHub's 'Site not found' page. Either deploy content or disable Pages to remove the dead site.",
        });
    }

    const stale = repos.filter(
        (r) =>
            r.state === "ok" &&
            r.hasPages &&
            r.plausible?.present &&
            r.plausible.dataDomains.some((d) => isStaleDomain(d, r.name, orgRepos)),
    );
    if (stale.length) {
        const names = stale.map((r) => r.name);
        findings.push({
            id: "plausible-stale-domain",
            rule: "plausible-stale-domain",
            severity: "pending",
            repos: names,
            summary: `${names.join(", ")} track${names.length === 1 ? "s" : ""} to another repo's Plausible domain`,
            detail: "A Plausible tag on the site reports to a data-domain naming a different tikoci repo — almost certainly a copy-paste leftover. Its pageviews land in the wrong dashboard (or are dropped), so this page's traffic is unattributed. See plausible.dataDomains on each repo.",
        });
    }

    const missing = repos.filter((r) => r.state === "ok" && r.hasPages && r.serve?.kind === "site" && !r.plausible?.present).map((r) => r.name);
    if (missing.length) {
        findings.push({
            id: "plausible-missing",
            rule: "plausible-missing",
            severity: "info",
            repos: missing,
            summary: `${missing.join(", ")} serve${missing.length === 1 ? "s" : ""} Pages with no Plausible tag`,
            detail: "Live Pages sites with real content but no Plausible snippet anywhere in the surveyed HTML, so their usage is invisible to our analytics.",
        });
    }

    const repoAsWeb = repos.filter((r) => r.serve?.kind === "repo-as-web").map((r) => r.name);
    if (repoAsWeb.length) {
        findings.push({
            id: "pages-repo-as-web",
            rule: "pages-repo-as-web",
            severity: "info",
            repos: repoAsWeb,
            summary: `${repoAsWeb.length} ${repoAsWeb.length === 1 ? "repo uses" : "repos use"} the repo-as-web pattern (root 404, files serve)`,
            detail: "These repos publish their whole tree as the Pages artifact (upload-pages-artifact path '.'). No index.html at root, so / 404s while individual files serve with 200. Deliberate pattern, recorded so the root-404 is not misread as breakage.",
        });
    }

    return findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

// ---------------------------------------------------------------------------
// Collectors (I/O — every repo is non-fatal)
// ---------------------------------------------------------------------------

/** All org repo names, paginated to completion via the Link header. */
async function listOrgRepos(): Promise<string[]> {
    const names: string[] = [];
    let url: string | null = `https://api.github.com/orgs/${OWNER}/repos?per_page=100&type=all`;
    while (url) {
        const { resp, json } = await fetchApiJson(url);
        if (!resp.ok) {
            if (isRateLimited(resp)) throw new Error("org repo listing failed: GitHub API rate limited (transient — re-run later)");
            throw new Error(`org repo listing failed: HTTP ${resp.status}`);
        }
        if (!Array.isArray(json)) throw new Error("org repo listing failed: expected a JSON array");
        names.push(...(json as { name: string; private: boolean }[]).filter(r => !r.private).map((r) => r.name));
        url = /<([^>]+)>;\s*rel="next"/.exec(resp.headers.get("link") ?? "")?.[1] ?? null;
    }
    return names.sort();
}

function emptyPlausible(): PlausibleSurvey {
    return { present: false, script: null, dataDomain: null, dataDomains: [], pagesChecked: [], pagesWithSnippet: [], truncated: false, events: [] };
}

/**
 * Latest deployment, or null when the listing proves none ever ran. Lookup
 * failures THROW (the caller records partial + error) so a 403/500 never
 * fabricates a "never deployed" finding.
 */
async function collectLatestDeploy(repo: string, buildType: string | null): Promise<DeploySurvey | null> {
    if (buildType === "legacy") {
        const { resp, json } = await fetchApiJson(`https://api.github.com/repos/${OWNER}/${repo}/pages/builds/latest`);
        if (resp.status === 404) return null; // no builds ever — proven empty
        if (!resp.ok) throw new Error(`pages builds lookup HTTP ${resp.status}`);
        const b = json as { created_at: string; commit: string; status: string };
        return { at: b.created_at, ref: "(legacy build)", sha: String(b.commit ?? "").slice(0, 7), state: b.status };
    }
    const { resp, json } = await fetchApiJson(`https://api.github.com/repos/${OWNER}/${repo}/deployments?environment=github-pages&per_page=1`);
    if (!resp.ok) throw new Error(`deployments lookup HTTP ${resp.status}`);
    const list = (Array.isArray(json) ? json : []) as { created_at: string; ref: string; sha: string; statuses_url: string }[];
    if (!list.length) return null;
    const d = list[0];
    let state = "unknown";
    try {
        const sResp = await fetchApi(d.statuses_url);
        if (sResp.ok) state = (((await readBody(d.statuses_url, () => sResp.json())) as { state: string }[])[0]?.state ?? "unknown");
    } catch {
        // Status unreadable — the deployment row itself is still evidence.
    }
    return { at: d.created_at, ref: d.ref, sha: String(d.sha ?? "").slice(0, 7), state };
}

/** Shape of GET /repos/{owner}/{repo}/pages (only the fields we keep). */
interface PagesApiSite {
    html_url: string | null;
    status: string | null;
    cname: string | null;
    custom_404: boolean;
    build_type: string | null;
    source: { branch: string; path: string } | null;
    public: boolean;
    https_enforced: boolean;
}

async function collectOneRepo(repo: string): Promise<PagesRepoSurvey> {
    // --- Signal 1: Pages API (404 = off; 401/403 = cannot tell; else config) ---
    let site: PagesApiSite;
    try {
        // Note: GitHub also 404s repos the token cannot see, so "off" is
        // token-scoped — collection.auth records how this file was surveyed.
        const { resp, json } = await fetchApiJson(`https://api.github.com/repos/${OWNER}/${repo}/pages`);
        if (resp.status === 404) return { name: repo, hasPages: false, state: "ok" };
        if (isRateLimited(resp)) {
            return { name: repo, hasPages: null, state: "error", error: "Pages API rate limited (transient — re-run later)" };
        }
        if (resp.status === 401 || resp.status === 403) {
            return { name: repo, hasPages: null, state: "unknown", error: `Pages API HTTP ${resp.status} (token cannot read this repo's Pages settings)` };
        }
        if (!resp.ok) return { name: repo, hasPages: null, state: "error", error: `Pages API HTTP ${resp.status}` };
        site = json as PagesApiSite;
    } catch (err) {
        return { name: repo, hasPages: null, state: "error", error: String(err) };
    }

    const entry: PagesRepoSurvey = {
        name: repo,
        hasPages: true,
        state: "ok",
        buildType: site.build_type ?? null,
        source: site.source ? { branch: site.source.branch, path: site.source.path } : null,
        htmlUrl: site.html_url ?? null,
        status: site.status ?? null,
        cname: site.cname ?? null,
        custom404: site.custom_404 ?? null,
        httpsEnforced: site.https_enforced ?? null,
        public: site.public ?? null,
        // `plausible` is attached only when a sweep actually ran, so its
        // presence in the JSON means "swept" (absence = skipped/failed).
    };

    // --- Signal 2: serve — visit the published site like the world sees it ---
    let rootHtml = "";
    let rootFinalUrl = entry.htmlUrl ?? "";
    if (entry.htmlUrl) {
        try {
            const root = await fetchPublished(entry.htmlUrl);
            rootHtml = root.text;
            rootFinalUrl = root.finalUrl;
            let probeHit: string | null = null;
            if (root.status === 404) {
                for (const probe of REPO_AS_WEB_PROBES) {
                    try {
                        const hit = await fetchPublished(`${entry.htmlUrl.replace(/\/$/, "")}/${probe}`);
                        if (hit.status === 200) {
                            probeHit = `/${probe}`;
                            break;
                        }
                    } catch {
                        // One probe failing must not sink the survey; try the next.
                    }
                }
            }
            entry.serve = { kind: classifyServe(root.status, probeHit), root: root.status, title: extractTitle(rootHtml), probeFile: probeHit };
            if (root.status !== 200 && root.status !== 404) {
                entry.state = "partial";
                entry.error = `serve root HTTP ${root.status} (neither a site nor the repo-as-web/empty 404 shape)`;
            }
        } catch (err) {
            entry.serve = { kind: "unknown", root: null, title: null, probeFile: null };
            entry.state = "partial";
            entry.error = `serve probe failed: ${err}`;
        }
    } else {
        entry.state = "partial";
        entry.error = "Pages enabled but html_url is null — nothing to visit";
    }

    try {
        entry.latestDeploy = await collectLatestDeploy(repo, entry.buildType ?? null);
    } catch (err) {
        // Field stays unset (NOT null): null is reserved for proven-empty.
        entry.state = "partial";
        entry.error = [entry.error, `deploy lookup failed: ${err}`].filter(Boolean).join("; ");
    }

    // --- Signal 3: plausible — only live `site`s have HTML worth sweeping ---
    if (entry.serve?.kind === "site" && rootHtml) {
        const plausible = emptyPlausible();
        // Crawled paths are origin-absolute ("/restraml/diff.html"), so
        // join them with the origin — NOT with html_url, which already
        // carries the site's subpath and would double it.
        const origin = new URL(rootFinalUrl).origin;
        const rootPath = new URL(rootFinalUrl).pathname;
        const seeds = [rootPath, ...extractCrawlPaths(rootHtml, rootFinalUrl).filter((p) => p !== rootPath)];
        plausible.truncated = seeds.length > HTML_PAGE_CAP;
        for (const path of seeds.slice(0, HTML_PAGE_CAP)) {
            let html: string;
            if (path === rootPath) {
                html = rootHtml;
            } else {
                try {
                    html = (await fetchPublished(`${origin}${path}`)).text;
                } catch (err) {
                    // One page failing must not discard the pages already swept.
                    entry.state = "partial";
                    entry.error = [entry.error, `plausible sweep skipped ${path}: ${err}`].filter(Boolean).join("; ");
                    continue;
                }
            }
            const scan = scanPlausibleHtml(html);
            plausible.pagesChecked.push(path);
            if (scan.present) {
                plausible.pagesWithSnippet.push(path);
                plausible.script = plausible.script ?? scan.script;
                if (scan.dataDomain) {
                    plausible.dataDomain = plausible.dataDomain ?? scan.dataDomain;
                    if (!plausible.dataDomains.includes(scan.dataDomain)) plausible.dataDomains.push(scan.dataDomain);
                }
            }
            for (const e of scan.events) {
                if (!plausible.events.includes(e)) plausible.events.push(e);
            }
        }
        plausible.present = plausible.pagesWithSnippet.length > 0;
        plausible.events.sort();
        entry.plausible = plausible;
    }

    return entry;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main() {
    console.log("Surveying tikoci org repos for GitHub Pages + Plausible...");
    const orgRepos = await listOrgRepos();
    console.log(`  ${orgRepos.length} repos in org`);

    const surveyed = await mapWithConcurrency(orgRepos, MAX_CONCURRENCY, async (repo) => {
        console.log(`  Pages: ${repo}`);
        try {
            return await collectOneRepo(repo);
        } catch (err) {
            console.warn(`  Pages: ${repo} collection threw: ${err}`);
            return { name: repo, hasPages: null, state: "error", error: String(err) } as PagesRepoSurvey;
        }
    });

    const repos: Record<string, PagesRepoSurvey> = {};
    for (const r of surveyed) repos[r.name] = r;
    const withPages = surveyed.filter((r) => r.hasPages).length;

    const file: PagesSurveyFile = {
        schemaVersion: PAGES_SURVEY_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        generatedBy: "scripts/repo-github-pages.ts (weekly/manual — bun run survey:pages)",
        collection: {
            mode: "manual",
            auth: AUTH_MODE,
            note: "Durable public-repository survey under data/. Refreshed weekly and manually. Pages settings remain token-scoped; inaccessible settings can return 404.",
        },
        budgets: {
            githubApiCalls: stats.githubApiCalls,
            otherHttpCalls: stats.otherHttpCalls,
            maxConcurrency: MAX_CONCURRENCY,
            timeoutMsPerRequest: REQUEST_TIMEOUT_MS,
            rateLimitRemaining: stats.rateLimitRemaining,
        },
        sources: {
            pagesApi: "GET repos/{owner}/{repo}/pages (404 = off; 401/403 = unknown)",
            deploy: "GET repos/{repo}/deployments?environment=github-pages (workflow) | GET repos/{repo}/pages/builds/latest (legacy)",
            serve: "HTTP GET of html_url as an anonymous visitor (+ README.md/package.json/index.html probes when root 404s)",
            plausible: "HTTP GET of published HTML: root + same-origin *.html depth-1 crawl (cap 10 pages/site); multiline scan for plausible.io script tags + plausible('Event') calls",
        },
        coverage: {
            repos: orgRepos,
            withPages,
            note: `${orgRepos.length} org repos surveyed; ${withPages} with Pages. The plausible block exists only where a sweep ran (live sites); truncated flags cap-cut sweeps.`,
        },
        repos,
        findings: deriveFindings(surveyed, orgRepos),
    };

    writeFileSync(OUTFILE, `${JSON.stringify(file, null, 2)}\n`, "utf-8");
    console.log(`\nWrote ${OUTFILE}`);
    console.log(`  API calls: ${stats.githubApiCalls} github, ${stats.otherHttpCalls} http (rateLimitRemaining min: ${stats.rateLimitRemaining})`);
    console.log(`  Findings: ${file.findings.map((f) => f.id).join(", ") || "none"}`);
}

// Guarded so the pure core stays importable (tests) without side effects.
if (import.meta.main) {
    main().catch((err) => {
        console.error(`Survey failed: ${err}`);
        process.exitCode = 1;
    });
}
