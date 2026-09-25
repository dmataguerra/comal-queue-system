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

/** Clima actual, refrescado cada 15 min. Sin red queda en null y no se muestra. */
export function useClima() {
  const [clima, setClima] = useState<Clima | null>(null);
  useEffect(() => {
    const cargar = () =>
      fetch(URL_CLIMA)
        .then((r) => r.json())
        .then(({ current }) =>
          setClima({
            temperatura: Math.round(current.temperature_2m),
            descripcion: describir(current.weather_code),
            soleado: current.weather_code <= 1,
          }),
        )
        .catch(() => {});
    void cargar();
    const id = setInterval(cargar, 15 * 60_000);
    return () => clearInterval(id);
  }, []);
  return clima;
}
