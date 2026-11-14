/**
 * Reference resolver for the tikoci-home layout (https://tikoci.dev/house/skills/tikoci-home/).
 *
 * Copy it into a tool, or write the same rules in the tool's own resolver; the
 * SKILL.md text is the contract and this file is one reading of it. It depends
 * only on node:fs, node:os and node:path, so it runs under Bun and Node.
 *
 * Every function reads the environment it is given at call time. Pass `env`
 * explicitly from code that a test may call with a different environment;
 * never resolve a path once at import and keep it.
 */
import { chmodSync, lstatSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir as osHomedir } from "node:os";
import { join, posix, win32 } from "node:path";

export type Env = Record<string, string | undefined>;

export interface ResolveOptions {
    /**
     * The environment to read. When it is omitted (or is process.env itself),
     * os.homedir() backs up a missing HOME. A caller-supplied env is taken
     * literally: with no HOME (USERPROFILE on Windows) and no TIKOCI_HOME it
     * has no user root, so nothing resolves to the developer's real files.
     */
    env?: Env;
    cwd?: string;
    platform?: NodeJS.Platform;
    /** Explicit fallback when HOME (USERPROFILE on Windows) is unset, even for a supplied env. */
    homedir?: () => string;
}

export interface TikociPaths {
    tool: string;
    /** TIKOCI_PINNED=1: no workspace discovery, legacy paths or OS keychain. */
    pinned: boolean;
    /** The user root: TIKOCI_HOME, else defaultHome(); null when the env has no user root. */
    home: string | null;
    /** Config, secrets and state for this tool: home/tool. */
    toolHome: string | null;
    /** Reusable cache for this tool: TIKOCI_CACHE_DIR/tool, else home/cache/tool. */
    cache: string | null;
    /** Sockets, pid files and locks of live processes: TIKOCI_RUNTIME_DIR/tool, else home/run/tool. */
    runtime: string | null;
    /** The directory that holds .tikoci/, or null. */
    workspace: string | null;
    /** workspace/.tikoci/tool, or null. */
    workspaceToolDir: string | null;
    /** Whether the tool may read its pre-tikoci-home locations. */
    legacy: boolean;
    /** Whether the tool may use the OS keychain (Bun.secrets and similar). */
    keychain: boolean;
}

/** Bytes a Unix socket path may use: macOS sun_path is 104 including the NUL (Linux allows 108). */
export const SOCKET_PATH_MAX = 103;

const TOOL_NAME = /^[a-z][a-z0-9-]*$/;

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
    // On Windows, "\\x" is "absolute" but depends on the current drive: require a drive or UNC path.
    const absolute = platform === "win32" ? /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/])/.test(value) : path.isAbsolute(value);
    if (!absolute) throw new Error(`${name} must be an absolute path, got "${value}"`);
    return path.normalize(value);
}

/** The canonical form of an existing path (symlinks followed), else its resolved form. */
function canonical(target: string, platform: NodeJS.Platform): string {
    const path = pathFor(platform);
    try {
        return realpathSync(target);
    } catch {
        return path.resolve(target);
    }
}

function samePath(a: string, b: string, platform: NodeJS.Platform): boolean {
    return platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * The default user root: ~/.tikoci on Linux and macOS, %LOCALAPPDATA%\tikoci on
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

/** The cache root: TIKOCI_CACHE_DIR, else the user root's cache/. */
export function cacheRoot(options: ResolveOptions = {}): string | undefined {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const explicit = absoluteFromEnv(env, "TIKOCI_CACHE_DIR", platform);
    if (explicit) return explicit;
    const home = absoluteFromEnv(env, "TIKOCI_HOME", platform) ?? defaultHome(options);
    return home === undefined ? undefined : pathFor(platform).join(home, "cache");
}

/** TIKOCI_PINNED: "1" pins the run, "0" or unset does not; anything else is an error. */
function pinnedFromEnv(env: Env): boolean {
    const value = nonEmpty(env.TIKOCI_PINNED);
    if (value === undefined || value === "0") return false;
    if (value === "1") return true;
    throw new Error(`TIKOCI_PINNED must be 1 or 0, got "${value}"`);
}

function isRealDirectory(dir: string): boolean {
    try {
        const stat = lstatSync(dir);
        return stat.isDirectory() && !stat.isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Walk up from `cwd` to the nearest directory holding a real .tikoci/ directory.
 * The user's home directory and anything above it are never checked, so the
 * user root ~/.tikoci is never taken for a workspace. A symlinked .tikoci is
 * ignored, and paths are compared after symlinks are followed (and without
 * case on Windows), so an alias of the home directory stops the walk too.
 */
export function discoverWorkspace(cwd: string, options: ResolveOptions & { home?: string } = {}): string | null {
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const user = userHome(options);
    // With no known home there is no safe place to stop, so discover nothing.
    if (user === undefined) return null;
    const stop = canonical(user, platform);
    const home = options.home ? canonical(options.home, platform) : undefined;
    let dir = canonical(cwd, platform);
    while (true) {
        if (samePath(dir, stop, platform)) return null;
        const candidate = path.join(dir, ".tikoci");
        if (!(home && samePath(candidate, home, platform)) && isRealDirectory(candidate)) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

/** Resolve every tikoci-home location for one tool. */
export function resolveTikociPaths(tool: string, options: ResolveOptions = {}): TikociPaths {
    if (!TOOL_NAME.test(tool)) throw new Error(`tool name "${tool}" must match ${TOOL_NAME}`);
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const explicitHome = absoluteFromEnv(env, "TIKOCI_HOME", platform);
    const pinned = pinnedFromEnv(env);
    if (pinned && explicitHome === undefined) throw new Error("TIKOCI_PINNED=1 needs TIKOCI_HOME set to the run's own root");
    const home = explicitHome ?? defaultHome(options) ?? null;
    const runtimeRoot = absoluteFromEnv(env, "TIKOCI_RUNTIME_DIR", platform) ?? (home ? path.join(home, "run") : undefined);
    const cache = cacheRoot(options);

    let workspace: string | null = null;
    const workspaceSetting = nonEmpty(env.TIKOCI_WORKSPACE);
    if (workspaceSetting === "none") {
        workspace = null;
    } else if (workspaceSetting !== undefined) {
        workspace = absoluteFromEnv(env, "TIKOCI_WORKSPACE", platform) ?? null;
    } else if (!pinned && home !== null) {
        workspace = discoverWorkspace(options.cwd ?? process.cwd(), { ...options, home });
    }

    return {
        tool,
        pinned,
        home,
        toolHome: home ? path.join(home, tool) : null,
        cache: cache ? path.join(cache, tool) : null,
        runtime: runtimeRoot ? path.join(runtimeRoot, tool) : null,
        workspace,
        workspaceToolDir: workspace ? path.join(workspace, ".tikoci", tool) : null,
        legacy: !pinned,
        keychain: !pinned,
    };
}

/**
 * Resolve a path named in a workspace file. It must be relative, and it must
 * stay inside the workspace after symlinks are followed, including through a
 * directory that exists when the file itself does not yet; anything else
 * throws. This checks the path at resolve time only: open the file without
 * following a final symlink where the platform allows it.
 */
export function resolveInWorkspace(workspace: string, relative: string, platform: NodeJS.Platform = process.platform): string {
    const path = pathFor(platform);
    if (relative.startsWith("~") || path.isAbsolute(relative)) {
        throw new Error(`workspace path "${relative}" must be relative to the workspace`);
    }
    const inside = (root: string, target: string) => {
        const rel = path.relative(root, target);
        return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
    };
    const target = path.resolve(workspace, relative);
    if (!inside(path.resolve(workspace), target)) {
        throw new Error(`workspace path "${relative}" leaves the workspace`);
    }
    const root = realpathSync(workspace);
    // Follow symlinks through the nearest part of the path that exists.
    for (let probe = target; ; probe = path.dirname(probe)) {
        let real: string | undefined;
        try {
            real = realpathSync(probe);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (real !== undefined) {
            if (!inside(root, real)) throw new Error(`workspace path "${relative}" resolves outside the workspace`);
            return target;
        }
        if (path.dirname(probe) === probe) throw new Error(`workspace "${workspace}" does not exist`);
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

/**
 * Create a workspace for one tool under `root`: root/.tikoci/ with a
 * .gitignore that ignores everything, and root/.tikoci/tool/, both owner-only.
 * Tools call this only from an explicit command, never on first use.
 */
export function initWorkspace(root: string, tool: string): string {
    if (!TOOL_NAME.test(tool)) throw new Error(`tool name "${tool}" must match ${TOOL_NAME}`);
    const dir = join(root, ".tikoci");
    ensurePrivateDir(dir);
    const gitignore = join(dir, ".gitignore");
    let existing: ReturnType<typeof lstatSync> | undefined;
    try {
        existing = lstatSync(gitignore);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (existing === undefined) {
        writeFileSync(gitignore, "# Local tikoci tool state: never commit or sync.\n*\n", { flag: "wx", mode: 0o600 });
    } else if (!existing.isFile()) {
        throw new Error(`"${gitignore}" must be a regular file`);
    }
    const toolDir = join(dir, tool);
    ensurePrivateDir(toolDir);
    return toolDir;
}

/** Variables a hermetic child process keeps from its parent; everything else is dropped. */
export const HERMETIC_KEEP = [
    "PATH", "HOME", "USERPROFILE", "LOCALAPPDATA", "TMPDIR", "TEMP", "TMP",
    "LANG", "LC_ALL", "TERM", "SystemRoot", "windir", "ComSpec", "PATHEXT",
];

/**
 * An environment for a pinned, hermetic run: only HERMETIC_KEEP from `base`,
 * TIKOCI_HOME set to `home`, TIKOCI_PINNED=1, TIKOCI_CACHE_DIR set to the
 * cache `base` would use (so the run reuses it), and `extra` on top. Inherited TIKOCI_* and tool variables such as CENTRS_CDB_FILE or
 * QUICKCHR_DATA_DIR are dropped unless `extra` sets them. On Windows, names
 * match without case (Path, SYSTEMROOT) and keep the parent's spelling.
 */
export function hermeticEnv(home: string, base: Env = process.env, extra: Env = {}, platform: NodeJS.Platform = process.platform): Env {
    const fold = (key: string) => (platform === "win32" ? key.toUpperCase() : key);
    const keep = new Set(HERMETIC_KEEP.map(fold));
    const env: Env = {};
    for (const [key, value] of Object.entries(base)) if (value !== undefined && keep.has(fold(key))) env[key] = value;
    const set = (key: string, value: string | undefined) => {
        for (const existing of Object.keys(env)) if (fold(existing) === fold(key)) delete env[existing];
        if (value !== undefined) env[key] = value;
    };
    set("TIKOCI_HOME", home);
    set("TIKOCI_PINNED", "1");
    set("TIKOCI_CACHE_DIR", cacheRoot({ env: base, platform }));
    for (const [key, value] of Object.entries(extra)) set(key, value);
    return env;
}
