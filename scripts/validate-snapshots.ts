import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
export function validateSnapshots(root = fileURLToPath(new URL("../data/", import.meta.url))) {
    const read = (path: string) => JSON.parse(readFileSync(`${root}/${path}`, "utf-8"));
    const repos = read("repos.json");
    if (!Array.isArray(repos) || !repos.length || repos.some(r => typeof r.name !== "string" || typeof r.readmeHtml !== "string" || !r.updated_at)) throw new Error("Invalid repository snapshot");
    const dashboard = read("published/dashboard.json");
    if (dashboard.schemaVersion !== 2 || !dashboard.generatedAt || !dashboard.repos) throw new Error("Invalid dashboard contract");
    for (const name of Object.keys(dashboard.repos)) {
        const detail = read(`published/dashboard/${name}.json`);
        if (detail.schemaVersion !== 2) throw new Error(`Invalid dashboard detail: ${name}`);
    }
    const pages = read("metadata/pages.json");
    if (pages.schemaVersion !== 1 || !pages.observedAt || !pages.attemptedAt || !pages.repos) throw new Error("Invalid Pages metadata contract");
    const index = read("metadata/index.json");
    if (index.schemaVersion !== 1 || index.datasets?.[0]?.url !== "/metadata/pages.json") throw new Error("Invalid discovery contract");
}
if (import.meta.main) validateSnapshots();
