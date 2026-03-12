import { safeStorage } from 'electron';
import Store from 'electron-store';
import type { AiProvider, AiConfig } from '../../shared/types.js';

/**
 * Encrypted AI API key storage. Mirrors token-store.ts pattern
 * but uses a separate electron-store ('ai-keys') for isolation.
 */

interface StoredAiConfig {
  provider: AiProvider;
  apiKey: string;
}

const aiStore = new Store<{ config: string | null }>({
  name: 'ai-keys',
  defaults: { config: null },
});

let cached: StoredAiConfig | null = null;

function load(): StoredAiConfig | null {
  if (cached) return cached;
  const stored = aiStore.get('config');
  if (!stored) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(stored, 'base64'));
      cached = JSON.parse(decrypted) as StoredAiConfig;
    } else {
      cached = JSON.parse(stored) as StoredAiConfig;
    }
    return cached;
  } catch {
    aiStore.set('config', null);
    return null;
  }
}

export function saveAiConfig(provider: AiProvider, apiKey: string): void {
  const config: StoredAiConfig = { provider, apiKey };
  cached = config;
  try {
    const json = JSON.stringify(config);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json).toString('base64');
      aiStore.set('config', encrypted);
    } else {
      aiStore.set('config', json);
    }
  } catch (e) {
    console.error('[AI] Failed to save config:', e);
  }
}

export function getAiConfig(): AiConfig {
  const stored = load();
  if (!stored) return { provider: 'openai', hasKey: false };
  return { provider: stored.provider, hasKey: true };
}

export function getAiApiKey(): string | null {
  return load()?.apiKey ?? null;
}

export function getAiProvider(): AiProvider | null {
  return load()?.provider ?? null;
}

export function deleteAiConfig(): void {
  cached = null;
  aiStore.clear();
}
