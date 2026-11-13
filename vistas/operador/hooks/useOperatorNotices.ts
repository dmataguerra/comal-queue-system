import type { EntregaAudio, Instantanea, Pantallas } from '../../../shared/contract';
import { formatear } from '../../../nucleo/turnos';
import { MAX_ANUNCIOS, ultimasEntregas } from '../../../shared/politica-anuncios';

interface Options {
  snapshot: Instantanea;
  screens: Pantallas;
  audioDeliveries: EntregaAudio[];
  youtubeAllowed: boolean;
}

/** Builds the list of operational warnings shown above the workspace. */
export function useOperatorNotices({
  snapshot,
  screens,
  audioDeliveries,
  youtubeAllowed,
}: Options): string[] {
  const { actual, llamados } = snapshot;
  const recent = ultimasEntregas(audioDeliveries);
  const pendingAnnouncements = audioDeliveries.filter(
    (e) => e.estado === 'pendiente' || e.estado === 'reproduciendo',
  ).length;
  return [
    snapshot.persistencia?.estado === 'error' && 'No se guardaron los turnos. Revisa Diagnóstico.',
    screens.publica === 'ninguna' && 'TV desconectada. Revisa la conexión.',
    pendingAnnouncements >= MAX_ANUNCIOS - 1 &&
      `Audio: ${pendingAnnouncements}/${MAX_ANUNCIOS} en espera. Espera antes de llamar.`,
    recent.some((e) => e.estado === 'fallo' && [actual, ...llamados].includes(e.n)) &&
      'Audio fallido. Revisa los turnos marcados.',
    recent.some((e) => e.estado === 'descartado' && [actual, ...llamados].includes(e.n)) &&
      'Anuncios descartados. Revisa los turnos marcados.',
    snapshot.advertenciaRecuperacion,
    !youtubeAllowed && 'YouTube no está admitido en navegador. Usa contenido local.',
    actual !== null &&
      llamados.length === 5 &&
      `Seis turnos visibles. El siguiente retira el más antiguo (${formatear(llamados[4])}). Vencen en 5 min.`,
  ].filter((aviso): aviso is string => Boolean(aviso));
}
