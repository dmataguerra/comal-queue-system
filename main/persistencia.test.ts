import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ESTADO_INICIAL, llamar } from '../nucleo/turnos.js';
import { fechaLocal, guardarEstado, leerEstado } from './persistencia.js';

function carpeta() {
  const raiz = mkdtempSync(join(tmpdir(), 'turnero-persistencia-'));
  return {
    ruta: join(raiz, 'estado.json'),
    limpiar: () => rmSync(raiz, { recursive: true, force: true }),
  };
}

test('guarda y lee actual y llamados; deshacer no se persiste', () => {
  const { ruta, limpiar } = carpeta();
  try {
    const estado = llamar(llamar(ESTADO_INICIAL, '43').estado, '213298').estado;
    guardarEstado(ruta, estado, '2026-09-11');
    assert.equal(existsSync(`${ruta}.tmp`), false);
    const guardado = JSON.parse(readFileSync(ruta, 'utf8'));
    assert.deepEqual(
      [guardado.fecha, guardado.actual, guardado.llamados],
      ['2026-09-11', 98, [43]],
    );
    assert.equal('deshacer' in guardado, false);
    assert.deepEqual(leerEstado(ruta, '2026-09-11').estado, {
      actual: 98,
      llamados: [43],
      deshacer: null,
    });
  } finally {
    limpiar();
  }
});

test('guarda y lee la hora del último anuncio de cada número en pantalla', () => {
  const { ruta, limpiar } = carpeta();
  try {
    const estado = llamar(llamar(ESTADO_INICIAL, '43').estado, '98').estado;
    const desde = new Map([
      [98, Date.parse('2026-09-11T15:02:00.000Z')],
      [43, Date.parse('2026-09-11T15:00:00.000Z')],
    ]);
    guardarEstado(ruta, estado, '2026-09-11', desde);
    assert.deepEqual(JSON.parse(readFileSync(ruta, 'utf8')).desde, {
      98: '2026-09-11T15:02:00.000Z',
      43: '2026-09-11T15:00:00.000Z',
    });
    assert.deepEqual(leerEstado(ruta, '2026-09-11').desde, desde);
  } finally {
    limpiar();
  }
});

test('formato anterior sin `desde`: los números cuentan desde el último guardado', () => {
  const { ruta, limpiar } = carpeta();
  try {
    writeFileSync(
      ruta,
      '{"fecha":"2026-09-11","actual":1,"llamados":[5],"guardadoEn":"2026-09-11T20:50:49.196Z"}',
    );
    const guardadoEn = Date.parse('2026-09-11T20:50:49.196Z');
    assert.deepEqual(
      leerEstado(ruta, '2026-09-11').desde,
      new Map([
        [1, guardadoEn],
        [5, guardadoEn],
      ]),
    );
  } finally {
    limpiar();
  }
});

test('reinicio diario: un estado de otro día arranca vacío (CU-05 paso 4)', () => {
  const { ruta, limpiar } = carpeta();
  try {
    guardarEstado(ruta, llamar(ESTADO_INICIAL, '12').estado, '2026-09-10');
    assert.equal(leerEstado(ruta, '2026-09-11').estado, ESTADO_INICIAL);
  } finally {
    limpiar();
  }
});

test('archivo ausente, dañado o con forma inválida: arranca vacío y lo registra', () => {
  const { ruta, limpiar } = carpeta();
  const registro: string[] = [];
  try {
    assert.equal(leerEstado(ruta, '2026-09-11').estado, ESTADO_INICIAL);
    for (const contenido of [
      '{"fecha":"2026-09-11","actual":98,',
      '{"fecha":"2026-09-11","actual":100,"llamados":[]}',
      '{"fecha":"2026-09-11","actual":5,"llamados":[5]}',
      '{"fecha":"2026-09-11","actual":5,"llamados":[1,2,3,4,6,7]}',
      '{"fecha":"2026-09-11","actual":5,"llamados":[],"desde":["2026-09-11T15:00:00Z"]}',
    ]) {
      writeFileSync(ruta, contenido);
      assert.equal(leerEstado(ruta, '2026-09-11', (m) => registro.push(m)).estado, ESTADO_INICIAL);
    }
    assert.equal(registro.length, 5);
  } finally {
    limpiar();
  }
});

test('reescribir sobre un estado existente lo reemplaza completo', () => {
  const { ruta, limpiar } = carpeta();
  try {
    guardarEstado(ruta, llamar(ESTADO_INICIAL, '01').estado, '2026-09-11');
    guardarEstado(ruta, ESTADO_INICIAL, '2026-09-11');
    assert.deepEqual(leerEstado(ruta, '2026-09-11').estado, {
      actual: null,
      llamados: [],
      deshacer: null,
    });
  } finally {
    limpiar();
  }
});

test('la fecha de la jornada es la local, no la UTC', () => {
  // 23:30 local sigue siendo el mismo día aunque en UTC ya sea el siguiente.
  assert.equal(fechaLocal(new Date(2026, 8, 11, 23, 30)), '2026-09-11');
  assert.equal(fechaLocal(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
});
