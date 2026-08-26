export default function createTurnstileModule({ env }) {
  return {
    isConfigured: () => Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY),
    siteKey: env.TURNSTILE_SITE_KEY || '',
    async verify(token, remoteIp) {
      if (!token) throw new Error('Please complete the CAPTCHA');
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: remoteIp || '' }), signal: AbortSignal.timeout(10000) });
      const data = await response.json(); if (!data.success) throw new Error('CAPTCHA verification failed'); return true;
    }
  };
}
