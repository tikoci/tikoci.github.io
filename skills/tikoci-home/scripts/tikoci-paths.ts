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
import { existsSync, lstatSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir as osHomedir } from "node:os";
import { join, posix, win32 } from "node:path";

export type Env = Record<string, string | undefined>;

export interface ResolveOptions {
    env?: Env;
    cwd?: string;
    platform?: NodeJS.Platform;
    /** Fallback when HOME (USERPROFILE on Windows) is unset. */
    homedir?: () => string;
}

export interface TikociPaths {
    tool: string;
    /** TIKOCI_HOME was set: no workspace discovery, legacy paths or OS keychain. */
    pinned: boolean;
    /** The user root: TIKOCI_HOME, else defaultHome(). */
    home: string;
    /** Config, secrets and state for this tool: home/tool. */
    toolHome: string;
    /** Reusable cache for this tool, shared by every root. */
    cache: string;
    /** Sockets, pid files and locks of live processes for this tool. */
    runtime: string;
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

/** The user's home directory: HOME on POSIX, USERPROFILE on Windows, else os.homedir(). */
export function userHome(options: ResolveOptions = {}): string {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const fromEnv = platform === "win32" ? nonEmpty(env.USERPROFILE) : nonEmpty(env.HOME);
    return fromEnv ?? (options.homedir ?? osHomedir)();
}

function absoluteFromEnv(env: Env, name: string, platform: NodeJS.Platform): string | undefined {
    const value = nonEmpty(env[name]);
    if (value === undefined) return undefined;
    const path = pathFor(platform);
    if (!path.isAbsolute(value)) throw new Error(`${name} must be an absolute path, got "${value}"`);
    return path.normalize(value);
}

/**
 * The default user root: ~/.tikoci on Linux and macOS, %LOCALAPPDATA%\tikoci on
 * Windows, where everything outside AppData\Local roams with the profile.
 */
export function defaultHome(options: ResolveOptions = {}): string {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const home = userHome(options);
    if (platform === "win32") {
        const local = nonEmpty(env.LOCALAPPDATA) ?? path.join(home, "AppData", "Local");
        return path.join(local, "tikoci");
    }
    return path.join(home, ".tikoci");
}

/**
 * The cache root: TIKOCI_CACHE_DIR, else the default root's cache/. It does not
 * follow TIKOCI_HOME, so a pinned run still reuses the user's cache.
 */
export function cacheRoot(options: ResolveOptions = {}): string {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    return absoluteFromEnv(env, "TIKOCI_CACHE_DIR", platform) ?? pathFor(platform).join(defaultHome(options), "cache");
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
 * user root ~/.tikoci is never taken for a workspace. A symlinked .tikoci is ignored.
 */
export function discoverWorkspace(cwd: string, options: ResolveOptions & { home?: string } = {}): string | null {
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const stop = path.resolve(userHome(options));
    const home = options.home ? path.resolve(options.home) : undefined;
    let dir = path.resolve(cwd);
    while (true) {
        if (dir === stop) return null;
        const candidate = path.join(dir, ".tikoci");
        if (candidate !== home && isRealDirectory(candidate)) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        // Leaving the home directory upward would reach ~ itself; stop there too.
        if (parent === stop) return null;
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
    const pinned = explicitHome !== undefined;
    const home = explicitHome ?? defaultHome(options);
    const runtimeRoot = absoluteFromEnv(env, "TIKOCI_RUNTIME_DIR", platform) ?? path.join(home, "run");

    let workspace: string | null = null;
    const workspaceSetting = nonEmpty(env.TIKOCI_WORKSPACE);
    if (workspaceSetting === "none") {
        workspace = null;
    } else if (workspaceSetting !== undefined) {
        workspace = absoluteFromEnv(env, "TIKOCI_WORKSPACE", platform) ?? null;
    } else if (!pinned) {
        workspace = discoverWorkspace(options.cwd ?? process.cwd(), { ...options, home });
    }

    return {
        tool,
        pinned,
        home,
        toolHome: path.join(home, tool),
        cache: path.join(cacheRoot(options), tool),
        runtime: path.join(runtimeRoot, tool),
        workspace,
        workspaceToolDir: workspace ? path.join(workspace, ".tikoci", tool) : null,
        legacy: !pinned,
        keychain: !pinned,
    };
}

/**
 * Resolve a path named in a workspace file. It must be relative, and it must
 * stay inside the workspace after symlinks are followed; anything else throws.
 */
export function resolveInWorkspace(workspace: string, relative: string, platform: NodeJS.Platform = process.platform): string {
    const path = pathFor(platform);
    if (relative.startsWith("~") || path.isAbsolute(relative)) {
        throw new Error(`workspace path "${relative}" must be relative to the workspace`);
    }
    const inside = (root: string, target: string) => {
        const rel = path.relative(root, target);
        return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
    };
    const target = path.resolve(workspace, relative);
    if (!inside(path.resolve(workspace), target)) {
        throw new Error(`workspace path "${relative}" leaves the workspace`);
    }
    let real: string | undefined;
    try {
        real = realpathSync(target);
    } catch {
        // Not there yet; the lexical check above is all we can do.
    }
    if (real !== undefined && !inside(realpathSync(workspace), real)) {
        throw new Error(`workspace path "${relative}" resolves outside the workspace`);
    }
    return target;
}

/** Whether a Unix socket path fits the portable sun_path limit. */
export function socketPathFits(socketPath: string): boolean {
    return new TextEncoder().encode(socketPath).byteLength <= SOCKET_PATH_MAX;
}

/** Create a directory only its owner can read (POSIX mode 0700; Windows keeps the inherited ACL). */
export function ensurePrivateDir(dir: string): void {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
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
    if (!existsSync(gitignore)) writeFileSync(gitignore, "# Local tikoci tool state: never commit or sync.\n*\n");
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
 * TIKOCI_HOME set to `home`, TIKOCI_CACHE_DIR set to the cache `base` would
 * use (so the run reuses it even if a test later changes HOME), and `extra`
 * on top. Inherited TIKOCI_* and tool variables such as CENTRS_CDB_FILE or
 * QUICKCHR_DATA_DIR are dropped unless `extra` sets them.
 */
export function hermeticEnv(home: string, base: Env = process.env, extra: Env = {}, platform: NodeJS.Platform = process.platform): Env {
    const env: Env = {};
    for (const key of HERMETIC_KEEP) if (base[key] !== undefined) env[key] = base[key];
    env.TIKOCI_HOME = home;
    env.TIKOCI_CACHE_DIR = cacheRoot({ env: base, platform });
    return { ...env, ...extra };
}
