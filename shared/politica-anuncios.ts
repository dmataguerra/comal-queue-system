/** Incluye el anuncio activo. Ningún anuncio debe empezar con más de 45 s de retraso. */
export const MAX_ANUNCIOS = 6;
export const MAX_ESPERA_ANUNCIO_MS = 45_000;
export const MAX_DURACION_ANUNCIO_MS = 30_000;
export const MAX_HISTORIAL_ANUNCIOS = 100;

import type { EntregaAudio } from './contract.js';

/** La fila muestra la llamada más reciente, aunque termine antes un anuncio anterior. */
export function ultimasEntregas(entregas: EntregaAudio[]): EntregaAudio[] {
  const porNumero = new Map<number, EntregaAudio>();
  for (const entrega of entregas) {
    if ((porNumero.get(entrega.n)?.id ?? -1) < entrega.id) porNumero.set(entrega.n, entrega);
  }
  return [...porNumero.values()];
}
