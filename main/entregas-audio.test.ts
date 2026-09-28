import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearEntregasAudio } from './entregas-audio.js';
import {
  MAX_ESPERA_ANUNCIO_MS,
  MAX_HISTORIAL_ANUNCIOS,
  ultimasEntregas,
} from '../shared/politica-anuncios.js';
import { crearStore } from './store.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('dos llamadas del mismo número conservan IDs y acuses independientes, aun fuera de orden', () => {
  const entregas = crearEntregasAudio(() => {});
  entregas.registrar({ id: 1, n: 42 });
  entregas.registrar({ id: 2, n: 42 });
  entregas.confirmar(2, 42, 'reproduciendo');
  entregas.confirmar(1, 42, 'reproducido');
  assert.deepEqual(
    entregas.obtener().map((e) => [e.id, e.estado]),
    [
      [1, 'reproducido'],
      [2, 'reproduciendo'],
    ],
  );
  assert.equal(ultimasEntregas(entregas.obtener())[0].id, 2);
  entregas.confirmar(2, 43, 'fallo');
  assert.equal(entregas.obtener()[1].estado, 'reproduciendo');
  entregas.confirmar(2, 42, 'reproducido');
  entregas.confirmar(1, 42, 'fallo');
  assert.ok(entregas.obtener().every((e) => e.estado === 'reproducido'));
});

test('saturación rechaza antes de guardar y no consume un ID ni altera el turno', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'comal-saturacion-'));
  const ruta = join(raiz, 'estado.json');
  const entregas = crearEntregasAudio(() => {});
  const store = crearStore({ ruta, antesDeAnunciar: entregas.comprobarCapacidad });
  store.suscribir((s, a) => {
    entregas.sincronizar(s);
    if (a) entregas.registrar(a);
  });
  try {
    for (let i = 0; i < 6; i++) store.despachar({ tipo: 'LLAMAR', entrada: '42' });
    const archivo = readFileSync(ruta, 'utf8');
    const estado = store.obtener();
    assert.throws(
      () => store.despachar({ tipo: 'LLAMAR', entrada: '43' }),
      /cola de audio está llena/,
    );
    assert.deepEqual(store.obtener(), estado);
    assert.equal(readFileSync(ruta, 'utf8'), archivo);
    entregas.confirmar(1, 42, 'reproducido');
    assert.equal(store.despachar({ tipo: 'LLAMAR', entrada: '43' }).anuncio?.id, 7);
  } finally {
    store.cerrar();
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('caducidad, retiro y falta de acuses liberan capacidad sin aceptar acuses tardíos', () => {
  let ahora = 0;
  const entregas = crearEntregasAudio(
    () => {},
    () => ahora,
  );
  entregas.registrar({ id: 1, n: 42 });
  entregas.registrar({ id: 2, n: 43 });
  entregas.confirmar(1, 42, 'reproduciendo');
  entregas.sincronizar({ actual: 42, llamados: [], puedeDeshacer: false });
  assert.equal(entregas.obtener()[1].estado, 'descartado');
  ahora = MAX_ESPERA_ANUNCIO_MS;
  entregas.vencer();
  assert.ok(entregas.obtener().every((e) => e.estado === 'descartado'));
  entregas.confirmar(1, 42, 'reproducido');
  assert.equal(entregas.obtener()[0].estado, 'descartado');
  entregas.comprobarCapacidad();
});

test('el historial es acotado, sin borrar entregas activas', () => {
  const entregas = crearEntregasAudio(() => {});
  entregas.registrar({ id: 1, n: 42 });
  for (let id = 2; id < 150; id++) {
    entregas.registrar({ id, n: 43 });
    entregas.confirmar(id, 43, 'reproducido');
  }
  assert.equal(entregas.obtener().length, MAX_HISTORIAL_ANUNCIOS);
  assert.equal(entregas.obtener()[0].id, 1);
});
