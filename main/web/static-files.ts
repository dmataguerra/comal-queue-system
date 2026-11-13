import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { MIME_TYPES } from '../content.js';
import { createCsp } from '../csp-policy.js';

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
  ...MIME_TYPES,
};

/** Streams a file, honoring single-range `Range: bytes=` requests. */
export async function serveFile(req: IncomingMessage, res: ServerResponse, file: string) {
  const size = (await stat(file)).size;
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  if (type.startsWith('text/html')) headers['Content-Security-Policy'] = createCsp(false);
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    const copyStarted = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const finished = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (copyStarted >= size || copyStarted > finished) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${copyStarted}-${finished}/${size}`,
      'Content-Length': finished - copyStarted + 1,
    });
    // If the file disappears while being read, the response is closed without crashing the app.
    await pipeline(createReadStream(file, { start: copyStarted, end: finished }), res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  await pipeline(createReadStream(file), res);
}
