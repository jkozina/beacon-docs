# Maintaining Beacon Docs

The Docusaurus pages in `docs/` are now hand-maintained source files.

Do:

- Edit content directly in `docs/`.
- Run `npm run build` to rebuild the static site.
- Treat `build/` as disposable output.

Don't:

- Edit files in `build/`; Docusaurus overwrites them on every build.
- Expect a docs generator to preserve manual edits. The docs generator has been retired.

Diagram notes:

- Editable diagram source lives in individual files under `src/components/diagrams/`.
- Shared diagram primitives live in `src/components/diagrams/shared.jsx`.
- Diagram styling lives in `src/components/diagrams/diagram.css`.
- Pages that render diagrams use `.mdx` so they can embed inline React/SVG components.
- The text in the diagrams is actual SVG text in the page DOM, so it can be selected in the browser.
