/**
 * generate-homepage.ts — Build-time renderer for the data-driven homepage
 *
 * Turns HOMEPAGE_SECTIONS (homepage-config.ts) into HTML, enriching tiles that
 * reference a repo with live data (APL symbol, language, stars) from the
 * fetched RepoData. build.ts injects the result into dist/index.html at the
 * HOMEPAGE_SECTIONS_PLACEHOLDER comment.
 *
 * Curated content (descriptions, labels, blurbs, hrefs) is trusted HTML and is
 * NOT escaped — only live GitHub-derived values are escaped via escapeHtml().
 */

import type { RepoData } from "./fetch-github-data";
import { escapeHtml } from "./generate-pages";
import { DEFAULT_SYMBOL, REPO_SYMBOLS } from "./repo-config";
import { HOMEPAGE_SECTIONS, type Section, type SubTile, type Tile, type TileAction } from "./homepage-config";

/** Maps a cross-cutting tag to the homepage section anchor it points at. */
const TAG_ANCHORS: Record<string, string> = {
	AI: "#ai",
	"Dev Tools": "#dev-tools",
	"Web Tools": "#web-tools",
	Virtualization: "#virtualization",
	Containers: "#containers",
	Scripts: "#scripts",
};

function isExternal(href: string, explicit?: boolean): boolean {
	return explicit ?? /^https?:\/\//.test(href);
}

function renderAction(a: TileAction): string {
	const cls = [a.style === "outline" ? "outline" : "", a.className ?? ""].filter(Boolean).join(" ");
	const target = isExternal(a.href, a.external) ? ' target="_blank" rel="noopener"' : "";
	return `<a href="${a.href}" role="button"${cls ? ` class="${cls}"` : ""}${target}>${a.label}</a>`;
}

function renderTags(tags: string[]): string {
	return tags
		.map((tag) => {
			const anchor = TAG_ANCHORS[tag];
			const inner = anchor ? `<a href="${anchor}">${tag}</a>` : tag;
			return ` <mark class="tag">${inner}</mark>`;
		})
		.join("");
}

function renderSubtiles(subtiles: SubTile[]): string {
	const items = subtiles
		.map((s) => {
			const target = isExternal(s.href, s.external) ? ' target="_blank" rel="noopener"' : "";
			const desc = s.description ? `<small>${s.description}</small>` : "";
			return `<a href="${s.href}"${target}><strong>${s.title}</strong>${desc}</a>`;
		})
		.join("\n                ");
	return `\n            <div class="subtile-grid">\n                ${items}\n            </div>`;
}

/** Live "⭐ stars · language" footer for repo-linked tiles. */
function renderRepoMeta(tile: Tile, repoMap: Map<string, RepoData>): string {
	if (tile.showRepoMeta === false || !tile.repo) return "";
	const repo = repoMap.get(tile.repo);
	if (!repo) return "";
	const symbol = REPO_SYMBOLS[tile.repo] ?? DEFAULT_SYMBOL;
	const lang = repo.language ? `<mark class="lang">${escapeHtml(repo.language)}</mark>` : "";
	return `\n            <footer class="tile-meta"><span class="tile-symbol">${symbol}</span>${lang}<span>⭐ ${repo.stars}</span></footer>`;
}

/** Resolve the title link: explicit href → repo page → first action → "#". */
function tileHref(tile: Tile, repoMap: Map<string, RepoData>): string {
	if (tile.href) return tile.href;
	if (tile.repo && repoMap.has(tile.repo)) return `p/${tile.repo}.html`;
	return tile.actions?.[0]?.href ?? "#";
}

function tileTitle(tile: Tile): string {
	return tile.title ?? tile.repo ?? "";
}

/** Compact card for the "other" grid (title + description only). */
function renderOtherTile(tile: Tile, repoMap: Map<string, RepoData>): string {
	const href = tileHref(tile, repoMap);
	const target = isExternal(href) ? ' target="_blank" rel="noopener"' : "";
	const badge = tile.isNew ? ' <mark class="new">NEW</mark>' : "";
	return `            <article>
                <h4><a href="${href}"${target}>${tileTitle(tile)}</a>${badge}</h4>
                <p>${tile.description}</p>
            </article>`;
}

/** Full feature card with actions, tags, sub-tiles, and live repo meta. */
function renderFeatureTile(tile: Tile, repoMap: Map<string, RepoData>): string {
	const href = tileHref(tile, repoMap);
	const target = isExternal(href) ? ' target="_blank" rel="noopener"' : "";
	const badge = tile.isNew ? ' <mark class="new">NEW</mark>' : "";
	const tags = tile.tags?.length ? renderTags(tile.tags) : "";
	const actions = tile.actions?.length
		? `\n            <div class="tile-actions">${tile.actions.map(renderAction).join("")}</div>`
		: "";
	const subtiles = tile.subtiles?.length ? renderSubtiles(tile.subtiles) : "";
	const detail = tile.detailHref
		? `\n            <p class="tile-detail"><a href="${tile.detailHref}">${tile.detailLabel ?? "Details &rarr;"}</a></p>`
		: "";
	const meta = renderRepoMeta(tile, repoMap);
	return `            <article>
                <header><h3><a href="${href}"${target}>${tileTitle(tile)}</a>${badge}${tags}</h3></header>
                <p>${tile.description}</p>${actions}${subtiles}${detail}${meta}
            </article>`;
}

function renderSection(section: Section, repoMap: Map<string, RepoData>): string {
	const mapLink = section.mapCategory
		? ` <a class="map-link" href="project-map.html?category=${encodeURIComponent(section.mapCategory)}">in map &rarr;</a>`
		: "";
	const blurb = section.blurb ? `\n        <p class="section-blurb">${section.blurb}</p>` : "";
	const gridClass = section.layout === "feature" ? "feature-grid" : "other-grid";
	const renderTile = section.layout === "feature" ? renderFeatureTile : renderOtherTile;
	const tiles = section.tiles.map((t) => renderTile(t, repoMap)).join("\n");
	return `    <section id="${section.id}">
        <h2 class="section-label">${section.title}${mapLink}</h2>${blurb}
        <div class="${gridClass}">
${tiles}
        </div>
    </section>`;
}

/** Render every homepage section to HTML for injection into index.html. */
export function renderHomepageSections(repos: RepoData[]): string {
	const repoMap = new Map(repos.map((r) => [r.name, r]));
	return HOMEPAGE_SECTIONS.map((s) => renderSection(s, repoMap)).join("\n\n");
}
