import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = Bun.YAML.parse(readFileSync(new URL("../.github/workflows/deploy-pages.yaml", import.meta.url), "utf-8"));
// Execute the actual first step: rejected requests must stop before checkout,
// collection, snapshot commits or artifact uploads can have side effects.
const guard = workflow.jobs.deploy.steps[0].run;

test.each([
    ["1", "refs/heads/main", 0],
    ["2", "refs/heads/main", 1],
    ["1", "refs/heads/topic", 1],
    ["1", "refs/tags/v1", 1],
])("deployment attempt %s from %s exits %i", (attempt, ref, exitCode) => {
    const result = Bun.spawnSync(["bash", "-e", "-c", guard], {
        env: { ...process.env, GITHUB_RUN_ATTEMPT: attempt, GITHUB_REF: ref },
    });
    expect(result.exitCode).toBe(exitCode);
    if (exitCode !== 0) {
        expect(result.stdout.toString()).toContain("::error::");
        expect(result.stdout.toString()).toContain("gh workflow run deploy-pages.yaml --ref main");
    }
});
