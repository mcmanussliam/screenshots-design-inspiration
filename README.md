# Open Screens
A community-maintained reference gallery of real app and website screenshots. Built for **GitHub Pages** with Astro; no login, server or database.

## Get started
1. In **Settings → Branches**, change the default branch to `main`.
2. In **Settings → Pages**, choose **GitHub Actions** as the deployment source.
3. Open **Actions → Deploy Open Screens** and run the workflow (or push a commit to `main`).

The site will be at https://mcmanussliam.github.io/screenshots-design-inspiration/.

## Local development
Use a partial clone or sparse-checkout; screenshot binaries are several GB.
```sh
npm install --prefix site
npm run build --prefix site
npm run dev --prefix site
```
The build generates `site/src/data/catalog.json` and `site/public/catalog.json` from the repo's screenshot folders. It does not bundle the screenshot binaries in the Pages site. Screenshots are displayed from GitHub's raw host; a dedicated image CDN is advisable at scale.

## Structure
- `site/`: Astro site, browser search and collections stored locally
- `site/scripts/`: source metadata → typed catalogue
- `mcp/`: local, read-only MCP server using the same public catalogue
- `Android/`, `iOS/`, `Web/`, `Email/`, `Marketing/`: preserved source screenshot data
- `scripts/`: upstream contribution, tagging and capture utilities

Application source and routes use **kebab-case**. Historical image paths remain unchanged to preserve metadata, crawler compatibility and old links. A bulk asset rename should be done only after migrating all references and verifying redirects.

No accounts; saved items and custom collections live in browser `localStorage`. Export backups before clearing browser data.

## Contributing and rights
The public gallery does not imply that every underlying screenshot is freely licensed. Copyright in third-party interfaces may belong to the originating product teams. Follow upstream's `CONTRIBUTING.md`, document image provenance, respect removal requests, and don't add any blanket licence to third-party assets.

Independent open-source-inspired design reference project, not affiliated with Mobbin.
