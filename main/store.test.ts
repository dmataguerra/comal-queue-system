import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Anuncio, Instantanea } from '../shared/contract.js';
import { guardarEstado } from './persistencia.js';
import { crearStore } from './store.js';

function fixture(fecha = { valor: '2026-09-11' }) {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-store-'));
  const ruta = join(raiz, 'estado.json');
  const eventos: [Instantanea, Anuncio | null][] = [];
  const store = crearStore({ ruta, hoy: () => fecha.valor });
  store.suscribir((instantanea, anuncio) => eventos.push([instantanea, anuncio]));
  return {
    ruta,
    fecha,
    store,
    eventos,
    limpiar: () => rmSync(raiz, { recursive: true, force: true }),
  };
}

test('llamar difunde el estado con un anuncio de id creciente, también al repetir el actual', () => {
  const f = fixture();
  try {
    const primero = f.store.despachar({ tipo: 'LLAMAR', entrada: '213298' });
    assert.deepEqual(primero, {
      instantanea: { actual: 98, llamados: [], puedeDeshacer: true },
      efecto: 'ANUNCIAR',
      anuncio: { id: 1, n: 98 },
    });
    const repetido = f.store.despachar({ tipo: 'LLAMAR', entrada: '98' });
    assert.deepEqual(repetido.anuncio, { id: 2, n: 98 });
    assert.equal(f.eventos.length, 2);
    assert.deepEqual(f.eventos[1][1], { id: 2, n: 98 });
  } finally {
    f.limpiar();
  }
});

test('captura inválida: se responde solo al operador, sin difundir ni escribir disco', () => {
  const f = fixture();
  try {
    const resultado = f.store.despachar({ tipo: 'LLAMAR', entrada: 'abc' });
    assert.equal(resultado.efecto, 'CAPTURA_INVALIDA');
    assert.equal(f.eventos.length, 0);
    assert.equal(existsSync(f.ruta), false);
  } finally {
    f.limpiar();
  }
});

test('deshacer difunde sin anuncio y persiste; sin nada que deshacer no difunde', () => {
  const f = fixture();
  try {
    f.store.despachar({ tipo: 'LLAMAR', entrada: '43' });
    f.store.despachar({ tipo: 'LLAMAR', entrada: '81' });
    const deshecho = f.store.despachar({ tipo: 'DESHACER' });
    assert.deepEqual(deshecho, {
      instantanea: { actual: 43, llamados: [], puedeDeshacer: false },
      efecto: null,
      anuncio: null,
    });
    assert.deepEqual(f.eventos.at(-1), [{ actual: 43, llamados: [], puedeDeshacer: false }, null]);
    assert.equal(JSON.parse(readFileSync(f.ruta, 'utf8')).actual, 43);
    const cuenta = f.eventos.length;
    f.store.despachar({ tipo: 'DESHACER' });
    assert.equal(f.eventos.length, cuenta);
  } finally {
    f.limpiar();
  }
});

test('quitar difunde sin anuncio y persiste; un número fuera de pantalla no difunde', () => {
  const f = fixture();
  try {
    for (const entrada of ['10', '11', '12']) f.store.despachar({ tipo: 'LLAMAR', entrada });
    const quitado = f.store.despachar({ tipo: 'QUITAR', n: 11 });
    assert.deepEqual(quitado, {
      instantanea: { actual: 12, llamados: [10], puedeDeshacer: false },
      efecto: null,
      anuncio: null,
    });
    assert.deepEqual(f.eventos.at(-1), [
      { actual: 12, llamados: [10], puedeDeshacer: false },
      null,
    ]);
    assert.deepEqual(JSON.parse(readFileSync(f.ruta, 'utf8')).llamados, [10]);
    const cuenta = f.eventos.length;
    f.store.despachar({ tipo: 'QUITAR', n: 44 });
    assert.equal(f.eventos.length, cuenta);
  } finally {
    f.limpiar();
  }
});

test('el estado sobrevive a reabrir el store el mismo día, pero sin deshacer', () => {
  const f = fixture();
  try {
    f.store.despachar({ tipo: 'LLAMAR', entrada: '43' });
    f.store.despachar({ tipo: 'LLAMAR', entrada: '51' });
    const reabierto = crearStore({ ruta: f.ruta, hoy: () => f.fecha.valor });
    assert.deepEqual(reabierto.obtener(), { actual: 51, llamados: [43], puedeDeshacer: false });
  } finally {
    f.limpiar();
  }
});

test('cambio de día sin reiniciar la app: el siguiente despacho arranca de cero', () => {
  const f = fixture();
  try {
    f.store.despachar({ tipo: 'LLAMAR', entrada: '43' });
    f.fecha.valor = '2026-09-12';
    const resultado = f.store.despachar({ tipo: 'LLAMAR', entrada: '07' });
    assert.deepEqual(resultado.instantanea, { actual: 7, llamados: [], puedeDeshacer: true });
    assert.equal(f.store.reiniciarSiCambioDia(), false);
    f.fecha.valor = '2026-09-13';
    assert.equal(f.store.reiniciarSiCambioDia(), true);
    assert.deepEqual(f.eventos.at(-1), [
      { actual: null, llamados: [], puedeDeshacer: false },
      null,
    ]);
  } finally {
    f.limpiar();
  }
});

test('un fallo persistente rechaza llamadas sin anunciar ni alterar estado y permite reintentar', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-salud-'));
  const mensajes: string[] = [];
  let falla = true;
  const base = crearStore({
    ruta: join(raiz, 'estado.json'),
    hoy: () => '2026-09-11',
    ahora: () => Date.parse('2026-09-11T15:00:00.000Z'),
    registrar: (mensaje) => mensajes.push(mensaje),
    guardar: (...args) => {
      if (falla) throw new Error('disco ocupado');
      guardarEstado(...args);
    },
  });
  try {
    const anuncios: Anuncio[] = [];
    base.suscribir((_instantanea, anuncio) => {
      if (anuncio) anuncios.push(anuncio);
    });
    assert.throws(() => base.despachar({ tipo: 'LLAMAR', entrada: '12' }), /No se pudo guardar/);
    assert.throws(() => base.despachar({ tipo: 'LLAMAR', entrada: '13' }), /No se pudo guardar/);
    assert.equal(base.obtener().actual, null);
    assert.deepEqual(anuncios, []);
    assert.equal(existsSync(join(raiz, 'estado.json')), false);
    assert.equal(base.obtener().persistencia?.estado, 'error');
    assert.equal(base.saludPersistencia().primerFallo, '2026-09-11T15:00:00.000Z');
    assert.equal(mensajes.filter((m) => m.includes('No se pudo guardar')).length, 1);
    falla = false;
    base.despachar({ tipo: 'LLAMAR', entrada: '14' });
    assert.equal(base.obtener().actual, 14);
    assert.deepEqual(anuncios, [{ id: 1, n: 14 }]);
    assert.equal(base.obtener().persistencia, undefined);
    assert.equal(base.saludPersistencia().restauradaEn, '2026-09-11T15:00:00.000Z');
    assert.equal(mensajes.filter((m) => m.includes('restaurada')).length, 1);
  } finally {
    base.cerrar();
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('un fallo al guardar el cambio de jornada conserva la jornada anterior', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-cambio-fallido-'));
  const ruta = join(raiz, 'estado.json');
  let fecha = '2026-09-11';
  let falla = false;
  const store = crearStore({
    ruta,
    hoy: () => fecha,
    guardar: (...args) => {
      if (falla) throw new Error('sin disco');
      guardarEstado(...args);
    },
  });
  try {
    store.despachar({ tipo: 'LLAMAR', entrada: '42' });
    fecha = '2026-09-12';
    falla = true;
    assert.throws(() => store.reiniciarSiCambioDia(), /No se pudo guardar/);
    assert.equal(store.obtener().actual, 42);
    assert.equal(JSON.parse(readFileSync(ruta, 'utf8')).actual, 42);
  } finally {
    store.cerrar();
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('el operador recibe aviso si el estado inicial estaba corrupto', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-recuperacion-'));
  try {
    const ruta = join(raiz, 'estado.json');
    writeFileSync(ruta, '{');
    const store = crearStore({ ruta, hoy: () => '2026-09-11' });
    assert.match(store.obtener().advertenciaRecuperacion ?? '', /jornada empezó vacía/);
    store.cerrar();
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
