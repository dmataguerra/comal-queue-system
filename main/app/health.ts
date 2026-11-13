import type { Diagnostics } from '../../shared/contract.js';
import type { Logger } from '../../shared/logging.js';
/** Tracks audio and YouTube health reported by the public display and logs transitions once. */
export function createHealthMonitor(logger: Logger) {
  let audio: Diagnostics['audio'] = 'desconocido';
  let youtube: Diagnostics['youtube'] = 'inactivo';
  const report = (kind: 'audio' | 'youtube', state: 'correcto' | 'degradado') => {
    if (kind === 'audio') {
      if (audio === state) return;
      if (state === 'correcto') logger.info('Audio recuperado.');
      else logger.warn('Audio degradado.');
      audio = state;
      return;
    }
    const next = state === 'correcto' ? 'activo' : 'no disponible';
    if (youtube === next) return;
    if (next === 'activo') logger.info('YouTube recuperado.');
    else logger.warn('YouTube no disponible.');
    youtube = next;
  };
  return { report, snapshot: () => ({ audio, youtube }) };
}
