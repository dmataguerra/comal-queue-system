import type { ServerResponse } from 'node:http';

export function sendJson(res: ServerResponse, dato: unknown, estado = 200) {
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(dato));
}
