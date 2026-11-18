// tikoci starting release plan. Save as scripts/release-plan.ts; see tikoci-release.
//
// Every release decision lives here, as functions a unit test can call;
// release.example.yml only runs it. The committed package.json version picks
// the channel, never a workflow input:
//
//   X.Y.Z-next   publishes X.Y.Z-next.<run number> to `next`, with no tag or
//                GitHub Release; CHANGELOG.md has a `## X.Y.Z — next` section.
//   X.Y.Z        publishes X.Y.Z to `latest`, moves `next` onto it, and tags
//                vX.Y.Z; CHANGELOG.md has a non-empty `## X.Y.Z — YYYY-MM-DD`.
//
// Any other shape fails. Nothing here writes package.json or CHANGELOG.md:
// the version bump and the dated heading are a person's commit, in a PR.
//
//   bun scripts/release-plan.ts check                  # offline, in `bun run check`
//   bun scripts/release-plan.ts plan --run-number 42   # key=value lines for $GITHUB_OUTPUT
//   bun scripts/release-plan.ts notes 1.2.3            # the CHANGELOG section, for the release
//
// The run number counts per workflow file and restarts when the file is
// renamed, so keep its name; the npm trusted publisher names it too.
import { readFileSync } from "node:fs";

export type Channel = "next" | "latest";

export interface Plan {
    channel: Channel;
    version: string;
    /** The git tag and GitHub Release, for `latest` only. */
    tag: string | null;
    /** dist-tags moved onto this version after it is published. */
    alsoTag: Channel[];
}

/** What the registry already has: published versions and the dist-tags. */
export interface Registry {
    versions: string[];
    distTags: Partial<Record<string, string>>;
}

// Canonical SemVer numbers: npm would publish 01.2.0 as 1.2.0, and the tag
// and the used-version check would then name a different version.
const NUMBER = "(?:0|[1-9]\\d*)";
const XYZ = `${NUMBER}\\.${NUMBER}\\.${NUMBER}`;
const COMMITTED = new RegExp(`^(${XYZ})(-next)?$`);
const HEADING = new RegExp(`^## (${XYZ}) [—-] (next|\\d{4}-\\d{2}-\\d{2})\\s*$`);

/** A line that records a change: not blank, not a heading, not a comment. */
const isEntry = (line: string) => /\S/.test(line) && !/^\s*(#|<!--)/.test(line);

/** The CHANGELOG section for `version`: its label (`next` or a date) and body. */
export function changelogSection(changelog: string, version: string): { label: string; body: string } | null {
    const lines = changelog.split(/\r?\n/);
    const start = lines.findIndex((line) => HEADING.exec(line)?.[1] === version);
    if (start < 0) return null;
    const label = HEADING.exec(lines[start] ?? "")?.[2] ?? "";
    let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
    if (end < 0) end = lines.length;
    return { label, body: lines.slice(start + 1, end).join("\n").trim() };
}

/**
 * The offline half of the plan: the committed version's shape and its
 * CHANGELOG section. `bun run check` runs it, so a PR that bumps one without
 * the other fails there, not at release time.
 */
export function checkCommitted(committed: string, changelog: string): { base: string; preview: boolean } {
    const match = COMMITTED.exec(committed);
    if (!match) {
        throw new Error(`package.json version ${committed} is neither X.Y.Z nor X.Y.Z-next`);
    }
    const base = match[1] ?? "";
    const preview = match[2] !== undefined;
    const section = changelogSection(changelog, base);
    if (preview && section?.label !== "next") {
        throw new Error(`CHANGELOG.md has no "## ${base} — next" section for package.json ${committed}`);
    }
    if (!preview) {
        if (!section || section.label === "next") {
            throw new Error(`CHANGELOG.md has no dated "## ${base} — YYYY-MM-DD" section`);
        }
        if (!section.body.split("\n").some(isEntry)) {
            throw new Error(`CHANGELOG.md section ${base} lists no changes`);
        }
    }
    return { base, preview };
}

export function planRelease(input: {
    committed: string;
    runNumber: number;
    changelog: string;
    registry: Registry;
}): Plan {
    const { committed, runNumber, changelog, registry } = input;
    const { base, preview } = checkCommitted(committed, changelog);
    if (preview && (!Number.isInteger(runNumber) || runNumber < 1)) {
        throw new Error(`run number ${runNumber} is not a positive integer`);
    }
    const version = preview ? `${base}-next.${runNumber}` : base;
    if (registry.versions.includes(version)) {
        throw new Error(`${version} is already published; bump package.json`);
    }
    // Neither channel may move backwards. X.Y.Z-next.N sorts below X.Y.Z, so
    // a preview of a version that shipped is refused, and a preview numbered
    // below the current `next` (a renamed workflow restarts the run number)
    // is too.
    const { latest, next } = registry.distTags;
    if (latest && Bun.semver.order(version, latest) <= 0) {
        throw new Error(`${version} is not newer than latest ${latest}`);
    }
    if (preview) {
        if (next && Bun.semver.order(version, next) <= 0) {
            throw new Error(`${version} is not newer than next ${next}`);
        }
        return { channel: "next", version, tag: null, alsoTag: [] };
    }
    // A stable release moves `next` onto itself only when `next` is older,
    // so it never lags `latest` and never goes backwards either.
    const moveNext = !next || Bun.semver.order(next, version) < 0;
    return { channel: "latest", version, tag: `v${version}`, alsoTag: moveNext ? ["next"] : [] };
}

/** The registry document for `name`; a package never published is empty. */
export async function readRegistry(name: string): Promise<Registry> {
    // The whole name is one path segment (@scope%2Fname); the registry is the
    // only host this asks, by design.
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const response = await fetch(url, { headers: { accept: "application/vnd.npm.install-v1+json" } });
    if (response.status === 404) return { versions: [], distTags: {} };
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    const doc = (await response.json()) as { versions?: object; "dist-tags"?: Record<string, string> };
    return { versions: Object.keys(doc.versions ?? {}), distTags: doc["dist-tags"] ?? {} };
}

if (import.meta.main) {
    const [command, arg, value] = process.argv.slice(2);
    const changelog = readFileSync("CHANGELOG.md", "utf8");
    try {
        if (command === "check") {
            const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
            checkCommitted(pkg.version, changelog);
        } else if (command === "notes" && arg) {
            const section = changelogSection(changelog, arg);
            if (!section?.body) throw new Error(`no CHANGELOG.md section for ${arg}`);
            console.log(section.body);
        } else if (command === "plan" && arg === "--run-number" && value) {
            const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string; version: string };
            const plan = planRelease({
                committed: pkg.version,
                runNumber: Number(value),
                changelog,
                registry: await readRegistry(pkg.name),
            });
            console.log(`name=${pkg.name}`);
            console.log(`channel=${plan.channel}`);
            console.log(`version=${plan.version}`);
            console.log(`tag=${plan.tag ?? ""}`);
            console.log(`also-tag=${plan.alsoTag.join(",")}`);
        } else {
            throw new Error("usage: release-plan.ts check | plan --run-number N | notes X.Y.Z");
        }
    } catch (error) {
        console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
