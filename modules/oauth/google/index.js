export default function createGoogleOauthModule({ env }) {
  return {
    isConfigured: () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    authorizationUrl({ redirectUri, state }) { const url = new URL('https://accounts.google.com/o/oauth2/v2/auth'); for (const [key, value] of Object.entries({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' })) url.searchParams.set(key, value); return url.toString(); },
    async exchange({ code, redirectUri }) { const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }), signal: AbortSignal.timeout(15000) }); const data = await response.json(); if (!response.ok) throw new Error(data.error_description || 'Google token exchange failed'); return data; },
    async profile(tokens) { const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15000) }); const data = await response.json(); if (!response.ok || !data.email) throw new Error('Google profile lookup failed'); return { providerId: data.sub, email: data.email.toLowerCase(), displayName: data.name, avatarUrl: data.picture, emailVerified: Boolean(data.email_verified) }; }
  };
}
