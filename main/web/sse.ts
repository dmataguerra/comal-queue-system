import type { IncomingMessage, ServerResponse } from 'node:http';

/** Server-sent events hub: tracks connected clients and broadcasts typed messages. */
export function createSseHub() {
  const clientes = new Set<ServerResponse>();
  return {
    publish(tipo: string, datos: unknown[]) {
      const mensaje = `data: ${JSON.stringify({ tipo, datos })}\n\n`;
      for (const cliente of clientes) cliente.write(mensaje);
    },
    connect(req: IncomingMessage, res: ServerResponse) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      });
      res.write(': conectado\n\n');
      clientes.add(res);
      req.on('close', () => clientes.delete(res));
    },
    closeAll() {
      for (const cliente of clientes) cliente.end();
    },
  };
}
