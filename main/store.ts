import { statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createQueueStore } from '../backend/queue-store.js';
import { AppError, errorCodeOf } from '../shared/errors.js';
import type { Store } from '../backend/queue-store.js';
import { silentLogger, type Logger } from '../shared/logging.js';
import { localDate, saveState, readState } from './persistence.js';
export type { Store } from '../backend/queue-store.js';
export const STATE_RESERVE = 16 * 1024 * 1024;
export function checkStateSpace(
  filePath: string,
  space = (folder: string) => {
    const info = statfsSync(folder);
    return info.bavail * info.bsize;
  },
): void {
  try {
    if (space(dirname(filePath)) < STATE_RESERVE)
      throw new AppError('DISK_FULL', 'Espacio insuficiente para guardar estado.json.');
  } catch (error) {
    if (errorCodeOf(error) === 'DISK_FULL') throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOSYS' || code === 'ENOTSUP') return;
    throw error;
  }
}
interface StoreOptions {
  beforeAnnounce?: () => void;
  announcementWaitMs?: number;
  filePath: string;
  today?: () => string;
  now?: () => number;
  expiryMs?: number;
  logger?: Logger;
  save?: typeof saveState;
}
export function createStore({
  beforeAnnounce: beforeAnnounce,
  announcementWaitMs: announcementWaitMs,
  filePath: filePath,
  today: getToday = () => localDate(),
  now: now,
  expiryMs: expiryMs,
  logger = silentLogger,
  save: save = saveState,
}: StoreOptions): Store {
  return createQueueStore({
    beforeAnnounce: beforeAnnounce,
    announcementWaitMs: announcementWaitMs,
    load: (today) => readState(filePath, today, logger),
    save: (state, date, since) => save(filePath, state, date, since),
    ensureCapacity: () => checkStateSpace(filePath),
    today: getToday,
    now: now,
    expiryMs: expiryMs,
    logger,
  });
}
