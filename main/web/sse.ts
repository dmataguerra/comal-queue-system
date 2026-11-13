import type { IncomingMessage, ServerResponse } from 'node:http';

/** Server-sent events hub: tracks connected clients and broadcasts typed messages. */
export function createSseHub() {
  const clients = new Set<ServerResponse>();
  return {
    publish(type: string, data: unknown[]) {
      const message = `data: ${JSON.stringify({ tipo: type, datos: data })}\n\n`;
      for (const client of clients) client.write(message);
    },
    connect(req: IncomingMessage, res: ServerResponse) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      });
      res.write(': conectado\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
    },
    closeAll() {
      for (const client of clients) client.end();
    },
  };
}
