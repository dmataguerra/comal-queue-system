import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INITIAL_STATE,
  undo,
  onScreen,
  callTurn,
  normalize,
  remove,
  expire,
  type QueueState,
} from './turns.js';
test('every ticket of up to six digits announces exactly its 00–99 ending', () => {
  for (let ticket = 0; ticket < 1000000; ticket++) {
    assert.equal(normalize(String(ticket)), ticket % 100);
    assert.equal(normalize(String(ticket).padStart(6, '0')), ticket % 100);
  }
});
test('20,000 reproducible transitions match the six-turn model with correction', () => {
  for (const initialSeed of [1, 42, 0xc0a1, 0xffffffff]) {
    let seed = initialSeed;
    const random = (max: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed >>> 8) % max;
    };
    let state: QueueState = INITIAL_STATE;
    let screen: number[] = [];
    let correction: number[] | null = null;
    for (let i = 0; i < 5000; i++) {
      const n = random(100);
      const action = random(6);
      const previous = structuredClone(state);
      Object.freeze(state.called);
      if (state.undo) Object.freeze(state.undo.called);
      Object.freeze(state);
      let next;
      if (action <= 1) {
        next = callTurn(state, String(100000 + n));
        if (screen[0] !== n) {
          correction = [...screen];
          screen = [n, ...screen.filter((turn) => turn !== n)].slice(0, 6);
        }
        assert.deepEqual(next.effect, { tipo: 'ANUNCIAR', n });
      } else if (action === 2) {
        next = remove(state, n);
        if (screen.includes(n)) {
          screen = screen.filter((turn) => turn !== n);
          correction = null;
        }
        assert.equal(next.effect, null);
      } else if (action === 3) {
        next = undo(state);
        if (correction) screen = [...correction];
        correction = null;
        assert.equal(next.effect, null);
      } else if (action === 4) {
        const expired = [n, random(100), random(100)];
        next = expire(state, expired);
        if (screen.length && expired.includes(screen[0])) correction = null;
        screen = screen.filter((turn) => !expired.includes(turn));
        assert.equal(next.effect, null);
      } else {
        next = callTurn(state, ['1234567', '-1', '12x', '１２', '', 'NaN'][random(6)]);
        assert.equal(next.effect?.tipo, 'CAPTURA_INVALIDA');
      }
      const context = `seed=${initialSeed}, paso=${i}, accion=${action}, numero=${n}`;
      assert.deepEqual(state, previous, `No debe mutar el estado anterior: ${context}`);
      state = next.state;
      assert.deepEqual(onScreen(state), screen, context);
      assert.equal(state.undo !== null, correction !== null, context);
      assert.ok(screen.length <= 6, context);
      assert.equal(new Set(screen).size, screen.length, context);
    }
  }
});
