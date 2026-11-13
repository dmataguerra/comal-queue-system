import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { msUntilTime } from './config.js';
import { createStore, type Store } from './store.js';
const time = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).getTime();
const ONE_DAY = 24 * 60 * 60000;
const EMPTY = { actual: null, llamados: [], puedeDeshacer: false };
let root: string;
let filePath: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'turnero-reloj-'));
  filePath = join(root, 'estado.json');
});
afterEach(() => {
  mock.timers.reset();
  rmSync(root, { recursive: true, force: true });
});
const open = () => createStore({ filePath: filePath, expiryMs: ONE_DAY });
const callTurn = (store: Store, ...inputs: string[]) => {
  for (const input of inputs) store.dispatch({ tipo: 'LLAMAR', entrada: input });
};
test('shut down overnight: reopening after midnight starts empty', () => {
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: time(21, 23, 0) });
  callTurn(open(), '10', '2', '5', '1');
  mock.timers.setTime(time(21, 23, 59));
  assert.equal(open().getSnapshot().actual, 1, 'el mismo día, antes de vencer, siguen');
  mock.timers.setTime(time(22, 0, 0));
  assert.deepEqual(open().getSnapshot(), EMPTY);
});
test('left on all night: turns persist after midnight and the reload clears them', () => {
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: time(21, 14, 0) });
  const store = open();
  callTurn(store, '10', '2', '5', '1');
  const wait = msUntilTime('04:00');
  setTimeout(() => store.resetIfDayChanged(), wait);
  mock.timers.tick(wait - 1);
  assert.equal(store.getSnapshot().actual, 1, 'sin despachos ni recarga, la pantalla no cambia');
  mock.timers.tick(1);
  assert.deepEqual(store.getSnapshot(), EMPTY);
  const saved = JSON.parse(readFileSync(filePath, 'utf8'));
  assert.deepEqual([saved.fecha, saved.actual, saved.llamados], ['2026-09-22', null, []]);
});
