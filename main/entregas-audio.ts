import type { Anuncio, EntregaAudio, Instantanea } from '../shared/contract.js';
import {
  MAX_ANUNCIOS,
  MAX_DURACION_ANUNCIO_MS,
  MAX_ESPERA_ANUNCIO_MS,
  MAX_HISTORIAL_ANUNCIOS,
} from '../shared/politica-anuncios.js';

/** Estado por evento: repetir un número nunca reemplaza el acuse de otro anuncio. */
export function crearEntregasAudio(difundir: (entrega: EntregaAudio) => void, ahora = Date.now) {
  const entregas = new Map<number, EntregaAudio>();
  const limites = new Map<number, number>();
  const activa = (e: EntregaAudio) => e.estado === 'pendiente' || e.estado === 'reproduciendo';
  function cambiar(e: EntregaAudio, estado: EntregaAudio['estado'], motivo?: string) {
    const nueva = {
      ...e,
      estado,
      fecha: new Date(ahora()).toISOString(),
      ...(motivo ? { motivo } : {}),
    };
    entregas.set(e.id, nueva);
    if (!activa(nueva)) limites.delete(e.id);
    difundir(nueva);
  }
  function vencer() {
    for (const e of entregas.values()) {
      if (activa(e) && ahora() >= limites.get(e.id)!)
        cambiar(
          e,
          'descartado',
          e.estado === 'pendiente'
            ? 'Se superaron los 45 segundos de espera. Vuelve a llamar el turno.'
            : 'El anuncio excedió 30 segundos. Revisa el audio y vuelve a llamar.',
        );
    }
  }
  return {
    comprobarCapacidad: () => {
      vencer();
      if ([...entregas.values()].filter(activa).length >= MAX_ANUNCIOS)
        throw new Error(
          'La cola de audio está llena (6 anuncios). Espera a que termine uno y vuelve a llamar. El turno no cambió.',
        );
    },
    registrar(anuncio: Anuncio) {
      const e: EntregaAudio = {
        id: anuncio.id,
        n: anuncio.n,
        estado: 'pendiente',
        fecha: new Date(ahora()).toISOString(),
      };
      entregas.set(e.id, e);
      limites.set(e.id, anuncio.limiteInicio ?? ahora() + MAX_ESPERA_ANUNCIO_MS);
      for (const [id, anterior] of entregas) {
        if (entregas.size <= MAX_HISTORIAL_ANUNCIOS) break;
        if (!activa(anterior)) entregas.delete(id);
      }
      difundir(e);
    },
    confirmar: (id: number, n: number, estado: Exclude<EntregaAudio['estado'], 'pendiente'>) => {
      vencer();
      const e = entregas.get(id);
      if (!e || e.n !== n || !activa(e)) return;
      if (estado === 'reproduciendo' && e.estado === 'reproduciendo') return;
      if (estado === 'reproduciendo') limites.set(id, ahora() + MAX_DURACION_ANUNCIO_MS);
      cambiar(
        e,
        estado,
        estado === 'descartado'
          ? 'El anuncio dejó de estar vigente o superó su tiempo de espera.'
          : undefined,
      );
    },
    sincronizar(instantanea: Instantanea) {
      const visibles = [instantanea.actual, ...instantanea.llamados];
      for (const e of entregas.values()) {
        if (e.estado === 'pendiente' && !visibles.includes(e.n))
          cambiar(e, 'descartado', 'El turno se retiró o venció antes de iniciar el anuncio.');
      }
      vencer();
    },
    vencer,
    obtener: () => [...entregas.values()],
  };
}
