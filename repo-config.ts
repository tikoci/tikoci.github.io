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

    // === Development Tools ===
    "lsp-routeros-ts":    "\u2395",  // ⎕ quad — system function, language server
    "vscode-tikbook":     "\u235E",  // ⍞ quote-quad — interactive I/O, notebook
    "winbox-deb":         "\u2308",  // ⌈ ceiling — packaging/wrapping up

    // === Virtualization ===
    "mikropkl":           "\u235F",  // ⍟ circle star — PKL config, disk images
    "fat-chr":            "\u2338",  // ⌸ key — building CHR images
    "chr-utm":            "\u2283",  // ⊃ disclose — unpacking virtual machines

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
    },
    restraml: {
        category: "web-tools",
        externalLinks: [
            { label: "Schema Downloads", url: "https://tikoci.github.io/restraml/", style: "primary", description: "Browse & download RouterOS API schemas" },
            { label: "Command Lookup", url: "https://tikoci.github.io/restraml/lookup.html", style: "outline" },
            { label: "Schema Diff", url: "https://tikoci.github.io/restraml/diff.html", style: "outline" },
            { label: "API Explorer", url: "https://tikoci.github.io/restraml/openapi.html", style: "outline" },
            { label: "/app Editor", url: "https://tikoci.github.io/restraml/tikapp.html", style: "outline" },
            { label: "User Manual", url: "https://tikoci.github.io/restraml/app", style: "primary", description: "Full /app documentation" },
        ],
    },
    rosetta: {
        category: "dev-tools",
    },
    "lsp-routeros-ts": {
        category: "dev-tools",
        vscodeExtensionId: "TIKOCI.lsp-routeros-ts",
    },
    "vscode-tikbook": {
        category: "dev-tools",
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
    },
    nginx: {
        category: "containers",
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

    // API schema ecosystem
    { source: "restraml", target: "rosetta", type: "ecosystem" },
    { source: "restraml", target: "lsp-routeros-ts", type: "ecosystem" },

    // MCP/AI layer
    { source: "rosetta", target: "lsp-routeros-ts", type: "topic" },

    // Network scripts family
    { source: "netserver", target: "netinstall", type: "topic" },
];

/** Repos to exclude even if they have stars */
export const EXCLUDE_REPOS: string[] = [
    "tikoci.github.io",  // this site itself
    ".github",           // org config
];

/** Minimum star count to include a repo */
export const MIN_STARS = 1;
