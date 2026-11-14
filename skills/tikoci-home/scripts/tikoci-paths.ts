/**
 * Reference resolver for the tikoci-home layout (https://tikoci.dev/house/skills/tikoci-home/).
 *
 * Copy it into a tool, or write the same rules in the tool's own resolver; the
 * SKILL.md text is the contract and this file is one reading of it. It depends
 * only on node:crypto, node:fs, node:os and node:path, so it runs under Bun and
 * Node.
 *
 * Two scopes: the user scope (TIKOCI_HOME, default ~/.tikoci) and a project
 * scope (the nearest .tikoci/ above the working directory). Each tool owns
 * TOOL/ in each. In a project, .tikoci/TOOL/ travels with the directory and
 * .tikoci/TOOL/local/ never does: it is read only when it is private to this
 * user and the user trusted the project at this path. A git worktree uses its
 * main checkout's local/. A sandbox (TIKOCI_SANDBOX) replaces the user scope for
 * a test run. The host scope (~/.tikoci/host) belongs to the OS account and
 * moves with neither.
 *
 * The trust records here (TOOL/projects/ID/project.json) are one way to meet
 * the skill's trust rules, not a house format; where records live is open.
 *
 * Every function reads the environment it is given at call time. Pass `env`
 * (and `cwd`) explicitly from code that a test or another tool may call; never
 * resolve a path once at import and keep it.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir as osHomedir } from "node:os";
import { join, posix, win32 } from "node:path";

export type Env = Record<string, string | undefined>;

export interface ResolveOptions {
    /**
     * The environment to read. When it is omitted (or is process.env itself),
     * os.homedir() backs up a missing HOME and process.cwd() a missing cwd. A
     * caller-supplied env is taken literally: with no HOME (USERPROFILE on
     * Windows) and no TIKOCI_HOME it has no user scope, and with no cwd it
     * discovers no project, so nothing resolves to the developer's real files.
     */
    env?: Env;
    /** Where project discovery starts. Libraries take it from their caller and never read process.cwd(). */
    cwd?: string;
    platform?: NodeJS.Platform;
    /** Explicit fallback when HOME (USERPROFILE on Windows) is unset, even for a supplied env. */
    homedir?: () => string;
    /** The user a .tikoci/ must belong to on POSIX; defaults to process.getuid(). Tests set it. */
    uid?: number;
}

/** Where a resolved value came from: a variable name, "default", "discovered" or "sandbox". */
export type Source = string;

export interface TikociPaths {
    tool: string;
    /** The run is a sandbox (TIKOCI_SANDBOX), which replaces the user scope. */
    sandboxed: boolean;
    /** The user scope: the sandbox, else TIKOCI_HOME or its default; null when there is neither. */
    userScope: string | null;
    /** This tool's directory in the user scope: config, secrets, state, trust records. */
    toolDir: string | null;
    /** Runtime files: TIKOCI_RUNTIME_DIR/tool, else userScope/run/tool. */
    runtime: string | null;
    /** This tool's cache: TOOL_CACHE_DIR, else TIKOCI_CACHE_DIR/tool, else the user's (or the sandbox's) cache/tool. */
    cache: string | null;
    /**
     * Host-wide coordination for this OS account (port claims, the allocation
     * lock, managed-network records): ~/.tikoci/host/tool from the real home.
     * Neither TIKOCI_HOME nor TIKOCI_SANDBOX moves it, so sandboxes and moved
     * user scopes register in the same place. Null only when no home is known.
     */
    hostDir: string | null;
    /** The project: the directory holding .tikoci/, or null. Also the instance key for realized state. */
    project: string | null;
    /** project/.tikoci/tool: files that travel with the directory. */
    projectToolDir: string | null;
    /**
     * The project whose .tikoci/tool/local/ and trust this run uses: the project
     * itself, or, for a git worktree with no local/ of its own, the same .tikoci/
     * in its main checkout (same git common dir, same path inside the checkout).
     * When it differs from `project`, the worktree is trusted through it, and
     * the worktree's own traveling files are read as the main checkout's are.
     */
    localProject: string | null;
    /** localProject/.tikoci/tool/local: files that never travel; read only through checkProject(). */
    projectLocalDir: string | null;
    /** .tikoci/ directories the walk passed over (a symlink, another user's), to report rather than skip silently. */
    skipped: string[];
    /** May evict from `cache`: the user's own runs, or a sandbox whose cache is inside it. */
    evicts: boolean;
    /** May read the tool's pre-tikoci-home locations (no in a sandbox). */
    legacy: boolean;
    /** May use the OS keychain, Bun.secrets and similar (no in a sandbox). */
    keychain: boolean;
    /** May create, restart or remove host services (no in a sandbox, which may only attach to existing ones). */
    hostServices: boolean;
    /** Where each location came from, for effective-source reports. localProject is "self", "git-worktree" or "none". */
    sources: { userScope: Source; toolDir: Source; runtime: Source; cache: Source; project: Source; localProject: Source };
}

/** Bytes a Unix socket path may use: macOS sun_path is 104 including the NUL (Linux allows 108). */
export const SOCKET_PATH_MAX = 103;

/** Names in the user scope that are not tool names. */
export const RESERVED_NAMES = new Set(["cache", "run", "host"]);

const TOOL_NAME = /^[a-z][a-z0-9-]*$/;
const PROJECT_ID = /^[0-9a-f]{12}$/;

function checkTool(tool: string): void {
    if (!TOOL_NAME.test(tool) || RESERVED_NAMES.has(tool)) throw new Error(`tool name "${tool}" must match ${TOOL_NAME} and not be reserved`);
}

/** The prefix of a tool's own variables: routeros-muse → ROUTEROS_MUSE. */
export function toolVarPrefix(tool: string): string {
    checkTool(tool);
    return tool.toUpperCase().replaceAll("-", "_");
}

function pathFor(platform: NodeJS.Platform) {
    return platform === "win32" ? win32 : posix;
}

function nonEmpty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function isProcessEnv(options: ResolveOptions): boolean {
    return options.env === undefined || options.env === process.env;
}

/**
 * The user's home directory: HOME on POSIX, USERPROFILE on Windows. os.homedir()
 * backs it up only for the process environment; a supplied env without the
 * variable has no home (undefined).
 */
export function userHome(options: ResolveOptions = {}): string | undefined {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const fromEnv = platform === "win32" ? nonEmpty(env.USERPROFILE) : nonEmpty(env.HOME);
    if (fromEnv !== undefined) return fromEnv;
    if (options.homedir) return options.homedir();
    return isProcessEnv(options) ? osHomedir() : undefined;
}

function absoluteFromEnv(env: Env, name: string, platform: NodeJS.Platform): string | undefined {
    const value = nonEmpty(env[name]);
    if (value === undefined) return undefined;
    const path = pathFor(platform);
    // On Windows, "\x" is "absolute" but depends on the current drive: require a drive or UNC path.
    const absolute = platform === "win32" ? /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/])/.test(value) : path.isAbsolute(value);
    if (!absolute) throw new Error(`${name} must be an absolute path, got "${value}"`);
    return path.normalize(value);
}

/** The canonical form of an existing path (symlinks followed), else its resolved form. */
function canonical(target: string, platform: NodeJS.Platform): string {
    try {
        return realpathSync(target);
    } catch {
        return pathFor(platform).resolve(target);
    }
}

function samePath(a: string, b: string, platform: NodeJS.Platform): boolean {
    return platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isInside(root: string, target: string, platform: NodeJS.Platform): boolean {
    const path = pathFor(platform);
    const rel = path.relative(platform === "win32" ? root.toLowerCase() : root, platform === "win32" ? target.toLowerCase() : target);
    return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/**
 * The default user scope: ~/.tikoci on Linux and macOS, %LOCALAPPDATA%\tikoci on
 * Windows, where everything outside AppData\Local roams with the profile.
 */
export function defaultHome(options: ResolveOptions = {}): string | undefined {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const local = platform === "win32" ? nonEmpty(env.LOCALAPPDATA) : undefined;
    if (local !== undefined) return path.join(local, "tikoci");
    const home = userHome(options);
    if (home === undefined) return undefined;
    return platform === "win32" ? path.join(home, "AppData", "Local", "tikoci") : path.join(home, ".tikoci");
}

/** The user's own scope: TIKOCI_HOME, else defaultHome(). A sandbox does not change it. */
export function userRoot(options: ResolveOptions = {}): string | undefined {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    return absoluteFromEnv(env, "TIKOCI_HOME", platform) ?? defaultHome(options);
}

/**
 * The host scope: defaultHome()/host, from the account's real home. It follows
 * the OS account, not the run, so TIKOCI_HOME and TIKOCI_SANDBOX do not move it,
 * and a supplied env without HOME still falls back to os.homedir() here.
 */
export function hostRoot(options: ResolveOptions = {}): string | undefined {
    const platform = options.platform ?? process.platform;
    const home = defaultHome({ ...options, homedir: options.homedir ?? osHomedir });
    return home === undefined ? undefined : pathFor(platform).join(home, "host");
}

/** The cache root: TIKOCI_CACHE_DIR, else the user's cache/, else the sandbox's. */
export function cacheRoot(options: ResolveOptions = {}): string | undefined {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const base = userRoot(options) ?? absoluteFromEnv(env, "TIKOCI_SANDBOX", platform);
    return absoluteFromEnv(env, "TIKOCI_CACHE_DIR", platform) ?? (base === undefined ? undefined : pathFor(platform).join(base, "cache"));
}

function isRealDirectory(dir: string): boolean {
    try {
        const stat = lstatSync(dir);
        return stat.isDirectory() && !stat.isSymbolicLink();
    } catch {
        return false;
    }
}

function exists(target: string): boolean {
    try {
        lstatSync(target);
        return true;
    } catch {
        return false;
    }
}

/**
 * Whether a .tikoci/ can mark a project: "own" when it is a real directory and,
 * on POSIX, owned by the current user, as git's safe.directory asks; "skipped"
 * when it exists but is a symlink or another user's (one planted in /tmp, or a
 * share whose uid mapping hides the owner); "absent" otherwise.
 */
function classifyTikociDir(candidate: string, options: ResolveOptions): "own" | "skipped" | "absent" {
    let stat: ReturnType<typeof lstatSync>;
    try {
        stat = lstatSync(candidate);
    } catch {
        return "absent";
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) return "skipped";
    const platform = options.platform ?? process.platform;
    const uid = options.uid ?? (typeof process.getuid === "function" ? process.getuid() : undefined);
    return platform === "win32" || uid === undefined || stat.uid === uid ? "own" : "skipped";
}

/** Where discovery stopped and what it passed over. */
export interface Discovery {
    project: string | null;
    skipped: string[];
}

/**
 * Walk up from `cwd` to the nearest directory holding a real .tikoci/ directory
 * owned by the current user. The walk stops before the user's home directory,
 * so ~/.tikoci (the user scope) is never read as a project. A symlinked
 * .tikoci, or one owned by another user, is passed over and listed in
 * `skipped`. Paths are compared after symlinks are followed (and without case
 * on Windows), so an alias of the home directory stops the walk too. Every
 * tool stops at the nearest .tikoci/, whether or not it has a directory for
 * that tool, so tools in one run always agree on the project.
 */
export function findProject(cwd: string, options: ResolveOptions & { userScope?: string } = {}): Discovery {
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const skipped: string[] = [];
    const user = userHome(options);
    // With no known home there is no safe place to stop, so discover nothing.
    if (user === undefined) return { project: null, skipped };
    const stop = canonical(user, platform);
    const scope = options.userScope ? canonical(options.userScope, platform) : undefined;
    let dir = canonical(cwd, platform);
    while (true) {
        if (samePath(dir, stop, platform)) return { project: null, skipped };
        const candidate = path.join(dir, ".tikoci");
        if (!(scope && samePath(candidate, scope, platform))) {
            const kind = classifyTikociDir(candidate, options);
            if (kind === "own") return { project: dir, skipped };
            if (kind === "skipped") skipped.push(candidate);
        }
        const parent = path.dirname(dir);
        if (parent === dir) return { project: null, skipped };
        dir = parent;
    }
}

/** The nearest project above `cwd`, or null; findProject() also lists what it passed over. */
export function discoverProject(cwd: string, options: ResolveOptions & { userScope?: string } = {}): string | null {
    return findProject(cwd, options).project;
}

function readText(file: string): string | undefined {
    try {
        return readFileSync(file, "utf8").trim();
    } catch {
        return undefined;
    }
}

/**
 * The main checkout of the git worktree holding `dir`, or null. A linked
 * worktree's .git is a file ("gitdir: <main>/.git/worktrees/<name>") whose
 * gitdir has a commondir file; the main checkout is the parent of that common
 * dir. Submodules also have a .git file but no commondir, so they are not
 * worktrees. Read from files only: git need not be installed, and nothing here
 * requires git.
 */
export function gitWorktreeRoot(dir: string, platform: NodeJS.Platform = process.platform): { checkout: string; main: string } | null {
    const path = pathFor(platform);
    for (let probe = canonical(dir, platform); ; probe = path.dirname(probe)) {
        const dotGit = path.join(probe, ".git");
        let stat: ReturnType<typeof lstatSync> | undefined;
        try {
            stat = lstatSync(dotGit);
        } catch {
            // keep walking up
        }
        if (stat?.isDirectory()) return null; // a main checkout (or a plain repo)
        if (stat?.isFile()) {
            const line = readText(dotGit)?.match(/^gitdir:\s*(.+)$/m)?.[1];
            if (!line) return null;
            const gitdir = path.resolve(probe, line);
            const common = readText(path.join(gitdir, "commondir"));
            if (!common) return null; // a submodule
            const commonDir = canonical(path.resolve(gitdir, common), platform);
            if (path.basename(commonDir) !== ".git") return null; // a bare repository has no main checkout
            return { checkout: probe, main: path.dirname(commonDir) };
        }
        if (path.dirname(probe) === probe) return null;
    }
}

/**
 * The project whose local/ and trust a tool uses: `project` itself when it has
 * .tikoci/TOOL/local (even an unsafe one, so it is reported, not skipped);
 * else, for a git worktree, the .tikoci/ at the same place in its main
 * checkout. A nested .tikoci/ that is not a worktree never inherits from an
 * enclosing one: it is a separate project.
 */
function findLocalProject(project: string, tool: string, platform: NodeJS.Platform): { dir: string; source: Source } {
    const path = pathFor(platform);
    if (exists(path.join(project, ".tikoci", tool, "local"))) return { dir: project, source: "self" };
    const worktree = gitWorktreeRoot(project, platform);
    if (worktree) {
        const rel = path.relative(worktree.checkout, canonical(project, platform));
        const root = path.join(worktree.main, rel);
        if (isRealDirectory(path.join(root, ".tikoci"))) return { dir: root, source: "git-worktree" };
    }
    return { dir: project, source: "self" };
}

/** Resolve every tikoci-home location for one tool. */
export function resolveTikociPaths(tool: string, options: ResolveOptions = {}): TikociPaths {
    const prefix = toolVarPrefix(tool);
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const sandbox = absoluteFromEnv(env, "TIKOCI_SANDBOX", platform);
    const sandboxed = sandbox !== undefined;
    const user = userRoot(options);
    const scope = sandbox ?? user ?? null;
    const scopeSource = sandboxed ? "TIKOCI_SANDBOX" : nonEmpty(env.TIKOCI_HOME) ? "TIKOCI_HOME" : "default";

    // A tool's own variable wins over the house one for that tool, except that
    // a sandbox replaces the whole user scope, the tool's home included.
    const toolHome = sandboxed ? undefined : absoluteFromEnv(env, `${prefix}_HOME`, platform);
    const toolDir = toolHome ?? (scope ? path.join(scope, tool) : null);
    const runtimeRoot = absoluteFromEnv(env, "TIKOCI_RUNTIME_DIR", platform);
    const runtime = runtimeRoot ? path.join(runtimeRoot, tool) : scope ? path.join(scope, "run", tool) : null;
    // Explicit cache variables win even in a sandbox: a test sets them on purpose.
    const toolCache = absoluteFromEnv(env, `${prefix}_CACHE_DIR`, platform);
    const sharedCache = cacheRoot(options);
    const cache = toolCache ?? (sharedCache ? path.join(sharedCache, tool) : null);
    const cacheSource = toolCache ? `${prefix}_CACHE_DIR` : nonEmpty(env.TIKOCI_CACHE_DIR) ? "TIKOCI_CACHE_DIR" : "default";

    let project: string | null = null;
    let projectSource = "none";
    let skipped: string[] = [];
    const named = nonEmpty(env.TIKOCI_PROJECT);
    if (named === "none") {
        projectSource = "TIKOCI_PROJECT";
    } else if (named !== undefined) {
        project = absoluteFromEnv(env, "TIKOCI_PROJECT", platform) ?? null;
        projectSource = "TIKOCI_PROJECT";
    } else if (!sandboxed) {
        const cwd = options.cwd ?? (isProcessEnv(options) ? process.cwd() : undefined);
        if (cwd !== undefined) {
            ({ project, skipped } = findProject(cwd, { ...options, userScope: user }));
            if (project) projectSource = "discovered";
        }
    }
    const projectToolDir = project ? path.join(project, ".tikoci", tool) : null;
    const local = project === null ? null : findLocalProject(project, tool, platform);
    const localProject = local?.dir ?? null;
    const host = hostRoot(options);

    return {
        tool,
        sandboxed,
        userScope: scope,
        toolDir,
        runtime,
        cache,
        hostDir: host ? path.join(host, tool) : null,
        project,
        projectToolDir,
        localProject,
        projectLocalDir: localProject ? path.join(localProject, ".tikoci", tool, "local") : null,
        skipped,
        evicts: cache !== null && (sandbox === undefined || isInside(canonical(sandbox, platform), canonical(cache, platform), platform)),
        legacy: !sandboxed,
        keychain: !sandboxed,
        hostServices: !sandboxed,
        sources: {
            userScope: scopeSource,
            toolDir: toolHome ? `${prefix}_HOME` : scopeSource,
            runtime: runtimeRoot ? "TIKOCI_RUNTIME_DIR" : scopeSource,
            cache: cacheSource,
            project: projectSource,
            localProject: local?.source ?? "none",
        },
    };
}

/**
 * Resolve a path named in a project file. It must be relative, and it must
 * stay inside the project after symlinks are followed, including through a
 * directory that exists when the file itself does not yet; anything else
 * throws. This checks the path at resolve time only: open the file without
 * following a final symlink where the platform allows it.
 */
export function resolveInProject(project: string, relative: string, platform: NodeJS.Platform = process.platform): string {
    const path = pathFor(platform);
    if (relative.startsWith("~") || path.isAbsolute(relative)) {
        throw new Error(`project path "${relative}" must be relative to the project`);
    }
    const target = path.resolve(project, relative);
    if (!isInside(path.resolve(project), target, platform)) {
        throw new Error(`project path "${relative}" leaves the project`);
    }
    const root = realpathSync(project);
    // Follow symlinks through the nearest part of the path that exists.
    for (let probe = target; ; probe = path.dirname(probe)) {
        let real: string | undefined;
        try {
            real = realpathSync(probe);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (real !== undefined) {
            if (!isInside(root, real, platform)) throw new Error(`project path "${relative}" resolves outside the project`);
            return target;
        }
        if (path.dirname(probe) === probe) throw new Error(`project "${project}" does not exist`);
    }
}

/** Whether a Unix socket path fits the portable sun_path limit. */
export function socketPathFits(socketPath: string): boolean {
    return new TextEncoder().encode(socketPath).byteLength <= SOCKET_PATH_MAX;
}

/**
 * Create a directory only its owner can read, or make an existing one so
 * (POSIX mode 0700; Windows keeps the inherited ACL). Refuses a symlink or a
 * file in its place.
 */
export function ensurePrivateDir(dir: string): void {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stat = lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`"${dir}" must be a real directory, not a link or a file`);
    if (process.platform !== "win32") chmodSync(dir, 0o700);
}

/** Why a directory is not private to this user, or null when it is (always null on Windows). */
export function notPrivate(dir: string): string | null {
    let stat: ReturnType<typeof lstatSync>;
    try {
        stat = lstatSync(dir);
    } catch {
        return "missing";
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) return "not a real directory";
    if (process.platform === "win32") return null;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return "owned by another user";
    if ((Number(stat.mode) & 0o077) !== 0) return "readable by others (needs mode 0700)";
    return null;
}

/** The .gitignore a tool writes into its project directory: local/ never travels. */
export const PROJECT_GITIGNORE = "# tikoci-home: local/ is this user's, on this machine only.\nlocal/\n";

/**
 * Create root/.tikoci/tool/ with its .gitignore. Tools call this from an
 * explicit command (settings set --project, an init command), never on first
 * use. Refuses a symlinked .tikoci or tool directory.
 */
export function initProject(root: string, tool: string): string {
    checkTool(tool);
    const dir = join(root, ".tikoci", tool);
    mkdirSync(dir, { recursive: true });
    for (const part of [join(root, ".tikoci"), dir]) {
        if (!isRealDirectory(part)) throw new Error(`"${part}" must be a real directory, not a link or a file`);
    }
    try {
        writeFileSync(join(dir, ".gitignore"), PROJECT_GITIGNORE, { flag: "wx" });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    return dir;
}

export type ProjectState =
    /** No project, or the tool has no user scope to keep trust records in. */
    | "none"
    /** No local/ id this user scope knows: local/ is ignored until a person trusts the project. */
    | "untrusted"
    /** local/ exists but is a link, belongs to another user or is readable by others. */
    | "unsafe"
    /** The id is known, but its project is at another path that still holds it: this is a copy. */
    | "copied"
    /** The id is known, but its project path no longer holds it: this is a move. */
    | "moved"
    | "trusted";

export interface ProjectCheck {
    state: ProjectState;
    /** The id in local/id, when one is present and well formed. */
    id: string | null;
    /** Why local/ is not read, for the tool's report. */
    reason: string;
}

interface TrustRecord {
    path: string;
}

function trustRecordFile(paths: TikociPaths, id: string): string {
    return join(paths.toolDir as string, "projects", id, "project.json");
}

function readLocalId(localDir: string): string | null {
    try {
        const id = readFileSync(join(localDir, "id"), "utf8").trim();
        return PROJECT_ID.test(id) ? id : null;
    } catch {
        return null;
    }
}

function readRecord(paths: TikociPaths, id: string): TrustRecord | null {
    try {
        const record = JSON.parse(readFileSync(trustRecordFile(paths, id), "utf8"));
        return typeof record?.path === "string" ? record : null;
    } catch {
        return null;
    }
}

/**
 * Decide whether the tool may read the project's local/ directory. It may only
 * when local/ is private to this user and its id matches a trust record in the
 * tool's user scope for this project's canonical path. Nothing that arrives
 * with a directory (a clone, a sync, a backup) can create that record. A git
 * worktree is checked against its main checkout's local/ and record.
 */
export function checkProject(paths: TikociPaths): ProjectCheck {
    if (!paths.project || !paths.localProject || !paths.projectLocalDir || !paths.toolDir) {
        return { state: "none", id: null, reason: paths.project ? "no user scope for trust records" : "no project" };
    }
    const unsafe = notPrivate(paths.projectLocalDir);
    if (unsafe === "missing") return { state: "untrusted", id: null, reason: "local/ does not exist yet" };
    if (unsafe) return { state: "unsafe", id: null, reason: `local/ is ${unsafe}` };
    const id = readLocalId(paths.projectLocalDir);
    if (!id) return { state: "untrusted", id: null, reason: "local/id is missing or malformed" };
    const record = readRecord(paths, id);
    if (!record) return { state: "untrusted", id, reason: "local/id is not known to this user scope" };
    const here = canonical(paths.localProject, process.platform);
    if (samePath(record.path, here, process.platform)) return { state: "trusted", id, reason: "" };
    const elsewhere = join(record.path, ".tikoci", paths.tool, "local");
    if (readLocalId(elsewhere) === id) return { state: "copied", id, reason: `a copy of ${record.path}` };
    return { state: "moved", id, reason: `moved from ${record.path}` };
}

/**
 * Trust the project for this tool: what the tool's trust command (or an init
 * command such as centrs' devices init) does after a person confirms it on a
 * terminal. It is never reachable from MCP or another agent API. A move keeps
 * its id, so its machines and records follow it; anything else gets a new id,
 * so a copy or a clone never shares the original's state. It trusts the
 * project the run uses for local/: for a git worktree, that is its main
 * checkout, so a worktree never gets a local/ of its own this way.
 */
export function trustProject(paths: TikociPaths): string {
    if (!paths.localProject || !paths.projectLocalDir || !paths.toolDir) throw new Error("no project, or no user scope for trust records");
    const project = paths.localProject;
    const projectLocalDir = paths.projectLocalDir;
    const check = checkProject(paths);
    if (check.state === "trusted") return check.id as string;
    initProject(project, paths.tool);
    ensurePrivateDir(projectLocalDir);
    const id = check.state === "moved" && check.id ? check.id : randomBytes(6).toString("hex");
    const recordFile = trustRecordFile(paths, id);
    ensurePrivateDir(join(recordFile, ".."));
    const record: TrustRecord = { path: canonical(project, process.platform) };
    const temp = `${recordFile}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    renameSync(temp, recordFile);
    const idFile = join(projectLocalDir, "id");
    writeFileSync(`${idFile}.tmp`, `${id}\n`, { mode: 0o600 });
    renameSync(`${idFile}.tmp`, idFile);
    return id;
}

/** Variables a sandboxed child keeps from its parent; everything else is dropped. */
export const HERMETIC_KEEP = [
    "PATH", "HOME", "USERPROFILE", "LOCALAPPDATA", "TMPDIR", "TEMP", "TMP",
    "LANG", "LC_ALL", "TERM", "SystemRoot", "windir", "ComSpec", "PATHEXT",
    // These locate the user's cache, which a sandbox shares by default.
    "TIKOCI_HOME", "TIKOCI_CACHE_DIR",
];

/**
 * An environment for a sandbox run: only HERMETIC_KEEP from `base`,
 * TIKOCI_SANDBOX set to `sandbox`, TIKOCI_CACHE_DIR set to the cache `base`
 * uses (so the run reuses it even if a test later changes HOME), and `extra`
 * on top. Inherited TIKOCI_PROJECT and tool variables such as CENTRS_CDB_FILE
 * or QUICKCHR_DATA_DIR are dropped unless `extra` sets them. On Windows, names
 * match without case (Path, SYSTEMROOT) and keep the parent's spelling.
 */
export function hermeticEnv(sandbox: string, base: Env = process.env, extra: Env = {}, platform: NodeJS.Platform = process.platform): Env {
    const fold = (key: string) => (platform === "win32" ? key.toUpperCase() : key);
    const keep = new Set(HERMETIC_KEEP.map(fold));
    const env: Env = {};
    for (const [key, value] of Object.entries(base)) if (value !== undefined && keep.has(fold(key))) env[key] = value;
    const set = (key: string, value: string | undefined) => {
        for (const existing of Object.keys(env)) if (fold(existing) === fold(key)) delete env[existing];
        if (value !== undefined) env[key] = value;
    };
    set("TIKOCI_SANDBOX", sandbox);
    set("TIKOCI_CACHE_DIR", cacheRoot({ env: base, platform }));
    for (const [key, value] of Object.entries(extra)) set(key, value);
    return env;
}
