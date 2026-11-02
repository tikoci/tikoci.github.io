import { fileURLToPath } from "node:url";
import { retainObservations, retainDetailObservations } from "./retain-observations";
/** Explicit hourly collection. Rendering never imports this entry point. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchGitHubData, writeReposJson } from "./fetch-github-data";
import { fetchDashboardData, writeDashboardCache } from "./fetch-dashboard-data";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
process.argv.push("--fresh");
mkdirSync("data/published", { recursive: true });
const previous = JSON.parse(readFileSync("data/repos.json", "utf-8"));
writeFileSync("data/.github-cache.json", JSON.stringify({ timestamp: JSON.parse(readFileSync("data/published/collection.json", "utf-8")).repositories.observedAtMs, repos: previous }));
const previousRos = JSON.parse(readFileSync("data/published/ros-versions.json", "utf-8"));
const dashboard = JSON.parse(readFileSync("data/published/dashboard.json", "utf-8"));
const details = Object.fromEntries(Object.keys(dashboard.repos).map(name => [name, JSON.parse(readFileSync(`data/published/dashboard/${name}.json`, "utf-8"))]));
writeDashboardCache("data/.dashboard-cache.json", dashboard, details);
const attemptedAt = new Date().toISOString();
let repos = previous;
let repositoryError: string | null = null;
try { repos = await fetchGitHubData(`${root}/data`, message => { repositoryError = message; }); }
catch (error) { repositoryError = "Repository enrichment failed; retained snapshot"; console.warn(String(error)); }

if (!repos.length) throw new Error("Repository contract requires a nonempty snapshot");
writeReposJson("data/published", repos);
writeFileSync("data/repos.json", `${JSON.stringify(repos, null, 2)}\n`);
const collected = await fetchDashboardData(`${root}/data`);
const ros = JSON.parse(readFileSync("data/published/ros-versions.json", "utf-8"));
writeFileSync("data/published/ros-versions.json", `${JSON.stringify(retainObservations(ros, previousRos, previousRos.generatedAt), null, 2)}\n`);
const retained = retainObservations(collected, dashboard, dashboard.generatedAt);
writeFileSync("data/published/dashboard.json", `${JSON.stringify(retained, null, 2)}\n`);
for (const name of Object.keys(collected.repos)) {
    const path = `data/published/dashboard/${name}.json`;
    const current = JSON.parse(readFileSync(path, "utf-8"));
    writeFileSync(path, `${JSON.stringify(retainDetailObservations(current, details[name], collected.repos[name], dashboard.repos[name]), null, 2)}\n`);
}
writeFileSync("data/published/collection.json", `${JSON.stringify({ schemaVersion: 1, attemptedAt, repositories: { observedAtMs: JSON.parse(readFileSync("data/.github-cache.json", "utf-8")).timestamp, observedAt: new Date(JSON.parse(readFileSync("data/.github-cache.json", "utf-8")).timestamp).toISOString(), error: repositoryError ?? (JSON.parse(readFileSync("data/.github-cache.json", "utf-8")).timestamp < Date.parse(attemptedAt) ? "Repository collection failed; retained snapshot" : null) }, note: "See per-signal state/error and generatedAt; failed signals may retain last-known-good observations." }, null, 2)}\n`);
