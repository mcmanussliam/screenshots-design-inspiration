# Open Screens

A community-maintained design reference library for real-world apps and websites. The website is a static Astro build hosted on GitHub Pages. No accounts, database, subscription, or hosted API are required.

## Project layout

- `site/` — Astro frontend and static catalogue generator.
- `mcp/` — local, read-only MCP server using the public catalogue.
- `android/`, `ios/` — mobile screenshots, grouped by product.
- `web/`, `email/`, `marketing/` — other source screenshots.
- `data/screenshot-tags.csv` — reference vocabulary for screenshot tags.
- `scripts/normalize-repository.mjs` — path convention checker (`--check`).
- `.github/workflows/pages.yml` — GitHub Pages build and deployment.

## Local development

```sh
npm install --prefix site
npm run build --prefix site
npm run dev --prefix site
```

The catalogue generator enumerates the Git tree and publishes `site/public/catalog.json`, with image URLs pointing to this repository. It does **not** copy gigabytes of screenshot files into the GitHub Pages artifact.

Set **Settings → Pages → Build and deployment → GitHub Actions**. The site for this fork is https://mcmanussliam.github.io/screenshots-design-inspiration/.

## MCP

```sh
cd mcp
npm install
npm start
```

See [mcp/readme.md](mcp/readme.md) to connect an AI client. GitHub Pages serves a catalogue; the MCP server runs locally on your machine, not on GitHub Pages.

## Contributing

Read [contributing.md](contributing.md). All repository file and directory names use kebab-case, except required Git files and Astro's dynamic-route syntax. Each product directory contains `index.html` for the display name and tags, with optional `tags.json` for per-image tags. Screenshots have third-party intellectual property implications: retain provenance, check rights, and respect removal requests.

## Saved collections and privacy

Saved collections live in the visitor's browser localStorage, not a server. Export your data before clearing browser storage. No authentication or analytics are required.

Open Screens is independent of Mobbin. Product interfaces and illustrations may belong to their respective companies.
