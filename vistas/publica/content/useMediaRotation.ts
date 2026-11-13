import { useCallback, useEffect, useRef, useState } from 'react';
import { shuffle } from './playlist';

export interface Pieza {
  id: number;
  url: string;
}

/**
 * Shuffled-bag video rotation. Keeps the current piece plus an optional preloaded next one.
 */
export function useMediaRotation(videos: string[]) {
  const bolsa = useRef<string[]>([]),
    contador = useRef(0);
  const tomar = useCallback(
    (anterior?: string) => {
      bolsa.current = bolsa.current.filter((url) => videos.includes(url));
      if (!bolsa.current.length) bolsa.current = shuffle(videos, anterior);
      return { id: ++contador.current, url: bolsa.current.shift()! };
    },
    [videos],
  );
  const [piezas, setPiezas] = useState<Pieza[]>(() => [tomar()]);
  useEffect(() => {
    setPiezas((actuales) => {
      const vigentes = actuales.filter((pieza) => videos.includes(pieza.url));
      if (!vigentes.length) return [tomar()];
      return vigentes.length === actuales.length ? actuales : vigentes;
    });
  }, [videos, piezas.length, tomar]);
  const avanzar = () => setPiezas(([actual, siguiente]) => [siguiente ?? tomar(actual?.url)]);
  const precargarSiguiente = () =>
    setPiezas((actuales) =>
      actuales.length > 1 ? actuales : [...actuales, tomar(actuales[0]?.url)],
    );
  const quitar = (id: number) => setPiezas((actuales) => actuales.filter((p) => p.id !== id));
  return { piezas, avanzar, precargarSiguiente, quitar };
}
