import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from '../../core/turns';
import { createQueue } from '../../core/playback-queue';
import type { Announcement } from '../../shared/contract';
import { errorMessageOf } from '../../shared/errors';
import { useQueue } from '../common/queue-context';
import { closeAudio, pause, preload, play } from './audio';
const REPEAT_PAUSE = 300;
const MIN_CARD = 6000;
export function useAnnouncements() {
  const {
    config,
    inventario: inventory,
    suscribirAnuncio: subscribeAnnouncement,
    suscribirEntregaAudio: subscribeAudioDelivery,
    registrar: log,
    informarSalud: reportHealth,
    confirmarAnuncio: confirmAnnouncement,
  } = useQueue();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null),
    [ducked, setDucked] = useState(false);
  const last = useRef({ config, inventario: inventory });
  last.current = { config, inventario: inventory };
  const missingVoice = useRef(new Set<number>());
  const duckingReady = useRef<{
    id: number;
    resolver: () => void;
  } | null>(null);
  const confirmDucking = useCallback(() => {
    if (duckingReady.current?.id === announcement?.id) duckingReady.current?.resolver();
  }, [announcement?.id]);
  useEffect(() => {
    // A newer inventory can arrive before this preload settles; only the latest may report.
    let live = true;
    preload(inventory)
      .then(() => {
        if (!live) return;
        reportHealth(
          'audio',
          inventory.voz.every(Boolean) && Boolean(inventory.aviso) ? 'correcto' : 'degradado',
        );
      })
      .catch((error: Error) => {
        if (!live) return;
        reportHealth('audio', 'degradado');
        log(`Audio: ${error.message}`, 'error');
      });
    return () => {
      live = false;
    };
  }, [inventory, log, reportHealth]);
  useEffect(() => {
    const queue = createQueue<Announcement>(
      async (next, signal) => {
        const cleanup = () => {
          setDucked(false);
          setAnnouncement(null);
        };
        signal.addEventListener('abort', cleanup, { once: true });
        setAnnouncement(next);
        let timer: ReturnType<typeof setTimeout>;
        let cancelWait: () => void = () => {};
        const awaitDucking = new Promise<void>((resolve, reject) => {
          duckingReady.current = { id: next.id, resolver: resolve };
          cancelWait = () => resolve();
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  'La multimedia no confirmó la atenuación. No se reproduce la voz sobre el volumen normal.',
                ),
              ),
            8000,
          );
          signal.addEventListener('abort', cancelWait, { once: true });
        });
        setDucked(true);
        const {
          config: { repeticiones: repeats, volumenVoz: voiceVolume },
          inventario: { aviso: chime, voz: voice },
        } = last.current;
        const start = performance.now();
        let fullAudio = true;
        try {
          await awaitDucking;
          clearTimeout(timer!);
          if (signal.aborted) return;
          if (next.limiteInicio !== undefined && Date.now() >= next.limiteInicio) {
            confirmAnnouncement(next.id, next.n, 'descartado');
            cleanup();
            return;
          }
          confirmAnnouncement(next.id, next.n, 'reproduciendo');
          if (voiceVolume <= 0)
            throw new Error('La voz está silenciada. Sube el volumen y vuelve a llamar.');
          if (chime) await play(chime, voiceVolume, signal);
          else {
            fullAudio = false;
            reportHealth('audio', 'degradado');
            log('Falta el aviso de audio; el anuncio no está completo.');
          }
          const url = voice[next.n];
          if (!url) {
            fullAudio = false;
            reportHealth('audio', 'degradado');
            if (!missingVoice.current.has(next.n)) {
              missingVoice.current.add(next.n);
              log(`Falta la voz del turno ${format(next.n)}; solo suena el aviso.`);
            }
          } else
            for (let pass = 0; pass < repeats && !signal.aborted; pass++) {
              if (pass > 0) await pause(REPEAT_PAUSE, signal);
              await play(url, voiceVolume, signal);
            }
        } catch (error) {
          if (!signal.aborted) {
            fullAudio = false;
            reportHealth('audio', 'degradado');
            log(`Audio: ${(error as Error).message}`, 'error');
          }
        } finally {
          clearTimeout(timer!);
          signal.removeEventListener('abort', cancelWait);
          duckingReady.current = null;
        }
        if (signal.aborted) return;
        setDucked(false);
        await pause(Math.max(0, MIN_CARD - (performance.now() - start)), signal);
        if (!signal.aborted) {
          confirmAnnouncement(next.id, next.n, fullAudio ? 'reproducido' : 'fallo');
          setAnnouncement(null);
        }
        signal.removeEventListener('abort', cleanup);
      },
      (error) => {
        log(`Audio: ${errorMessageOf(error)}`, 'error');
      },
      {
        vigente: (next) => next.limiteInicio === undefined || Date.now() < next.limiteInicio,
        alDescartar: (next) => confirmAnnouncement(next.id, next.n, 'descartado'),
      },
    );
    const remove = subscribeAnnouncement((next) => queue.agregar(next));
    const removeAcks = subscribeAudioDelivery((delivery) => {
      if (delivery.estado === 'descartado') queue.descartar((next) => next.id === delivery.id);
    });
    return () => {
      remove();
      removeAcks();
      queue.detener();
      closeAudio();
    };
  }, [subscribeAnnouncement, subscribeAudioDelivery, log, reportHealth, confirmAnnouncement]);
  return { anuncio: announcement, atenuado: ducked, confirmarAtenuacion: confirmDucking };
}
