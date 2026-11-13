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
test('guarda y lee actual y llamados; deshacer no se persiste', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    const state = callTurn(callTurn(INITIAL_STATE, '43').estado, '213298').estado;
    saveState(filePath, state, '2026-09-11');
    assert.equal(existsSync(`${filePath}.tmp`), false);
    const saved = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.deepEqual([saved.fecha, saved.actual, saved.llamados], ['2026-09-11', 98, [43]]);
    assert.equal('deshacer' in saved, false);
    assert.deepEqual(readState(filePath, '2026-09-11').estado, {
      actual: 98,
      llamados: [43],
      deshacer: null,
    });
  } finally {
    clear();
  }
});
test('guarda y lee la hora del último anuncio de cada número en pantalla', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    const state = callTurn(callTurn(INITIAL_STATE, '43').estado, '98').estado;
    const from = new Map([
      [98, Date.parse('2026-09-11T15:02:00.000Z')],
      [43, Date.parse('2026-09-11T15:00:00.000Z')],
    ]);
    saveState(filePath, state, '2026-09-11', from);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')).desde, {
      98: '2026-09-11T15:02:00.000Z',
      43: '2026-09-11T15:00:00.000Z',
    });
    assert.deepEqual(readState(filePath, '2026-09-11').desde, from);
  } finally {
    clear();
  }
});
test('formato anterior sin `desde`: los números cuentan desde el último guardado', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    writeFileSync(
      filePath,
      '{"fecha":"2026-09-11","actual":1,"llamados":[5],"guardadoEn":"2026-09-11T20:50:49.196Z"}',
    );
    const savedAt = Date.parse('2026-09-11T20:50:49.196Z');
    assert.deepEqual(
      readState(filePath, '2026-09-11').desde,
      new Map([
        [1, savedAt],
        [5, savedAt],
      ]),
    );
  } finally {
    clear();
  }
});
test('reinicio diario: un estado de otro día arranca vacío (CU-05 paso 4)', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    saveState(filePath, callTurn(INITIAL_STATE, '12').estado, '2026-09-10');
    assert.equal(readState(filePath, '2026-09-11').estado, INITIAL_STATE);
  } finally {
    clear();
  }
});
test('archivo ausente, dañado o con forma inválida: arranca vacío y lo registra', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  const logs: string[] = [];
  try {
    assert.equal(readState(filePath, '2026-09-11').estado, INITIAL_STATE);
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
        ).estado,
        INITIAL_STATE,
      );
    }
    assert.equal(logs.length, 5);
  } finally {
    clear();
  }
});
test('reescribir sobre un estado existente lo reemplaza completo', () => {
  const { ruta: filePath, limpiar: clear } = folder();
  try {
    saveState(filePath, callTurn(INITIAL_STATE, '01').estado, '2026-09-11');
    saveState(filePath, INITIAL_STATE, '2026-09-11');
    assert.deepEqual(readState(filePath, '2026-09-11').estado, {
      actual: null,
      llamados: [],
      deshacer: null,
    });
  } finally {
    clear();
  }
});
test('la fecha de la jornada es la local, no la UTC', () => {
  assert.equal(localDate(new Date(2026, 8, 11, 23, 30)), '2026-09-11');
  assert.equal(localDate(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
});
test('JSON corrupto y timestamps inválidos conservan copias diagnósticas distintas', () => {
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
test('un error de E/S al leer el estado no se confunde con un archivo ausente', () => {
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
