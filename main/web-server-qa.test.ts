import assert from 'node:assert/strict';
import { messageLogger } from '../shared/logging.js';
import fs, { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test, type TestContext } from 'node:test';
import { DEFAULT_CONFIG } from './config.js';
import { createWebServer } from './web-server.js';
import { createStore } from './store.js';
async function createEnvironment(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'comal-http-qa-'));
  const views = join(root, 'vistas');
  const content = join(root, 'contenido');
  mkdirSync(views);
  mkdirSync(content);
  writeFileSync(join(views, 'index.html'), '<!doctype html><title>Comal</title>');
  writeFileSync(join(content, 'prueba.mp4'), '0123456789');
  writeFileSync(join(content, 'vacio.mp4'), '');
  writeFileSync(join(root, 'privado.txt'), 'NO PUBLICAR');
  const filePath = join(root, 'estado.json');
  const store = createStore({ ruta: filePath });
  const logs: string[] = [];
  const server = await createWebServer({
    vistas: views,
    contenido: content,
    puerto: 0,
    store,
    inicial: () => ({
      instantanea: store.obtener(),
      config: DEFAULT_CONFIG,
      inventario: { videos: [], banner: [], voz: [], aviso: null },
      pantallas: { publica: 'ventana' },
    }),
    diagnostico: () => ({}),
    configurarVolumen: () => {},
    configurarYouTube: () => {},
    informarSalud: () => {},
    importarContenido: async () => ({ agregados: [], omitidos: [], cancelado: true }),
    quitarContenido: () => false,
    abrirCarpetaContenido: async () => {},
    confirmarAnuncio: () => {},
    logger: messageLogger((message) => logs.push(message)),
  });
  t.after(() => {
    server.cerrar();
    store.cerrar();
    rmSync(root, { recursive: true, force: true });
  });
  const headers = {
    Origin: server.origen,
    'Content-Type': 'application/json',
    'X-Turnero-Cliente': 'navegador',
  };
  return { ...server, raiz: root, ruta: filePath, store, headers, logs };
}
test('HTTP rechaza Host, Origin y solicitudes de escritura no autorizadas sin cambiar estado', async (t) => {
  const e = await createEnvironment(t);
  const before = e.store.obtener();
  const body = JSON.stringify({ tipo: 'LLAMAR', entrada: '42' });
  for (const headers of [
    {},
    { ...e.headers, Origin: 'https://externo.example' },
    { ...e.headers, Origin: 'null' },
    { ...e.headers, 'Content-Type': 'text/plain' },
    { ...e.headers, 'X-Turnero-Cliente': 'externo' },
  ]) {
    const res = await fetch(`${e.origen}/api/accion`, { method: 'POST', headers, body });
    assert.equal(res.status, 403, JSON.stringify(headers));
    await res.text();
  }
  await new Promise<void>((resolve, reject) => {
    const req = request(
      `${e.origen}/api/accion`,
      {
        method: 'POST',
        headers: { ...e.headers, Host: 'externo.example' },
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          try {
            assert.equal(res.statusCode, 403);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('error', reject);
    req.end(body);
  });
  assert.deepEqual(e.store.obtener(), before);
});
test('HTTP rechaza traversal codificado, rutas inválidas y métodos inesperados', async (t) => {
  const e = await createEnvironment(t);
  for (const path of [
    '/%2e%2e%5cprivado.txt',
    '/contenido/%2e%2e%5cprivado.txt',
    '/contenido/%2f..%2fprivado.txt',
    '/contenido/%252e%252e%255cprivado.txt',
    '/contenido/%00prueba.mp4',
    '/%ZZ',
    '/api/inicial?secreto=1',
  ]) {
    const res = await fetch(`${e.origen}${path}`);
    assert.ok([400, 404].includes(res.status), `${path}: ${res.status}`);
    assert.ok(!(await res.text()).includes('NO PUBLICAR'));
  }
  for (const method of ['PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
    const res = await fetch(`${e.origen}/api/accion`, { method });
    assert.equal(res.status, 404);
    await res.text();
  }
});
test('HTTP limita cuerpos, valida JSON y sigue operativo después de entradas maliciosas', async (t) => {
  const e = await createEnvironment(t);
  for (const body of ['{', 'null', '[]', '"' + 'x'.repeat(70000) + '"']) {
    const res = await fetch(`${e.origen}/api/accion`, {
      method: 'POST',
      headers: e.headers,
      body,
    });
    assert.equal(res.status, 400);
    await res.text();
  }
  assert.equal(e.store.obtener().actual, null);
  const res = await fetch(`${e.origen}/api/accion`, {
    method: 'POST',
    headers: e.headers,
    body: JSON.stringify({ tipo: 'LLAMAR', entrada: '123442' }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).instantanea.actual, 42);
});
test('HTTP conserva bytes, CSP y rangos de multimedia incluso con límites extremos', async (t) => {
  const e = await createEnvironment(t);
  const html = await fetch(`${e.origen}/index.html`);
  assert.equal(html.status, 200);
  assert.ok(html.headers.get('content-security-policy')?.includes("default-src 'self'"));
  assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  await html.text();
  for (const [range, status, body, contentRange] of [
    ['bytes=0-0', 206, '0', 'bytes 0-0/10'],
    ['bytes=3-6', 206, '3456', 'bytes 3-6/10'],
    ['bytes=7-', 206, '789', 'bytes 7-9/10'],
    ['bytes=-3', 206, '789', 'bytes 7-9/10'],
    ['bytes=0-99999999999999999999', 206, '0123456789', 'bytes 0-9/10'],
    ['bytes=10-', 416, '', 'bytes */10'],
    ['bytes=5-2', 416, '', 'bytes */10'],
    ['bytes=-0', 416, '', 'bytes */10'],
    ['bytes=99999999999999999999-', 416, '', 'bytes */10'],
  ] as const) {
    const res = await fetch(`${e.origen}/contenido/prueba.mp4`, { headers: { Range: range } });
    assert.equal(res.status, status, range);
    assert.equal(res.headers.get('content-range'), contentRange, range);
    assert.equal(await res.text(), body, range);
  }
  const empty = await fetch(`${e.origen}/contenido/vacio.mp4`, {
    headers: { Range: 'bytes=0-' },
  });
  assert.equal(empty.status, 416);
  await empty.text();
});
test('HTTP serializa una ráfaga de 100 llamadas y persiste el último estado confirmado', async (t) => {
  const e = await createEnvironment(t);
  const responses = await Promise.all(
    Array.from({ length: 100 }, async (_, n) => {
      const res = await fetch(`${e.origen}/api/accion`, {
        method: 'POST',
        headers: e.headers,
        body: JSON.stringify({ tipo: 'LLAMAR', entrada: String(n) }),
      });
      assert.equal(res.status, 200);
      return res.json();
    }),
  );
  const ids = responses.map((r) => r.anuncio.id);
  assert.equal(new Set(ids).size, 100);
  assert.deepEqual(
    [...ids].sort((a, b) => a - b),
    Array.from({ length: 100 }, (_, n) => n + 1),
  );
  const last = responses.find((r) => r.anuncio.id === 100);
  assert.deepEqual(e.store.obtener(), last.instantanea);
  const persisted = JSON.parse(readFileSync(e.ruta, 'utf8'));
  assert.equal(persisted.actual, last.instantanea.actual);
  assert.deepEqual(persisted.llamados, last.instantanea.llamados);
});
test('HTTP notifica por SSE y libera la suscripción cuando el cliente desconecta', async (t) => {
  const e = await createEnvironment(t);
  const controller = new AbortController();
  const res = await fetch(`${e.origen}/api/events`, { signal: controller.signal });
  const reader = res.body!.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /conectado/);
  e.store.despachar({ tipo: 'LLAMAR', entrada: '42' });
  assert.match(new TextDecoder().decode((await reader.read()).value), /"actual":42/);
  controller.abort();
  await reader.cancel().catch(() => {});
  e.store.despachar({ tipo: 'LLAMAR', entrada: '43' });
  assert.equal(e.store.obtener().actual, 43);
});
test('HTTP contiene errores de lectura de archivos sin terminar el proceso principal', async (t) => {
  const e = await createEnvironment(t);
  const original = fs.createReadStream;
  t.mock.method(
    fs,
    'createReadStream',
    () =>
      new Readable({
        read() {
          this.destroy(
            Object.assign(new Error('Archivo retirado durante la lectura'), { code: 'ENOENT' }),
          );
        },
      }),
  );
  syncBuiltinESMExports();
  try {
    for (const range of [undefined, 'bytes=0-3']) {
      await new Promise<void>((resolve, reject) => {
        const req = request(
          `${e.origen}/contenido/prueba.mp4`,
          {
            headers: range ? { Range: range } : {},
          },
          (res) => {
            res.resume();
            res.on('error', () => resolve());
            res.on('end', () => resolve());
          },
        );
        req.on('error', () => resolve());
        req.setTimeout(3000, () => req.destroy(new Error('Timeout: lectura sin resolver')));
        req.on('timeout', () => reject(new Error('La solicitud quedó bloqueada')));
        req.end();
      });
    }
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal(fs.createReadStream, original);
  const res = await fetch(`${e.origen}/api/inicial`);
  assert.equal(res.status, 200);
  await res.text();
  assert.ok(
    e.logs.some((line) => line.includes('Archivo retirado durante la lectura')),
    JSON.stringify(e.logs),
  );
});
