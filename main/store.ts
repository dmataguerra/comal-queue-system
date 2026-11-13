import { statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createQueueStore } from '../backend/queue-store.js';
import { AppError, errorCodeOf } from '../shared/errors.js';
import type { Store } from '../backend/queue-store.js';
import { silentLogger, type Logger } from '../shared/logging.js';
import { fechaLocal, guardarEstado, leerEstado } from './persistencia.js';
export type { Store } from '../backend/queue-store.js';
export const RESERVA_ESTADO = 16 * 1024 * 1024;
export function comprobarEspacioEstado(
  ruta: string,
  espacio = (carpeta: string) => {
    const info = statfsSync(carpeta);
    return info.bavail * info.bsize;
  },
): void {
  try {
    if (espacio(dirname(ruta)) < RESERVA_ESTADO)
      throw new AppError('DISK_FULL', 'Espacio insuficiente para guardar estado.json.');
  } catch (error) {
    if (errorCodeOf(error) === 'DISK_FULL') throw error;
    const codigo = (error as NodeJS.ErrnoException).code;
    if (codigo === 'ENOSYS' || codigo === 'ENOTSUP') return;
    throw error;
  }
}
interface StoreOptions {
  antesDeAnunciar?: () => void;
  esperaAnuncioMs?: number;
  ruta: string;
  hoy?: () => string;
  ahora?: () => number;
  vigenciaMs?: number;
  logger?: Logger;
  guardar?: typeof guardarEstado;
}
export function crearStore({
  antesDeAnunciar,
  esperaAnuncioMs,
  ruta,
  hoy = () => fechaLocal(),
  ahora,
  vigenciaMs,
  logger = silentLogger,
  guardar = guardarEstado,
}: StoreOptions): Store {
  return createQueueStore({
    antesDeAnunciar,
    esperaAnuncioMs,
    load: (today) => leerEstado(ruta, today, logger),
    save: (state, date, since) => guardar(ruta, state, date, since),
    ensureCapacity: () => comprobarEspacioEstado(ruta),
    today: hoy,
    ahora,
    vigenciaMs,
    logger,
  });
}
