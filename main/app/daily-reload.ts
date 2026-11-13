import type { Logger } from '../../shared/logging.js';
import { msHastaHora } from '../config.js';
interface DailyReloadOptions {
  /** Current reload time as HH:MM; read on every scheduling so config edits apply. */
  time: () => string;
  /** Work to do at the reload time. A failure is logged and the next day is still scheduled. */
  run: () => void;
  logger: Logger;
}
/** Runs `run` once a day at the configured local time. */
export function createDailyReload({ time, run, logger }: DailyReloadOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  function schedule() {
    clearTimeout(timer);
    if (stopped) return;
    timer = setTimeout(() => {
      try {
        run();
      } catch (error) {
        logger.error(`No se pudo reiniciar la jornada: ${(error as Error).message}`);
      } finally {
        schedule();
      }
    }, msHastaHora(time()));
  }
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
  };
  return { schedule, stop };
}
