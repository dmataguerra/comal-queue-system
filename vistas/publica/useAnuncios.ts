import { useCallback, useEffect, useRef, useState } from 'react';
import { formatear } from '../../nucleo/turnos';
import { crearCola } from '../../nucleo/cola';
import type { Anuncio } from '../../shared/contract';
import { useTurnero } from '../comun/turnero';
import { cerrarAudio, pausa, precargar, reproducir } from './audio';

const PAUSA_REPETICION = 300;
const TARJETA_MINIMA = 6000; // Mantener visible seis segundos, o hasta terminar la voz.

/**
 * RF-03 y RF-11 · atenuar música → aviso → voz → [pausa → voz] → restaurar.
 * Los llamados se encolan en orden de llegada y terminan antes de iniciar el siguiente.
 * Al montar o recargar no se repite ningún anuncio viejo: solo reacciona a eventos nuevos.
 */
export function useAnuncios() {
  const {
    config,
    inventario,
    suscribirAnuncio,
    suscribirEntregaAudio,
    registrar,
    informarSalud,
    confirmarAnuncio,
  } = useTurnero();
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null),
    [atenuado, setAtenuado] = useState(false);
  const ultimos = useRef({ config, inventario });
  ultimos.current = { config, inventario };
  const vozFaltante = useRef(new Set<number>());
  const atenuacionLista = useRef<{ id: number; resolver: () => void } | null>(null);
  const confirmarAtenuacion = useCallback(() => {
    if (atenuacionLista.current?.id === anuncio?.id) atenuacionLista.current?.resolver();
  }, [anuncio?.id]);

  useEffect(() => {
    precargar(inventario)
      .then(() => {
        informarSalud(
          'audio',
          inventario.voz.every(Boolean) && Boolean(inventario.aviso) ? 'correcto' : 'degradado',
        );
      })
      .catch((error: Error) => {
        informarSalud('audio', 'degradado');
        registrar(`Audio: ${error.message}`);
      });
  }, [inventario, registrar, informarSalud]);

  useEffect(() => {
    const cola = crearCola<Anuncio>(
      async (nuevo, signal) => {
        const limpiar = () => {
          setAtenuado(false);
          setAnuncio(null);
        };
        signal.addEventListener('abort', limpiar, { once: true });
        setAnuncio(nuevo);
        let temporizador: ReturnType<typeof setTimeout>;
        let cancelarEspera: () => void = () => {};
        const esperarAtenuacion = new Promise<void>((resolve, reject) => {
          atenuacionLista.current = { id: nuevo.id, resolver: resolve };
          cancelarEspera = () => resolve();
          temporizador = setTimeout(
            () =>
              reject(
                new Error(
                  'La multimedia no confirmó la atenuación. No se reproduce la voz sobre el volumen normal.',
                ),
              ),
            8000,
          );
          signal.addEventListener('abort', cancelarEspera, { once: true });
        });
        setAtenuado(true);
        // CU-06 2a · la configuración se toma al inicio: un cambio aplica en el siguiente llamado.
        const {
          config: { repeticiones, volumenVoz },
          inventario: { aviso, voz },
        } = ultimos.current;
        const inicio = performance.now();
        let audioCompleto = true;
        try {
          await esperarAtenuacion;
          clearTimeout(temporizador!);
          if (signal.aborted) return;
          if (nuevo.limiteInicio !== undefined && Date.now() >= nuevo.limiteInicio) {
            confirmarAnuncio(nuevo.id, nuevo.n, 'descartado');
            limpiar();
            return;
          }
          confirmarAnuncio(nuevo.id, nuevo.n, 'reproduciendo');
          if (volumenVoz <= 0)
            throw new Error('La voz está silenciada. Sube el volumen y vuelve a llamar.');
          if (aviso) await reproducir(aviso, volumenVoz, signal);
          else {
            audioCompleto = false;
            informarSalud('audio', 'degradado');
            registrar('Falta el aviso de audio; el anuncio no está completo.');
          }
          const url = voz[nuevo.n];
          if (!url) {
            audioCompleto = false;
            informarSalud('audio', 'degradado');
            if (!vozFaltante.current.has(nuevo.n)) {
              vozFaltante.current.add(nuevo.n);
              registrar(`Falta la voz del turno ${formatear(nuevo.n)}; solo suena el aviso.`);
            }
          } else
            for (let vez = 0; vez < repeticiones && !signal.aborted; vez++) {
              if (vez > 0) await pausa(PAUSA_REPETICION, signal);
              await reproducir(url, volumenVoz, signal);
            }
        } catch (error) {
          if (!signal.aborted) {
            audioCompleto = false;
            informarSalud('audio', 'degradado');
            registrar(`Audio: ${(error as Error).message}`);
          }
        } finally {
          clearTimeout(temporizador!);
          signal.removeEventListener('abort', cancelarEspera);
          atenuacionLista.current = null;
        }
        if (signal.aborted) return;
        setAtenuado(false);
        await pausa(Math.max(0, TARJETA_MINIMA - (performance.now() - inicio)), signal);
        if (!signal.aborted) {
          confirmarAnuncio(nuevo.id, nuevo.n, audioCompleto ? 'reproducido' : 'fallo');
          setAnuncio(null);
        }
        signal.removeEventListener('abort', limpiar);
      },
      (error) => {
        registrar(`Audio: ${String(error)}`);
      },
      {
        vigente: (nuevo) => nuevo.limiteInicio === undefined || Date.now() < nuevo.limiteInicio,
        alDescartar: (nuevo) => confirmarAnuncio(nuevo.id, nuevo.n, 'descartado'),
      },
    );
    const quitar = suscribirAnuncio((nuevo) => cola.agregar(nuevo));
    const quitarAcuses = suscribirEntregaAudio((entrega) => {
      if (entrega.estado === 'descartado') cola.descartar((nuevo) => nuevo.id === entrega.id);
    });
    return () => {
      quitar();
      quitarAcuses();
      cola.detener();
      cerrarAudio();
    };
  }, [suscribirAnuncio, suscribirEntregaAudio, registrar, informarSalud, confirmarAnuncio]);
  return { anuncio, atenuado, confirmarAtenuacion };
}
