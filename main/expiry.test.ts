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
  const store = createStore({ filePath: filePath });
  const events: [Snapshot, Announcement | null][] = [];
  store.subscribe((snapshot, announcement) => events.push([snapshot, announcement]));
  return { store, eventos: events };
}
const callTurn = (store: Store, ...inputs: string[]) => {
  for (const input of inputs) store.dispatch({ tipo: 'LLAMAR', entrada: input });
};
const screen = (store: Store) => {
  const { actual: current, llamados: calledTurns } = store.getSnapshot();
  return current === null ? calledTurns : [current, ...calledTurns];
};
test('a turn leaves the TV at exactly 5 minutes, without announcement, and is persisted', () => {
  const { store, eventos: events } = open();
  callTurn(store, '10');
  mock.timers.tick(5 * MIN - 1);
  assert.deepEqual(screen(store), [10]);
  mock.timers.tick(1);
  assert.deepEqual(events.at(-1), [{ actual: null, llamados: [], puedeDeshacer: false }, null]);
  const saved = JSON.parse(readFileSync(filePath, 'utf8'));
  assert.deepEqual([saved.actual, saved.llamados, saved.desde], [null, [], {}]);
});
test('each number counts its own time: they leave from oldest to newest', () => {
  const { store } = open();
  callTurn(store, '10');
  mock.timers.tick(MIN);
  callTurn(store, '11');
  mock.timers.tick(MIN);
  callTurn(store, '12');
  mock.timers.tick(3 * MIN);
  assert.deepEqual(screen(store), [12, 11]);
  assert.equal(store.getSnapshot().puedeDeshacer, true, 'vencer un turno viejo no quita deshacer');
  mock.timers.tick(MIN);
  assert.deepEqual(screen(store), [12]);
  mock.timers.tick(MIN);
  assert.deepEqual(screen(store), []);
});
test('re-calling or repeating the announcement restarts the 5 minutes of that number', () => {
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
test('undo after an expiry does not revive the expired number', () => {
  const { store } = open();
  callTurn(store, '10');
  mock.timers.tick(5 * MIN - 1000);
  callTurn(store, '11');
  mock.timers.tick(1000);
  assert.deepEqual(screen(store), [11]);
  const { instantanea: snapshot } = store.dispatch({ tipo: 'DESHACER' });
  assert.deepEqual(snapshot, { actual: null, llamados: [], puedeDeshacer: false });
});
test('manually removing a number does not alter the time of the others', () => {
  const { store } = open();
  callTurn(store, '10');
  mock.timers.tick(MIN);
  callTurn(store, '11', '12');
  store.dispatch({ tipo: 'QUITAR', n: 11 });
  mock.timers.tick(4 * MIN);
  assert.deepEqual(screen(store), [12]);
  mock.timers.tick(MIN);
  assert.deepEqual(screen(store), []);
});
test('on reopen, the time the app was closed is deducted', () => {
  const state = { current: 11, called: [10], undo: null };
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
test('shut down for many hours the same day: on reopen the screen starts empty', () => {
  callTurn(open().store, '10', '2', '5', '1');
  mock.timers.setTime(new Date(2026, 8, 21, 19, 50).getTime());
  assert.deepEqual(screen(open().store), []);
  assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).actual, null);
});
test('estado.json in the previous format: counts from the last save', () => {
  const savedAt = new Date(START - 6 * MIN).toISOString();
  writeFileSync(
    filePath,
    JSON.stringify({ fecha: TODAY, actual: 1, llamados: [5, 2], guardadoEn: savedAt }),
  );
  assert.deepEqual(screen(open().store), []);
});
