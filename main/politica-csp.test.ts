import assert from 'node:assert/strict';
import test from 'node:test';
import { crearCsp } from './politica-csp.js';

test('la CSP de producción bloquea páginas remotas y permisos amplios', () => {
  const csp = crearCsp(false);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-src https:\/\/www\.youtube\.com https:\/\/www\.youtube-nocookie\.com/);
  assert.match(csp, /media-src 'self'/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.open-meteo\.com/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval|script-src[^;]*unsafe-inline|\*/);
  assert.doesNotMatch(csp, /example\.org/);
});

test('la CSP de desarrollo limita la recarga a Vite local', () => {
  const csp = crearCsp(true);
  assert.match(csp, /ws:\/\/127\.0\.0\.1:5173/);
  assert.match(csp, /img-src 'self' data: turnero:\/\/app/);
  assert.match(csp, /media-src 'self' turnero:\/\/app/);
  assert.match(csp, /connect-src 'self' turnero:\/\/app/);
  assert.match(csp, /script-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(csp, /unsafe-eval|\*/);
});
