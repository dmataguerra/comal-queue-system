import { useEffect, useRef, useState } from 'react';
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
  const { config, inventario, suscribirAnuncio, registrar, informarSalud } = useTurnero();
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null),
    [atenuado, setAtenuado] = useState(false);
  const ultimos = useRef({ config, inventario });
  ultimos.current = { config, inventario };
  const vozFaltante = useRef(new Set<number>());

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
        setAnuncio(nuevo);
        setAtenuado(true);
        // CU-06 2a · la configuración se toma al inicio: un cambio aplica en el siguiente llamado.
        const {
          config: { repeticiones, volumenVoz },
          inventario: { aviso, voz },
        } = ultimos.current;
        const inicio = performance.now();
        try {
          if (aviso) await reproducir(aviso, volumenVoz, signal);
          const url = voz[nuevo.n];
          if (!url) {
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
            informarSalud('audio', 'degradado');
            registrar(`Audio: ${(error as Error).message}`);
          }
        }
        if (signal.aborted) return;
        setAtenuado(false);
        await pausa(Math.max(0, TARJETA_MINIMA - (performance.now() - inicio)), signal);
        if (!signal.aborted) setAnuncio(null);
      },
      (error) => {
        registrar(`Audio: ${String(error)}`);
      },
    );
    const quitar = suscribirAnuncio((nuevo) => cola.agregar(nuevo));
    return () => {
      quitar();
      cola.detener();
      cerrarAudio();
    };
  }, [suscribirAnuncio, registrar, informarSalud]);
  return { anuncio, atenuado };
}
