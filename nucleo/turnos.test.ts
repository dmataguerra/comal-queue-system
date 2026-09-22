import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ESTADO_INICIAL, deshacer, formatear, llamar, quitar, type Estado } from './turnos.js';

/** Aplica una secuencia de capturas desde el estado inicial. */
function secuencia(...entradas: string[]): Estado {
  return entradas.reduce((estado, entrada) => llamar(estado, entrada).estado, ESTADO_INICIAL);
}

describe('llamar()', () => {
  test('número nuevo: pasa a actual, el anterior entra arriba, el 6.º saca al más viejo', () => {
    const lleno = secuencia('10', '11', '12', '13', '14', '15');
    assert.deepEqual([lleno.actual, lleno.llamados], [15, [14, 13, 12, 11, 10]]);
    const { estado, efecto } = llamar(lleno, '16');
    assert.equal(estado.actual, 16);
    assert.deepEqual(estado.llamados, [15, 14, 13, 12, 11]);
    assert.deepEqual(efecto, { tipo: 'ANUNCIAR', n: 16 });
  });

  test('número en la lista: sale de la lista y no se duplica (RF-06, RN-04)', () => {
    const { estado, efecto } = llamar(secuencia('43', '51', '38'), '43');
    assert.equal(estado.actual, 43);
    assert.deepEqual(estado.llamados, [38, 51]);
    assert.deepEqual(efecto, { tipo: 'ANUNCIAR', n: 43 });
  });

  test('número que ya es el actual: no cambia el estado, solo anuncia (RN-05)', () => {
    const previo = secuencia('43', '98');
    const { estado, efecto } = llamar(previo, '98');
    assert.equal(estado, previo);
    assert.deepEqual(efecto, { tipo: 'ANUNCIAR', n: 98 });
  });

  test('número que ya salió de la lista: se comporta como nuevo', () => {
    const previo = secuencia('10', '11', '12', '13', '14', '15', '16');
    assert.ok(!previo.llamados.includes(10));
    const { estado } = llamar(previo, '10');
    assert.equal(estado.actual, 10);
    assert.deepEqual(estado.llamados, [16, 15, 14, 13, 12]);
  });

  test('vacío, letras, 7 dígitos: CAPTURA_INVALIDA y estado intacto (CU-01 3a)', () => {
    const previo = secuencia('43');
    for (const entrada of ['', '   ', 'abc', '9a', '1234567', null, undefined, '-5', '4.5']) {
      const { estado, efecto } = llamar(previo, entrada);
      assert.equal(estado, previo);
      assert.deepEqual(efecto, { tipo: 'CAPTURA_INVALIDA', entrada });
    }
  });

  test('primer llamado de la jornada: la lista queda vacía (CU-01 4a)', () => {
    const { estado } = llamar(ESTADO_INICIAL, '07');
    assert.equal(estado.actual, 7);
    assert.deepEqual(estado.llamados, []);
  });

  test('6 dígitos: usa los dos últimos (pendiente 2)', () => {
    assert.equal(llamar(ESTADO_INICIAL, '213298').estado.actual, 98);
    assert.equal(llamar(ESTADO_INICIAL, '213200').estado.actual, 0);
    assert.equal(formatear(0), '00');
  });

  test('un dígito: se interpreta con cero a la izquierda', () => {
    const { estado } = llamar(ESTADO_INICIAL, '8');
    assert.equal(estado.actual, 8);
    assert.equal(formatear(estado.actual!), '08');
  });
});

describe('quitar()', () => {
  test('un llamado: sale de la lista y el resto no se mueve', () => {
    const previo = secuencia('10', '11', '12', '13');
    assert.deepEqual([previo.actual, previo.llamados], [13, [12, 11, 10]]);
    const { estado, efecto } = quitar(previo, 11);
    assert.equal(estado.actual, 13);
    assert.deepEqual(estado.llamados, [12, 10]);
    assert.equal(efecto, null);
  });

  test('el actual: deja de aparecer y el siguiente queda arriba, sin anunciar', () => {
    const { estado, efecto } = quitar(secuencia('10', '11', '12'), 12);
    assert.equal(estado.actual, 11);
    assert.deepEqual(estado.llamados, [10]);
    assert.equal(efecto, null);
  });

  test('el único turno de la jornada: la pantalla queda vacía', () => {
    const { estado } = quitar(secuencia('07'), 7);
    assert.equal(estado.actual, null);
    assert.deepEqual(estado.llamados, []);
  });

  test('un número que no está en pantalla: no cambia nada', () => {
    const previo = secuencia('10', '11');
    const { estado, efecto } = quitar(previo, 44);
    assert.equal(estado, previo);
    assert.equal(efecto, null);
  });

  test('corregir después de quitar no devuelve el número eliminado', () => {
    const previo = secuencia('10', '11', '12');
    const { estado } = deshacer(quitar(previo, 12).estado);
    assert.deepEqual([estado.actual, estado.llamados], [11, [10]]);
    assert.equal(estado.deshacer, null);
  });

  test('quitar todos uno por uno vacía la pantalla sin dejar huecos', () => {
    let estado = secuencia('10', '11', '12');
    for (const n of [11, 12, 10]) estado = quitar(estado, n).estado;
    assert.deepEqual([estado.actual, estado.llamados], [null, []]);
  });
});

describe('deshacer()', () => {
  test('restaura el estado previo y no anuncia', () => {
    const previo = secuencia('43', '51');
    const erroneo = llamar(previo, '81').estado;
    const { estado, efecto } = deshacer(erroneo);
    assert.deepEqual(estado, { actual: previo.actual, llamados: previo.llamados, deshacer: null });
    assert.equal(efecto, null);
  });

  test('sin llamado previo: no hace nada (CU-03 1a)', () => {
    const { estado, efecto } = deshacer(ESTADO_INICIAL);
    assert.equal(estado, ESTADO_INICIAL);
    assert.equal(efecto, null);
  });

  test('dos veces seguidas: el segundo no hace nada (CU-03 2a)', () => {
    const una = deshacer(secuencia('43', '51')).estado;
    const dos = deshacer(una);
    assert.equal(dos.estado, una);
    assert.equal(dos.efecto, null);
  });
});
