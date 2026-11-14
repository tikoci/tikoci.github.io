import { afterEach, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { budgetTable, checkSkills, DESCRIPTION_BUDGET, markdownLinks, SKILLS_DIR } from "../scripts/check-skills";
import { generateHouse, HOUSE_PLACEHOLDER } from "../scripts/generate-house";

const temps = [];
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function temp() {
    const dir = mkdtempSync(join(tmpdir(), "tikoci-house-"));
    temps.push(dir);
    return dir;
}

/** A skills/ tree with one valid skill; `files` overrides or adds paths inside the skill. */
function skillsTree(files = {}, name = "tikoci-sample") {
    const root = join(temp(), "skills");
    const all = {
        "SKILL.md": `---\nname: ${name}\ndescription: "Use X, not Y, when Z."\n---\n\n# Sample\n\nSee [detail](references/detail.md#part).\n`,
        "references/detail.md": "# Detail\n\nText.\n",
        ...files,
    };
    for (const [path, content] of Object.entries(all)) {
        if (content === null) continue;
        const full = join(root, name, path);
        mkdirSync(join(full, ".."), { recursive: true });
        writeFileSync(full, content);
    }
    return root;
}
const errorsFor = (files, name) => checkSkills(skillsTree(files, name)).errors.join("\n");

test("committed house skills validate within the description budget", () => {
    const report = checkSkills();
    expect(report.errors).toEqual([]);
    expect(report.skills.map(skill => skill.name)).toContain("tikoci-house");
    expect(report.descriptionTotal).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
});

test("file names with .local before an extension are not host names", () => {
    expect(errorsFor({ "references/detail.md": "Keep centrs.local.env and settings.local.json local.\n" })).toBe("");
});

test("a valid skill passes and lists its files", () => {
    const report = checkSkills(skillsTree());
    expect(report.errors).toEqual([]);
    expect(report.skills[0].files).toEqual(["SKILL.md", "references/detail.md"]);
});

test.each([
    ["name differs from directory", { "SKILL.md": "---\nname: tikoci-other\ndescription: d\n---\n# H\n" }, "does not match directory"],
    ["missing frontmatter", { "SKILL.md": "# H\n" }, "frontmatter"],
    ["invalid YAML", { "SKILL.md": "---\nname: [\n---\n# H\n" }, "not valid YAML"],
    ["non-spec key", { "SKILL.md": "---\nname: tikoci-sample\ndescription: d\nwhen_to_use: x\n---\n# H\n" }, "not in the Agent Skills spec"],
    ["empty description", { "SKILL.md": "---\nname: tikoci-sample\ndescription: \"\"\n---\n# H\n" }, "description is empty"],
    ["long description", { "SKILL.md": `---\nname: tikoci-sample\ndescription: ${"x".repeat(1025)}\n---\n# H\n` }, "max 1024"],
    ["angle brackets", { "SKILL.md": "---\nname: tikoci-sample\ndescription: use <tag>\n---\n# H\n" }, "< or >"],
    ["no H1", { "SKILL.md": "---\nname: tikoci-sample\ndescription: d\n---\n\n## H2\n" }, "expected an H1"],
    ["missing SKILL.md", { "SKILL.md": null }, "missing SKILL.md"],
    ["stray entry", { "notes.md": "# x\n" }, 'unexpected entry "notes.md"'],
    ["references as a file", { "references/detail.md": null, "SKILL.md": "---\nname: tikoci-sample\ndescription: d\n---\n# H\n", references: "x\n" }, "references must be a directory"],
    ["scripts as a file", { scripts: "x\n" }, "scripts must be a directory"],
    ["assets as a file", { assets: "x\n" }, "assets must be a directory"],
    ["SKILL.md as a directory", { "SKILL.md": null, "SKILL.md/x.md": "# x\n" }, "SKILL.md must be a file"],
    ["macOS home path", { "references/detail.md": "Run /Users/someone/bin/tool\n" }, "absolute home directory path"],
    ["Linux home path", { "references/detail.md": "cd /home/someone\n" }, "absolute home directory path"],
    ["local host name", { "references/detail.md": "ssh build-box.local\n" }, "local host name"],
    ["local host name at sentence end", { "references/detail.md": "Reach build-box.local.\n" }, "local host name"],
    ["broken link", { "references/detail.md": "[x](missing.md)\n" }, "does not resolve"],
    ["link out of the skill", { "references/detail.md": "[x](../../../docs/a.md)\n" }, "leaves the skill directory"],
    ["root-relative link", { "references/detail.md": "[x](/house/)\n" }, "root-relative link"],
    ["broken link with a single-quoted title", { "references/detail.md": "[x](missing.md 'Details')\n" }, "does not resolve"],
    ["broken link with a parenthesized title", { "references/detail.md": "[x](missing.md (Details))\n" }, "does not resolve"],
    ["broken reference definition", { "references/detail.md": "[x][r]\n\n[r]: missing.md 'T'\n" }, "does not resolve"],
    ["broken reference destination on the next line", { "references/detail.md": "[x][g]\n\n[g]:\n  missing.md\n" }, "does not resolve"],
    ["home path in a script", { "scripts/run.py": "open('/home/operator/.config/private')\n" }, "absolute home directory path"],
    ["home path in an extensionless file", { "scripts/run": "#!/bin/sh\ncd /Users/operator\n" }, "absolute home directory path"],
    ["broken link with the destination on its own line", { "references/detail.md": "[x](\nmissing.md\n)\n" }, "does not resolve"],
    ["escaping link with the destination on its own line", { "references/detail.md": "[x](\n../../outside.md\n)\n" }, "leaves the skill directory"],
    ["broken reference definition in a blockquote", { "references/detail.md": "> [x][r]\n>\n> [r]: missing.md\n" }, "does not resolve"],
    ["broken image", { "references/detail.md": "![logo](../assets/logo.png)\n" }, "does not resolve"],
])("rejects %s", (_, files, message) => {
    expect(errorsFor(files)).toContain(message);
});

test("accepts balanced parentheses and angle-bracket destinations", () => {
    expect(errorsFor({ "references/a(b).md": "# A\n", "references/c d.md": "# C\n", "SKILL.md": "---\nname: tikoci-sample\ndescription: d\n---\n# H\n\n[a](references/a(b).md) [c](<references/c d.md> \"t\")\n" })).toBe("");
    expect(markdownLinks("[a](x(y).md 'z') [b](<p q.md>)")).toEqual(["x(y).md", "p q.md"]);
});

test("removes Markdown backslash escapes from destinations", () => {
    expect(errorsFor({ "references/a(b).md": "# A\n", "references/detail.md": "[a](a\\(b\\).md)\n" })).toBe("");
    expect(markdownLinks("[a](a\\(b\\).md)")).toEqual(["a(b).md"]);
});

test("checks the published skills/README.md like a skill file", () => {
    const root = skillsTree();
    writeFileSync(join(root, "README.md"), "Run /home/example/tool on build-box.local. See [x](tikoci-sample/missing.md) and [y](../outside.md).\n");
    const errors = checkSkills(root).errors.join("\n");
    expect(errors).toContain("README.md:1: absolute home directory path");
    expect(errors).toContain("README.md:1: local host name");
    expect(errors).toContain('README.md: link "tikoci-sample/missing.md" does not resolve');
    expect(errors).toContain('README.md: link "../outside.md" leaves the skill directory');
});

test("rejects symlinks inside skills and as skill directories", () => {
    const root = skillsTree();
    writeFileSync(join(root, "..", "outside.md"), "# Outside\n");
    symlinkSync("../../../outside.md", join(root, "tikoci-sample", "references", "alias.md"));
    expect(checkSkills(root).errors.join("\n")).toContain("references/alias.md: symlinks are not allowed");
    symlinkSync("tikoci-sample", join(root, "tikoci-loop"));
    expect(checkSkills(root).errors.join("\n")).toContain("tikoci-loop: symlinks are not allowed");
});

test("ignores links in indented fences inside list items", () => {
    expect(errorsFor({ "references/detail.md": "- Example:\n\n  ```md\n  [example](missing.md)\n  ```\n" })).toBe("");
});

test("index links encode file names", () => {
    const root = skillsTree({ "references/a#b.md": "# A\n" });
    const html = readFileSync(join(renderHouse(root), "house/index.html"), "utf-8");
    expect(html).toContain('href="skills/tikoci-sample/references/a%23b.md"><code>references/a#b.md</code>');
});

test("skips binary assets when scanning for machine facts", () => {
    const root = skillsTree();
    mkdirSync(join(root, "tikoci-sample", "assets"));
    writeFileSync(join(root, "tikoci-sample", "assets", "logo.png"), Buffer.from([0x89, 0x50, 0, 0x2f, 0x55, 0x73, 0x65, 0x72, 0x73, 0x2f, 0x78]));
    expect(checkSkills(root).errors).toEqual([]);
});

test("rejects names without the tikoci- prefix", () => {
    expect(errorsFor({}, "Sample_Skill")).toContain("tikoci-<lowercase-words>");
});

test("allows generic tool paths, URLs, anchors and links in code", () => {
    // Home paths are rejected in code blocks too; only link checks skip code.
    const text = [
        "State lives under `~/.tikoci` and ~/.local/share/quickchr.",
        "[site](https://tikoci.dev/house/) [top](#top)",
        "```sh\ncat [x](nowhere.md)\n```",
    ].join("\n");
    expect(errorsFor({ "references/detail.md": text })).toBe("");
    expect(markdownLinks("[a](b.md) `[c](d.md)` [e][ref]\n\n[ref]: <e.md> \"t\"")).toEqual(["b.md", "e.md"]);
});

test("the description budget covers all skills together", () => {
    const root = join(temp(), "skills");
    const description = "y".repeat(1000);
    for (let i = 0; i < 9; i++) {
        const name = `tikoci-s${i}`;
        mkdirSync(join(root, name), { recursive: true });
        writeFileSync(join(root, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n# H\n`);
    }
    expect(checkSkills(root).errors.join("\n")).toContain(`budget ${DESCRIPTION_BUDGET}`);
});

test("the budget table reports each skill and the total", () => {
    const table = budgetTable(checkSkills(skillsTree()));
    expect(table).toContain("| `tikoci-sample` | 21 |");
    expect(table).toContain(`| **Total** (budget ${DESCRIPTION_BUDGET}) | **21** |`);
});

function renderHouse(skillsDir) {
    const dist = temp();
    mkdirSync(join(dist, "house"), { recursive: true });
    writeFileSync(join(dist, "house", "index.html"), `<link href="{{SITE_ORIGIN}}/house/">${HOUSE_PLACEHOLDER}`);
    generateHouse(dist, "https://example.test", skillsDir);
    return dist;
}

test("published skills are byte for byte, with working relative links and an index", () => {
    const dist = renderHouse(SKILLS_DIR);
    const { skills } = checkSkills();
    for (const skill of skills) {
        for (const file of skill.files) {
            expect(readFileSync(join(dist, "house/skills", skill.name, file))).toEqual(readFileSync(join(SKILLS_DIR, skill.name, file)));
        }
        // Relative links from the published SKILL.md resolve inside the published directory.
        const published = join(dist, "house/skills", skill.name);
        for (const link of markdownLinks(readFileSync(join(published, "SKILL.md"), "utf-8"))) {
            if (/^[a-z]+:|^#/.test(link)) continue;
            expect(() => readFileSync(join(published, decodeURIComponent(link.replace(/[#?].*$/, ""))))).not.toThrow();
        }
    }
    const html = readFileSync(join(dist, "house/index.html"), "utf-8");
    expect(html).not.toContain(HOUSE_PLACEHOLDER);
    expect(html).not.toContain("{{SITE_ORIGIN}}");
    expect(html).toContain('href="https://example.test/house/"');
    expect(html).toContain('<a href="skills/tikoci-house/SKILL.md">');
    expect(html).toContain('href="skills/tikoci-house/references/writing-house-skills.md"');

    const index = JSON.parse(readFileSync(join(dist, "house/index.json"), "utf-8"));
    expect(index.schemaVersion).toBe(1);
    const house = index.skills.find(skill => skill.name === "tikoci-house");
    expect(house.url).toBe("https://example.test/house/skills/tikoci-house/SKILL.md");
    expect(house.files).toContain("SKILL.md");
    expect(readFileSync(join(dist, "house/skills/index.html"), "utf-8")).toContain('rel="canonical" href="https://example.test/house/"');
    expect(readFileSync(join(dist, "house/skills/README.md"))).toEqual(readFileSync(join(SKILLS_DIR, "README.md")));
});

test("descriptions are escaped in the index", () => {
    const root = skillsTree({ "SKILL.md": "---\nname: tikoci-sample\ndescription: \"Use A & B, not \\\"C\\\".\"\n---\n# H\n" });
    const html = readFileSync(join(renderHouse(root), "house/index.html"), "utf-8");
    expect(html).toContain("Use A &amp; B, not &quot;C&quot;.");
});

test("invalid skills fail the build instead of publishing", () => {
    const root = skillsTree({ "references/detail.md": "/Users/someone\n" });
    expect(() => renderHouse(root)).toThrow("Invalid house skills");
});

test("the real page template carries the placeholder", () => {
    const dist = temp();
    cpSync(new URL("../src/house", import.meta.url).pathname, join(dist, "house"), { recursive: true });
    generateHouse(dist, "https://example.test");
    const html = readFileSync(join(dist, "house/index.html"), "utf-8");
    expect(html).toContain('id="tikoci-house"');
    expect(html).toContain('href="https://example.test/house/"');
});
