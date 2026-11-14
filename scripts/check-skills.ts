#!/usr/bin/env bun
// Validates the house skills in skills/ beyond what markdownlint and cspell see.
// Adapted from tikoci/routeros-skills scripts/check-skills.ts, plus the house
// rules from issue #21: name = directory with the tikoci- prefix, a tracked
// total description budget, no operator-local paths, and self-contained
// relative links so a copied or published skill directory still works.
import { appendFileSync, existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

export const SKILLS_DIR = resolve(import.meta.dirname, "..", "skills");

/** Agent Skills spec limits. */
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
/**
 * House budget for all descriptions together. Harnesses list every description
 * up front and may truncate the listing when it overflows; the planned 17 skills
 * at ~470 characters each fit. Raise it deliberately, not to make a check pass.
 */
export const DESCRIPTION_BUDGET = 8000;

const NAME_PATTERN = /^tikoci-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER_KEYS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
/** Agent Skills spec directories; anything else at a skill's top level is a mistake. */
const SKILL_ENTRIES = new Set(["SKILL.md", "references", "scripts", "assets"]);
/** Files in skills/ that are not skills. */
const TOP_LEVEL_FILES = new Set(["README.md", ".markdownlint.yaml"]);

/** One operator's machine, not the usual toolset (issue #21 "Machine facts stay out"). */
const OPERATOR_LOCAL: [RegExp, string][] = [
    [/\/(?:Users|home)\/[A-Za-z0-9._-]+/, "absolute home directory path"],
    [/\b[A-Za-z]:\\Users\\/, "Windows home directory path"],
    [/\b[a-z0-9-]+\.(?:local|lan|ts\.net)\b/i, "local host name"],
];

export interface Skill {
    name: string;
    description: string;
    frontmatter: Record<string, unknown>;
    /** Paths relative to the skill directory, sorted, "/" separated. */
    files: string[];
}

export interface SkillReport {
    skills: Skill[];
    errors: string[];
    descriptionTotal: number;
}

export function checkSkills(skillsDir = SKILLS_DIR): SkillReport {
    const errors: string[] = [];
    const skills: Skill[] = [];
    if (!existsSync(skillsDir)) return { skills, errors: [`${skillsDir}: missing skills directory`], descriptionTotal: 0 };

    for (const entry of readdirSync(skillsDir).sort()) {
        const path = join(skillsDir, entry);
        const stat = lstatSync(path);
        if (stat.isSymbolicLink()) {
            errors.push(`${entry}: symlinks are not allowed in skills/; copies and published skills need real files`);
            continue;
        }
        if (!stat.isDirectory()) {
            if (!TOP_LEVEL_FILES.has(entry)) errors.push(`${entry}: unexpected file; skills/ holds one directory per skill`);
            // README.md is published next to the skills, so it gets the same checks.
            else if (entry === "README.md") checkFile(skillsDir, entry, message => errors.push(message));
            continue;
        }
        const skill = checkSkill(path, entry, message => errors.push(`${entry}: ${message}`));
        if (skill) skills.push(skill);
    }
    if (!skills.length && !errors.length) errors.push("no skills found");

    const descriptionTotal = skills.reduce((sum, skill) => sum + skill.description.length, 0);
    if (descriptionTotal > DESCRIPTION_BUDGET) {
        errors.push(`descriptions total ${descriptionTotal} characters (budget ${DESCRIPTION_BUDGET})`);
    }
    return { skills, errors, descriptionTotal };
}

function checkSkill(dir: string, entry: string, fail: (message: string) => void): Skill | null {
    if (!NAME_PATTERN.test(entry)) fail("directory name must be tikoci-<lowercase-words>");
    for (const child of readdirSync(dir)) {
        if (!SKILL_ENTRIES.has(child)) {
            fail(`unexpected entry "${child}"; use SKILL.md, references/, scripts/ or assets/`);
            continue;
        }
        // Symlinks are reported by listFiles; here only the entry type matters.
        const stat = lstatSync(join(dir, child));
        if (stat.isSymbolicLink()) continue;
        if (child === "SKILL.md" ? !stat.isFile() : !stat.isDirectory()) {
            fail(`${child} must be a ${child === "SKILL.md" ? "file" : "directory"}`);
        }
    }
    const toRelative = (file: string) => relative(dir, file).split(sep).join("/");
    const files = listFiles(dir, link => fail(`${toRelative(link)}: symlinks are not allowed; copies and published skills need real files`))
        .map(toRelative).sort();
    for (const file of files) checkFile(dir, file, fail);

    const skillPath = join(dir, "SKILL.md");
    if (!existsSync(skillPath)) {
        fail("missing SKILL.md");
        return null;
    }
    if (!lstatSync(skillPath).isFile()) return null;
    const text = readFileSync(skillPath, "utf-8");
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match) {
        fail("SKILL.md needs YAML frontmatter between --- lines at the top");
        return null;
    }
    let frontmatter: unknown;
    try {
        frontmatter = Bun.YAML.parse(match[1]);
    } catch (err) {
        fail(`frontmatter is not valid YAML: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
    if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
        fail("frontmatter must be a YAML mapping");
        return null;
    }
    const front = frontmatter as Record<string, unknown>;
    for (const key of Object.keys(front)) {
        if (!FRONTMATTER_KEYS.has(key)) fail(`frontmatter key "${key}" is not in the Agent Skills spec`);
    }
    const { name, description } = front;
    if (typeof name !== "string" || typeof description !== "string") {
        fail("frontmatter needs string `name` and `description`");
        return null;
    }
    if (name !== entry) fail(`name "${name}" does not match directory "${entry}"`);
    if (name.length > NAME_MAX) fail(`name is ${name.length} characters (max ${NAME_MAX})`);
    if (!description.trim()) fail("description is empty");
    if (description.length > DESCRIPTION_MAX) fail(`description is ${description.length} characters (max ${DESCRIPTION_MAX})`);
    if (/[<>]/.test(description)) fail("description must not contain < or >");

    const firstLine = text.slice(match[0].length).split(/\r?\n/).find(line => line.trim()) ?? "";
    if (!firstLine.startsWith("# ")) fail(`expected an H1 after the frontmatter, found "${firstLine.slice(0, 60)}"`);

    return { name, description, frontmatter: front, files };
}

function checkFile(dir: string, file: string, fail: (message: string) => void): void {
    const path = join(dir, file);
    const bytes = readFileSync(path);
    if (bytes.includes(0)) return; // binary asset
    const text = bytes.toString("utf-8");
    text.split(/\r?\n/).forEach((line, index) => {
        for (const [pattern, label] of OPERATOR_LOCAL) {
            const found = line.match(pattern);
            if (found) fail(`${file}:${index + 1}: ${label} "${found[0]}"; keep machine facts in local agent notes`);
        }
    });
    if (extname(file).toLowerCase() === ".md") {
        for (const target of markdownLinks(text)) checkLink(dir, path, file, target, fail);
    }
}

/**
 * A skill directory is copied as is into other repos and published under
 * /house/skills/, so relative links must resolve inside it. Other house skills
 * and site pages are linked by absolute URL.
 */
function checkLink(dir: string, path: string, file: string, target: string, fail: (message: string) => void): void {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return;
    if (target.startsWith("/")) {
        fail(`${file}: root-relative link "${target}" breaks in a copied skill; use an absolute URL`);
        return;
    }
    let decoded: string;
    try {
        decoded = decodeURIComponent(target.replace(/[#?].*$/, ""));
    } catch {
        fail(`${file}: link "${target}" is not valid URL encoding`);
        return;
    }
    const resolved = resolve(dirname(path), decoded);
    if (resolved !== dir && !resolved.startsWith(dir + sep)) {
        fail(`${file}: link "${target}" leaves the skill directory; use an absolute URL`);
    } else if (!existsSync(resolved)) {
        fail(`${file}: link "${target}" does not resolve`);
    }
}

/**
 * Link and image destinations as a CommonMark renderer sees them, so code,
 * container blocks, multi-line destinations and reference links follow the
 * same rules as the published page. Bun hands over the raw destination;
 * backslash escapes are removed here so it names the file on disk.
 */
export function markdownLinks(markdown: string): string[] {
    const targets: string[] = [];
    const unescapeMarkdown = (value: string) => value.replace(/\\([!-/:-@[-`{-~])/g, "$1");
    Bun.markdown.render(markdown, {
        link: (_children: string, { href }: { href: string }) => { targets.push(unescapeMarkdown(href)); return ""; },
        image: (_children: string, { src }: { src: string }) => { targets.push(unescapeMarkdown(src)); return ""; },
    });
    return targets;
}

/** Regular files under `dir`; symlinks are reported, not followed. */
function listFiles(dir: string, onLink: (path: string) => void): string[] {
    return readdirSync(dir).flatMap(entry => {
        const path = join(dir, entry);
        const stat = lstatSync(path);
        if (stat.isSymbolicLink()) {
            onLink(path);
            return [];
        }
        return stat.isDirectory() ? listFiles(path, onLink) : [path];
    });
}

/** Markdown table of description sizes against the budget, for the console and the CI step summary. */
export function budgetTable(report: SkillReport): string {
    const rows = report.skills.map(skill => `| \`${skill.name}\` | ${skill.description.length} |`);
    return [
        "| Skill | Description characters |",
        "| --- | ---: |",
        ...rows,
        `| **Total** (budget ${DESCRIPTION_BUDGET}) | **${report.descriptionTotal}** |`,
    ].join("\n");
}

if (import.meta.main) {
    const report = checkSkills();
    const table = budgetTable(report);
    console.log(table);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, `### House skill descriptions\n\n${table}\n\n`);
    for (const error of report.errors) console.error(`✗ ${error}`);
    if (report.errors.length) {
        console.error(`\n${report.errors.length} skill validation error(s)`);
        process.exit(1);
    }
    console.log(`✓ ${report.skills.length} house skill(s) valid; descriptions ${report.descriptionTotal}/${DESCRIPTION_BUDGET} characters`);
}
