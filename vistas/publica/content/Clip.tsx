import { useEffect, useRef } from 'react';

interface ClipProps {
  alAjustar?: () => void;
  url: string;
  activo: boolean;
  volumen: number;
  rampa: number;
  alTerminar: () => void;
  alCasiTerminar: () => void;
  alFallar: () => void;
}

export function Clip({
  url,
  activo,
  volumen,
  rampa,
  alTerminar,
  alCasiTerminar,
  alFallar,
  alAjustar,
}: ClipProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const volumenActual = useRef(volumen);
  volumenActual.current = volumen;
  const falloActual = useRef(alFallar);
  falloActual.current = alFallar;
  useEffect(() => {
    const video = ref.current!;
    video.src = url;
    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url]);
  useEffect(() => {
    const video = ref.current!;
    if (!activo) {
      video.pause();
      return;
    }
    video.volume = volumenActual.current;
    let vigente = true;
    void video.play().catch(() => {
      if (vigente) falloActual.current();
    });
    return () => {
      vigente = false;
    };
  }, [activo]);
  useEffect(() => {
    const video = ref.current!;
    if (!activo) return;
    const desde = video.volume,
      inicio = performance.now();
    let cuadro = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / rampa);
      video.volume = desde + (volumen - desde) * t;
      if (t < 1) cuadro = requestAnimationFrame(paso);
      else alAjustar?.();
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [volumen, rampa, activo, alAjustar]);
  return (
    // El archivo local no incluye una pista de subtítulos separada.
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      className={`content-video ${activo ? 'visible' : ''}`}
      preload="auto"
      playsInline
      muted={!activo}
      onEnded={activo ? alTerminar : undefined}
      onError={alFallar}
      onTimeUpdate={
        activo
          ? (e) => {
              const video = e.currentTarget;
              if (video.duration - video.currentTime < 5) alCasiTerminar();
            }
          : undefined
      }
    />
  );
}
