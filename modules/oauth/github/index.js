export default function createGithubOauthModule({ env }) {
  const headers = token => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'OpenDomains-Standalone' });
  return {
    isConfigured: () => Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    authorizationUrl({ redirectUri, state }) { const url = new URL('https://github.com/login/oauth/authorize'); for (const [key, value] of Object.entries({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: redirectUri, scope: 'read:user user:email', state })) url.searchParams.set(key, value); return url.toString(); },
    async exchange({ code, redirectUri }) { const response = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }), signal: AbortSignal.timeout(15000) }); const data = await response.json(); if (!response.ok || !data.access_token) throw new Error(data.error_description || 'GitHub token exchange failed'); return data; },
    async profile(tokens) {
      const [userResponse, emailResponse] = await Promise.all([fetch('https://api.github.com/user', { headers: headers(tokens.access_token), signal: AbortSignal.timeout(15000) }), fetch('https://api.github.com/user/emails', { headers: headers(tokens.access_token), signal: AbortSignal.timeout(15000) })]);
      const user = await userResponse.json(); const emails = await emailResponse.json();
      if (!userResponse.ok || !emailResponse.ok) throw new Error('GitHub profile lookup failed');
      const email = emails.find(item => item.primary && item.verified) || emails.find(item => item.verified);
      if (!email) throw new Error('GitHub account has no verified email address');
      return { providerId: String(user.id), email: email.email.toLowerCase(), displayName: user.name || user.login, avatarUrl: user.avatar_url, emailVerified: true };
    }
  };
}
