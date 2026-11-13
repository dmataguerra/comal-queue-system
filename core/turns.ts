export const MAX_CALLED_TURNS = 5;
export const EXPIRY_MS = 5 * 60000;
export interface QueueState {
  actual: number | null;
  llamados: number[];
  deshacer: {
    actual: number | null;
    llamados: number[];
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
  estado: QueueState;
  efecto: Effect | null;
}
export const INITIAL_STATE: QueueState = Object.freeze({
  actual: null,
  llamados: [],
  deshacer: null,
});
// El ticket admite hasta seis dígitos; en la pantalla sólo se usan los dos últimos.
export function normalize(input: unknown): number | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const d = String(input).trim();
  if (!/^\d{1,6}$/.test(d)) return null;
  return Number(d.slice(-2));
}
export function onScreen(state: QueueState): number[] {
  return state.actual === null ? [...state.llamados] : [state.actual, ...state.llamados];
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
    return { estado: state, efecto: { tipo: 'CAPTURA_INVALIDA', entrada: input } };
  }
  if (state.actual === n) {
    return { estado: state, efecto: { tipo: 'ANUNCIAR', n } };
  }
  const calledTurns = [
    ...(state.actual === null ? [] : [state.actual]),
    ...state.llamados.filter((x) => x !== n),
  ].slice(0, maxCalledTurns);
  return {
    estado: {
      actual: n,
      llamados: calledTurns,
      deshacer: { actual: state.actual, llamados: state.llamados },
    },
    efecto: { tipo: 'ANUNCIAR', n },
  };
}
export function remove(state: QueueState, n: number): Transition {
  if (state.actual !== n && !state.llamados.includes(n)) return { estado: state, efecto: null };
  const [current = null, ...calledTurns] = onScreen(state).filter((x) => x !== n);
  return {
    estado: { actual: current, llamados: calledTurns, deshacer: null },
    efecto: null,
  };
}
export function expire(state: QueueState, expired: readonly number[]): Transition {
  const remaining = onScreen(state).filter((x) => !expired.includes(x));
  if (remaining.length === onScreen(state).length) return { estado: state, efecto: null };
  const [current = null, ...calledTurns] = remaining;
  return {
    estado: {
      actual: current,
      llamados: calledTurns,
      deshacer: current === state.actual ? state.deshacer : null,
    },
    efecto: null,
  };
}
export function undo(state: QueueState): Transition {
  if (!state.deshacer) return { estado: state, efecto: null };
  return {
    estado: { ...state.deshacer, deshacer: null },
    efecto: null,
  };
}
