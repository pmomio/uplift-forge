/**
 * Lightweight HTTP mock server for JIRA REST API v3.
 *
 * Handles the routes that jira.service.ts calls. Each route can be
 * overridden per-test via setRoute() for negative/edge-case testing.
 */
import * as http from 'http';
import {
  MOCK_PROJECT,
  MOCK_STATUSES,
  MOCK_FIELDS,
  MOCK_MEMBERS,
  MOCK_ISSUES,
  MOCK_FIELD_CONTEXTS,
  MOCK_FIELD_OPTIONS,
  makeSearchResponse,
  findIssue,
} from './mock-data';

type RouteHandler = (
  req: http.IncomingMessage,
  url: URL,
) => { status: number; body: unknown } | null;

export class JiraMockServer {
  private server: http.Server;
  private routes = new Map<string, RouteHandler>();
  private _port = 0;

  constructor() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.resetRoutes();
  }

  get port(): number {
    return this._port;
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this._port}`;
  }

  /** Start the server on a random free port */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address();
        if (addr && typeof addr === 'object') {
          this._port = addr.port;
        }
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  /** Stop the server */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  /** Override a route pattern (path prefix match) for the current test */
  setRoute(pathPrefix: string, handler: RouteHandler): void {
    this.routes.set(pathPrefix, handler);
  }

  /** Convenience: set a static JSON response for a path */
  mockRoute(pathPrefix: string, status: number, body: unknown): void {
    this.setRoute(pathPrefix, () => ({ status, body }));
  }

  /** Reset all routes back to defaults */
  resetRoutes(): void {
    this.routes.clear();

    // GET /rest/api/3/project/:key
    this.setRoute('/rest/api/3/project/', (_req, _url) => ({
      status: 200,
      body: MOCK_PROJECT,
    }));

    // GET /rest/api/3/field/:fieldId/context (field options — must come before generic /field route)
    this.setRoute('/rest/api/3/field/customfield_', (_req, url) => {
      const parts = url.pathname.split('/');
      // .../field/{fieldId}/context or .../field/{fieldId}/context/{ctxId}/option
      const fieldIdx = parts.indexOf('field');
      const fieldId = fieldIdx >= 0 ? parts[fieldIdx + 1] : '';

      if (parts.includes('option')) {
        // .../field/{fieldId}/context/{ctxId}/option
        const ctxIdx = parts.indexOf('context');
        const ctxId = ctxIdx >= 0 ? parts[ctxIdx + 1] : '';
        const options = MOCK_FIELD_OPTIONS[ctxId] ?? { values: [], isLast: true };
        return { status: 200, body: options };
      }

      if (parts.includes('context')) {
        // .../field/{fieldId}/context
        const contexts = MOCK_FIELD_CONTEXTS[fieldId] ?? { values: [] };
        return { status: 200, body: contexts };
      }

      return null;  // fall through to /rest/api/3/field handler
    });

    // GET /rest/api/3/field
    this.setRoute('/rest/api/3/field', () => ({
      status: 200,
      body: MOCK_FIELDS,
    }));

    // GET /rest/api/3/status
    this.setRoute('/rest/api/3/status', () => ({
      status: 200,
      body: MOCK_STATUSES,
    }));

    // GET /rest/api/3/search/jql (or /rest/api/3/search)
    this.setRoute('/rest/api/3/search', () => ({
      status: 200,
      body: makeSearchResponse(),
    }));

    // GET /rest/api/3/issue/:key
    this.setRoute('/rest/api/3/issue/', (_req, url) => {
      const parts = url.pathname.split('/');
      const key = parts[parts.length - 1];
      const issue = findIssue(key);
      if (issue) return { status: 200, body: issue };
      return { status: 404, body: { errorMessages: ['Issue not found'] } };
    });

    // PUT /rest/api/3/issue/:key (write-back)
    this.setRoute('PUT:/rest/api/3/issue/', () => ({
      status: 204,
      body: null,
    }));

    // JIRA project members (user search)
    this.setRoute('/rest/api/3/user/search', () => ({
      status: 200,
      body: MOCK_MEMBERS,
    }));

    // Fallback for /rest/api/3/myself (used during login validation)
    this.setRoute('/rest/api/3/myself', () => ({
      status: 200,
      body: {
        accountId: 'test-user',
        emailAddress: 'test@example.com',
        displayName: 'Test User',
        active: true,
      },
    }));
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://127.0.0.1:${this._port}`);
    const method = (req.method || 'GET').toUpperCase();
    const pathname = url.pathname;

    // Try method-specific route first (e.g. "PUT:/rest/api/3/issue/")
    const methodKey = `${method}:${pathname}`;
    for (const [prefix, handler] of this.routes) {
      if (prefix.includes(':') && methodKey.startsWith(prefix)) {
        const result = handler(req, url);
        if (result) {
          this.sendResponse(res, result.status, result.body);
          return;
        }
      }
    }

    // Try path-only routes
    for (const [prefix, handler] of this.routes) {
      if (!prefix.includes(':') && pathname.startsWith(prefix)) {
        const result = handler(req, url);
        if (result) {
          this.sendResponse(res, result.status, result.body);
          return;
        }
      }
    }

    // 404 fallback
    this.sendResponse(res, 404, { error: `No mock for ${method} ${pathname}` });
  }

  private sendResponse(res: http.ServerResponse, status: number, body: unknown) {
    if (status === 204 || body === null) {
      res.writeHead(status);
      res.end();
      return;
    }
    const json = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(json),
    });
    res.end(json);
  }
}
