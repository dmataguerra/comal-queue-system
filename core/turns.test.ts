import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { INITIAL_STATE, undo, format, callTurn, remove, expire, type QueueState } from './turns.js';
function sequence(...inputs: string[]): QueueState {
  return inputs.reduce((state, input) => callTurn(state, input).estado, INITIAL_STATE);
}
describe('llamar()', () => {
  test('número nuevo: pasa a actual, el anterior entra arriba, el 6.º saca al más viejo', () => {
    const full = sequence('10', '11', '12', '13', '14', '15');
    assert.deepEqual([full.actual, full.llamados], [15, [14, 13, 12, 11, 10]]);
    const { estado: state, efecto: effect } = callTurn(full, '16');
    assert.equal(state.actual, 16);
    assert.deepEqual(state.llamados, [15, 14, 13, 12, 11]);
    assert.deepEqual(effect, { tipo: 'ANUNCIAR', n: 16 });
  });
  test('número en la lista: sale de la lista y no se duplica (RF-06, RN-04)', () => {
    const { estado: state, efecto: effect } = callTurn(sequence('43', '51', '38'), '43');
    assert.equal(state.actual, 43);
    assert.deepEqual(state.llamados, [38, 51]);
    assert.deepEqual(effect, { tipo: 'ANUNCIAR', n: 43 });
  });
  test('número que ya es el actual: no cambia el estado, solo anuncia (RN-05)', () => {
    const previous = sequence('43', '98');
    const { estado: state, efecto: effect } = callTurn(previous, '98');
    assert.equal(state, previous);
    assert.deepEqual(effect, { tipo: 'ANUNCIAR', n: 98 });
  });
  test('número que ya salió de la lista: se comporta como nuevo', () => {
    const previous = sequence('10', '11', '12', '13', '14', '15', '16');
    assert.ok(!previous.llamados.includes(10));
    const { estado: state } = callTurn(previous, '10');
    assert.equal(state.actual, 10);
    assert.deepEqual(state.llamados, [16, 15, 14, 13, 12]);
  });
  test('vacío, letras, 7 dígitos: CAPTURA_INVALIDA y estado intacto (CU-01 3a)', () => {
    const previous = sequence('43');
    for (const input of ['', '   ', 'abc', '9a', '1234567', null, undefined, '-5', '4.5']) {
      const { estado: state, efecto: effect } = callTurn(previous, input);
      assert.equal(state, previous);
      assert.deepEqual(effect, { tipo: 'CAPTURA_INVALIDA', entrada: input });
    }
  });
  test('primer llamado de la jornada: la lista queda vacía (CU-01 4a)', () => {
    const { estado: state } = callTurn(INITIAL_STATE, '07');
    assert.equal(state.actual, 7);
    assert.deepEqual(state.llamados, []);
  });
  test('6 dígitos: usa los dos últimos (pendiente 2)', () => {
    assert.equal(callTurn(INITIAL_STATE, '213298').estado.actual, 98);
    assert.equal(callTurn(INITIAL_STATE, '213200').estado.actual, 0);
    assert.equal(format(0), '00');
  });
  test('un dígito: se interpreta con cero a la izquierda', () => {
    const { estado: state } = callTurn(INITIAL_STATE, '8');
    assert.equal(state.actual, 8);
    assert.equal(format(state.actual!), '08');
  });
});
describe('quitar()', () => {
  test('un llamado: sale de la lista y el resto no se mueve', () => {
    const previous = sequence('10', '11', '12', '13');
    assert.deepEqual([previous.actual, previous.llamados], [13, [12, 11, 10]]);
    const { estado: state, efecto: effect } = remove(previous, 11);
    assert.equal(state.actual, 13);
    assert.deepEqual(state.llamados, [12, 10]);
    assert.equal(effect, null);
  });
  test('el actual: deja de aparecer y el siguiente queda arriba, sin anunciar', () => {
    const { estado: state, efecto: effect } = remove(sequence('10', '11', '12'), 12);
    assert.equal(state.actual, 11);
    assert.deepEqual(state.llamados, [10]);
    assert.equal(effect, null);
  });
  test('el único turno de la jornada: la pantalla queda vacía', () => {
    const { estado: state } = remove(sequence('07'), 7);
    assert.equal(state.actual, null);
    assert.deepEqual(state.llamados, []);
  });
  test('un número que no está en pantalla: no cambia nada', () => {
    const previous = sequence('10', '11');
    const { estado: state, efecto: effect } = remove(previous, 44);
    assert.equal(state, previous);
    assert.equal(effect, null);
  });
  test('corregir después de quitar no devuelve el número eliminado', () => {
    const previous = sequence('10', '11', '12');
    const { estado: state } = undo(remove(previous, 12).estado);
    assert.deepEqual([state.actual, state.llamados], [11, [10]]);
    assert.equal(state.deshacer, null);
  });
  test('quitar todos uno por uno vacía la pantalla sin dejar huecos', () => {
    let state = sequence('10', '11', '12');
    for (const n of [11, 12, 10]) state = remove(state, n).estado;
    assert.deepEqual([state.actual, state.llamados], [null, []]);
  });
});
describe('vencer()', () => {
  test('saca los vencidos sin mover al resto y sin anunciar', () => {
    const { estado: state, efecto: effect } = expire(sequence('10', '11', '12', '13'), [10, 11]);
    assert.deepEqual([state.actual, state.llamados], [13, [12]]);
    assert.equal(effect, null);
  });
  test('conserva deshacer si el actual sigue en pantalla', () => {
    const previous = sequence('10', '11', '12');
    const { estado: state } = expire(previous, [10]);
    assert.equal(state.deshacer, previous.deshacer);
  });
  test('si vence el actual, el siguiente queda arriba y ya no hay qué deshacer', () => {
    const { estado: state } = expire(sequence('10', '11'), [11]);
    assert.deepEqual([state.actual, state.llamados, state.deshacer], [10, [], null]);
  });
  test('ningún vencido en pantalla: no cambia nada', () => {
    const previous = sequence('10', '11');
    const { estado: state } = expire(previous, [44]);
    assert.equal(state, previous);
  });
});
describe('deshacer()', () => {
  test('restaura el estado previo y no anuncia', () => {
    const previous = sequence('43', '51');
    const invalid = callTurn(previous, '81').estado;
    const { estado: state, efecto: effect } = undo(invalid);
    assert.deepEqual(state, {
      actual: previous.actual,
      llamados: previous.llamados,
      deshacer: null,
    });
    assert.equal(effect, null);
  });
  test('sin llamado previo: no hace nada (CU-03 1a)', () => {
    const { estado: state, efecto: effect } = undo(INITIAL_STATE);
    assert.equal(state, INITIAL_STATE);
    assert.equal(effect, null);
  });
  test('dos veces seguidas: el segundo no hace nada (CU-03 2a)', () => {
    const one = undo(sequence('43', '51')).estado;
    const two = undo(one);
    assert.equal(two.estado, one);
    assert.equal(two.efecto, null);
  });
});
