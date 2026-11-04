export const MAX_ANUNCIOS = 6;
export const MAX_ESPERA_ANUNCIO_MS = 45000;
export const MAX_DURACION_ANUNCIO_MS = 30000;
export const MAX_HISTORIAL_ANUNCIOS = 100;
import type { EntregaAudio } from './contract.js';
export function ultimasEntregas(entregas: EntregaAudio[]): EntregaAudio[] {
  const porNumero = new Map<number, EntregaAudio>();
  for (const entrega of entregas) {
    if ((porNumero.get(entrega.n)?.id ?? -1) < entrega.id) porNumero.set(entrega.n, entrega);
  }
  return [...porNumero.values()];
}
