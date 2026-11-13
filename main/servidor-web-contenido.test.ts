import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearServidorWeb } from './servidor-web.js';
import { crearStore } from './store.js';
import { CONFIG_POR_DEFECTO } from './config.js';

// COMAL-QA-044: "Abrir carpeta de multimedia" delivers only valid categories to the main
// process and reports failures. The OS call (shell.openPath) is replaced by a recorder, so
// Windows Explorer never opens during automation.
test('abrir carpeta de multimedia: entrega solo categorías válidas e informa fallos', async (t) => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-abrir-'));
  const vistas = join(raiz, 'vistas');
  const contenido = join(raiz, 'contenido');
  mkdirSync(vistas);
  mkdirSync(contenido);
  const store = crearStore({ ruta: join(raiz, 'estado.json') });
  const abiertas: unknown[] = [];
  let fallar = false;
  const servidor = await crearServidorWeb({
    vistas,
    contenido,
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
    configurarYouTube: () => {},
    informarSalud: () => {},
    importarContenido: async () => ({ agregados: [], omitidos: [], cancelado: true }),
    quitarContenido: () => false,
    abrirCarpetaContenido: async (categoria) => {
      if (fallar) throw new Error('No se pudo abrir la carpeta de multimedia: acceso denegado');
      abiertas.push(categoria);
    },
    confirmarAnuncio: () => {},
    registrar: () => {},
  });
  t.after(() => {
    servidor.cerrar();
    store.cerrar();
    rmSync(raiz, { recursive: true, force: true });
  });
  const headers = {
    Origin: servidor.origen,
    'Content-Type': 'application/json',
    'X-Turnero-Cliente': 'navegador',
  };
  const abrir = (dato: unknown, extra: Record<string, string> = {}) =>
    fetch(`${servidor.origen}/api/contenido/abrir`, {
      method: 'POST',
      headers: { ...headers, ...extra },
      body: JSON.stringify(dato),
    });

  for (const dato of [null, 'videos', 'banner']) {
    const res = await abrir(dato);
    assert.equal(res.status, 200, `categoría ${String(dato)}`);
    await res.text();
  }
  assert.deepEqual(abiertas, [undefined, 'videos', 'banner']);

  for (const dato of ['voz', '../..', 'C:\\Windows', 42, ['videos'], {}]) {
    const res = await abrir(dato);
    assert.ok(res.status >= 400, `${JSON.stringify(dato)} debe rechazarse`);
    await res.text();
  }
  const ajeno = await abrir('videos', { Origin: 'http://externo.example' });
  assert.equal(ajeno.status, 403);
  await ajeno.text();
  assert.deepEqual(abiertas, [undefined, 'videos', 'banner'], 'ninguna ruta inválida se abrió');

  fallar = true;
  const fallo = await abrir('videos');
  assert.ok(fallo.status >= 400, 'el fallo del sistema operativo no se reporta como éxito');
  assert.match(await fallo.text(), /No se pudo abrir la carpeta/);
  fallar = false;
  const despues = await abrir(null);
  assert.equal(despues.status, 200, 'el servidor sigue operativo después del fallo');
  await despues.text();
});
