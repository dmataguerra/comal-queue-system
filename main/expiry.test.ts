import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { Announcement, Snapshot } from '../shared/contract.js';
import { saveState } from './persistence.js';
import { createStore, type Store } from './store.js';
const MIN = 60000;
const START = new Date(2026, 8, 21, 9, 0).getTime();
const TODAY = '2026-09-21';
let root: string;
let filePath: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'turnero-vigencia-'));
  filePath = join(root, 'estado.json');
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: START });
});
afterEach(() => {
  mock.timers.reset();
  rmSync(root, { recursive: true, force: true });
});
function open() {
  const store = createStore({ ruta: filePath });
  const events: [Snapshot, Announcement | null][] = [];
  store.suscribir((snapshot, announcement) => events.push([snapshot, announcement]));
  return { store, eventos: events };
}
const callTurn = (store: Store, ...inputs: string[]) => {
  for (const input of inputs) store.despachar({ tipo: 'LLAMAR', entrada: input });
};
const screen = (store: Store) => {
  const { actual: current, llamados: calledTurns } = store.obtener();
  return current === null ? calledTurns : [current, ...calledTurns];
};
test('un turno sale de la TV a los 5 minutos exactos, sin anuncio, y se persiste', () => {
  const { store, eventos: events } = open();
  callTurn(store, '10');
  mock.timers.tick(5 * MIN - 1);
  assert.deepEqual(screen(store), [10]);
  mock.timers.tick(1);
  assert.deepEqual(events.at(-1), [{ actual: null, llamados: [], puedeDeshacer: false }, null]);
  const saved = JSON.parse(readFileSync(filePath, 'utf8'));
  assert.deepEqual([saved.actual, saved.llamados, saved.desde], [null, [], {}]);
});
test('cada número cuenta su propio tiempo: salen del más viejo al más nuevo', () => {
  const { store } = open();
  callTurn(store, '10');
  mock.timers.tick(MIN);
  callTurn(store, '11');
  mock.timers.tick(MIN);
  callTurn(store, '12');
  mock.timers.tick(3 * MIN);
  assert.deepEqual(screen(store), [12, 11]);
  assert.equal(store.obtener().puedeDeshacer, true, 'vencer un turno viejo no quita deshacer');
  mock.timers.tick(MIN);
  assert.deepEqual(screen(store), [12]);
  mock.timers.tick(MIN);
  assert.deepEqual(screen(store), []);
});
test('rellamar o repetir el anuncio reinicia los 5 minutos de ese número', () => {
  const { store } = open();
  callTurn(store, '10', '11');
  mock.timers.tick(4 * MIN);
  callTurn(store, '10');
  mock.timers.tick(MIN);
  assert.deepEqual(screen(store), [10]);
  mock.timers.tick(3 * MIN);
  callTurn(store, '10');
  mock.timers.tick(5 * MIN - 1);
  assert.deepEqual(screen(store), [10]);
  mock.timers.tick(1);
  assert.deepEqual(screen(store), []);
});
test('deshacer después de un vencimiento no revive el número vencido', () => {
  const { store } = open();
  callTurn(store, '10');
  mock.timers.tick(5 * MIN - 1000);
  callTurn(store, '11');
  mock.timers.tick(1000);
  assert.deepEqual(screen(store), [11]);
  const { instantanea: snapshot } = store.despachar({ tipo: 'DESHACER' });
  assert.deepEqual(snapshot, { actual: null, llamados: [], puedeDeshacer: false });
});
test('quitar a mano un número no altera el tiempo de los demás', () => {
  const { store } = open();
  callTurn(store, '10');
  mock.timers.tick(MIN);
  callTurn(store, '11', '12');
  store.despachar({ tipo: 'QUITAR', n: 11 });
  mock.timers.tick(4 * MIN);
  assert.deepEqual(screen(store), [12]);
  mock.timers.tick(MIN);
  assert.deepEqual(screen(store), []);
});
test('al reabrir se descuenta el tiempo que la app estuvo cerrada', () => {
  const state = { actual: 11, llamados: [10], deshacer: null };
  saveState(
    filePath,
    state,
    TODAY,
    new Map([
      [11, START - MIN],
      [10, START - 4 * MIN],
    ]),
  );
  const { store } = open();
  assert.deepEqual(screen(store), [11, 10]);
  mock.timers.tick(MIN);
  assert.deepEqual(screen(store), [11]);
  mock.timers.tick(3 * MIN);
  assert.deepEqual(screen(store), []);
});
test('apagado muchas horas el mismo día: al reabrir la pantalla arranca vacía', () => {
  callTurn(open().store, '10', '2', '5', '1');
  mock.timers.setTime(new Date(2026, 8, 21, 19, 50).getTime());
  assert.deepEqual(screen(open().store), []);
  assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).actual, null);
});
test('estado.json del formato anterior: cuenta desde el último guardado', () => {
  const savedAt = new Date(START - 6 * MIN).toISOString();
  writeFileSync(
    filePath,
    JSON.stringify({ fecha: TODAY, actual: 1, llamados: [5, 2], guardadoEn: savedAt }),
  );
  assert.deepEqual(screen(open().store), []);
});
