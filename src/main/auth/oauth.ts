import { BrowserWindow } from 'electron';
import { createServer, type Server } from 'node:http';
import { exchangeCodeForTokens } from './token-store.js';

/**
 * Atlassian OAuth 2.0 (3LO) flow.
 *
 * Opens a browser window for user to authorize, catches the redirect on a local HTTP server.
 */

const CALLBACK_PORT = 39871;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

// Scopes required for JIRA operations
const SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'offline_access',
].join(' ');

const CLIENT_ID = process.env.ATLASSIAN_CLIENT_ID ?? '';

function getClientId(): string {
  return CLIENT_ID || (globalThis as Record<string, string>).__OAUTH_CLIENT_ID || '';
}

/**
 * Start the full OAuth flow.
 * Returns when the user has completed authentication.
 */
export async function startOAuthFlow(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('ATLASSIAN_CLIENT_ID is not configured. Set it as an environment variable.');
  }

  const state = Math.random().toString(36).substring(2);
  const authUrl = new URL('https://auth.atlassian.com/authorize');
  authUrl.searchParams.set('audience', 'api.atlassian.com');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('prompt', 'consent');

  return new Promise<void>((resolve, reject) => {
    let server: Server | null = null;
    let authWindow: BrowserWindow | null = null;

    const cleanup = () => {
      if (server) {
        server.close();
        server = null;
      }
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close();
        authWindow = null;
      }
    };

    // Start local HTTP server to catch the redirect
    server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Authentication failed</h2><p>You can close this window.</p></body></html>');
        cleanup();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Invalid callback</h2></body></html>');
        cleanup();
        reject(new Error('Invalid OAuth callback'));
        return;
      }

      try {
        await exchangeCodeForTokens(code, REDIRECT_URI);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Connected to Atlassian!</h2><p>You can close this window and return to Uplift Forge.</p></body></html>');
        cleanup();
        resolve();
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h2>Token exchange failed</h2><p>${String(e)}</p></body></html>`);
        cleanup();
        reject(e);
      }
    });

    server.listen(CALLBACK_PORT, () => {
      // Open auth window
      authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        title: 'Connect to Atlassian',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      authWindow.loadURL(authUrl.toString());

      authWindow.on('closed', () => {
        authWindow = null;
        // If the window was closed without completing auth, clean up
        if (server) {
          cleanup();
          reject(new Error('Authentication window was closed'));
        }
      });
    });

    server.on('error', (err) => {
      cleanup();
      reject(new Error(`Failed to start callback server: ${err.message}`));
    });
  });
}
