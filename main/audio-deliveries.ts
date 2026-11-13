import type { Announcement, AudioDelivery, Snapshot } from '../shared/contract.js';
import { AppError } from '../shared/errors.js';
import {
  MAX_ANNOUNCEMENTS,
  MAX_ANNOUNCEMENT_DURATION_MS,
  MAX_ANNOUNCEMENT_WAIT_MS,
  MAX_ANNOUNCEMENT_HISTORY,
} from '../shared/announcement-policy.js';
export function createAudioDeliveries(
  broadcast: (delivery: AudioDelivery) => void,
  now = Date.now,
) {
  const deliveries = new Map<number, AudioDelivery>();
  const deadlines = new Map<number, number>();
  const isActive = (e: AudioDelivery) => e.estado === 'pendiente' || e.estado === 'reproduciendo';
  function changeState(e: AudioDelivery, state: AudioDelivery['estado'], reason?: string) {
    const fresh = {
      ...e,
      estado: state,
      fecha: new Date(now()).toISOString(),
      ...(reason ? { motivo: reason } : {}),
    };
    deliveries.set(e.id, fresh);
    if (!isActive(fresh)) deadlines.delete(e.id);
    broadcast(fresh);
  }
  function expire() {
    for (const e of deliveries.values()) {
      if (isActive(e) && now() >= deadlines.get(e.id)!)
        changeState(
          e,
          'descartado',
          e.estado === 'pendiente'
            ? `Se superaron los ${MAX_ANNOUNCEMENT_WAIT_MS / 1000} segundos de espera. Vuelve a llamar el turno.`
            : `El anuncio excedió ${MAX_ANNOUNCEMENT_DURATION_MS / 1000} segundos. Revisa el audio y vuelve a llamar.`,
        );
    }
  }
  return {
    ensureCapacity: () => {
      expire();
      if ([...deliveries.values()].filter(isActive).length >= MAX_ANNOUNCEMENTS)
        throw new AppError(
          'AUDIO_QUEUE_FULL',
          `La cola de audio está llena (${MAX_ANNOUNCEMENTS} anuncios). Espera a que termine uno y vuelve a llamar. El turno no cambió.`,
        );
    },
    register(announcement: Announcement) {
      const e: AudioDelivery = {
        id: announcement.id,
        n: announcement.n,
        estado: 'pendiente',
        fecha: new Date(now()).toISOString(),
      };
      deliveries.set(e.id, e);
      deadlines.set(e.id, announcement.limiteInicio ?? now() + MAX_ANNOUNCEMENT_WAIT_MS);
      for (const [id, previous] of deliveries) {
        if (deliveries.size <= MAX_ANNOUNCEMENT_HISTORY) break;
        if (!isActive(previous)) deliveries.delete(id);
      }
      broadcast(e);
    },
    confirm: (id: number, n: number, state: Exclude<AudioDelivery['estado'], 'pendiente'>) => {
      expire();
      const e = deliveries.get(id);
      if (!e || e.n !== n || !isActive(e)) return;
      if (state === 'reproduciendo' && e.estado === 'reproduciendo') return;
      if (state === 'reproduciendo') deadlines.set(id, now() + MAX_ANNOUNCEMENT_DURATION_MS);
      changeState(
        e,
        state,
        state === 'descartado'
          ? 'El anuncio dejó de estar vigente o superó su tiempo de espera.'
          : undefined,
      );
    },
    sync(snapshot: Snapshot) {
      const visible = [snapshot.actual, ...snapshot.llamados];
      for (const e of deliveries.values()) {
        if (e.estado === 'pendiente' && !visible.includes(e.n))
          changeState(e, 'descartado', 'El turno se retiró o venció antes de iniciar el anuncio.');
      }
      expire();
    },
    /**
     * The public view that was playing went away (reload, crash). Its in-flight announcements
     * go back to pending with a fresh wait window so the next view plays them instead of
     * letting them expire as "reproduciendo".
     */
    resumeInterrupted() {
      for (const e of deliveries.values()) {
        if (e.estado !== 'reproduciendo') continue;
        deadlines.set(e.id, now() + MAX_ANNOUNCEMENT_WAIT_MS);
        changeState(e, 'pendiente', 'La pantalla pública se recargó; el anuncio se repetirá.');
      }
    },
    expire: expire,
    list: () => [...deliveries.values()],
  };
}
