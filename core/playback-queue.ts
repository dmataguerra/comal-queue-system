import {
  MAX_ANNOUNCEMENTS,
  MAX_ANNOUNCEMENT_DURATION_MS,
  MAX_ANNOUNCEMENT_WAIT_MS,
} from '../shared/announcement-policy.js';
interface QueueOptions<T> {
  limite?: number;
  esperaMs?: number;
  duracionMs?: number;
  ahora?: () => number;
  vigente?: (value: T) => boolean;
  alDescartar?: (value: T) => void;
}
export function createQueue<T>(
  processItem: (value: T, signal: AbortSignal) => Promise<void>,
  onFailure: (error: unknown) => void,
  options: QueueOptions<T> = {},
) {
  const pending: {
    valor: T;
    desde: number;
  }[] = [];
  const now = options.ahora ?? Date.now;
  const control = new AbortController();
  let current: {
    valor: T;
    control: AbortController;
  } | null = null;
  let working = false;
  async function consume() {
    if (working || control.signal.aborted) return;
    working = true;
    try {
      while (pending.length && !control.signal.aborted) {
        const next = pending.shift()!;
        if (
          now() - next.desde >= (options.esperaMs ?? MAX_ANNOUNCEMENT_WAIT_MS) ||
          options.vigente?.(next.valor) === false
        ) {
          options.alDescartar?.(next.valor);
          continue;
        }
        const task = { valor: next.valor, control: new AbortController() };
        current = task;
        const limit = setTimeout(() => {
          task.control.abort();
          options.alDescartar?.(task.valor);
        }, options.duracionMs ?? MAX_ANNOUNCEMENT_DURATION_MS);
        try {
          await processItem(next.valor, task.control.signal);
        } catch (error) {
          if (!control.signal.aborted) onFailure(error);
        } finally {
          clearTimeout(limit);
          current = null;
        }
      }
    } finally {
      working = false;
    }
  }
  return {
    agregar(value: T) {
      if (control.signal.aborted) return false;
      if (pending.length + Number(working) >= (options.limite ?? MAX_ANNOUNCEMENTS)) {
        options.alDescartar?.(value);
        return false;
      }
      pending.push({ valor: value, desde: now() });
      void consume();
      return true;
    },
    descartar(matches: (value: T) => boolean) {
      for (let i = pending.length - 1; i >= 0; i--) {
        if (matches(pending[i].valor)) {
          const [dropped] = pending.splice(i, 1);
          options.alDescartar?.(dropped.valor);
        }
      }
      if (current && matches(current.valor)) current.control.abort();
    },
    detener() {
      pending.length = 0;
      control.abort();
      current?.control.abort();
    },
  };
}
