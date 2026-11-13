import {
  INITIAL_STATE,
  EXPIRY_MS,
  undo,
  onScreen,
  callTurn,
  remove,
  expire,
  type QueueState,
} from '../core/turns.js';
import type { Action, Announcement, Snapshot, DispatchResult } from '../shared/contract.js';
import { AppError } from '../shared/errors.js';
import { silentLogger, type Logger } from '../shared/logging.js';
/** `revision` increases with every notification so clients can drop out-of-order snapshots. */
export type Subscriber = (
  snapshot: Snapshot,
  announcement: Announcement | null,
  revision: number,
) => void;
export interface Store {
  obtener(): Snapshot;
  /** Revision of the snapshot `obtener()` returns now. */
  revision(): number;
  despachar(action: Action): DispatchResult;
  suscribir(fn: Subscriber): () => void;
  reiniciarSiCambioDia(): boolean;
  saludPersistencia(): {
    estado: 'correcta' | 'error';
    primerFallo: string | null;
    restauradaEn: string | null;
    ultimoGuardado: string | null;
    ultimoError: string | null;
    ultimoAnuncio: {
      n: number;
      fecha: string;
    } | null;
  };
  cerrar(): void;
}
interface QueueStorePorts {
  antesDeAnunciar?: () => void;
  esperaAnuncioMs?: number;
  load: (today: string) => {
    estado: QueueState;
    desde: Map<number, number>;
    advertencia?: string;
  };
  save: (state: QueueState, date: string, since: ReadonlyMap<number, number>) => void;
  ensureCapacity: () => void;
  today: () => string;
  logger?: Logger;
  ahora?: () => number;
  vigenciaMs?: number;
}
export function createQueueStore({
  antesDeAnunciar: beforeAnnounce,
  esperaAnuncioMs: announcementWaitMs,
  load,
  save,
  ensureCapacity,
  today,
  ahora: now = () => Date.now(),
  vigenciaMs: expiryMs = EXPIRY_MS,
  logger = silentLogger,
}: QueueStorePorts): Store {
  let currentDate = today();
  let { estado: queueState, desde: calledSince, advertencia: recoveryWarning } = load(currentDate);
  let previousCalledSince: Map<number, number> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextAnnouncement = 1;
  let revision = 0;
  let firstFailure: string | null = null;
  let restoredAt: string | null = null;
  let lastSaved: string | null = null;
  let lastError: string | null = null;
  let lastAnnouncement: {
    n: number;
    fecha: string;
  } | null = null;
  const subscribers = new Set<Subscriber>();
  const get = (): Snapshot => ({
    actual: queueState.actual,
    llamados: queueState.llamados,
    puedeDeshacer: queueState.deshacer !== null,
    ...(firstFailure ? { persistencia: { estado: 'error' as const, desde: firstFailure } } : {}),
    ...(recoveryWarning ? { advertenciaRecuperacion: recoveryWarning } : {}),
  });
  function persist(): boolean {
    try {
      ensureCapacity();
      save(queueState, currentDate, calledSince);
      lastSaved = new Date(now()).toISOString();
      if (firstFailure) {
        restoredAt = new Date(now()).toISOString();
        logger.info(`Persistencia de estado.json restaurada en ${restoredAt}.`);
        firstFailure = null;
      }
      return true;
    } catch (error) {
      lastError = String((error as Error).message).slice(0, 200);
      if (!firstFailure) {
        firstFailure = new Date(now()).toISOString();
        logger.error(
          `No se pudo guardar estado.json; la acción no se aplicó: ${(error as Error).message}`,
        );
      }
      return false;
    }
  }
  const backup = () => ({
    fecha: currentDate,
    estado: queueState,
    desde: calledSince,
    desdePrevio: previousCalledSince,
    siguienteAnuncio: nextAnnouncement,
    ultimoAnuncio: lastAnnouncement,
    advertenciaRecuperacion: recoveryWarning,
  });
  function restore(previous: ReturnType<typeof backup>) {
    ({
      fecha: currentDate,
      estado: queueState,
      desde: calledSince,
      desdePrevio: previousCalledSince,
      siguienteAnuncio: nextAnnouncement,
      ultimoAnuncio: lastAnnouncement,
      advertenciaRecuperacion: recoveryWarning,
    } = previous);
    notify(null);
  }
  function notify(announcement: Announcement | null) {
    revision++;
    const snapshot = get();
    for (const fn of subscribers) {
      try {
        fn(snapshot, announcement, revision);
      } catch (error) {
        logger.error(`Error al notificar el estado: ${(error as Error).message}`);
      }
    }
  }
  function applyExpired(): boolean {
    const limit = now() - expiryMs;
    calledSince = new Map(onScreen(queueState).map((n) => [n, calledSince.get(n) ?? now()]));
    const expired = [...calledSince].filter(([, t]) => t <= limit).map(([n]) => n);
    if (!expired.length) return false;
    queueState = expire(queueState, expired).estado;
    for (const n of expired) calledSince.delete(n);
    if (!queueState.deshacer) previousCalledSince = null;
    return true;
  }
  function schedule(retryMs = 0) {
    clearTimeout(timer);
    if (!calledSince.size) return;
    const wait = Math.max(retryMs, Math.min(...calledSince.values()) + expiryMs - now());
    timer = setTimeout(() => {
      const previous = backup();
      if (applyExpired()) {
        if (!persist()) {
          restore(previous);
          schedule(5000);
          return;
        }
        notify(null);
      }
      schedule();
    }, wait);
    timer.unref?.();
  }
  function resetOnDayChange(): boolean {
    const fresh = today();
    if (fresh === currentDate) return false;
    const previous = backup();
    currentDate = fresh;
    recoveryWarning = undefined;
    if (queueState.actual === null && !queueState.deshacer) return false;
    queueState = INITIAL_STATE;
    calledSince = new Map();
    previousCalledSince = null;
    if (!persist()) {
      restore(previous);
      throw new AppError(
        'DAY_ROLLOVER_FAILED',
        'No se pudo guardar el cambio de jornada. Revise disco y permisos.',
      );
    }
    schedule();
    notify(null);
    return true;
  }
  function dispatch(action: Action): DispatchResult {
    resetOnDayChange();
    const previousOperation = backup();
    const { estado: next, efecto: effect } =
      action.tipo === 'LLAMAR'
        ? callTurn(queueState, action.entrada)
        : action.tipo === 'QUITAR'
          ? remove(queueState, action.n)
          : undo(queueState);
    if (effect?.tipo === 'CAPTURA_INVALIDA') {
      return { instantanea: get(), efecto: 'CAPTURA_INVALIDA', anuncio: null };
    }
    if (effect?.tipo === 'ANUNCIAR') beforeAnnounce?.();
    const announcement =
      effect?.tipo === 'ANUNCIAR'
        ? {
            id: nextAnnouncement++,
            n: effect.n,
            ...(announcementWaitMs === undefined
              ? {}
              : { limiteInicio: now() + announcementWaitMs }),
          }
        : null;
    if (announcement)
      lastAnnouncement = { n: announcement.n, fecha: new Date(now()).toISOString() };
    const change = next !== queueState;
    const previous = calledSince;
    if (action.tipo === 'DESHACER' && change && previousCalledSince)
      calledSince = previousCalledSince;
    if (announcement) calledSince = new Map(calledSince).set(announcement.n, now());
    if (!next.deshacer) previousCalledSince = null;
    else if (next.deshacer !== queueState.deshacer) previousCalledSince = previous;
    queueState = next;
    const expiredNow = applyExpired();
    if (change || announcement || expiredNow) {
      if (!persist()) {
        restore(previousOperation);
        throw new AppError(
          'STATE_SAVE_FAILED',
          'No se pudo guardar el turno. La TV y la cola no cambiaron. Revise disco y permisos.',
        );
      }
      notify(announcement);
    }
    schedule();
    return { instantanea: get(), efecto: announcement ? 'ANUNCIAR' : null, anuncio: announcement };
  }
  const previousInitial = backup();
  if (applyExpired() && !persist()) restore(previousInitial);
  schedule(firstFailure ? 5000 : 0);
  return {
    obtener: get,
    revision: () => revision,
    despachar: dispatch,
    suscribir(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    reiniciarSiCambioDia: resetOnDayChange,
    saludPersistencia: () => ({
      estado: firstFailure ? 'error' : 'correcta',
      primerFallo: firstFailure,
      restauradaEn: restoredAt,
      ultimoGuardado: lastSaved,
      ultimoError: lastError,
      ultimoAnuncio: lastAnnouncement,
    }),
    cerrar() {
      clearTimeout(timer);
      subscribers.clear();
    },
  };
}
