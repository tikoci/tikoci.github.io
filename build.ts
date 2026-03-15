/**
 * build.ts — Static site builder for tikoci.github.io
 *
 * Copies src/ → dist/, preserving pre-existing static files in dist/
 * (scripts/, media/) that are committed to the repo and linked externally.
 *
 * Usage: bun run build.ts
 */

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname);
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

// Directories in dist/ that are committed static assets — never delete these
const PRESERVED_DIRS = ["scripts", "media"];

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
