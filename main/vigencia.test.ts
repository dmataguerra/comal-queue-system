import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { Anuncio, Instantanea } from '../shared/contract.js';
import { guardarEstado } from './persistencia.js';
import { crearStore, type Store } from './store.js';

// Caja blanca con reloj falso: cada número sale de la TV 5 minutos después de su último anuncio.
// El store usa su hora y su temporizador reales, y mock.timers adelanta `Date` y `setTimeout`.
const MIN = 60_000;
const INICIO = new Date(2026, 8, 21, 9, 0).getTime();
const HOY = '2026-09-21';

let raiz: string;
let ruta: string;

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'turnero-vigencia-'));
  ruta = join(raiz, 'estado.json');
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: INICIO });
});

afterEach(() => {
  mock.timers.reset();
  rmSync(raiz, { recursive: true, force: true });
});

function abrir() {
  const store = crearStore({ ruta });
  const eventos: [Instantanea, Anuncio | null][] = [];
  store.suscribir((instantanea, anuncio) => eventos.push([instantanea, anuncio]));
  return { store, eventos };
}

const llamar = (store: Store, ...entradas: string[]) => {
  for (const entrada of entradas) store.despachar({ tipo: 'LLAMAR', entrada });
};

const pantalla = (store: Store) => {
  const { actual, llamados } = store.obtener();
  return actual === null ? llamados : [actual, ...llamados];
};

test('un turno sale de la TV a los 5 minutos exactos, sin anuncio, y se persiste', () => {
  const { store, eventos } = abrir();
  llamar(store, '10');

  mock.timers.tick(5 * MIN - 1);
  assert.deepEqual(pantalla(store), [10]);

  mock.timers.tick(1);
  assert.deepEqual(eventos.at(-1), [{ actual: null, llamados: [], puedeDeshacer: false }, null]);
  const guardado = JSON.parse(readFileSync(ruta, 'utf8'));
  assert.deepEqual([guardado.actual, guardado.llamados, guardado.desde], [null, [], {}]);
});

test('cada número cuenta su propio tiempo: salen del más viejo al más nuevo', () => {
  const { store } = abrir();
  llamar(store, '10');
  mock.timers.tick(MIN);
  llamar(store, '11');
  mock.timers.tick(MIN);
  llamar(store, '12');

  mock.timers.tick(3 * MIN); // minuto 5
  assert.deepEqual(pantalla(store), [12, 11]);
  assert.equal(store.obtener().puedeDeshacer, true, 'vencer un turno viejo no quita deshacer');
  mock.timers.tick(MIN); // minuto 6
  assert.deepEqual(pantalla(store), [12]);
  mock.timers.tick(MIN); // minuto 7
  assert.deepEqual(pantalla(store), []);
});

test('rellamar o repetir el anuncio reinicia los 5 minutos de ese número', () => {
  const { store } = abrir();
  llamar(store, '10', '11');
  mock.timers.tick(4 * MIN);
  llamar(store, '10'); // rellamado desde la lista (RF-06)

  mock.timers.tick(MIN); // minuto 5: vence el 11, el 10 va en su minuto 1
  assert.deepEqual(pantalla(store), [10]);
  mock.timers.tick(3 * MIN); // minuto 8
  llamar(store, '10'); // ya es el actual: solo se repite el anuncio (RN-05)

  mock.timers.tick(5 * MIN - 1);
  assert.deepEqual(pantalla(store), [10]);
  mock.timers.tick(1);
  assert.deepEqual(pantalla(store), []);
});

test('deshacer después de un vencimiento no revive el número vencido', () => {
  const { store } = abrir();
  llamar(store, '10');
  mock.timers.tick(5 * MIN - 1000);
  llamar(store, '11'); // tecleado por error un segundo antes de que venza el 10

  mock.timers.tick(1000);
  assert.deepEqual(pantalla(store), [11]);
  const { instantanea } = store.despachar({ tipo: 'DESHACER' });
  assert.deepEqual(instantanea, { actual: null, llamados: [], puedeDeshacer: false });
});

test('quitar a mano un número no altera el tiempo de los demás', () => {
  const { store } = abrir();
  llamar(store, '10');
  mock.timers.tick(MIN);
  llamar(store, '11', '12');
  store.despachar({ tipo: 'QUITAR', n: 11 });

  mock.timers.tick(4 * MIN); // minuto 5
  assert.deepEqual(pantalla(store), [12]);
  mock.timers.tick(MIN); // minuto 6
  assert.deepEqual(pantalla(store), []);
});

test('al reabrir se descuenta el tiempo que la app estuvo cerrada', () => {
  const estado = { actual: 11, llamados: [10], deshacer: null };
  guardarEstado(
    ruta,
    estado,
    HOY,
    new Map([
      [11, INICIO - MIN],
      [10, INICIO - 4 * MIN],
    ]),
  );

  const { store } = abrir();
  assert.deepEqual(pantalla(store), [11, 10]);
  mock.timers.tick(MIN); // el 10 cumple 5 minutos
  assert.deepEqual(pantalla(store), [11]);
  mock.timers.tick(3 * MIN); // el 11 cumple 5 minutos
  assert.deepEqual(pantalla(store), []);
});

test('apagado muchas horas el mismo día: al reabrir la pantalla arranca vacía', () => {
  llamar(abrir().store, '10', '2', '5', '1');

  mock.timers.setTime(new Date(2026, 8, 21, 19, 50).getTime());
  assert.deepEqual(pantalla(abrir().store), []);
  assert.equal(JSON.parse(readFileSync(ruta, 'utf8')).actual, null);
});

test('estado.json del formato anterior: cuenta desde el último guardado', () => {
  const guardadoEn = new Date(INICIO - 6 * MIN).toISOString();
  writeFileSync(ruta, JSON.stringify({ fecha: HOY, actual: 1, llamados: [5, 2], guardadoEn }));
  assert.deepEqual(pantalla(abrir().store), []);
});
