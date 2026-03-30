// =====================================================================
// shared.js — Shared utilities for all tikoci.github.io pages
//
// Include via:  <script src="shared.js"></script>
// Then call initThemeSwitcher() after the DOM element exists.
//
// This file provides:
//   1. Theme switcher (3-state: auto → light → dark → auto)
//   2. GitHub API helpers (fetch repo contents, raw files)
//   3. Event-driven UI utilities (debounce, cancellation tokens)
//   4. Query string helpers (shareable URLs)
//   5. Share/copy button wiring
//   6. HTML escaping
//
// When adding shared behavior, change THIS file — not inline copies.
// =====================================================================


// --- Organization constants ------------------------------------------
const TIKOCI = Object.freeze({
    owner: 'tikoci',
    pagesUrl: 'https://tikoci.github.io',
})


// --- Brand gradient (random MikroTik-inspired gradient per page load) -
// Colors drawn from mikrotik.com/logo palette. Picked once per page load
// so hero and nav always match. Runs immediately — no DOM needed.
const _BRAND_GRADIENTS = [
    ['#C33366', '#692878'],
    ['#EE9B01', '#EE4F01'],
    ['#3660B9', '#5F2965'],
    ['#3BB5B6', '#44DE95'],
    ['#582D7C', '#1FC8DB'],
    ['#CF0F14', '#EE4F01'],
    ['#1F417A', '#87D3DB'],
    ['#015EA4', '#3BB5B6'],
    ['#017C65', '#A3D16E'],
    ['#692878', '#1FC8DB'],
];
(() => {
    const p = _BRAND_GRADIENTS[Math.floor(Math.random() * _BRAND_GRADIENTS.length)];
    document.documentElement.style.setProperty(
        '--brand-gradient', `linear-gradient(135deg, ${p[0]}, ${p[1]})`
    );
})();


// --- Theme switcher: auto → light → dark → auto ---------------------
// CRITICAL Pico CSS v2 gotcha: data-theme="auto" is NOT valid.
// For "auto" state, REMOVE the attribute so Pico follows OS preference.

const _THEME_ICONS = {
    sun: '<svg width="23px" height="23px" viewBox="0 0 16 16"><path fill="currentColor" d="M8 11a3 3 0 1 1 0-6a3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/></svg>',
    moon: '<svg width="23px" height="23px" viewBox="0 0 16 16"><g fill="currentColor"><path d="M6 .278a.768.768 0 0 1 .08.858a7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277c.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316a.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71C0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278zM4.858 1.311A7.269 7.269 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.316 7.316 0 0 0 5.205-2.162c-.337.042-.68.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29c0-1.167.242-2.278.681-3.286z"/><path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.734 1.734 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.734 1.734 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.734 1.734 0 0 0 1.097-1.097l.387-1.162zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L13.863.1z"/></g></svg>',
    osDefault: '<svg width="23px" height="23px" viewBox="0 0 16 16"><path fill="currentColor" d="M8 15A7 7 0 1 0 8 1v14zm0 1A8 8 0 1 1 8 0a8 8 0 0 1 0 16z"/></svg>',
};

// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages via <script>
function initThemeSwitcher(id, defaultTheme) {
    id = id || "theme_switcher";
    const html = document.documentElement;
    const el = document.getElementById(id);
    if (!el) return;
    let state = "auto";

    if (defaultTheme === "dark" || defaultTheme === "light") {
        state = defaultTheme;
        html.setAttribute("data-theme", defaultTheme);
        el.innerHTML = defaultTheme === "dark" ? _THEME_ICONS.moon : _THEME_ICONS.sun;
    } else {
        el.innerHTML = _THEME_ICONS.osDefault;
    }

    el.addEventListener("click", (e) => {
        e.preventDefault();
        if (state === "auto") {
            state = "light";
            html.setAttribute("data-theme", "light");
            el.innerHTML = _THEME_ICONS.sun;
        } else if (state === "light") {
            state = "dark";
            html.setAttribute("data-theme", "dark");
            el.innerHTML = _THEME_ICONS.moon;
        } else {
            state = "auto";
            html.removeAttribute("data-theme");
            el.innerHTML = _THEME_ICONS.osDefault;
        }
    });
}


// --- GitHub API helpers ----------------------------------------------
// Generic functions for fetching data from any tikoci/* repo via the
// GitHub REST API. These power "data-pivoting" tool pages that render
// GitHub-hosted JSON/YAML/text into interactive browser UIs.

/**
 * Fetch a directory listing from the GitHub Contents API.
 * Returns an array of { name, path, type, size, sha, ... } objects.
 *
 * @param {string} repo  - Repository name under tikoci org (e.g. 'restraml')
 * @param {string} path  - Path within the repo (e.g. 'docs' or 'docs/7.22')
 * @returns {Promise<Array>}
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function fetchGitHubContents(repo, path) {
    const url = `https://api.github.com/repos/${TIKOCI.owner}/${repo}/contents/${path}`;
    return fetch(url)
        .then(r => {
            if (!r.ok) throw new Error(`GitHub API ${r.status} ${r.statusText}`);
            return r.json();
        })
        .then(data => {
            if (!Array.isArray(data)) throw new Error('Expected directory listing from GitHub API');
            return data;
        });
}

/**
 * Fetch raw file content from GitHub Pages or the raw API.
 * Prefers Pages URL (no rate limit) with API fallback.
 *
 * @param {string} repo  - Repository name (e.g. 'restraml')
 * @param {string} path  - File path (e.g. '7.22/inspect.json')
 * @returns {Promise<Response>}
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function fetchGitHubPagesFile(repo, path) {
    const pagesUrl = `${TIKOCI.pagesUrl}/${repo}/${path}`;
    return fetch(pagesUrl).then(r => {
        if (!r.ok) throw new Error(`Pages fetch ${r.status} for ${pagesUrl}`);
        return r;
    });
}


// --- Event-driven UI utilities ---------------------------------------
// These helpers support the "no submit buttons" pattern: controls fire
// on input/change events with debouncing and async cancellation.

/**
 * Debounce a function call. Returns a wrapper that delays invocation
 * until `ms` milliseconds after the last call.
 *
 * @param {Function} fn - Function to debounce
 * @param {number}   ms - Delay in milliseconds (recommend 400 for text input)
 * @returns {Function}
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function debounce(fn, ms) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

/**
 * Create a cancellation token factory. Each call to next() increments
 * an internal counter and returns the new value. Compare before/after
 * an await to detect if a newer request has superseded this one.
 *
 * Usage:
 *   const cancel = createCancelToken()
 *   async function onInput() {
 *       const id = cancel.next()
 *       const data = await fetch(...)
 *       if (id !== cancel.current) return  // stale, newer request in flight
 *       renderResults(data)
 *   }
 *
 * @returns {{ next: () => number, current: number }}
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function createCancelToken() {
    const token = { current: 0 };
    token.next = () => ++token.current;
    return token;
}


// --- Query string helpers (shareable URLs) ---------------------------
// All tool pages support query strings that populate controls and
// trigger results on load. Use replaceState (not pushState) to update.

/**
 * Read current URL query parameters as a plain object.
 * @returns {Object<string, string>}
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function readQueryParams() {
    const obj = {};
    for (const [k, v] of new URLSearchParams(location.search)) {
        obj[k] = v;
    }
    return obj;
}

/**
 * Update the URL query string without adding a history entry.
 * Pass an object of key/value pairs; falsy values are omitted.
 * @param {Object<string, string>} params
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function writeQueryParams(params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    history.replaceState({}, '', url);
}


// --- Share / Copy URL button -----------------------------------------
// Preferred pattern: inline "Copied!" button (no modal dialog).

/**
 * Wire a share button that copies the current URL to clipboard and
 * shows brief "Copied!" feedback. Call writeQueryParams() first to
 * ensure the URL reflects the current control state.
 *
 * @param {string}   buttonId         - ID of the <button> element
 * @param {Function} [beforeCopy]     - Called before copying (e.g. writeQueryParams)
 * @param {string}   [label='Share']  - Default button text
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function initShareButton(buttonId, beforeCopy, label) {
    label = label || 'Share';
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (beforeCopy) beforeCopy();
        navigator.clipboard.writeText(location.href).then(() => {
            btn.textContent = '\u2713 Copied!';
            setTimeout(() => { btn.textContent = label; }, 1800);
        }).catch(() => {
            btn.textContent = label;
        });
    });
}

/**
 * Wire up a share modal dialog (legacy pattern — prefer initShareButton).
 *
 * @param {Object} opts
 * @param {string} opts.linkId    - ID of the "Share" link element
 * @param {string} opts.modalId   - ID of the <dialog> element
 * @param {string} opts.closeId   - ID of the close link inside the dialog
 * @param {string} opts.copyId    - ID of the "Copy to clipboard" button
 * @param {string} opts.urlId     - ID of the URL <input> in the dialog
 * @param {Function} [opts.beforeShow] - Called before showing the modal
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function initShareModal(opts) {
    const modal = document.getElementById(opts.modalId);
    document.getElementById(opts.linkId).addEventListener('click', e => {
        e.preventDefault();
        if (opts.beforeShow) opts.beforeShow();
        document.getElementById(opts.urlId).value = location.href;
        modal.showModal();
    });
    document.getElementById(opts.closeId).addEventListener('click', e => {
        e.preventDefault();
        modal.close();
    });
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.close();
    });
    document.getElementById(opts.copyId).addEventListener('click', () => {
        const url = document.getElementById(opts.urlId).value;
        navigator.clipboard.writeText(url).then(() => {
            const btn = document.getElementById(opts.copyId);
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy to clipboard'; }, 2000);
        }).catch(() => {
            document.getElementById(opts.urlId).select();
        });
    });
}


// --- HTML escaping ---------------------------------------------------

/**
 * Escape HTML special characters for safe innerHTML insertion.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// --- Site navigation data ------------------------------------------------
// Central tools list so nav menus stay in sync across pages.
// To add/remove a tool, update this array — all pages render from it.

const SITE_TOOLS = [
    { label: 'For AI Agents', href: '/llm.html' },
    { label: 'Rosetta AI MCP', href: '/p/rosetta' },
    { label: 'Project Map', href: '/project-map.html' },
    { label: 'CHR Images', href: '/chr-images.html' },
    { label: 'Netinstall', href: 'https://tikoci.github.io/p/netinstall' },
    { label: 'API Explorer', href: 'https://tikoci.github.io/restraml/openapi.html' },
    { label: '/app Editor', href: 'https://tikoci.github.io/restraml/tikapp.html' },
    { label: 'Schema Diff', href: 'https://tikoci.github.io/restraml/diff.html' },
    { label: 'Command Lookup', href: 'https://tikoci.github.io/restraml/lookup.html' },
    { label: 'Schema Downloads', href: 'https://tikoci.github.io/restraml' },
];

/**
 * Populate the Tools dropdown <ul> from the SITE_TOOLS array.
 * Marks the current page with aria-current="page".
 * Call once from each page after shared.js loads.
 *
 * @param {string} listId - ID of the <ul> element to populate
 * @param {object} [opts]
 * @param {string[]} [opts.exclude] - hrefs to omit from the list
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function initToolsDropdown(listId, opts) {
    const el = document.getElementById(listId);
    if (!el) return;
    const excludeSet = new Set(opts?.exclude || []);
    const current = location.pathname.split('/').pop() || 'index.html';
    el.innerHTML = SITE_TOOLS
        .filter(t => !excludeSet.has(t.href))
        .map(t => {
            const isLocal = !t.href.startsWith('http');
            const isCurrent = isLocal && t.href.split('/').pop() === current;
            const attrs = isLocal
                ? (isCurrent ? ' aria-current="page"' : '')
                : ' target="_blank" rel="noopener"';
            return `<li><a href="${escapeHtml(t.href)}"${attrs}>${escapeHtml(t.label)}</a></li>`;
        }).join('');
}


// --- GitHub repos dropdown -----------------------------------------------
// Lazily populates a <ul> with the most recently active tikoci repos.
// Call on first <details> open to avoid unnecessary API hits.

/**
 * Fetch repos with 3+ stars and populate a dropdown list, sorted by stars.
 * Falls back gracefully to the static link if the API is unavailable.
 *
 * @param {string} listId - ID of the <ul> element to populate
 */
// biome-ignore lint/correctness/noUnusedVariables: called from HTML pages
function initGitHubDropdown(listId) {
    const el = document.getElementById(listId);
    if (!el || el.dataset.loaded) return;
    el.dataset.loaded = '1';
    const allUrl = `https://github.com/orgs/${TIKOCI.owner}/repositories`;
    fetch(`https://api.github.com/search/repositories?q=org:${TIKOCI.owner}+stars:>=3&sort=stars&order=desc&per_page=30`)
        .then(r => {
            if (!r.ok) throw new Error(r.status);
            return r.json();
        })
        .then(data => {
            const repos = data.items;
            if (!Array.isArray(repos)) return;
            el.innerHTML = repos.map(r =>
                `<li><a href="${escapeHtml(r.html_url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a></li>`
            ).join('') +
            `<li><a href="${allUrl}" target="_blank" rel="noopener"><strong>All repositories &rarr;</strong></a></li>`;
        })
        .catch(() => { /* keep static fallback */ });
}
