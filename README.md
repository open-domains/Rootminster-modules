# Rootminster Modules

Official open-source module catalogue for Rootminster.

Rootminster keeps integrations outside the core application. Every provider or optional feature lives in its own independently installable folder under `modules/`.

## Included modules

| Category | Modules |
| --- | --- |
| DNS | Cloudflare, Namecheap |
| Email | SMTP, SendGrid |
| OAuth | Google, GitHub |
| Functions | Docker Engine, AI Review |

## Repository layout

```text
modules/<category>/<module>/
├── module.json
├── index.js
└── README.md
```

`registry.json` is the machine-readable catalogue consumed by **Admin → Modules → Store**. Each `module.json` defines the configuration form, permissions, dependencies and entry point.

## Developing a module

1. Copy `templates/module/`.
2. Give the module a unique lowercase kebab-case ID.
3. Implement the hooks in `docs/MODULE_API.md`.
4. Add it to `registry.json`.
5. Run `npm test`.
6. Open a pull request.

Modules execute server-side. Rootminster must validate manifests and integrity before installation. Only install modules from trusted publishers.

## Licence

MIT
