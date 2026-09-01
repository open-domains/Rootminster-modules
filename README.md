# Rootminster Module Store

The official curated module registry for Rootminster.

Modules are declarative manifests, not arbitrary server-side JavaScript. Rootminster verifies each manifest's SHA-256 digest, validates its requested permissions, and maps it to a reviewed built-in adapter. This keeps module installation auditable and prevents registry content from executing inside the main application process.

## Layout

- `registry.json` is the catalog consumed by Rootminster.
- `modules/<id>/module.json` is the installable, integrity-checked manifest.
- `schemas/` documents the registry and manifest formats.
- `scripts/validate.js` validates IDs, versions, URLs, permissions, targets, and SHA-256 digests.

Run `npm run validate` before publishing. Registry entries must use raw GitHub URLs from this repository and must include the exact SHA-256 digest of the referenced manifest.
