import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { viewPath } from '../shared/app-config.js';
import type { AddressInfo } from 'node:net';
import type { Config, AudioDelivery, Inventory, Screens } from '../shared/contract.js';
import { fileWithin } from './safe-file.js';
import { toApiError } from '../shared/errors.js';
import { APP_CONFIG } from '../shared/app-config.js';
import { createApiRoutes } from './web/api-routes.js';
import { browserInventory } from './web/browser-inventory.js';
import { sendJson } from './web/json-response.js';
import { hasExpectedHost, isTrustedPost, readJsonBody } from './web/request-guards.js';
import { createSseHub } from './web/sse.js';
import { serveFile } from './web/static-files.js';
import type { ServerOptions } from './web/types.js';

export async function createWebServer(options: ServerOptions) {
  const sse = createSseHub();
  const apiRoutes = createApiRoutes(options);
  let source = '';
  const noSubscription = options.store.subscribe((snapshot, announcement, revision) =>
    sse.publish('estado', [snapshot, announcement, revision]),
  );
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!hasExpectedHost(req, source)) {
        res.writeHead(403).end();
        return;
      }
      const url = new URL(req.url ?? '/', source);
      if (url.search || url.hash || !['GET', 'POST'].includes(req.method ?? '')) {
        res.writeHead(404).end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(302, { Location: viewPath('operador') }).end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/publica') {
        res.writeHead(302, { Location: viewPath('publica') }).end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/inicial') {
        const initialState = options.initialState();
        sendJson(res, { ...initialState, inventario: browserInventory(initialState.inventario) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/diagnostico') {
        sendJson(res, options.diagnostics());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        sse.connect(req, res);
        return;
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        if (!isTrustedPost(req, source)) {
          res.writeHead(403).end();
          return;
        }
        const data = await readJsonBody(req);
        const handler = apiRoutes.get(url.pathname);
        if (!handler) res.writeHead(404).end();
        else sendJson(res, await handler(data));
        return;
      }
      if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
      }
      let filePath: string;
      try {
        filePath = decodeURIComponent(url.pathname);
      } catch {
        res.writeHead(400).end();
        return;
      }
      const isContent = filePath.startsWith('/contenido/');
      const file = await fileWithin(
        isContent ? options.contentDir : options.viewsDir,
        filePath.slice(isContent ? '/contenido/'.length : 1),
      );
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      await serveFile(req, res, file);
    } catch (error) {
      const failure = toApiError(error);
      options.logger.warn(`Servidor navegador: ${failure.message}`, {
        path: req.url,
        code: failure.code,
      });
      if (!res.headersSent && !res.destroyed)
        sendJson(res, { error: failure.message, code: failure.code }, 400);
      else res.destroy();
    }
  };
  const server = createServer((req, res) => {
    void handle(req, res);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(
        options.port ?? APP_CONFIG.localServer.defaultPort,
        APP_CONFIG.localServer.host,
        () => {
          server.off('error', reject);
          resolve();
        },
      );
    });
  } catch (error) {
    noSubscription();
    throw error;
  }
  const address = server.address() as AddressInfo;
  source = `http://127.0.0.1:${address.port}`;
  return {
    origin: source,
    broadcastConfig: (config: Config) => sse.publish('config', [config]),
    broadcastContent: (inventory: Inventory) =>
      sse.publish('contenido', [browserInventory(inventory)]),
    broadcastScreens: (screens: Screens) => sse.publish('pantallas', [screens]),
    broadcastAudioDelivery: (delivery: AudioDelivery) => sse.publish('entregaAudio', [delivery]),
    close: () =>
      new Promise<void>((resolve) => {
        noSubscription();
        sse.closeAll();
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
