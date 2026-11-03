import { validateSnapshots } from "./scripts/validate-snapshots";
import { SITE_ORIGIN } from "./data/site-config";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import { applyConfigOverrides, buildGraphData, type RepoData } from "./scripts/fetch-github-data";
import { renderHomepageSections } from "./scripts/generate-homepage";
import { generatePages } from "./scripts/generate-pages";
import { REPO_SYMBOLS } from "./data/repo-config";

const ROOT = resolve(import.meta.dirname);
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

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

validateSnapshots();

// dist is disposable; all unchanged assets originate in public/.
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
copyDir(join(ROOT, "public"), DIST);
copyDir(join(ROOT, "data", "published"), join(DIST, "data"));
copyDir(join(ROOT, "data", "metadata"), join(DIST, "metadata"));
const discovery = JSON.parse(readFileSync(join(ROOT, "data/metadata/index.json"), "utf-8"));
const metadataLinks = discovery.datasets.map((dataset: { id: string; url: string; schema: string }) =>
    `<li><a href="${dataset.url}">${dataset.id}</a> — <a href="${dataset.schema}">schema</a></li>`).join("\n");
writeFileSync(join(DIST, "metadata/index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TIKOCI metadata</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"><link rel="stylesheet" href="/shared.css"></head>
<body><main class="container"><nav><a href="/">TIKOCI</a></nav><h1>Metadata</h1>
<p>Public cross-repository observations. <a href="index.json">Machine-readable discovery</a></p><ul>${metadataLinks}</ul>
<p>Check each dataset’s observation time, latest attempt and errors before use.</p></main></body></html>`);

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

const repos: RepoData[] = applyConfigOverrides(JSON.parse(readFileSync(join(ROOT, "data", "repos.json"), "utf-8")));
if (!Array.isArray(repos) || !repos.length) throw new Error("Missing repository snapshot; see docs/refresh-data.md");
generatePages(repos, DIST);
for (const file of ["sitemap.xml", "atom.xml", "robots.txt"]) {
    const path = join(DIST, file);
    writeFileSync(path, readFileSync(path, "utf-8").replaceAll("{{SITE_ORIGIN}}", SITE_ORIGIN));
}
// Step 4.5: Inject data-driven homepage sections into index.html
console.log("Embedding homepage sections into index.html...");
const indexPath = join(DIST, "index.html");
const homepagePlaceholder = "<!-- HOMEPAGE_SECTIONS_PLACEHOLDER -->";
const indexHtml = readFileSync(indexPath, "utf-8");
if (!indexHtml.includes(homepagePlaceholder)) {
    throw new Error(`Homepage placeholder ${homepagePlaceholder} not found in ${indexPath} — cannot inject sections`);
}
// Callback form avoids $-pattern substitution in the rendered HTML.
const updatedIndex = indexHtml.replace(homepagePlaceholder, () => renderHomepageSections(repos));
writeFileSync(indexPath, updatedIndex, "utf-8");
console.log("  Injected homepage sections");

// Step 4.6: Generate per-repo SVG and PNG in dist/p/
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
    const jetbrainsFontPath = join(ROOT, "data", "fonts", "JetBrainsMono-Regular.ttf");
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
            `        <loc>${SITE_ORIGIN}/p/${r.name}.html</loc>`,
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

// Step 7: Generate atom.xml Atom feed
if (repos.length) {
    console.log("Generating atom.xml feed...");
    const atomPath = join(DIST, "atom.xml");
    if (existsSync(atomPath)) {
        let atom = readFileSync(atomPath, "utf-8");
        const buildDate = repos.map(r => r.updated_at).sort().at(-1) ?? "1970-01-01T00:00:00Z";
        atom = atom.replace("<!-- ATOM_BUILD_DATE_PLACEHOLDER -->", buildDate);
        const atomMarker = "<!-- Per-repo entries (auto-generated at build time below this line) -->";
        const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const entries = repos.map(r => {
            const url = `${SITE_ORIGIN}/p/${r.name}.html`;
            const summary = r.description || `${r.name} — open source MikroTik RouterOS project`;
            return [
                "    <entry>",
                `        <title>${escapeXml(r.name)}</title>`,
                `        <link href="${url}" rel="alternate" type="text/html"/>`,
                `        <id>${url}</id>`,
                `        <updated>${r.updated_at}</updated>`,
                `        <summary type="text">${escapeXml(summary)}</summary>`,
                "    </entry>",
            ].join("\n");
        }).join("\n");
        atom = atom.replace(atomMarker, `${atomMarker}\n${entries}`);
        writeFileSync(atomPath, atom, "utf-8");
        console.log(`  Generated atom.xml with ${repos.length} entries`);
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
