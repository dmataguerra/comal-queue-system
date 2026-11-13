import { useEffect, useState } from 'react';
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=20.7033&longitude=-100.4472&current=temperature_2m,weather_code&timezone=America%2FMexico_City';
function describe(code: number) {
  if (code === 0) return 'Despejado';
  if (code <= 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code <= 48) return 'Niebla';
  if (code <= 57) return 'Llovizna';
  if (code <= 67) return 'Lluvia';
  if (code <= 77) return 'Nieve';
  if (code <= 82) return 'Chubascos';
  return 'Tormenta';
}
export interface Weather {
  temperature: number;
  description: string;
  sunny: boolean;
}
export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const request = new AbortController();
      const cancel = () => request.abort();
      controller.signal.addEventListener('abort', cancel, { once: true });
      const timeoutId = setTimeout(cancel, 10000);
      try {
        const response = await fetch(WEATHER_URL, { signal: request.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('current' in data)) return;
        const current = data.current;
        if (!current || typeof current !== 'object') return;
        if (!('temperature_2m' in current) || typeof current.temperature_2m !== 'number') return;
        if (!('weather_code' in current) || typeof current.weather_code !== 'number') return;
        if (
          controller.signal.aborted ||
          !Number.isFinite(current.temperature_2m) ||
          !Number.isFinite(current.weather_code)
        )
          return;
        setWeather({
          temperature: Math.round(current.temperature_2m),
          description: describe(current.weather_code),
          sunny: current.weather_code <= 1,
        });
      } catch {
        /* El clima puede fallar sin interrumpir la pantalla. */
      } finally {
        clearTimeout(timeoutId);
        controller.signal.removeEventListener('abort', cancel);
      }
    };
    void load();
    const id = setInterval(() => void load(), 15 * 60000);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, []);
  return weather;
}
