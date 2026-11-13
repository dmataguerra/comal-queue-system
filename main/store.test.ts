import assert from 'node:assert/strict';
import { messageLogger } from '../shared/logging.js';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Announcement, Snapshot } from '../shared/contract.js';
import { saveState } from './persistence.js';
import { createStore } from './store.js';
function fixture(date = { valor: '2026-09-11' }) {
  const root = mkdtempSync(join(tmpdir(), 'turnero-store-'));
  const filePath = join(root, 'estado.json');
  const events: [Snapshot, Announcement | null][] = [];
  const store = createStore({ filePath: filePath, today: () => date.valor });
  store.subscribe((snapshot, announcement) => events.push([snapshot, announcement]));
  return {
    ruta: filePath,
    fecha: date,
    store,
    eventos: events,
    limpiar: () => rmSync(root, { recursive: true, force: true }),
  };
}
test('llamar difunde el estado con un anuncio de id creciente, también al repetir el actual', () => {
  const f = fixture();
  try {
    const first = f.store.dispatch({ tipo: 'LLAMAR', entrada: '213298' });
    assert.deepEqual(first, {
      instantanea: { actual: 98, llamados: [], puedeDeshacer: true },
      efecto: 'ANUNCIAR',
      anuncio: { id: 1, n: 98 },
    });
    const repeated = f.store.dispatch({ tipo: 'LLAMAR', entrada: '98' });
    assert.deepEqual(repeated.anuncio, { id: 2, n: 98 });
    assert.equal(f.eventos.length, 2);
    assert.deepEqual(f.eventos[1][1], { id: 2, n: 98 });
  } finally {
    f.limpiar();
  }
});
test('captura inválida: se responde solo al operador, sin difundir ni escribir disco', () => {
  const f = fixture();
  try {
    const result = f.store.dispatch({ tipo: 'LLAMAR', entrada: 'abc' });
    assert.equal(result.efecto, 'CAPTURA_INVALIDA');
    assert.equal(f.eventos.length, 0);
    assert.equal(existsSync(f.ruta), false);
  } finally {
    f.limpiar();
  }
});
test('deshacer difunde sin anuncio y persiste; sin nada que deshacer no difunde', () => {
  const f = fixture();
  try {
    f.store.dispatch({ tipo: 'LLAMAR', entrada: '43' });
    f.store.dispatch({ tipo: 'LLAMAR', entrada: '81' });
    const undone = f.store.dispatch({ tipo: 'DESHACER' });
    assert.deepEqual(undone, {
      instantanea: { actual: 43, llamados: [], puedeDeshacer: false },
      efecto: null,
      anuncio: null,
    });
    assert.deepEqual(f.eventos.at(-1), [{ actual: 43, llamados: [], puedeDeshacer: false }, null]);
    assert.equal(JSON.parse(readFileSync(f.ruta, 'utf8')).actual, 43);
    const count = f.eventos.length;
    f.store.dispatch({ tipo: 'DESHACER' });
    assert.equal(f.eventos.length, count);
  } finally {
    f.limpiar();
  }
});
test('quitar difunde sin anuncio y persiste; un número fuera de pantalla no difunde', () => {
  const f = fixture();
  try {
    for (const input of ['10', '11', '12']) f.store.dispatch({ tipo: 'LLAMAR', entrada: input });
    const removed = f.store.dispatch({ tipo: 'QUITAR', n: 11 });
    assert.deepEqual(removed, {
      instantanea: { actual: 12, llamados: [10], puedeDeshacer: false },
      efecto: null,
      anuncio: null,
    });
    assert.deepEqual(f.eventos.at(-1), [
      { actual: 12, llamados: [10], puedeDeshacer: false },
      null,
    ]);
    assert.deepEqual(JSON.parse(readFileSync(f.ruta, 'utf8')).llamados, [10]);
    const count = f.eventos.length;
    f.store.dispatch({ tipo: 'QUITAR', n: 44 });
    assert.equal(f.eventos.length, count);
  } finally {
    f.limpiar();
  }
});
test('el estado sobrevive a reabrir el store el mismo día, pero sin deshacer', () => {
  const f = fixture();
  try {
    f.store.dispatch({ tipo: 'LLAMAR', entrada: '43' });
    f.store.dispatch({ tipo: 'LLAMAR', entrada: '51' });
    const reopened = createStore({ filePath: f.ruta, today: () => f.fecha.valor });
    assert.deepEqual(reopened.getSnapshot(), { actual: 51, llamados: [43], puedeDeshacer: false });
  } finally {
    f.limpiar();
  }
});
test('cambio de día sin reiniciar la app: el siguiente despacho arranca de cero', () => {
  const f = fixture();
  try {
    f.store.dispatch({ tipo: 'LLAMAR', entrada: '43' });
    f.fecha.valor = '2026-09-12';
    const result = f.store.dispatch({ tipo: 'LLAMAR', entrada: '07' });
    assert.deepEqual(result.instantanea, { actual: 7, llamados: [], puedeDeshacer: true });
    assert.equal(f.store.resetIfDayChanged(), false);
    f.fecha.valor = '2026-09-13';
    assert.equal(f.store.resetIfDayChanged(), true);
    assert.deepEqual(f.eventos.at(-1), [
      { actual: null, llamados: [], puedeDeshacer: false },
      null,
    ]);
  } finally {
    f.limpiar();
  }
});
test('un fallo persistente rechaza llamadas sin anunciar ni alterar estado y permite reintentar', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-salud-'));
  const messages: string[] = [];
  let failure = true;
  const base = createStore({
    filePath: join(root, 'estado.json'),
    today: () => '2026-09-11',
    now: () => Date.parse('2026-09-11T15:00:00.000Z'),
    logger: messageLogger((message) => messages.push(message)),
    save: (...args) => {
      if (failure) throw new Error('disco ocupado');
      saveState(...args);
    },
  });
  try {
    const announcements: Announcement[] = [];
    base.subscribe((_snapshot, announcement) => {
      if (announcement) announcements.push(announcement);
    });
    assert.throws(() => base.dispatch({ tipo: 'LLAMAR', entrada: '12' }), /No se pudo guardar/);
    assert.throws(() => base.dispatch({ tipo: 'LLAMAR', entrada: '13' }), /No se pudo guardar/);
    assert.equal(base.getSnapshot().actual, null);
    assert.deepEqual(announcements, []);
    assert.equal(existsSync(join(root, 'estado.json')), false);
    assert.equal(base.getSnapshot().persistencia?.estado, 'error');
    assert.equal(base.persistenceHealth().primerFallo, '2026-09-11T15:00:00.000Z');
    assert.equal(messages.filter((m) => m.includes('No se pudo guardar')).length, 1);
    failure = false;
    base.dispatch({ tipo: 'LLAMAR', entrada: '14' });
    assert.equal(base.getSnapshot().actual, 14);
    assert.deepEqual(announcements, [{ id: 1, n: 14 }]);
    assert.equal(base.getSnapshot().persistencia, undefined);
    assert.equal(base.persistenceHealth().restauradaEn, '2026-09-11T15:00:00.000Z');
    assert.equal(messages.filter((m) => m.includes('restaurada')).length, 1);
  } finally {
    base.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test('un fallo al guardar el cambio de jornada conserva la jornada anterior', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-cambio-fallido-'));
  const filePath = join(root, 'estado.json');
  let date = '2026-09-11';
  let failure = false;
  const store = createStore({
    filePath: filePath,
    today: () => date,
    save: (...args) => {
      if (failure) throw new Error('sin disco');
      saveState(...args);
    },
  });
  try {
    store.dispatch({ tipo: 'LLAMAR', entrada: '42' });
    date = '2026-09-12';
    failure = true;
    assert.throws(() => store.resetIfDayChanged(), /No se pudo guardar/);
    assert.equal(store.getSnapshot().actual, 42);
    assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).actual, 42);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test('el operador recibe aviso si el estado inicial estaba corrupto', () => {
  const root = mkdtempSync(join(tmpdir(), 'turnero-recuperacion-'));
  try {
    const filePath = join(root, 'estado.json');
    writeFileSync(filePath, '{');
    const store = createStore({ filePath: filePath, today: () => '2026-09-11' });
    assert.match(store.getSnapshot().advertenciaRecuperacion ?? '', /jornada empezó vacía/);
    store.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
