# Contributing

This is a static, community-maintained UI reference library. Keep changes small, reviewable and appropriately sourced.

## Screenshot folders

Add screenshots under `ios/<product-slug>/`, `android/<product-slug>/`, `web/<product-slug>/` or `email/<product-slug>/`. Use **kebab-case** for every path segment, including each screenshot filename, for example `ios/example-app/login-screen.png`. Display names within the metadata keep their natural casing.

Each product folder should include `index.html` with minimal YAML frontmatter:

```yaml
---
gallery-directory: Example App
tags: [Onboarding, Finance]
---
```

For per-screen tags, create or edit `tags.json`; its keys must match the *actual* kebab-case image filenames:

```json
{
  "login-screen.png": ["Login", "Text Field", "Button"]
}
```

Screenshots must not contain unredacted private data or credentials. Only contribute material you have permission to contribute or that may lawfully be used in this context, and provide provenance whenever possible. The original UI assets do not become the repository's property.

## Validate your changes

```sh
node scripts/normalize-repository.mjs --check
node --test site/scripts/generate-catalog-test.mjs
npm install --prefix site
npm run build --prefix site
```

CI builds the Astro site on `main`. It publishes HTML and JSON metadata while linking image binaries from their GitHub source.

## Project direction

Prefer static Astro pages and focused TypeScript modules. Don't add accounts, databases, runtime APIs, unnecessary dependencies or tracking scripts. Aim for accessible interactions and responsive layouts.
