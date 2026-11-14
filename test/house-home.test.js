import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    cacheRoot,
    discoverWorkspace,
    hermeticEnv,
    initWorkspace,
    resolveInWorkspace,
    resolveTikociPaths,
    SOCKET_PATH_MAX,
    socketPathFits,
    WORKSPACE_GITIGNORE,
} from "../skills/tikoci-home/scripts/tikoci-paths.ts";

const SKILL = join(import.meta.dir, "..", "skills", "tikoci-home");

const temps = [];
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function temp() {
    const dir = mkdtempSync(join(tmpdir(), "tikoci-home-"));
    temps.push(dir);
    return dir;
}

/** A fake user home with a project two levels down; returns the paths and a POSIX env. */
function fakeUser() {
    const root = realpathSync(temp());
    const home = join(root, "user");
    const project = join(home, "src", "project");
    const deep = join(project, "lib", "deep");
    mkdirSync(deep, { recursive: true });
    return { root, home, project, deep, env: { HOME: home } };
}

describe("roots", () => {
    test("default layout on Linux and macOS", () => {
        const paths = resolveTikociPaths("quickchr", { env: { HOME: "/u" }, cwd: "/", platform: "linux" });
        expect(paths).toMatchObject({
            sandboxed: false,
            root: "/u/.tikoci",
            userRoot: "/u/.tikoci",
            toolDir: "/u/.tikoci/quickchr",
            cache: "/u/.tikoci/cache/quickchr",
            runtime: "/u/.tikoci/run/quickchr",
            owner: true,
            legacy: true,
            keychain: true,
        });
    });

    test("Windows uses LOCALAPPDATA, not the roaming profile", () => {
        const env = { USERPROFILE: "C:\\Users\\u", LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local", HOME: "/c/msys/home" };
        const paths = resolveTikociPaths("centrs", { env, cwd: "C:\\", platform: "win32" });
        expect(paths.toolDir).toBe("C:\\Users\\u\\AppData\\Local\\tikoci\\centrs");
        expect(paths.cache).toBe("C:\\Users\\u\\AppData\\Local\\tikoci\\cache\\centrs");
    });

    test("TIKOCI_HOME only relocates the user root", () => {
        const paths = resolveTikociPaths("rosetta", { env: { HOME: "/u", TIKOCI_HOME: "/t/root" }, cwd: "/", platform: "linux" });
        expect(paths).toMatchObject({
            sandboxed: false,
            toolDir: "/t/root/rosetta",
            cache: "/t/root/cache/rosetta",
            runtime: "/t/root/run/rosetta",
            owner: true,
            legacy: true,
            keychain: true,
        });
    });

    test("TIKOCI_SANDBOX is a disposable guest root that shares the user's cache", () => {
        const env = { HOME: "/u", TIKOCI_SANDBOX: "/s" };
        expect(resolveTikociPaths("quickchr", { env, cwd: "/", platform: "linux" })).toMatchObject({
            sandboxed: true,
            root: "/s",
            toolDir: "/s/quickchr",
            runtime: "/s/run/quickchr",
            cache: "/u/.tikoci/cache/quickchr",
            userRoot: "/u/.tikoci",
            workspace: null,
            owner: false,
            legacy: false,
            keychain: false,
        });
        const alone = resolveTikociPaths("quickchr", { env: { TIKOCI_SANDBOX: "/s" }, cwd: "/", platform: "linux" });
        expect([alone.userRoot, alone.cache]).toEqual([null, "/s/cache/quickchr"]);
    });

    test("a tool's own variables win over the house ones for that tool", () => {
        const env = { HOME: "/u", QUICKCHR_HOME: "/q", QUICKCHR_CACHE_DIR: "/qc", ROUTEROS_MUSE_HOME: "/m" };
        const quickchr = resolveTikociPaths("quickchr", { env, cwd: "/", platform: "linux" });
        expect([quickchr.toolDir, quickchr.cache]).toEqual(["/q", "/qc"]);
        expect(resolveTikociPaths("routeros-muse", { env, cwd: "/", platform: "linux" }).toolDir).toBe("/m");
        expect(resolveTikociPaths("centrs", { env, cwd: "/", platform: "linux" }).toolDir).toBe("/u/.tikoci/centrs");
    });

    test("a supplied env without a home has no user root (centrs#654)", () => {
        const paths = resolveTikociPaths("centrs", { env: {}, cwd: "/", platform: "linux" });
        expect(paths).toMatchObject({ root: null, userRoot: null, toolDir: null, cache: null, runtime: null, workspace: null });
        expect(resolveTikociPaths("centrs", { env: {}, homedir: () => "/h", cwd: "/", platform: "linux" }).root).toBe("/h/.tikoci");
        expect(resolveTikociPaths("centrs", { env: { TIKOCI_HOME: "/t" }, cwd: "/", platform: "linux" }).toolDir).toBe("/t/centrs");
    });

    test("cache and runtime roots move independently", () => {
        const env = { HOME: "/u", TIKOCI_HOME: "/t", TIKOCI_CACHE_DIR: "/c", TIKOCI_RUNTIME_DIR: "/r" };
        const paths = resolveTikociPaths("quickchr", { env, cwd: "/", platform: "linux" });
        expect([paths.cache, paths.runtime]).toEqual(["/c/quickchr", "/r/quickchr"]);
    });

    test("empty variables are unset; relative ones are errors", () => {
        expect(resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_SANDBOX: " " }, cwd: "/", platform: "linux" }).sandboxed).toBe(false);
        expect(() => resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_HOME: "rel" }, cwd: "/", platform: "linux" })).toThrow("absolute");
        expect(() => resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_SANDBOX: "rel" }, cwd: "/", platform: "linux" })).toThrow("absolute");
        expect(() => resolveTikociPaths("Bad/Name", { env: { HOME: "/u" }, platform: "linux" })).toThrow("tool name");
    });

    test("Windows roots need a drive or UNC path", () => {
        const resolve = TIKOCI_HOME => resolveTikociPaths("x", { env: { USERPROFILE: "C:\\Users\\u", TIKOCI_HOME }, cwd: "C:\\", platform: "win32" });
        expect(() => resolve("\\pinned")).toThrow("absolute");
        expect(() => resolve("C:pinned")).toThrow("absolute");
        expect(resolve("D:\\t").toolDir).toBe("D:\\t\\x");
        expect(resolve("\\\\server\\share\\t").toolDir).toBe("\\\\server\\share\\t\\x");
    });

    test("the environment is read at call time", () => {
        const env = { HOME: "/a" };
        const before = resolveTikociPaths("x", { env, cwd: "/", platform: "linux" }).root;
        env.HOME = "/b";
        expect([before, resolveTikociPaths("x", { env, cwd: "/", platform: "linux" }).root]).toEqual(["/a/.tikoci", "/b/.tikoci"]);
    });
});

describe("workspaces", () => {
    test("the nearest .tikoci/ above the working directory wins", () => {
        const user = fakeUser();
        mkdirSync(join(user.home, "src", ".tikoci"));
        mkdirSync(join(user.project, ".tikoci"));
        const paths = resolveTikociPaths("centrs", { env: user.env, cwd: user.deep, platform: process.platform });
        expect(paths.workspace).toBe(user.project);
        expect(paths.workspaceToolDir).toBe(join(user.project, ".tikoci", "centrs"));
    });

    test("~/.tikoci is never a workspace", () => {
        const user = fakeUser();
        mkdirSync(join(user.home, ".tikoci"));
        expect(discoverWorkspace(user.deep, { env: user.env })).toBeNull();
        expect(discoverWorkspace(user.home, { env: user.env })).toBeNull();
    });

    test("an alias of the home directory still stops the walk", () => {
        const user = fakeUser();
        mkdirSync(join(user.home, ".tikoci"));
        const alias = join(user.root, "alias");
        symlinkSync(user.home, alias);
        expect(discoverWorkspace(join(alias, "src", "project", "lib", "deep"), { env: user.env })).toBeNull();
    });

    test("a symlinked .tikoci is ignored", () => {
        const user = fakeUser();
        mkdirSync(join(user.root, "elsewhere"));
        symlinkSync(join(user.root, "elsewhere"), join(user.project, ".tikoci"));
        expect(discoverWorkspace(user.deep, { env: user.env })).toBeNull();
    });

    test("a sandbox discovers no workspace above it", () => {
        const user = fakeUser();
        mkdirSync(join(user.project, ".tikoci"));
        const relocated = { ...user.env, TIKOCI_HOME: join(user.root, "elsewhere") };
        expect(resolveTikociPaths("centrs", { env: relocated, cwd: user.deep }).workspace).toBe(user.project);
        const env = { ...relocated, TIKOCI_SANDBOX: join(user.root, "sandbox") };
        expect(resolveTikociPaths("centrs", { env, cwd: user.deep }).workspace).toBeNull();
    });

    test("TIKOCI_WORKSPACE names one or turns discovery off", () => {
        const user = fakeUser();
        mkdirSync(join(user.project, ".tikoci"));
        const named = { ...user.env, TIKOCI_SANDBOX: join(user.root, "sandbox"), TIKOCI_WORKSPACE: user.project };
        expect(resolveTikociPaths("centrs", { env: named, cwd: user.root }).workspace).toBe(user.project);
        const off = { ...user.env, TIKOCI_WORKSPACE: "none" };
        expect(resolveTikociPaths("centrs", { env: off, cwd: user.deep }).workspace).toBeNull();
    });

    test("workspace paths stay inside the workspace", () => {
        const user = fakeUser();
        expect(resolveInWorkspace(user.project, "devices/lab.cdb")).toBe(join(user.project, "devices", "lab.cdb"));
        expect(() => resolveInWorkspace(user.project, "../other.cdb")).toThrow("leaves the workspace");
        expect(() => resolveInWorkspace(user.project, "/etc/passwd")).toThrow("relative");
        expect(() => resolveInWorkspace(user.project, "~/.config/tikoci/winbox.cdb")).toThrow("relative");
        expect(resolveInWorkspace(user.project, "new/dir/lab.cdb")).toBe(join(user.project, "new", "dir", "lab.cdb"));
        expect(resolveInWorkspace(user.project, "..devices/lab.cdb")).toBe(join(user.project, "..devices", "lab.cdb"));
        symlinkSync(user.home, join(user.project, "escape"));
        expect(() => resolveInWorkspace(user.project, "escape")).toThrow("outside the workspace");
        expect(() => resolveInWorkspace(user.project, "escape/new.cdb")).toThrow("outside the workspace");
        expect(() => resolveInWorkspace(user.project, "escape/a/b/new.cdb")).toThrow("outside the workspace");
    });

    test("initWorkspace creates owner-only directories that git ignores", () => {
        const root = temp();
        const toolDir = initWorkspace(root, "centrs");
        initWorkspace(root, "quickchr");
        expect(toolDir).toBe(join(root, ".tikoci", "centrs"));
        expect(readFileSync(join(root, ".tikoci", ".gitignore"), "utf8")).toBe(WORKSPACE_GITIGNORE);
        if (process.platform !== "win32") expect(statSync(join(root, ".tikoci")).mode & 0o077).toBe(0);
    });

    test("initWorkspace refuses a redirected .tikoci and tightens existing modes", () => {
        const linked = temp();
        symlinkSync(temp(), join(linked, ".tikoci"));
        expect(() => initWorkspace(linked, "centrs")).toThrow("real directory");
        const loose = temp();
        mkdirSync(join(loose, ".tikoci", "centrs"), { recursive: true });
        chmodSync(join(loose, ".tikoci", "centrs"), 0o755);
        initWorkspace(loose, "centrs");
        if (process.platform !== "win32") expect(statSync(join(loose, ".tikoci", "centrs")).mode & 0o077).toBe(0);
    });
});

describe("isolation", () => {
    test("hermeticEnv drops inherited tool variables and keeps the user's setup", () => {
        const base = { PATH: "/bin", HOME: "/u", TIKOCI_HOME: "/r", CENTRS_CDB_FILE: "/u/real.cdb", QUICKCHR_DATA_DIR: "/u/q", TIKOCI_WORKSPACE: "/p" };
        const env = hermeticEnv("/s", base, { CENTRS_FORMAT: "json" }, "linux");
        expect(env).toEqual({
            PATH: "/bin",
            HOME: "/u",
            TIKOCI_HOME: "/r",
            TIKOCI_SANDBOX: "/s",
            TIKOCI_CACHE_DIR: "/r/cache",
            CENTRS_FORMAT: "json",
        });
        const paths = resolveTikociPaths("quickchr", { env: { ...env, HOME: "/elsewhere" }, cwd: "/", platform: "linux" });
        expect([paths.cache, paths.userRoot]).toEqual([`${cacheRoot({ env: base, platform: "linux" })}/quickchr`, "/r"]);
    });

    test("hermeticEnv matches Windows names without case", () => {
        const base = { Path: "C:\\bin", SYSTEMROOT: "C:\\Windows", USERPROFILE: "C:\\Users\\u", LOCALAPPDATA: "C:\\L", centrs_cdb_file: "x", Tikoci_Sandbox: "C:\\old" };
        const env = hermeticEnv("C:\\s", base, { tikoci_workspace: "none" }, "win32");
        expect(env).toEqual({
            Path: "C:\\bin",
            SYSTEMROOT: "C:\\Windows",
            USERPROFILE: "C:\\Users\\u",
            LOCALAPPDATA: "C:\\L",
            TIKOCI_SANDBOX: "C:\\s",
            TIKOCI_CACHE_DIR: "C:\\L\\tikoci\\cache",
            tikoci_workspace: "none",
        });
    });

    test("a sandbox reads no workspace, legacy path or user state", () => {
        const user = fakeUser();
        mkdirSync(join(user.home, ".config", "tikoci"), { recursive: true });
        writeFileSync(join(user.home, ".config", "tikoci", "winbox.cdb"), "encrypted");
        mkdirSync(join(user.project, ".tikoci", "centrs"), { recursive: true });
        const env = hermeticEnv(join(user.root, "sandbox"), { ...user.env, CENTRS_CDB_FILE: "x" });
        const paths = resolveTikociPaths("centrs", { env, cwd: user.deep });
        expect(paths).toMatchObject({ sandboxed: true, workspace: null, owner: false, legacy: false, keychain: false });
        expect(paths.toolDir).toBe(join(user.root, "sandbox", "centrs"));
        expect(paths.cache).toBe(join(user.home, ".tikoci", "cache", "centrs"));
        expect(env.CENTRS_CDB_FILE).toBeUndefined();
    });

    test("socket paths are checked against the portable limit", () => {
        expect(socketPathFits(`/tmp/${"a".repeat(SOCKET_PATH_MAX - 5)}`)).toBe(true);
        expect(socketPathFits(`/tmp/${"a".repeat(SOCKET_PATH_MAX - 4)}`)).toBe(false);
        expect(socketPathFits(`/tmp/${"é".repeat(50)}`)).toBe(false);
    });
});

describe("layout.tsv", () => {
    const COLUMNS = ["tool", "item", "class", "scope", "path", "today", "owner", "lifecycle", "backup", "override", "migration", "notes"];
    const CLASSES = new Set(["config", "secret", "state", "cache", "runtime", "host-wide", "install"]);
    const SCOPES = new Set(["user", "workspace", "checkout", "install", "host", "process"]);
    const [header, ...rows] = readFileSync(join(SKILL, "references", "layout.tsv"), "utf8").trimEnd().split("\n").map(line => line.split("\t"));

    test("has the documented columns", () => {
        expect(header).toEqual(COLUMNS);
        const documented = readFileSync(join(SKILL, "references", "layout.md"), "utf8");
        for (const column of COLUMNS) expect(documented).toContain(`| \`${column}\` |`);
    });

    test("every row is complete and uses the fixed vocabularies", () => {
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            const label = row.slice(0, 2).join(" / ");
            expect(row.length, label).toBe(COLUMNS.length);
            for (const [i, cell] of row.entries()) expect(cell.trim(), `${label}: ${COLUMNS[i]}`).not.toBe("");
            expect(CLASSES.has(row[2]), `${label}: class ${row[2]}`).toBe(true);
            expect(SCOPES.has(row[3]), `${label}: scope ${row[3]}`).toBe(true);
            expect(["yes", "no", "-"], `${label}: backup`).toContain(row[8]);
        }
    });

    test("covers quickchr, centrs and rosetta, one row per item", () => {
        const tools = new Set(rows.map(row => row[0]));
        for (const tool of ["quickchr", "centrs", "rosetta"]) expect(tools.has(tool), tool).toBe(true);
        const keys = rows.map(row => `${row[0]}\t${row[1]}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    test("user caches live under TIKOCI_CACHE_DIR; config and secrets never do", () => {
        for (const row of rows) {
            if (row[2] === "cache" && row[3] === "user") expect(row[4], row[1]).toMatch(/TIKOCI_CACHE_DIR|^open:|^unchanged/);
            if (row[2] === "secret" || row[2] === "config") expect(row[4], row[1]).not.toMatch(/TIKOCI_CACHE_DIR/);
        }
    });
});
