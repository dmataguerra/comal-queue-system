import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearServidorWeb } from './servidor-web.js';
import { crearStore } from './store.js';
import { CONFIG_POR_DEFECTO } from './config.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('HTTP acepta únicamente acuses con el mismo contrato estricto de IPC', async () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-acuses-'));
  const store = crearStore({ ruta: join(raiz, 'estado.json') });
  const recibidos: unknown[] = [];
  const salud: unknown[] = [];
  const logs: string[] = [];
  const youtube: unknown[] = [];
  const servidor = await crearServidorWeb({
    informarSalud: (...args) => {
      salud.push(args);
    },
    vistas: raiz,
    contenido: raiz,
    puerto: 0,
    store,
    inicial: () => ({
      instantanea: store.obtener(),
      config: CONFIG_POR_DEFECTO,
      inventario: { videos: [], banner: [], voz: [], aviso: null },
      pantallas: { publica: 'ventana' },
    }),
    diagnostico: () => ({}),
    configurarVolumen: () => {},
    configurarYouTube: (url) => {
      youtube.push(url);
    },
    importarContenido: async () => ({ agregados: [], omitidos: [], cancelado: true }),
    quitarContenido: () => false,
    abrirCarpetaContenido: async () => {},
    confirmarAnuncio: (...args) => {
      recibidos.push(args);
    },
    registrar: (mensaje) => {
      logs.push(mensaje);
    },
  });
  try {
    for (const dato of [
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
      const r = await fetch(`${servidor.origen}/api/audio`, {
        method: 'POST',
        headers: {
          Origin: servidor.origen,
          'Content-Type': 'application/json',
          'X-Turnero-Cliente': 'navegador',
        },
        body: JSON.stringify(dato),
      });
      assert.equal(r.status, 400, JSON.stringify(dato));
      await r.text();
    }
    assert.equal(recibidos.length, 0);
    for (const estado of ['reproduciendo', 'reproducido', 'fallo', 'descartado']) {
      const r = await fetch(`${servidor.origen}/api/audio`, {
        method: 'POST',
        headers: {
          Origin: servidor.origen,
          'Content-Type': 'application/json',
          'X-Turnero-Cliente': 'navegador',
        },
        body: JSON.stringify([1, 42, estado]),
      });
      assert.equal(r.status, 200);
      await r.text();
    }
    assert.equal(recibidos.length, 4);
    const post = async (ruta: string, dato: unknown) => {
      const r = await fetch(`${servidor.origen}/api/${ruta}`, {
        method: 'POST',
        headers: {
          Origin: servidor.origen,
          'Content-Type': 'application/json',
          'X-Turnero-Cliente': 'navegador',
        },
        body: JSON.stringify(dato),
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
    assert.deepEqual(salud, [['audio', 'degradado']]);
    assert.equal((await post('registro', 'Audio de prueba falló')).status, 200);
    assert.ok(logs.includes('[navegador] Audio de prueba falló'));
    assert.equal((await post('registro', 'x'.repeat(501))).status, 400);
  } finally {
    servidor.cerrar();
    store.cerrar();
    rmSync(raiz, { recursive: true, force: true });
  }
});
