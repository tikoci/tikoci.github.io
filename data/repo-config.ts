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
    /** What this repo is the place to look for, as short topics (domains,
     *  artifacts, formats). Feeds the generated tikoci-crossref house skill;
     *  the first entry is the repo's role. Not shown on the site. */
    owns?: string[];
    /** Files the repo publishes at stable URLs for other code to read; `<version>`
     *  stands for a RouterOS version. Feeds the tikoci-crossref "Published data"
     *  table. Not shown on the site. */
    publishedData?: { url: string; holds: string }[];
    /** Research, corpora, examples and protocol notes inside the repo, as paths
     *  on its default branch (a directory ends with "/"). Listed under "RouterOS
     *  internals" in tikoci-crossref. Not shown on the site. */
    reference?: { path: string; holds: string }[];
    /** tikoci-crossref section when it differs from `category`: a homepage
     *  category or a CROSSREF_EXTRA_SECTIONS id. The site keeps `category`. */
    crossrefGroup?: string;
}

/**
 * A curated edge between two repos. For "dependency" and
 * "artifact-consumption" readiness, `source` is the repo that provides and
 * `target` the repo that uses it; for associations the direction carries no
 * meaning. Edges with a verifiedNote feed the tikoci-crossref dependency
 * table.
 */
export interface Relationship {
    source: string;
    target: string;
    type: "dependency" | "ecosystem" | "sibling" | "topic";
    /** Readiness meaning for the dashboard. Defaults: "dependency" for
     *  dependency edges, "association" otherwise. "artifact-consumption"
     *  must always be set explicitly with a verifiedNote. */
    readiness?: "dependency" | "artifact-consumption" | "association";
    /** Evidence for the readiness claim (e.g. "child Dockerfiles build FROM
     *  the base image"). Absent = curated but unverified; the dashboard
     *  exports verified:false and derives no blockers from the edge. */
    verifiedNote?: string;
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
    "routeros-muse":      "\u2365",  // ⍥ over — an agent working across network tools

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
        owns: [
            "declarative RouterOS VMs from pkl manifests (UTM, QEMU)",
            "CHR VM bundles per RouterOS version",
        ],
        reference: [
            { path: "Lab/", holds: "QEMU and CHR experiments: guest agent, virtio-9p, arm64, direct kernel boot, extra NICs, NVRAM." },
        ],
        bonusDocs: ["Files/UTM.md", "Files/QEMU.md"],
        category: "virtualization",
        viewableFiles: ["Files/UTM.md", "Files/QEMU.md"],
    },
    "fat-chr": {
        owns: [
            "UEFI-bootable CHR images with extra packages",
            "CHR image releases per RouterOS version",
        ],
        category: "virtualization",
        metaDescription: "Build UEFI-bootable MikroTik RouterOS CHR images with extra-packages pre-installed — ready for QEMU, UTM, and other hypervisors by TIKOCI.",
        externalLinks: [
            { label: "UEFI CHR Releases", url: "https://github.com/tikoci/fat-chr/releases", style: "primary", description: "Download UEFI-bootable CHR images" },
        ],
    },
    "quickchr": {
        owns: [
            "disposable CHR VMs on QEMU, as a CLI and a Bun library",
            "CHR test labs: networking, provisioning, licenses",
            "the RouterOS versions tested on CHR",
        ],
        reference: [
            { path: "examples/", holds: "Runnable CLI and library examples against real CHRs: CMR, device-mode, Dude, MNDP, file transfer, version matrix (`COVERAGE.md` maps them)." },
        ],
        category: "virtualization",
        externalLinks: [
            { label: "GitHub", url: "https://github.com/tikoci/quickchr", style: "primary", description: "Source, releases, and docs" },
        ],
    },
    "donny": {
        owns: [
            "The Dude database (`dude.db`)",
        ],
        category: "dev-tools",
        externalLinks: [
            { label: "GitHub", url: "https://github.com/tikoci/donny", style: "primary", description: "Source and releases" },
        ],
    },
    restraml: {
        owns: [
            "RouterOS command trees per version (`inspect.json`)",
            "RAML and OpenAPI schemas for the REST API",
            "`/app` YAML JSON schemas",
            "web tools: command lookup, schema diff, API explorer, `/app` editor",
        ],
        reference: [
            { path: "docs/deep-inspect.md", holds: "How the per-architecture deep-inspect trees are built, and what was learned shipping them." },
            { path: "docs/mikrotik-bug-native-api-inspect.md", holds: "`/console/inspect` completion non-determinism over the native API, with the workaround." },
        ],
        publishedData: [
            { url: "https://tikoci.github.io/restraml/docs-index.json", holds: "Index of the published files, with `latestVersion` and `latestStableVersion`." },
            { url: "https://tikoci.github.io/restraml/<version>/inspect.json", holds: "Command tree for the base packages; `<version>/extra/` has the same files for all x86 extra packages." },
            { url: "https://tikoci.github.io/restraml/<version>/deep-inspect.json", holds: "Command tree enriched with completion metadata (format: `deep-inspect.schema.json`); `extra/` adds per-architecture trees and their diff." },
            { url: "https://tikoci.github.io/restraml/<version>/schema.raml", holds: "RAML 1.0 schema of the REST API; `openapi.json` beside it is OpenAPI 3.0 where generated." },
            { url: "https://tikoci.github.io/restraml/<version>/app.json", holds: "The built-in `/app` list as the router reports it." },
            { url: "https://tikoci.github.io/restraml/routeros-app-yaml-schema.latest.json", holds: "`/app` YAML JSON schema (and `-store-schema`, `.editor.json` variants); per version under `<version>/`." },
        ],
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
        owns: [
            "RouterOS documentation search as an MCP server (SQLite FTS)",
            "the `ros-help.db` docs database: pages, commands, devices, changelogs",
        ],
        reference: [
            { path: "briefings/", holds: "Grounded research notes and decision memos." },
        ],
        category: "ai",
        externalLinks: [
            { label: "Latest Release", url: "https://github.com/tikoci/rosetta/releases/latest", style: "primary", description: "Current build & changelog" },
            { label: "Current Database", url: "https://github.com/tikoci/rosetta/releases/latest/download/ros-help.db.gz", style: "outline", description: "Download ros-help.db.gz" },
        ],
    },
    "routeros-skills": {
        owns: [
            "public `routeros-*` agent skills: using RouterOS and tikoci tools",
        ],
        reference: [
            { path: "routeros-proprietary-protocols/SKILL.md", holds: "Index of MikroTik protocols and file formats, by port, EtherType or artifact, with known docs and implementations." },
        ],
        category: "ai",
        externalLinks: [
            { label: "Latest Release", url: "https://github.com/tikoci/routeros-skills/releases", style: "primary", description: "Releases on GitHub" },
            { label: "SkillStore.io", url: "https://skillstore.io/skills?q=tikoci", style: "outline", description: "Published on SkillStore" },
        ],
    },
    "routeros-muse": {
        owns: [
            "an agent workspace and web UI for RouterOS networks (preview)",
        ],
        category: "ai",
        tagline: "Preview RouterOS network workspace and web UI for Meta Muse Code",
        externalLinks: [
            { label: "GitHub", url: "https://github.com/tikoci/routeros-muse", style: "primary", description: "Preview source and getting started" },
        ],
    },
    "lsp-routeros-ts": {
        owns: [
            "the RouterOS script language server (LSP)",
            "a RouterOS script corpus (`test-data/corpus.sqlite`)",
        ],
        reference: [
            { path: "test-data/", holds: "RouterOS script corpus (forum, eworm, tangentsoft and TikBook scripts, live captures), indexed into `corpus.sqlite`; contract in `docs/corpus.md`." },
            { path: "docs/syntax-inspection-map.md", holds: "Which live probe (`/console/inspect` highlight, completion, `:parse`) answers which syntax question." },
            { path: "docs/parseil-format.md", holds: "The `:parse` intermediate language; `highlight-format.md` beside it covers highlight tokens." },
        ],
        category: "dev-tools",
        metaDescription: "RouterOS Language Server (LSP) for VS Code, NeoVim, and other editors — syntax checking and accurate code completions for MikroTik scripting.",
        vscodeExtensionId: "TIKOCI.lsp-routeros-ts",
    },
    "vscode-tikbook": {
        owns: [
            "VS Code notebooks for RouterOS scripts",
            "`/app` YAML editing in VS Code",
        ],
        reference: [
            { path: "test-corpus/discourse-bookmarks/", holds: "RouterOS scripts collected from MikroTik forum posts." },
            { path: "docs/research/", holds: "Research notes: `/console/inspect` API patterns, CHR in VS Code, restraml integration." },
        ],
        category: "dev-tools",
        metaDescription: "TikBook adds MikroTik RouterOS notebook support to VS Code — write, run, and share RouterOS scripts as interactive cells from your editor.",
        vscodeExtensionId: "TIKOCI.tikbook",
    },
    "winbox-deb": {
        owns: [
            "the WinBox 4 Debian package",
        ],
        category: "dev-tools",
    },
    "make.d": {
        owns: [
            "an Alpine `/container` base managed by `make`",
        ],
        category: "containers",
        dockerImages: ["ammo74/make.d", "ammo74/make.d-max"],
    },
    netinstall: {
        owns: [
            "netinstall in a `/container` or with `make`",
        ],
        category: "containers",
        dockerImages: ["ammo74/netinstall"],
    },
    serial2http: {
        owns: [
            "a serial port over HTTP (RFC 2217) container",
        ],
        category: "containers",
        dockerImages: ["ammo74/serial2http"],
    },
    cligames: {
        owns: [
            "CLI games over telnet in a container",
        ],
        category: "containers",
        dockerImages: ["ammo74/cligames"],
    },
    "mikrotik-gpl": {
        owns: [
            "RouterOS GPL source requests and snapshots",
        ],
        category: "scripts",
        crossrefGroup: "internals",
    },
    "chr-utm": {
        owns: [
            "CHR as a UTM bundle for Intel macOS",
        ],
        category: "virtualization",
        metaDescription: "Run MikroTik RouterOS as a VM on Intel macOS — pre-built UTM bundle for Cloud Hosted Router (CHR) with networking support included by TIKOCI.",
    },
    nginx: {
        owns: [
            "an nginx container with CORS and X.509",
        ],
        category: "containers",
        metaDescription: "nginx container for MikroTik RouterOS with CORS headers and X.509 certificate handling — deploy as a reverse proxy using the RouterOS /container subsystem.",
    },
    "traefik-wabt": {
        owns: [
            "a Traefik container for Wasm plugin experiments",
        ],
        category: "containers",
    },
    "traefik-wasm-grain": {
        owns: [
            "a Traefik Wasm plugin written in Grain",
        ],
        category: "containers",
        externalLinks: [
            { label: "Traefik Plugin Catalog", url: "https://plugins.traefik.io/plugins/666374dee8d831193077b35b/example-wasm-plugin-using-grain", style: "primary", description: "Published on the official Traefik plugin marketplace" },
        ],
    },
    netserver: {
        owns: [
            "netperf's `netserver` for Flent speed tests, as a container",
        ],
        category: "scripts",
        crossrefGroup: "containers",
    },
    adventure: {
        owns: [
            "Colossal Cave Adventure in a container",
        ],
        category: "containers",
    },
    wargames: {
        owns: [
            "the WarGames simulator in a container",
        ],
        category: "containers",
    },
    centrs: {
        owns: [
            "RouterOS device access as a CLI and library: REST, native API, SSH, MAC-Telnet, MNDP",
            "checking a RouterOS command before it runs (`centrs explain`)",
            "the WinBox address book (CDB) and router credentials",
        ],
        reference: [
            { path: "commands/", holds: "Each command's executable spec: a README with protocol notes (MAC-Telnet, btest, MNDP, WinBox CDB) and examples mapped to tests." },
            { path: "docs/MATRIX.md", holds: "Capability status per command and protocol." },
        ],
        category: "dev-tools",
        tagline: "Multi-protocol RouterOS API library for TypeScript with built-in CLI",
    },
    "bench-routeros-tools": {
        owns: [
            "benchmarks of agent RouterOS tooling: MCPs, skills, retrieval",
        ],
        reference: [
            { path: "REPORT.md", holds: "Benchmark results across MCPs, skills and retrieval." },
        ],
        category: "ai",
        tagline: "Benchmark AI agent RouterOS support across MCPs, skills, and retrieval",
        externalLinks: [
            { label: "GitHub", url: "https://github.com/tikoci/bench-routeros-tools", style: "primary", description: "Benchmarks and results" },
        ],
    },
    m2ir: {
        owns: [
            "RouterOS binary protocols and formats as a YAML schema: M2 (`nv::message`), WinBox, CDB, MNDP, RoMON, the Dude store",
        ],
        category: "dev-tools",
        crossrefGroup: "internals",
    },
    "app-t3code": {
        owns: ["a RouterOS `/app` container for T3 Code"],
        category: "containers",
    },
    enbeep: {
        owns: ["a web page that decodes a router's MAC and IP from its beeper (experiment)"],
        category: "web-tools",
    },
};

/**
 * tikoci-crossref sections beyond the homepage categories, after them in this
 * order. A repo joins one through `crossrefGroup`.
 */
export const CROSSREF_EXTRA_SECTIONS: { id: string; title: string; intro: string }[] = [
    {
        id: "internals",
        title: "RouterOS internals",
        intro: "Reference repos for how RouterOS works inside, then the research, corpora, examples and protocol notes kept in other repos.",
    },
];

/**
 * Topic → repo pairs the tikoci-crossref description names, in order, so the
 * skill listing alone routes the most common cross-repo questions. Keep the
 * topics short: every character counts against the house description budget.
 */
export const CROSSREF_HEADLINES: Record<string, string> = {
    "CHR VMs": "quickchr",
    "device access": "centrs",
    "command schemas": "restraml",
    "docs search": "rosetta",
    "script LSP": "lsp-routeros-ts",
    "agent skills": "routeros-skills",
    "binary protocols": "m2ir",
};

/** Graph edges between repos */
export const RELATIONSHIPS: Relationship[] = [
    // make.d lineage: a shared concept/recipes, not a build dependency —
    // the consumers' Dockerfiles build FROM stock bases and no Makefile or
    // workflow references make.d (surveyed 2026-10-28). Association on the
    // dashboard; `type` keeps the map's visual styling untouched.
    { source: "make.d", target: "netinstall", type: "dependency", readiness: "association" },
    { source: "make.d", target: "serial2http", type: "dependency", readiness: "association" },
    { source: "make.d", target: "cligames", type: "dependency", readiness: "association" },
    { source: "make.d", target: "nginx", type: "dependency", readiness: "association" },

    // Traefik Wasm siblings
    { source: "traefik-wabt", target: "traefik-wasm-grain", type: "sibling" },

    // CLI game forks (adventure & wargames share a theme)
    { source: "adventure", target: "wargames", type: "sibling" },
    { source: "adventure", target: "cligames", type: "topic" },
    { source: "wargames", target: "cligames", type: "topic" },

    // VSCode ecosystem
    { source: "lsp-routeros-ts", target: "vscode-tikbook", type: "sibling" },

    // Virtualization family
    { source: "fat-chr", target: "mikropkl", type: "sibling", readiness: "artifact-consumption",
      verifiedNote: "mikropkl's Manifests/chr.x86_64.apple.pkl downloads the fat-chr release image (surveyed 2026-11-18)" },
    { source: "mikropkl", target: "chr-utm", type: "sibling" },
    { source: "quickchr", target: "fat-chr", type: "sibling" },
    { source: "quickchr", target: "mikropkl", type: "ecosystem" },

    // quickchr boots the CHRs other repos test and build against
    { source: "quickchr", target: "restraml", type: "dependency", readiness: "dependency",
      verifiedNote: "restraml's scripts/deep-inspect-multi-arch.ts boots its per-architecture CHRs with @tikoci/quickchr (devDependency; surveyed 2026-11-18)" },
    { source: "quickchr", target: "centrs", type: "dependency", readiness: "dependency",
      verifiedNote: "centrs's src/resolver/quickchr-provider.ts loads @tikoci/quickchr (optionalDependency) to resolve --quickchr targets; its CHR tests use it too (surveyed 2026-11-18)" },
    { source: "quickchr", target: "rosetta", type: "dependency", readiness: "dependency",
      verifiedNote: "rosetta's app-integration.yml installs @tikoci/quickchr and scripts/app-integration.ts boots CHRs with it (surveyed 2026-11-18)" },
    { source: "quickchr", target: "app-t3code", type: "dependency", readiness: "dependency",
      verifiedNote: "app-t3code's Dockerfile installs @tikoci/quickchr into the shipped image (surveyed 2026-11-18)" },
    { source: "quickchr", target: "m2ir", type: "dependency", readiness: "dependency",
      verifiedNote: "m2ir's probe harnesses boot CHRs with @tikoci/quickchr (devDependency; surveyed 2026-11-18)" },

    // API schema ecosystem: restraml publishes per-version trees on its Pages site
    { source: "restraml", target: "rosetta", type: "ecosystem", readiness: "artifact-consumption",
      verifiedNote: "rosetta's src/restraml.ts reads inspect.json per version from restraml's Pages site (surveyed 2026-11-18)" },
    { source: "restraml", target: "centrs", type: "ecosystem", readiness: "artifact-consumption",
      verifiedNote: "centrs's scripts/restraml-trees.ts pins restraml command trees for the explain catalog (surveyed 2026-11-18)" },
    { source: "restraml", target: "vscode-tikbook", type: "ecosystem", readiness: "artifact-consumption",
      verifiedNote: "vscode-tikbook bundles restraml's /app YAML JSON schemas in resources/schemas/ (read by src/app-yaml.ts) and names their Pages URLs in the $schema comment of new files (surveyed 2026-11-18)" },
    { source: "restraml", target: "lsp-routeros-ts", type: "ecosystem", readiness: "artifact-consumption",
      verifiedNote: "lsp-routeros-ts's scripts/collect-required-args.ts reads restraml's per-version schema from a restraml checkout's docs/ by default (surveyed 2026-11-18)" },
    { source: "rosetta", target: "restraml", type: "ecosystem", readiness: "artifact-consumption",
      verifiedNote: "restraml's OpenAPI workflows download rosetta's latest ros-help.db.gz to add documentation (surveyed 2026-11-18)" },

    // MCP/AI layer
    { source: "rosetta", target: "lsp-routeros-ts", type: "topic" },
    { source: "routeros-skills", target: "rosetta", type: "ecosystem", readiness: "artifact-consumption",
      verifiedNote: "rosetta's src/extract-skills.ts fetches the routeros-skills SKILL.md files during its release workflow (surveyed 2026-11-18)" },
    { source: "routeros-skills", target: "donny", type: "sibling" },

    // RouterOS Muse builds on the published libraries
    { source: "quickchr", target: "routeros-muse", type: "ecosystem", readiness: "dependency",
      verifiedNote: "routeros-muse's package.json depends on @tikoci/quickchr@next (surveyed 2026-11-18)" },
    { source: "centrs", target: "routeros-muse", type: "ecosystem", readiness: "dependency",
      verifiedNote: "routeros-muse's package.json depends on @tikoci/centrs@next (surveyed 2026-11-18)" },
    { source: "rosetta", target: "routeros-muse", type: "ecosystem", readiness: "dependency",
      verifiedNote: "routeros-muse's package.json depends on @tikoci/rosetta@next (surveyed 2026-11-18)" },
    { source: "routeros-skills", target: "routeros-muse", type: "ecosystem", readiness: "dependency",
      verifiedNote: "routeros-muse's package.json pins routeros-skills by commit and src/lib/routeros-skills.ts reads its SKILL.md files (surveyed 2026-11-18)" },
    { source: "centrs", target: "app-t3code", type: "dependency", readiness: "dependency",
      verifiedNote: "app-t3code's Dockerfile installs @tikoci/centrs into the shipped image (surveyed 2026-11-18)" },

    // Network scripts family
    { source: "netserver", target: "netinstall", type: "topic" },

    // TypeScript API layer
    { source: "centrs", target: "rosetta", type: "ecosystem" },
    { source: "lsp-routeros-ts", target: "centrs", type: "sibling", readiness: "artifact-consumption",
      verifiedNote: "centrs pins lsp-routeros-ts's test-data/corpus.sqlite by commit and SHA-256 for its explain census (surveyed 2026-11-18)" },

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

// ---------------------------------------------------------------------------
// Dashboard configuration (consumed by fetch-dashboard-data.ts)
// ---------------------------------------------------------------------------

/** Signal groups a repo can subscribe to. Not one-size-fits-all: each repo
 *  declares only the groups that answer "where we at" for it. */
export type DashboardGroup =
    | "ros-tracking"  // ROS versions built/published vs MikroTik channels
    | "ros-lag"       // derived-artifact version (e.g. ros-help.db) vs stable
    | "ci-health"     // latest run conclusion per tracked workflow
    | "community"     // open issues/PRs from non-owner, non-bot authors
    | "npm"           // registry publish state vs repo package.json
    | "releases";     // newest GitHub release tag/date

/** How to locate ROS versions (or a derived version) for a repo */
export interface RosLocator {
    kind: "github-tags" | "github-releases" | "contents-dirs" | "raw-json" | "raw-text";
    /** For contents-dirs/raw-*: path within the repo */
    path?: string;
    /** For raw-*: branch or ref to read from (default: "main") */
    ref?: string;
    /** Regex with a capture group (or full match) extracting "X.Y[.Z]" */
    pattern: string;
}

/** What a ros-tracking coverage list claims. "tagged" claims only that the
 *  version tag exists — it says nothing about build or test status (join
 *  with ci-health before calling a version "built"). "published" claims a
 *  versioned artifact was published (release, schema dir, source snapshot).
 *  "tested" claims the repo's own harness recorded the version as tested. */
export type RosCoverageKind = "tagged" | "published" | "tested";

export interface DashboardOverride {
    groups: DashboardGroup[];
    /** ROS coverage locator (required for ros-tracking) */
    rosLocator?: RosLocator;
    /** What ros-tracking coverage claims for this repo (default: "published") */
    rosCoverageKind?: RosCoverageKind;
    /** MikroTik channels this repo is expected to cover (default: ROS_CHANNELS).
     *  Only expected channels yield missing-channel findings. */
    rosChannels?: string[];
    /** Artifact-version locator (required for ros-lag; e.g. rosetta DB manifest) */
    rosLagLocator?: RosLocator;
    /** Workflow file basenames to track, e.g. ["auto.yaml"] (for ci-health) */
    trackedWorkflows?: string[];
    /** npm registry package name, e.g. "@tikoci/centrs" (for npm) */
    npmPackage?: string;
    /** Whether the package is expected on npm (default: true). When false,
     *  confirmed absence is recorded in the signal but raises no finding. */
    npmExpected?: boolean;
    /** Path to the package.json that produces npmPackage (default: "package.json").
     *  Needed when the published artifact lives in a subdirectory. */
    npmPackagePath?: string;
}

/** MikroTik release channels polled as ROS ground truth */
export const ROS_CHANNELS = ["stable", "testing", "development", "long-term"];

/** Authors excluded from the community signal (owners); bots always excluded */
export const COMMUNITY_EXCLUDE_AUTHORS = ["Amm0Bot", "mobileskyfi"];

/** Matches a bare ROS version: 7.25, 7.24.5, 7.26beta4, 7.25rc1 */
const ROS_VERSION = String.raw`^(\d+\.\d+(?:\.\d+)?(?:beta\d+|rc\d+)?)$`;

/**
 * Per-repo dashboard coverage (surveyed 2026-10-28).
 *
 * Signal groups are deliberately per-repo, not uniform: each entry declares
 * only what answers "where we at" for that repo. Conventions:
 *   - trackedWorkflows match by workflow display name, or by path suffix
 *     when the workflow has no display name (e.g. make.d's build.yaml).
 *     Path-suffix matching uses endsWith, so suffix entries must include
 *     the extension ("build.yaml", never bare "build").
 *   - Poller workflows (issue #14) are always tracked where present.
 *   - Never-run / noise-only workflows are omitted (serial2http, bench, m2ir
 *     have no ci-health group for that reason).
 */
export const DASHBOARD_REPOS: Record<string, DashboardOverride> = {
    // === ROS version trackers (issue #14 pollers) ===
    restraml: {
        // No tags/releases — coverage comes from version dirs under docs/
        groups: ["ros-tracking", "ci-health", "community"],
        rosLocator: { kind: "contents-dirs", path: "docs", pattern: ROS_VERSION },
        trackedWorkflows: ["Auto-Build New RouterOS Versions", "Build: Base Schema", "Build: Deep-Inspect Multi-Arch"],
    },
    mikropkl: {
        groups: ["ros-tracking", "ci-health", "community", "releases"],
        rosLocator: { kind: "github-tags", pattern: String.raw`^chr-(\d+\.\d+(?:\.\d+)?(?:beta\d+|rc\d+)?)$` },
        // Tags only — join with the Streamlined Build CI state before
        // calling a version "built".
        rosCoverageKind: "tagged",
        trackedWorkflows: ["Streamlined Build", "CHR Packages", "Tests"],
    },
    "fat-chr": {
        // Releases, NOT tags: the tags endpoint is polluted with BuildNNNNN-* CI tags
        groups: ["ros-tracking", "ci-health", "community", "releases"],
        rosLocator: { kind: "github-releases", pattern: ROS_VERSION },
        trackedWorkflows: ["Streamlined Build"],
    },
    quickchr: {
        // Coverage from tested-versions.json keys on the ci-data branch
        groups: ["ros-tracking", "ci-health", "community", "npm", "releases"],
        rosLocator: { kind: "raw-json", ref: "ci-data", path: "tested-versions.json", pattern: ROS_VERSION },
        rosCoverageKind: "tested",
        trackedWorkflows: ["CI", "Release", "RouterOS Versions"],
        npmPackage: "@tikoci/quickchr",
    },
    "mikrotik-gpl": {
        groups: ["ros-tracking", "ci-health", "community", "releases"],
        rosLocator: { kind: "github-tags", pattern: ROS_VERSION },
        // GPL source snapshots track releases, not prerelease channels
        rosChannels: ["stable", "long-term"],
        trackedWorkflows: ["Request GPL Source"],
    },
    // === Derived-version lag (no automatic cadence) ===
    rosetta: {
        // No rosLagLocator: rosetta publishes no machine-readable DB version
        // (see survey 2026-10-28). Signal reports honest unknown until the
        // rosetta-side versions.json manifest exists.
        groups: ["ros-lag", "ci-health", "community", "npm", "releases"],
        trackedWorkflows: ["Test", "Release", "QA", "Device Map Refresh"],
        npmPackage: "@tikoci/rosetta",
    },
    // === Published libraries ===
    centrs: {
        groups: ["ci-health", "community", "npm", "releases"],
        trackedWorkflows: ["CI", "Release", "QA"],
        npmPackage: "@tikoci/centrs",
    },
    "routeros-muse": {
        groups: ["ci-health", "community", "npm", "releases"],
        trackedWorkflows: ["CI", "Release"],
        npmPackage: "@tikoci/routeros-muse",
    },
    "lsp-routeros-ts": {
        // Published artifact is server/package.json (@tikoci/routeroslsp);
        // the root package is the vsix-only VS Code extension, not on npm.
        groups: ["ci-health", "community", "npm", "releases"],
        trackedWorkflows: ["CI", "Build and Release"],
        npmPackage: "@tikoci/routeroslsp",
        npmPackagePath: "server/package.json",
    },
    donny: {
        // Working code reused in part, not a library/CLI anyone installs —
        // absence from npm is correct (confirmed 2026-10-28), so it is
        // recorded but raises no finding.
        groups: ["ci-health", "community", "npm", "releases"],
        trackedWorkflows: ["CI"],
        npmPackage: "@tikoci/donny",
        npmExpected: false,
    },
    // === Editors, skills, containers, misc ===
    "vscode-tikbook": {
        groups: ["ci-health", "community", "releases"],
        trackedWorkflows: ["Build and Release", "Update GitHub Pages"],
    },
    "routeros-skills": {
        groups: ["ci-health", "community", "releases"],
        trackedWorkflows: ["CI"],
    },
    netinstall: {
        groups: ["ci-health", "community", "releases"],
        trackedWorkflows: ["repo-as-web"],
    },
    serial2http: {
        // build-on-commit has zero lifetime runs — no ci-health to track
        groups: ["community", "releases"],
    },
    "make.d": {
        // Workflow has no display name, so track by path suffix; red since March
        groups: ["ci-health", "community", "releases"],
        trackedWorkflows: ["build.yaml"],
    },
    "bench-routeros-tools": {
        // Noise-only workflows (CodeQL disabled, Dependency Review)
        groups: ["community", "releases"],
    },
    m2ir: {
        // No workflows at all
        groups: ["community", "releases"],
    },
};
