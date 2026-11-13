import { tours, type TourId } from './content';
export const PROGRESS_KEY = 'comal.ayuda.progreso.v1';
const VERSION = '0.4.0-1';
export function readProgress(): TourId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null');
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('version' in raw) ||
      raw.version !== VERSION ||
      !('completados' in raw) ||
      !Array.isArray(raw.completados)
    )
      return [];
    return [
      ...new Set(
        raw.completados.filter(
          (id): id is TourId => typeof id === 'string' && Object.hasOwn(tours, id),
        ),
      ),
    ];
  } catch {
    return [];
  }
}
export function saveCompleted(id: TourId, current: TourId[] = []): TourId[] {
  const completed = [...new Set([...current, ...readProgress(), id])];
  try {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: VERSION, completados: completed }),
    );
  } catch {
    /* Help keeps working even if progress cannot be saved. */
  }
  return completed;
}
