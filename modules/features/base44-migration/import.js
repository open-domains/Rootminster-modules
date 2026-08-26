import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDatabase, disconnectDatabase } from '../../../src/db.js';
import { modelRegistry } from '../../../src/models/index.js';
import { randomToken, sha256 } from '../../../src/lib/crypto.js';

const directory = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('Usage: node modules/features/base44-migration/import.js /path/to/entity-exports'); process.exit(1); }

const names = {
  AbuseReport: 'AbuseReport', ApiToken: 'ApiToken', AuditLog: 'AuditLog', BlocklistEntry: 'BlocklistEntry', DeviceCode: 'DeviceCode', DnsRecord: 'DnsRecord', DockerProject: 'DockerProject', Domain: 'Domain', Donation: 'Donation', EditRequest: 'LegacyEditRequest', EmailLog: 'EmailLog', PlatformSettings: 'PlatformSetting', RequestComment: 'RequestComment', SubdomainOwnership: 'SubdomainOwnership', SubdomainRequest: 'SubdomainRequest', SyncLog: 'SyncLog', TrustedDevice: 'TrustedDevice', User: 'User'
};
const date = value => value ? new Date(value) : undefined;
const id = row => row.id || row._id;
const remap = {
  User: row => ({ email: row.email, role: row.role, displayName: row.display_name || row.full_name, tosAcceptedAt: date(row.tos_accepted_at || row.created_date), emailVerifiedAt: date(row.email_verified_at || row.created_date || new Date()), nsUnlocked: row.ns_unlocked, legacyDonor: row.legacy_donor, disableEmailNotifications: row.disable_email_notifications }),
  Domain: row => ({ name: row.name, zoneId: `cloudflare:${row.zone_id}`, dnsProvider: 'cloudflare', providerZoneId: row.zone_id, status: row.status, lastSyncedAt: date(row.last_synced), recordCount: row.record_count, notes: row.notes, allowNewRequests: row.allow_new_requests, reservedNames: row.reserved_names }),
  DnsRecord: row => ({ zoneId: `cloudflare:${row.zone_id}`, zoneName: row.zone_name, dnsProvider: 'cloudflare', providerRecordId: row.cloudflare_record_id, cloudflareRecordId: row.cloudflare_record_id, recordType: row.record_type, name: row.name, subdomain: row.subdomain, content: row.content, proxied: row.proxied, cnameFlatten: row.cname_flatten, ttl: row.ttl, priority: row.priority, managed: row.managed, ownerEmail: row.owner_email, status: row.status, lastSyncedAt: date(row.last_synced), dnsVerified: row.dns_verified, dnsLastCheckedAt: date(row.dns_last_checked), dnsMismatchReason: row.dns_mismatch_reason, _ownerLegacy: row.owner_id }),
  SubdomainOwnership: row => ({ fullName: row.full_name, subdomain: row.subdomain, rootDomain: row.root_domain, zoneId: `cloudflare:${row.zone_id}`, ownerEmail: row.owner_email, status: row.status, suspendedAt: date(row.suspended_at), suspensionReason: row.suspension_reason, lastRecordAddedAt: date(row.last_record_added_at), analyticsEnabled: row.analytics_enabled, umamiWebsiteId: row.umami_website_id, analyticsEnabledAt: date(row.analytics_enabled_at), _ownerLegacy: row.owner_id }),
  SubdomainRequest: row => ({ requesterEmail: row.requester_email, subdomain: row.subdomain, rootDomain: row.root_domain, fullName: row.full_name, recordType: row.record_type, recordValue: row.record_value, ttl: row.ttl, proxied: row.proxied, reason: row.reason, previewLink: row.preview_link, status: row.status, reviewedBy: row.reviewed_by, reviewedAt: date(row.reviewed_at), rejectionReason: row.rejection_reason, adminNotes: row.admin_notes, cloudflareRecordId: row.cloudflare_record_id, zoneId: `cloudflare:${row.zone_id}`, _requesterLegacy: row.requester_id, _dnsLegacy: row.dns_record_id }),
  RequestComment: row => ({ authorEmail: row.author_email, authorRole: row.author_role === 'ai' ? 'system' : row.author_role, message: row.message, isInternal: row.is_internal, messageType: ['comment','question','reply','status_change'].includes(row.message_type) ? row.message_type : 'comment', _requestLegacy: row.request_id }),
  ApiToken: row => ({ userEmail: row.user_email, name: row.name, tokenHash: row.token_hash, tokenPrefix: row.token_prefix, lastUsedAt: date(row.last_used), revoked: row.revoked, revokedBy: row.revoked_by, _userLegacy: row.user_id }),
  TrustedDevice: row => ({ userEmail: row.user_email, tokenHash: row.token_hash, tokenPrefix: row.token_prefix, userAgent: row.user_agent, lastUsedAt: date(row.last_used), expiresAt: date(row.expires_at), _userLegacy: row.user_id }),
  AbuseReport: row => ({ subdomain: row.subdomain, abuseType: row.abuse_type, description: row.description, evidence: row.evidence, reporterEmail: row.reporter_email, status: row.status, adminNotes: row.admin_notes, actionedBy: row.actioned_by }),
  BlocklistEntry: row => ({ value: row.value, isRegex: row.is_regex, recordType: row.record_type, reason: row.reason, notes: row.notes, addedBy: row.added_by }),
  AuditLog: row => ({ actorEmail: row.actor_email, actorRole: row.actor_role, action: row.action, entityType: row.entity_type, entityId: row.entity_id, description: row.description, oldValue: parse(row.old_value), newValue: parse(row.new_value), ipAddress: row.ip_address, metadata: parse(row.metadata) }),
  PlatformSettings: row => ({ key: row.key, value: row.value, description: row.description }),
  SyncLog: row => ({ zoneId: row.zone_id, zoneName: row.zone_name, status: row.status, recordsSynced: row.records_synced, recordsAdded: row.records_added, recordsUpdated: row.records_updated, errorMessage: row.error_message, triggeredBy: row.triggered_by, completedAt: date(row.completed_at) }),
  Donation: row => ({ userEmail: row.user_email, amountPence: row.amount_pence, stripePaymentIntentId: row.stripe_payment_intent_id, stripeSessionId: row.stripe_session_id, status: row.status, nsUnlockGranted: row.ns_unlock_granted, _userLegacy: row.user_id }),
  EmailLog: row => ({ to: row.to, subject: row.subject, templateType: row.template_type, status: row.status, relatedEntityType: row.related_entity_type, relatedEntityId: row.related_entity_id, errorMessage: row.error_message }),
  DockerProject: row => ({ name: row.name, virtualMachineId: row.virtual_machine_id, description: row.description, notes: row.notes }),
  DeviceCode: row => ({ deviceCodeHash: row.device_code ? sha256(row.device_code) : sha256(randomToken()), userCode: row.user_code, status: row.status, userEmail: row.user_email, expiresAt: date(row.expires_at), tokenName: row.token_name, _userLegacy: row.user_id }),
  EditRequest: row => ({ payload: row })
};
function parse(value) { if (!value || typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return value; } }
async function rowsFor(file) { const raw = await fs.readFile(file, 'utf8'); try { const data = JSON.parse(raw); return Array.isArray(data) ? data : data.items || data.data || [data]; } catch { return raw.split(/\r?\n/).filter(Boolean).map(JSON.parse); } }

await connectDatabase();
const files = await fs.readdir(directory);
const imported = new Map();
const pending = [];
const importOrder = ['User','Domain','DnsRecord','SubdomainOwnership','SubdomainRequest','RequestComment','ApiToken','TrustedDevice','AbuseReport','BlocklistEntry','AuditLog','PlatformSettings','SyncLog','Donation','EmailLog','DockerProject','DeviceCode','EditRequest'];
for (const entityName of importOrder) {
  const file = files.find(item => item.toLowerCase() === `${entityName}.json`.toLowerCase() || item.toLowerCase() === `${entityName}.jsonl`.toLowerCase() || item.toLowerCase() === `${entityName}.ndjson`.toLowerCase());
  if (!file) continue;
  const rows = await rowsFor(path.join(directory, file)); const Model = modelRegistry[names[entityName]]; let count = 0;
  for (const row of rows) {
    const payload = { ...(remap[entityName]?.(row) || row), legacyId: String(id(row) || '') };
    for (const key of Object.keys(payload)) if (payload[key] === undefined || payload[key] === null && !['dnsVerified'].includes(key)) delete payload[key];
    const references = Object.fromEntries(Object.entries(payload).filter(([key]) => key.startsWith('_'))); for (const key of Object.keys(references)) delete payload[key];
    const userLegacy = references._ownerLegacy || references._userLegacy || references._requesterLegacy;
    if (userLegacy) {
      const target = imported.get(`User:${userLegacy}`);
      if (target) payload[entityName === 'SubdomainRequest' ? 'requester' : entityName === 'DnsRecord' || entityName === 'SubdomainOwnership' ? 'owner' : 'user'] = target;
    }
    if (references._requestLegacy) payload.request = imported.get(`SubdomainRequest:${references._requestLegacy}`);
    if (references._dnsLegacy) payload.dnsRecord = imported.get(`DnsRecord:${references._dnsLegacy}`);
    if (entityName === 'User') {
      const resetToken = randomToken(24);
      payload.passwordResetHash = sha256(resetToken);
      payload.passwordResetExpiresAt = new Date(Date.now() + 30 * 86400000);
      console.log(`Password setup for ${payload.email}: /auth/reset-password/${resetToken}`);
    }
    if (row.created_date) payload.createdAt = date(row.created_date); if (row.updated_date) payload.updatedAt = date(row.updated_date);
    try { const document = await Model.findOneAndUpdate({ legacyId: payload.legacyId }, payload, { upsert: true, new: true, setDefaultsOnInsert: true }); imported.set(`${entityName}:${payload.legacyId}`, document._id); pending.push({ entityName, document, references, row }); count += 1; }
    catch (error) { console.error(`[${entityName}] skipped ${payload.legacyId}: ${error.message}`); }
  }
  console.log(`${entityName}: ${count}/${rows.length}`);
}
for (const item of pending) {
  const update = {};
  const userLegacy = item.references._ownerLegacy || item.references._userLegacy || item.references._requesterLegacy;
  if (userLegacy) update[item.entityName === 'SubdomainRequest' ? 'requester' : item.entityName === 'DnsRecord' || item.entityName === 'SubdomainOwnership' ? 'owner' : 'user'] = imported.get(`User:${userLegacy}`);
  if (item.references._requestLegacy) update.request = imported.get(`SubdomainRequest:${item.references._requestLegacy}`);
  if (item.references._dnsLegacy) update.dnsRecord = imported.get(`DnsRecord:${item.references._dnsLegacy}`);
  for (const key of Object.keys(update)) if (!update[key]) delete update[key];
  if (Object.keys(update).length) await item.document.updateOne(update);
}
console.log('Import complete. Imported users need local password resets because Base44 credentials are not exportable.');
await disconnectDatabase();
