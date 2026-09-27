import { createReadStream } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type { AddressInfo } from 'node:net';
import type {
  Config,
  EntregaAudio,
  Inicial,
  Inventario,
  Pantallas,
  ResultadoImportacion,
} from '../shared/contract.js';
import { TIPOS_MIME } from './contenido.js';
import { crearCsp } from './politica-csp.js';
import { fileWithin } from './safe-file.js';
import {
  validarAccion,
  validarCategoria,
  validarCategoriaOpcional,
  validarUrlContenido,
  validarYouTube,
} from './seguridad-ipc.js';
import type { Store } from './store.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  ...TIPOS_MIME,
};
const origenContenido = 'turnero://app/contenido';
const paraNavegador = (url: string | null) => url?.replace(origenContenido, '/contenido') ?? null;
function inventarioNavegador(inventario: Inventario): Inventario {
  return {
    videos: inventario.videos.map((url) => paraNavegador(url)!),
    banner: inventario.banner.map((url) => paraNavegador(url)!),
    voz: inventario.voz.map(paraNavegador),
    aviso: paraNavegador(inventario.aviso),
  };
}

interface OpcionesServidor {
  vistas: string;
  contenido: string;
  puerto?: number;
  store: Store;
  inicial: () => Inicial;
  diagnostico: () => unknown;
  configurarYouTube: (url: string | null) => void;
  importarContenido: (categoria: 'videos' | 'banner') => Promise<ResultadoImportacion>;
  quitarContenido: (url: string) => boolean;
  abrirCarpetaContenido: (categoria?: 'videos' | 'banner') => Promise<void>;
  registrar: (mensaje: string) => void;
}

export async function crearServidorWeb(opciones: OpcionesServidor) {
  const clientes = new Set<ServerResponse>();
  let origen = '';
  const publicar = (tipo: string, datos: unknown[]) => {
    const mensaje = `data: ${JSON.stringify({ tipo, datos })}\n\n`;
    for (const cliente of clientes) cliente.write(mensaje);
  };
  const sinSuscripcion = opciones.store.suscribir((instantanea, anuncio) =>
    publicar('estado', [instantanea, anuncio]),
  );
  const respuestaJson = (res: ServerResponse, dato: unknown, estado = 200) => {
    res.writeHead(estado, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(dato));
  };
  async function cuerpoJson(req: IncomingMessage): Promise<unknown> {
    let texto = '';
    for await (const parte of req) {
      texto += parte;
      if (texto.length > 65536) throw new Error('Solicitud demasiado grande.');
    }
    return JSON.parse(texto);
  }
  async function servirArchivo(req: IncomingMessage, res: ServerResponse, archivo: string) {
    const size = (await stat(archivo)).size;
    const tipo = MIME[extname(archivo).toLowerCase()] ?? 'application/octet-stream';
    const cabeceras: Record<string, string> = {
      'Content-Type': tipo,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    };
    if (tipo.startsWith('text/html')) cabeceras['Content-Security-Policy'] = crearCsp(false);
    const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (rango && (rango[1] || rango[2])) {
      const inicio = rango[1] ? Number(rango[1]) : Math.max(0, size - Number(rango[2]));
      const fin = rango[1] && rango[2] ? Math.min(Number(rango[2]), size - 1) : size - 1;
      if (inicio >= size || inicio > fin) {
        res.writeHead(416, { ...cabeceras, 'Content-Range': `bytes */${size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        ...cabeceras,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${inicio}-${fin}/${size}`,
        'Content-Length': fin - inicio + 1,
      });
      createReadStream(archivo, { start: inicio, end: fin }).pipe(res);
      return;
    }
    res.writeHead(200, { ...cabeceras, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
    createReadStream(archivo).pipe(res);
  }
  const atender = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.headers.host !== origen.replace('http://', '')) {
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
        respuestaJson(res, { ...inicial, inventario: inventarioNavegador(inicial.inventario) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/diagnostico') {
        respuestaJson(res, opciones.diagnostico());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
          'X-Content-Type-Options': 'nosniff',
        });
        res.write(': conectado\n\n');
        clientes.add(res);
        req.on('close', () => clientes.delete(res));
        return;
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        if (
          req.headers.origin !== origen ||
          req.headers['content-type'] !== 'application/json' ||
          req.headers['x-turnero-cliente'] !== 'navegador'
        ) {
          res.writeHead(403).end();
          return;
        }
        const dato = await cuerpoJson(req);
        if (url.pathname === '/api/accion')
          respuestaJson(res, opciones.store.despachar(validarAccion(dato)));
        else if (url.pathname === '/api/youtube') {
          opciones.configurarYouTube(validarYouTube(dato));
          respuestaJson(res, null);
        } else if (url.pathname === '/api/contenido/importar')
          respuestaJson(res, await opciones.importarContenido(validarCategoria(dato)));
        else if (url.pathname === '/api/contenido/quitar') {
          if (typeof dato !== 'string' || !dato.startsWith('/contenido/'))
            throw new Error('Archivo inválido.');
          respuestaJson(res, opciones.quitarContenido(validarUrlContenido(`turnero://app${dato}`)));
        } else if (url.pathname === '/api/contenido/abrir') {
          await opciones.abrirCarpetaContenido(
            validarCategoriaOpcional(dato === null ? undefined : dato),
          );
          respuestaJson(res, null);
        } else res.writeHead(404).end();
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
      await servirArchivo(req, res, archivo);
    } catch (error) {
      opciones.registrar(`Servidor navegador: ${(error as Error).message}`);
      if (!res.headersSent) respuestaJson(res, { error: (error as Error).message }, 400);
      else res.destroy();
    }
  };
  const servidor = createServer((req, res) => {
    void atender(req, res);
  });
  try {
    await new Promise<void>((resolver, rechazar) => {
      servidor.once('error', rechazar);
      servidor.listen(opciones.puerto ?? 4317, '127.0.0.1', () => {
        servidor.off('error', rechazar);
        resolver();
      });
    });
  } catch (error) {
    sinSuscripcion();
    throw error;
  }
  const direccion = servidor.address() as AddressInfo;
  origen = `http://127.0.0.1:${direccion.port}`;
  return {
    origen,
    difundirConfig: (config: Config) => publicar('config', [config]),
    difundirContenido: (inventario: Inventario) =>
      publicar('contenido', [inventarioNavegador(inventario)]),
    difundirPantallas: (pantallas: Pantallas) => publicar('pantallas', [pantallas]),
    difundirEntregaAudio: (entrega: EntregaAudio) => publicar('entregaAudio', [entrega]),
    cerrar: () => {
      sinSuscripcion();
      for (const cliente of clientes) cliente.end();
      servidor.close();
    },
  };
}
