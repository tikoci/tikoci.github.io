import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
    buildChannelCoverage,
    buildCiWorkflowState,
    buildReadinessLinks,
    buildRosVersionsFile,
    classifyAuthor,
    coerceVersion,
    DASHBOARD_SCHEMA_VERSION,
    deriveFindings,
    isPrereleaseVersion,
    readDashboardCache,
    summarizeCi,
    summarizeNpm,
    summarizeReleases,
    summarizeWorkIssues,
    writeDashboardCache,
} from "../fetch-dashboard-data";
import apiPayloads from "./fixtures/v2-api-payloads.json";
import findingsInput from "./fixtures/v2-findings-input.json";

describe("dashboard contract", () => {
    test("schema version is 2", () => {
        expect(DASHBOARD_SCHEMA_VERSION).toBe(2);
    });
});

describe("isPrereleaseVersion", () => {
    test("flags suffix versions, clears plain ones", () => {
        expect(isPrereleaseVersion("7.25")).toBe(false);
        expect(isPrereleaseVersion("v0.5.2")).toBe(false);
        expect(isPrereleaseVersion("0.12.0-next")).toBe(true);
        expect(isPrereleaseVersion("7.26beta4")).toBe(true);
        expect(isPrereleaseVersion("7.25rc1")).toBe(true);
    });

    test("returns null for unparseable input", () => {
        expect(isPrereleaseVersion("latest")).toBeNull();
    });
});

describe("summarizeNpm", () => {
    test("in-sync when repo version equals registry latest", () => {
        const s = summarizeNpm("@tikoci/fixture", "0.5.2", apiPayloads.packumentStd, {});
        expect(s.assessment).toBe("in-sync");
        expect(s.published).toBe(true);
        expect(s.state).toBe("ok");
        expect(s.latestVersion).toBe("0.5.2");
        expect(s.repoVersionPublished).toBe(true);
        expect(s.distTags).toEqual({ latest: "0.5.2" });
        expect(s.behind).toBe(false);
    });

    test("pending-publish when a stable repo version is ahead of the registry", () => {
        const s = summarizeNpm("@tikoci/fixture", "0.5.3", apiPayloads.packumentStd, {});
        expect(s.assessment).toBe("pending-publish");
        expect(s.repoVersionPublished).toBe(false);
        expect(s.behind).toBe(true);
    });

    test("prerelease-channel when repo rides a prerelease ahead of latest", () => {
        const s = summarizeNpm("@tikoci/fixture", "0.6.0-next", apiPayloads.packumentStd, {});
        expect(s.assessment).toBe("prerelease-channel");
        expect(s.repoPrerelease).toBe(true);
        // behind keeps its legacy numeric meaning; assessment carries the channel nuance
        expect(s.behind).toBe(true);
    });

    test("not-published is a confirmed state, not an error", () => {
        const s = summarizeNpm("@tikoci/fixture", "0.1.0", null, { notFound: true });
        expect(s.assessment).toBe("not-published");
        expect(s.published).toBe(false);
        expect(s.state).toBe("ok");
        expect(s.expected).toBe(true);
        expect(s.error).toBeUndefined();
    });

    test("declared-unexpected absence still flags; expected absence stays silent", () => {
        const flagged = summarizeNpm("@tikoci/fixture", "0.1.0", null, { notFound: true, expected: false });
        expect(flagged.expected).toBe(false);
        expect(flagged.assessment).toBe("not-published");
        const repo = (npm) => ({ name: "donny-like", groups: ["npm"], detail: "data/dashboard/donny-like.json", npm });
        const loud = deriveFindings({
            repos: { x: repo({ ...flagged, expected: true }) },
            rosCurrent: findingsInput.rosCurrent,
            collection: { mode: "fresh", cacheWrittenAt: null },
        });
        expect(loud.map((f) => f.id)).toEqual(["npm-not-published:x"]);
        const silent = deriveFindings({
            repos: { x: repo(flagged) },
            rosCurrent: findingsInput.rosCurrent,
            collection: { mode: "fresh", cacheWrittenAt: null },
        });
        expect(silent).toEqual([]);
    });

    test("registry failure is unknown, never confused with absence", () => {
        const s = summarizeNpm("@tikoci/fixture", "1.0.0", null, { error: "HTTP 500 for registry packument" });
        expect(s.assessment).toBe("unknown");
        expect(s.published).toBeNull();
        expect(s.state).toBe("error");
        expect(s.error).toContain("HTTP 500");
    });

    test("records dist-tags beyond latest", () => {
        const s = summarizeNpm("@tikoci/fixture", "0.12.0-next", apiPayloads.packumentNextOnly, {});
        expect(s.distTags).toEqual({ next: "0.12.0-next.5" });
        expect(s.latestVersion).toBeNull();
        expect(s.published).toBe(true);
        expect(s.assessment).toBe("prerelease-channel");
    });

    test("null packument without a 404 is an error, never absence", () => {
        const s = summarizeNpm("@tikoci/fixture", "1.0.0", null, {});
        expect(s.state).toBe("error");
        expect(s.published).toBeNull();
        expect(s.assessment).toBe("unknown");
    });

    test("collapsed-suffix equality is not in-sync unless published", () => {
        const packument = {
            "dist-tags": { latest: "0.12.0-next.5" },
            versions: { "0.12.0-next.5": {} },
            time: { "0.12.0-next.5": "2026-10-20T00:00:00.000Z" },
        };
        const s = summarizeNpm("@tikoci/fixture", "0.12.0-next", packument, {});
        expect(s.assessment).toBe("prerelease-channel");
        expect(s.repoVersionPublished).toBe(false);
    });

    test("missing repo version is an unknown gap, not silence", () => {
        const s = summarizeNpm("@tikoci/fixture", null, apiPayloads.packumentStd, {});
        expect(s.state).toBe("unknown");
        expect(s.assessment).toBe("unknown");
        expect(s.error).toContain("no version");
        const findings = deriveFindings({
            repos: { x: { name: "x", groups: ["npm"], detail: "d", npm: s } },
            rosCurrent: findingsInput.rosCurrent,
            collection: { mode: "fresh", cacheWrittenAt: null },
        });
        expect(findings.map((f) => f.id)).toEqual(["npm-unknown:x"]);
        expect(findings[0].severity).toBe("gap");
    });

    test("stable repo version against a prerelease-only registry pends publish", () => {
        const s = summarizeNpm("@tikoci/fixture", "1.0.0", apiPayloads.packumentNextOnly, {});
        expect(s.assessment).toBe("pending-publish");
    });
});

describe("coerceVersion", () => {
    test("strings pass, junk becomes null or stringified", () => {
        expect(coerceVersion("0.5.2")).toBe("0.5.2");
        expect(coerceVersion(null)).toBeNull();
        expect(coerceVersion(undefined)).toBeNull();
        expect(coerceVersion("")).toBeNull();
        expect(coerceVersion(7)).toBe("7");
    });
});

describe("summarizeCi", () => {
    const ok = { state: "ok" };
    const unknown = { state: "unknown" };

    test("aggregates workflow states; empty means unconfigured", () => {
        expect(summarizeCi("main", null, null, [ok], null).state).toBe("ok");
        expect(summarizeCi("main", null, null, [ok, unknown], null).state).toBe("partial");
        const empty = summarizeCi("main", null, null, [], null);
        expect(empty.state).toBe("unknown");
        expect(empty.error).toContain("trackedWorkflows");
        expect(summarizeCi("main", null, null, [], "boom").state).toBe("error");
    });
});

describe("summarizeReleases", () => {
    test("separates newest prerelease from latest stable", () => {
        const s = summarizeReleases(apiPayloads.releasesMixed);
        expect(s.state).toBe("ok");
        expect(s.newest?.tag).toBe("v0.12.0-next.123");
        expect(s.newest?.prerelease).toBe(true);
        expect(s.stable?.tag).toBe("v0.11.3");
        expect(s.prereleaseChannel).toBe(true);
        // compat fields track the absolute newest, as before
        expect(s.latestTag).toBe("v0.12.0-next.123");
        expect(s.prerelease).toBe(true);
    });

    test("stable-only window is not a prerelease channel", () => {
        const s = summarizeReleases(apiPayloads.releasesStableOnly);
        expect(s.prereleaseChannel).toBe(false);
        expect(s.stable?.tag).toBe("7.25");
        expect(s.newest?.tag).toBe("7.25");
    });

    test("no releases is a known-empty state", () => {
        const s = summarizeReleases([]);
        expect(s.state).toBe("ok");
        expect(s.stable).toBeNull();
        expect(s.newest).toBeNull();
        expect(s.prereleaseChannel).toBeNull();
    });

    test("all-prerelease window without a stable is flagged with its limit", () => {
        const s = summarizeReleases([apiPayloads.releasesMixed[0]]);
        expect(s.newest?.prerelease).toBe(true);
        expect(s.stable).toBeNull();
        const findings = deriveFindings({
            repos: { x: { name: "x", groups: ["releases"], detail: "d", release: s } },
            rosCurrent: findingsInput.rosCurrent,
            collection: { mode: "fresh", cacheWrittenAt: null },
        });
        expect(findings.map((f) => f.id)).toEqual(["release-no-stable-in-window:x"]);
        expect(findings[0].detail).toContain("window");
    });
});

describe("classifyAuthor", () => {
    test("owners, bots, and externals", () => {
        expect(classifyAuthor("Amm0Bot", "User")).toBe("owner");
        expect(classifyAuthor("amm0bot", "User")).toBe("owner");
        expect(classifyAuthor("dependabot[bot]", "Bot")).toBe("bot");
        expect(classifyAuthor("somehuman", "User")).toBe("external");
    });
});

describe("summarizeWorkIssues", () => {
    test("indexes all authors with counts by class", () => {
        const { work, community, allItems } = summarizeWorkIssues(apiPayloads.issuesPage, apiPayloads.pullsDraft, 10);
        expect(work.state).toBe("ok");
        expect(work.counts.issues).toEqual({ total: 2, owner: 1, external: 1, bot: 0 });
        expect(work.counts.prs).toEqual({ total: 4, owner: 2, external: 1, bot: 1, ownerReady: 1, ownerDraft: 1, draftUnknown: false });
        expect(allItems).toHaveLength(6);
        // external filter view stays compatible
        expect(community.openIssues).toBe(1);
        expect(community.openPRs).toBe(1);
        expect(community.totalIssues).toBe(2);
        expect(community.totalPRs).toBe(4);
        expect(community.newest.map((i) => i.number).sort()).toEqual([103, 104]);
    });

    test("carries identifiers, timestamps, labels, milestones, and draft flags", () => {
        const { allItems } = summarizeWorkIssues(apiPayloads.issuesPage, apiPayloads.pullsDraft, 10);
        const byNumber = Object.fromEntries(allItems.map((i) => [i.number, i]));
        expect(byNumber[103].labels).toEqual(["bug", "help wanted"]);
        expect(byNumber[101].milestone).toBe("v2");
        expect(byNumber[102].draft).toBe(false);
        expect(byNumber[106].draft).toBe(true);
        expect(byNumber[103].draft).toBeNull(); // issues have no draft state
        expect(byNumber[104].url).toContain("/pull/104");
        expect(byNumber[103].updatedAt).toBe("2026-10-23T10:00:00Z");
        expect(workItemsHaveNoBodies(allItems)).toBe(true);
    });

    test("missing pulls enrichment is explicit, not silent", () => {
        const { work, allItems } = summarizeWorkIssues(apiPayloads.issuesPage, null, 10);
        expect(work.pullsEnriched).toBe(false);
        expect(work.state).toBe("partial");
        expect(allItems.find((i) => i.number === 102)?.draft).toBeNull();
    });

    test("partial pulls coverage marks drafts incomplete, not complete", () => {
        const partial = { ...apiPayloads.pullsDraft };
        delete partial["106"];
        const { work } = summarizeWorkIssues(apiPayloads.issuesPage, partial, 10);
        expect(work.pullsEnriched).toBe(true);
        expect(work.counts.prs.draftUnknown).toBe(true);
        expect(work.state).toBe("partial");
        expect(work.error).toContain("missing from the pulls listing");
    });

    test("a full page means partial counts, stated as lower bounds", () => {
        const page = Array.from({ length: 100 }, (_, n) => ({
            number: n + 1,
            title: `issue ${n + 1}`,
            user: { login: "somehuman", type: "User" },
            html_url: `https://github.com/tikoci/fixture/issues/${n + 1}`,
            created_at: "2026-10-01T00:00:00Z",
            updated_at: "2026-10-01T00:00:00Z",
            labels: [],
            milestone: null,
        }));
        const { work, community } = summarizeWorkIssues(page, {}, 10);
        expect(work.state).toBe("partial");
        expect(work.page).toEqual({ fetched: 100, perPage: 100, truncated: true, countsAreLowerBounds: true });
        expect(work.items).toHaveLength(10);
        expect(community.truncated).toBe(true);
    });
});

function workItemsHaveNoBodies(items) {
    return items.every((i) => !("body" in i) && !("comments" in i));
}

describe("buildCiWorkflowState", () => {
    const match = { name: "CI", path: ".github/workflows/ci.yml" };

    test("records branch, commit, event, and head alignment", () => {
        const w = buildCiWorkflowState("CI", match, 1, apiPayloads.runSuccess, "aaa0001", "main");
        expect(w.present).toBe(true);
        expect(w.state).toBe("ok");
        expect(w.conclusion).toBe("success");
        expect(w.lastConclusion).toBe("success");
        expect(w.headBranch).toBe("main");
        expect(w.headSha).toBe("aaa0001");
        expect(w.event).toBe("push");
        expect(w.isHead).toBe(true);
    });

    test("a PR-branch run never reads as default-branch status", () => {
        const w = buildCiWorkflowState("CI", match, 1, apiPayloads.runPrBranch, "aaa0001", "main");
        expect(w.headBranch).toBe("feature/x");
        expect(w.event).toBe("pull_request");
        expect(w.isHead).toBe(false);
        // distrusted: unknown, conclusion withheld — a failure here must not
        // become a default-branch failure finding
        expect(w.state).toBe("unknown");
        expect(w.conclusion).toBeNull();
        const findings = deriveFindings({
            repos: { x: { name: "x", groups: ["ci-health"], detail: "d", ci: summarizeCi("main", "aaa0001", null, [w], null) } },
            rosCurrent: findingsInput.rosCurrent,
            collection: { mode: "fresh", cacheWrittenAt: null },
        });
        expect(findings.map((f) => f.id)).toEqual(["ci-run-off-branch:x:CI"]);
        expect(findings[0].severity).toBe("gap");
    });

    test("finding IDs sanitize workflow-name scopes", () => {
        const w = buildCiWorkflowState("Build: Base Schema", match, 1, apiPayloads.runSuccess, "zzz9999", "main");
        const findings = deriveFindings({
            repos: { x: { name: "x", groups: ["ci-health"], detail: "d", ci: summarizeCi("main", "zzz9999", null, [w], null) } },
            rosCurrent: findingsInput.rosCurrent,
            collection: { mode: "fresh", cacheWrittenAt: null },
        });
        // success on an old commit → only the not-head info finding, sanitized ID
        expect(findings.map((f) => f.id)).toEqual(["ci-run-not-head:x:Build-Base-Schema"]);
    });

    test("running runs stay distinct from conclusions", () => {
        const w = buildCiWorkflowState("CI", match, 1, apiPayloads.runInProgress, "aaa0001", "main");
        expect(w.status).toBe("in_progress");
        expect(w.conclusion).toBeNull();
        expect(w.state).toBe("ok");
    });

    test("zero runs is unknown, not passing", () => {
        const w = buildCiWorkflowState("CI", match, 1, apiPayloads.runsEmpty, "aaa0001", "main");
        expect(w.state).toBe("unknown");
        expect(w.conclusion).toBeNull();
        expect(w.error).toContain("no runs");
    });

    test("a missing configured workflow is reported, not dropped", () => {
        const w = buildCiWorkflowState("Renamed", null, 4, null, "aaa0001", "main");
        expect(w.present).toBe(false);
        expect(w.state).toBe("unknown");
        expect(w.name).toBeNull();
        expect(w.configured).toBe("Renamed");
        expect(w.error).toContain("not found");
    });
});

describe("buildChannelCoverage", () => {
    test("only expected channels are judged; unreachable channels stay null", () => {
        const channels = buildChannelCoverage(
            ["stable", "long-term"],
            findingsInput.rosCurrent,
            ["7.24.5"],
        );
        expect(channels).toEqual({
            stable: { version: "7.25", covered: false },
            "long-term": { version: null, covered: null },
        });
    });

    test("channel versions compare numerically, not as strings", () => {
        const channels = buildChannelCoverage(
            ["stable"],
            { stable: { state: "ok", version: "7.25.0", raw: "7.25.0 1" } },
            ["7.25"],
        );
        expect(channels).toEqual({ stable: { version: "7.25.0", covered: true } });
    });
});

describe("buildReadinessLinks", () => {
    test("keeps curated types and refuses to invent blockers", () => {
        const links = buildReadinessLinks();
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
            expect(["dependency", "artifact-consumption", "association"]).toContain(link.kind);
            expect(link.verified).toBe(false);
            expect(link.note).toBeNull();
        }
        // make.d lineage is conceptual, not a build dependency: the map keeps
        // its dependency styling while the dashboard treats it as association.
        const maked = links.filter((l) => l.source === "make.d");
        expect(maked.length).toBeGreaterThan(0);
        for (const link of maked) {
            expect(link.type).toBe("dependency");
            expect(link.kind).toBe("association");
        }
    });
});

describe("buildRosVersionsFile", () => {
    test("projects channels with shared freshness, preserving error states", () => {
        const file = buildRosVersionsFile({
            schemaVersion: 2,
            generatedAt: "2026-10-28T00:00:00Z",
            collection: { mode: "local-cache", cacheWrittenAt: "2026-10-28T00:00:00Z" },
            rosCurrent: findingsInput.rosCurrent,
        });
        expect(file.schemaVersion).toBe(1);
        expect(file.generatedAt).toBe("2026-10-28T00:00:00Z");
        expect(file.collection.mode).toBe("local-cache");
        expect(file.channels.stable.version).toBe("7.25");
        expect(file.channels["long-term"].state).toBe("error");
        expect(file.channels["long-term"].version).toBeNull();
    });
});

describe("deriveFindings", () => {
    const freshInput = {
        repos: findingsInput.repos,
        rosCurrent: findingsInput.rosCurrent,
        collection: { mode: "fresh", cacheWrittenAt: null },
    };

    test("a clean repo produces no findings", () => {
        const findings = deriveFindings({
            repos: { clean: findingsInput.repos.clean },
            rosCurrent: findingsInput.rosCurrent,
            collection: { mode: "fresh", cacheWrittenAt: null },
        });
        expect(findings).toEqual([]);
    });

    test("CI failures, gaps, pending runs, and stale runs separate cleanly", () => {
        const byId = findingsById(deriveFindings(freshInput));
        expect(byId["ci-default-branch-failing:ci-mess:Test"].severity).toBe("failure");
        expect(byId["ci-default-branch-failing:ci-mess:Test"].evidence.join(" ")).toContain("failure");
        expect(byId["ci-run-in-progress:ci-mess:Release"].severity).toBe("pending");
        expect(byId["ci-run-not-head:ci-mess:Old"].severity).toBe("info");
        expect(byId["ci-no-default-runs:ci-mess:NeverRan"].severity).toBe("gap");
        expect(byId["ci-workflow-missing:ci-mess:Renamed"].severity).toBe("gap");
        expect(byId["ci-workflows-error:ci-broken-list"].severity).toBe("gap");
    });

    test("ROS gaps name the missing evidence, not just the missing version", () => {
        const byId = findingsById(deriveFindings(freshInput));
        const missing = byId["ros-missing-channel:ros-gap:stable"];
        expect(missing.severity).toBe("pending");
        expect(missing.evidence.join(" ")).toContain("7.25");
        // unreachable long-term channel must not yield a false missing-channel finding
        expect(byId["ros-missing-channel:ros-gap:long-term"]).toBeUndefined();
        const lag = byId["ros-lag-unknown:ros-gap"];
        expect(lag.severity).toBe("gap");
        expect(lag.detail).toContain("manifest");
        expect(byId["ros-coverage-error:ros-broken"].severity).toBe("gap");
    });

    test("prerelease channels are informational; pending publishes are pending", () => {
        const byId = findingsById(deriveFindings(freshInput));
        expect(byId["npm-prerelease-channel:pkg-mixed"].severity).toBe("info");
        expect(byId["npm-pending-publish:pkg-pending"].severity).toBe("pending");
        expect(byId["npm-not-published:pkg-unpublished"].severity).toBe("info");
        expect(byId["npm-unknown:pkg-dark"].severity).toBe("gap");
        expect(byId["release-prerelease-newest:pkg-mixed"].severity).toBe("info");
        expect(byId["release-none:pkg-pending"].severity).toBe("info");
        expect(byId["release-unknown:pkg-dark"].severity).toBe("gap");
    });

    test("open work never becomes a failure; PRs pending, external issues info", () => {
        const byId = findingsById(deriveFindings(freshInput));
        expect(byId["work-external-prs:work-busy"].severity).toBe("pending");
        expect(byId["work-external-issues:work-busy"].severity).toBe("info");
        expect(byId["work-maintainer-prs:work-busy"].severity).toBe("pending");
        expect(byId["work-list-truncated:work-busy"].severity).toBe("info");
        expect(byId["work-unknown:work-dark"].severity).toBe("gap");
        for (const finding of Object.values(byId)) {
            if (finding.category === "work") expect(finding.severity).not.toBe("failure");
        }
    });

    test("stale cache is an explicit finding, not silent", () => {
        const findings = deriveFindings({
            ...freshInput,
            collection: { mode: "local-cache", cacheWrittenAt: "2026-10-28T10:00:00Z" },
        });
        const stale = findings.find((f) => f.rule === "collection-stale-cache");
        expect(stale?.severity).toBe("info");
        expect(stale?.repos).toEqual([]);
    });

    test("finding IDs are stable and carry evidence", () => {
        const first = deriveFindings(freshInput);
        const second = deriveFindings(freshInput);
        expect(first.map((f) => f.id)).toEqual(second.map((f) => f.id));
        for (const finding of first) {
            expect(finding.id).toContain(finding.rule);
            expect(finding.evidence.length).toBeGreaterThan(0);
            expect(finding.detail.length).toBeGreaterThan(20);
        }
    });
});

function findingsById(findings) {
    return Object.fromEntries(findings.map((f) => [f.id, f]));
}

describe("dashboard cache", () => {
    test("round-trips fresh data and invalidates incompatible versions", async () => {
        const dir = mkdtempSync(join(tmpdir(), "dashboard-cache-"));
        try {
            const path = join(dir, "cache.json");
            const data = { schemaVersion: 2, generatedAt: "2026-10-28T00:00:00Z" };
            writeDashboardCache(path, data, { demo: { schemaVersion: 2, repo: "demo" } });
            expect(readDashboardCache(path)).toEqual({
                timestamp: expect.any(Number),
                schemaVersion: 2,
                data,
                details: { demo: { schemaVersion: 2, repo: "demo" } },
            });

            // v1-shaped cache (no schemaVersion) must not be served as v2
            const stale = { timestamp: Date.now(), data: { generatedAt: "2026-10-28T00:00:00Z" } };
            await Bun.write(join(dir, "stale.json"), JSON.stringify(stale));
            expect(readDashboardCache(join(dir, "stale.json"))).toBeNull();
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
