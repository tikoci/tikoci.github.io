/**
 * build.ts — Static site builder for tikoci.github.io
 *
 * Copies src/ → dist/, preserving pre-existing static files in dist/
 * (scripts/, media/) that are committed to the repo and linked externally.
 * Fetches GitHub repo data and generates per-repo landing pages + map data.
 *
 * Usage: bun run build.ts
 */

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fetchGitHubData, buildGraphData } from "./fetch-github-data";
import { generatePages } from "./generate-pages";

const ROOT = resolve(import.meta.dirname);
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

// Directories in dist/ that are committed static assets — never delete these
const PRESERVED_DIRS = ["scripts", "media", "logos"];

// Step 1: Clean dist/ except preserved directories
console.log("Cleaning dist/ (preserving scripts/, media/)...");

if (existsSync(DIST)) {
    for (const entry of readdirSync(DIST)) {
        if (PRESERVED_DIRS.includes(entry)) continue;
        const fullPath = join(DIST, entry);
        rmSync(fullPath, { recursive: true, force: true });
    }
} else {
    mkdirSync(DIST, { recursive: true });
}

// Step 2: Copy src/ contents to dist/
console.log("Copying src/ → dist/...");
copyDir(SRC, DIST);

// Step 3: Copy images from docs/images/ to dist/images/
const DOCS_IMAGES = join(ROOT, "docs", "images");
const DIST_IMAGES = join(DIST, "images");
if (existsSync(DOCS_IMAGES)) {
    console.log("Copying docs/images/ → dist/images/...");
    mkdirSync(DIST_IMAGES, { recursive: true });
    for (const file of readdirSync(DOCS_IMAGES)) {
        if (file === "PLACEHOLDER") continue;
        copyFileSync(join(DOCS_IMAGES, file), join(DIST_IMAGES, file));
    }
}

// Step 4: Fetch GitHub data and generate pages
console.log("Fetching GitHub repo data...");
const repos = await fetchGitHubData(DIST);

console.log("Generating per-repo landing pages...");
generatePages(repos, DIST);

// Step 5: Embed graph data into project-map.html
console.log("Embedding graph data into project-map.html...");
const graphData = buildGraphData(repos);
const mapPath = join(DIST, "project-map.html");
if (existsSync(mapPath)) {
    let mapHtml = readFileSync(mapPath, "utf-8");
    const placeholder = '<script type="application/json" id="graph-data">{}</script>';
    const replacement = `<script type="application/json" id="graph-data">${JSON.stringify(graphData)}</script>`;
    mapHtml = mapHtml.replace(placeholder, replacement);
    writeFileSync(mapPath, mapHtml, "utf-8");
    console.log(`  Embedded ${graphData.nodes.length} nodes, ${graphData.links.length} links`);
}

// Step 6: Inject per-repo URLs into sitemap.xml
if (repos.length) {
    console.log("Updating sitemap.xml with per-repo pages...");
    const sitemapPath = join(DIST, "sitemap.xml");
    if (existsSync(sitemapPath)) {
        let sitemap = readFileSync(sitemapPath, "utf-8");
        const marker = "<!-- Per-repo project pages (auto-generated at build time below this line) -->";
        const repoUrls = repos.map(r => [
            "    <url>",
            `        <loc>https://tikoci.github.io/p/${r.name}.html</loc>`,
            `        <lastmod>${r.updated_at.split("T")[0]}</lastmod>`,
            "        <changefreq>weekly</changefreq>",
            `        <priority>${r.stars >= 10 ? "0.7" : "0.5"}</priority>`,
            "    </url>",
        ].join("\n")).join("\n");
        sitemap = sitemap.replace(marker, `${marker}\n${repoUrls}`);
        writeFileSync(sitemapPath, sitemap, "utf-8");
        console.log(`  Added ${repos.length} repo URLs to sitemap`);
    }
}

console.log("Build complete. Output in dist/");

// List output files
const outputFiles = listFiles(DIST);
console.log(`\n${outputFiles.length} files in dist/:`);
for (const f of outputFiles) {
    console.log(`  ${f.replace(`${DIST}/`, "")}`);
}

// --- Helpers ---

function copyDir(src: string, dest: string) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
        const srcPath = join(src, entry);
        const destPath = join(dest, entry);
        if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

function listFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isDirectory()) {
            results.push(...listFiles(fullPath));
        } else {
            results.push(fullPath);
        }
    }
    return results;
}
