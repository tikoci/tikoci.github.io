import { describe, expect, test } from "bun:test";

import { parseCurlCommand } from "../src/curlconverter.js";
import {
    generateRouterOSFetch,
    generateRouterOSFetchSnippet,
    normalizeCurlConverterRequest,
    ROUTEROS_FETCH_STYLE_OPTIONS,
} from "../src/routeros-fetch.js";

describe("routeros fetch generator", () => {
    test("preserves legacy header formatting for multi-header requests", () => {
        const snippet = generateRouterOSFetchSnippet(
            {
                method: "GET",
                url: "https://postman-echo.com/headers",
                headers: [
                    { name: "my-sample-header", value: "Lorem ipsum dolor sit amet" },
                    { name: "testing", value: "'singlequotes'" },
                    { name: "TEST", value: '"doublequotes"' },
                ],
            },
            { style: "plain", commentary: "errors" },
        );

        expect(snippet).toBe(
            '/tool/fetch http-method=get url="https://postman-echo.com/headers" http-header-field=("my-sample-header: Lorem ipsum dolor sit amet","testing: \'singlequotes\'","TEST: \\"doublequotes\\"")',
        );
    });

    test("preserves legacy form-data serialization", () => {
        const snippet = generateRouterOSFetchSnippet(
            {
                method: "POST",
                url: "https://postman-echo.com/post",
                body: {
                    mode: "formdata",
                    formdata: [
                        { key: "pl", value: "'a'", type: "text" },
                        { key: "qu", value: '"b"', type: "text" },
                        { key: "hdjkljh", value: "c", type: "text" },
                        { key: "sa", value: "d", type: "text" },
                        { key: "Special", value: "!@#$%&*()^_+=`~    ", type: "text" },
                        { key: "Not Select", value: "Disabled", type: "text", disabled: true },
                        { key: "more", value: ",./';[]}{\":?><|\\\\", type: "text" },
                    ],
                },
            },
            { style: "plain", commentary: "none" },
        );

        expect(snippet).toBe(
            '/tool/fetch http-method=post url="https://postman-echo.com/post" http-data="------FormDataVariable\\nContent-Disposition: form-data; name=\\"pl\\"\\r\\n\\r\\n\'a\'\\r\\n------FormDataVariable\\r\\nContent-Disposition: form-data; name=\\"qu\\"\\r\\n\\r\\n\\"b\\"\\r\\n------FormDataVariable\\r\\nContent-Disposition: form-data; name=\\"hdjkljh\\"\\r\\n\\r\\nc\\r\\n------FormDataVariable\\r\\nContent-Disposition: form-data; name=\\"sa\\"\\r\\n\\r\\nd\\r\\n------FormDataVariable\\r\\nContent-Disposition: form-data; name=\\"Special\\"\\r\\n\\r\\n!@#\\$%&*()^_+=`~    \\r\\n------FormDataVariable\\r\\nContent-Disposition: form-data; name=\\"more\\"\\r\\n\\r\\n,./\';[]}{\\":?><|\\\\\\\\\\r\\n------FormDataVariable--\\r\\n" http-header-field="Content-Type: multipart/form-data; boundary=----FormDataVariable"',
        );
    });

    test("supports all legacy style wrappers", () => {
        const request = {
            method: "GET",
            url: "https://example.com",
        };

        const snippets = Object.fromEntries(
            ROUTEROS_FETCH_STYLE_OPTIONS.map((style) => [
                style,
                generateRouterOSFetchSnippet(request, { style, commentary: "none" }),
            ]),
        );

        expect(snippets.plain).toBe('/tool/fetch http-method=get url="https://example.com"');
        expect(snippets.outputToConsole).toBe(
            ':put ([/tool/fetch http-method=get url="https://example.com" as-value output=user]->"data")',
        );
        expect(snippets.outputToVariable).toBe(
            ':global resp [/tool/fetch http-method=get url="https://example.com" as-value output=user]',
        );
        expect(snippets.outputToVariableWithHeaders).toBe(
            ':global resp [/tool/fetch http-method=get url="https://example.com" as-value output=user-with-headers ]',
        );
        expect(snippets.outputToFile).toBe('/tool/fetch http-method=get url="https://example.com" output=file');
    });

    test("preserves commentary warnings and JSON tip behavior", () => {
        const request = {
            method: "OPTIONS",
            url: "https://example.com/post",
            headers: [
                { name: "Content-Type", value: "application/json" },
                { name: "X-Test", value: "a,b" },
            ],
            body: {
                mode: "raw",
                raw: '{"hello":"world"}',
            },
        };

        const all = generateRouterOSFetchSnippet(request, { style: "plain", commentary: "all" });
        const errorsOnly = generateRouterOSFetchSnippet(request, { style: "plain", commentary: "errors" });
        const none = generateRouterOSFetchSnippet(request, { style: "plain", commentary: "none" });

        expect(all).toContain("*** PROBLEMS ***");
        expect(all).toContain("* invalid http method OPTIONS used");
        expect(all).toContain("* Special characters in headers have many interpretations, check escaping - X-Test: a,b ");
        expect(all).toContain("*** TIPS: Parsing JSON ***");
        expect(errorsOnly).toContain("*** PROBLEMS ***");
        expect(errorsOnly).not.toContain("*** TIPS: Parsing JSON ***");
        expect(none).not.toContain("*** PROBLEMS ***");
        expect(none).not.toContain("*** TIPS: Parsing JSON ***");
    });

    test("normalizes curlconverter JSON output for digest auth and JSON bodies", () => {
        const { request, warnings } = parseCurlCommand(
            `curl --digest -u user:pass https://example.com -H "Content-Type: application/json" -d "{\\"a\\":1}"`,
        );

        expect(warnings).toEqual([]);

        const snippet = generateRouterOSFetchSnippet(normalizeCurlConverterRequest(request), {
            style: "plain",
            commentary: "none",
        });

        expect(snippet).toBe(
            '/tool/fetch http-method=post http-auth-scheme=digest user="user" password="pass" url="https://example.com" http-data="{\\"a\\":1}" http-header-field="Content-Type: application/json"',
        );
    });

    test("normalizes curlconverter multipart requests into RouterOS form-data", () => {
        const { request, warnings } = parseCurlCommand(
            `curl https://example.com -F "name=value" -F "file=@project/test.txt"`,
        );

        expect(warnings).toEqual([]);

        const result = generateRouterOSFetch(normalizeCurlConverterRequest(request), {
            style: "plain",
            commentary: "none",
        });

        expect(result.snippet).toContain('http-header-field="Content-Type: multipart/form-data; boundary=----FormDataVariable"');
        expect(result.snippet).toContain('Content-Disposition: form-data; name=\\"name\\"');
        expect(result.snippet).toContain('name=\\"file\\"; filename=\\"test.txt\\"');
        // $[/file get ...] must not be escaped — RouterOS needs to interpolate the expression at runtime
        expect(result.snippet).toContain("$[/file get test.txt contents]");
        expect(result.snippet).not.toContain("\\$[/file get test.txt contents]");
        // warning should mention RouterOS limitations for file uploads
        expect(result.problems.join(" ")).toContain("RouterOS /tool/fetch has no native file-upload support");
        expect(result.problems.join(" ")).toContain("plain-text file");
    });

    test("keeps literal $[ in text form fields escaped when multipart files are present", () => {
        // A text field whose value contains $[ must remain escaped (\$[) so RouterOS does not
        // evaluate it as a command-substitution expression — only $[/file get ...] from file
        // parts should be unescaped.
        const result = generateRouterOSFetch(
            {
                method: "POST",
                url: "https://example.com",
                body: {
                    mode: "formdata",
                    formdata: [
                        { key: "expr", value: "$[some expression]", type: "text" },
                        { key: "upload", type: "file", src: "data.txt" },
                    ],
                },
            },
            { style: "plain", commentary: "none" },
        );

        // file expression must be interpolatable
        expect(result.snippet).toContain("$[/file get data.txt contents]");
        // text field with $[ must still be escaped so RouterOS treats it as a literal string
        expect(result.snippet).toContain("\\$[some expression]");
    });

    test("supports modern curlconverter flags such as --json and -L", () => {
        const { request, warnings } = parseCurlCommand(
            `curl -L --compressed -X PATCH --json "{\\"x\\":1}" https://example.com/item/1`,
        );

        expect(warnings).toEqual([]);

        const result = generateRouterOSFetch(normalizeCurlConverterRequest(request), {
            style: "plain",
            commentary: "all",
        });

        expect(result.snippet).toContain('http-method=patch');
        expect(result.snippet).toContain('http-data="{\\"x\\":1}"');
        expect(result.problems).toContain(
            "* RouterOS /tool/fetch does not follow redirects; requested -L/--location will not be replicated",
        );
        expect(result.problems).toContain(
            "* curl requested automatic compressed response handling; RouterOS /tool/fetch has no equivalent flag",
        );
        expect(result.tips).toContain('RouterOS can parse JSON responses with :deserialize (($resp->"data") from=json).');
    });

    test("keeps duplicate headers when downstream passes an array", () => {
        const snippet = generateRouterOSFetchSnippet(
            {
                method: "GET",
                url: "https://example.com",
                headers: [
                    { name: "X-Test", value: "a" },
                    { name: "X-Test", value: "b" },
                ],
            },
            { style: "plain", commentary: "none" },
        );

        expect(snippet).toBe(
            '/tool/fetch http-method=get url="https://example.com" http-header-field=("X-Test: a","X-Test: b")',
        );
    });
});
