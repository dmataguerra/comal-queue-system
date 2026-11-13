import type { AudioDelivery, Snapshot, Screens } from '../../../shared/contract';
import { format } from '../../../core/turns';
import { MAX_ANNOUNCEMENTS, latestDeliveries } from '../../../shared/announcement-policy';

interface Options {
  snapshot: Snapshot;
  screens: Screens;
  audioDeliveries: AudioDelivery[];
  youtubeAllowed: boolean;
}

/** Builds the list of operational warnings shown above the workspace. */
export function useOperatorNotices({
  snapshot,
  screens,
  audioDeliveries,
  youtubeAllowed,
}: Options): string[] {
  const { actual: current, llamados: calledTurns } = snapshot;
  const recent = latestDeliveries(audioDeliveries);
  const pendingAnnouncements = audioDeliveries.filter(
    (e) => e.estado === 'pendiente' || e.estado === 'reproduciendo',
  ).length;
  return [
    snapshot.persistencia?.estado === 'error' && 'No se guardaron los turnos. Revisa Diagnóstico.',
    screens.publica === 'ninguna' && 'TV desconectada. Revisa la conexión.',
    pendingAnnouncements >= MAX_ANNOUNCEMENTS - 1 &&
      `Audio: ${pendingAnnouncements}/${MAX_ANNOUNCEMENTS} en espera. Espera antes de llamar.`,
    recent.some((e) => e.estado === 'fallo' && [current, ...calledTurns].includes(e.n)) &&
      'Audio fallido. Revisa los turnos marcados.',
    recent.some((e) => e.estado === 'descartado' && [current, ...calledTurns].includes(e.n)) &&
      'Anuncios descartados. Revisa los turnos marcados.',
    snapshot.advertenciaRecuperacion,
    !youtubeAllowed && 'YouTube no está admitido en navegador. Usa contenido local.',
    current !== null &&
      calledTurns.length === 5 &&
      `Seis turnos visibles. El siguiente retira el más antiguo (${format(calledTurns[4])}). Vencen en 5 min.`,
  ].filter((notice): notice is string => Boolean(notice));
}
