# Open Screens

A community-maintained UI screenshot library powered by Astro, GitHub Pages, and a local read-only MCP server. No account or hosted database is required.

## Repository structure

    design/
      ios/
      android/
      web/
      email/
      marketing/
    data/
      product-metadata.json
      image-dimensions.json
    site/
      scripts/
      src/
    mcp/
    scripts/
    .github/workflows/

All design images and recordings live under design/ with kebab-case paths. The original image blobs are not altered. A single Git tree move avoids re-uploading gigabytes of files.

## Sizing and tagging

Original source dimensions and Git byte sizes are distinct from the site's consistent preview frame size. Images keep their complete aspect ratio (no destructive cropping). After browser image load, the site displays the original pixel resolution. The optional dimension inventory in data/image-dimensions.json provides verified width/height for catalog.json and MCP. To scan a full clone, run node scripts/scan-image-dimensions.mjs --scan.

Product category and descriptions come only from explicit data/product-metadata.json entries, not UI styling tags. Per-screen tags are grouped as screen type, UI element, flow, visual style or unreviewed. See contributing.md for the canonical tag vocabulary and data-quality standards.

## Local development

    npm install --prefix site
    npm run build --prefix site
    npm run dev --prefix site

The Pages deployment builds only source metadata, linking actual image files through immutable GitHub paths without bundling the archive. The public catalog.json is version 2; dataset-report.json summarises tag and dimension coverage. Local bookmarks and collections stay in browser localStorage. Export or import them on the Saved page.

The MCP package under mcp/ runs locally in an AI client; GitHub Pages is only the static website and public catalogue.

This project is independent and not affiliated with Mobbin or any referenced app. Copyright in third-party designs may belong to the original creators.

## Quality and provenance

Browse the public <https://mcmanussliam.github.io/screenshots-design-inspiration/quality/> dashboard to review tagging, verified dimensions and documentation coverage. Each screen is either `source-documented` (explicit captured source, rights evidence and date) or `legacy-unverified`. The latter status is a curation backlog, not proof of any rights violation. `data/curation-report.json` tracks identical images shared between products, which require manual review before reassignment. See the [contribution guide](contributing.md#reviewing-existing-data) for how to submit a correction.
