import assert from 'node:assert/strict';
import test from 'node:test';
import type { Config } from '../shared/contract.js';
import { createDiagnosticsProvider, availableSpace } from './diagnostics.js';
import type { Store } from './store.js';
test('proveedor reúne salud, inventario y espacio sin exponer datos externos', () => {
  const store = {
    obtener: () => ({ actual: 42, llamados: [41], puedeDeshacer: false }),
    saludPersistencia: () => ({
      estado: 'correcta',
      primerFallo: null,
      restauradaEn: null,
      ultimoGuardado: '2026-09-24T12:00:00.000Z',
      ultimoError: null,
      ultimoAnuncio: { n: 42, fecha: '2026-09-24T12:00:00.000Z' },
    }),
  } as Store;
  const get = createDiagnosticsProvider({
    carpetaDatos: 'C:/datos',
    version: '0.3.0',
    store,
    config: () => ({ youtubeUrl: null }) as Config,
    inventario: () => ({
      videos: ['a'],
      banner: ['b'],
      voz: Array(100).fill('voz'),
      aviso: 'aviso',
    }),
    pantallas: () => ({ publica: 'tv' }),
    ventanas: () => ({ operador: true, publica: true }),
    salud: () => ({ audio: 'correcto', youtube: 'inactivo', ultimoErrorAplicacion: null }),
    espacio: () => 1024 ** 3,
  });
  const data = get();
  assert.equal(data.vocesValidas, 100);
  assert.equal(data.longitudCola, 2);
  assert.equal(data.ultimoGuardado, '2026-09-24T12:00:00.000Z');
  assert.equal(data.accionPendiente, false);
  assert.equal('env' in data, false);
});
test('fallos de subsistemas producen datos parciales y espacio desconocido', () => {
  const get = createDiagnosticsProvider({
    carpetaDatos: 'C:/datos',
    version: '0.3.0',
    store: {
      obtener: () => {
        throw Error('estado');
      },
      saludPersistencia: () => {
        throw Error('salud');
      },
    } as unknown as Store,
    config: () => {
      throw Error('config');
    },
    inventario: () => {
      throw Error('contenido');
    },
    pantallas: () => {
      throw Error('TV');
    },
    ventanas: () => {
      throw Error('ventanas');
    },
    salud: () => {
      throw Error('audio');
    },
    espacio: () => {
      throw Error('disco');
    },
  });
  assert.equal(get().persistencia, 'error');
  assert.equal(get().espacioLibre, null);
  assert.equal(get().videosValidos, 0);
  assert.equal(typeof availableSpace('/ruta/imposible'), 'object');
});
