import { describe, expect, test } from "bun:test";

import {
    PAGES_SURVEY_SCHEMA_VERSION,
    classifyServe,
    deriveFindings,
    extractCrawlPaths,
    extractTitle,
    isStaleDomain,
    scanPlausibleHtml,
} from "../repo-github-pages";

describe("pages survey version", () => {
    test("schema version is 1", () => {
        expect(PAGES_SURVEY_SCHEMA_VERSION).toBe(1);
    });
});

describe("extractTitle", () => {
    test("extracts and decodes titles", () => {
        expect(extractTitle("<title>plain</title>")).toBe("plain");
        expect(extractTitle("<title>Site not found &middot; GitHub Pages</title>")).toBe("Site not found · GitHub Pages");
        expect(extractTitle("<title>A &amp; B</title>")).toBe("A & B");
        expect(extractTitle("<title>A&#38;B &#x41;</title>")).toBe("A&B A");
        expect(extractTitle("<title>\n  spaced\n</title>")).toBe("spaced");
        expect(extractTitle("<p>no title</p>")).toBeNull();
    });
});

describe("scanPlausibleHtml", () => {
    const OURS = '<script async src="https://plausible.io/js/pa-ubWop5eYckoDPVbIjXU4_.js"></script>';

    test("detects our hash-scoped install", () => {
        const scan = scanPlausibleHtml(`<html><head>${OURS}</head></html>`);
        expect(scan.present).toBe(true);
        expect(scan.script).toBe("pa-hash");
        expect(scan.dataDomain).toBeNull();
    });

    test("detects data-domain installs and strips query strings", () => {
        const scan = scanPlausibleHtml('<script defer data-domain="tikoci.github.io/restraml" src="https://plausible.io/js/script.tagged-events.js?v=2"></script>');
        expect(scan.present).toBe(true);
        expect(scan.script).toBe("script.tagged-events.js");
        expect(scan.dataDomain).toBe("tikoci.github.io/restraml");
    });

    test("handles multiline tags", () => {
        const scan = scanPlausibleHtml('<script defer data-domain="example.com"\n    src="https://plausible.io/js/script.js"></script>');
        expect(scan.present).toBe(true);
        expect(scan.dataDomain).toBe("example.com");
    });

    test("handles single-quoted attributes", () => {
        const scan = scanPlausibleHtml("<script src='https://plausible.io/js/script.js'></script>");
        expect(scan.present).toBe(true);
    });

    test("handles uppercase tags and attributes", () => {
        const scan = scanPlausibleHtml('<SCRIPT SRC="https://plausible.io/js/script.js"></SCRIPT>');
        expect(scan.present).toBe(true);
    });

    test("ignores commented-out snippets", () => {
        const scan = scanPlausibleHtml(`<!-- ${OURS} -->`);
        expect(scan.present).toBe(false);
    });

    test("ignores > inside earlier attributes", () => {
        const scan = scanPlausibleHtml('<script data-x="a>b" src="https://plausible.io/js/script.js"></script>');
        expect(scan.present).toBe(true);
    });

    test("collects custom events, ignoring comments", () => {
        const scan = scanPlausibleHtml(
            `${OURS}<script>plausible('Lookup Run'); plausible("Lookup Share"); plausible(\`Tpl\`); plausible('Lookup Run');</script><!-- plausible('Ghost') -->`,
        );
        expect(scan.events.sort()).toEqual(["Lookup Run", "Lookup Share", "Tpl"]);
    });

    test("reports absence", () => {
        const scan = scanPlausibleHtml("<html><head><title>x</title></head></html>");
        expect(scan).toEqual({ present: false, script: null, dataDomain: null, events: [] });
    });
});

describe("extractCrawlPaths", () => {
    test("finds same-origin html links, origin-absolute", () => {
        const paths = extractCrawlPaths(
            '<a href="/restraml/diff.html">d</a><a href="lookup.html">l</a><a href=\'single.html\'>s</a>' +
                '<a href="https://example.com/x.html">ext</a><a href="/img.png">png</a><a href="/restraml/">self</a>',
            "https://tikoci.dev/restraml/",
        );
        expect(paths).toEqual(["/restraml/diff.html", "/restraml/lookup.html", "/restraml/single.html"]);
    });

    test("normalizes trailing index.html to the directory", () => {
        expect(extractCrawlPaths('<a href="/restraml/index.html">i</a>', "https://tikoci.dev/restraml/diff.html")).toEqual(["/restraml/"]);
    });

    test("matches .HTML case-insensitively and skips comments", () => {
        const paths = extractCrawlPaths('<!-- <a href="/hidden.html">h</a> --><a href="/UP.HTML">u</a>', "https://tikoci.dev/");
        expect(paths).toEqual(["/UP.HTML"]);
    });
});

describe("classifyServe", () => {
    test("classifies visitor-visible states", () => {
        expect(classifyServe(200, null)).toBe("site");
        expect(classifyServe(404, "/README.md")).toBe("repo-as-web");
        expect(classifyServe(404, null)).toBe("empty");
        expect(classifyServe(null, null)).toBe("unknown");
        expect(classifyServe(500, null)).toBe("unknown");
    });
});

describe("isStaleDomain", () => {
    const org = ["postman-code-generators", "restraml", "nginx", "flent"];

    test("flags domains naming another repo", () => {
        expect(isStaleDomain("tikoci.github.io/restraml", "postman-code-generators", org)).toBe(true);
    });

    test("clears own repo and unrelated domains", () => {
        expect(isStaleDomain("tikoci.github.io/restraml", "restraml", org)).toBe(false);
        expect(isStaleDomain("tikoci.dev", "restraml", org)).toBe(false);
    });

    test("does not match on bare substrings", () => {
        // "enginex" contains "nginx" as a substring but is not the repo segment.
        expect(isStaleDomain("enginex.example.com", "restraml", org)).toBe(false);
    });
});

describe("deriveFindings", () => {
    const org = ["postman-code-generators", "restraml", "centrs", "fat-chr", "netinstall"];

    function repo(overrides) {
        return { name: "x", hasPages: true, state: "ok", ...overrides };
    }

    test("one finding per rule, severity-ordered", () => {
        const findings = deriveFindings(
            [
                repo({ name: "fat-chr", latestDeploy: null }),
                repo({
                    name: "postman-code-generators",
                    serve: { kind: "site", root: 200, title: "t", probeFile: null },
                    latestDeploy: { at: "t", ref: "r", sha: "s", state: "success" },
                    plausible: {
                        present: true,
                        script: "tagged-events",
                        dataDomain: "tikoci.github.io/restraml",
                        dataDomains: ["tikoci.github.io/restraml"],
                        pagesChecked: ["/x/"],
                        pagesWithSnippet: ["/x/"],
                        truncated: false,
                        events: [],
                    },
                }),
                repo({
                    name: "centrs",
                    serve: { kind: "site", root: 200, title: "t", probeFile: null },
                    latestDeploy: { at: "t", ref: "r", sha: "s", state: "success" },
                    plausible: { present: false, script: null, dataDomain: null, dataDomains: [], pagesChecked: ["/x/"], pagesWithSnippet: [], truncated: false, events: [] },
                }),
                repo({ name: "netinstall", serve: { kind: "repo-as-web", root: 404, title: null, probeFile: "/README.md" }, latestDeploy: { at: "t", ref: "r", sha: "s", state: "success" } }),
            ],
            org,
        );
        expect(findings.map((f) => f.id)).toEqual(["pages-never-deployed", "plausible-stale-domain", "plausible-missing", "pages-repo-as-web"]);
        expect(findings.map((f) => f.severity)).toEqual(["gap", "pending", "info", "info"]);
        expect(findings[1].repos).toEqual(["postman-code-generators"]);
    });

    test("lookup failures never read as never-deployed or missing", () => {
        const findings = deriveFindings(
            [
                repo({ name: "a", state: "partial", error: "deploy lookup failed" }),
                repo({ name: "b", state: "partial", serve: { kind: "site", root: 200, title: "t", probeFile: null }, error: "sweep failed" }),
            ],
            org,
        );
        expect(findings).toEqual([]);
    });
});
