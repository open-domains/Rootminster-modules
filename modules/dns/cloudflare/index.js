const BASE_URL = 'https://api.cloudflare.com/client/v4';

export default function createCloudflareModule({ env }) {
  async function request(method, path, body) {
    const response = await fetch(`${BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const data = await response.json().catch(() => ({}));
    if (method === 'DELETE' && response.status === 404) return null;
    if (!response.ok || !data.success) throw new Error(`Cloudflare error: ${data.errors?.[0]?.message || response.statusText}`);
    return data;
  }

  return {
    isConfigured: () => Boolean(env.CLOUDFLARE_API_TOKEN),
    capabilities: { proxy: true, cnameFlatten: true, priorities: true, zones: true },
    async listZones() { const data = await request('GET', '/zones?per_page=50&status=active'); return data.result.map(zone => ({ id: zone.id, name: zone.name, status: zone.status })); },
    async listRecords(zone) {
      const records = []; let page = 1;
      while (true) { const data = await request('GET', `/zones/${zone.id}/dns_records?per_page=100&page=${page}`); records.push(...data.result); if (page >= (data.result_info?.total_pages || 1)) break; page += 1; }
      return records.map(record => ({ id: record.id, type: record.type, name: record.name, content: record.content, ttl: record.ttl, proxied: Boolean(record.proxied), priority: record.priority, data: record.data, cnameFlatten: record.settings?.flatten_cname }));
    },
    async createRecord(zone, payload) { const result = (await request('POST', `/zones/${zone.id}/dns_records`, toCloudflare(payload, zone))).result; return fromCloudflare(result); },
    async updateRecord(zone, recordId, payload) { const result = (await request('PUT', `/zones/${zone.id}/dns_records/${recordId}`, toCloudflare(payload, zone))).result; return fromCloudflare(result); },
    async deleteRecord(zone, recordId) { await request('DELETE', `/zones/${zone.id}/dns_records/${recordId}`); return true; }
  };
}

function toCloudflare(record, zone) {
  let content = String(record.content).trim(); let priority = record.priority;
  if (record.type === 'MX') { const match = content.match(/^(\d{1,3})\s+(.+)$/); if (match) { priority = Number(match[1]); content = match[2]; } else priority ??= 10; }
  if (['CNAME', 'NS', 'MX'].includes(record.type)) content = content.replace(/\.$/, '');
  if (record.type === 'CNAME' && content === '@') content = zone.name;
  const payload = { type: record.type, name: record.name, content, ttl: Number(record.ttl || 3600), proxied: ['A', 'AAAA', 'CNAME'].includes(record.type) && Boolean(record.proxied) };
  if (record.type === 'MX') payload.priority = priority;
  if (record.type === 'SRV' && record.data) payload.data = record.data;
  if (record.type === 'CNAME' && !record.proxied && record.name !== zone.name && record.includeFlattenSetting) payload.settings = { flatten_cname: Boolean(record.cnameFlatten) };
  return payload;
}

const fromCloudflare = record => ({ id: record.id, type: record.type, name: record.name, content: record.content, ttl: record.ttl, proxied: Boolean(record.proxied), priority: record.priority, data: record.data, cnameFlatten: record.settings?.flatten_cname });
