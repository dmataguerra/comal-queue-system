import assert from 'node:assert/strict';
import { messageLogger } from '../shared/logging.js';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { INITIAL_STATE, callTurn } from '../core/turns.js';
import { localDate, saveState, readState } from './persistence.js';
function folder() {
  const root = mkdtempSync(join(tmpdir(), 'turnero-persistencia-'));
  return {
    ruta: join(root, 'estado.json'),
    limpiar: () => rmSync(root, { recursive: true, force: true }),
  };
}
test('saves and reads current and calls; undo is not persisted', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    const state = callTurn(callTurn(INITIAL_STATE, '43').state, '213298').state;
    saveState(filePath, state, '2026-09-11');
    assert.equal(existsSync(`${filePath}.tmp`), false);
    const saved = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.deepEqual([saved.fecha, saved.actual, saved.llamados], ['2026-09-11', 98, [43]]);
    assert.equal('deshacer' in saved, false);
    assert.deepEqual(readState(filePath, '2026-09-11').state, {
      current: 98,
      called: [43],
      undo: null,
    });
  } finally {
    clear();
  }
});
test('saves and reads the last announcement time of each number on screen', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    const state = callTurn(callTurn(INITIAL_STATE, '43').state, '98').state;
    const from = new Map([
      [98, Date.parse('2026-09-11T15:02:00.000Z')],
      [43, Date.parse('2026-09-11T15:00:00.000Z')],
    ]);
    saveState(filePath, state, '2026-09-11', from);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')).desde, {
      98: '2026-09-11T15:02:00.000Z',
      43: '2026-09-11T15:00:00.000Z',
    });
    assert.deepEqual(readState(filePath, '2026-09-11').calledSince, from);
  } finally {
    clear();
  }
});
test('previous format without `desde`: numbers count from the last save', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    writeFileSync(
      filePath,
      '{"fecha":"2026-09-11","actual":1,"llamados":[5],"guardadoEn":"2026-09-11T20:50:49.196Z"}',
    );
    const savedAt = Date.parse('2026-09-11T20:50:49.196Z');
    assert.deepEqual(
      readState(filePath, '2026-09-11').calledSince,
      new Map([
        [1, savedAt],
        [5, savedAt],
      ]),
    );
  } finally {
    clear();
  }
});
test('daily reset: a state from another day starts empty (CU-05 step 4)', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    saveState(filePath, callTurn(INITIAL_STATE, '12').state, '2026-09-10');
    assert.equal(readState(filePath, '2026-09-11').state, INITIAL_STATE);
  } finally {
    clear();
  }
});
test('missing, corrupt or malformed file: starts empty and logs it', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  const logs: string[] = [];
  try {
    assert.equal(readState(filePath, '2026-09-11').state, INITIAL_STATE);
    for (const content of [
      '{"fecha":"2026-09-11","actual":98,',
      '{"fecha":"2026-09-11","actual":100,"llamados":[]}',
      '{"fecha":"2026-09-11","actual":5,"llamados":[5]}',
      '{"fecha":"2026-09-11","actual":5,"llamados":[1,2,3,4,6,7]}',
      '{"fecha":"2026-09-11","actual":5,"llamados":[],"desde":["2026-09-11T15:00:00Z"]}',
    ]) {
      writeFileSync(filePath, content);
      assert.equal(
        readState(
          filePath,
          '2026-09-11',
          messageLogger((m) => logs.push(m)),
        ).state,
        INITIAL_STATE,
      );
    }
    assert.equal(logs.length, 5);
  } finally {
    clear();
  }
});
test('rewriting over an existing state replaces it completely', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    saveState(filePath, callTurn(INITIAL_STATE, '01').state, '2026-09-11');
    saveState(filePath, INITIAL_STATE, '2026-09-11');
    assert.deepEqual(readState(filePath, '2026-09-11').state, {
      current: null,
      called: [],
      undo: null,
    });
  } finally {
    clear();
  }
});
test('the date of the day is local, not UTC', () => {
  assert.equal(localDate(new Date(2026, 8, 11, 23, 30)), '2026-09-11');
  assert.equal(localDate(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
});
test('corrupt JSON and invalid timestamps keep distinct diagnostic copies', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  const messages: string[] = [];
  try {
    writeFileSync(filePath, '{');
    readState(
      filePath,
      '2026-09-11',
      messageLogger((m) => messages.push(m)),
    );
    writeFileSync(filePath, '{"fecha":"2026-09-11","actual":1,"llamados":[],"guardadoEn":"ayer"}');
    readState(
      filePath,
      '2026-09-11',
      messageLogger((m) => messages.push(m)),
    );
    const copies = readdirSync(join(filePath, '..')).filter((n) =>
      n.startsWith('estado.json.corrupto-'),
    );
    assert.equal(copies.length, 2);
    assert.match(messages[0], /JSON válido/);
    assert.match(messages[1], /timestamps inválidos/);
  } finally {
    clear();
  }
});
test('an I/O error reading the state is not confused with a missing file', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  const messages: string[] = [];
  try {
    mkdirSync(filePath);
    assert.throws(() =>
      readState(
        filePath,
        '2026-09-11',
        messageLogger((m) => messages.push(m)),
      ),
    );
    assert.match(messages[0], /No se pudo leer estado.json/);
  } finally {
    clear();
  }
});
