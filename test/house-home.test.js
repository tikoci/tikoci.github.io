import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
    cacheRoot,
    checkProject,
    deriveLabel,
    discoverProject,
    findProject,
    gitWorktreeRoot,
    hermeticEnv,
    initProject,
    isValidLabel,
    LOCAL_GITIGNORE,
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

/** Make `worktree` a linked git worktree of `main` the way git lays it out, without running git. */
function gitWorktree(main, worktree) {
    const name = worktree.split("/").pop();
    const gitdir = join(main, ".git", "worktrees", name);
    mkdirSync(gitdir, { recursive: true });
    writeFileSync(join(gitdir, "commondir"), "../..\n");
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(worktree, ".git"), `gitdir: ${gitdir}\n`);
    return worktree;
}

describe("conformance.json", () => {
    const { cases, profiles, fields, labels } = JSON.parse(readFileSync(join(SKILL, "references", "conformance.json"), "utf8"));

    test("every case names known profiles, and every checked field belongs to one", () => {
        for (const needs of Object.values(profiles)) for (const need of needs) expect(Object.keys(profiles)).toContain(need);
        for (const profile of Object.values(fields)) expect(Object.keys(profiles)).toContain(profile);
        for (const spec of cases) {
            expect(spec.profiles.length).toBeGreaterThan(0);
            for (const profile of spec.profiles) expect(Object.keys(profiles)).toContain(profile);
            const checked = Object.entries(spec.expect).flatMap(([key, value]) =>
                key === "sources" ? Object.keys(value).map(k => `sources.${k}`) : [key]);
            for (const field of checked) expect(fields).toHaveProperty([field]);
        }
    });

    for (const { input, expect: label } of labels) {
        test(`label for ${JSON.stringify(input)}`, () => {
            expect(deriveLabel(input)).toBe(label);
            if (label !== null) expect(isValidLabel(label)).toBe(true);
        });
    }
    const fill = (value, root) => JSON.parse(JSON.stringify(value).replaceAll("{root}", root));

    for (const spec of cases) {
        test.skipIf(!spec.platform && !POSIX)(spec.name, () => {
            let root = "";
            if (spec.tree) {
                root = realpathSync(temp());
                for (const entry of spec.tree) {
                    if (typeof entry === "string") mkdirSync(join(root, entry), { recursive: true });
                    else if ("file" in entry) {
                        mkdirSync(join(root, entry.file, ".."), { recursive: true });
                        writeFileSync(join(root, entry.file), fill(entry.text, root));
                    } else {
                        mkdirSync(join(root, entry.link, ".."), { recursive: true });
                        symlinkSync(fill(entry.to, root), join(root, entry.link));
                    }
                }
            }
            const paths = resolveTikociPaths(spec.tool, { env: fill(spec.env, root), cwd: fill(spec.cwd, root), platform: spec.platform });
            expect(paths).toMatchObject(fill(spec.expect, root));
        });
    }
});

describe("scopes", () => {
    test("empty variables are unset; relative ones are errors; reserved names are not tools", () => {
        expect(resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_SANDBOX: " " }, cwd: "/", platform: "linux" }).sandboxed).toBe(false);
        expect(() => resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_HOME: "rel" }, cwd: "/", platform: "linux" })).toThrow("absolute");
        expect(() => resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_SANDBOX: "rel" }, cwd: "/", platform: "linux" })).toThrow("absolute");
        expect(() => resolveTikociPaths("x", { env: { HOME: "/u", TIKOCI_PROJECT: "rel" }, cwd: "/", platform: "linux" })).toThrow("absolute");
        expect(() => resolveTikociPaths("Bad/Name", { env: { HOME: "/u" }, platform: "linux" })).toThrow("tool name");
        expect(() => resolveTikociPaths("cache", { env: { HOME: "/u" }, platform: "linux" })).toThrow("reserved");
        expect(() => resolveTikociPaths("host", { env: { HOME: "/u" }, platform: "linux" })).toThrow("reserved");
    });

    test("the host scope follows the account's home even for a supplied env without one", () => {
        const paths = resolveTikociPaths("quickchr", { env: {}, cwd: "/", platform: "linux" });
        expect([paths.userScope, paths.hostDir]).toEqual([null, join(homedir(), ".tikoci", "host", "quickchr")]);
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
    test.skipIf(!POSIX)("another user's .tikoci/ is skipped", () => {
        const user = fakeUser();
        mkdirSync(join(user.project, ".tikoci"));
        const me = process.getuid();
        expect(discoverProject(user.deep, { env: user.env, uid: me })).toBe(user.project);
        expect(findProject(user.deep, { env: user.env, uid: me + 1 })).toEqual({ project: null, skipped: [join(user.project, ".tikoci")], worktree: null });
        expect(resolveTikociPaths("centrs", { env: user.env, cwd: user.deep, uid: me + 1 }).project).toBeNull();
    });

    test("a supplied env without cwd discovers nothing", () => {
        const user = fakeUser();
        mkdirSync(join(user.project, ".tikoci"));
        expect(resolveTikociPaths("centrs", { env: user.env }).project).toBeNull();
        expect(discoverProject(user.deep, { env: user.env })).toBe(user.project);
    });

    test("gitWorktreeRoot reads .git files without git", () => {
        const user = fakeUser();
        const main = join(user.home, "main");
        mkdirSync(join(main, ".git"), { recursive: true });
        expect(gitWorktreeRoot(main)).toBeNull();
        const feature = gitWorktree(main, join(user.home, "wt", "feature"));
        mkdirSync(join(feature, "src"));
        expect(gitWorktreeRoot(join(feature, "src"))).toEqual({ checkout: feature, main });
        expect(gitWorktreeRoot(user.root)).toBeNull();
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

    test("trusting writes a .gitignore inside local/ that survives a branch without the tool's", () => {
        const user = fakeUser();
        const paths = project(user);
        trustProject(paths);
        expect(readFileSync(join(paths.projectLocalDir, ".gitignore"), "utf8")).toBe(LOCAL_GITIGNORE);
        writeFileSync(join(paths.projectLocalDir, "winbox.cdb"), "secret");
        // A checkout on a branch without .tikoci/centrs/.gitignore: only local/'s own file holds.
        rmSync(join(paths.projectToolDir, ".gitignore"));
        expect(Bun.spawnSync(["git", "init", "-q", user.project]).exitCode).toBe(0);
        const status = Bun.spawnSync(["git", "-C", user.project, "status", "--porcelain", "--untracked-files=all"]).stdout.toString();
        expect(status).not.toContain("local/");
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

    test("an unsafe local/ in the nearest project is reported, not skipped for an outer one", () => {
        const user = fakeUser();
        trustProject(project(user));
        const inner = join(user.project, "vendor", "lib");
        mkdirSync(join(inner, ".tikoci", "centrs"), { recursive: true });
        symlinkSync(temp(), join(inner, ".tikoci", "centrs", "local"));
        const paths = resolveTikociPaths("centrs", { env: user.env, cwd: inner });
        expect(paths.localProject).toBe(inner);
        expect(checkProject(paths).state).toBe("unsafe");
    });

    test("a git worktree is trusted through its main checkout, wherever it is", () => {
        const user = fakeUser();
        initProject(user.project, "centrs");
        const worktree = gitWorktree(user.project, join(user.home, "wt", "feature"));
        initProject(worktree, "centrs");
        const paths = resolveTikociPaths("centrs", { env: user.env, cwd: worktree });
        expect([paths.project, paths.localProject, paths.sources.localProject]).toEqual([worktree, user.project, "git-worktree"]);
        expect(checkProject(paths).state).toBe("untrusted");
        // Trusting from the worktree trusts the main checkout; the worktree gets no local/ of its own.
        const id = trustProject(paths);
        expect(checkProject(resolveTikociPaths("centrs", { env: user.env, cwd: user.project }))).toEqual({ state: "trusted", id, reason: "" });
        expect(checkProject(paths)).toEqual({ state: "trusted", id, reason: "" });
        expect(statSync(join(worktree, ".tikoci", "centrs")).isDirectory()).toBe(true);
        expect(() => statSync(join(worktree, ".tikoci", "centrs", "local"))).toThrow();
    });

    test("trusting from a worktree before the main checkout adopts creates only a hidden local/ there", () => {
        const user = fakeUser();
        expect(Bun.spawnSync(["git", "init", "-q", user.project]).exitCode).toBe(0);
        const worktree = gitWorktree(user.project, join(user.home, "wt", "adopt"));
        initProject(worktree, "centrs");
        const paths = resolveTikociPaths("centrs", { env: user.env, cwd: worktree });
        expect(paths.projectLocalDir).toBe(join(user.project, ".tikoci", "centrs", "local"));
        const id = trustProject(paths);
        expect(checkProject(paths)).toEqual({ state: "trusted", id, reason: "" });
        expect(() => statSync(join(user.project, ".tikoci", "centrs", ".gitignore"))).toThrow();
        writeFileSync(join(paths.projectLocalDir, "winbox.cdb"), "secret");
        // Nothing for git to see, so merging the branch's tracked .tikoci/centrs/ later cannot collide.
        const status = Bun.spawnSync(["git", "-C", user.project, "status", "--porcelain", "--untracked-files=all"]).stdout.toString();
        expect(status).not.toContain(".tikoci");
    });

    test("a nested .tikoci/ that is not a worktree needs its own trust", () => {
        const user = fakeUser();
        trustProject(project(user));
        const lab = join(user.project, "examples", "cmr");
        const paths = project(user, lab);
        expect(paths.localProject).toBe(lab);
        expect(checkProject(paths).state).toBe("untrusted");
    });

    test("in a sandbox, a named worktree still maps to its main checkout, but only the sandbox's trust counts", () => {
        const user = fakeUser();
        trustProject(project(user));
        const worktree = gitWorktree(user.project, join(user.home, "wt", "feature"));
        initProject(worktree, "centrs");
        const sandbox = join(user.root, "sandbox");
        const paths = resolveTikociPaths("centrs", { env: { ...user.env, TIKOCI_SANDBOX: sandbox, TIKOCI_PROJECT: worktree }, cwd: worktree });
        expect(paths.localProject).toBe(user.project);
        expect(checkProject(paths).state).toBe("untrusted");
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

describe("labels", () => {
    test("an explicit label must already follow the DNS-style rules", () => {
        for (const ok of ["lab", "lab-2", "a", "x".repeat(63), "edge--lab"]) expect(isValidLabel(ok)).toBe(true);
        for (const bad of ["user", "Lab", "2lab", "-lab", "lab-", "lab_2", "lab.2", "", "x".repeat(64), "lab:2"]) expect(isValidLabel(bad)).toBe(false);
    });
});
