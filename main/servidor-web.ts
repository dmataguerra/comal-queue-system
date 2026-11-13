import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Config, EntregaAudio, Inventario, Pantallas } from '../shared/contract.js';
import { fileWithin } from './safe-file.js';
import { toApiError } from '../shared/errors.js';
import { APP_CONFIG } from '../shared/app-config.js';
import { createApiRoutes } from './web/api-routes.js';
import { browserInventory } from './web/browser-inventory.js';
import { sendJson } from './web/json-response.js';
import { hasExpectedHost, isTrustedPost, readJsonBody } from './web/request-guards.js';
import { createSseHub } from './web/sse.js';
import { serveFile } from './web/static-files.js';
import type { OpcionesServidor } from './web/types.js';

export async function crearServidorWeb(opciones: OpcionesServidor) {
  const sse = createSseHub();
  const apiRoutes = createApiRoutes(opciones);
  let origen = '';
  const sinSuscripcion = opciones.store.suscribir((instantanea, anuncio, revision) =>
    sse.publish('estado', [instantanea, anuncio, revision]),
  );
  const atender = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!hasExpectedHost(req, origen)) {
        res.writeHead(403).end();
        return;
      }
      const url = new URL(req.url ?? '/', origen);
      if (url.search || url.hash || !['GET', 'POST'].includes(req.method ?? '')) {
        res.writeHead(404).end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(302, { Location: '/vistas/operador/index.html' }).end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/publica') {
        res.writeHead(302, { Location: '/vistas/publica/index.html' }).end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/inicial') {
        const inicial = opciones.inicial();
        sendJson(res, { ...inicial, inventario: browserInventory(inicial.inventario) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/diagnostico') {
        sendJson(res, opciones.diagnostico());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        sse.connect(req, res);
        return;
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        if (!isTrustedPost(req, origen)) {
          res.writeHead(403).end();
          return;
        }
        const dato = await readJsonBody(req);
        const handler = apiRoutes.get(url.pathname);
        if (!handler) res.writeHead(404).end();
        else sendJson(res, await handler(dato));
        return;
      }
      if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
      }
      let ruta: string;
      try {
        ruta = decodeURIComponent(url.pathname);
      } catch {
        res.writeHead(400).end();
        return;
      }
      const esContenido = ruta.startsWith('/contenido/');
      const archivo = await fileWithin(
        esContenido ? opciones.contenido : opciones.vistas,
        ruta.slice(esContenido ? '/contenido/'.length : 1),
      );
      if (!archivo) {
        res.writeHead(404).end();
        return;
      }
      await serveFile(req, res, archivo);
    } catch (error) {
      const fallo = toApiError(error);
      opciones.logger.warn(`Servidor navegador: ${fallo.message}`, {
        path: req.url,
        code: fallo.code,
      });
      if (!res.headersSent && !res.destroyed)
        sendJson(res, { error: fallo.message, code: fallo.code }, 400);
      else res.destroy();
    }
  };
  const servidor = createServer((req, res) => {
    void atender(req, res);
  });
  try {
    await new Promise<void>((resolver, rechazar) => {
      servidor.once('error', rechazar);
      servidor.listen(
        opciones.puerto ?? APP_CONFIG.localServer.defaultPort,
        APP_CONFIG.localServer.host,
        () => {
          servidor.off('error', rechazar);
          resolver();
        },
      );
    });
  } catch (error) {
    sinSuscripcion();
    throw error;
  }
  const direccion = servidor.address() as AddressInfo;
  origen = `http://127.0.0.1:${direccion.port}`;
  return {
    origen,
    difundirConfig: (config: Config) => sse.publish('config', [config]),
    difundirContenido: (inventario: Inventario) =>
      sse.publish('contenido', [browserInventory(inventario)]),
    difundirPantallas: (pantallas: Pantallas) => sse.publish('pantallas', [pantallas]),
    difundirEntregaAudio: (entrega: EntregaAudio) => sse.publish('entregaAudio', [entrega]),
    cerrar: () =>
      new Promise<void>((resolver) => {
        sinSuscripcion();
        sse.closeAll();
        servidor.close(() => resolver());
        servidor.closeAllConnections();
      }),
  };
}
