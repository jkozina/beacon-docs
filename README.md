# Beacon

Beacon is an internal Docusaurus design site for the Enterprise Connectivity Control Plane.

## Local Development

```bash
npm ci
npm run start
```

Build the static site:

```bash
npm run build
```

## GitHub Pages

This repo uses GitHub Actions based Pages deployment from `.github/workflows/pages.yml`.

For github.com project Pages, the workflow builds with:

- `SITE_URL=https://<owner>.github.io`
- `BASE_URL=/<repo>/`

For GitHub Enterprise, adjust the workflow or repository variables so:

- `SITE_URL` matches the Enterprise Pages host
- `BASE_URL` matches the served path, often `/<repo>/` or `/`
- `GITHUB_URL` points at the Enterprise repository URL

The Docusaurus config reads those values from environment variables, so the site can move between github.com and GitHub Enterprise without changing page content.

## Source Layout

- `docs/`: hand-maintained documentation pages
- `src/components/diagrams/`: editable SVG diagram components
- `static/`: static assets
- `build/`: generated output, ignored by Git
