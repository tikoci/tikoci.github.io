import { test, expect } from "bun:test";
import { retainObservations } from "../scripts/retain-observations";
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
test("public Pages projection excludes maintainer-only fields", async () => {
    const pages = await Bun.file(new URL("../data/metadata/pages.json", import.meta.url)).json();
    expect(pages.error).toBeNull();
    for (const row of Object.values(pages.repos)) {
        expect(Object.keys(row).sort()).toEqual(["name", "hasPages", "state", "htmlUrl", "serve", "plausible"].sort());
    }
    expect(pages).not.toHaveProperty("budgets");
    expect(pages).not.toHaveProperty("collection.auth");
});
