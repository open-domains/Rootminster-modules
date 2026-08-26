import { XMLParser } from 'fast-xml-parser';
import crypto from 'node:crypto';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true });

export default function createNamecheapModule({ env }) {
  const baseUrl = env.NAMECHEAP_SANDBOX === 'true' ? 'https://api.sandbox.namecheap.com/xml.response' : 'https://api.namecheap.com/xml.response';
  const configured = () => Boolean(env.NAMECHEAP_API_USER && env.NAMECHEAP_API_KEY && env.NAMECHEAP_USERNAME && env.NAMECHEAP_CLIENT_IP);

  async function command(name, parameters = {}) {
    const url = new URL(baseUrl);
    const common = { ApiUser: env.NAMECHEAP_API_USER, ApiKey: env.NAMECHEAP_API_KEY, UserName: env.NAMECHEAP_USERNAME, ClientIp: env.NAMECHEAP_CLIENT_IP, Command: name };
    for (const [key, value] of Object.entries({ ...common, ...parameters })) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const xml = await response.text(); const parsed = parser.parse(xml); const envelope = parsed.ApiResponse;
    const errors = asArray(envelope?.Errors?.Error).map(error => typeof error === 'object' ? error['#text'] : error).filter(Boolean);
    if (!response.ok || envelope?.Status === 'ERROR' || errors.length) throw new Error(`Namecheap error: ${errors.join('; ') || response.statusText}`);
    return envelope?.CommandResponse;
  }

  async function listRecords(zone) {
    const { sld, tld } = splitDomain(zone.name);
    const result = await command('namecheap.domains.dns.getHosts', { SLD: sld, TLD: tld });
    return asArray(result?.DomainDNSGetHostsResult?.host).map(host => normalizeHost(host, zone.name));
  }

  async function replaceHosts(zone, records) {
    const { sld, tld } = splitDomain(zone.name); const parameters = { SLD: sld, TLD: tld };
    records.forEach((record, index) => {
      const n = index + 1; const mx = splitMx(record);
      parameters[`HostName${n}`] = relativeName(record.name, zone.name);
      parameters[`RecordType${n}`] = record.type;
      parameters[`Address${n}`] = mx.content;
      parameters[`TTL${n}`] = Math.max(60, Number(record.ttl || 1800));
      if (record.type === 'MX') parameters[`MXPref${n}`] = mx.priority;
    });
    await command('namecheap.domains.dns.setHosts', parameters);
  }

  return {
    isConfigured: configured,
    capabilities: { proxy: false, cnameFlatten: false, priorities: true, zones: true, atomicRecordSet: true },
    async listZones() {
      const result = await command('namecheap.domains.getList', { PageSize: 100 });
      return asArray(result?.DomainGetListResult?.Domain).map(domain => ({ id: String(domain.ID || domain.Name), name: String(domain.Name).toLowerCase(), status: domain.IsExpired ? 'inactive' : 'active' }));
    },
    listRecords,
    async createRecord(zone, payload) { const records = await listRecords(zone); const created = normalizePayload(payload, zone.name); records.push(created); await replaceHosts(zone, records); return created; },
    async updateRecord(zone, recordId, payload, currentRecord) { const records = await listRecords(zone); const index = findRecord(records, recordId, currentRecord); if (index < 0) throw new Error('Namecheap record not found'); const updated = normalizePayload(payload, zone.name, recordId); records[index] = updated; await replaceHosts(zone, records); return updated; },
    async deleteRecord(zone, recordId, currentRecord) { const records = await listRecords(zone); const index = findRecord(records, recordId, currentRecord); if (index < 0) return true; records.splice(index, 1); await replaceHosts(zone, records); return true; }
  };
}

function asArray(value) { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function splitDomain(domain) { const [sld, ...rest] = String(domain).toLowerCase().split('.'); if (!sld || !rest.length) throw new Error(`Invalid Namecheap domain: ${domain}`); return { sld, tld: rest.join('.') }; }
function relativeName(name, zoneName) { const normalized = String(name).toLowerCase(); if (normalized === zoneName) return '@'; if (!normalized.endsWith(`.${zoneName}`)) throw new Error(`${name} is outside ${zoneName}`); return normalized.slice(0, -(zoneName.length + 1)); }
function absoluteName(name, zoneName) { return name === '@' ? zoneName : `${name}.${zoneName}`.toLowerCase(); }
function stableId(record) { return String(record.id || crypto.createHash('sha256').update(`${record.type}|${record.name}|${record.content}|${record.priority || ''}`).digest('hex').slice(0, 20)); }
function normalizeHost(host, zoneName) { const priority = host.MXPref === undefined ? undefined : Number(host.MXPref); const address = String(host.Address).replace(/\.$/, ''); const record = { id: String(host.HostId || ''), type: String(host.Type), name: absoluteName(String(host.Name), zoneName), content: String(host.Type) === 'MX' ? `${priority ?? 10} ${address}` : address, ttl: Number(host.TTL || 1800), proxied: false, priority }; record.id = stableId(record); return record; }
function splitMx(record) { const match = String(record.content).trim().match(/^(\d+)\s+(.+)$/); return record.type === 'MX' ? { priority: Number(record.priority ?? match?.[1] ?? 10), content: String(match?.[2] || record.content).replace(/\.$/, '') } : { priority: undefined, content: String(record.content).replace(/\.$/, '') }; }
function normalizePayload(payload, zoneName, id) { const normalized = splitMx(payload); const record = { id: id || '', type: payload.type, name: absoluteName(relativeName(payload.name, zoneName), zoneName), content: payload.type === 'MX' ? `${normalized.priority} ${normalized.content}` : normalized.content, ttl: Number(payload.ttl || 1800), proxied: false, priority: normalized.priority }; record.id = stableId(record); return record; }
function findRecord(records, id, current) { let index = records.findIndex(record => record.id === id); if (index < 0 && current) index = records.findIndex(record => record.type === current.recordType && record.name === current.name && splitMx(record).content === splitMx({ type: current.recordType, content: current.content, priority: current.priority }).content); return index; }
