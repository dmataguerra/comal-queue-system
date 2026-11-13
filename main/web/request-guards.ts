import type { IncomingMessage } from 'node:http';

const MAX_BODY_LENGTH = 65536;

/** The Host header must match the server origin exactly (DNS rebinding guard). */
export function hasExpectedHost(req: IncomingMessage, origen: string): boolean {
  return req.headers.host === origen.replace('http://', '');
}

/** POST requests must come from the app origin, as JSON, with the browser client marker. */
export function isTrustedPost(req: IncomingMessage, origen: string): boolean {
  return (
    req.headers.origin === origen &&
    req.headers['content-type'] === 'application/json' &&
    req.headers['x-turnero-cliente'] === 'navegador'
  );
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let texto = '';
  for await (const parte of req) {
    texto += parte;
    if (texto.length > MAX_BODY_LENGTH) throw new Error('Solicitud demasiado grande.');
  }
  return JSON.parse(texto);
}
