import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    cacheRoot,
    checkProject,
    discoverProject,
    hermeticEnv,
    initProject,
    PROJECT_GITIGNORE,
    resolveInProject,
    resolveTikociPaths,
    SOCKET_PATH_MAX,
    socketPathFits,
    trustProject,
} from "../skills/tikoci-home/scripts/tikoci-paths.ts";

const SKILL = join(import.meta.dir, "..", "skills", "tikoci-home");
const POSIX = process.platform !== "win32";

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

describe("scopes", () => {
    test("default layout on Linux and macOS", () => {
        const paths = resolveTikociPaths("quickchr", { env: { HOME: "/u" }, cwd: "/", platform: "linux" });
        expect(paths).toMatchObject({
            sandboxed: false,
            userScope: "/u/.tikoci",
            toolDir: "/u/.tikoci/quickchr",
            cache: "/u/.tikoci/cache/quickchr",
            runtime: "/u/.tikoci/run/quickchr",
            project: null,
            evicts: true,
            legacy: true,
            keychain: true,
            hostServices: true,
        });
        expect(paths.sources).toEqual({ userScope: "default", toolDir: "default", runtime: "default", cache: "default", project: "none" });
    });

    test("Windows uses LOCALAPPDATA, not the roaming profile", () => {
        const env = { USERPROFILE: "C:\\Users\\u", LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local", HOME: "/c/msys/home" };
        const paths = resolveTikociPaths("centrs", { env, cwd: "C:\\", platform: "win32" });
        expect(paths.toolDir).toBe("C:\\Users\\u\\AppData\\Local\\tikoci\\centrs");
        expect(paths.cache).toBe("C:\\Users\\u\\AppData\\Local\\tikoci\\cache\\centrs");
    });

    test("TIKOCI_HOME only moves the user scope", () => {
        const paths = resolveTikociPaths("rosetta", { env: { HOME: "/u", TIKOCI_HOME: "/t/root" }, cwd: "/", platform: "linux" });
        expect(paths).toMatchObject({
            sandboxed: false,
            toolDir: "/t/root/rosetta",
            cache: "/t/root/cache/rosetta",
            runtime: "/t/root/run/rosetta",
            evicts: true,
            legacy: true,
            keychain: true,
        });
        expect(paths.sources.toolDir).toBe("TIKOCI_HOME");
    });

    test("a tool's own variables win over the house ones for that tool", () => {
        const env = { HOME: "/u", QUICKCHR_HOME: "/q", QUICKCHR_CACHE_DIR: "/qc", ROUTEROS_MUSE_HOME: "/m" };
        const quickchr = resolveTikociPaths("quickchr", { env, cwd: "/", platform: "linux" });
        expect([quickchr.toolDir, quickchr.cache, quickchr.sources.toolDir]).toEqual(["/q", "/qc", "QUICKCHR_HOME"]);
        expect(resolveTikociPaths("routeros-muse", { env, cwd: "/", platform: "linux" }).toolDir).toBe("/m");
        expect(resolveTikociPaths("centrs", { env, cwd: "/", platform: "linux" }).toolDir).toBe("/u/.tikoci/centrs");
    });

    test("a supplied env without a home has no user scope (centrs#654)", () => {
        const paths = resolveTikociPaths("centrs", { env: {}, cwd: "/", platform: "linux" });
        expect(paths).toMatchObject({ userScope: null, toolDir: null, cache: null, runtime: null, project: null, evicts: false });
        expect(resolveTikociPaths("centrs", { env: {}, homedir: () => "/h", cwd: "/", platform: "linux" }).userScope).toBe("/h/.tikoci");
        expect(resolveTikociPaths("centrs", { env: { TIKOCI_HOME: "/t" }, cwd: "/", platform: "linux" }).toolDir).toBe("/t/centrs");
    });

    test("cache and runtime roots move independently", () => {
        const env = { HOME: "/u", TIKOCI_HOME: "/t", TIKOCI_CACHE_DIR: "/c", TIKOCI_RUNTIME_DIR: "/r" };
        const paths = resolveTikociPaths("quickchr", { env, cwd: "/", platform: "linux" });
        expect([paths.cache, paths.runtime]).toEqual(["/c/quickchr", "/r/quickchr"]);
        expect([paths.sources.cache, paths.sources.runtime]).toEqual(["TIKOCI_CACHE_DIR", "TIKOCI_RUNTIME_DIR"]);
    });

    test("empty variables are unset; relative ones are errors; reserved names are not tools", () => {
        expect(resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_SANDBOX: " " }, cwd: "/", platform: "linux" }).sandboxed).toBe(false);
        expect(() => resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_HOME: "rel" }, cwd: "/", platform: "linux" })).toThrow("absolute");
        expect(() => resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_SANDBOX: "rel" }, cwd: "/", platform: "linux" })).toThrow("absolute");
        expect(() => resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_PROJECT: "rel" }, cwd: "/", platform: "linux" })).toThrow("absolute");
        expect(() => resolveTikociPaths("Bad/Name", { env: { HOME: "/u" }, platform: "linux" })).toThrow("tool name");
        expect(() => resolveTikociPaths("cache", { env: { HOME: "/u" }, platform: "linux" })).toThrow("reserved");
    });

    test("Windows paths need a drive or UNC prefix", () => {
        const resolve = TIKOCI_HOME => resolveTikociPaths("x", { env: { USERPROFILE: "C:\\Users\\u", TIKOCI_HOME }, cwd: "C:\\", platform: "win32" });
        expect(() => resolve("\\pinned")).toThrow("absolute");
        expect(() => resolve("C:pinned")).toThrow("absolute");
        expect(resolve("D:\\t").toolDir).toBe("D:\\t\\x");
        expect(resolve("\\\\server\\share\\t").toolDir).toBe("\\\\server\\share\\t\\x");
    });

    test("the environment is read at call time", () => {
        const env = { HOME: "/a" };
        const before = resolveTikociPaths("x", { env, cwd: "/", platform: "linux" }).userScope;
        env.HOME = "/b";
        expect([before, resolveTikociPaths("x", { env, cwd: "/", platform: "linux" }).userScope]).toEqual(["/a/.tikoci", "/b/.tikoci"]);
    });
});

describe("sandboxes", () => {
    test("TIKOCI_SANDBOX replaces the user scope and shares the user's cache without evicting", () => {
        const env = { HOME: "/u", TIKOCI_SANDBOX: "/s" };
        expect(resolveTikociPaths("quickchr", { env, cwd: "/", platform: "linux" })).toMatchObject({
            sandboxed: true,
            userScope: "/s",
            toolDir: "/s/quickchr",
            runtime: "/s/run/quickchr",
            cache: "/u/.tikoci/cache/quickchr",
            project: null,
            evicts: false,
            legacy: false,
            keychain: false,
            hostServices: false,
        });
        const alone = resolveTikociPaths("quickchr", { env: { TIKOCI_SANDBOX: "/s" }, cwd: "/", platform: "linux" });
        expect([alone.cache, alone.evicts]).toEqual(["/s/cache/quickchr", true]);
    });

    test("the sandbox wins over TIKOCI_HOME and the tool's home variable", () => {
        const env = { HOME: "/u", TIKOCI_HOME: "/t", CENTRS_HOME: "/real/centrs", TIKOCI_SANDBOX: "/s" };
        const paths = resolveTikociPaths("centrs", { env, cwd: "/", platform: "linux" });
        expect([paths.userScope, paths.toolDir, paths.sources.toolDir]).toEqual(["/s", "/s/centrs", "TIKOCI_SANDBOX"]);
        // The cache of the relocated user scope is still shared.
        expect(paths.cache).toBe("/t/cache/centrs");
    });

    test("explicit cache variables still win, and a cache inside the sandbox is the sandbox's to evict", () => {
        const shared = resolveTikociPaths("quickchr", { env: { HOME: "/u", TIKOCI_SANDBOX: "/s", QUICKCHR_CACHE_DIR: "/qc" }, cwd: "/", platform: "linux" });
        expect([shared.cache, shared.evicts]).toEqual(["/qc", false]);
        const own = resolveTikociPaths("quickchr", { env: { HOME: "/u", TIKOCI_SANDBOX: "/s", TIKOCI_CACHE_DIR: "/s/cache" }, cwd: "/", platform: "linux" });
        expect([own.cache, own.evicts]).toEqual(["/s/cache/quickchr", true]);
    });

    test("a sandbox discovers no project, but can be given one", () => {
        const user = fakeUser();
        mkdirSync(join(user.project, ".tikoci"));
        const sandbox = { ...user.env, TIKOCI_SANDBOX: join(user.root, "sandbox") };
        expect(resolveTikociPaths("centrs", { env: sandbox, cwd: user.deep }).project).toBeNull();
        const named = resolveTikociPaths("centrs", { env: { ...sandbox, TIKOCI_PROJECT: user.project }, cwd: user.root });
        expect([named.project, named.sources.project]).toEqual([user.project, "TIKOCI_PROJECT"]);
        // Its trust records are the sandbox's own, so the user's trust does not carry over.
        trustProject(resolveTikociPaths("centrs", { env: user.env, cwd: user.deep }));
        expect(checkProject(named).state).toBe("untrusted");
    });

    test("hermeticEnv drops inherited tool variables and keeps the user's cache", () => {
        const base = { PATH: "/bin", HOME: "/u", TIKOCI_HOME: "/r", CENTRS_CDB_FILE: "/u/real.cdb", QUICKCHR_DATA_DIR: "/u/q", TIKOCI_PROJECT: "/p" };
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
        expect(paths.cache).toBe(`${cacheRoot({ env: base, platform: "linux" })}/quickchr`);
    });

    test("hermeticEnv matches Windows names without case", () => {
        const base = { Path: "C:\\bin", SYSTEMROOT: "C:\\Windows", USERPROFILE: "C:\\Users\\u", LOCALAPPDATA: "C:\\L", centrs_cdb_file: "x", Tikoci_Sandbox: "C:\\old" };
        const env = hermeticEnv("C:\\s", base, { tikoci_project: "none" }, "win32");
        expect(env).toEqual({
            Path: "C:\\bin",
            SYSTEMROOT: "C:\\Windows",
            USERPROFILE: "C:\\Users\\u",
            LOCALAPPDATA: "C:\\L",
            TIKOCI_SANDBOX: "C:\\s",
            TIKOCI_CACHE_DIR: "C:\\L\\tikoci\\cache",
            tikoci_project: "none",
        });
    });

    test("a sandbox reads no project, legacy path or user state", () => {
        const user = fakeUser();
        mkdirSync(join(user.home, ".config", "tikoci"), { recursive: true });
        writeFileSync(join(user.home, ".config", "tikoci", "winbox.cdb"), "encrypted");
        mkdirSync(join(user.project, ".tikoci", "centrs"), { recursive: true });
        const env = hermeticEnv(join(user.root, "sandbox"), { ...user.env, CENTRS_CDB_FILE: "x" });
        const paths = resolveTikociPaths("centrs", { env, cwd: user.deep });
        expect(paths).toMatchObject({ sandboxed: true, project: null, evicts: false, legacy: false, keychain: false });
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

describe("finding the project", () => {
    test("the nearest .tikoci/ above the working directory wins, with or without the tool's directory", () => {
        const user = fakeUser();
        mkdirSync(join(user.home, "src", ".tikoci", "centrs"), { recursive: true });
        mkdirSync(join(user.project, ".tikoci", "quickchr"), { recursive: true });
        const paths = resolveTikociPaths("centrs", { env: user.env, cwd: user.deep });
        expect([paths.project, paths.sources.project]).toEqual([user.project, "discovered"]);
        expect(paths.projectToolDir).toBe(join(user.project, ".tikoci", "centrs"));
        expect(paths.projectLocalDir).toBe(join(user.project, ".tikoci", "centrs", "local"));
    });

    test("~/.tikoci is never a project", () => {
        const user = fakeUser();
        mkdirSync(join(user.home, ".tikoci"));
        expect(discoverProject(user.deep, { env: user.env })).toBeNull();
        expect(discoverProject(user.home, { env: user.env })).toBeNull();
    });

    test("an alias of the home directory still stops the walk", () => {
        const user = fakeUser();
        mkdirSync(join(user.home, ".tikoci"));
        const alias = join(user.root, "alias");
        symlinkSync(user.home, alias);
        expect(discoverProject(join(alias, "src", "project", "lib", "deep"), { env: user.env })).toBeNull();
    });

    test("a symlinked .tikoci is ignored", () => {
        const user = fakeUser();
        mkdirSync(join(user.root, "elsewhere"));
        symlinkSync(join(user.root, "elsewhere"), join(user.project, ".tikoci"));
        expect(discoverProject(user.deep, { env: user.env })).toBeNull();
    });

    test("a supplied env without cwd discovers nothing; TIKOCI_PROJECT names one or turns it off", () => {
        const user = fakeUser();
        mkdirSync(join(user.project, ".tikoci"));
        expect(resolveTikociPaths("centrs", { env: user.env }).project).toBeNull();
        expect(resolveTikociPaths("centrs", { env: { ...user.env, TIKOCI_PROJECT: user.project }, cwd: user.root }).project).toBe(user.project);
        const off = resolveTikociPaths("centrs", { env: { ...user.env, TIKOCI_PROJECT: "none" }, cwd: user.deep });
        expect([off.project, off.sources.project]).toEqual([null, "TIKOCI_PROJECT"]);
    });

    test("paths named in project files stay inside the project", () => {
        const user = fakeUser();
        expect(resolveInProject(user.project, "machines/edge1.toml")).toBe(join(user.project, "machines", "edge1.toml"));
        expect(() => resolveInProject(user.project, "../other.cdb")).toThrow("leaves the project");
        expect(() => resolveInProject(user.project, "/etc/passwd")).toThrow("relative");
        expect(() => resolveInProject(user.project, "~/.tikoci/centrs/winbox.cdb")).toThrow("relative");
        expect(resolveInProject(user.project, "new/dir/lab.toml")).toBe(join(user.project, "new", "dir", "lab.toml"));
        expect(resolveInProject(user.project, "..devices/lab.toml")).toBe(join(user.project, "..devices", "lab.toml"));
        symlinkSync(user.home, join(user.project, "escape"));
        expect(() => resolveInProject(user.project, "escape")).toThrow("outside the project");
        expect(() => resolveInProject(user.project, "escape/new.toml")).toThrow("outside the project");
        expect(() => resolveInProject(user.project, "escape/a/b/new.toml")).toThrow("outside the project");
    });
});

describe("local/ and trust", () => {
    /** A project with .tikoci/, resolved for centrs in the fake user's scope. */
    function project(user, dir = user.project) {
        mkdirSync(join(dir, ".tikoci"), { recursive: true });
        return resolveTikociPaths("centrs", { env: user.env, cwd: dir });
    }

    test("initProject writes the tool's directory and a .gitignore for local/", () => {
        const root = temp();
        const dir = initProject(root, "centrs");
        expect(dir).toBe(join(root, ".tikoci", "centrs"));
        expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe(PROJECT_GITIGNORE);
        writeFileSync(join(dir, ".gitignore"), "custom\n");
        initProject(root, "centrs");
        expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe("custom\n");
        const linked = temp();
        symlinkSync(temp(), join(linked, ".tikoci"));
        expect(() => initProject(linked, "centrs")).toThrow("real directory");
    });

    test("a new project is untrusted until a person trusts it", () => {
        const user = fakeUser();
        const paths = project(user);
        expect(checkProject(paths).state).toBe("untrusted");
        const id = trustProject(paths);
        expect(id).toMatch(/^[0-9a-f]{12}$/);
        expect(checkProject(paths)).toEqual({ state: "trusted", id, reason: "" });
        expect(readFileSync(join(paths.projectLocalDir, "id"), "utf8").trim()).toBe(id);
        expect(JSON.parse(readFileSync(join(paths.toolDir, "projects", id, "project.json"), "utf8")).path).toBe(user.project);
        if (POSIX) expect(statSync(paths.projectLocalDir).mode & 0o077).toBe(0);
        expect(trustProject(paths)).toBe(id);
    });

    test("a local/id that arrived with the directory is ignored, and trusting it makes a new id", () => {
        const user = fakeUser();
        const paths = project(user);
        mkdirSync(paths.projectLocalDir, { recursive: true, mode: 0o700 });
        writeFileSync(join(paths.projectLocalDir, "id"), "0123456789ab\n");
        expect(checkProject(paths)).toMatchObject({ state: "untrusted", id: "0123456789ab" });
        expect(trustProject(paths)).not.toBe("0123456789ab");
    });

    test("trust is per tool", () => {
        const user = fakeUser();
        trustProject(project(user));
        expect(checkProject(resolveTikociPaths("quickchr", { env: user.env, cwd: user.project })).state).toBe("untrusted");
    });

    test("a copy keeps the original trusted and gets its own id", () => {
        const user = fakeUser();
        const original = project(user);
        const id = trustProject(original);
        const copyDir = join(user.home, "src", "copy");
        cpSync(user.project, copyDir, { recursive: true });
        const copy = resolveTikociPaths("centrs", { env: user.env, cwd: copyDir });
        expect(checkProject(copy)).toMatchObject({ state: "copied", id });
        expect(trustProject(copy)).not.toBe(id);
        expect(checkProject(original).state).toBe("trusted");
        expect(checkProject(copy).state).toBe("trusted");
    });

    test("a move keeps its id once trusted again", () => {
        const user = fakeUser();
        const id = trustProject(project(user));
        const moved = join(user.home, "src", "moved");
        renameSync(user.project, moved);
        const paths = resolveTikociPaths("centrs", { env: user.env, cwd: moved });
        expect(checkProject(paths)).toMatchObject({ state: "moved", id });
        expect(trustProject(paths)).toBe(id);
        expect(checkProject(paths).state).toBe("trusted");
    });

    test.skipIf(!POSIX)("a local/ readable by others is unsafe, and trusting it makes a new id", () => {
        const user = fakeUser();
        const paths = project(user);
        const id = trustProject(paths);
        chmodSync(paths.projectLocalDir, 0o755);
        expect(checkProject(paths)).toMatchObject({ state: "unsafe", id: null });
        expect(trustProject(paths)).not.toBe(id);
    });

    test("a symlinked local/ is unsafe", () => {
        const user = fakeUser();
        const paths = project(user);
        mkdirSync(paths.projectToolDir, { recursive: true });
        symlinkSync(temp(), paths.projectLocalDir);
        expect(checkProject(paths).state).toBe("unsafe");
        expect(() => trustProject(paths)).toThrow("real directory");
    });

    test("with no user scope there are no trust records", () => {
        const user = fakeUser();
        mkdirSync(join(user.project, ".tikoci"));
        const paths = resolveTikociPaths("centrs", { env: {}, cwd: user.project, homedir: undefined });
        expect(paths.project).toBeNull();
        const named = resolveTikociPaths("centrs", { env: { TIKOCI_PROJECT: user.project }, cwd: user.project });
        expect(checkProject(named).state).toBe("none");
    });
});

describe("layout.tsv", () => {
    const COLUMNS = ["tool", "item", "class", "scope", "path", "today", "owner", "lifecycle", "backup", "override", "migration", "notes"];
    const CLASSES = new Set(["config", "secret", "state", "cache", "runtime", "host-wide", "install"]);
    const SCOPES = new Set(["user", "project", "checkout", "install", "host", "process"]);
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

    test("caches live under TIKOCI_CACHE_DIR; config and secrets never do", () => {
        for (const row of rows) {
            if (row[2] === "cache" && row[3] === "user") expect(row[4], row[1]).toMatch(/TIKOCI_CACHE_DIR|^open:|^unchanged/);
            if (row[2] === "secret" || row[2] === "config") expect(row[4], row[1]).not.toMatch(/TIKOCI_CACHE_DIR/);
        }
    });

    test("in a project, secrets and state live in local/; what travels is config", () => {
        for (const row of rows.filter(row => row[3] === "project")) {
            if (row[2] === "secret" || row[2] === "state") expect(row[4], row[1]).toMatch(/\/local\//);
            else expect(row[2], row[1]).toBe("config");
        }
    });
});
