import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { INITIAL_STATE, undo, format, callTurn, remove, expire, type QueueState } from './turns.js';
function sequence(...inputs: string[]): QueueState {
  return inputs.reduce((state, input) => callTurn(state, input).state, INITIAL_STATE);
}
describe('call()', () => {
  test('new number: becomes current, the previous one goes on top, the 6th evicts the oldest', () => {
    const full = sequence('10', '11', '12', '13', '14', '15');
    assert.deepEqual([full.current, full.called], [15, [14, 13, 12, 11, 10]]);
    const { state: state, effect: effect } = callTurn(full, '16');
    assert.equal(state.current, 16);
    assert.deepEqual(state.called, [15, 14, 13, 12, 11]);
    assert.deepEqual(effect, { tipo: 'ANUNCIAR', n: 16 });
  });
  test('number in the list: leaves the list and is not duplicated (RF-06, RN-04)', () => {
    const { state: state, effect: effect } = callTurn(sequence('43', '51', '38'), '43');
    assert.equal(state.current, 43);
    assert.deepEqual(state.called, [38, 51]);
    assert.deepEqual(effect, { tipo: 'ANUNCIAR', n: 43 });
  });
  test('number that is already current: state unchanged, only announces (RN-05)', () => {
    const previous = sequence('43', '98');
    const { state: state, effect: effect } = callTurn(previous, '98');
    assert.equal(state, previous);
    assert.deepEqual(effect, { tipo: 'ANUNCIAR', n: 98 });
  });
  test('number that already left the list: behaves as new', () => {
    const previous = sequence('10', '11', '12', '13', '14', '15', '16');
    assert.ok(!previous.called.includes(10));
    const { state: state } = callTurn(previous, '10');
    assert.equal(state.current, 10);
    assert.deepEqual(state.called, [16, 15, 14, 13, 12]);
  });
  test('empty, letters, 7 digits: CAPTURA_INVALIDA and state untouched (CU-01 3a)', () => {
    const previous = sequence('43');
    for (const input of ['', '   ', 'abc', '9a', '1234567', null, undefined, '-5', '4.5']) {
      const { state: state, effect: effect } = callTurn(previous, input);
      assert.equal(state, previous);
      assert.deepEqual(effect, { tipo: 'CAPTURA_INVALIDA', entrada: input });
    }
  });
  test('first call of the day: the list stays empty (CU-01 4a)', () => {
    const { state: state } = callTurn(INITIAL_STATE, '07');
    assert.equal(state.current, 7);
    assert.deepEqual(state.called, []);
  });
  test('6 digits: uses the last two (pending 2)', () => {
    assert.equal(callTurn(INITIAL_STATE, '213298').state.current, 98);
    assert.equal(callTurn(INITIAL_STATE, '213200').state.current, 0);
    assert.equal(format(0), '00');
  });
  test('one digit: interpreted with a leading zero', () => {
    const { state: state } = callTurn(INITIAL_STATE, '8');
    assert.equal(state.current, 8);
    assert.equal(format(state.current!), '08');
  });
});
describe('remove()', () => {
  test('one call: leaves the list and the rest does not move', () => {
    const previous = sequence('10', '11', '12', '13');
    assert.deepEqual([previous.current, previous.called], [13, [12, 11, 10]]);
    const { state: state, effect: effect } = remove(previous, 11);
    assert.equal(state.current, 13);
    assert.deepEqual(state.called, [12, 10]);
    assert.equal(effect, null);
  });
  test('the current one: disappears and the next one goes on top, without announcing', () => {
    const { state: state, effect: effect } = remove(sequence('10', '11', '12'), 12);
    assert.equal(state.current, 11);
    assert.deepEqual(state.called, [10]);
    assert.equal(effect, null);
  });
  test('the only turn of the day: the screen becomes empty', () => {
    const { state: state } = remove(sequence('07'), 7);
    assert.equal(state.current, null);
    assert.deepEqual(state.called, []);
  });
  test('a number that is not on screen: nothing changes', () => {
    const previous = sequence('10', '11');
    const { state: state, effect: effect } = remove(previous, 44);
    assert.equal(state, previous);
    assert.equal(effect, null);
  });
  test('correcting after removing does not bring back the removed number', () => {
    const previous = sequence('10', '11', '12');
    const { state: state } = undo(remove(previous, 12).state);
    assert.deepEqual([state.current, state.called], [11, [10]]);
    assert.equal(state.undo, null);
  });
  test('removing all one by one empties the screen without leaving gaps', () => {
    let state = sequence('10', '11', '12');
    for (const n of [11, 12, 10]) state = remove(state, n).state;
    assert.deepEqual([state.current, state.called], [null, []]);
  });
});
describe('expire()', () => {
  test('removes expired ones without moving the rest and without announcing', () => {
    const { state: state, effect: effect } = expire(sequence('10', '11', '12', '13'), [10, 11]);
    assert.deepEqual([state.current, state.called], [13, [12]]);
    assert.equal(effect, null);
  });
  test('keeps undo if the current one is still on screen', () => {
    const previous = sequence('10', '11', '12');
    const { state: state } = expire(previous, [10]);
    assert.equal(state.undo, previous.undo);
  });
  test('if the current one expires, the next one goes on top and there is nothing left to undo', () => {
    const { state: state } = expire(sequence('10', '11'), [11]);
    assert.deepEqual([state.current, state.called, state.undo], [10, [], null]);
  });
  test('no expired number on screen: nothing changes', () => {
    const previous = sequence('10', '11');
    const { state: state } = expire(previous, [44]);
    assert.equal(state, previous);
  });
});
describe('undo()', () => {
  test('restores the previous state and does not announce', () => {
    const previous = sequence('43', '51');
    const invalid = callTurn(previous, '81').state;
    const { state: state, effect: effect } = undo(invalid);
    assert.deepEqual(state, {
      current: previous.current,
      called: previous.called,
      undo: null,
    });
    assert.equal(effect, null);
  });
  test('no previous call: does nothing (CU-03 1a)', () => {
    const { state: state, effect: effect } = undo(INITIAL_STATE);
    assert.equal(state, INITIAL_STATE);
    assert.equal(effect, null);
  });
  test('twice in a row: the second one does nothing (CU-03 2a)', () => {
    const one = undo(sequence('43', '51')).state;
    const two = undo(one);
    assert.equal(two.state, one);
    assert.equal(two.effect, null);
  });
});
