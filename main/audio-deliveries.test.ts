import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAudioDeliveries } from './audio-deliveries.js';
import {
  MAX_ANNOUNCEMENT_WAIT_MS,
  MAX_ANNOUNCEMENT_HISTORY,
  latestDeliveries,
} from '../shared/announcement-policy.js';
import { createStore } from './store.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('dos llamadas del mismo número conservan IDs y acuses independientes, aun fuera de orden', () => {
  const deliveries = createAudioDeliveries(() => {});
  deliveries.registrar({ id: 1, n: 42 });
  deliveries.registrar({ id: 2, n: 42 });
  deliveries.confirmar(2, 42, 'reproduciendo');
  deliveries.confirmar(1, 42, 'reproducido');
  assert.deepEqual(
    deliveries.obtener().map((e) => [e.id, e.estado]),
    [
      [1, 'reproducido'],
      [2, 'reproduciendo'],
    ],
  );
  assert.equal(latestDeliveries(deliveries.obtener())[0].id, 2);
  deliveries.confirmar(2, 43, 'fallo');
  assert.equal(deliveries.obtener()[1].estado, 'reproduciendo');
  deliveries.confirmar(2, 42, 'reproducido');
  deliveries.confirmar(1, 42, 'fallo');
  assert.ok(deliveries.obtener().every((e) => e.estado === 'reproducido'));
});
test('saturación rechaza antes de guardar y no consume un ID ni altera el turno', () => {
  const root = mkdtempSync(join(tmpdir(), 'comal-saturacion-'));
  const filePath = join(root, 'estado.json');
  const deliveries = createAudioDeliveries(() => {});
  const store = createStore({ ruta: filePath, antesDeAnunciar: deliveries.comprobarCapacidad });
  store.suscribir((s, a) => {
    deliveries.sincronizar(s);
    if (a) deliveries.registrar(a);
  });
  try {
    for (let i = 0; i < 6; i++) store.despachar({ tipo: 'LLAMAR', entrada: '42' });
    const file = readFileSync(filePath, 'utf8');
    const state = store.obtener();
    assert.throws(
      () => store.despachar({ tipo: 'LLAMAR', entrada: '43' }),
      /cola de audio está llena/,
    );
    assert.deepEqual(store.obtener(), state);
    assert.equal(readFileSync(filePath, 'utf8'), file);
    deliveries.confirmar(1, 42, 'reproducido');
    assert.equal(store.despachar({ tipo: 'LLAMAR', entrada: '43' }).anuncio?.id, 7);
  } finally {
    store.cerrar();
    rmSync(root, { recursive: true, force: true });
  }
});
test('caducidad, retiro y falta de acuses liberan capacidad sin aceptar acuses tardíos', () => {
  let currentTime = 0;
  const deliveries = createAudioDeliveries(
    () => {},
    () => currentTime,
  );
  deliveries.registrar({ id: 1, n: 42 });
  deliveries.registrar({ id: 2, n: 43 });
  deliveries.confirmar(1, 42, 'reproduciendo');
  deliveries.sincronizar({ actual: 42, llamados: [], puedeDeshacer: false });
  assert.equal(deliveries.obtener()[1].estado, 'descartado');
  currentTime = MAX_ANNOUNCEMENT_WAIT_MS;
  deliveries.vencer();
  assert.ok(deliveries.obtener().every((e) => e.estado === 'descartado'));
  deliveries.confirmar(1, 42, 'reproducido');
  assert.equal(deliveries.obtener()[0].estado, 'descartado');
  deliveries.comprobarCapacidad();
});
test('el historial es acotado, sin borrar entregas activas', () => {
  const deliveries = createAudioDeliveries(() => {});
  deliveries.registrar({ id: 1, n: 42 });
  for (let id = 2; id < 150; id++) {
    deliveries.registrar({ id, n: 43 });
    deliveries.confirmar(id, 43, 'reproducido');
  }
  assert.equal(deliveries.obtener().length, MAX_ANNOUNCEMENT_HISTORY);
  assert.equal(deliveries.obtener()[0].id, 1);
});
test('interrupted announcements go back to pending with a fresh wait window', () => {
  let now = 1000;
  const deliveries = createAudioDeliveries(
    () => {},
    () => now,
  );
  deliveries.registrar({ id: 1, n: 27 });
  deliveries.registrar({ id: 2, n: 28 });
  deliveries.confirmar(1, 27, 'reproduciendo');
  now += 20000;
  deliveries.reanudarInterrumpidos();
  assert.deepEqual(
    deliveries.obtener().map((e) => [e.id, e.estado]),
    [
      [1, 'pendiente'],
      [2, 'pendiente'],
    ],
  );
  // The resumed one gets a full new wait window; the untouched one keeps its original limit.
  now = 1000 + MAX_ANNOUNCEMENT_WAIT_MS + 1;
  deliveries.vencer();
  assert.deepEqual(
    deliveries.obtener().map((e) => [e.id, e.estado]),
    [
      [1, 'pendiente'],
      [2, 'descartado'],
    ],
  );
});
