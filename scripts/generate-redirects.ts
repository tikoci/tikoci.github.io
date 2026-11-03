import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { README_REDIRECT_REPOS } from "../data/redirect-config";

/** Real directory routes avoid relying on a 404 response for known repos. */
export function generateReadmeRedirects(repos: { name: string }[], dist: string): void {
    const template = readFileSync(new URL("../src/404.html", import.meta.url), "utf-8");
    for (const name of new Set([...repos.map(repo => repo.name), ...README_REDIRECT_REPOS])) {
        if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name) || name === "." || name === "..") {
            throw new Error(`Invalid redirect repository name: ${name}`);
        }
        const directory = join(dist, "r", name);
        mkdirSync(directory, { recursive: true });
        const html = template
            .replace("Page not found — TIKOCI", `Redirecting to tikoci/${name}`)
            .replace(/<!-- REDIRECT_MESSAGE -->.*?<!-- \/REDIRECT_MESSAGE -->/s,
                `<p>Redirecting to: <a href="https://github.com/tikoci/${name}#readme-ov-file">tikoci/${name}#readme-ov-file</a></p>`);
        writeFileSync(join(directory, "index.html"), html);
    }
}
