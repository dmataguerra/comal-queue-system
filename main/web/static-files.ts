import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { TIPOS_MIME } from '../contenido.js';
import { crearCsp } from '../politica-csp.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  ...TIPOS_MIME,
};

/** Streams a file, honoring single-range `Range: bytes=` requests. */
export async function serveFile(req: IncomingMessage, res: ServerResponse, archivo: string) {
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
    // Si el archivo desaparece durante la lectura, se cierra la respuesta sin tumbar la app.
    await pipeline(createReadStream(archivo, { start: inicio, end: fin }), res);
    return;
  }
  res.writeHead(200, { ...cabeceras, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  await pipeline(createReadStream(archivo), res);
}
