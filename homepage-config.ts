/**
 * homepage-config.ts — Data-driven homepage catalog
 *
 * Defines the section/tile structure for the homepage. Rendered to HTML at
 * build time by generate-homepage.ts and injected into src/index.html (see
 * the HOMEPAGE_SECTIONS_PLACEHOLDER in that file).
 *
 * Descriptions, labels, and blurbs are CURATED, author-controlled HTML — they
 * intentionally contain inline markup (<code>, <kbd>, <strong>, &mdash;, SVG)
 * and are NOT escaped by the renderer. Only live GitHub-derived values (repo
 * name, language, star counts) are escaped. This mirrors how generate-pages.ts
 * already injects ExternalLink labels.
 *
 * Tiles that set `repo` are enriched at build time with live data (APL symbol,
 * primary language, star count) from the fetched RepoData.
 */

/** A clickable action button inside a tile (reuses .tile-actions styling). */
export interface TileAction {
	/** Curated label — may contain inline HTML (e.g. an SVG icon). */
	label: string;
	href: string;
	/** "primary" = solid button (default), "outline" = outline. */
	style?: "primary" | "outline";
	/** Open in a new tab. Default: auto-detected from an http(s) href. */
	external?: boolean;
	/** Extra class on the <a>, e.g. "install-vscode-btn". */
	className?: string;
}

/** A compact sub-project link shown under an umbrella tile (e.g. restraml). */
export interface SubTile {
	title: string;
	href: string;
	/** Curated one-liner shown under the sub-tile title. */
	description?: string;
	external?: boolean;
}

export interface Tile {
	/** Display title. Falls back to the repo name when omitted and `repo` is set. */
	title?: string;
	/** Repo name — links the title to p/{repo}.html AND enriches with live data. */
	repo?: string;
	/** Override the title link target (else: p/{repo}.html, else first action href). */
	href?: string;
	/** Curated description — trusted inline HTML. */
	description: string;
	/** Show the "NEW" marker next to the title. */
	isNew?: boolean;
	/** Cross-cutting membership tags — rendered as mark.tag badges that deep-link
	 *  to the relevant section (see TAG_ANCHORS in generate-homepage.ts). */
	tags?: string[];
	actions?: TileAction[];
	/** Optional ".tile-detail" link below the tile. */
	detailHref?: string;
	detailLabel?: string;
	/** Umbrella sub-projects, rendered as a nested .subtile-grid. */
	subtiles?: SubTile[];
	/** Show the live stars/symbol/language footer. Default: true when `repo` is set. */
	showRepoMeta?: boolean;
}

export interface Section {
	/** Anchor id (e.g. "ai"). */
	id: string;
	title: string;
	/** Optional one-line blurb under the heading (trusted inline HTML). */
	blurb?: string;
	/** "feature" → 2-col .feature-grid, "other" → compact .other-grid. */
	layout: "feature" | "other";
	/** Repo category to deep-link the heading to the filtered project map. */
	mapCategory?: string;
	tiles: Tile[];
}

/** Shared SVG icon markup for the "Install in VS Code" action label. */
const VSCODE_ICON =
	'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.986V4.014a1.5 1.5 0 0 0-.85-1.427zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>';

export const HOMEPAGE_SECTIONS: Section[] = [
	{
		id: "ai",
		title: "AI &amp; Agents",
		blurb:
			"MCP servers, agent skills, and benchmarks that teach AI assistants RouterOS &mdash; plus browser tools that speak <kbd>WebMCP</kbd>.",
		layout: "feature",
		mapCategory: "ai",
		tiles: [
			{
				repo: "rosetta",
				title: "rosetta",
				isNew: true,
				description:
					"MCP server for MikroTik docs. Gives AI assistants searchable access to 317 pages, 4,800+ properties, and 40,000 commands &mdash; via SQLite FTS5.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/rosetta" },
					{ label: "Releases", href: "https://github.com/tikoci/rosetta/releases", style: "outline" },
				],
			},
			{
				repo: "routeros-skills",
				title: "routeros-skills",
				description:
					"Drop-in <kbd>SKILL.md</kbd> files for GitHub Copilot and Claude &mdash; RouterOS fundamentals, containers, QEMU CHR, command tree, and more.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/routeros-skills" },
					{ label: "SkillStore", href: "https://skillstore.io/skills?q=tikoci", style: "outline" },
				],
			},
			{
				repo: "bench-routeros-tools",
				title: "bench-routeros-tools",
				isNew: true,
				description:
					"Benchmarks RouterOS AI agent-support strategies across MCPs, skills, and retrieval &mdash; comparing how different AI tooling configurations handle RouterOS tasks.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/bench-routeros-tools" },
				],
			},
			{
				title: "WebMCP in the Browser",
				href: "https://tikoci.github.io/restraml/",
				description:
					"The restraml web tools and the RouterOS LSP expose <kbd>WebMCP</kbd> &mdash; so an AI agent can drive the <code>/app</code> editor, schema lookup, and version diffs directly in a browser tab.",
				tags: ["Web Tools", "Dev Tools"],
				actions: [
					{ label: "Open Web Tools", href: "https://tikoci.github.io/restraml/" },
				],
			},
		],
	},
	{
		id: "dev-tools",
		title: "Editor &amp; Language Tools",
		blurb: "RouterOS with editor smarts &mdash; language servers, extensions, and client libraries.",
		layout: "feature",
		mapCategory: "dev-tools",
		tiles: [
			{
				title: "VSCode Extensions",
				href: "dev-tools.html",
				description:
					"Write RouterOS with confidence. Completions, diagnostics, and notebooks &mdash; connected to your live router.",
				tags: ["AI"],
				actions: [
					{ label: `${VSCODE_ICON} Install TikBook`, href: "vscode:extension/TIKOCI.tikbook", className: "install-vscode-btn" },
					{ label: "LSP only", href: "vscode:extension/TIKOCI.lsp-routeros-ts", style: "outline" },
				],
				detailHref: "dev-tools.html",
			},
			{
				repo: "centrs",
				title: "centrs",
				isNew: true,
				description:
					"Multi-protocol RouterOS API library for TypeScript. Unified interface across REST, WebSocket, and the binary API, with a ready-to-run CLI.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/centrs" },
				],
			},
			{
				repo: "donny",
				title: "donny",
				description:
					"TypeScript library and CLI for MikroTik The Dude &mdash; reads device topology, monitoring history, and network maps from The Dude&rsquo;s <code>dude.db</code> database.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/donny" },
				],
			},
			{
				repo: "winbox-deb",
				title: "winbox-deb",
				description: "WinBox 4.0 as a <kbd>.deb</kbd> for Linux. A packaging template more than a distribution.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/winbox-deb" },
				],
			},
		],
	},
	{
		id: "web-tools",
		title: "Web Tools &amp; API Schemas",
		blurb: "Browser-based RouterOS tooling, all powered by the restraml schema pipeline.",
		layout: "feature",
		mapCategory: "web-tools",
		tiles: [
			{
				repo: "restraml",
				title: "restraml",
				tags: ["AI"],
				description:
					"The engine behind the web tools. Generates RouterOS API schemas (RAML, OpenAPI) from live CHR instances via GitHub Actions &mdash; then powers a suite of browser tools.",
				actions: [
					{ label: "Schema Downloads", href: "https://tikoci.github.io/restraml/" },
				],
				subtiles: [
					{ title: "/app Editor", href: "https://tikoci.github.io/restraml/tikapp.html", description: "Write &amp; validate <code>/app</code> YAML with live schema checking.", external: true },
					{ title: "Schema Diff", href: "https://tikoci.github.io/restraml/diff.html", description: "Every change between two RouterOS versions.", external: true },
					{ title: "Command Lookup", href: "https://tikoci.github.io/restraml/lookup.html", description: "Search paths, params, and types &mdash; CLI to REST.", external: true },
					{ title: "API Explorer", href: "https://tikoci.github.io/restraml/openapi.html", description: "Browse 5,000+ REST endpoints interactively.", external: true },
					{ title: "REST API Schemas", href: "https://tikoci.github.io/restraml/", description: "Download versioned RAML &amp; OpenAPI schemas.", external: true },
				],
			},
		],
	},
	{
		id: "virtualization",
		title: "Virtualization &amp; CHR",
		blurb: "Boot RouterOS CHR anywhere &mdash; Mac, QEMU, and UEFI-strict platforms.",
		layout: "feature",
		mapCategory: "virtualization",
		tiles: [
			{
				repo: "quickchr",
				title: "quickchr",
				isNew: true,
				description:
					"Launch RouterOS CHR in QEMU with one command. Handles firmware, acceleration, and networking modes &mdash; then provisions and runs RouterOS CLI commands via REST.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/quickchr" },
				],
				detailHref: "p/quickchr.html",
			},
			{
				title: "CHR Images",
				href: "virtualization.html",
				description:
					"RouterOS CHR, ready to boot. One-click UTM images for Mac, UEFI-enabled raw images for everything else.",
				actions: [
					{ label: "UTM Downloads", href: "chr-images.html", style: "outline" },
					{ label: "UEFI Images", href: "https://github.com/tikoci/fat-chr/releases", style: "outline" },
				],
				detailHref: "virtualization.html",
				detailLabel: "Virtualization &rarr;",
			},
			{
				repo: "fat-chr",
				title: "fat-chr",
				description:
					"Rebuilds RouterOS CHR <code>.raw</code> images into UEFI-bootable images using a FAT EFI partition &mdash; required for UTM, Apple Silicon, and UEFI-strict platforms.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/fat-chr" },
				],
			},
		],
	},
	{
		id: "containers",
		title: "Containers",
		blurb: "RouterOS <code>/container</code> apps and the Alpine base that builds them.",
		layout: "feature",
		mapCategory: "containers",
		tiles: [
			{
				repo: "netinstall",
				title: "netinstall",
				description:
					"Flash MikroTik devices without a PC &mdash; <code>netinstall</code> runs as a RouterOS container, a macOS QEMU bridge, or natively on Linux. All automated by <code>make</code>.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/netinstall" },
					{ label: "DockerHub", href: "https://hub.docker.com/r/ammo74/netinstall", style: "outline" },
				],
				detailHref: "containers.html",
				detailLabel: "All containers &rarr;",
			},
			{
				repo: "make.d",
				title: "make.d",
				description:
					"Alpine multiprocess container base for RouterOS &mdash; bash completions, dev tools, TUI utilities, all managed by <code>mk</code>.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/make.d" },
				],
			},
			{
				repo: "serial2http",
				title: "serial2http",
				description: "HTTP bridge for RouterOS serial ports, packaged as a container.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/serial2http" },
				],
			},
			{
				repo: "cligames",
				title: "cligames",
				description: "30+ classic BSD games in a RouterOS container with a retro <code>telnet</code> interface.",
				actions: [
					{ label: "GitHub", href: "https://github.com/tikoci/cligames" },
				],
			},
		],
	},
	{
		id: "scripts",
		title: "RouterOS Scripts",
		blurb: "Copy-paste tools for the RouterOS terminal.",
		layout: "feature",
		mapCategory: "scripts",
		tiles: [
			{
				title: "Script Library",
				href: "scripts.html",
				description:
					"Copy-paste tools for the terminal. Visualize bridge VLANs, automate L3 setup, play piano with <code>:beep</code>.",
				actions: [
					{ label: "$lsbridge.rsc", href: "scripts/lsbridge.rsc", style: "outline" },
					{ label: "$autovlan.rsc", href: "scripts/autovlan.rsc", style: "outline" },
				],
				detailHref: "scripts.html",
				detailLabel: "All scripts &rarr;",
			},
		],
	},
	{
		id: "other",
		title: "Other Projects",
		layout: "other",
		tiles: [
			{
				title: "Observable Notebooks",
				href: "https://observablehq.com/collection/@a2m0/mikrotik",
				description: "MikroTik tools on Observable: UTF-8/emoji byte-escaping and CSV to RouterOS array types.",
			},
		],
	},
];
