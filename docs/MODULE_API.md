# Rootminster Module API

A module is one folder containing a `module.json` manifest and the JavaScript entry point declared by `main`.

Required manifest fields are `schemaVersion`, `id`, `name`, `version`, `category`, `main`, `engines`, `permissions`, `configSchema` and `secrets`. Secret values must be encrypted at rest and never returned to the browser after saving.

The core supplies `{ config, logger, db, events, secrets, fetch }`. Modules may expose `install`, `uninstall`, and `health`.

DNS providers expose `listRecords`, `createRecord`, `updateRecord`, and `deleteRecord`. Email providers expose `send`. OAuth providers expose `getAuthorizationUrl`, `exchangeCode`, and `getUser`.

Installers must verify permissions before activation and must not run install-time shell commands.
