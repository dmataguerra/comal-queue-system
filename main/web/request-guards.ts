import type { IncomingMessage } from 'node:http';

const MAX_BODY_LENGTH = 65536;

/** The Host header must match the server origin exactly (DNS rebinding guard). */
export function hasExpectedHost(req: IncomingMessage, source: string): boolean {
  return req.headers.host === source.replace('http://', '');
}

/** POST requests must come from the app origin, as JSON, with the browser client marker. */
export function isTrustedPost(req: IncomingMessage, source: string): boolean {
  return (
    req.headers.origin === source &&
    req.headers['content-type'] === 'application/json' &&
    req.headers['x-turnero-cliente'] === 'navegador'
  );
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const part of req) {
    text += part;
    if (text.length > MAX_BODY_LENGTH) throw new Error('Solicitud demasiado grande.');
  }
  return JSON.parse(text);
}
