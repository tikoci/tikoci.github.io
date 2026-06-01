/**
 * repo-config.ts — Per-repo overrides and graph relationship definitions
 *
 * Curated metadata that can't be derived from the GitHub API:
 *   - bonusDocs: extra markdown/doc files to link on landing pages
 *   - relationships: edges between repos for the project map graph
 *   - exclude: repos to skip even if they meet the star threshold
 */

export interface ExternalLink {
    label: string;
    url: string;
    /** Button style: "primary" renders as solid, "outline" as outline (default: "outline") */
    style?: "primary" | "outline";
    /** Optional short description shown below the button */
    description?: string;
}

export interface RepoOverride {
    /** Extra markdown files in the repo to link as resources */
    bonusDocs?: string[];
    /** Short tagline override (when GitHub description is too long/vague) */
    tagline?: string;
    /** SEO meta description override (120–160 chars for Bing/Google) */
    metaDescription?: string;
    /** Category for graph clustering */
    category?: string;
    /** VS Code Marketplace extension ID (e.g. "TIKOCI.tikbook") — enables "Install in VS Code" button */
    vscodeExtensionId?: string;
    /** Docker Hub image names (e.g. ["ammo74/make.d"]) — enables Docker Hub links */
    dockerImages?: string[];
    /** External links/buttons shown in the actions area (catalogs, tools, manuals) */
    externalLinks?: ExternalLink[];
    /** Files to fetch at build time and make viewable in a modal on the landing page */
    viewableFiles?: string[];
}

export interface Relationship {
    source: string;
    target: string;
    type: "dependency" | "ecosystem" | "sibling" | "topic";
}

/**
 * APL-themed Unicode symbol for each project.
 *
 * The map is a creative project — symbols are chosen from APL's rich
 * operator set where each glyph has meaning that (loosely!) relates
 * to what the project does. Repos not listed get DEFAULT_SYMBOL.
 */
export const REPO_SYMBOLS: Record<string, string> = {
    // === API & Schema Tools ===
    "restraml":           "\u234B",  // ⍋ grade up — organizing API schemas
    "rosetta":            "\u2373",  // ⍳ iota/index of — MCP lookup/translation
    "routeros-skills":    "\u2261",  // ≡ depth/match — structured knowledge layers

    // === Development Tools ===
    "lsp-routeros-ts":    "\u2395",  // ⎕ quad — system function, language server
    "vscode-tikbook":     "\u235E",  // ⍞ quote-quad — interactive I/O, notebook
    "winbox-deb":         "\u2308",  // ⌈ ceiling — packaging/wrapping up

    // === Virtualization ===
    "mikropkl":           "\u235F",  // ⍟ circle star — PKL config, disk images
    "fat-chr":            "\u2338",  // ⌸ key — building CHR images
    "chr-utm":            "\u2283",  // ⊃ disclose — unpacking virtual machines
    "quickchr":           "\u234F",  // ⍏ up-tack overbar — boot/launch CHR
    "donny":              "\u2360",  // ⍠ quad colon — variant/configuration

    // === Containers ===
    "make.d":             "\u2218",  // ∘ jot/compose — Docker compose operator
    "netinstall":         "\u236B",  // ⍫ del stile — network install/execute
    "serial2http":        "\u2339",  // ⌹ domino — bridging serial↔HTTP
    "cligames":           "\u233A",  // ⌺ stencil — game board patterns
    "nginx":              "\u2282",  // ⊂ enclose — containing/proxying
    "traefik-wasm-grain": "\u233F",  // ⌿ reduce first — filtering middleware
    "traefik-wabt":       "\u234E",  // ⍎ execute — WebAssembly binary toolkit

    // === Scripts & Source ===
    "mikrotik-gpl":       "\u235D",  // ⍝ comment/lamp — illuminating source
    "netserver":          "\u2336",  // ⌶ I-beam — system operations

    // === Adventures (the "plants" 🌱) ===
    "adventure":          "\u2207",  // ∇ del/nabla — explore, descend into the unknown
    "wargames":           "\u2363",  // ⍣ power operator — shall we play a game?

    // === TypeScript/Python Developer Libraries ===
    "centrs":                "\u2355",  // ⍕ format — multi-protocol API surface
    "bench-routeros-tools":  "\u2374",  // ⍴ rho/shape — measuring and comparing strategies
};

/** Fallback symbol for repos not in the mapping */
export const DEFAULT_SYMBOL = "\u2370";  // ⍰ quad question — unknown, discover me

/** Per-repo overrides keyed by repo name */
export const REPO_OVERRIDES: Record<string, RepoOverride> = {
    mikropkl: {
        bonusDocs: ["Files/UTM.md", "Files/QEMU.md"],
        category: "virtualization",
        viewableFiles: ["Files/UTM.md", "Files/QEMU.md"],
    },
    "fat-chr": {
        category: "virtualization",
        metaDescription: "Build UEFI-bootable MikroTik RouterOS CHR images with extra-packages pre-installed — ready for QEMU, UTM, and other hypervisors by TIKOCI.",
        externalLinks: [
            { label: "UEFI CHR Releases", url: "https://github.com/tikoci/fat-chr/releases", style: "primary", description: "Download UEFI-bootable CHR images" },
        ],
    },
    "quickchr": {
        category: "virtualization",
        externalLinks: [
            { label: "GitHub", url: "https://github.com/tikoci/quickchr", style: "primary", description: "Source, releases, and docs" },
        ],
    },
    "donny": {
        category: "dev-tools",
        externalLinks: [
            { label: "GitHub", url: "https://github.com/tikoci/donny", style: "primary", description: "Source and releases" },
        ],
    },
    restraml: {
        category: "web-tools",
        externalLinks: [
            { label: "Schema Downloads", url: "https://tikoci.github.io/restraml/", style: "primary", description: "Browse & download RouterOS API schemas" },
            { label: "Command Lookup", url: "https://tikoci.github.io/restraml/lookup.html", style: "outline" },
            { label: "Schema Diff", url: "https://tikoci.github.io/restraml/diff.html", style: "outline" },
            { label: "API Explorer", url: "https://tikoci.github.io/restraml/openapi.html", style: "outline" },
            { label: "/app Editor", url: "https://tikoci.github.io/restraml/tikapp.html", style: "outline" },
            { label: "User Manual", url: "https://tikoci.github.io/restraml/tikapp-manual.html", style: "primary", description: "Full /app documentation" },
        ],
    },
    rosetta: {
        category: "ai",
        externalLinks: [
            { label: "Latest Release", url: "https://github.com/tikoci/rosetta/releases/latest", style: "primary", description: "Current build & changelog" },
            { label: "Current Database", url: "https://github.com/tikoci/rosetta/releases/latest/download/ros-help.db.gz", style: "outline", description: "Download ros-help.db.gz" },
        ],
    },
    "routeros-skills": {
        category: "ai",
        externalLinks: [
            { label: "Latest Release", url: "https://github.com/tikoci/routeros-skills/releases", style: "primary", description: "Releases on GitHub" },
            { label: "SkillStore.io", url: "https://skillstore.io/skills?q=tikoci", style: "outline", description: "Published on SkillStore" },
        ],
    },
    "lsp-routeros-ts": {
        category: "dev-tools",
        metaDescription: "RouterOS Language Server (LSP) for VS Code, NeoVim, and other editors — syntax checking and accurate code completions for MikroTik scripting.",
        vscodeExtensionId: "TIKOCI.lsp-routeros-ts",
    },
    "vscode-tikbook": {
        category: "dev-tools",
        metaDescription: "TikBook adds MikroTik RouterOS notebook support to VS Code — write, run, and share RouterOS scripts as interactive cells from your editor.",
        vscodeExtensionId: "TIKOCI.tikbook",
    },
    "winbox-deb": {
        category: "dev-tools",
    },
    "make.d": {
        category: "containers",
        dockerImages: ["ammo74/make.d", "ammo74/make.d-max"],
    },
    netinstall: {
        category: "containers",
        dockerImages: ["ammo74/netinstall"],
    },
    serial2http: {
        category: "containers",
        dockerImages: ["ammo74/serial2http"],
    },
    cligames: {
        category: "containers",
        dockerImages: ["ammo74/cligames"],
    },
    "mikrotik-gpl": {
        category: "scripts",
    },
    "chr-utm": {
        category: "virtualization",
        metaDescription: "Run MikroTik RouterOS as a VM on Intel macOS — pre-built UTM bundle for Cloud Hosted Router (CHR) with networking support included by TIKOCI.",
    },
    nginx: {
        category: "containers",
        metaDescription: "nginx container for MikroTik RouterOS with CORS headers and X.509 certificate handling — deploy as a reverse proxy using the RouterOS /container subsystem.",
    },
    "traefik-wabt": {
        category: "containers",
    },
    "traefik-wasm-grain": {
        category: "containers",
        externalLinks: [
            { label: "Traefik Plugin Catalog", url: "https://plugins.traefik.io/plugins/666374dee8d831193077b35b/example-wasm-plugin-using-grain", style: "primary", description: "Published on the official Traefik plugin marketplace" },
        ],
    },
    netserver: {
        category: "scripts",
    },
    adventure: {
        category: "containers",
    },
    wargames: {
        category: "containers",
    },
    centrs: {
        category: "dev-tools",
        tagline: "Multi-protocol RouterOS API library for TypeScript with built-in CLI",
    },
    "bench-routeros-tools": {
        category: "ai",
        tagline: "Benchmark AI agent RouterOS support across MCPs, skills, and retrieval",
        externalLinks: [
            { label: "GitHub", url: "https://github.com/tikoci/bench-routeros-tools", style: "primary", description: "Benchmarks and results" },
        ],
    },
};

/** Graph edges between repos */
export const RELATIONSHIPS: Relationship[] = [
    // Container base → children
    { source: "make.d", target: "netinstall", type: "dependency" },
    { source: "make.d", target: "serial2http", type: "dependency" },
    { source: "make.d", target: "cligames", type: "dependency" },
    { source: "make.d", target: "nginx", type: "dependency" },

    // Traefik Wasm siblings
    { source: "traefik-wabt", target: "traefik-wasm-grain", type: "sibling" },

    // CLI game forks (adventure & wargames share a theme)
    { source: "adventure", target: "wargames", type: "sibling" },
    { source: "adventure", target: "cligames", type: "topic" },
    { source: "wargames", target: "cligames", type: "topic" },

    // VSCode ecosystem
    { source: "lsp-routeros-ts", target: "vscode-tikbook", type: "sibling" },

    // Virtualization family
    { source: "mikropkl", target: "fat-chr", type: "sibling" },
    { source: "mikropkl", target: "chr-utm", type: "sibling" },
    { source: "quickchr", target: "fat-chr", type: "sibling" },
    { source: "quickchr", target: "mikropkl", type: "ecosystem" },

    // API schema ecosystem
    { source: "restraml", target: "rosetta", type: "ecosystem" },
    { source: "restraml", target: "lsp-routeros-ts", type: "ecosystem" },

    // MCP/AI layer
    { source: "rosetta", target: "lsp-routeros-ts", type: "topic" },
    { source: "rosetta", target: "routeros-skills", type: "ecosystem" },
    { source: "routeros-skills", target: "donny", type: "sibling" },

    // Network scripts family
    { source: "netserver", target: "netinstall", type: "topic" },

    // TypeScript API layer
    { source: "centrs", target: "rosetta", type: "ecosystem" },
    { source: "centrs", target: "lsp-routeros-ts", type: "sibling" },

    // AI benchmarking
    { source: "bench-routeros-tools", target: "rosetta", type: "topic" },
    { source: "bench-routeros-tools", target: "routeros-skills", type: "topic" },
];

/** Repos to exclude even if they have stars */
export const EXCLUDE_REPOS: string[] = [
    "tikoci.github.io",  // this site itself
    ".github",           // org config
];

/** Minimum star count to include a repo */
export const MIN_STARS = 1;
