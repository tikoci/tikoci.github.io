#!/usr/bin/env bun
// Validates the house skills in skills/ beyond what markdownlint and cspell see.
// Adapted from tikoci/routeros-skills scripts/check-skills.ts, plus the house
// rules from issue #21: name = directory with the tikoci- prefix, a tracked
// total description budget, no operator-local paths, and self-contained
// relative links so a copied or published skill directory still works.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".jsonc", ".toml", ".yaml", ".yml", ".tsv", ".csv", ".ts", ".js", ".sh", ".rsc"]);

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
        if (!statSync(path).isDirectory()) {
            if (!TOP_LEVEL_FILES.has(entry)) errors.push(`${entry}: unexpected file; skills/ holds one directory per skill`);
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
        if (!SKILL_ENTRIES.has(child)) fail(`unexpected entry "${child}"; use SKILL.md, references/, scripts/ or assets/`);
    }
    const files = listFiles(dir).map(file => relative(dir, file).split(sep).join("/")).sort();
    for (const file of files) checkFile(dir, file, fail);

    const skillPath = join(dir, "SKILL.md");
    if (!existsSync(skillPath)) {
        fail("missing SKILL.md");
        return null;
    }
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
    if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) return;
    const text = readFileSync(path, "utf-8");
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
    const resolved = resolve(dirname(path), decodeURIComponent(target.replace(/[#?].*$/, "")));
    if (resolved !== dir && !resolved.startsWith(dir + sep)) {
        fail(`${file}: link "${target}" leaves the skill directory; use an absolute URL`);
    } else if (!existsSync(resolved)) {
        fail(`${file}: link "${target}" does not resolve`);
    }
}

/** Inline and reference-style link targets, ignoring code. */
export function markdownLinks(markdown: string): string[] {
    const prose = markdown
        .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
        .replace(/`[^`\n]*`/g, "");
    const targets: string[] = [];
    for (const match of prose.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) targets.push(match[1]);
    for (const match of prose.matchAll(/^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$/gm)) targets.push(match[1]);
    return targets;
}

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(entry => {
        const path = join(dir, entry);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

if (import.meta.main) {
    const report = checkSkills();
    for (const error of report.errors) console.error(`✗ ${error}`);
    if (report.errors.length) {
        console.error(`\n${report.errors.length} skill validation error(s)`);
        process.exit(1);
    }
    console.log(`✓ ${report.skills.length} house skill(s) valid; descriptions ${report.descriptionTotal}/${DESCRIPTION_BUDGET} characters`);
}
