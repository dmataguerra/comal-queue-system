import { statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createQueueStore } from '../backend/queue-store.js';
import type { Store } from '../backend/queue-store.js';
import type { Registrar } from './log.js';
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
      throw new Error('Espacio insuficiente para guardar estado.json.');
  } catch (error) {
    if ((error as Error).message.startsWith('Espacio insuficiente')) throw error;
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
  registrar?: Registrar;
  guardar?: typeof guardarEstado;
}

/** Bind the queue application to the existing, compatibility-preserving JSON adapter. */
export function crearStore({
  antesDeAnunciar,
  esperaAnuncioMs,
  ruta,
  hoy = () => fechaLocal(),
  ahora,
  vigenciaMs,
  registrar = () => {},
  guardar = guardarEstado,
}: StoreOptions): Store {
  return createQueueStore({
    antesDeAnunciar,
    esperaAnuncioMs,
    load: (today) => leerEstado(ruta, today, registrar),
    save: (state, date, since) => guardar(ruta, state, date, since),
    ensureCapacity: () => comprobarEspacioEstado(ruta),
    today: hoy,
    ahora,
    vigenciaMs,
    registrar,
  });
}
