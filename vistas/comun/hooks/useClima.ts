import { useEffect, useState } from 'react';

// Open-Meteo: sin API key. Coordenadas de la Facultad de Informática UAQ (Juriquilla, Qro.).
const URL_CLIMA =
  'https://api.open-meteo.com/v1/forecast?latitude=20.7033&longitude=-100.4472&current=temperature_2m,weather_code&timezone=America%2FMexico_City';

function describir(codigo: number) {
  if (codigo === 0) return 'Despejado';
  if (codigo <= 2) return 'Parcialmente nublado';
  if (codigo === 3) return 'Nublado';
  if (codigo <= 48) return 'Niebla';
  if (codigo <= 57) return 'Llovizna';
  if (codigo <= 67) return 'Lluvia';
  if (codigo <= 77) return 'Nieve';
  if (codigo <= 82) return 'Chubascos';
  return 'Tormenta';
}

export interface Clima {
  temperatura: number;
  descripcion: string;
  soleado: boolean;
}

/** Refresca cada 15 min; conserva la última lectura si la red falla. */
export function useClima() {
  const [clima, setClima] = useState<Clima | null>(null);
  useEffect(() => {
    const control = new AbortController();
    const cargar = async () => {
      const solicitud = new AbortController();
      const cancelar = () => solicitud.abort();
      control.signal.addEventListener('abort', cancelar, { once: true });
      const limite = setTimeout(cancelar, 10000);
      try {
        const respuesta = await fetch(URL_CLIMA, { signal: solicitud.signal });
        if (!respuesta.ok) return;
        const datos: unknown = await respuesta.json();
        if (!datos || typeof datos !== 'object' || !('current' in datos)) return;
        const actual = datos.current;
        if (!actual || typeof actual !== 'object') return;
        if (!('temperature_2m' in actual) || typeof actual.temperature_2m !== 'number') return;
        if (!('weather_code' in actual) || typeof actual.weather_code !== 'number') return;
        if (
          control.signal.aborted ||
          !Number.isFinite(actual.temperature_2m) ||
          !Number.isFinite(actual.weather_code)
        )
          return;
        setClima({
          temperatura: Math.round(actual.temperature_2m),
          descripcion: describir(actual.weather_code),
          soleado: actual.weather_code <= 1,
        });
      } catch {
        // El clima es opcional cuando no hay conexión.
      } finally {
        clearTimeout(limite);
        control.signal.removeEventListener('abort', cancelar);
      }
    };
    void cargar();
    const id = setInterval(() => void cargar(), 15 * 60_000);
    return () => {
      clearInterval(id);
      control.abort();
    };
  }, []);
  return clima;
}
