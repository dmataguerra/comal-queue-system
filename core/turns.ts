export const MAX_CALLED_TURNS = 5;
export const EXPIRY_MS = 5 * 60000;
export interface QueueState {
  current: number | null;
  called: number[];
  undo: {
    current: number | null;
    called: number[];
  } | null;
}
export type Effect =
  | {
      tipo: 'ANUNCIAR';
      n: number;
    }
  | {
      tipo: 'CAPTURA_INVALIDA';
      entrada: unknown;
    };
export interface Transition {
  state: QueueState;
  effect: Effect | null;
}
export const INITIAL_STATE: QueueState = Object.freeze({
  current: null,
  called: [],
  undo: null,
});
// A ticket may have up to six digits; the screen only uses the last two.
export function normalize(input: unknown): number | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const d = String(input).trim();
  if (!/^\d{1,6}$/.test(d)) return null;
  return Number(d.slice(-2));
}
export function onScreen(state: QueueState): number[] {
  return state.current === null ? [...state.called] : [state.current, ...state.called];
}
export function format(n: number): string {
  return String(n).padStart(2, '0');
}
export function callTurn(
  state: QueueState,
  input: unknown,
  maxCalledTurns = MAX_CALLED_TURNS,
): Transition {
  const n = normalize(input);
  if (n === null) {
    return { state: state, effect: { tipo: 'CAPTURA_INVALIDA', entrada: input } };
  }
  if (state.current === n) {
    return { state: state, effect: { tipo: 'ANUNCIAR', n } };
  }
  const calledTurns = [
    ...(state.current === null ? [] : [state.current]),
    ...state.called.filter((x) => x !== n),
  ].slice(0, maxCalledTurns);
  return {
    state: {
      current: n,
      called: calledTurns,
      undo: { current: state.current, called: state.called },
    },
    effect: { tipo: 'ANUNCIAR', n },
  };
}
export function remove(state: QueueState, n: number): Transition {
  if (state.current !== n && !state.called.includes(n)) return { state: state, effect: null };
  const [current = null, ...calledTurns] = onScreen(state).filter((x) => x !== n);
  return {
    state: { current: current, called: calledTurns, undo: null },
    effect: null,
  };
}
export function expire(state: QueueState, expired: readonly number[]): Transition {
  const remaining = onScreen(state).filter((x) => !expired.includes(x));
  if (remaining.length === onScreen(state).length) return { state: state, effect: null };
  const [current = null, ...calledTurns] = remaining;
  return {
    state: {
      current: current,
      called: calledTurns,
      undo: current === state.current ? state.undo : null,
    },
    effect: null,
  };
}
export function undo(state: QueueState): Transition {
  if (!state.undo) return { state: state, effect: null };
  return {
    state: { ...state.undo, undo: null },
    effect: null,
  };
}
