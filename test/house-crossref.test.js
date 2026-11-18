import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HOMEPAGE_SECTIONS } from "../data/homepage-config";
import { CROSSREF_EXTRA_SECTIONS, CROSSREF_HEADLINES, RELATIONSHIPS, REPO_OVERRIDES } from "../data/repo-config";
import { CROSSREF_PATH, cell, renderCrossref, siteTools, taskClause, verifiedUses } from "../scripts/generate-crossref";

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

test("a multiline description stays one table row with its skill link", () => {
    expect(cell("a | b\r\n  c")).toBe("a \\| b c");
    const root = mkdtempSync(join(tmpdir(), "tikoci-crossref-"));
    try {
        mkdirSync(join(root, "tikoci-probe"));
        writeFileSync(join(root, "tikoci-probe", "SKILL.md"),
            '---\nname: tikoci-probe\ndescription: "Rules. Use when checking pipes | and wrapped\\nclauses."\n---\n\n# Probe\n');
        const rows = renderCrossref(root).split("\n").filter(line => line.includes("checking pipes"));
        expect(rows).toEqual(["| checking pipes \\| and wrapped clauses | [`tikoci-probe`](https://tikoci.dev/house/skills/tikoci-probe/SKILL.md) |"]);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("the web tools table follows the Tools menu and refuses a reshaped entry", () => {
    const tools = siteTools();
    expect(tools.length).toBeGreaterThan(5);
    expect(tools.find(tool => tool.label === "Command Lookup")?.href).toBe("https://tikoci.github.io/restraml/lookup.html");
    const menu = (entry) => `x\nconst SITE_TOOLS = [\n    { label: 'A', href: '/a.html' },\n${entry}\n];\n`;
    expect(siteTools(menu("    { label: 'B', href: '/b.html' },"))).toEqual([{ label: "A", href: "/a.html" }, { label: "B", href: "/b.html" }]);
    expect(() => siteTools(menu("    { label: 'B', href: '/b.html', icon: 'x' },"))).toThrow(/unexpected SITE_TOOLS entry/);
    expect(() => siteTools("const TOOLS = [];")).toThrow(/SITE_TOOLS array not found/);
});

test("published data URLs are absolute, and only a <version> placeholder is allowed", () => {
    for (const [repo, override] of Object.entries(REPO_OVERRIDES)) {
        for (const file of override.publishedData ?? []) {
            expect(file.url, repo).toMatch(/^https:\/\//);
            expect(file.url.replaceAll("<version>", ""), repo).not.toMatch(/[<>]/);
            expect(file.holds.trim(), repo).not.toBe("");
        }
    }
});

test("crossref groups and reference paths are well formed", () => {
    const groups = new Set([
        ...HOMEPAGE_SECTIONS.map(section => section.mapCategory).filter(Boolean),
        ...CROSSREF_EXTRA_SECTIONS.map(section => section.id),
    ]);
    for (const [repo, override] of Object.entries(REPO_OVERRIDES)) {
        if (override.crossrefGroup) expect(groups.has(override.crossrefGroup), `${repo}: ${override.crossrefGroup}`).toBe(true);
        for (const ref of override.reference ?? []) {
            expect(ref.path, repo).toMatch(/^[^/]/);
            expect(ref.path.split("/"), repo).not.toContain("..");
            expect(ref.holds.trim(), repo).not.toBe("");
        }
    }
});
