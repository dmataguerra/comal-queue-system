import { constants, copyFileSync, readFileSync } from 'node:fs';
import { INITIAL_STATE, MAX_CALLED_TURNS, onScreen, type QueueState } from '../core/turns.js';
import { writeJsonAtomic } from './atomic-write.js';
import { silentLogger, type Logger } from '../shared/logging.js';
export interface Persisted {
  fecha: string;
  actual: number | null;
  llamados: number[];
  desde?: Record<string, string>;
  guardadoEn: string;
}
export interface Loaded {
  estado: QueueState;
  desde: Map<number, number>;
  advertencia?: string;
}
const empty = (warning?: string): Loaded => ({
  estado: INITIAL_STATE,
  desde: new Map(),
  ...(warning ? { advertencia: warning } : {}),
});
export function localDate(date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
const isTurn = (x: unknown): x is number =>
  Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 99;
const isIsoDate = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
function valid(data: unknown): data is Persisted {
  if (!data || typeof data !== 'object') return false;
  const {
    fecha: date,
    actual: current,
    llamados: calledTurns,
    desde: calledSince,
  } = data as Record<string, unknown>;
  return (
    typeof date === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(date) &&
    isIsoDate(`${date}T00:00:00.000Z`) &&
    (calledSince === undefined ||
      (!!calledSince && typeof calledSince === 'object' && !Array.isArray(calledSince))) &&
    (current === null || isTurn(current)) &&
    Array.isArray(calledTurns) &&
    calledTurns.length <= MAX_CALLED_TURNS &&
    calledTurns.every(isTurn) &&
    new Set(calledTurns).size === calledTurns.length &&
    (current === null || !calledTurns.includes(current))
  );
}
function validTimestamps(data: Persisted): boolean {
  return (
    isIsoDate(data.guardadoEn) &&
    (data.desde === undefined || Object.values(data.desde).every(isIsoDate))
  );
}
export function isPersistedState(data: unknown): data is Persisted {
  return valid(data) && validTimestamps(data);
}
function preserveCorrupt(filePath: string, reason: string, logger: Logger): void {
  const copy = `${filePath}.corrupto-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
  try {
    copyFileSync(filePath, copy, constants.COPYFILE_EXCL);
    logger.warn(`estado.json ${reason}; copia diagnóstica en ${copy}; se arranca vacío.`);
  } catch (error) {
    logger.warn(
      `estado.json ${reason}; no se pudo crear copia diagnóstica: ${(error as Error).message}; se arranca vacío.`,
    );
  }
}
export function readState(filePath: string, today: string, logger: Logger = silentLogger): Loaded {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty();
    logger.error(`No se pudo leer estado.json: ${(error as Error).message}`);
    throw error;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    preserveCorrupt(filePath, 'no es JSON válido', logger);
    return empty(
      'El estado guardado estaba dañado. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (!valid(data)) {
    preserveCorrupt(filePath, 'tiene una forma inválida', logger);
    return empty(
      'El estado guardado tenía datos inválidos. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (!validTimestamps(data)) {
    preserveCorrupt(filePath, 'tiene timestamps inválidos', logger);
    return empty(
      'El estado guardado tenía fechas inválidas. La jornada empezó vacía; revise la copia diagnóstica y el registro.',
    );
  }
  if (data.fecha !== today) {
    logger.info(`estado.json pertenece a ${data.fecha}; se inicia la jornada ${today} vacía.`);
    return empty();
  }
  const state: QueueState = { actual: data.actual, llamados: data.llamados, deshacer: null };
  const time = (value: unknown) => (typeof value === 'string' ? Date.parse(value) : NaN);
  const backup = time(data.guardadoEn);
  const calledSince = new Map<number, number>();
  for (const n of onScreen(state)) {
    const t = time(data.desde?.[n]);
    if (!Number.isNaN(t)) calledSince.set(n, t);
    else if (!Number.isNaN(backup)) calledSince.set(n, backup);
  }
  return { estado: state, desde: calledSince };
}
export function saveState(
  filePath: string,
  state: QueueState,
  date: string,
  calledSince: ReadonlyMap<number, number> = new Map(),
  now = new Date(),
): void {
  const data: Persisted = {
    fecha: date,
    actual: state.actual,
    llamados: state.llamados,
    desde: Object.fromEntries([...calledSince].map(([n, t]) => [n, new Date(t).toISOString()])),
    guardadoEn: now.toISOString(),
  };
  writeJsonAtomic(filePath, data);
}
