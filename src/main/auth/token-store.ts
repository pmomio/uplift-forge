import { safeStorage, BrowserWindow } from 'electron';
import Store from 'electron-store';

/**
 * API token storage using OS keychain (macOS Keychain / Windows DPAPI).
 */

interface Credentials {
  baseUrl: string;   // e.g. "https://myorg.atlassian.net"
  email: string;     // Atlassian account email
  apiToken: string;  // API token from id.atlassian.com
}

const tokenStore = new Store<{ credentials: string | null }>({
  name: 'auth-tokens',
  defaults: { credentials: null },
});

let cachedCredentials: Credentials | null = null;

function loadCredentials(): Credentials | null {
  if (cachedCredentials) return cachedCredentials;
  const stored = tokenStore.get('credentials');
  if (!stored) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(stored, 'base64'));
      cachedCredentials = JSON.parse(decrypted) as Credentials;
    } else {
      cachedCredentials = JSON.parse(stored) as Credentials;
    }
    return cachedCredentials;
  } catch {
    tokenStore.set('credentials', null);
    return null;
  }
}

export function saveCredentials(baseUrl: string, email: string, apiToken: string): void {
  const creds: Credentials = { baseUrl, email, apiToken };
  cachedCredentials = creds;
  try {
    const json = JSON.stringify(creds);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json).toString('base64');
      tokenStore.set('credentials', encrypted);
    } else {
      tokenStore.set('credentials', json);
    }
  } catch (e) {
    console.error('[Auth] Failed to save credentials:', e);
  }
}

export function getCredentials(): Credentials | null {
  return loadCredentials();
}

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

export function getEmail(): string | null {
  return loadCredentials()?.email ?? null;
}

export function getBaseUrl(): string | null {
  return loadCredentials()?.baseUrl ?? null;
}

export function getAuthHeader(): string | null {
  const creds = loadCredentials();
  if (!creds) return null;
  return `Basic ${Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64')}`;
}

export function clearCredentials(): void {
  cachedCredentials = null;
  tokenStore.set('credentials', null);
  emitAuthStateChanged();
}

export function emitAuthStateChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('auth:state-changed', {
      status: isAuthenticated() ? 'authenticated' : 'unauthenticated',
      email: getEmail(),
      baseUrl: getBaseUrl(),
    });
  }
}
