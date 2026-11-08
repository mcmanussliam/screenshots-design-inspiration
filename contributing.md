# Contributing to Open Screens

Keep original design assets unmodified, metadata accurate, and changes reviewable.

## Design folders

Store everything under design/ios/product-name/, design/android/product-name/, design/web/product-name/, design/email/product-name/ or design/marketing/product-name/. All filenames and directory segments must be kebab-case.

## Image sizing

DO NOT bulk resize, crop, upscale or recompress source screenshots. Mobile apps, websites and full-page captures have legitimately different aspect ratios. The site uses consistent aspect-aware preview frames, while preserving the complete original image.

Each screenshot exposes its original Git blob byte size, and after loading in a browser shows its intrinsic width and height. Verified native dimensions are stored in data/image-dimensions.json. With a full repository checkout, run:

    node scripts/scan-image-dimensions.mjs --scan

The scanner reads image file headers but does not alter the images. GitHub's image-audit workflow can produce the same dimension manifest as a downloadable artifact. Do not fill dimensions with guesses or desired display sizes.

## Product metadata

Each product's index.html has gallery-directory and optional design tags in frontmatter. These tags describe UI patterns, not business categories. Curated category, short description and domain belong in data/product-metadata.json using a key such as ios:airbnb. Unverified products have the neutral categories Mobile app or Website.

## Screen tagging

The product tags.json maps source filenames to arrays of visible UI labels. For example, a login image might have Login, Text Field, and Button. The canonical vocabulary and synonym mappings are in site/scripts/tag-taxonomy.mjs.

Labels are grouped into screen types, UI elements, user flows, visual styles, and unreviewed labels. New unknown labels are preserved as unreviewed; never invent an interaction or classify a whole app from a styling tag.

Tag only visible, supportable features; prefer specific meaningful labels and avoid duplicate synonyms. Never add unredacted personal information, passwords, or screenshot material without applicable permission.

## Validate and build

    node --test site/scripts/generate-catalog-test.mjs
    node --test scripts/scan-image-dimensions-test.mjs
    node scripts/normalize-repository.mjs --check
    npm install --prefix site
    npm run build --prefix site
    node site/scripts/validate-dataset.mjs

Builds publish catalog.json (v2) plus dataset-report.json, including tag and dimension coverage; the local MCP server consumes the same catalogue.
