import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { msHastaHora } from './config.js';
import { crearStore, type Store } from './store.js';

// Caja blanca con reloj falso: el store usa su fecha real (`fechaLocal()` sobre `new Date()`),
// sin inyectar `hoy`, y el tiempo se adelanta con mock.timers. La vigencia de 5 minutos se estira
// a un día para aislar el reinicio por fecha; la vigencia se prueba en vigencia.test.ts.
const hora = (dia: number, h: number, m = 0) => new Date(2026, 8, dia, h, m).getTime();
const UN_DIA = 24 * 60 * 60_000;
const VACIO = { actual: null, llamados: [], puedeDeshacer: false };

let raiz: string;
let ruta: string;

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'turnero-reloj-'));
  ruta = join(raiz, 'estado.json');
});

afterEach(() => {
  mock.timers.reset();
  rmSync(raiz, { recursive: true, force: true });
});

const abrir = () => crearStore({ ruta, vigenciaMs: UN_DIA });
const llamar = (store: Store, ...entradas: string[]) => {
  for (const entrada of entradas) store.despachar({ tipo: 'LLAMAR', entrada });
};

test('apagado de un día para otro: al reabrir después de medianoche arranca vacío', () => {
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: hora(21, 23, 0) });
  llamar(abrir(), '10', '2', '5', '1');

  mock.timers.setTime(hora(21, 23, 59));
  assert.equal(abrir().obtener().actual, 1, 'el mismo día, antes de vencer, siguen');
  mock.timers.setTime(hora(22, 0, 0));
  assert.deepEqual(abrir().obtener(), VACIO);
});

test('encendida toda la noche: los turnos siguen tras medianoche y la recarga los limpia', () => {
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now: hora(21, 14, 0) });
  const store = abrir();
  llamar(store, '10', '2', '5', '1');

  // Mismo temporizador que `programarRecarga` en main.ts, con la recarga de fábrica.
  const espera = msHastaHora('04:00');
  setTimeout(() => store.reiniciarSiCambioDia(), espera);

  mock.timers.tick(espera - 1); // 03:59:59.999 del día siguiente
  assert.equal(store.obtener().actual, 1, 'sin despachos ni recarga, la pantalla no cambia');

  mock.timers.tick(1); // 04:00
  assert.deepEqual(store.obtener(), VACIO);
  const guardado = JSON.parse(readFileSync(ruta, 'utf8'));
  assert.deepEqual([guardado.fecha, guardado.actual, guardado.llamados], ['2026-09-22', null, []]);
});
