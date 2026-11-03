import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { generateReadmeRedirects } from "../scripts/generate-redirects";

const template = readFileSync(new URL("../src/404.html", import.meta.url), "utf-8");
const script = template.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

function visit(pathname, hash = "") {
    const navigations = [];
    const timers = [];
    const events = [];
    const main = { replaceChildren: value => { main.message = value; } };
    const document = {
        createElement: () => ({ append(...values) { this.children = values; } }),
        querySelector: () => main,
        head: { append: value => { document.tracker = value; } },
    };
    const plausible = (name, options) => events.push({ name, options });
    runInNewContext(script, {
        initThemeSwitcher() {}, TIKOCI: { owner: "tikoci" },
        location: { pathname, hash, replace: value => navigations.push(value) },
        document, window: { plausible },
        setTimeout: callback => timers.push(callback),
    });
    return { navigations, timers, events, main, document };
}

test("README redirects always open the README and finish once after tracking or timeout", () => {
    for (const path of ["/r/app-t3code", "/r/app-t3code/"]) {
        for (const hash of ["", "#installation", "#a%20b"]) {
            const result = visit(path, hash);
            const target = `https://github.com/tikoci/app-t3code#readme-ov-file`;
            expect(result.main.message.children[1].href).toBe(target);
            expect(result.events[0].name).toBe("Redirect");
            expect(result.events[0].options.props).toEqual({ kind: "readme", repo: "tikoci/app-t3code" });
            result.events[0].options.callback();
            result.timers[0]();
            expect(result.navigations).toEqual([target]);
        }
    }
});

test("blocked analytics cannot strand a redirect", () => {
    const result = visit("/r/new-repo");
    result.timers[0]();
    expect(result.navigations).toEqual(["https://github.com/tikoci/new-repo#readme-ov-file"]);
    const failed = visit("/r/new-repo");
    failed.document.tracker.onerror();
    expect(failed.navigations).toHaveLength(1);
});

test("ordinary missing paths and malformed destinations never redirect", () => {
    for (const path of ["/missing", "/r/", "/r/..", "/r/.", "/r/a/b", "/r/https://evil.example", "/r/%2f%2fevil", "/r/<script>"]) {
        const result = visit(path);
        expect(result.events).toEqual([]);
        expect(result.timers).toEqual([]);
        expect(result.main.message).toBeUndefined();
    }
});

test("known repos get real pages with a static fallback link", () => {
    const dist = mkdtempSync(join(tmpdir(), "tikoci-redirects-"));
    try {
        generateReadmeRedirects([{ name: "sample" }], dist);
        expect(readFileSync(join(dist, "r/sample/index.html"), "utf-8")).toContain("tikoci/sample#readme-ov-file");
        const html = readFileSync(join(dist, "r/app-t3code/index.html"), "utf-8");
        expect(html).toContain('href="https://github.com/tikoci/app-t3code#readme-ov-file"');
        expect(html).not.toContain("Page not found");
        expect(html).toContain('name="robots" content="noindex"');
        expect(() => generateReadmeRedirects([{ name: "../escape" }], dist)).toThrow();
    } finally {
        rmSync(dist, { recursive: true, force: true });
    }
});
