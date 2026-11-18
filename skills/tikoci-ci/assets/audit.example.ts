// tikoci starting dependency audit. Save as scripts/audit.ts, with
// `"audit": "bun scripts/audit.ts"` in package.json; see tikoci-ci,
// "Dependency audit". CI and the release workflow both run `bun run audit`,
// so the ignore list and the checks below exist once.
//
// It fails on any advisory, and on an audit that did not complete: Bun exits
// 1 for both, and a scoped registry it could not ask only prints a `warn:`
// line and exits 0, with that registry's packages unchecked.

/**
 * Advisories with no fixed release in range: the id, why it does not apply,
 * and when to drop it (tikoci-linting, suppressions).
 */
const IGNORE: string[] = [
    // "GHSA-xxxx-xxxx-xxxx", // reached only by <dev tool>; drop when <fix ships>
];

const ignoreArgs = IGNORE.map((id) => `--ignore=${id}`);

/** Bun's JSON report: package name to a non-empty list of advisories. */
export function isAdvisoryReport(report: unknown): boolean {
    if (typeof report !== "object" || report === null || Array.isArray(report)) return false;
    const entries = Object.values(report);
    return (
        entries.length > 0 &&
        entries.every(
            (advisories) =>
                Array.isArray(advisories) &&
                advisories.length > 0 &&
                advisories.every((a) => typeof a === "object" && a !== null && "id" in a && "severity" in a),
        )
    );
}

/** The verdict for one `bun audit --json` run; null means it passed. */
export function auditVerdict(exitCode: number, stdout: string, stderr: string): string | null {
    if (/^(warn|error):/m.test(stderr)) return "bun audit did not check every package (see its warnings above).";
    if (exitCode === 0) return null;
    let report: unknown;
    try {
        report = JSON.parse(stdout);
    } catch {
        report = undefined;
    }
    return isAdvisoryReport(report)
        ? "bun audit found advisories."
        : `bun audit did not complete (exit ${exitCode}), so nothing was checked.`;
}

if (import.meta.main) {
    const run = Bun.spawnSync(["bun", "audit", "--json", ...ignoreArgs], { stdout: "pipe", stderr: "pipe" });
    const stderr = run.stderr.toString();
    process.stderr.write(stderr);
    const verdict = auditVerdict(run.exitCode, run.stdout.toString(), stderr);
    if (verdict) {
        if (verdict.endsWith("found advisories.")) {
            // The readable report, for the log.
            Bun.spawnSync(["bun", "audit", ...ignoreArgs], { stdout: "inherit", stderr: "inherit" });
        }
        console.error(`::error::${verdict}`);
        process.exit(1);
    }
}
