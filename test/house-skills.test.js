import { afterEach, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSkills, DESCRIPTION_BUDGET, markdownLinks, SKILLS_DIR } from "../scripts/check-skills";
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
    ["macOS home path", { "references/detail.md": "Run /Users/someone/bin/tool\n" }, "absolute home directory path"],
    ["Linux home path", { "references/detail.md": "cd /home/someone\n" }, "absolute home directory path"],
    ["local host name", { "references/detail.md": "ssh build-box.local\n" }, "local host name"],
    ["broken link", { "references/detail.md": "[x](missing.md)\n" }, "does not resolve"],
    ["link out of the skill", { "references/detail.md": "[x](../../../docs/a.md)\n" }, "leaves the skill directory"],
    ["root-relative link", { "references/detail.md": "[x](/house/)\n" }, "root-relative link"],
])("rejects %s", (_, files, message) => {
    expect(errorsFor(files)).toContain(message);
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
    expect(markdownLinks("[a](b.md) `[c](d.md)`\n[ref]: <e.md> \"t\"")).toEqual(["b.md", "e.md"]);
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
            expect(() => readFileSync(join(published, link.replace(/#.*$/, "")))).not.toThrow();
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
