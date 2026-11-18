#!/usr/bin/env bun
// Generates skills/tikoci-crossref/SKILL.md, the house map of which tikoci
// repo owns which topic (issue #21, 3g). Inputs are authored and reviewed in
// PRs only: data/repo-config.ts, data/homepage-config.ts (category order and
// titles) and the other house skills' descriptions. Collected snapshots are
// never read, so the hourly refresh cannot make the committed file stale.
//
//   bun run generate:crossref           write the file
//   bun scripts/generate-crossref.ts --check   exit 1 if the file is stale
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { HOMEPAGE_SECTIONS } from "../data/homepage-config";
import { CROSSREF_HEADLINES, DASHBOARD_REPOS, RELATIONSHIPS, REPO_OVERRIDES, type Relationship } from "../data/repo-config";
import { checkSkills, SKILLS_DIR } from "./check-skills";

export const CROSSREF_NAME = "tikoci-crossref";
export const CROSSREF_PATH = join(SKILLS_DIR, CROSSREF_NAME, "SKILL.md");

const HOUSE = "https://tikoci.dev/house/skills";
const GITHUB = "https://github.com/tikoci";
const SOURCE = `${GITHUB}/tikoci.github.io`;

/** Edges the crossref lists: verified uses, where `source` provides and `target` uses. */
export function verifiedUses(relationships: Relationship[] = RELATIONSHIPS): Relationship[] {
    return relationships
        .filter(rel => rel.verifiedNote && rel.readiness && rel.readiness !== "association")
        .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
}

/** The task clause of a house skill description: the text after its final "Use when". */
export function taskClause(name: string, description: string): string {
    const at = description.lastIndexOf("Use when ");
    if (at < 0) throw new Error(`${name}: description has no "Use when ..." clause for the crossref task table`);
    return description.slice(at + "Use when ".length).trim().replace(/\.$/, "");
}

const cell = (text: string) => text.replaceAll("|", "\\|");
const repoLink = (repo: string) => `[\`${repo}\`](${GITHUB}/${repo})`;
const decodeEntities = (text: string) => text.replaceAll("&amp;", "&");

/** Packages a repo publishes, as recorded in the config: npm, VS Code, Docker Hub. */
function packages(repo: string): string[] {
    const override = REPO_OVERRIDES[repo] ?? {};
    const dashboard = DASHBOARD_REPOS[repo];
    const out: string[] = [];
    if (dashboard?.npmPackage && dashboard.npmExpected !== false) out.push(`npm \`${dashboard.npmPackage}\``);
    if (override.vscodeExtensionId) out.push(`VS Code \`${override.vscodeExtensionId}\``);
    for (const image of override.dockerImages ?? []) out.push(`Docker Hub \`${image}\``);
    return out;
}

function description(): string {
    const headlines = Object.entries(CROSSREF_HEADLINES).map(([topic, repo]) => `${topic}: ${repo}`).join("; ");
    return "Which tikoci repo owns which topic, the verified dependencies between repos, and which house skill covers which task. "
        + `${headlines}. `
        + "Generated from tikoci.github.io data/repo-config.ts: reference it by URL and change the config, never copy the map into instructions. "
        + "Use when a task crosses repos, or to find the repo or house skill that owns a topic.";
}

function repoSections(): string[] {
    const repos = Object.entries(REPO_OVERRIDES).filter(([, override]) => override.owns?.length);
    const categories = HOMEPAGE_SECTIONS.filter(section => section.mapCategory);
    const known = new Set(categories.map(section => section.mapCategory));
    const stray = repos.filter(([, override]) => !override.category || !known.has(override.category)).map(([repo]) => repo);
    if (stray.length) throw new Error(`repos with owns need a category from HOMEPAGE_SECTIONS: ${stray.join(", ")}`);

    return categories.flatMap(section => {
        const rows = repos
            .filter(([, override]) => override.category === section.mapCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([repo, override]) => {
                const shipped = packages(repo);
                return `| ${repoLink(repo)} | ${cell((override.owns ?? []).join("; "))} | ${shipped.length ? cell(shipped.join(", ")) : "-"} |`;
            });
        if (!rows.length) return [];
        return [
            `### ${decodeEntities(section.title)}`,
            "",
            "| Repo | Place to look for | Packages |",
            "| --- | --- | --- |",
            ...rows,
            "",
        ];
    });
}

function dependencyTable(): string[] {
    const named = new Set(Object.keys(REPO_OVERRIDES));
    return verifiedUses().map(rel => {
        for (const repo of [rel.source, rel.target]) {
            if (!named.has(repo)) throw new Error(`relationship names ${repo}, which has no REPO_OVERRIDES entry`);
        }
        const kind = rel.readiness === "dependency" ? "package" : "artifact";
        return `| ${repoLink(rel.source)} | ${repoLink(rel.target)} | ${kind} | ${cell(rel.verifiedNote ?? "")} |`;
    });
}

function taskTable(skillsDir: string): string[] {
    return checkSkills(skillsDir).skills
        .filter(skill => skill.name !== CROSSREF_NAME)
        .map(skill => `| ${cell(taskClause(skill.name, skill.description))} | [\`${skill.name}\`](${HOUSE}/${skill.name}/SKILL.md) |`);
}

/** The complete SKILL.md text. Deterministic for the same inputs. */
export function renderCrossref(skillsDir = SKILLS_DIR): string {
    return [
        "---",
        `name: ${CROSSREF_NAME}`,
        `description: ${JSON.stringify(description())}`,
        "---",
        "",
        "# tikoci crossref",
        "",
        "<!-- Generated by scripts/generate-crossref.ts; do not edit. Change data/repo-config.ts",
        "     or a house skill's description, then run `bun run generate:crossref`. -->",
        "",
        "The map of the tikoci org for agents developing its repos: which repo is the",
        "place to look for a topic, which repos use another's packages or published",
        "files, and which house skill covers a task. It is generated from",
        `\`data/repo-config.ts\` and the house skills' descriptions in [tikoci.github.io](${SOURCE}),`,
        "and a test there fails when this file is stale.",
        "",
        "## How to use it",
        "",
        "- **Reference it by URL**,",
        `  <${HOUSE}/${CROSSREF_NAME}/SKILL.md>, instead of copying it into a`,
        "  repo: unlike the other house skills it changes whenever a repo does.",
        "- **Before changing another repo, read its `AGENTS.md`**: the rows below say",
        "  where to look, not how that repo works.",
        "- **Do not restate this map** in an `AGENTS.md`, `CLAUDE.md` or user-level",
        "  notes. A missing or wrong row is a PR against",
        `  [\`data/repo-config.ts\`](${SOURCE}/blob/main/data/repo-config.ts):`,
        "  `owns` and `category` for a repo, `RELATIONSHIPS` with a `verifiedNote` for a",
        "  dependency, `CROSSREF_HEADLINES` for the description.",
        "- **Machine facts stay local**: where checkouts live and what is registered",
        `  on one machine belong in the operator's agent notes ([tikoci-house](${HOUSE}/tikoci-house/SKILL.md)).`,
        "- **Using the tools rather than developing them?** Start at",
        "  <https://tikoci.dev/llms.txt> and the `routeros-*` skills.",
        "",
        "## Repos",
        "",
        "Public repos with an entry in `data/repo-config.ts`, grouped as on",
        "<https://tikoci.dev/>. The first topic is the repo's role.",
        "",
        ...repoSections(),
        `Not listed: [tikoci.github.io](${SOURCE}), the source of this skill,`,
        "which owns <https://tikoci.dev>, the house skills and the org datasets below.",
        "",
        "## Dependencies",
        "",
        "Verified uses only: each row was checked in the using repo's code, and the",
        "evidence names the file. A package is an npm dependency; an artifact is a",
        "file the provider publishes (a release, a Pages file, a pinned blob). The",
        "[project map](https://tikoci.dev/project-map.html) also shows associations,",
        "which claim no use.",
        "",
        "| Provides | Used by | Kind | Evidence |",
        "| --- | --- | --- | --- |",
        ...dependencyTable(),
        "",
        "A change to a provider's published file is a contract change for each user",
        `below it ([tikoci-data-contracts](${HOUSE}/tikoci-data-contracts/SKILL.md)).`,
        "",
        "## House skills by task",
        "",
        `Each row is the "Use when" clause of a [house skill](https://tikoci.dev/house/).`,
        "",
        "| Use when | Skill |",
        "| --- | --- |",
        ...taskTable(skillsDir),
        "",
        "## Org metadata",
        "",
        "Collected by tikoci.github.io (hourly; the Pages inventory weekly) and",
        "published at durable URLs:",
        "",
        "| URL | Holds |",
        "| --- | --- |",
        "| <https://tikoci.dev/data/repos.json> | Public repos with description, stars, topics and category. |",
        "| <https://tikoci.dev/data/dashboard.json> | Per-repo CI, npm, release and RouterOS version signals, findings, and these relationships with their readiness ([contract](https://tikoci.dev/dashboard-schema.md)). |",
        "| <https://tikoci.dev/metadata/index.json> | Discovery for the independent datasets, such as the GitHub Pages inventory. |",
        "| <https://tikoci.dev/house/index.json> | The house skills and their files. |",
        "",
        "## The TIKOCI look",
        "",
        "tikoci.dev and restraml's tool pages share Pico v2, JetBrains Mono and",
        "Manrope, and a header with a Tools menu; each site keeps its own copy of the",
        "shared CSS and JS (restraml's are `restraml-shared.css` and `.js`). There is",
        "no shared package yet: copy from tikoci.github.io (`src/shared.css`,",
        "`src/shared.js`, and \"Site conventions\" in its `AGENTS.md`), and see",
        `[docs/presentation.md](${SOURCE}/blob/main/docs/presentation.md) for the`,
        "planned shared design.",
        "",
    ].join("\n");
}

if (import.meta.main) {
    const expected = renderCrossref();
    const current = existsSync(CROSSREF_PATH) ? readFileSync(CROSSREF_PATH, "utf-8") : null;
    if (process.argv.includes("--check")) {
        if (current !== expected) {
            console.error(`✗ ${CROSSREF_PATH} is stale; run \`bun run generate:crossref\``);
            process.exit(1);
        }
        console.log(`✓ ${CROSSREF_NAME} is current`);
    } else {
        mkdirSync(dirname(CROSSREF_PATH), { recursive: true });
        writeFileSync(CROSSREF_PATH, expected);
        console.log(`${current === expected ? "unchanged" : "wrote"} ${CROSSREF_PATH}`);
    }
}
