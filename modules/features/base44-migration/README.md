# Base44 Migration

One-time importer for moving Base44 entity JSON or JSONL exports into Rootminster. Install this module, restart Rootminster, then run:

```sh
node modules/features/base44-migration/import.js /absolute/path/to/entity-exports
```

The import is idempotent. User password credentials cannot be exported, so the command prints one-time local password-setup paths. Remove the module after confirming the migration.
