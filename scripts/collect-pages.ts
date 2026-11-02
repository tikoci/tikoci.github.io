import { retainObservations } from "./retain-observations";
/** Public allowlist is established anonymously, independently of token scope. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { main, type PagesRepoSurvey, type PagesSurveyFile } from "./repo-github-pages";
const root = new URL("../data/", import.meta.url).pathname;
mkdirSync(`${root}/metadata`, { recursive: true });
const path = `${root}/metadata/pages.json`;
const attemptedAt = new Date().toISOString();
let previous: Record<string, unknown> | undefined;
try { previous = JSON.parse(readFileSync(path, "utf-8")); } catch { /* bootstrap */ }
try {
    const names = new Set<string>();
    for (let page = 1; ; page++) {
        const response = await fetch(`https://api.github.com/orgs/tikoci/repos?type=public&per_page=100&page=${page}`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Public repository listing HTTP ${response.status}`);
        const rows = await response.json() as { name: string; private: boolean }[];
        if (!Array.isArray(rows)) throw new Error("Invalid public repository listing");
        for (const row of rows) if (row.private === false) names.add(row.name);
        if (rows.length < 100) break;
    }
    if (!process.argv.includes("--publish-existing")) await main();
    const survey: PagesSurveyFile = JSON.parse(readFileSync(`${root}/repo-github-pages.json`, "utf-8"));
    if (survey.schemaVersion !== 1) throw new Error("Unsupported Pages survey contract");
    // Public projection excludes branch names, deployment refs/SHAs, token budgets and raw errors.
    const repos = Object.fromEntries(Object.entries(survey.repos).filter(([name]) => names.has(name)).map(([name, value]) => {
        const row = value as PagesRepoSurvey;
        return [name, { name, hasPages: row.hasPages, state: row.state, htmlUrl: row.htmlUrl ?? null, serve: row.serve ?? null, plausible: row.plausible ?? null }];
    }));
    const result = { schemaVersion: 1, observedAt: survey.generatedAt, attemptedAt, error: null, provenance: { collector: "scripts/repo-github-pages.ts", scope: "Anonymous public repository allowlist; Pages settings may be token-scoped", sources: survey.sources }, repos: retainObservations(repos, previous?.repos, String(previous?.observedAt)) };
    writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
    if (!previous || (error instanceof Error && error.message === "Unsupported Pages survey contract")) throw error;
    writeFileSync(path, `${JSON.stringify({ ...previous, attemptedAt, error: "Pages collection failed; retaining last successful public inventory" }, null, 2)}\n`);
    console.warn(String(error));
}
