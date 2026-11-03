# Future shared presentation

This repo is the future home for conventions and assets that give sibling repo
sites a shared semantic HTML, theme, header/footer and TIKOCI identity. A future
proposal can use docs/presentation/ for recipes and public/presentation/ for
versioned assets with durable URLs. Define consumers and version compatibility
before shipping a package or asking sibling sites to import it.

Today each site owns its presentation. Pico v2 is the current implementation,
not a permanent constraint on that future design. This cleanup changes neither
site design nor packaging, and introduces no cross-site runtime dependency.
