/**
 * build.ts — Static site builder for tikoci.github.io
 *
 * Copies src/ → dist/, preserving pre-existing static files in dist/
 * (scripts/, media/) that are committed to the repo and linked externally.
 * Fetches GitHub repo data and generates per-repo landing pages + map data.
 *
 * Usage: bun run build.ts
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import { buildGraphData, fetchGitHubData } from "./fetch-github-data";
import { generatePages } from "./generate-pages";
import { REPO_SYMBOLS } from "./repo-config";

const ROOT = resolve(import.meta.dirname);
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const CACHE = join(ROOT, ".cache", "jetbrains-mono");
const CURLCONVERTER_ENTRY = join(SRC, "curlconverter.js");
const CURLCONVERTER_WASM_ASSETS = [
    {
        src: join(ROOT, "node_modules", "web-tree-sitter", "tree-sitter.wasm"),
        dest: join(DIST, "tree-sitter.wasm"),
    },
    {
        src: join(ROOT, "node_modules", "curlconverter", "dist", "tree-sitter-bash.wasm"),
        dest: join(DIST, "tree-sitter-bash.wasm"),
    },
] as const;

async function getJetBrainsMonoTtfPath() {
    const targetPath = join(CACHE, "JetBrainsMono-Regular.ttf");
    if (existsSync(targetPath)) return targetPath;

    console.log("Downloading JetBrains Mono font from GitHub...");
    const releaseUrl = "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip";
    const res = await fetch(releaseUrl);
    if (!res.ok) throw new Error(`Failed to download JetBrainsMono zip: ${res.status} ${res.statusText}`);

    mkdirSync(CACHE, { recursive: true });
    const archivePath = join(CACHE, "JetBrainsMono-2.304.zip");
    writeFileSync(archivePath, Buffer.from(await res.arrayBuffer()));

    const extractDir = join(CACHE, "JetBrainsMono-2.304");
    mkdirSync(extractDir, { recursive: true });
    const result = spawnSync("unzip", ["-o", archivePath, "-d", extractDir], { stdio: "ignore" });
    if (result.status !== 0) throw new Error("Failed to unzip JetBrainsMono archive");

    const extractedTtf = join(extractDir, "fonts", "ttf", "JetBrainsMono-Regular.ttf");
    if (!existsSync(extractedTtf)) {
        throw new Error(`JetBrainsMono-Regular.ttf not found after extracting ${extractDir}`);
    }
    copyFileSync(extractedTtf, targetPath);
    return targetPath;
}

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

// Step 2.5: Bundle browser-side curl parser helper and copy its WASM assets
if (existsSync(CURLCONVERTER_ENTRY)) {
    console.log("Bundling curlconverter browser helper...");
    const result = await Bun.build({
        entrypoints: [CURLCONVERTER_ENTRY],
        outdir: DIST,
        root: SRC,
        target: "browser",
        format: "esm",
        packages: "bundle",
        sourcemap: "none",
        naming: {
            entry: "[name].[ext]",
        },
    });

    if (!result.success) {
        for (const log of result.logs) {
            console.error(log);
        }
        throw new Error("Failed to bundle curlconverter browser helper");
    }
}

console.log("Copying curlconverter WASM assets...");
for (const asset of CURLCONVERTER_WASM_ASSETS) {
    if (!existsSync(asset.src)) {
        throw new Error(`Missing curlconverter asset: ${asset.src}`);
    }
    copyFileSync(asset.src, asset.dest);
}

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

// Step 4.5: Generate per-repo SVG and PNG in dist/p/
console.log("Generating per-repo symbols (SVG + PNG)...");
const P_DIR = join(DIST, "p");
mkdirSync(P_DIR, { recursive: true });

function translatePath(path: opentype.Path, dx: number, dy: number) {
    for (const cmd of path.commands) {
        if ("x" in cmd) cmd.x += dx;
        if ("y" in cmd) cmd.y += dy;
        if ("x1" in cmd) cmd.x1 += dx;
        if ("y1" in cmd) cmd.y1 += dy;
        if ("x2" in cmd) cmd.x2 += dx;
        if ("y2" in cmd) cmd.y2 += dy;
    }
}

function glyphSvgPath(font: opentype.Font, sym: string, canvasSize = 256, glyphFontSize = 220) {
    const glyph = font.charToGlyph(sym);
    if (!glyph || glyph.index === 0) {
        throw new Error(`JetBrains Mono font does not contain glyph for ${sym} (U+${sym.codePointAt(0)?.toString(16).toUpperCase()})`);
    }

    const path = glyph.getPath(0, 0, glyphFontSize);
    const bbox = path.getBoundingBox();
    const symbolWidth = bbox.x2 - bbox.x1;
    const symbolHeight = bbox.y2 - bbox.y1;

    const centerX = (canvasSize - symbolWidth) / 2 - bbox.x1;
    const centerY = (canvasSize - symbolHeight) / 2 - bbox.y1;

    translatePath(path, centerX, centerY);

    const d = path.toPathData(2);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">` +
        `<style>path{fill:#1b1b1f}@media(prefers-color-scheme:dark){path{fill:#e4e1e8}}</style>` +
        `<path d="${d}"/>` +
        `</svg>`;
}

let font: opentype.Font;
try {
    const jetbrainsFontPath = await getJetBrainsMonoTtfPath();
    font = opentype.loadSync(jetbrainsFontPath);
} catch (err) {
    throw new Error(`Failed to load JetBrains Mono font: ${err}`);
}

for (const name of Object.keys(REPO_SYMBOLS)) {
    const sym = REPO_SYMBOLS[name];
    try {
        const svg = glyphSvgPath(font, sym, 256, 220);
        const outSvg = join(P_DIR, `${name}.svg`);
        writeFileSync(outSvg, svg, "utf-8");

        const outPng = join(P_DIR, `${name}.png`);
        const pngBuffer = await sharp(Buffer.from(svg)).resize(128, 128, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}}).png().toBuffer();
        writeFileSync(outPng, pngBuffer);

        console.log(`  Wrote p/${name}.svg and p/${name}.png`);
    } catch (err) {
        console.error(`  Failed to render symbol ${name}: ${String(err)}`);
        throw err;
    }
}

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
