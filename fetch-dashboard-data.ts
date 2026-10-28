/**
 * fetch-dashboard-data.ts — Build-time collector for the TIKOCI dashboard
 *
 * Produces dist/data/dashboard.json (v2 contract) plus per-repo detail files
 * dist/data/dashboard/<repo>.json: per-repo status signals grouped by what
 * actually matters for that repo (ROS-version tracking, CI health, npm
 * status, work tracking, releases). Driven by DASHBOARD_REPOS in
 * repo-config.ts — repos not listed there are skipped.
 *
 * Design notes:
 *   - Pure mapping/derivation (summarize*, build*, deriveFindings) is kept
 *     separate from I/O (collect*) so the contract is testable from
 *     fixtures without network access. See test/dashboard-contract.test.js.
 *   - GitHub API calls use the same token resolution as fetch-github-data.ts
 *     (GITHUB_TOKEN env → gh CLI → anonymous). CI always refreshes; local
 *     dev reuses a 1-hour cache (.dashboard-cache.json, gitignored).
 *   - Every sub-collector is non-fatal: failures are recorded as `error`
 *     strings on the signal (with an explicit non-ok `state`) so one flaky
 *     feed never breaks the build.
 *   - No search API (tight rate limits). Work data comes from the per-repo
 *     issues + pulls endpoints, which count against the core quota. Only
 *     the first 100-item page is fetched; full pages are reported as
 *     lower-bound counts (truncated), never silently treated as totals.
 *   - CI status always means the latest run on the DEFAULT branch
 *     (runs?branch=<default>). PR-branch runs are excluded by the query
 *     and every run records its branch/commit/event as evidence.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
    COMMUNITY_EXCLUDE_AUTHORS,
    DASHBOARD_REPOS,
    RELATIONSHIPS,
    ROS_CHANNELS,
    type DashboardOverride,
    type RosCoverageKind,
    type RosLocator,
} from "./repo-config";
import { githubHeaders } from "./fetch-github-data";

const OWNER = "tikoci";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const MIKROTIK_NEWEST_URL = "https://upgrade.mikrotik.com/routeros/NEWESTa7";

/** Current dashboard.json contract version. Bumped on breaking changes; the
 *  local cache is invalidated when its version differs. */
export const DASHBOARD_SCHEMA_VERSION = 2;

// API budgets: bounded concurrency, per-request timeouts, single pages only.
const MAX_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 15_000;
const WORK_PAGE_SIZE = 100;
const SUMMARY_WORK_ITEMS = 10;
const ROS_COVERAGE_CAP = 12;
const RELEASE_WINDOW = 5;

// ---------------------------------------------------------------------------
// Public types (this is the dashboard.json schema)
// ---------------------------------------------------------------------------

/** Per-signal collection state. `error` carries the human-readable detail
 *  for "unknown" (unanswerable without transport failure) and "error"
 *  (fetch failed). "partial" (truncated/incomplete) is explained by the
 *  `truncated`/`page` flags instead, and usually carries no `error`. */
export type SignalState = "ok" | "partial" | "unknown" | "error";

export interface RosChannelState {
    state: SignalState;
    /** e.g. "7.20.1", null when the feed could not be read */
    version: string | null;
    /** Raw feed body for debugging, null on failure */
    raw: string | null;
    error?: string;
}

export interface RosChannelCoverage {
    /** Current channel version from the MikroTik feed (null when unreachable) */
    version: string | null;
    /** Whether coverage includes it (null when the channel version is unknown) */
    covered: boolean | null;
}

export interface RosRepoSignal {
    state: SignalState;
    /** Human-readable locator description from config, for debugging */
    locator: string;
    /** What `coverage` claims: tag existence, published artifacts, or tested versions */
    kind: RosCoverageKind;
    /** ROS versions this repo covers, newest first (capped; see `truncated`) */
    coverage: string[];
    /** Unique versions seen before the cap; full list is in the detail file */
    totalKnown: number;
    /** True when coverage was capped (expected-channel versions are pinned, never dropped) */
    truncated: boolean;
    /** Expected-channel verdicts, judged against the full (uncapped) list */
    channels: Record<string, RosChannelCoverage>;
    error?: string;
}

export interface RosLagSignal {
    state: SignalState;
    /** ROS version the derived artifact (e.g. ros-help.db) was built from */
    artifactVersion: string | null;
    /** Current stable from the MikroTik feed, for comparison */
    stableVersion: string | null;
    error?: string;
}

export interface CiWorkflowState {
    /** The trackedWorkflows entry that selected this (survives renames) */
    configured: string;
    name: string | null;
    path: string | null;
    /** False when the configured workflow was not found (reported, not dropped) */
    present: boolean;
    state: SignalState;
    /** Run status: queued | in_progress | completed | null (no run / not found) */
    status: string | null;
    /** Run conclusion on the default branch (null while running or when absent) */
    conclusion: string | null;
    /** Compat alias of conclusion (v1 field) */
    lastConclusion: string | null;
    headBranch: string | null;
    headSha: string | null;
    event: string | null;
    runStartedAt: string | null;
    lastUpdatedAt: string | null;
    lastUrl: string | null;
    /** Whether the run tested the current default-branch head (null when unknown) */
    isHead: boolean | null;
    error?: string;
}

export interface CiSignal {
    state: SignalState;
    defaultBranch: string;
    /** Default-branch head commit at collection time (null when unreadable) */
    headSha: string | null;
    headUrl: string | null;
    workflows: CiWorkflowState[];
    error?: string;
}

export interface CommunityItem {
    number: number;
    title: string;
    author: string;
    url: string;
    createdAt: string;
    isPR: boolean;
    labels: string[];
    milestone: string | null;
}

export interface CommunitySignal {
    state: SignalState;
    /** Filtered open counts (owner/bot authors excluded) */
    openIssues: number;
    openPRs: number;
    /** Unfiltered open counts (everyone). Lower bounds when `truncated`. */
    totalIssues: number;
    totalPRs: number;
    /** True when the 100-item listing page was full (counts may be partial) */
    truncated: boolean;
    /** Label/milestone tallies over the external (filtered) items only */
    byLabel: Record<string, number>;
    byMilestone: Record<string, number>;
    /** Newest first, capped at 5 */
    newest: CommunityItem[];
    error?: string;
}

export type AuthorClass = "owner" | "bot" | "external";

export interface WorkItem {
    number: number;
    title: string;
    author: string;
    authorClass: AuthorClass;
    url: string;
    createdAt: string;
    updatedAt: string;
    isPR: boolean;
    /** PRs only, from the pulls listing; null for issues or when unenriched */
    draft: boolean | null;
    labels: string[];
    milestone: string | null;
}

export interface WorkClassCounts {
    total: number;
    owner: number;
    external: number;
    bot: number;
}

export interface WorkPrCounts extends WorkClassCounts {
    /** Owner PRs known ready (draft === false); equals owner when draftUnknown */
    ownerReady: number;
    ownerDraft: number;
    /** True when the pulls listing failed and draft flags are unknown */
    draftUnknown: boolean;
}

export interface WorkSignal {
    state: SignalState;
    /** Counts from the fetched page; lower bounds when page.truncated */
    counts: { issues: WorkClassCounts; prs: WorkPrCounts };
    page: {
        fetched: number;
        perPage: number;
        truncated: boolean;
        countsAreLowerBounds: boolean;
    };
    /** False when the pulls listing failed (draft flags are null) */
    pullsEnriched: boolean;
    /** Newest first, capped (full fetched set is in the detail file) */
    items: WorkItem[];
    error?: string;
}

export type NpmAssessment =
    | "in-sync"
    | "pending-publish"
    | "prerelease-channel"
    | "not-published"
    | "registry-ahead"
    | "unknown";

export interface NpmSignal {
    state: SignalState;
    package: string;
    /** Whether the package is expected on npm (from config; default true).
     *  Confirmed absence with expected=false is recorded, not flagged. */
    expected: boolean;
    /** False = confirmed absent (registry 404); null = could not determine */
    published: boolean | null;
    repoVersion: string | null;
    repoPrerelease: boolean | null;
    latestVersion: string | null;
    /** All registry dist-tags (latest, next, ...) */
    distTags: Record<string, string>;
    repoVersionPublished: boolean | null;
    publishedAt: string | null;
    assessment: NpmAssessment;
    /** Compat: repoVersion numerically ahead of latestVersion (ignores channels) */
    behind: boolean | null;
    error?: string;
}

export interface ReleaseRef {
    tag: string;
    date: string | null;
    url: string;
    prerelease: boolean;
}

export interface ReleaseSignal {
    state: SignalState;
    /** Compat: absolute newest release, including prereleases */
    latestTag: string | null;
    latestDate: string | null;
    latestUrl: string | null;
    prerelease: boolean | null;
    /** Newest non-prerelease in the window (null when none) */
    stable: ReleaseRef | null;
    /** Absolute newest in the window, structured (null when no releases) */
    newest: ReleaseRef | null;
    /** True when newest is a prerelease while a stable exists */
    prereleaseChannel: boolean | null;
    windowFetched: number;
    error?: string;
}

export interface RepoDashboard {
    name: string;
    groups: string[];
    /** Per-repo detail file (full work index, full ROS coverage) */
    detail: string;
    ros?: RosRepoSignal;
    rosLag?: RosLagSignal;
    ci?: CiSignal;
    community?: CommunitySignal;
    work?: WorkSignal;
    npm?: NpmSignal;
    release?: ReleaseSignal;
}

export interface RepoDetailFile {
    schemaVersion: number;
    repo: string;
    generatedAt: string;
    collection: CollectionInfo;
    work?: {
        counts: WorkSignal["counts"];
        page: WorkSignal["page"];
        pullsEnriched: boolean;
        /** Full fetched set (newest first, up to WORK_PAGE_SIZE) */
        items: WorkItem[];
        error?: string;
    };
    ros?: {
        locator: string;
        kind: RosCoverageKind;
        /** Full uncapped coverage, newest first */
        coverage: string[];
        totalKnown: number;
        truncated: boolean;
        channels: Record<string, RosChannelCoverage>;
        error?: string;
    };
}

export interface ReadinessLink {
    source: string;
    target: string;
    /** Original curated type from RELATIONSHIPS */
    type: string;
    kind: "dependency" | "artifact-consumption" | "association";
    /** True only with a verifiedNote in repo-config.ts */
    verified: boolean;
    note: string | null;
}

export type FindingSeverity = "failure" | "pending" | "info" | "gap";
export type FindingCategory = "ci" | "ros" | "packages" | "releases" | "work" | "collection";

export interface Finding {
    /** Stable: "<rule>:<repo>[:<scope>]" (collection rules omit the repo) */
    id: string;
    rule: string;
    severity: FindingSeverity;
    category: FindingCategory;
    repos: string[];
    summary: string;
    /** Rule explanation: why this fired and how to interpret it */
    detail: string;
    /** Evidence refs: "<json-path>=<value>" pointers into dashboard.json */
    evidence: string[];
    urls: string[];
}

export interface CollectionInfo {
    mode: "fresh" | "local-cache" | "stale-cache-fallback";
    /** When the served data was collected (null when freshly collected) */
    cacheWrittenAt: string | null;
}

export interface BudgetInfo {
    githubApiCalls: number;
    otherHttpCalls: number;
    maxConcurrency: number;
    timeoutMsPerRequest: number;
    /** Minimum x-ratelimit-remaining observed (null when no GitHub calls) */
    rateLimitRemaining: number | null;
}

/** Standalone RouterOS channel versions file (dist/data/ros-versions.json):
 *  one HTTPS fetch instead of four feed reads. Same collection run as
 *  dashboard.json; shares its freshness semantics. */
export interface RosVersionsFile {
    schemaVersion: number;
    generatedAt: string;
    collection: CollectionInfo;
    channels: Record<string, RosChannelState>;
}

export interface DashboardData {
    schemaVersion: number;
    generatedAt: string;
    collection: CollectionInfo;
    budgets: BudgetInfo;
    /** Signal group → provenance (endpoint or feed the signal came from) */
    sources: Record<string, string>;
    coverage: { repos: string[]; note: string };
    rosCurrent: Record<string, RosChannelState>;
    repos: Record<string, RepoDashboard>;
    relationships: ReadinessLink[];
    findings: Finding[];
}

// ---------------------------------------------------------------------------
// Pure helpers: versions
// ---------------------------------------------------------------------------

/** Numeric dot-separated version compare: 1 if a > b, -1 if a < b, 0 if equal. Null when unparseable. */
export function compareVersions(a: string, b: string): number | null {
    // Split leading numeric run ("chr-7.26beta4" → [7,26] + beta/4); stable > rc > beta/other
    const split = (v: string): { nums: number[]; pre: number; preNum: number } | null => {
        const m = /^[^\d]*(\d+(?:\.\d+)*)(.*)$/.exec(v.trim());
        if (!m) return null;
        const suffix = m[2].toLowerCase();
        const pre = suffix === "" ? 2 : suffix.startsWith("rc") ? 1 : 0;
        const preNum = /^(?:beta|rc)[.-]?(\d+)/.exec(suffix)?.[1];
        return { nums: m[1].split(".").map(Number), pre, preNum: preNum ? Number(preNum) : 0 };
    };
    const pa = split(a);
    const pb = split(b);
    if (!pa || !pb) return null;
    for (let i = 0; i < Math.max(pa.nums.length, pb.nums.length); i++) {
        const x = pa.nums[i] ?? 0;
        const y = pb.nums[i] ?? 0;
        if (x !== y) return x > y ? 1 : -1;
    }
    if (pa.pre !== pb.pre) return pa.pre > pb.pre ? 1 : -1;
    if (pa.preNum !== pb.preNum) return pa.preNum > pb.preNum ? 1 : -1;
    return 0;
}

/** Sort ROS version strings newest-first; unparseable entries sink to the end. */
export function sortVersionsDesc(versions: string[]): string[] {
    return [...versions].sort((a, b) => {
        const cmp = compareVersions(a, b);
        if (cmp !== null) return -cmp;
        // Incomparable: a version compares equal to itself iff parseable.
        const aOk = compareVersions(a, a) !== null;
        const bOk = compareVersions(b, b) !== null;
        if (aOk === bOk) return 0;
        return aOk ? -1 : 1;
    });
}

/** Coerce a package.json version field (string expected, anything possible). */
export function coerceVersion(v: unknown): string | null {
    if (typeof v === "string") return v.trim() === "" ? null : v;
    if (v === null || v === undefined) return null;
    return String(v);
}

/** True when the version carries any suffix past the numeric core
 *  ("0.12.0-next", "7.26beta4", "7.25rc1"). Null when unparseable. */
export function isPrereleaseVersion(v: string): boolean | null {
    const m = /^[^\d]*\d+(?:\.\d+)*(.*)$/.exec(v.trim());
    if (!m) return null;
    return m[1].trim() !== "";
}

// ---------------------------------------------------------------------------
// Pure mappers: API payloads → signals (no I/O, fixture-tested)
// ---------------------------------------------------------------------------

/** Author class for work tracking. Owners are the COMMUNITY_EXCLUDE_AUTHORS
 *  list (maintainers); bots are GitHub Bot types or [bot] suffixes. */
export function classifyAuthor(login: string, type: string | undefined): AuthorClass {
    if (type === "Bot" || login.toLowerCase().endsWith("[bot]")) return "bot";
    if (COMMUNITY_EXCLUDE_AUTHORS.some((a) => a.toLowerCase() === login.toLowerCase())) return "owner";
    return "external";
}

const emptyClassCounts = (): WorkClassCounts => ({ total: 0, owner: 0, external: 0, bot: 0 });

/**
 * Map one issues-listing page (+ optional pulls draft map) to the full work
 * index and the external-author community view. `pullsDraft` is null when
 * the pulls listing failed; `summaryCap` bounds work.items (the full set is
 * returned separately for the detail file). Bodies/comments are never read.
 */
export function summarizeWorkIssues(
    issues: any[],
    pullsDraft: Record<number, boolean> | null,
    summaryCap: number,
    pullsError?: string | null,
): { work: WorkSignal; community: CommunitySignal; allItems: WorkItem[] } {
    const allItems: WorkItem[] = issues.map((i) => {
        const login = String(i.user?.login ?? "");
        const isPR = !!i.pull_request;
        return {
            number: i.number,
            title: String(i.title ?? ""),
            author: login,
            authorClass: classifyAuthor(login, i.user?.type),
            url: String(i.html_url ?? ""),
            createdAt: String(i.created_at ?? ""),
            updatedAt: String(i.updated_at ?? ""),
            isPR,
            draft: isPR ? (pullsDraft?.[i.number] ?? null) : null,
            labels: (i.labels ?? []).map((l: any) => String(l.name ?? l)),
            milestone: i.milestone?.title ?? null,
        };
    });

    const issueCounts = emptyClassCounts();
    const prBase = emptyClassCounts();
    let ownerReady = 0;
    let ownerDraft = 0;
    const pullsEnriched = pullsDraft !== null;
    for (const item of allItems) {
        const bucket = item.isPR ? prBase : issueCounts;
        bucket.total++;
        bucket[item.authorClass]++;
        if (item.isPR && item.authorClass === "owner") {
            if (item.draft === true) ownerDraft++;
            else if (item.draft === false) ownerReady++;
        }
    }
    // Without draft flags every owner PR counts as potentially ready.
    if (!pullsEnriched) ownerReady = prBase.owner;
    // PRs absent from the pulls page (listings can disagree near the cap)
    // carry draft:null despite enrichment; treat flags as incomplete.
    const nullDraftPRs = pullsEnriched ? allItems.filter((i) => i.isPR && i.draft === null).length : 0;
    const draftUnknown = !pullsEnriched || nullDraftPRs > 0;
    const prs: WorkPrCounts = { ...prBase, ownerReady, ownerDraft, draftUnknown };

    const truncated = issues.length >= WORK_PAGE_SIZE;
    const work: WorkSignal = {
        state: truncated || draftUnknown ? "partial" : "ok",
        counts: { issues: issueCounts, prs },
        page: { fetched: issues.length, perPage: WORK_PAGE_SIZE, truncated, countsAreLowerBounds: truncated },
        pullsEnriched,
        items: allItems.slice(0, summaryCap),
    };
    if (!pullsEnriched) work.error = `pulls listing failed${pullsError ? ` (${pullsError})` : ""}; draft flags unknown`;
    else if (nullDraftPRs > 0) work.error = `${nullDraftPRs} PR${nullDraftPRs === 1 ? " is" : "s are"} missing from the pulls listing; some draft flags unknown`;

    // External filter view (v1-compatible shape).
    const kept = allItems.filter((i) => i.authorClass === "external");
    const byLabel: Record<string, number> = {};
    const byMilestone: Record<string, number> = {};
    for (const i of kept) {
        for (const l of i.labels) byLabel[l] = (byLabel[l] ?? 0) + 1;
        if (i.milestone) byMilestone[i.milestone] = (byMilestone[i.milestone] ?? 0) + 1;
    }
    const community: CommunitySignal = {
        state: truncated ? "partial" : "ok",
        openIssues: kept.filter((i) => !i.isPR).length,
        openPRs: kept.filter((i) => i.isPR).length,
        totalIssues: issueCounts.total,
        totalPRs: prBase.total,
        truncated,
        byLabel,
        byMilestone,
        newest: kept.slice(0, 5).map((i) => ({
            number: i.number,
            title: i.title,
            author: i.author,
            url: i.url,
            createdAt: i.createdAt,
            isPR: i.isPR,
            labels: i.labels,
            milestone: i.milestone,
        })),
    };
    return { work, community, allItems };
}

/**
 * Map a repo package.json version + registry packument to the npm signal.
 * `notFound` means the packument 404'd (confirmed absent); `error` means the
 * fetch failed inconclusively (unknown, never "not published").
 */
export function summarizeNpm(
    pkg: string,
    repoVersion: string | null,
    packument: any | null,
    opts: { notFound?: boolean; error?: string | null; expected?: boolean },
): NpmSignal {
    const repoPrerelease = repoVersion ? isPrereleaseVersion(repoVersion) : null;
    const base = {
        package: pkg,
        expected: opts.expected ?? true,
        repoVersion,
        repoPrerelease,
        latestVersion: null as string | null,
        distTags: {} as Record<string, string>,
        repoVersionPublished: null as boolean | null,
        publishedAt: null as string | null,
        behind: null as boolean | null,
    };
    if (opts.error) {
        return { ...base, state: "error", published: null, assessment: "unknown", error: opts.error };
    }
    if (opts.notFound) {
        return { ...base, state: "ok", published: false, assessment: "not-published", repoVersionPublished: false };
    }
    if (!packument) {
        return { ...base, state: "error", published: null, assessment: "unknown", error: "packument missing without a registry 404" };
    }
    const distTags: Record<string, string> = packument["dist-tags"] ?? {};
    const latestVersion: string | null = distTags.latest ?? null;
    const versions = Object.keys(packument.versions ?? {});
    const repoVersionPublished = repoVersion ? versions.includes(repoVersion) : null;
    const publishedAt = latestVersion ? (packument.time?.[latestVersion] ?? null) : null;
    const cmp = repoVersion && latestVersion ? compareVersions(repoVersion, latestVersion) : null;
    const behind = cmp === null ? null : cmp > 0;

    // No repo version (package.json lacks one): the comparison is unanswerable.
    if (!repoVersion) {
        return {
            ...base, state: "unknown", published: true, latestVersion, distTags,
            repoVersionPublished, publishedAt, assessment: "unknown", behind,
            error: "package.json has no version field",
        };
    }
    let assessment: NpmAssessment;
    if (repoVersion === latestVersion) assessment = "in-sync";
    else if (cmp === null) {
        if (repoVersionPublished) assessment = "in-sync";
        else if (repoPrerelease) assessment = "prerelease-channel";
        // Registry holds only other channels (no latest tag) while a stable
        // repo version is unpublished: a release is pending.
        else if (latestVersion === null && Object.keys(distTags).length > 0) assessment = "pending-publish";
        else assessment = "unknown";
    } else if (cmp > 0) assessment = repoPrerelease ? "prerelease-channel" : "pending-publish";
    else if (cmp < 0) assessment = "registry-ahead";
    // Numerically equal but different strings ("0.12.0-next" vs
    // "0.12.0-next.5" — compareVersions collapses exotic suffixes): the
    // published-set membership is ground truth.
    else if (repoVersionPublished) assessment = "in-sync";
    else assessment = repoPrerelease ? "prerelease-channel" : "registry-ahead";
    return {
        ...base,
        state: "ok",
        published: true,
        latestVersion,
        distTags,
        repoVersionPublished,
        publishedAt,
        assessment,
        behind,
    };
}

/** Map a releases-listing window to the release signal (newest first). */
export function summarizeReleases(releases: any[]): ReleaseSignal {
    const toRef = (r: any): ReleaseRef => ({
        tag: String(r.tag_name),
        date: r.published_at ?? r.created_at ?? null,
        url: String(r.html_url ?? ""),
        prerelease: !!r.prerelease,
    });
    const newest = releases.length ? toRef(releases[0]) : null;
    const stableRaw = releases.find((r) => !r.prerelease);
    const stable = stableRaw ? toRef(stableRaw) : null;
    return {
        state: "ok",
        latestTag: newest?.tag ?? null,
        latestDate: newest?.date ?? null,
        latestUrl: newest?.url ?? null,
        prerelease: newest ? newest.prerelease : null,
        stable,
        newest,
        prereleaseChannel: newest ? newest.prerelease && stable !== null : null,
        windowFetched: releases.length,
    };
}

/**
 * Map one workflow's default-branch runs payload to its CI state.
 * `match` is null when the configured workflow was not found (reported, not
 * dropped); `runsPayload` is null in the same case. An empty runs list means
 * "never ran on the default branch" (unknown), never success. A run on any
 * other branch is distrusted even though the collector filters server-side:
 * branch evidence is re-checked here so a PR-branch failure can never read
 * as a default-branch failure.
 */
export function buildCiWorkflowState(
    configured: string,
    match: { name: string; path: string } | null,
    activeCount: number,
    runsPayload: any | null,
    headSha: string | null,
    defaultBranch: string,
): CiWorkflowState {
    const blank = {
        status: null as string | null,
        conclusion: null as string | null,
        lastConclusion: null as string | null,
        headBranch: null as string | null,
        headSha: null as string | null,
        event: null as string | null,
        runStartedAt: null as string | null,
        lastUpdatedAt: null as string | null,
        lastUrl: null as string | null,
        isHead: null as boolean | null,
    };
    if (!match) {
        return {
            configured,
            name: null,
            path: null,
            present: false,
            state: "unknown",
            ...blank,
            error: `configured workflow "${configured}" not found among ${activeCount} active workflows`,
        };
    }
    const run = runsPayload?.workflow_runs?.[0] ?? null;
    if (!run) {
        return {
            configured,
            name: match.name,
            path: match.path,
            present: true,
            state: "unknown",
            ...blank,
            error: "no runs on the default branch",
        };
    }
    const runSha: string | null = run.head_sha ?? null;
    const runBranch: string | null = run.head_branch ?? null;
    if (runBranch && runBranch !== defaultBranch) {
        return {
            configured,
            name: match.name,
            path: match.path,
            present: true,
            state: "unknown",
            status: run.status ?? null,
            conclusion: null,
            lastConclusion: null,
            headBranch: runBranch,
            headSha: runSha,
            event: run.event ?? null,
            runStartedAt: run.run_started_at ?? null,
            lastUpdatedAt: run.updated_at ?? null,
            lastUrl: run.html_url ?? null,
            isHead: headSha && runSha ? headSha.toLowerCase() === runSha.toLowerCase() : null,
            error: `latest run is on branch "${runBranch}", not the default branch "${defaultBranch}"`,
        };
    }
    return {
        configured,
        name: match.name,
        path: match.path,
        present: true,
        state: "ok",
        status: run.status ?? null,
        conclusion: run.conclusion ?? null,
        lastConclusion: run.conclusion ?? null,
        headBranch: run.head_branch ?? null,
        headSha: runSha,
        event: run.event ?? null,
        runStartedAt: run.run_started_at ?? null,
        lastUpdatedAt: run.updated_at ?? null,
        lastUrl: run.html_url ?? null,
        isHead: headSha && runSha ? headSha.toLowerCase() === runSha.toLowerCase() : null,
    };
}

export function summarizeCi(
    defaultBranch: string,
    headSha: string | null,
    headUrl: string | null,
    states: CiWorkflowState[],
    listError: string | null,
): CiSignal {
    let state: SignalState = "ok";
    let error: string | undefined;
    if (listError) {
        state = "error";
        error = listError;
    } else if (states.length === 0) {
        state = "unknown";
        error = "ci-health subscribed but no trackedWorkflows configured";
    } else if (!states.every((w) => w.state === "ok")) {
        state = "partial";
    }
    const signal: CiSignal = { state, defaultBranch, headSha, headUrl, workflows: states };
    if (error) signal.error = error;
    return signal;
}

/** Judge expected channels against the full (uncapped) coverage list.
 *  Versions compare numerically ("7.25" covers a "7.25.0" channel). */
export function buildChannelCoverage(
    expected: string[],
    rosCurrent: Record<string, RosChannelState>,
    coverage: string[],
): Record<string, RosChannelCoverage> {
    const out: Record<string, RosChannelCoverage> = {};
    for (const channel of expected) {
        const version = rosCurrent[channel]?.version ?? null;
        out[channel] = {
            version,
            covered: version ? coverage.some((c) => compareVersions(c, version) === 0) : null,
        };
    }
    return out;
}

/**
 * Curated RELATIONSHIPS → readiness links. Kinds default structurally
 * (dependency stays dependency, everything else is a general association);
 * nothing is verified without a verifiedNote, and no link implies a
 * blocker — findings never derive from relationships.
 */
export function buildReadinessLinks(): ReadinessLink[] {
    return RELATIONSHIPS.map((rel) => ({
        source: rel.source,
        target: rel.target,
        type: rel.type,
        kind: rel.readiness ?? (rel.type === "dependency" ? "dependency" : "association"),
        verified: !!rel.verifiedNote,
        note: rel.verifiedNote ?? null,
    }));
}

/** Project the standalone ros-versions.json file out of dashboard data. */
export function buildRosVersionsFile(data: DashboardData): RosVersionsFile {
    return {
        schemaVersion: 1,
        generatedAt: data.generatedAt,
        collection: data.collection,
        channels: data.rosCurrent,
    };
}

// ---------------------------------------------------------------------------
// Pure derivation: signals → findings (no I/O, fixture-tested)
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<FindingSeverity, number> = { failure: 0, gap: 1, pending: 2, info: 3 };
const CI_FAILURE_CONCLUSIONS = new Set(["failure", "timed_out", "startup_failure"]);

/** Sanitize a scope segment for finding IDs (workflow names contain spaces
 *  and colons); summaries and evidence keep the raw name. */
function sanitizeScope(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "unnamed";
}

export interface FindingsInput {
    repos: Record<string, RepoDashboard>;
    rosCurrent: Record<string, RosChannelState>;
    collection: CollectionInfo;
}

/**
 * Derive human/agent-readable findings once at build time. Severities:
 * failure (something is broken), pending (work to do), info (notable but
 * routine difference), gap (missing evidence blocks a conclusion). Open work
 * items are never failures. Relationships never produce findings.
 */
export function deriveFindings(input: FindingsInput): Finding[] {
    const findings: Finding[] = [];
    const push = (f: Finding) => findings.push(f);

    if (input.collection.mode !== "fresh") {
        push({
            id: "collection-stale-cache",
            rule: "collection-stale-cache",
            severity: "info",
            category: "collection",
            repos: [],
            summary: `Dashboard served from ${input.collection.mode} (collected ${input.collection.cacheWrittenAt ?? "unknown"})`,
            detail: "Signals were not recollected for this build; every timestamp and verdict below reflects the cached collection time, not now. Treat CI and version verdicts as stale until a fresh collection runs.",
            evidence: [
                `collection.mode=${input.collection.mode}`,
                `collection.cacheWrittenAt=${input.collection.cacheWrittenAt ?? "null"}`,
            ],
            urls: [],
        });
    }

    for (const [repo, r] of Object.entries(input.repos)) {
        deriveCiFindings(repo, r, push);
        deriveRosFindings(repo, r, push);
        derivePackageFindings(repo, r, push);
        deriveReleaseFindings(repo, r, push);
        deriveWorkFindings(repo, r, push);
    }

    findings.sort((a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        a.category.localeCompare(b.category) ||
        a.repos.join(",").localeCompare(b.repos.join(",")) ||
        a.rule.localeCompare(b.rule) ||
        a.id.localeCompare(b.id)
    );
    return findings;
}

function deriveCiFindings(repo: string, r: RepoDashboard, push: (f: Finding) => void) {
    const ci = r.ci;
    if (!ci) return;
    if (ci.state === "error") {
        push({
            id: `ci-workflows-error:${repo}`,
            rule: "ci-workflows-error",
            severity: "gap",
            category: "ci",
            repos: [repo],
            summary: `${repo}: workflow list unreadable (${ci.error ?? "unknown error"})`,
            detail: "The Actions workflows listing failed, so no workflow state is known. This is a collection gap, not a CI verdict.",
            evidence: [`repos.${repo}.ci.state=error`],
            urls: [`https://github.com/${OWNER}/${repo}/actions`],
        });
        return;
    }
    for (const w of ci.workflows) {
        const scope = `repos.${repo}.ci.workflows[${w.configured}]`;
        const idScope = sanitizeScope(w.configured);
        if (!w.present) {
            push({
                id: `ci-workflow-missing:${repo}:${idScope}`,
                rule: "ci-workflow-missing",
                severity: "gap",
                category: "ci",
                repos: [repo],
                summary: `${repo}: tracked workflow "${w.configured}" not found`,
                detail: "A workflow named in repo-config.ts trackedWorkflows matches no active workflow (renamed, deleted, or disabled). Fix the config or the repo; until then this workflow contributes no CI evidence.",
                evidence: [`${scope}.present=false`, `${scope}.error=${w.error ?? "null"}`],
                urls: [`https://github.com/${OWNER}/${repo}/actions`],
            });
            continue;
        }
        if (w.state === "error") {
            push({
                id: `ci-run-error:${repo}:${idScope}`,
                rule: "ci-run-error",
                severity: "gap",
                category: "ci",
                repos: [repo],
                summary: `${repo}: ${w.configured} runs unreadable (${w.error ?? "unknown error"})`,
                detail: "The workflow exists but its runs listing failed, so its default-branch status is unknown. Collection gap, not a CI verdict.",
                evidence: [`${scope}.state=error`],
                urls: w.lastUrl ? [w.lastUrl] : [`https://github.com/${OWNER}/${repo}/actions`],
            });
            continue;
        }
        if (w.state === "unknown") {
            if (w.headBranch) {
                push({
                    id: `ci-run-off-branch:${repo}:${idScope}`,
                    rule: "ci-run-off-branch",
                    severity: "gap",
                    category: "ci",
                    repos: [repo],
                    summary: `${repo}: ${w.configured} latest run is on ${w.headBranch}, not ${ci.defaultBranch}`,
                    detail: "The runs listing returned a run from another branch (the collector filters server-side, so this means the filter missed or the branch moved). There is no default-branch verdict — a gap, never a failure.",
                    evidence: [`${scope}.headBranch=${w.headBranch}`, `${scope}.state=unknown`],
                    urls: w.lastUrl ? [w.lastUrl] : [`https://github.com/${OWNER}/${repo}/actions`],
                });
                continue;
            }
            push({
                id: `ci-no-default-runs:${repo}:${idScope}`,
                rule: "ci-no-default-runs",
                severity: "gap",
                category: "ci",
                repos: [repo],
                summary: `${repo}: ${w.configured} never ran on ${ci.defaultBranch}`,
                detail: "The workflow exists but has no runs on the default branch. There is no passing evidence either way — this answers 'is CI passing?' with unknown, not yes.",
                evidence: [`${scope}.state=unknown`],
                urls: [`https://github.com/${OWNER}/${repo}/actions`],
            });
            continue;
        }
        if (w.conclusion && CI_FAILURE_CONCLUSIONS.has(w.conclusion)) {
            push({
                id: `ci-default-branch-failing:${repo}:${idScope}`,
                rule: "ci-default-branch-failing",
                severity: "failure",
                category: "ci",
                repos: [repo],
                summary: `${repo}: ${w.configured} ${w.conclusion} on ${w.headBranch ?? ci.defaultBranch}`,
                detail: "The latest default-branch run completed with a failing conclusion. Only default-branch runs count here; PR-branch runs are excluded at collection time.",
                evidence: [`${scope}.conclusion=${w.conclusion}`, `${scope}.headSha=${w.headSha ?? "null"}`],
                urls: w.lastUrl ? [w.lastUrl] : [`https://github.com/${OWNER}/${repo}/actions`],
            });
        } else if (w.status !== "completed") {
            push({
                id: `ci-run-in-progress:${repo}:${idScope}`,
                rule: "ci-run-in-progress",
                severity: "pending",
                category: "ci",
                repos: [repo],
                summary: `${repo}: ${w.configured} ${w.status ?? "running"} on ${w.headBranch ?? ci.defaultBranch}`,
                detail: "The latest default-branch run has not completed, so the current-commit verdict is pending. Re-check after it finishes.",
                evidence: [`${scope}.status=${w.status ?? "null"}`],
                urls: w.lastUrl ? [w.lastUrl] : [`https://github.com/${OWNER}/${repo}/actions`],
            });
        } else if (w.conclusion && w.conclusion !== "success") {
            push({
                id: `ci-run-unresolved:${repo}:${idScope}`,
                rule: "ci-run-unresolved",
                severity: "pending",
                category: "ci",
                repos: [repo],
                summary: `${repo}: ${w.configured} concluded ${w.conclusion}`,
                detail: "The latest default-branch run completed without success or classified failure (e.g. cancelled, skipped, neutral). Needs a human triage call; it is not passing evidence.",
                evidence: [`${scope}.conclusion=${w.conclusion}`],
                urls: w.lastUrl ? [w.lastUrl] : [`https://github.com/${OWNER}/${repo}/actions`],
            });
        }
        if (w.isHead === false) {
            push({
                id: `ci-run-not-head:${repo}:${idScope}`,
                rule: "ci-run-not-head",
                severity: "info",
                category: "ci",
                repos: [repo],
                summary: `${repo}: ${w.configured} latest run is not on the current head commit`,
                detail: "The latest default-branch run tested an older commit than the branch head. Its verdict (pass or fail) may not describe the current tree — e.g. CI has not run since the last push.",
                evidence: [`${scope}.headSha=${w.headSha ?? "null"}`, `repos.${repo}.ci.headSha=${ci.headSha ?? "null"}`],
                urls: w.lastUrl ? [w.lastUrl] : [`https://github.com/${OWNER}/${repo}/actions`],
            });
        }
    }
}

function deriveRosFindings(repo: string, r: RepoDashboard, push: (f: Finding) => void) {
    const ros = r.ros;
    if (ros) {
        if (ros.state === "error") {
            push({
                id: `ros-coverage-error:${repo}`,
                rule: "ros-coverage-error",
                severity: "gap",
                category: "ros",
                repos: [repo],
                summary: `${repo}: ROS coverage unreadable (${ros.error ?? "unknown error"})`,
                detail: "The coverage locator failed, so no version verdicts exist for this repo. Collection gap, not a missing version.",
                evidence: [`repos.${repo}.ros.state=error`],
                urls: [`https://github.com/${OWNER}/${repo}/actions`],
            });
        } else {
            for (const [channel, cov] of Object.entries(ros.channels)) {
                if (cov.version && cov.covered === false) {
                    push({
                        id: `ros-missing-channel:${repo}:${sanitizeScope(channel)}`,
                        rule: "ros-missing-channel",
                        severity: "pending",
                        category: "ros",
                        repos: [repo],
                        summary: `${repo}: missing ${channel} ${cov.version} (${ros.kind} coverage)`,
                        detail: `The current ${channel} version is absent from this repo's ${ros.kind} coverage list. Work to do (usually picked up by the polling workflow), not a failure. Only channels listed in rosChannels are judged.`,
                        evidence: [`repos.${repo}.ros.channels.${channel}=missing ${cov.version}`],
                        urls: [`https://github.com/${OWNER}/${repo}/actions`],
                    });
                }
            }
        }
    }
    const lag = r.rosLag;
    if (!lag) return;
    if (lag.state === "unknown" || lag.state === "error") {
        push({
            id: `ros-lag-unknown:${repo}`,
            rule: "ros-lag-unknown",
            severity: "gap",
            category: "ros",
            repos: [repo],
            summary: `${repo}: derived-artifact ROS version unknown (${lag.error ?? "no manifest"})`,
            detail: "Nothing machine-readable states which ROS version the derived artifact (e.g. ros-help.db) was built from. Upstream requirement: publish a machine-readable manifest in the repo (proposed: the well-known .tikoci/status.json — see dashboard-schema.md) stating the artifact's source ROS version, so the lag signal can compare against stable. See rosetta#230.",
            evidence: [`repos.${repo}.rosLag.state=${lag.state}`, `repos.${repo}.rosLag.artifactVersion=null`],
            urls: ["https://github.com/tikoci/rosetta/issues/230"],
        });
        return;
    }
    if (lag.artifactVersion && lag.stableVersion) {
        const cmp = compareVersions(lag.artifactVersion, lag.stableVersion);
        if (cmp !== null && cmp < 0) {
            push({
                id: `ros-lag-behind:${repo}`,
                rule: "ros-lag-behind",
                severity: "pending",
                category: "ros",
                repos: [repo],
                summary: `${repo}: artifact built from ${lag.artifactVersion}, stable is ${lag.stableVersion}`,
                detail: "The derived artifact trails current stable. Rebuild the artifact from a newer ROS to close the lag.",
                evidence: [`repos.${repo}.rosLag.artifactVersion=${lag.artifactVersion}`, `repos.${repo}.rosLag.stableVersion=${lag.stableVersion}`],
                urls: [`https://github.com/${OWNER}/${repo}/actions`],
            });
        }
    }
}

function derivePackageFindings(repo: string, r: RepoDashboard, push: (f: Finding) => void) {
    const npm = r.npm;
    if (!npm) return;
    const scope = `repos.${repo}.npm`;
    const pkgUrl = `https://www.npmjs.com/package/${npm.package}`;
    switch (npm.assessment) {
        case "pending-publish":
            push({
                id: `npm-pending-publish:${repo}`,
                rule: "npm-pending-publish",
                severity: "pending",
                category: "packages",
                repos: [repo],
                summary: `${repo}: ${npm.repoVersion} ahead of registry ${npm.latestVersion} — publish pending`,
                detail: "The repo's package.json carries a stable version newer than the registry's latest tag. Either cut a release or confirm the bump is intentional and unreleased.",
                evidence: [`${scope}.repoVersion=${npm.repoVersion}`, `${scope}.latestVersion=${npm.latestVersion}`],
                urls: [pkgUrl],
            });
            break;
        case "prerelease-channel":
            push({
                id: `npm-prerelease-channel:${repo}`,
                rule: "npm-prerelease-channel",
                severity: "info",
                category: "packages",
                repos: [repo],
                summary: `${repo}: ${npm.repoVersion} rides a prerelease channel (registry latest ${npm.latestVersion ?? "none"})`,
                detail: "The repo version is a prerelease ahead of registry latest. Routine for -next development lines; not a behind-registry failure. Dist-tags in the signal show the published channels.",
                evidence: [`${scope}.repoVersion=${npm.repoVersion}`, `${scope}.latestVersion=${npm.latestVersion ?? "null"}`],
                urls: [pkgUrl],
            });
            break;
        case "not-published":
            // Absence declared expected in config (donny) is settled: the
            // signal records the fact, no finding needed.
            if (npm.expected ?? true) {
                push({
                    id: `npm-not-published:${repo}`,
                    rule: "npm-not-published",
                    severity: "info",
                    category: "packages",
                    repos: [repo],
                    summary: `${repo}: not published on npm as ${npm.package} (confirmed 404)`,
                    detail: "The registry confirms the package name has no packument. Intent (reserved, planned, or abandoned) is not visible in the data — confirm in the repo before acting, then set npmExpected accordingly.",
                    evidence: [`${scope}.published=false`],
                    urls: [`https://github.com/${OWNER}/${repo}`],
                });
            }
            break;
        case "registry-ahead":
            push({
                id: `npm-registry-ahead:${repo}`,
                rule: "npm-registry-ahead",
                severity: "info",
                category: "packages",
                repos: [repo],
                summary: `${repo}: registry ${npm.latestVersion} ahead of repo ${npm.repoVersion}`,
                detail: "The registry's latest tag is newer than the repo's package.json — unusual (manual publish, tag move, or stale checkout). Worth a glance, not a failure.",
                evidence: [`${scope}.repoVersion=${npm.repoVersion}`, `${scope}.latestVersion=${npm.latestVersion}`],
                urls: [pkgUrl],
            });
            break;
        case "unknown":
            if (npm.state !== "ok") {
                push({
                    id: `npm-unknown:${repo}`,
                    rule: "npm-unknown",
                    severity: "gap",
                    category: "packages",
                    repos: [repo],
                    summary: `${repo}: npm state unknown (${npm.error ?? "fetch failed"})`,
                    detail: "The registry fetch failed inconclusively: this is neither 'published' nor 'not published'. A retry may resolve it.",
                    evidence: [`${scope}.state=error`],
                    urls: [pkgUrl],
                });
            }
            break;
        case "in-sync":
            break;
    }
}

function deriveReleaseFindings(repo: string, r: RepoDashboard, push: (f: Finding) => void) {
    const rel = r.release;
    if (!rel) return;
    if (rel.state === "error") {
        push({
            id: `release-unknown:${repo}`,
            rule: "release-unknown",
            severity: "gap",
            category: "releases",
            repos: [repo],
            summary: `${repo}: releases unreadable (${rel.error ?? "unknown error"})`,
            detail: "The releases listing failed, so newest/stable verdicts are unknown. Collection gap.",
            evidence: [`repos.${repo}.release.state=error`],
            urls: [`https://github.com/${OWNER}/${repo}/releases`],
        });
        return;
    }
    if (rel.prereleaseChannel) {
        push({
            id: `release-prerelease-newest:${repo}`,
            rule: "release-prerelease-newest",
            severity: "info",
            category: "releases",
            repos: [repo],
            summary: `${repo}: newest release ${rel.newest?.tag} is a prerelease (stable ${rel.stable?.tag})`,
            detail: "The newest release is flagged prerelease while a stable release exists. Routine for repos that ship -next builds; the stable tag is the installable one.",
            evidence: [`repos.${repo}.release.newest.tag=${rel.newest?.tag}`, `repos.${repo}.release.stable.tag=${rel.stable?.tag}`],
            urls: rel.newest ? [rel.newest.url] : [`https://github.com/${OWNER}/${repo}/releases`],
        });
    } else if (rel.newest?.prerelease && !rel.stable) {
        push({
            id: `release-no-stable-in-window:${repo}`,
            rule: "release-no-stable-in-window",
            severity: "info",
            category: "releases",
            repos: [repo],
            summary: `${repo}: newest ${rel.windowFetched} releases are all prereleases (no stable in window)`,
            detail: "Only the newest five releases are collected, and all of them are flagged prerelease. An older stable may exist below the window — check the releases page before concluding there is none.",
            evidence: [`repos.${repo}.release.newest.tag=${rel.newest.tag}`, `repos.${repo}.release.windowFetched=${rel.windowFetched}`],
            urls: [`https://github.com/${OWNER}/${repo}/releases`],
        });
    } else if (!rel.stable && !rel.newest) {
        push({
            id: `release-none:${repo}`,
            rule: "release-none",
            severity: "info",
            category: "releases",
            repos: [repo],
            summary: `${repo}: no GitHub releases`,
            detail: "The repo has no releases in the listing window. Normal for libraries published only to npm or containers published only to Docker Hub.",
            evidence: [`repos.${repo}.release.windowFetched=0`],
            urls: [`https://github.com/${OWNER}/${repo}/releases`],
        });
    }
}

function deriveWorkFindings(repo: string, r: RepoDashboard, push: (f: Finding) => void) {
    const work = r.work;
    // Fallback: community-only data (e.g. hand-written) still yields external findings.
    if (!work) {
        const c = r.community;
        if (c && c.state !== "error" && (c.openIssues > 0 || c.openPRs > 0)) {
            if (c.openPRs > 0) {
                push({
                    id: `work-external-prs:${repo}`,
                    rule: "work-external-prs",
                    severity: "pending",
                    category: "work",
                    repos: [repo],
                    summary: `${repo}: ${c.openPRs} open external PR${c.openPRs === 1 ? "" : "s"}`,
                    detail: "External pull requests await maintainer review. Review queue depth, not an alert.",
                    evidence: [`repos.${repo}.community.openPRs=${c.openPRs}`],
                    urls: [`https://github.com/${OWNER}/${repo}/pulls`],
                });
            }
            if (c.openIssues > 0) {
                push({
                    id: `work-external-issues:${repo}`,
                    rule: "work-external-issues",
                    severity: "info",
                    category: "work",
                    repos: [repo],
                    summary: `${repo}: ${c.openIssues} open external issue${c.openIssues === 1 ? "" : "s"}`,
                    detail: "Open issues from non-maintainers. Ordinary backlog volume, not an urgency signal — triage at will.",
                    evidence: [`repos.${repo}.community.openIssues=${c.openIssues}`],
                    urls: [`https://github.com/${OWNER}/${repo}/issues`],
                });
            }
        } else if (c?.state === "error") {
            push({
                id: `work-unknown:${repo}`,
                rule: "work-unknown",
                severity: "gap",
                category: "work",
                repos: [repo],
                summary: `${repo}: work index unreadable (${c.error ?? "unknown error"})`,
                detail: "The issues listing failed, so open-issue/PR counts and the index are unknown. Collection gap.",
                evidence: [`repos.${repo}.community.state=error`],
                urls: [`https://github.com/${OWNER}/${repo}/issues`],
            });
        }
        return;
    }
    if (work.state === "error") {
        push({
            id: `work-unknown:${repo}`,
            rule: "work-unknown",
            severity: "gap",
            category: "work",
            repos: [repo],
            summary: `${repo}: work index unreadable (${work.error ?? "unknown error"})`,
            detail: "The issues listing failed, so open-issue/PR counts and the index are unknown. Collection gap.",
            evidence: [`repos.${repo}.work.state=error`],
            urls: [`https://github.com/${OWNER}/${repo}/issues`],
        });
        return;
    }
    const lower = work.page.countsAreLowerBounds ? "+" : "";
    const truncNote = work.page.truncated ? " Counts are lower bounds (listing truncated at 100); see the detail file." : "";
    if (work.counts.prs.external > 0) {
        push({
            id: `work-external-prs:${repo}`,
            rule: "work-external-prs",
            severity: "pending",
            category: "work",
            repos: [repo],
            summary: `${repo}: ${work.counts.prs.external}${lower} open external PR${work.counts.prs.external === 1 ? "" : "s"}`,
            detail: `External pull requests await maintainer review. Review queue depth, not an alert.${truncNote}`,
            evidence: [`repos.${repo}.work.counts.prs.external=${work.counts.prs.external}${lower}`],
            urls: [`https://github.com/${OWNER}/${repo}/pulls`],
        });
    }
    if (work.counts.issues.external > 0) {
        push({
            id: `work-external-issues:${repo}`,
            rule: "work-external-issues",
            severity: "info",
            category: "work",
            repos: [repo],
            summary: `${repo}: ${work.counts.issues.external}${lower} open external issue${work.counts.issues.external === 1 ? "" : "s"}`,
            detail: `Open issues from non-maintainers. Ordinary backlog volume, not an urgency signal — triage at will.${truncNote}`,
            evidence: [`repos.${repo}.work.counts.issues.external=${work.counts.issues.external}${lower}`],
            urls: [`https://github.com/${OWNER}/${repo}/issues`],
        });
    }
    const ownerReady = work.counts.prs.ownerReady ?? work.counts.prs.owner;
    if (ownerReady > 0) {
        const draftNote = !work.pullsEnriched
            ? " (draft state unknown: pulls listing failed)"
            : work.counts.prs.draftUnknown
              ? " (some draft flags missing from the pulls listing)"
              : work.counts.prs.ownerDraft > 0
                ? ` (${work.counts.prs.ownerDraft} draft${work.counts.prs.ownerDraft === 1 ? "" : "s"} excluded)`
                : "";
        push({
            id: `work-maintainer-prs:${repo}`,
            rule: "work-maintainer-prs",
            severity: "pending",
            category: "work",
            repos: [repo],
            summary: `${repo}: ${ownerReady}${lower} open maintainer PR${ownerReady === 1 ? "" : "s"}${draftNote}`,
            detail: `In-flight maintainer pull requests (ready for review unless marked draft). Tracks ongoing work, not problems.${truncNote}`,
            evidence: [`repos.${repo}.work.counts.prs.ownerReady=${ownerReady}${lower}`],
            urls: [`https://github.com/${OWNER}/${repo}/pulls`],
        });
    }
    if (work.page.truncated) {
        push({
            id: `work-list-truncated:${repo}`,
            rule: "work-list-truncated",
            severity: "info",
            category: "work",
            repos: [repo],
            summary: `${repo}: work listing filled the 100-item page cap`,
            detail: "Only the first (newest) page of open issues/PRs was collected and it came back full, so counts should be treated as lower bounds — older items may exist beyond the page. (A repo with exactly 100 open items is indistinguishable from a longer list.) Deliberate API budget cap, documented in sources/coverage.",
            evidence: [`repos.${repo}.work.page.truncated=true`, `repos.${repo}.work.page.fetched=${work.page.fetched}`],
            urls: [`https://github.com/${OWNER}/${repo}/issues`],
        });
    }
}

// ---------------------------------------------------------------------------
// I/O: budgeted fetching
// ---------------------------------------------------------------------------

const stats = {
    githubApiCalls: 0,
    otherHttpCalls: 0,
    rateLimitRemaining: null as number | null,
};

function resetStats() {
    stats.githubApiCalls = 0;
    stats.otherHttpCalls = 0;
    stats.rateLimitRemaining = null;
}

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

async function fetchRaw(url: string, auth: boolean): Promise<Response> {
    const headers: Record<string, string> = auth
        ? githubHeaders()
        : { "User-Agent": "tikoci-website-build" };
    if (auth) stats.githubApiCalls++;
    else stats.otherHttpCalls++;
    const resp = await fetchWithTimeout(url, { headers });
    if (auth) {
        const remaining = resp.headers.get("x-ratelimit-remaining");
        if (remaining !== null) {
            const n = Number(remaining);
            if (Number.isFinite(n)) {
                stats.rateLimitRemaining = stats.rateLimitRemaining === null ? n : Math.min(stats.rateLimitRemaining, n);
            }
        }
    }
    return resp;
}

async function fetchJson(url: string, auth: boolean): Promise<any> {
    const resp = await fetchRaw(url, auth);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return resp.json();
}

async function fetchText(url: string): Promise<string> {
    const resp = await fetchRaw(url, false);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return resp.text();
}

/** Encode a repo-relative path for a URL, preserving segment boundaries. */
function encodePath(path: string): string {
    return path.split("/").map(encodeURIComponent).join("/");
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
// Group collectors (all non-fatal: failures become signal error states)
// ---------------------------------------------------------------------------

/** Global ground truth: current ROS per MikroTik channel. */
async function collectRosCurrent(): Promise<Record<string, RosChannelState>> {
    const entries = await mapWithConcurrency(ROS_CHANNELS, MAX_CONCURRENCY, async (channel) => {
        try {
            const raw = (await fetchText(`${MIKROTIK_NEWEST_URL}.${channel}`)).trim();
            // Feed format: "<version> <build-timestamp>", e.g. "7.20.1 1700221125"
            const version = raw.split(/\s+/)[0] || null;
            return [channel, { state: "ok", version, raw } as RosChannelState] as const;
        } catch (err) {
            return [channel, { state: "error", version: null, raw: null, error: String(err) } as RosChannelState] as const;
        }
    });
    return Object.fromEntries(entries);
}

/**
 * Per-repo ROS coverage: which versions the repo has tagged/published/tested
 * (see RosCoverageKind). Current channel versions (`pin`) are always
 * included when present so the newest-N cap can't turn "old but covered"
 * into a false missing-stable flag. Channel verdicts are judged against the
 * full uncapped list; the capped summary keeps dashboard.json bounded.
 */
async function collectRosCoverage(
    repo: string,
    locator: RosLocator,
    kind: RosCoverageKind,
    expectedChannels: string[],
    rosCurrent: Record<string, RosChannelState>,
    pin: string[] = [],
): Promise<{ signal: RosRepoSignal; fullCoverage: string[] }> {
    const describe = `${locator.kind}:${[locator.ref, locator.path].filter((p) => p).join(":")}`;
    try {
        const pattern = new RegExp(locator.pattern);
        let names: string[] = [];
        if (locator.kind === "github-tags") {
            const tags = await fetchJson(
                `https://api.github.com/repos/${OWNER}/${repo}/tags?per_page=100`,
                true,
            );
            names = tags.map((t: any) => String(t.name));
        } else if (locator.kind === "github-releases") {
            const releases = await fetchJson(
                `https://api.github.com/repos/${OWNER}/${repo}/releases?per_page=100`,
                true,
            );
            names = releases.map((r: any) => String(r.tag_name));
        } else if (locator.kind === "contents-dirs") {
            const items = await fetchJson(
                `https://api.github.com/repos/${OWNER}/${repo}/contents/${encodePath(locator.path ?? "")}`,
                true,
            );
            names = items.filter((i: any) => i.type === "dir").map((i: any) => String(i.name));
        } else if (locator.kind === "raw-json") {
            const text = await fetchText(
                `https://raw.githubusercontent.com/${OWNER}/${repo}/${locator.ref ?? "main"}/${locator.path}`,
            );
            const data = JSON.parse(text);
            names = Array.isArray(data) ? data.map(String) : Object.keys(data);
        } else {
            // raw-text yields one version, not a list — meaningless for coverage.
            const signal: RosRepoSignal = {
                state: "error",
                locator: describe,
                kind,
                coverage: [],
                totalKnown: 0,
                truncated: false,
                channels: {},
                error: `unsupported locator kind "${locator.kind}" for ros-tracking`,
            };
            return { signal, fullCoverage: [] };
        }
        const versions = names
            .map((n) => {
                const m = pattern.exec(n);
                return m?.[1] ?? m?.[0];
            })
            .filter((v): v is string => !!v);
        const fullCoverage = sortVersionsDesc([...new Set(versions)]);
        // Channel versions (compared numerically: "7.25" satisfies "7.25.0")
        // survive the cap; the repo's own strings are always displayed.
        const isPinned = (v: string) => pin.some((p) => compareVersions(p, v) === 0);
        const pinned = fullCoverage.filter(isPinned);
        const rest = fullCoverage.filter((v) => !isPinned(v)).slice(0, ROS_COVERAGE_CAP);
        const coverage = sortVersionsDesc([...rest, ...pinned]);
        return {
            signal: {
                state: "ok",
                locator: describe,
                kind,
                coverage,
                totalKnown: fullCoverage.length,
                truncated: fullCoverage.length > coverage.length,
                channels: buildChannelCoverage(expectedChannels, rosCurrent, fullCoverage),
            },
            fullCoverage,
        };
    } catch (err) {
        const signal: RosRepoSignal = {
            state: "error",
            locator: describe,
            kind,
            coverage: [],
            totalKnown: 0,
            truncated: false,
            channels: {},
            error: String(err),
        };
        return { signal, fullCoverage: [] };
    }
}

/** Rosetta-style lag: artifact version vs current stable. */
async function collectRosLag(
    repo: string,
    locator: RosLocator | undefined,
    stableVersion: string | null,
): Promise<RosLagSignal> {
    if (!locator) {
        return { state: "unknown", artifactVersion: null, stableVersion, error: "no manifest configured" };
    }
    try {
        const pattern = new RegExp(locator.pattern);
        let text: string;
        if (locator.kind === "raw-json" || locator.kind === "raw-text") {
            text = await fetchText(
                `https://raw.githubusercontent.com/${OWNER}/${repo}/${locator.ref ?? "main"}/${locator.path}`,
            );
        } else if (locator.kind === "github-releases") {
            // Scan newest release notes for the pattern
            const releases = await fetchJson(
                `https://api.github.com/repos/${OWNER}/${repo}/releases?per_page=5`,
                true,
            );
            text = releases.map((r: any) => `${r.tag_name}\n${r.body ?? ""}`).join("\n");
        } else {
            return { state: "error", artifactVersion: null, stableVersion, error: `unsupported locator kind "${locator.kind}" for ros-lag` };
        }
        const match = pattern.exec(text);
        const artifactVersion = match?.[1] ?? match?.[0] ?? null;
        if (!artifactVersion) {
            return { state: "unknown", artifactVersion: null, stableVersion, error: "manifest fetched but pattern matched nothing" };
        }
        return { state: "ok", artifactVersion, stableVersion };
    } catch (err) {
        return { state: "error", artifactVersion: null, stableVersion, error: String(err) };
    }
}

/**
 * Default-branch run state for each tracked workflow. Runs are filtered to
 * the default branch server-side; a configured workflow with no match is
 * reported (present:false), never silently dropped.
 */
async function collectCi(repo: string, tracked: string[], defaultBranch: string, headSha: string | null): Promise<CiSignal> {
    let workflows: any[];
    try {
        const data = await fetchJson(
            `https://api.github.com/repos/${OWNER}/${repo}/actions/workflows?per_page=100`,
            true,
        );
        workflows = (data.workflows as any[]).filter((w) => w.state === "active");
    } catch (err) {
        return summarizeCi(defaultBranch, null, null, [], String(err));
    }
    const states: CiWorkflowState[] = [];
    for (const t of tracked) {
        const match = workflows.find((w) => w.path.endsWith(t) || w.name === t);
        if (!match) {
            states.push(buildCiWorkflowState(t, null, workflows.length, null, headSha, defaultBranch));
            continue;
        }
        try {
            const runs = await fetchJson(
                `https://api.github.com/repos/${OWNER}/${repo}/actions/workflows/${match.id}/runs?branch=${encodeURIComponent(defaultBranch)}&per_page=1`,
                true,
            );
            states.push(buildCiWorkflowState(t, { name: match.name, path: match.path }, workflows.length, runs, headSha, defaultBranch));
        } catch (err) {
            states.push({
                configured: t,
                name: match.name,
                path: match.path,
                present: true,
                state: "error",
                status: null,
                conclusion: null,
                lastConclusion: null,
                headBranch: null,
                headSha: null,
                event: null,
                runStartedAt: null,
                lastUpdatedAt: null,
                lastUrl: null,
                isHead: null,
                error: String(err),
            });
        }
    }
    return summarizeCi(defaultBranch, headSha, headSha ? `https://github.com/${OWNER}/${repo}/commit/${headSha}` : null, states, null);
}

function workErrorSignals(message: string): { work: WorkSignal; community: CommunitySignal; allItems: WorkItem[] } {
    const community: CommunitySignal = {
        state: "error",
        openIssues: 0, openPRs: 0, totalIssues: 0, totalPRs: 0,
        truncated: false, byLabel: {}, byMilestone: {}, newest: [], error: message,
    };
    const work: WorkSignal = {
        state: "error",
        counts: {
            issues: { total: 0, owner: 0, external: 0, bot: 0 },
            prs: { total: 0, owner: 0, external: 0, bot: 0, ownerReady: 0, ownerDraft: 0, draftUnknown: true },
        },
        page: { fetched: 0, perPage: WORK_PAGE_SIZE, truncated: false, countsAreLowerBounds: false },
        pullsEnriched: false,
        items: [],
        error: message,
    };
    return { work, community, allItems: [] };
}

/**
 * Open issues/PRs for all authors (one newest-first page) plus the
 * external-author community view. Draft flags come from the pulls listing;
 * bodies and comments are never fetched.
 */
async function collectWork(repo: string): Promise<{ work: WorkSignal; community: CommunitySignal; allItems: WorkItem[] }> {
    let issues: any[];
    try {
        issues = await fetchJson(
            `https://api.github.com/repos/${OWNER}/${repo}/issues?state=open&per_page=${WORK_PAGE_SIZE}&sort=created&direction=desc`,
            true,
        );
        if (!Array.isArray(issues)) throw new Error(`issues listing returned ${typeof issues}, expected an array`);
    } catch (err) {
        return workErrorSignals(String(err));
    }
    let pullsDraft: Record<number, boolean> | null = null;
    let pullsError: string | null = null;
    try {
        const pulls = await fetchJson(
            `https://api.github.com/repos/${OWNER}/${repo}/pulls?state=open&per_page=${WORK_PAGE_SIZE}&sort=created&direction=desc`,
            true,
        );
        if (!Array.isArray(pulls)) throw new Error(`pulls listing returned ${typeof pulls}, expected an array`);
        pullsDraft = {};
        for (const p of pulls) pullsDraft[p.number] = !!p.draft;
    } catch (err) {
        // Non-fatal: draft flags stay null, pullsEnriched false says so.
        pullsError = String(err);
    }
    try {
        return summarizeWorkIssues(issues, pullsDraft, SUMMARY_WORK_ITEMS, pullsError);
    } catch (err) {
        // A malformed payload must fail this repo's signals, never the run.
        return workErrorSignals(String(err));
    }
}

/**
 * Registry publish state vs repo package.json. A packument 404 is confirmed
 * absence; any other failure is unknown. One packument fetch supplies
 * dist-tags, versions, and timestamps (no separate /latest call).
 */
async function collectNpm(repo: string, pkg: string, packagePath: string, defaultBranch: string, expected: boolean): Promise<NpmSignal> {
    let repoVersion: string | null = null;
    try {
        const pkgJson = await fetchJson(
            `https://api.github.com/repos/${OWNER}/${repo}/contents/${encodePath(packagePath)}?ref=${defaultBranch}`,
            true,
        );
        repoVersion = coerceVersion(JSON.parse(Buffer.from(pkgJson.content, "base64").toString("utf-8")).version);
    } catch (err) {
        return {
            state: "error", package: pkg, expected, published: null, repoVersion: null, repoPrerelease: null,
            latestVersion: null, distTags: {}, repoVersionPublished: null, publishedAt: null,
            assessment: "unknown", behind: null, error: String(err),
        };
    }
    const regUrl = `https://registry.npmjs.org/${encodeURIComponent(pkg).replace("%2F", "/")}`;
    try {
        const resp = await fetchRaw(regUrl, false);
        if (resp.status === 404) return summarizeNpm(pkg, repoVersion, null, { notFound: true, expected });
        if (!resp.ok) return summarizeNpm(pkg, repoVersion, null, { error: `HTTP ${resp.status} for ${regUrl}`, expected });
        return summarizeNpm(pkg, repoVersion, await resp.json(), { expected });
    } catch (err) {
        return summarizeNpm(pkg, repoVersion, null, { error: String(err), expected });
    }
}

/** Newest release window (newest + latest stable, prereleases flagged). */
async function collectRelease(repo: string): Promise<ReleaseSignal> {
    try {
        const releases = await fetchJson(
            `https://api.github.com/repos/${OWNER}/${repo}/releases?per_page=${RELEASE_WINDOW}`,
            true,
        );
        return summarizeReleases(releases);
    } catch (err) {
        return {
            state: "error",
            latestTag: null, latestDate: null, latestUrl: null, prerelease: null,
            stable: null, newest: null, prereleaseChannel: null, windowFetched: 0, error: String(err),
        };
    }
}

// ---------------------------------------------------------------------------
// Cache + main entry
// ---------------------------------------------------------------------------

export interface DashboardCache {
    timestamp: number;
    schemaVersion: number;
    data: DashboardData;
    details: Record<string, RepoDetailFile>;
}

export function writeDashboardCache(cachePath: string, data: DashboardData, details: Record<string, RepoDetailFile> = {}): void {
    const cache: DashboardCache = { timestamp: Date.now(), schemaVersion: DASHBOARD_SCHEMA_VERSION, data, details };
    writeFileSync(cachePath, JSON.stringify(cache), "utf-8");
}

/** Null on missing/corrupt/expired cache — and on schema mismatch, so an old
 *  cache is never served as the current contract. allowStale bypasses only
 *  the age check (total-failure fallback), never the version check. */
export function readDashboardCache(cachePath: string, opts: { allowStale?: boolean } = {}): DashboardCache | null {
    if (!existsSync(cachePath)) return null;
    try {
        const cache: DashboardCache = JSON.parse(readFileSync(cachePath, "utf-8"));
        if (cache.schemaVersion !== DASHBOARD_SCHEMA_VERSION) return null;
        if (!opts.allowStale && Date.now() - cache.timestamp >= CACHE_MAX_AGE_MS) return null;
        if (!cache.data || typeof cache.data !== "object") return null;
        return { ...cache, details: cache.details ?? {} };
    } catch { /* cache corrupt, refetch */ }
    return null;
}

function detailPathFor(repo: string): string {
    return `data/dashboard/${repo}.json`;
}

function dashboardSources(): Record<string, string> {
    return {
        "ros-current": `${MIKROTIK_NEWEST_URL}.<channel> (MikroTik upgrade feed; body "<version> <build-ts>")`,
        "ros-tracking": "per-repo locator, see signal.locator: github-tags (?per_page=100) | github-releases (?per_page=100) | contents-dirs (one listing) | raw-json (one file); first page only",
        "ros-lag": "per-repo manifest locator, see repo-config.ts rosLagLocator (raw file, or newest release notes for github-releases)",
        "ci-health": "GitHub Actions API: /actions/workflows (?per_page=100, first page only) + /actions/workflows/{id}/runs?branch=<defaultBranch>&per_page=1",
        "community": `GitHub Issues API: /issues?state=open&per_page=${WORK_PAGE_SIZE}&sort=created&direction=desc, external-author filter (owners: ${COMMUNITY_EXCLUDE_AUTHORS.join(", ")})`,
        "work": `GitHub Issues API (same page as community, all authors) + Pulls API /pulls?state=open&per_page=${WORK_PAGE_SIZE} for draft flags; no bodies/comments`,
        "npm": "GitHub contents API for package.json + npm registry packument https://registry.npmjs.org/<pkg> (dist-tags, versions, time)",
        "releases": `GitHub Releases API: /releases?per_page=${RELEASE_WINDOW} (newest first)`,
    };
}

interface RepoCollectContext {
    rosCurrent: Record<string, RosChannelState>;
    channelVersions: string[];
    stable: string | null;
    generatedAt: string;
    collection: CollectionInfo;
}

/** Last-resort guard: one repo's unexpected throw must not discard every
 *  other repo's fresh signals. Each subscribed group gets an error signal
 *  so the failure is visible (and flagged) instead of silent. */
function errorEntry(repo: string, cfg: DashboardOverride, ctx: RepoCollectContext, err: unknown): { entry: RepoDashboard; detail: RepoDetailFile } {
    const message = `unexpected collector failure: ${String(err)}`;
    const entry: RepoDashboard = { name: repo, groups: [...cfg.groups], detail: detailPathFor(repo) };
    const detail: RepoDetailFile = { schemaVersion: DASHBOARD_SCHEMA_VERSION, repo, generatedAt: ctx.generatedAt, collection: ctx.collection };
    if (cfg.groups.includes("ros-tracking")) {
        entry.ros = { state: "error", locator: "?", kind: cfg.rosCoverageKind ?? "published", coverage: [], totalKnown: 0, truncated: false, channels: {}, error: message };
        detail.ros = { locator: "?", kind: cfg.rosCoverageKind ?? "published", coverage: [], totalKnown: 0, truncated: false, channels: {}, error: message };
    }
    if (cfg.groups.includes("ros-lag")) {
        entry.rosLag = { state: "error", artifactVersion: null, stableVersion: ctx.stable, error: message };
    }
    if (cfg.groups.includes("ci-health")) {
        entry.ci = { state: "error", defaultBranch: "main", headSha: null, headUrl: null, workflows: [], error: message };
    }
    if (cfg.groups.includes("community")) {
        const { work, community } = workErrorSignals(message);
        entry.work = work;
        entry.community = community;
        detail.work = { counts: work.counts, page: work.page, pullsEnriched: false, items: [], error: message };
    }
    if (cfg.groups.includes("npm") && cfg.npmPackage) {
        entry.npm = {
            state: "error", package: cfg.npmPackage, expected: cfg.npmExpected ?? true,
            published: null, repoVersion: null, repoPrerelease: null, latestVersion: null,
            distTags: {}, repoVersionPublished: null, publishedAt: null,
            assessment: "unknown", behind: null, error: message,
        };
    }
    if (cfg.groups.includes("releases")) {
        entry.release = {
            state: "error", latestTag: null, latestDate: null, latestUrl: null, prerelease: null,
            stable: null, newest: null, prereleaseChannel: null, windowFetched: 0, error: message,
        };
    }
    return { entry, detail };
}

/** Collect one repo's subscribed signals plus its detail payload. */
async function collectOneRepo(repo: string, cfg: DashboardOverride, ctx: RepoCollectContext): Promise<{ entry: RepoDashboard; detail: RepoDetailFile }> {
    const entry: RepoDashboard = { name: repo, groups: [...cfg.groups], detail: detailPathFor(repo) };
    const detail: RepoDetailFile = { schemaVersion: DASHBOARD_SCHEMA_VERSION, repo, generatedAt: ctx.generatedAt, collection: ctx.collection };
    let defaultBranch = "main";
    if (cfg.groups.includes("npm") || cfg.groups.includes("ros-lag") || cfg.groups.includes("ci-health")) {
        try {
            const meta = await fetchJson(`https://api.github.com/repos/${OWNER}/${repo}`, true);
            defaultBranch = meta.default_branch ?? "main";
        } catch { /* keep "main" */ }
    }
    if (cfg.groups.includes("ros-tracking") && cfg.rosLocator) {
        const { signal, fullCoverage } = await collectRosCoverage(
            repo, cfg.rosLocator, cfg.rosCoverageKind ?? "published",
            cfg.rosChannels ?? ROS_CHANNELS, ctx.rosCurrent, ctx.channelVersions,
        );
        entry.ros = signal;
        detail.ros = {
            locator: signal.locator, kind: signal.kind, coverage: fullCoverage,
            totalKnown: signal.totalKnown, truncated: signal.truncated, channels: signal.channels,
            ...(signal.error ? { error: signal.error } : {}),
        };
    }
    if (cfg.groups.includes("ros-lag")) {
        entry.rosLag = await collectRosLag(repo, cfg.rosLagLocator, ctx.stable);
    }
    if (cfg.groups.includes("ci-health")) {
        let headSha: string | null = null;
        try {
            const branch = await fetchJson(`https://api.github.com/repos/${OWNER}/${repo}/branches/${defaultBranch}`, true);
            headSha = branch.commit?.sha ?? null;
        } catch { /* headSha stays null; isHead unknown */ }
        entry.ci = await collectCi(repo, cfg.trackedWorkflows ?? [], defaultBranch, headSha);
    }
    if (cfg.groups.includes("community")) {
        const { work, community, allItems } = await collectWork(repo);
        entry.work = work;
        entry.community = community;
        detail.work = {
            counts: work.counts, page: work.page, pullsEnriched: work.pullsEnriched, items: allItems,
            ...(work.error ? { error: work.error } : {}),
        };
    }
    if (cfg.groups.includes("npm") && cfg.npmPackage) {
        entry.npm = await collectNpm(repo, cfg.npmPackage, cfg.npmPackagePath ?? "package.json", defaultBranch, cfg.npmExpected ?? true);
    }
    if (cfg.groups.includes("releases")) {
        entry.release = await collectRelease(repo);
    }
    return { entry, detail };
}

/**
 * Main entry: collect all dashboard signals and write dashboard.json plus
 * per-repo detail files. Never throws — failures are captured per-signal
 * or fall back to cache.
 */
export async function fetchDashboardData(distDir: string): Promise<DashboardData> {
    const dataDir = join(distDir, "data");
    const detailDir = join(dataDir, "dashboard");
    mkdirSync(detailDir, { recursive: true });
    const cachePath = join(import.meta.dirname, ".dashboard-cache.json");

    const writeOutputs = (data: DashboardData, details: Record<string, RepoDetailFile>) => {
        writeFileSync(join(dataDir, "dashboard.json"), JSON.stringify(data, null, 2), "utf-8");
        writeFileSync(join(dataDir, "ros-versions.json"), JSON.stringify(buildRosVersionsFile(data), null, 2), "utf-8");
        for (const [repo, detail] of Object.entries(details)) {
            writeFileSync(join(detailDir, `${repo}.json`), JSON.stringify(detail, null, 2), "utf-8");
        }
    };

    const forceRefresh = !!process.env.CI || process.argv.includes("--fresh");
    if (!forceRefresh) {
        const cached = readDashboardCache(cachePath);
        if (cached) {
            console.log("  Using cached dashboard data (< 1 hour old)");
            cached.data.collection = { mode: "local-cache", cacheWrittenAt: cached.data.generatedAt };
            // Findings derive from the served collection mode, so the
            // collection-stale-cache finding appears exactly when served stale.
            cached.data.findings = deriveFindings({ repos: cached.data.repos, rosCurrent: cached.data.rosCurrent, collection: cached.data.collection });
            for (const detail of Object.values(cached.details)) detail.collection = cached.data.collection;
            writeOutputs(cached.data, cached.details);
            return cached.data;
        }
        if (existsSync(cachePath)) console.log("  Dashboard cache miss, expired, or incompatible — recollecting");
    }

    resetStats();
    console.log("  Collecting dashboard signals...");
    const generatedAt = new Date().toISOString();
    const collection: CollectionInfo = { mode: "fresh", cacheWrittenAt: null };
    const data: DashboardData = {
        schemaVersion: DASHBOARD_SCHEMA_VERSION,
        generatedAt,
        collection,
        budgets: { githubApiCalls: 0, otherHttpCalls: 0, maxConcurrency: MAX_CONCURRENCY, timeoutMsPerRequest: REQUEST_TIMEOUT_MS, rateLimitRemaining: null },
        sources: dashboardSources(),
        coverage: {
            repos: Object.keys(DASHBOARD_REPOS),
            note: "Only DASHBOARD_REPOS entries (repo-config.ts) are collected. Single 100-item pages: counts from a full page should be treated as lower bounds.",
        },
        rosCurrent: {},
        repos: {},
        relationships: [],
        findings: [],
    };
    const details: Record<string, RepoDetailFile> = {};
    try {
        data.rosCurrent = await collectRosCurrent();
        if (Object.values(data.rosCurrent).every((c) => c.state === "error")) {
            console.warn("  WARNING: all MikroTik channel feeds failed — channel verdicts and stable comparisons are null org-wide");
        }
        const stable = data.rosCurrent.stable?.version ?? null;
        const channelVersions = Object.values(data.rosCurrent)
            .map((c) => c.version)
            .filter((v): v is string => !!v);

        const entries = Object.entries(DASHBOARD_REPOS);
        const ctx: RepoCollectContext = { rosCurrent: data.rosCurrent, channelVersions, stable, generatedAt, collection };
        const collected = await mapWithConcurrency(entries, MAX_CONCURRENCY, async ([repo, cfg]) => {
            console.log(`  Dashboard: ${repo} [${cfg.groups.join(", ")}]`);
            try {
                return await collectOneRepo(repo, cfg, ctx);
            } catch (err) {
                console.warn(`  Dashboard: ${repo} collection threw: ${err}`);
                return errorEntry(repo, cfg, ctx, err);
            }
        });
        for (const { entry, detail } of collected) {
            data.repos[entry.name] = entry;
            details[entry.name] = detail;
        }
        data.relationships = buildReadinessLinks();
        data.findings = deriveFindings({ repos: data.repos, rosCurrent: data.rosCurrent, collection });
        data.budgets = {
            githubApiCalls: stats.githubApiCalls,
            otherHttpCalls: stats.otherHttpCalls,
            maxConcurrency: MAX_CONCURRENCY,
            timeoutMsPerRequest: REQUEST_TIMEOUT_MS,
            rateLimitRemaining: stats.rateLimitRemaining,
        };
    } catch (err) {
        console.warn(`  Dashboard collection failed: ${err}`);
        const cached = readDashboardCache(cachePath, { allowStale: true });
        if (cached) {
            console.log("  Falling back to stale dashboard cache");
            cached.data.collection = { mode: "stale-cache-fallback", cacheWrittenAt: cached.data.generatedAt };
            cached.data.findings = deriveFindings({ repos: cached.data.repos, rosCurrent: cached.data.rosCurrent, collection: cached.data.collection });
            for (const detail of Object.values(cached.details)) detail.collection = cached.data.collection;
            writeOutputs(cached.data, cached.details);
            return cached.data;
        }
    }

    writeDashboardCache(cachePath, data, details);
    writeOutputs(data, details);
    return data;
}
