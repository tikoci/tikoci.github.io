const FORM_DATA_BOUNDARY = "----FormDataVariable";

const CONTENT_TYPE_HEADER_MAP = {
    aac: "audio/aac",
    abw: "application/x-abiword",
    arc: "application/x-freearc",
    avi: "video/x-msvideo",
    azw: "application/vnd.amazon.ebook",
    bin: "application/octet-stream",
    bmp: "image/bmp",
    bz: "application/x-bzip",
    bz2: "application/x-bzip2",
    csh: "application/x-csh",
    css: "text/css",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    eot: "application/vnd.ms-fontobject",
    epub: "application/epub+zip",
    gif: "image/gif",
    htm: "text/html",
    html: "text/html",
    ico: "image/vnd.microsoft.icon",
    ics: "text/calendar",
    jar: "application/java-archive",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "text/javascript",
    json: "application/json",
    jsonld: "application/ld+json",
    mid: "audio/midi",
    midi: "audio/midi",
    mjs: "text/javascript",
    mp3: "audio/mpeg",
    mpeg: "video/mpeg",
    mpkg: "application/vnd.apple.installer+xml",
    odp: "application/vnd.oasis.opendocument.presentation",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odt: "application/vnd.oasis.opendocument.text",
    oga: "audio/ogg",
    ogv: "video/ogg",
    ogx: "application/ogg",
    otf: "font/otf",
    png: "image/png",
    pdf: "application/pdf",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    rar: "application/x-rar-compressed",
    rtf: "application/rtf",
    sh: "application/x-sh",
    svg: "image/svg+xml",
    swf: "application/x-shockwave-flash",
    tar: "application/x-tar",
    tif: "image/tiff",
    tiff: "image/tiff",
    ts: "video/mp2t",
    ttf: "font/ttf",
    txt: "text/plain",
    vsd: "application/vnd.visio",
    wav: "audio/wav",
    weba: "audio/webm",
    webm: "video/webm",
    webp: "image/webp",
    woff: "font/woff",
    woff2: "font/woff2",
    xhtml: "application/xhtml+xml",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xml: "text/xml",
    xul: "application/vnd.mozilla.xul+xml",
    zip: "application/zip",
    "3gp": "video/3gpp",
    "7z": "application/x-7z-compressed",
    "7-zip": "application/x-7z-compressed",
};

export const ROUTEROS_FETCH_STYLE_OPTIONS = [
    "plain",
    "outputToConsole",
    "outputToVariable",
    "outputToVariableWithHeaders",
    "outputToFile",
];

export const ROUTEROS_FETCH_COMMENTARY_OPTIONS = ["none", "errors", "all"];

export function getRouterOSFetchOptions() {
    return [
        {
            name: "Snippet output type",
            id: "style",
            availableOptions: ROUTEROS_FETCH_STYLE_OPTIONS,
            type: "enum",
            default: "outputToConsole",
            description: 'Control the flavor ("style") of generated snippets',
        },
        {
            name: "Additional commentary",
            id: "commentary",
            availableOptions: ROUTEROS_FETCH_COMMENTARY_OPTIONS,
            type: "enum",
            default: "all",
            description: "Enables output of errors and tips",
        },
    ];
}

export function escapeRouterOSString(str, quote = true) {
    const source = String(str ?? "");
    let escapedStr = "";

    const toHex = (char) => {
        const code = char.charCodeAt(0);
        if (code === 10) return "\\n";
        if (code === 13) return "\\r";
        if (code === 9) return "\\t";
        if (code === 7) return "\\a";
        if (code === 8) return "\\b";
        if (code === 12) return "\\f";
        if (code === 11) return "\\v";
        return `\\${`0${code.toString(16)}`.slice(-2).toUpperCase()}`;
    };

    for (const char of source) {
        const code = char.charCodeAt(0);
        if (code < 32 || code > 127) {
            escapedStr += toHex(char);
        } else if (char === "\\") {
            escapedStr += "\\\\";
        } else if (char === '"') {
            escapedStr += '\\"';
        } else if (char === "$") {
            escapedStr += "\\$";
        } else {
            escapedStr += char;
        }
    }

    return quote ? `"${escapedStr}"` : escapedStr;
}

export function normalizeCurlConverterRequest(request = {}) {
    const headers = normalizeHeaders(request.headers);
    const auth =
        request.auth && typeof request.auth === "object"
            ? {
                  type: request.auth_type || "basic",
                  username: request.auth.user || "",
                  password: request.auth.password || "",
              }
            : undefined;

    let body;
    if (request.files && Object.keys(request.files).length > 0) {
        body = {
            mode: "formdata",
            formdata: [
                ...objectEntriesToParams(request.data, "text"),
                ...objectEntriesToParams(request.files, "file"),
            ],
        };
    } else if (request.data !== undefined) {
        const contentType = getHeaderValue(headers, "Content-Type");
        const mediaType = getMediaType(contentType);
        if (mediaType === "application/x-www-form-urlencoded" && isPlainObject(request.data)) {
            body = {
                mode: "urlencoded",
                urlencoded: objectEntriesToParams(request.data, "text"),
            };
        } else if (typeof request.data === "string") {
            body = {
                mode: "raw",
                raw: request.data,
            };
        } else {
            body = {
                mode: "raw",
                raw: JSON.stringify(request.data),
            };
        }
    }

    return {
        method: String(request.method || "GET").toUpperCase(),
        url: String(request.raw_url || request.url || ""),
        headers,
        auth,
        body,
        followRedirects: request.follow_redirects === true,
        compressed: request.compressed === true,
        insecure: request.insecure === true,
    };
}

export function generateRouterOSFetch(requestLike, options = {}) {
    const request = normalizeRouterOSFetchRequest(requestLike);
    const effectiveHeaders = getEffectiveHeaders(request);
    const sanitizedOptions = sanitizeOptions(options, getRouterOSFetchOptions());
    const logLevel = commentaryToLogLevel(sanitizedOptions.commentary);

    const attrs = new Map();
    const problems = [];
    const tips = [];
    const command = [];

    if (["DELETE", "GET", "HEAD", "POST", "PUT", "PATCH"].includes(request.method)) {
        attrs.set("http-method", request.method.toLowerCase());
    } else {
        problems.push(`* invalid http method ${request.method} used`);
    }

    if (request.urlAuth?.username) {
        attrs.set("user", escapeRouterOSString(request.urlAuth.username));
    }
    if (request.urlAuth?.password) {
        attrs.set("password", escapeRouterOSString(request.urlAuth.password));
    }

    if (request.auth?.type) {
        switch (request.auth.type) {
            case "basic":
            case "digest":
                attrs.set("http-auth-scheme", request.auth.type);
                attrs.set("user", escapeRouterOSString(request.auth.username || ""));
                attrs.set("password", escapeRouterOSString(request.auth.password || ""));
                break;
            default:
                problems.push(`* unsupported authentication method used: ${request.auth.type}`);
                break;
        }
    }

    attrs.set("url", escapeRouterOSString(request.url));

    if (request.followRedirects) {
        problems.push("* RouterOS /tool/fetch does not follow redirects; requested -L/--location will not be replicated");
    }
    if (request.compressed) {
        problems.push("* curl requested automatic compressed response handling; RouterOS /tool/fetch has no equivalent flag");
    }
    if (request.insecure) {
        tips.push(
            "curl disabled TLS certificate verification; RouterOS /tool/fetch defaults to check-certificate=no unless you explicitly opt in.",
        );
    }
    if (request.body?.mode === "file") {
        problems.push("* direct local file uploads need manual adaptation before they can run on RouterOS");
    }
    const hasMultipartFiles =
        request.body?.mode === "formdata" &&
        request.body.formdata.some((item) => item.type === "file" && item.disabled !== true);
    if (hasMultipartFiles) {
        problems.push(
            "* multipart file upload via /tool/fetch requires manual adaptation: the referenced file must already exist on the RouterOS device as a plain-text file. " +
                "RouterOS /tool/fetch has no native file-upload support; the generated $[/file get <name> contents] expression reads the file at script runtime. " +
                "For binary files or more complex payloads, consider using [:convert] and newer /file commands to construct the multipart body manually.",
        );
    }

    const body = request.body ? getBody(request) : "";
    if (body) {
        let escapedBody = escapeRouterOSString(body);
        // $[/file get ...] is a RouterOS expression that must be interpolated at runtime;
        // escapeRouterOSString escapes '$' → '\$' globally (see its char === "$" branch),
        // so we must restore '\$[' → '$[' for RouterOS command-substitution expressions.
        // NOTE: if escapeRouterOSString's '$' handling changes, update this regex accordingly.
        if (hasMultipartFiles) {
            escapedBody = escapedBody.replace(/\\\$\[/g, "$[");
        }
        attrs.set("http-data", escapedBody);
        const contentEncoding = getHeaderValue(effectiveHeaders, "Content-Encoding");
        if (contentEncoding?.startsWith("gzip")) {
            attrs.set("http-content-encoding", "gzip");
        } else if (contentEncoding?.startsWith("deflate")) {
            attrs.set("http-content-encoding", "deflate");
        }
    }

    let headers = getHeaderFields(effectiveHeaders);
    headers = headers.map((header) => {
        if (header.includes("%") || header.includes(",")) {
            problems.push(`* Special characters in headers have many interpretations, check escaping - ${header} `);
        }
        return escapeRouterOSString(header);
    });
    if (headers.length === 1) {
        if (headers[0].includes(",")) {
            headers[0] = headers[0].replaceAll(",", "\\\\,");
        }
        attrs.set("http-header-field", headers[0]);
    } else if (headers.length > 1) {
        attrs.set("http-header-field", `(${headers.join(",")})`);
    }

    command.push("/tool/fetch");
    for (const [key, value] of attrs.entries()) {
        const attr = `${key}=${value}`;
        if (attr.length > 4096) {
            problems.push(`* '${key}=' may be too long for RouterOS`);
        }
        command.push(attr);
    }

    const styles = {
        plain: command.join(" "),
        outputToConsole: `:put ([${command.join(" ")} as-value output=user]->"data")`,
        outputToVariable: `:global resp [${command.join(" ")} as-value output=user]`,
        outputToVariableWithHeaders: `:global resp [${command.join(" ")} as-value output=user-with-headers ]`,
        outputToFile: `${command.join(" ")} output=file`,
    };

    let snippet = "";
    if (problems.length > 0 && logLevel > 0) {
        snippet += "#\t\t*** PROBLEMS ***\r\n";
        snippet += "#  Warning: Some conversion errors were found:\r\n";
        for (const problem of problems) {
            snippet += `#    ${problem}\r\n`;
        }
        snippet += "\r\n";
    }

    const contentType = getHeaderValue(effectiveHeaders, "Content-Type");
    if (contentType === "application/json") {
        tips.push('RouterOS can parse JSON responses with :deserialize (($resp->"data") from=json).');
        if (logLevel > 1) {
            snippet += "#\t\t*** TIPS: Parsing JSON ***\r\n";
            snippet += "#  Your request may return a JSON response.\r\n";
            snippet += "#  RouterOS has support to parse the JSON string data returned into RouterOS array.\r\n";
            snippet += "#  For example,\r\n";
            snippet += `#\t${styles.outputToVariable}\r\n`;
            snippet += '#\t:global json [:deserialize ($resp->"data") from=json]\r\n';
            snippet += "#\t:put $json\r\n";
            snippet += "\r\n";
        }
    }

    const isJsonRequest = contentType === "application/json";
    const jsonDeserializeExample = isJsonRequest
        ? `:global resp [${command.join(" ")} as-value output=user]\r\n:global json [:deserialize ($resp->"data") from=json]\r\n:put $json`
        : "";

    return {
        snippet: `${snippet}${styles[sanitizedOptions.style]}`,
        problems,
        tips,
        request,
        options: sanitizedOptions,
        styles,
        jsonDeserializeExample,
    };
}

export function generateRouterOSFetchSnippet(requestLike, options = {}) {
    return generateRouterOSFetch(requestLike, options).snippet;
}

function commentaryToLogLevel(commentary) {
    if (commentary === "errors") return 1;
    if (commentary === "none") return 0;
    return 2;
}

function sanitizeOptions(options, optionDefs) {
    const sanitized = {};
    for (const def of optionDefs) {
        const value = options[def.id];
        if (def.type === "enum" && !def.availableOptions.includes(value)) {
            sanitized[def.id] = def.default;
        } else if (value === undefined) {
            sanitized[def.id] = def.default;
        } else {
            sanitized[def.id] = value;
        }
    }
    return sanitized;
}

function normalizeRouterOSFetchRequest(requestLike = {}) {
    if (requestLike.body?.mode || requestLike.urlAuth || Array.isArray(requestLike.headers)) {
        return {
            method: String(requestLike.method || "GET").toUpperCase(),
            url: String(requestLike.url || ""),
            headers: normalizeHeaders(requestLike.headers),
            auth: normalizeAuth(requestLike.auth),
            body: normalizeBody(requestLike.body),
            urlAuth: normalizeUrlAuth(requestLike.urlAuth),
            followRedirects: requestLike.followRedirects === true,
            compressed: requestLike.compressed === true,
            insecure: requestLike.insecure === true,
        };
    }

    if (
        "raw_url" in requestLike ||
        "data" in requestLike ||
        "files" in requestLike ||
        "queries" in requestLike ||
        (requestLike.headers && !Array.isArray(requestLike.headers))
    ) {
        return normalizeCurlConverterRequest(requestLike);
    }

    return {
        method: String(requestLike.method || "GET").toUpperCase(),
        url: String(requestLike.url || ""),
        headers: normalizeHeaders(requestLike.headers),
        auth: normalizeAuth(requestLike.auth),
        body: normalizeBody(requestLike.body),
        urlAuth: normalizeUrlAuth(requestLike.urlAuth),
        followRedirects: requestLike.followRedirects === true,
        compressed: requestLike.compressed === true,
        insecure: requestLike.insecure === true,
    };
}

function normalizeUrlAuth(auth) {
    if (!auth || typeof auth !== "object") return undefined;
    return {
        username: String(auth.username || auth.user || ""),
        password: String(auth.password || ""),
    };
}

function normalizeAuth(auth) {
    if (!auth || typeof auth !== "object") return undefined;
    return {
        type: auth.type || "basic",
        username: String(auth.username || auth.user || ""),
        password: String(auth.password || ""),
    };
}

function normalizeBody(body) {
    if (!body || typeof body !== "object") return undefined;

    switch (body.mode) {
        case "urlencoded":
            return {
                mode: "urlencoded",
                urlencoded: Array.isArray(body.urlencoded) ? body.urlencoded.map(normalizeParam) : [],
            };
        case "formdata":
            return {
                mode: "formdata",
                formdata: Array.isArray(body.formdata) ? body.formdata.map(normalizeFormdataParam) : [],
            };
        case "graphql":
            return {
                mode: "graphql",
                graphql: {
                    query: String(body.graphql?.query || ""),
                    variables: String(body.graphql?.variables || "{}"),
                },
            };
        case "file":
            return {
                mode: "file",
                file: {
                    src: body.file?.src,
                },
            };
        default:
            return {
                mode: "raw",
                raw: String(body.raw || ""),
            };
    }
}

function normalizeHeaders(headers) {
    if (!headers) return [];
    if (Array.isArray(headers)) {
        return headers
            .filter(Boolean)
            .map((header) => ({
                name: String(header.name || header.key || ""),
                value: header.value === undefined || header.value === null ? "" : String(header.value),
                disabled: header.disabled === true,
            }))
            .filter((header) => header.name);
    }

    if (typeof headers === "object") {
        return Object.entries(headers)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([name, value]) => ({
                name,
                value: String(value),
                disabled: false,
            }));
    }

    return [];
}

function normalizeParam(param) {
    return {
        key: String(param.key || ""),
        value: param.value === undefined || param.value === null ? "" : String(param.value),
        disabled: param.disabled === true,
    };
}

function normalizeFormdataParam(param) {
    return {
        key: String(param.key || ""),
        type: param.type === "file" ? "file" : "text",
        value: param.value === undefined || param.value === null ? "" : String(param.value),
        src: param.src,
        disabled: param.disabled === true,
        contentType: param.contentType || undefined,
    };
}

function getEffectiveHeaders(request) {
    const headers = request.headers.map((header) => ({ ...header }));
    const mode = request.body?.mode;

    if (mode === "formdata") {
        upsertHeader(headers, "Content-Type", `multipart/form-data; boundary=${FORM_DATA_BOUNDARY}`);
    } else if (mode === "file" && !hasHeader(headers, "Content-Type")) {
        headers.push({ name: "Content-Type", value: "text/plain", disabled: false });
    } else if (mode === "graphql" && !hasHeader(headers, "Content-Type")) {
        headers.push({ name: "Content-Type", value: "application/json", disabled: false });
    }

    return headers;
}

function hasHeader(headers, name) {
    return headers.some((header) => header.disabled !== true && header.name.toLowerCase() === name.toLowerCase());
}

function getHeaderValue(headers, name) {
    const header = headers.find((entry) => entry.disabled !== true && entry.name.toLowerCase() === name.toLowerCase());
    return header?.value;
}

function upsertHeader(headers, name, value) {
    const existing = headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        existing.value = value;
        existing.disabled = false;
        return;
    }
    headers.push({ name, value, disabled: false });
}

function getHeaderFields(headers) {
    return headers
        .filter((header) => header.disabled !== true)
        .map((header) => `${header.name}: ${header.value}`);
}

function getBody(request) {
    if (!request.body) return "";

    switch (request.body.mode) {
        case "raw":
            return request.body.raw || "";
        case "graphql":
            return buildGraphqlBody(request.body.graphql);
        case "urlencoded":
            return request.body.urlencoded
                .filter((param) => param.disabled !== true)
                .map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
                .join("&");
        case "formdata":
            return buildFormDataBody(request.body.formdata);
        case "file":
            return '"<file contents here>"';
        default:
            return "";
    }
}

function buildGraphqlBody(graphql = {}) {
    let variables = {};
    try {
        variables = JSON.parse(graphql.variables || "{}");
    } catch {
        variables = {};
    }
    return JSON.stringify({
        query: graphql.query || "",
        variables,
    });
}

function buildFormDataBody(formdata = []) {
    const properties = expandFormdataItems(formdata).filter((item) => item.disabled !== true);
    const numberOfProperties = properties.length;
    let requestBody = "";

    if (numberOfProperties > 1) {
        requestBody += `--${FORM_DATA_BOUNDARY}\n`;
    }

    properties.forEach((property, index) => {
        if (property.type === "text") {
            requestBody += 'Content-Disposition: form-data; name="';
            requestBody += `${property.key}"\r\n`;
            if (property.contentType) {
                requestBody += `Content-Type: ${property.contentType}\r\n`;
            }
            requestBody += `\r\n${property.value}\r\n`;
        } else if (property.type === "file") {
            const filePath = typeof property.src === "string" ? property.src : "/path/to/file";
            const fileName = basename(filePath);
            const fileExtension = fileName.includes(".") ? fileName.split(".")[1]?.toLowerCase() : "";
            requestBody += 'Content-Disposition: form-data; name="';
            requestBody += `${property.key}"; filename="${fileName}"\r\n`;
            if (fileExtension && CONTENT_TYPE_HEADER_MAP[fileExtension]) {
                requestBody += `Content-Type: ${CONTENT_TYPE_HEADER_MAP[fileExtension]}\r\n\r\n`;
            } else {
                requestBody += "Content-Type: <Content-Type header here>\r\n\r\n";
            }
            requestBody += `$[/file get ${fileName} contents]\r\n`;
        }

        if (index === numberOfProperties - 1) {
            requestBody += `--${FORM_DATA_BOUNDARY}--\r\n`;
        } else {
            requestBody += `--${FORM_DATA_BOUNDARY}\r\n`;
        }
    });

    return requestBody;
}

function expandFormdataItems(formdata) {
    const expanded = [];
    for (const param of formdata) {
        if (param.type === "file") {
            if (typeof param.src === "string") {
                expanded.push(param);
            } else if (Array.isArray(param.src) && param.src.length > 0) {
                for (const src of param.src) {
                    expanded.push({ ...param, src });
                }
            } else {
                expanded.push({ ...param, src: "/path/to/file" });
            }
        } else {
            expanded.push(param);
        }
    }
    return expanded;
}

function basename(filePath) {
    const source = String(filePath || "/path/to/file");
    const parts = source.split(/[\\/]/);
    return parts[parts.length - 1] || "file";
}

function objectEntriesToParams(value, type) {
    if (!value || typeof value !== "object") return [];

    const entries = [];
    for (const [key, rawValue] of Object.entries(value)) {
        if (Array.isArray(rawValue)) {
            for (const item of rawValue) {
                entries.push(makeParam(key, item, type));
            }
        } else {
            entries.push(makeParam(key, rawValue, type));
        }
    }
    return entries;
}

function makeParam(key, value, type) {
    if (type === "file") {
        return {
            key,
            type: "file",
            src: String(value),
            disabled: false,
        };
    }

    return {
        key,
        type: "text",
        value: value === undefined || value === null ? "" : String(value),
        disabled: false,
    };
}

function getMediaType(contentType = "") {
    return String(contentType).split(";", 1)[0].trim().toLowerCase();
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
