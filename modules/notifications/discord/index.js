export default function createDiscordModule({ env }) {
  return {
    isConfigured: () => Boolean(env.DISCORD_WEBHOOK_URL),
    async send({ title, fields = [], color = 0x6366f1, description }) {
      const response = await fetch(env.DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [{ title, description, color, fields: fields.map(field => ({ ...field, value: String(field.value ?? '—') })), timestamp: new Date().toISOString(), footer: { text: env.APP_NAME || 'Open Domains' } }] }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Discord returned ${response.status}`);
      return true;
    }
  };
}
