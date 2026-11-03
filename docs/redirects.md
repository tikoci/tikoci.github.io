# README redirects

`https://tikoci.dev/r/<repo>` redirects to
`https://github.com/tikoci/<repo>#readme-ov-file`. This namespace always opens
the README; incoming fragments and query parameters are not forwarded.
Destinations are always in the tikoci org. Future namespaces such as `/i/` for
issues or `/pr/` for pull requests are reserved, not implemented.

The build generates `r/<repo>/index.html` for every repo in the committed
snapshot, plus durable routes listed in `data/redirect-config.ts` (including
`app-t3code`). GitHub Pages normalizes directory URLs to a trailing slash. Each page
has a centered, clickable destination, including when JavaScript is disabled.
JavaScript uses `location.replace` so Back does not loop through the redirect.

GitHub Pages has no configurable wildcard HTTP redirects. `src/404.html` also
recognizes `/r/<repo>` and `/r/<repo>/` so newly created repositories work before
collection. Those requests retain HTTP 404 status until the repo is collected;
with JavaScript disabled they show the ordinary not-found page. Other missing
paths remain not-found pages. Repo existence is left to GitHub, with no API calls.

Redirects send the existing Plausible tracker a `Redirect` custom event with
`kind: readme` and `repo: tikoci/<repo>` properties. Create a matching `Redirect`
custom event goal in Plausible's site settings to see it in the dashboard.
Navigation waits for its callback, at most 800 ms, and proceeds if tracking is
blocked. Tracking is best effort. Fragments are not included in event properties.

Keep future redirect namespaces explicit in the handler and generator, with a
fixed destination origin for each kind. Redirect pages are excluded from the
sitemap and marked `noindex`.
