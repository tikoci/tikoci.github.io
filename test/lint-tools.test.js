import { expect, test } from "bun:test";

// The Markdown gate has to be able to fail. markdownlint patches
// micromark-core-commonmark to find undefined references (MD052); when the
// lockfile nests a second copy under micromark, it patches the copy the parser
// never uses and MD052 passes everything (PR #31). Keep one copy.
test("markdownlint reports an undefined reference (MD052)", () => {
    const run = Bun.spawnSync(
        [process.execPath, "node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs", "--no-globs", "-"],
        { stdin: new TextEncoder().encode("# Probe\n\n[visible][missing]\n"), stdout: "pipe", stderr: "pipe" },
    );
    const output = run.stdout.toString() + run.stderr.toString();
    expect(output).toContain("MD052");
    expect(run.exitCode).toBe(1);
});
