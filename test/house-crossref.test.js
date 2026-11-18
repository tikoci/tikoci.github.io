import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { HOMEPAGE_SECTIONS } from "../data/homepage-config";
import { CROSSREF_HEADLINES, RELATIONSHIPS, REPO_OVERRIDES } from "../data/repo-config";
import { CROSSREF_PATH, renderCrossref, taskClause, verifiedUses } from "../scripts/generate-crossref";

test("the committed tikoci-crossref skill is current (run `bun run generate:crossref`)", () => {
    expect(readFileSync(CROSSREF_PATH, "utf-8")).toBe(renderCrossref());
});

test("every repo override says what the repo owns, under a homepage category", () => {
    const categories = new Set(HOMEPAGE_SECTIONS.map(section => section.mapCategory).filter(Boolean));
    for (const [repo, override] of Object.entries(REPO_OVERRIDES)) {
        expect(override.owns?.length, `${repo}: owns`).toBeGreaterThan(0);
        for (const topic of override.owns ?? []) expect(topic.trim(), `${repo}: empty owns entry`).not.toBe("");
        expect(categories.has(override.category), `${repo}: category ${override.category}`).toBe(true);
    }
});

test("description headlines name repos that own something", () => {
    for (const repo of Object.values(CROSSREF_HEADLINES)) expect(REPO_OVERRIDES[repo]?.owns?.length, repo).toBeGreaterThan(0);
});

test("artifact consumption is always verified, and only verified uses reach the crossref", () => {
    for (const rel of RELATIONSHIPS) {
        if (rel.readiness === "artifact-consumption") expect(rel.verifiedNote, `${rel.source} → ${rel.target}`).toBeTruthy();
    }
    const uses = verifiedUses([
        { source: "a", target: "b", type: "dependency", readiness: "dependency", verifiedNote: "b's package.json" },
        { source: "a", target: "c", type: "dependency", readiness: "dependency" },
        { source: "a", target: "d", type: "sibling", readiness: "association", verifiedNote: "a note on an association" },
        { source: "a", target: "e", type: "ecosystem", verifiedNote: "no readiness" },
    ]);
    expect(uses.map(rel => rel.target)).toEqual(["b"]);
});

test("the task table takes the final Use when clause and refuses a description without one", () => {
    expect(taskClause("tikoci-x", "Rules. Use X, not Y. Use when editing AGENTS.md or a SKILL.md.")).toBe("editing AGENTS.md or a SKILL.md");
    expect(() => taskClause("tikoci-x", "Rules only.")).toThrow(/tikoci-x: description has no "Use when/);
});
