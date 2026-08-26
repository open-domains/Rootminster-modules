export default function createSendGridModule({ env }) {
  return {
    isConfigured: () => Boolean(env.SENDGRID_API_KEY && env.MAIL_FROM),
    async send(message) {
      const from = parseAddress(message.from || env.MAIL_FROM, env.SENDGRID_FROM_NAME);
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: addresses(message.to) }], from, reply_to: message.replyTo ? parseAddress(message.replyTo) : undefined, subject: message.subject, content: [{ type: 'text/plain', value: message.text || stripHtml(message.html) }, ...(message.html ? [{ type: 'text/html', value: message.html }] : [])] }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(`SendGrid error: ${data.errors?.map(error => error.message).join('; ') || response.statusText}`); }
      return { id: response.headers.get('x-message-id'), accepted: addresses(message.to).map(item => item.email) };
    }
  };
}

function addresses(value) { return (Array.isArray(value) ? value : String(value).split(',')).map(item => parseAddress(item)); }
function parseAddress(value, fallbackName) { const match = String(value).trim().match(/^(.*?)\s*<([^>]+)>$/); return match ? { name: match[1].trim(), email: match[2].trim() } : { name: fallbackName || undefined, email: String(value).trim() }; }
function stripHtml(value = '') { return String(value).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
