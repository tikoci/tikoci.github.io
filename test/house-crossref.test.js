import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HOMEPAGE_SECTIONS } from "../data/homepage-config";
import { CROSSREF_EXTRA_SECTIONS, CROSSREF_HEADLINES, RELATIONSHIPS, REPO_OVERRIDES } from "../data/repo-config";
import { CROSSREF_PATH, cell, dependencyRows, renderCrossref, siteTools, taskClause, verifiedUses } from "../scripts/generate-crossref";

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
        { source: "a", target: "f", type: "dependency", verifiedNote: "readiness defaults to dependency" },
    ]);
    expect(uses.map(rel => rel.target)).toEqual(["b", "f"]);
});

test("a dependency edge without explicit readiness is labeled a package, not an artifact", () => {
    const rows = dependencyRows([{ source: "quickchr", target: "centrs", type: "dependency", verifiedNote: "centrs's package.json" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("| package |");
});

/** A skills directory holding `skills` ({ name: SKILL.md text }), removed after `body` runs. */
function withSkills(skills, body) {
    const root = mkdtempSync(join(tmpdir(), "tikoci-crossref-"));
    try {
        for (const [name, text] of Object.entries(skills)) {
            mkdirSync(join(root, name));
            writeFileSync(join(root, name, "SKILL.md"), text);
        }
        return body(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

const probe = (name, description) => `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n# Probe\n`;

test("generation refuses to write a map from invalid house skills", () => {
    withSkills({ "tikoci-probe": "no frontmatter\n" }, root => {
        expect(() => renderCrossref(root)).toThrow(/tikoci-probe: SKILL.md needs YAML frontmatter/);
    });
});

test("generation validates the new crossref, not the committed one", () => {
    // A broken committed crossref does not block its own replacement.
    withSkills({ "tikoci-probe": probe("tikoci-probe", "Rules. Use when probing."), "tikoci-crossref": "stale\n" }, root => {
        expect(renderCrossref(root)).toContain("| probing | [`tikoci-probe`]");
    });
    // Other skills that fit the budget alone overflow it with the new crossref's description.
    const filler = "x".repeat(965);
    const skills = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`tikoci-probe-${i}`, probe(`tikoci-probe-${i}`, `${filler} Use when probing ${i}.`)]));
    withSkills(skills, root => {
        expect(() => renderCrossref(root)).toThrow(/descriptions total \d+ characters \(budget 10000\)/);
    });
});

test("the task table takes the final Use when clause and refuses a description without one", () => {
    expect(taskClause("tikoci-x", "Rules. Use X, not Y. Use when editing AGENTS.md or a SKILL.md.")).toBe("editing AGENTS.md or a SKILL.md");
    expect(() => taskClause("tikoci-x", "Rules only.")).toThrow(/tikoci-x: description has no "Use when/);
});

test("a multiline description stays one table row with its skill link", () => {
    expect(cell("a | b\r\n  c")).toBe("a \\| b c");
    withSkills({ "tikoci-probe": '---\nname: tikoci-probe\ndescription: "Rules. Use when checking pipes | and wrapped\\nclauses."\n---\n\n# Probe\n' }, root => {
        const rows = renderCrossref(root).split("\n").filter(line => line.includes("checking pipes"));
        expect(rows).toEqual(["| checking pipes \\| and wrapped clauses | [`tikoci-probe`](https://tikoci.dev/house/skills/tikoci-probe/SKILL.md) |"]);
    });
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
