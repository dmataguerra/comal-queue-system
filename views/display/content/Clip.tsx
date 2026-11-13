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
  activo: active,
  volumen: volume,
  rampa: ramp,
  alTerminar: onEnded,
  alCasiTerminar: onNearEnd,
  alFallar: onFail,
  alAjustar: onAdjust,
}: ClipProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const currentVolume = useRef(volume);
  currentVolume.current = volume;
  const currentFail = useRef(onFail);
  currentFail.current = onFail;
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
    if (!active) {
      video.pause();
      return;
    }
    video.volume = currentVolume.current;
    let live = true;
    void video.play().catch(() => {
      if (live) currentFail.current();
    });
    return () => {
      live = false;
    };
  }, [active]);
  useEffect(() => {
    const video = ref.current!;
    if (!active) return;
    const since = video.volume,
      start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ramp);
      video.volume = since + (volume - since) * t;
      if (t < 1) frame = requestAnimationFrame(step);
      else onAdjust?.();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [volume, ramp, active, onAdjust]);
  return (
    // El archivo local no incluye una pista de subtítulos separada.
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      className={`content-video ${active ? 'visible' : ''}`}
      preload="auto"
      playsInline
      muted={!active}
      onEnded={active ? onEnded : undefined}
      onError={onFail}
      onTimeUpdate={
        active
          ? (e) => {
              const video = e.currentTarget;
              if (video.duration - video.currentTime < 5) onNearEnd();
            }
          : undefined
      }
    />
  );
}
