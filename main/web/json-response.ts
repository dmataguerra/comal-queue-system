import type { ServerResponse } from 'node:http';

export function sendJson(res: ServerResponse, data: unknown, state = 200) {
  res.writeHead(state, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}
