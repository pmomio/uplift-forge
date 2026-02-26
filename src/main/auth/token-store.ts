import { safeStorage, BrowserWindow } from 'electron';
import Store from 'electron-store';

/**
 * Encrypted token storage using OS keychain (macOS Keychain / Windows DPAPI).
 */

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  cloudId: string;
  email: string;
}

const tokenStore = new Store<{ tokens: string | null }>({
  name: 'auth-tokens',
  defaults: { tokens: null },
});

let cachedTokens: TokenData | null = null;

// OAuth app config — Client ID is safe to embed; Client Secret should be stored securely
// Users must register their own OAuth app in the Atlassian Developer Console
const OAUTH_CLIENT_ID = process.env.ATLASSIAN_CLIENT_ID ?? '';
const OAUTH_CLIENT_SECRET = process.env.ATLASSIAN_CLIENT_SECRET ?? '';

export function setOAuthCredentials(clientId: string, clientSecret: string): void {
  // Allow setting at runtime if not set via env
  if (!OAUTH_CLIENT_ID) {
    (globalThis as Record<string, string>).__OAUTH_CLIENT_ID = clientId;
  }
  if (!OAUTH_CLIENT_SECRET) {
    (globalThis as Record<string, string>).__OAUTH_CLIENT_SECRET = clientSecret;
  }
}

function getClientId(): string {
  return OAUTH_CLIENT_ID || (globalThis as Record<string, string>).__OAUTH_CLIENT_ID || '';
}

function getClientSecret(): string {
  return OAUTH_CLIENT_SECRET || (globalThis as Record<string, string>).__OAUTH_CLIENT_SECRET || '';
}

function loadTokens(): TokenData | null {
  if (cachedTokens) return cachedTokens;
  const encrypted = tokenStore.get('tokens');
  if (!encrypted) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      cachedTokens = JSON.parse(decrypted) as TokenData;
    } else {
      // Fallback: stored as plain JSON (dev mode)
      cachedTokens = JSON.parse(encrypted) as TokenData;
    }
    return cachedTokens;
  } catch {
    tokenStore.set('tokens', null);
    return null;
  }
}

function saveTokens(data: TokenData): void {
  cachedTokens = data;
  try {
    const json = JSON.stringify(data);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json).toString('base64');
      tokenStore.set('tokens', encrypted);
    } else {
      tokenStore.set('tokens', json);
    }
  } catch (e) {
    console.error('[Auth] Failed to save tokens:', e);
  }
}

export function clearTokens(): void {
  cachedTokens = null;
  tokenStore.set('tokens', null);
  emitAuthStateChanged();
}

/**
 * Get the current access token, refreshing if needed.
 * @param forceRefresh - force a token refresh
 */
export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;

  // Refresh if <60s until expiry or forced
  if (forceRefresh || Date.now() >= tokens.expiresAt - 60000) {
    const refreshed = await refreshTokens();
    return refreshed ? refreshed.accessToken : null;
  }

  return tokens.accessToken;
}

export function getCloudId(): string | null {
  return loadTokens()?.cloudId ?? null;
}

export function getEmail(): string | null {
  return loadTokens()?.email ?? null;
}

export function isAuthenticated(): boolean {
  return loadTokens() !== null;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenData> {
  const response = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${body}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Get accessible resources to find cloudId
  const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { 'Authorization': `Bearer ${data.access_token}` },
  });
  const resources = await resourcesResponse.json() as Array<{ id: string; name: string; url: string }>;

  if (resources.length === 0) {
    throw new Error('No accessible Atlassian sites found');
  }

  // Use first site (could prompt user to select if multiple)
  const cloudId = resources[0].id;

  // Get user email
  const meResponse = await fetch('https://api.atlassian.com/me', {
    headers: { 'Authorization': `Bearer ${data.access_token}` },
  });
  const me = await meResponse.json() as { email?: string; account_id?: string };

  const tokenData: TokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    cloudId,
    email: me.email ?? 'unknown',
  };

  saveTokens(tokenData);
  emitAuthStateChanged();
  return tokenData;
}

/**
 * Refresh the access token using refresh_token grant.
 */
async function refreshTokens(): Promise<TokenData | null> {
  const tokens = loadTokens();
  if (!tokens?.refreshToken) {
    clearTokens();
    return null;
  }

  try {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: tokens.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('[Auth] Token refresh failed:', response.status);
      clearTokens();
      return null;
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const updated: TokenData = {
      ...tokens,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    saveTokens(updated);
    return updated;
  } catch (e) {
    console.error('[Auth] Token refresh error:', e);
    clearTokens();
    return null;
  }
}

function emitAuthStateChanged(): void {
  // Notify all renderer windows
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('auth:state-changed', {
      status: isAuthenticated() ? 'authenticated' : 'unauthenticated',
      email: getEmail(),
    });
  }
}
