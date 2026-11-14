/**
 * Reference resolver for the tikoci-home layout (https://tikoci.dev/house/skills/tikoci-home/).
 *
 * Copy it into a tool, or write the same rules in the tool's own resolver; the
 * SKILL.md text is the contract and this file is one reading of it. It depends
 * only on node:fs, node:os and node:path, so it runs under Bun and Node.
 *
 * Three kinds of root share one layout (TOOL/ for config, secrets and state;
 * run/TOOL/ for runtime files): the user root (~/.tikoci, the owner), a
 * workspace root (a project's .tikoci/, a persistent guest layered over the
 * user root) and a sandbox root (TIKOCI_SANDBOX, a disposable guest isolated
 * from the user root). Guests share the user's cache but never evict from it.
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
    /** The run is a sandbox (TIKOCI_SANDBOX): a disposable guest of the user's setup. */
    sandboxed: boolean;
    /** This run's own root: the sandbox, else the user root; null when there is neither. */
    root: string | null;
    /** Config, secrets and state for this tool: TOOL_HOME, else root/tool. */
    toolDir: string | null;
    /** Runtime files: TIKOCI_RUNTIME_DIR/tool, else root/run/tool. */
    runtime: string | null;
    /** The shared cache for this tool: TOOL_CACHE_DIR, else TIKOCI_CACHE_DIR/tool, else (user root or sandbox)/cache/tool. */
    cache: string | null;
    /** The user root, even in a sandbox (read it only for host-resource claims then); null if unknown. */
    userRoot: string | null;
    /** The project directory holding .tikoci/, or null. */
    workspace: string | null;
    /** workspace/.tikoci/tool, or null. */
    workspaceToolDir: string | null;
    /** May evict from the shared cache, change its policy and manage host-wide services (no for a sandbox). */
    owner: boolean;
    /** May read the tool's pre-tikoci-home locations (no for a sandbox). */
    legacy: boolean;
    /** May use the OS keychain, Bun.secrets and similar (no for a sandbox). */
    keychain: boolean;
}

/** Bytes a Unix socket path may use: macOS sun_path is 104 including the NUL (Linux allows 108). */
export const SOCKET_PATH_MAX = 103;

const TOOL_NAME = /^[a-z][a-z0-9-]*$/;

function checkTool(tool: string): void {
    if (!TOOL_NAME.test(tool)) throw new Error(`tool name "${tool}" must match ${TOOL_NAME}`);
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

/** The user root: TIKOCI_HOME, else defaultHome(). */
export function userRoot(options: ResolveOptions = {}): string | undefined {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    return absoluteFromEnv(env, "TIKOCI_HOME", platform) ?? defaultHome(options);
}

/** The shared cache root: TIKOCI_CACHE_DIR, else the user root's cache/, else the sandbox's. */
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

/**
 * Walk up from `cwd` to the nearest directory holding a real .tikoci/ directory.
 * The user's home directory and anything above it are never checked, so the
 * user root ~/.tikoci is never taken for a workspace. A symlinked .tikoci is
 * ignored, and paths are compared after symlinks are followed (and without
 * case on Windows), so an alias of the home directory stops the walk too.
 */
export function discoverWorkspace(cwd: string, options: ResolveOptions & { root?: string } = {}): string | null {
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const user = userHome(options);
    // With no known home there is no safe place to stop, so discover nothing.
    if (user === undefined) return null;
    const stop = canonical(user, platform);
    const root = options.root ? canonical(options.root, platform) : undefined;
    let dir = canonical(cwd, platform);
    while (true) {
        if (samePath(dir, stop, platform)) return null;
        const candidate = path.join(dir, ".tikoci");
        if (!(root && samePath(candidate, root, platform)) && isRealDirectory(candidate)) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

/** Resolve every tikoci-home location for one tool. */
export function resolveTikociPaths(tool: string, options: ResolveOptions = {}): TikociPaths {
    const prefix = toolVarPrefix(tool);
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const path = pathFor(platform);
    const sandbox = absoluteFromEnv(env, "TIKOCI_SANDBOX", platform);
    const user = userRoot(options) ?? null;
    const root = sandbox ?? user;
    const sandboxed = sandbox !== undefined;

    // A tool's own variable wins over the house one, for that tool only.
    const toolDir = absoluteFromEnv(env, `${prefix}_HOME`, platform) ?? (root ? path.join(root, tool) : null);
    const runtimeRoot = absoluteFromEnv(env, "TIKOCI_RUNTIME_DIR", platform) ?? (root ? path.join(root, "run") : undefined);
    const sharedCache = cacheRoot(options);
    const cache = absoluteFromEnv(env, `${prefix}_CACHE_DIR`, platform) ?? (sharedCache ? path.join(sharedCache, tool) : null);

    let workspace: string | null = null;
    const workspaceSetting = nonEmpty(env.TIKOCI_WORKSPACE);
    if (workspaceSetting === "none") {
        workspace = null;
    } else if (workspaceSetting !== undefined) {
        workspace = absoluteFromEnv(env, "TIKOCI_WORKSPACE", platform) ?? null;
    } else if (!sandboxed) {
        workspace = discoverWorkspace(options.cwd ?? process.cwd(), { ...options, root: user ?? undefined });
    }

    return {
        tool,
        sandboxed,
        root,
        toolDir,
        runtime: runtimeRoot ? path.join(runtimeRoot, tool) : null,
        cache,
        userRoot: user,
        workspace,
        workspaceToolDir: workspace ? path.join(workspace, ".tikoci", tool) : null,
        owner: !sandboxed,
        legacy: !sandboxed,
        keychain: !sandboxed,
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
 * The .gitignore a tool writes into a new .tikoci/: everything stays local
 * except each tool's shared settings file, which a project may commit like
 * .claude/settings.json. Personal overrides go in a gitignored local env file.
 */
export const WORKSPACE_GITIGNORE = [
    "# tikoci workspace: only shared settings are committed (see tikoci-home).",
    "*",
    "!.gitignore",
    "!*/",
    "!*/*.env",
    "*/*.local.env",
    "run/",
    "",
].join("\n");

/**
 * Create a workspace for one tool under `root`: root/.tikoci/ with the
 * workspace .gitignore, and root/.tikoci/tool/, both owner-only. Tools call
 * this only from an explicit command, never on first use; that command also
 * enrolls the workspace in the user root.
 */
export function initWorkspace(root: string, tool: string): string {
    checkTool(tool);
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
        writeFileSync(gitignore, WORKSPACE_GITIGNORE, { flag: "wx", mode: 0o600 });
    } else if (!existing.isFile()) {
        throw new Error(`"${gitignore}" must be a regular file`);
    }
    const toolDir = join(dir, tool);
    ensurePrivateDir(toolDir);
    return toolDir;
}

/** Variables a sandboxed child keeps from its parent; everything else is dropped. */
export const HERMETIC_KEEP = [
    "PATH", "HOME", "USERPROFILE", "LOCALAPPDATA", "TMPDIR", "TEMP", "TMP",
    "LANG", "LC_ALL", "TERM", "SystemRoot", "windir", "ComSpec", "PATHEXT",
    // These describe the user's own setup, which a sandbox is a guest of.
    "TIKOCI_HOME", "TIKOCI_CACHE_DIR",
];

/**
 * An environment for a sandbox run: only HERMETIC_KEEP from `base`,
 * TIKOCI_SANDBOX set to `sandbox`, TIKOCI_CACHE_DIR set to the cache `base`
 * uses (so the run reuses it even if a test later changes HOME), and `extra`
 * on top. Inherited TIKOCI_WORKSPACE and tool variables such as
 * CENTRS_CDB_FILE or QUICKCHR_DATA_DIR are dropped unless `extra` sets them.
 * On Windows, names match without case (Path, SYSTEMROOT) and keep the
 * parent's spelling.
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
