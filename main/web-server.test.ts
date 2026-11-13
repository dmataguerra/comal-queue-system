import assert from 'node:assert/strict';
import { messageLogger } from '../shared/logging.js';
import { test } from 'node:test';
import { createWebServer } from './web-server.js';
import { createStore } from './store.js';
import { DEFAULT_CONFIG } from './config.js';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('HTTP acepta únicamente acuses con el mismo contrato estricto de IPC', async () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-acuses-'));
  mkdirSync(join(root, 'manual'));
  const manual = Buffer.from('%PDF-1.7\nmanual de prueba');
  writeFileSync(join(root, 'manual', 'manual-usuario-0.4.0.pdf'), manual);
  const store = createStore({ filePath: join(root, 'estado.json') });
  const received: unknown[] = [];
  const health: unknown[] = [];
  const logs: string[] = [];
  const youtube: unknown[] = [];
  const server = await createWebServer({
    reportHealth: (...args) => {
      health.push(args);
    },
    viewsDir: root,
    contentDir: root,
    port: 0,
    store,
    initialState: () => ({
      instantanea: store.getSnapshot(),
      config: DEFAULT_CONFIG,
      inventario: { videos: [], banner: [], voz: [], aviso: null },
      pantallas: { publica: 'ventana' },
    }),
    diagnostics: () => ({}),
    setVolume: () => {},
    setYouTube: (url) => {
      youtube.push(url);
    },
    importContent: async () => ({ agregados: [], omitidos: [], cancelado: true }),
    removeContent: () => false,
    openContentFolder: async () => {},
    confirmAnnouncement: (...args) => {
      received.push(args);
    },
    logger: messageLogger((message) => {
      logs.push(message);
    }),
  });
  try {
    const pdf = await fetch(`${server.origin}/manual/manual-usuario-0.4.0.pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(Buffer.from(await pdf.arrayBuffer()), manual);
    for (const data of [
      null,
      {},
      [],
      [1, 42],
      [1, 42, 'reproducido', 4],
      [1, 42, ['reproducido']],
      [0, 42, 'fallo'],
      [1, -1, 'fallo'],
      [1, 100, 'fallo'],
      [1.5, 42, 'fallo'],
      [1, 42, 'pendiente'],
      [Number.MAX_SAFE_INTEGER + 1, 42, 'fallo'],
    ]) {
      const r = await fetch(`${server.origin}/api/audio`, {
        method: 'POST',
        headers: {
          Origin: server.origin,
          'Content-Type': 'application/json',
          'X-Turnero-Cliente': 'navegador',
        },
        body: JSON.stringify(data),
      });
      assert.equal(r.status, 400, JSON.stringify(data));
      await r.text();
    }
    assert.equal(received.length, 0);
    for (const state of ['reproduciendo', 'reproducido', 'fallo', 'descartado']) {
      const r = await fetch(`${server.origin}/api/audio`, {
        method: 'POST',
        headers: {
          Origin: server.origin,
          'Content-Type': 'application/json',
          'X-Turnero-Cliente': 'navegador',
        },
        body: JSON.stringify([1, 42, state]),
      });
      assert.equal(r.status, 200);
      await r.text();
    }
    assert.equal(received.length, 4);
    const post = async (filePath: string, data: unknown) => {
      const r = await fetch(`${server.origin}/api/${filePath}`, {
        method: 'POST',
        headers: {
          Origin: server.origin,
          'Content-Type': 'application/json',
          'X-Turnero-Cliente': 'navegador',
        },
        body: JSON.stringify(data),
      });
      const body = await r.json();
      return { status: r.status, body };
    };
    assert.equal(
      (await post('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).status,
      400,
    );
    assert.deepEqual(youtube, []);
    assert.equal((await post('youtube', null)).status, 200);
    assert.deepEqual(youtube, [null]);
    assert.equal((await post('salud', ['audio', 'degradado'])).status, 200);
    assert.equal((await post('salud', ['audio', 'correcto', 'extra'])).status, 400);
    assert.equal((await post('salud', ['audio', 'mentira'])).status, 400);
    assert.deepEqual(health, [['audio', 'degradado']]);
    assert.equal((await post('registro', 'Audio de prueba falló')).status, 200);
    assert.ok(logs.includes('Audio de prueba falló'));
    assert.equal((await post('registro', 'x'.repeat(501))).status, 400);
  } finally {
    server.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
