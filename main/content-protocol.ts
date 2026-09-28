import { net, protocol } from 'electron';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { TIPOS_MIME } from './contenido.js';
import { fileWithin } from './safe-file.js';

interface ProtocolOptions {
  contentRoot: string;
  viewsRoot: string;
  developmentUrl?: string;
  contentSecurityPolicy: string;
}

/** Stream media with byte ranges, allowing Chromium to seek without buffering whole files. */
async function serveMedia(file: string, range: string | null, headers: Record<string, string>) {
  const size = (await stat(file)).size;
  const type = TIPOS_MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const parts = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (parts && (parts[1] || parts[2])) {
    const start = parts[1] ? Number(parts[1]) : Math.max(0, size - Number(parts[2]));
    const end = parts[1] && parts[2] ? Math.min(Number(parts[2]), size - 1) : size - 1;
    if (start >= size || start > end)
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${size}` },
      });
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        ...headers,
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${size}`,
      },
    });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, {
    headers: {
      ...headers,
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(size),
    },
  });
}

export function registerContentProtocol({
  contentRoot,
  viewsRoot,
  developmentUrl,
  contentSecurityPolicy,
}: ProtocolOptions): void {
  const mediaHeaders = {
    'Cache-Control': 'no-cache',
    ...(developmentUrl ? { 'Access-Control-Allow-Origin': new URL(developmentUrl).origin } : {}),
  };
  protocol.handle('turnero', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'app' || url.search || url.hash)
      return new Response('No encontrado', { status: 404 });
    let path: string;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Ruta inválida', { status: 400 });
    }
    if (path.startsWith('/contenido/')) {
      const file = await fileWithin(contentRoot, path.slice('/contenido/'.length));
      return file
        ? serveMedia(file, request.headers.get('range'), mediaHeaders)
        : new Response('No encontrado', { status: 404, headers: mediaHeaders });
    }
    const file = await fileWithin(viewsRoot, path.slice(1));
    if (!file) return new Response('No encontrado', { status: 404 });
    const response = await net.fetch(pathToFileURL(file).toString());
    if (extname(file) !== '.html') return response;
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Content-Security-Policy', contentSecurityPolicy);
    return new Response(response.body, { status: response.status, headers });
  });
}
