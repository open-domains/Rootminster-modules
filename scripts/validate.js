import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const digestPattern = /^[a-f0-9]{64}$/;
const urlPrefix = 'https://raw.githubusercontent.com/open-domains/Rootminster-modules/main/';
const permissions = new Set(['dns.read', 'dns.write', 'zones.read', 'requests.read', 'requests.manage', 'notifications.send', 'safety.assess', 'http.fetch', 'settings.read', 'audit.write']);
const targets = new Set(['cloudflare', 'discord', 'safety']);

const fail = (message) => { throw new Error(message); };
const load = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

const registry = await load('registry.json');
if (registry.schemaVersion !== 1 || registry.publisher !== 'open-domains' || !Array.isArray(registry.modules)) fail('Invalid registry header');
const ids = new Set();
for (const item of registry.modules) {
  if (!idPattern.test(item.id) || ids.has(item.id)) fail(`Invalid or duplicate module id: ${item.id}`);
  ids.add(item.id);
  if (!versionPattern.test(item.version) || !digestPattern.test(item.manifestSha256)) fail(`Invalid version or digest for ${item.id}`);
  if (!item.manifestUrl.startsWith(urlPrefix) || !item.manifestUrl.endsWith(`/modules/${item.id}/module.json`)) fail(`Untrusted manifest URL for ${item.id}`);
  const path = `modules/${item.id}/module.json`;
  const bytes = await readFile(resolve(root, path));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== item.manifestSha256) fail(`Digest mismatch for ${item.id}: expected ${digest}`);
  const manifest = JSON.parse(bytes);
  if (manifest.schemaVersion !== 1 || manifest.id !== item.id || manifest.name !== item.name || manifest.version !== item.version) fail(`Catalog/manifest mismatch for ${item.id}`);
  if (manifest.publisher !== 'open-domains' || manifest.runtime !== 'declarative-v1') fail(`Untrusted publisher or runtime for ${item.id}`);
  if (!targets.has(manifest.target) || !versionPattern.test(manifest.minimumCoreVersion)) fail(`Invalid target or core version for ${item.id}`);
  if (!Array.isArray(manifest.permissions) || new Set(manifest.permissions).size !== manifest.permissions.length || manifest.permissions.some((permission) => !permissions.has(permission))) fail(`Invalid permissions for ${item.id}`);
}
console.log(`Validated ${registry.modules.length} curated modules.`);
