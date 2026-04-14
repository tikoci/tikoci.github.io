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
import type { ExternalLink } from "./repo-config";

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

/** Shift heading levels down by 1 (h1→h2 … h5→h6) so README headings don't compete with page h1 */
function downshiftHeadings(html: string): string {
    return html.replace(/<(\/?)h([1-5])(\s|>)/gi, (_, slash, level, rest) =>
        `<${slash}h${Number(level) + 1}${rest}`
    );
}

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

function renderBonusDocs(docs: RepoData["bonusDocs"], viewableFileContents: RepoData["viewableFileContents"]): string {
    // If all bonus docs have viewable content, skip the separate links section
    const viewableNames = new Set(viewableFileContents.map(v => v.name));
    const nonViewableDocs = docs.filter(d => !viewableNames.has(d.name));
    if (!nonViewableDocs.length) return "";
    return `
        <section class="bonus-docs">
            <h3>Additional Documentation</h3>
            <ul>
                ${nonViewableDocs.map(d => `<li><a href="${escapeHtml(d.url)}" target="_blank" rel="noopener">${escapeHtml(d.name)}</a></li>`).join("\n                ")}
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

/** VS Code "Install in VS Code" CTA with marketplace link */
function renderVscodeInstall(extensionId: string): string {
    const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${encodeURIComponent(extensionId)}`;
    const installUrl = `vscode:extension/${encodeURIComponent(extensionId)}`;
    return `
        <article class="install-card">
            <header>
                <h3>
                    <svg class="vscode-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17.583.063a1.5 1.5 0 0 0-1.032.392 1.5 1.5 0 0 0-.001 0L7.04 9.018 2.905 5.903a1 1 0 0 0-1.29.058l-1.3 1.19a1 1 0 0 0-.002 1.462L4.39 12l-4.076 3.387a1 1 0 0 0 .002 1.462l1.3 1.19a1 1 0 0 0 1.29.058l4.134-3.116 9.51 8.564a1.5 1.5 0 0 0 1.033.392 1.5 1.5 0 0 0 .453-.073l4.5-1.5a1.5 1.5 0 0 0 1.014-1.42V1.556a1.5 1.5 0 0 0-1.014-1.42l-4.5-1.5a1.5 1.5 0 0 0-.453-.073zm.167 3.2V20.74l-7-6.304V9.563z" fill="currentColor"/></svg>
                    Install in VS Code
                </h3>
            </header>
            <div class="install-actions">
                <a href="${installUrl}" role="button" class="install-btn">
                    <svg class="btn-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 1a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 7.293V1.5A.5.5 0 0 1 8 1zM2.5 10a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 1 1 0v2a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-2a.5.5 0 0 1 .5-.5z" fill="currentColor"/></svg>
                    Install Extension
                </a>
                <a href="${escapeHtml(marketplaceUrl)}" role="button" class="outline" target="_blank" rel="noopener">
                    View on Marketplace
                </a>
            </div>
            <footer>
                <small><code>${escapeHtml(extensionId)}</code> &middot; Free &middot; \u2605 5.0</small>
            </footer>
        </article>`;
}

/** Docker Hub image links section */
function renderDockerImages(images: string[]): string {
    if (!images.length) return "";
    return `
        <article class="docker-card">
            <header>
                <h3>
                    <svg class="docker-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.186.186 0 0 0-.187.186v1.887c0 .102.084.185.187.185m-2.954-5.43h2.118a.186.186 0 0 0 .187-.185V3.574a.186.186 0 0 0-.187-.185h-2.118a.185.185 0 0 0-.186.185v1.888c0 .102.083.185.186.185m0 2.716h2.118a.187.187 0 0 0 .187-.186V6.29a.186.186 0 0 0-.187-.185h-2.118a.185.185 0 0 0-.186.185v1.887c0 .102.083.186.186.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.186v1.887c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186H5.136a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.186v1.887c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.227.328c-.287.438-.49.922-.602 1.43-.138.64-.124 1.318.04 1.946-.492.282-1.297.35-1.488.36H.88a.88.88 0 0 0-.88.882c-.003 1.612.237 3.214.712 4.748.554 1.672 1.38 2.9 2.456 3.648 1.203.836 3.16 1.314 5.37 1.314.965.002 1.93-.083 2.882-.253a12.2 12.2 0 0 0 3.622-1.316 10.8 10.8 0 0 0 2.64-2.2c1.248-1.39 1.992-2.948 2.588-4.304h.225c1.396 0 2.254-.558 2.73-1.025a2.6 2.6 0 0 0 .7-1.05l.098-.33z" fill="currentColor"/></svg>
                    Docker Hub
                </h3>
            </header>
            <div class="docker-images">
                ${images.map(img => {
                    const hubUrl = `https://hub.docker.com/r/${encodeURIComponent(img.split("/")[0])}/${encodeURIComponent(img.split("/")[1] || img)}`;
                    return `
                <div class="docker-image-row">
                    <code>docker pull ${escapeHtml(img)}</code>
                    <a href="${escapeHtml(hubUrl)}" role="button" class="outline" target="_blank" rel="noopener">View on Docker Hub</a>
                </div>`;
                }).join("")}
            </div>
        </article>`;
}

/** External links rendered as a row of buttons */
function renderExternalLinks(links: ExternalLink[]): string {
    if (!links.length) return "";
    return `
        <section class="external-links">
            <h3>Tools &amp; Resources</h3>
            <div class="external-links-grid">
                ${links.map(link => `
                <a href="${escapeHtml(link.url)}" role="button" class="${link.style === "primary" ? "" : "outline"}" target="_blank" rel="noopener">
                    ${escapeHtml(link.label)}${link.description ? `<br><small>${escapeHtml(link.description)}</small>` : ""}
                </a>`).join("")}
            </div>
        </section>`;
}

/** Viewable file modals (for markdown docs rendered at build time) */
function renderViewableFiles(files: RepoData["viewableFileContents"], repoName: string, defaultBranch: string): string {
    if (!files.length) return "";
    const displayName = (path: string) => path.split("/").pop() || path;
    const modals = files.map((f, i) => {
        const modalId = `modal-${repoName}-${i}`;
        const githubUrl = `https://github.com/${OWNER}/${repoName}/blob/${defaultBranch}/${f.name}`;
        return `
        <dialog id="${modalId}" class="doc-modal">
            <article>
                <header>
                    <button aria-label="Close" rel="prev" onclick="document.getElementById('${modalId}').close()"></button>
                    <h3>${escapeHtml(displayName(f.name))}</h3>
                </header>
                <div class="readme-content modal-body">
                    ${downshiftHeadings(f.html)}
                </div>
                <footer>
                    <a href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener">View on GitHub</a>
                </footer>
            </article>
        </dialog>`;
    }).join("\n");

    const buttons = files.map((f, i) => {
        const modalId = `modal-${repoName}-${i}`;
        return `<button class="outline" onclick="document.getElementById('${modalId}').showModal()">
                    <svg class="btn-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zm5 0v4h4L9 0zM4.5 7a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zm0 2a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7zm0 2a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3z" fill="currentColor"/></svg>
                    Read ${escapeHtml(displayName(f.name))}
                </button>`;
    }).join("\n                ");

    return `
        <section class="viewable-docs">
            <h3>Documentation</h3>
            <div class="viewable-docs-actions">
                ${buttons}
            </div>
        </section>
        ${modals}`;
}

/** Dockerfile viewer modal */
function renderDockerfileViewer(content: string, repoName: string, defaultBranch: string): string {
    const githubUrl = `https://github.com/${OWNER}/${repoName}/blob/${defaultBranch}/Dockerfile`;
    return `
        <dialog id="modal-dockerfile" class="doc-modal">
            <article>
                <header>
                    <button aria-label="Close" rel="prev" onclick="document.getElementById('modal-dockerfile').close()"></button>
                    <h3>Dockerfile</h3>
                </header>
                <div class="modal-body">
                    <pre><code>${escapeHtml(content)}</code></pre>
                </div>
                <footer>
                    <a href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener">View on GitHub</a>
                </footer>
            </article>
        </dialog>`;
}

function renderPage(repo: RepoData, allRepos: RepoData[]): string {
    const related = findRelated(repo.name, allRepos);
    const langBadge = repo.language
        ? `<mark class="lang" style="--lang-color: ${LANG_COLORS[repo.language] || "#888"}">${escapeHtml(repo.language)}</mark>`
        : "";
    const canonicalUrl = `https://tikoci.github.io/p/${repo.name}.html`;

    // Build the "quick actions" section — prominent CTAs above the README
    const hasVscode = !!repo.vscodeExtensionId;
    const hasDocker = !!repo.dockerImages?.length;
    const hasExternalLinks = !!repo.externalLinks?.length;
    const hasViewableFiles = !!repo.viewableFileContents?.length;
    const hasDockerfile = repo.hasDockerfile && !!repo.dockerfileContent;
    const hasQuickActions = hasVscode || hasDocker || hasExternalLinks || hasViewableFiles || hasDockerfile;

    // Homepage link (if repo has one set and it's not the GitHub Pages URL)
    const homepageLink = repo.homepage && !repo.homepage.includes("tikoci.github.io/p/")
        ? `<a href="${escapeHtml(repo.homepage)}" role="button" class="outline" target="_blank" rel="noopener">\u{1F310} Homepage</a>`
        : "";

    const description = repo.description || `${repo.name} — open source MikroTik RouterOS project by TIKOCI`;

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <title>${escapeHtml(repo.name)} \u2014 tikoci.github.io</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:title" content="${escapeHtml(repo.name)} \u2014 tikoci.github.io">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary">
    <link rel="alternate" type="application/atom+xml" href="https://tikoci.github.io/atom.xml" title="TIKOCI Projects">
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
        .repo-actions a[role="button"],
        .repo-actions button {
            font-size: 0.95rem;
        }

        /* Quick Actions grid */
        .quick-actions {
            margin-bottom: 2rem;
        }

        /* VS Code install card */
        .install-card {
            border-left: 4px solid #007ACC;
        }
        .install-card header h3 {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0;
        }
        .vscode-icon {
            width: 1.3em;
            height: 1.3em;
            color: #007ACC;
            flex-shrink: 0;
        }
        .install-actions {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        .install-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
        }
        .btn-icon {
            width: 1em;
            height: 1em;
            flex-shrink: 0;
        }

        /* Docker card */
        .docker-card {
            border-left: 4px solid #2496ED;
        }
        .docker-card header h3 {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0;
        }
        .docker-icon {
            width: 1.3em;
            height: 1.3em;
            color: #2496ED;
            flex-shrink: 0;
        }
        .docker-images {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        .docker-image-row {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
        }
        .docker-image-row code {
            flex: 1;
            min-width: 0;
            font-size: 0.88rem;
        }
        .docker-image-row a[role="button"] {
            font-size: 0.85rem;
            white-space: nowrap;
            margin-bottom: 0;
        }

        /* External links */
        .external-links {
            margin-bottom: 1.5rem;
        }
        .external-links-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .external-links-grid a[role="button"] {
            font-size: 0.9rem;
            text-align: center;
        }
        .external-links-grid a[role="button"] small {
            opacity: 0.75;
            font-size: 0.78rem;
            display: block;
        }

        /* Viewable docs */
        .viewable-docs {
            margin-bottom: 1.5rem;
        }
        .viewable-docs-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .viewable-docs-actions button {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            font-size: 0.9rem;
        }

        /* Doc modals */
        dialog.doc-modal {
            max-width: min(900px, 95vw);
            max-height: 90vh;
        }
        dialog.doc-modal article {
            margin: 0;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
        }
        dialog.doc-modal .modal-body {
            overflow-y: auto;
            flex: 1;
        }
        dialog.doc-modal .modal-body pre {
            overflow-x: auto;
            max-height: none;
        }

        /* Dockerfile button in actions bar */
        .dockerfile-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
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
                <li>
                    <details class="dropdown">
                        <summary role="button" class="outline" style="font-size:0.85rem;padding:0.3rem 0.65rem">Tools</summary>
                        <ul dir="rtl" id="tools-list"></ul>
                    </details>
                </li>
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
                ${homepageLink}
                <a href="../project-map.html" role="button" class="outline">Project Map</a>
                ${hasDockerfile ? `<button class="outline dockerfile-btn" onclick="document.getElementById('modal-dockerfile').showModal()">
                    <svg class="btn-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zm5 0v4h4L9 0zM4.5 7a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zm0 2a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7zm0 2a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3z" fill="currentColor"/></svg>
                    View Dockerfile
                </button>` : ""}
            </div>
        </section>

        ${hasQuickActions ? `<section class="quick-actions">` : ""}
        ${hasVscode ? renderVscodeInstall(repo.vscodeExtensionId!) : ""}
        ${hasDocker ? renderDockerImages(repo.dockerImages!) : ""}
        ${hasExternalLinks ? renderExternalLinks(repo.externalLinks!) : ""}
        ${hasViewableFiles ? renderViewableFiles(repo.viewableFileContents, repo.name, repo.default_branch) : ""}
        ${hasQuickActions ? `</section>` : ""}

        ${repo.readmeHtml ? `
        <article class="readme-content">
            ${downshiftHeadings(repo.readmeHtml)}
        </article>` : ""}

        ${renderBonusDocs(repo.bonusDocs, repo.viewableFileContents)}
        ${renderRelated(related)}
    </main>

    <footer class="container">
        <small><em>This page is auto-generated from the <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a> repository. Content is sourced from the project README.</em></small>
    </footer>

    ${hasDockerfile ? renderDockerfileViewer(repo.dockerfileContent!, repo.name, repo.default_branch) : ""}

    <script src="../shared.js"></script>
    <script>
        initThemeSwitcher()
        initToolsDropdown('tools-list', { exclude: ['project-map.html'] })
    </script>
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
