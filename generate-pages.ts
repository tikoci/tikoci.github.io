/**
 * generate-pages.ts — Build-time generator for per-repo landing pages
 *
 * Takes repo data from fetch-github-data.ts and produces a static HTML
 * page at dist/p/{repo-name}.html for each qualifying repo.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RepoData } from "./fetch-github-data";
import { RELATIONSHIPS } from "./repo-config";

const OWNER = "tikoci";

/** Language → GitHub-style color */
const LANG_COLORS: Record<string, string> = {
    TypeScript: "#3178c6",
    Shell: "#89e051",
    Python: "#3572A5",
    Go: "#00ADD8",
    Makefile: "#427819",
    C: "#555555",
    Dockerfile: "#384d54",
    JavaScript: "#f1e05a",
    PKL: "#6B4C9A",
};

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function findRelated(repoName: string, allRepos: RepoData[]): RepoData[] {
    const relatedNames = new Set<string>();
    for (const rel of RELATIONSHIPS) {
        if (rel.source === repoName) relatedNames.add(rel.target);
        if (rel.target === repoName) relatedNames.add(rel.source);
    }
    return allRepos.filter(r => relatedNames.has(r.name));
}

function renderTopics(topics: string[]): string {
    if (!topics.length) return "";
    return topics.map(t => `<kbd>${escapeHtml(t)}</kbd>`).join(" ");
}

function renderBonusDocs(docs: RepoData["bonusDocs"]): string {
    if (!docs.length) return "";
    return `
        <section class="bonus-docs">
            <h3>Additional Documentation</h3>
            <ul>
                ${docs.map(d => `<li><a href="${escapeHtml(d.url)}" target="_blank" rel="noopener">${escapeHtml(d.name)}</a></li>`).join("\n                ")}
            </ul>
        </section>`;
}

function renderRelated(related: RepoData[]): string {
    if (!related.length) return "";
    return `
        <section class="related-projects">
            <h3>Related Projects</h3>
            <div class="project-grid">
                ${related.map(r => `
                <article>
                    <header><h4><a href="${escapeHtml(r.name)}.html">${escapeHtml(r.name)}</a></h4></header>
                    <p>${escapeHtml(r.description)}</p>
                    <footer>
                        ${r.language ? `<mark class="lang" style="--lang-color: ${LANG_COLORS[r.language] || "#888"}">${escapeHtml(r.language)}</mark>` : ""}
                        <span>\u2B50 ${r.stars}</span>
                    </footer>
                </article>`).join("")}
            </div>
        </section>`;
}

function renderPage(repo: RepoData, allRepos: RepoData[]): string {
    const related = findRelated(repo.name, allRepos);
    const langBadge = repo.language
        ? `<mark class="lang" style="--lang-color: ${LANG_COLORS[repo.language] || "#888"}">${escapeHtml(repo.language)}</mark>`
        : "";
    const canonicalUrl = `https://tikoci.github.io/p/${repo.name}.html`;

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <title>${escapeHtml(repo.name)} \u2014 tikoci.github.io</title>
    <meta name="description" content="${escapeHtml(repo.description)}">
    <link rel="canonical" href="${canonicalUrl}">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Manrope:wght@200..800&display=swap">
    <link rel="stylesheet" href="../shared.css">
    <script async src="https://plausible.io/js/pa-ubWop5eYckoDPVbIjXU4_.js"></script>
    <script>window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()</script>
    <style>
        .repo-hero {
            margin-bottom: 1.5rem;
        }
        .repo-hero h1 {
            margin-bottom: 0.3rem;
        }
        .repo-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            align-items: center;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
        }
        .repo-meta .stars {
            font-weight: 600;
        }
        .repo-topics {
            display: flex;
            flex-wrap: wrap;
            gap: 0.3rem;
            margin-bottom: 1rem;
        }
        .repo-topics kbd {
            font-size: 0.78rem;
        }
        .repo-actions {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin-bottom: 1.5rem;
        }
        .repo-actions a[role="button"] {
            font-size: 0.95rem;
        }
        .readme-content {
            overflow-x: auto;
        }
        .readme-content img {
            max-width: 100%;
            height: auto;
        }
        .readme-content pre {
            overflow-x: auto;
        }
        .readme-content table {
            width: 100%;
        }
        .readme-content h1:first-child,
        .readme-content h2:first-child {
            display: none;
        }
        .bonus-docs {
            margin-top: 1.5rem;
        }
        .related-projects {
            margin-top: 2rem;
        }
        .related-projects .project-grid {
            margin-top: 0.5rem;
        }
        mark.lang {
            background: var(--lang-color, #888);
            color: #fff;
            font-size: 0.78rem;
            padding: 0.1em 0.45em;
            border-radius: 0.25rem;
        }
    </style>
</head>
<body>
    <header class="container">
        <nav>
            <ul>
                <li>
                    <a href="../index.html" class="nav-brand-link">
                        <svg class="nav-mt-symbol" viewBox="0 0 41.83 44.62" xmlns="http://www.w3.org/2000/svg" aria-label="MikroTik"><path d="M41.83,13.83c0-1.77-.96-3.4-2.5-4.26L23.3.62c-1.48-.83-3.28-.83-4.76,0L2.5,9.57c-1.54.86-2.5,2.49-2.5,4.26v17.08c0,1.78.97,3.42,2.53,4.28l16.04,8.82c1.46.81,3.24.81,4.7,0l16.04-8.82c1.56-.86,2.53-2.5,2.53-4.28V13.83ZM12.03,30.78c0,.4-.43.65-.78.46l-2.68-1.48c-.56-.31-.9-.89-.9-1.53v-8.07c0-.4.43-.65.78-.46l2.95,1.63c.39.21.63.62.63,1.07v8.38ZM34.16,28.19c0,.63-.34,1.22-.9,1.53l-2.68,1.48c-.35.19-.78-.06-.78-.46v-10.32c0-.4-.43-.65-.78-.46l-4.95,2.73c-.56.31-.9.89-.9,1.53v10.55c0,.32-.17.61-.45.76l-1.01.56c-.52.29-1.16.29-1.69,0l-.94-.52c-.28-.15-.45-.45-.45-.76v-10.66c0-.63-.34-1.22-.9-1.53l-9.81-5.42c-.17-.09-.27-.27-.27-.46v-.42c0-.63.34-1.22.9-1.53l1.4-.77c.52-.29,1.16-.29,1.69,0l8.48,4.69c.52.29,1.16.29,1.69,0l3.81-2.11c.36-.2.36-.72,0-.92l-8.51-4.7c-.36-.2-.36-.72,0-.92l2.9-1.6c.52-.29,1.16-.29,1.69,0l11.55,6.38c.56.31.9.89.9,1.53v11.81Z" fill="currentColor"/></svg>
                        <strong class="brand-reverse">TIKOCI</strong>
                    </a>
                </li>
            </ul>
            <ul>
                <li><a href="../project-map.html" role="button" class="outline" style="font-size:0.85rem;padding:0.3rem 0.65rem">Project Map</a></li>
                <li><a href="#" id="theme_switcher" aria-label="Toggle dark mode"></a></li>
            </ul>
        </nav>
    </header>

    <main class="container">
        <section class="repo-hero">
            <h1>${escapeHtml(repo.name)}</h1>
            <div class="repo-meta">
                ${langBadge}
                <span class="stars">\u2B50 ${repo.stars}</span>
                <span>\u00B7</span>
                <small>Updated ${new Date(repo.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</small>
            </div>
            ${repo.topics.length ? `<div class="repo-topics">${renderTopics(repo.topics)}</div>` : ""}
            <p>${escapeHtml(repo.description)}</p>
            <div class="repo-actions">
                <a href="${escapeHtml(repo.html_url)}" role="button" target="_blank" rel="noopener">View on GitHub</a>
                <a href="../project-map.html" role="button" class="outline">Project Map</a>
            </div>
        </section>

        ${repo.readmeHtml ? `
        <article class="readme-content">
            ${repo.readmeHtml}
        </article>` : ""}

        ${renderBonusDocs(repo.bonusDocs)}
        ${renderRelated(related)}
    </main>

    <footer class="container">
        <small><em>This page is auto-generated from the <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a> repository. Content is sourced from the project README.</em></small>
    </footer>

    <script src="../shared.js"></script>
    <script>initThemeSwitcher()</script>
</body>
</html>`;
}

/**
 * Generate all per-repo landing pages in dist/p/
 */
export function generatePages(repos: RepoData[], distDir: string) {
    const pagesDir = join(distDir, "p");
    mkdirSync(pagesDir, { recursive: true });

    for (const repo of repos) {
        const html = renderPage(repo, repos);
        const outPath = join(pagesDir, `${repo.name}.html`);
        writeFileSync(outPath, html, "utf-8");
        console.log(`  Generated p/${repo.name}.html`);
    }

    console.log(`  ${repos.length} landing pages generated`);
}
