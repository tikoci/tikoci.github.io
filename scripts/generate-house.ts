import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkSkills, DESCRIPTION_BUDGET, SKILLS_DIR } from "./check-skills";

export const HOUSE_PLACEHOLDER = "<!-- HOUSE_SKILLS_PLACEHOLDER -->";

const escapeHtml = (value: string) => value
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * Publishes skills/ under /house/skills/ byte for byte, so raw SKILL.md and its
 * relative references/ links work at the durable URL, then fills the /house/
 * index (authored in src/house/index.html, already copied to dist) and writes
 * /house/index.json for scripted copies. Invalid skills fail the build.
 */
export function generateHouse(dist: string, origin: string, skillsDir = SKILLS_DIR): void {
    const report = checkSkills(skillsDir);
    if (report.errors.length) throw new Error(`Invalid house skills:\n${report.errors.join("\n")}`);

    const house = join(dist, "house");
    mkdirSync(join(house, "skills"), { recursive: true });
    for (const skill of report.skills) cpSync(join(skillsDir, skill.name), join(house, "skills", skill.name), { recursive: true });
    if (existsSync(join(skillsDir, "README.md"))) cpSync(join(skillsDir, "README.md"), join(house, "skills", "README.md"));

    const index = {
        schemaVersion: 1,
        skills: report.skills.map(skill => ({
            name: skill.name,
            description: skill.description,
            url: `${origin}/house/skills/${skill.name}/SKILL.md`,
            files: skill.files,
        })),
    };
    writeFileSync(join(house, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

    // /house/skills/ is the durable base for skill files; send visitors of the bare directory to the index.
    writeFileSync(join(house, "skills", "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>House skills — TIKOCI</title>
<link rel="canonical" href="${origin}/house/"><meta http-equiv="refresh" content="0; url=../">
<meta name="robots" content="noindex"></head>
<body><p>The house skills are listed at <a href="../">${origin}/house/</a>.</p></body></html>
`);

    const pagePath = join(house, "index.html");
    const page = readFileSync(pagePath, "utf-8");
    if (!page.includes(HOUSE_PLACEHOLDER)) throw new Error(`House placeholder ${HOUSE_PLACEHOLDER} not found in ${pagePath}`);
    const rows = report.skills.map(skill => {
        const base = `skills/${skill.name}/`;
        const references = skill.files.filter(file => file !== "SKILL.md")
            .map(file => `<a href="${escapeHtml(base + file.split("/").map(encodeURIComponent).join("/"))}"><code>${escapeHtml(file)}</code></a>`).join(", ");
        return `<article id="${skill.name}">
    <h3><a href="${base}SKILL.md"><code>${skill.name}</code></a></h3>
    <p>${escapeHtml(skill.description)}</p>${references ? `\n    <p><small>Also: ${references}</small></p>` : ""}
</article>`;
    }).join("\n");
    const summary = `<p><small>${report.skills.length} skill${report.skills.length === 1 ? "" : "s"}; descriptions use ${report.descriptionTotal} of ${DESCRIPTION_BUDGET} characters.</small></p>`;
    writeFileSync(pagePath, page
        .replaceAll("{{SITE_ORIGIN}}", origin)
        .replace(HOUSE_PLACEHOLDER, () => `${rows}\n${summary}`));
}
