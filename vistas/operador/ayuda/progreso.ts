import { recorridos, type RecorridoId } from './contenido';

export const CLAVE_PROGRESO = 'comal.ayuda.progreso.v1';
const VERSION = '0.4.0-1';
export function leerProgreso(): RecorridoId[] {
  try {
    const dato: unknown = JSON.parse(localStorage.getItem(CLAVE_PROGRESO) ?? 'null');
    if (
      !dato ||
      typeof dato !== 'object' ||
      !('version' in dato) ||
      dato.version !== VERSION ||
      !('completados' in dato) ||
      !Array.isArray(dato.completados)
    )
      return [];
    return [
      ...new Set(
        dato.completados.filter(
          (id): id is RecorridoId => typeof id === 'string' && Object.hasOwn(recorridos, id),
        ),
      ),
    ];
  } catch {
    return [];
  }
}
export function guardarCompletado(id: RecorridoId, actuales: RecorridoId[] = []): RecorridoId[] {
  const completados = [...new Set([...actuales, ...leerProgreso(), id])];
  try {
    localStorage.setItem(CLAVE_PROGRESO, JSON.stringify({ version: VERSION, completados }));
  } catch {
    /* La ayuda sigue disponible sin almacenamiento. */
  }
  return completados;
}
