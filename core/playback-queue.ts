import {
  MAX_ANNOUNCEMENTS,
  MAX_ANNOUNCEMENT_DURATION_MS,
  MAX_ANNOUNCEMENT_WAIT_MS,
} from '../shared/announcement-policy.js';
interface QueueOptions<T> {
  limit?: number;
  waitMs?: number;
  durationMs?: number;
  now?: () => number;
  isCurrent?: (value: T) => boolean;
  onDiscard?: (value: T) => void;
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
  const now = options.now ?? Date.now;
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
          now() - next.desde >= (options.waitMs ?? MAX_ANNOUNCEMENT_WAIT_MS) ||
          options.isCurrent?.(next.valor) === false
        ) {
          options.onDiscard?.(next.valor);
          continue;
        }
        const task = { valor: next.valor, control: new AbortController() };
        current = task;
        const limit = setTimeout(() => {
          task.control.abort();
          options.onDiscard?.(task.valor);
        }, options.durationMs ?? MAX_ANNOUNCEMENT_DURATION_MS);
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
    add(value: T) {
      if (control.signal.aborted) return false;
      if (pending.length + Number(working) >= (options.limit ?? MAX_ANNOUNCEMENTS)) {
        options.onDiscard?.(value);
        return false;
      }
      pending.push({ valor: value, desde: now() });
      void consume();
      return true;
    },
    discard(matches: (value: T) => boolean) {
      for (let i = pending.length - 1; i >= 0; i--) {
        if (matches(pending[i].valor)) {
          const [dropped] = pending.splice(i, 1);
          options.onDiscard?.(dropped.valor);
        }
      }
      if (current && matches(current.valor)) current.control.abort();
    },
    stop() {
      pending.length = 0;
      control.abort();
      current?.control.abort();
    },
  };
}
