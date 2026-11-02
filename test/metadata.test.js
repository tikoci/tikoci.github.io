import { test, expect } from "bun:test";
import { retainDetailObservations, retainObservations } from "../scripts/retain-observations";
import { validateSnapshots } from "../scripts/validate-snapshots";
test("committed metadata contracts validate", () => { expect(() => validateSnapshots()).not.toThrow(); });
test("failures retain dated evidence through repeated attempts", () => {
    const good = { signal: { state: "ok", version: "7.22" } };
    const failed = { signal: { state: "error", error: "timeout" } };
    const first = retainObservations(failed, good, "2026-01-01");
    const second = retainObservations(failed, first, "2026-02-01");
    expect(second.signal.state).toBe("error");
    expect(second.signal.lastKnownGood).toEqual({ observedAt: "2026-01-01", value: good.signal });
    expect(retainObservations(good, second, "2026-03-01")).toEqual(good);
});
function assertPublicPages(pages) {
    expect(pages.error === null || typeof pages.error === "string").toBe(true);
    const allowed = {
        row: ["name", "hasPages", "state", "htmlUrl", "serve", "plausible", "lastKnownGood"],
        serve: ["kind", "root", "title", "probeFile"],
        plausible: ["present", "script", "dataDomain", "dataDomains", "pagesChecked", "pagesWithSnippet", "truncated", "events"],
    };
    function row(value) {
        expect(Object.keys(value).every(key => allowed.row.includes(key))).toBe(true);
        for (const key of ["name", "hasPages", "state", "htmlUrl", "serve", "plausible"]) expect(value).toHaveProperty(key);
        expect(["ok", "partial", "unknown", "error"]).toContain(value.state);
        expect(value.hasPages === null || typeof value.hasPages === "boolean").toBe(true);
        for (const key of ["serve", "plausible"]) if (value[key]) expect(Object.keys(value[key]).every(field => allowed[key].includes(field))).toBe(true);
        if (value.lastKnownGood) {
            expect(Object.keys(value.lastKnownGood).sort()).toEqual(["observedAt", "value"]);
            expect(Number.isFinite(Date.parse(value.lastKnownGood.observedAt))).toBe(true);
            row(value.lastKnownGood.value);
        }
    }
    expect(Object.keys(pages).sort()).toEqual(["schemaVersion", "observedAt", "attemptedAt", "error", "provenance", "repos"].sort());
    expect(Object.keys(pages.provenance).sort()).toEqual(["collector", "scope", "sources"]);
    for (const value of Object.values(pages.repos)) row(value);
}
test("public Pages accepts failures and checks retained evidence for private fields", async () => {
    const pages = await Bun.file(new URL("../data/metadata/pages.json", import.meta.url)).json();
    assertPublicPages(pages);
    const good = Object.values(pages.repos)[0];
    const failed = { ...pages, error: "Collection failed", repos: { sample: { ...good, state: "unknown", lastKnownGood: { observedAt: pages.observedAt, value: good } } } };
    assertPublicPages(failed);
    for (const privateField of ["deploy", "source", "budgets", "auth"]) {
        const leaked = structuredClone(failed);
        leaked.repos.sample.lastKnownGood.value[privateField] = "private";
        expect(() => assertPublicPages(leaked)).toThrow();
    }
});
test("workflow retention follows configured identity across reordering and recovery", () => {
    const good = { workflows: [{ configured: "a", state: "ok", lastUrl: "run-a" }, { configured: "b", state: "ok", lastUrl: "run-b" }] };
    const failed = { workflows: [{ configured: "b", state: "error" }, { configured: "new", state: "error" }, { configured: "a", state: "ok" }] };
    const first = retainObservations(failed, good, "2026-01-01");
    const second = retainObservations(failed, first, "2026-02-01");
    expect(second.workflows[0].lastKnownGood).toEqual({ observedAt: "2026-01-01", value: good.workflows[1] });
    expect(second.workflows[1]).not.toHaveProperty("lastKnownGood");
    expect(retainObservations(good, second, "2026-03-01")).toEqual(good);
});
test("detail work and ROS retain original dated lists through failure and recover", () => {
    for (const key of ["work", "ros"]) {
        const good = { generatedAt: "2026-01-01", [key]: { items: ["evidence"] } };
        const failed = { generatedAt: "2026-02-01", [key]: { items: [], error: "timeout" } };
        const first = retainDetailObservations(failed, good, { [key]: { state: "error" } }, { [key]: { state: "ok" } });
        const second = retainDetailObservations(failed, first, { [key]: { state: "error" } }, { [key]: { state: "error" } });
        expect(second[key].lastKnownGood).toEqual({ observedAt: good.generatedAt, value: good[key] });
        expect(retainDetailObservations(good, second, { [key]: { state: "ok" } }, {})).toEqual(good);
    }
});
test("default snapshot root works in a checkout path containing spaces", async () => {
    const { mkdtempSync, mkdirSync, cpSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const root = mkdtempSync(`${tmpdir()}/metadata spaces `);
    try {
        mkdirSync(`${root}/scripts`);
        cpSync(new URL("../scripts/validate-snapshots.ts", import.meta.url), `${root}/scripts/validate-snapshots.ts`);
        cpSync(new URL("../data", import.meta.url), `${root}/data`, { recursive: true });
        const result = Bun.spawnSync([process.execPath, `${root}/scripts/validate-snapshots.ts`]);
        expect(result.exitCode).toBe(0);
    } finally { rmSync(root, { recursive: true, force: true }); }
});
test("enrichment retains content on HTTP and network failures, then accepts empty recovery", async () => {
    const { fetchGitHubData } = await import("../scripts/fetch-github-data");
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const root = mkdtempSync(`${tmpdir()}/enrichment `);
    const { REPO_OVERRIDES } = await import("../data/repo-config");
    const priorOverride = REPO_OVERRIDES.sample;
    REPO_OVERRIDES.sample = { bonusDocs: ["GUIDE.md"], viewableFiles: ["GUIDE.md"] };
    const originalFetch = globalThis.fetch;
    const fresh = process.argv.includes("--fresh");
    process.argv.push("--fresh");
    const old = { name: "sample", readmeHtml: "<h2>Prior</h2>", bonusDocs: [{ name: "GUIDE.md", path: "GUIDE.md", url: "https://example.com/guide" }], hasDockerfile: true, dockerfileContent: "FROM prior", viewableFileContents: [{ name: "GUIDE.md", html: "<h2>Guide</h2>" }] };
    writeFileSync(`${root}/.github-cache.json`, JSON.stringify({ timestamp: Date.parse("2026-01-01"), repos: [old] }));
    let mode = "http";
    globalThis.fetch = async url => {
        if (String(url).includes("/users/")) return Response.json([{ name: "sample", stargazers_count: 99, default_branch: "main" }]);
        if (mode === "network") throw new Error("network unavailable");
        if (mode === "empty") return new Response(null, { status: 404 });
        if (mode === "success-empty") return new Response("");
        return new Response(null, { status: 503 });
    };
    try {
        const errors = [];
        const first = (await fetchGitHubData(root, message => errors.push(message)))[0];
        expect(errors.length).toBeGreaterThan(0);
        expect(first.readmeHtml).toBe(old.readmeHtml);
        expect(first.dockerfileContent).toBe(old.dockerfileContent);
        expect(first.bonusDocs).toEqual(old.bonusDocs);
        expect(first.viewableFileContents).toEqual(old.viewableFileContents);
        expect(first.enrichment.retainedObservedAt).toBe("2026-01-01T00:00:00.000Z");
        mode = "network";
        const second = (await fetchGitHubData(root))[0];
        expect(second.readmeHtml).toBe(old.readmeHtml);
        expect(second.enrichment.retainedObservedAt).toBe(first.enrichment.retainedObservedAt);
        mode = "success-empty";
        const empty = (await fetchGitHubData(root))[0];
        expect(empty.readmeHtml).toBe("");
        expect(empty.dockerfileContent).toBeUndefined();
        expect(empty.enrichment.error).toBeNull();
        mode = "empty";
        const recovered = (await fetchGitHubData(root))[0];
        expect(recovered.readmeHtml).toBe("");
        expect(recovered.hasDockerfile).toBe(false);
        expect(recovered.enrichment.error).toBeNull();
        expect(recovered.enrichment).not.toHaveProperty("retainedObservedAt");
    } finally {
        globalThis.fetch = originalFetch;
        if (priorOverride) REPO_OVERRIDES.sample = priorOverride;
        else delete REPO_OVERRIDES.sample;
        if (!fresh) process.argv.splice(process.argv.lastIndexOf("--fresh"), 1);
        rmSync(root, { recursive: true, force: true });
    }
});

test("partial Pages probes retain dated evidence across failures and recovery", () => {
    const good = { state: "ok", serve: { kind: "site", root: 200 }, plausible: { present: true } };
    const partial = { state: "partial", serve: { kind: "unknown", root: null }, plausible: { present: null } };
    const first = retainObservations(partial, good, "2026-01-01");
    const second = retainObservations(partial, first, "2026-02-01");
    expect(first.lastKnownGood).toEqual({ observedAt: "2026-01-01", value: good });
    expect(second.lastKnownGood).toEqual(first.lastKnownGood);
    expect(second.state).toBe("partial");
    expect(second.serve).toEqual(partial.serve);
    const failed = retainObservations({ state: "error" }, second, "2026-03-01");
    expect(retainObservations(partial, failed, "2026-04-01").lastKnownGood).toEqual(first.lastKnownGood);
    expect(retainObservations(good, second, "2026-05-01")).toEqual(good);
    expect(retainObservations(partial, undefined, "2026-01-01")).toEqual(partial);
});
