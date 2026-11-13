import { useEffect, useRef, useState } from 'react';
import { parseYouTube } from '../../core/youtube';
import { useQueue } from '../common/queue-context';
import { loadYouTube, startYouTube, type YouTubePlayer } from './youtubeApi';
const REAPPLY_MS = 2000;
export function YouTubeVideo({
  url,
  volumen: volume,
  rampa: ramp,
  alFallar: onFail,
  alAjustar: onAdjust,
}: {
  url: string;
  volumen: number;
  rampa: number;
  alFallar: () => void;
  alAjustar?: () => void;
}) {
  const {
    ajustarVolumenYouTube: adjustYouTubeVolume,
    registrar: log,
    informarSalud: reportHealth,
  } = useQueue();
  const host = useRef<HTMLDivElement>(null);
  const currentVolume = useRef(volume);
  currentVolume.current = volume;
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let closed = false;
    let confirmedVolume = false;
    let instance: YouTubePlayer | null = null;
    const timeout = setTimeout(() => {
      if (!closed) {
        reportHealth('youtube', 'degradado');
        onFail();
      }
    }, 20000);
    setError('');
    setReady(false);
    async function start() {
      try {
        const source = parseYouTube(url);
        const api = await loadYouTube();
        if (closed || !host.current) return;
        const node = document.createElement('div');
        host.current.replaceChildren(node);
        instance = new api.Player(node, {
          width: '100%',
          height: '100%',
          videoId: source.videoId,
          playerVars: {
            autoplay: 0,
            mute: 1,
            controls: 1,
            playsinline: 1,
            loop: 1,
            rel: 0,
            ...(source.playlistId
              ? { listType: 'playlist', list: source.playlistId }
              : { playlist: source.videoId! }),
          },
          events: {
            onReady: ({ target }) => {
              if (closed) return;
              void startYouTube(
                target,
                () => currentVolume.current,
                adjustYouTubeVolume,
                () => !closed,
              )
                .then((iniciado) => {
                  if (closed || !iniciado) return;
                  setReady(true);
                  confirmedVolume = true;
                })
                .catch((e: Error) => {
                  if (!closed) {
                    log(e.message);
                    reportHealth('youtube', 'degradado');
                    onFail();
                  }
                });
            },
            onStateChange: ({ data }) => {
              if (!closed && confirmedVolume && data === 1) {
                clearTimeout(timeout);
                reportHealth('youtube', 'correcto');
              }
            },
            onError: ({ data }) => {
              if (!closed) {
                clearTimeout(timeout);
                reportHealth('youtube', 'degradado');
                onFail();
                setError(
                  `YouTube no puede reproducir este contenido (${data}). Prueba otro enlace desde Multimedia.`,
                );
              }
            },
            onAutoplayBlocked: () => {
              if (!closed) {
                reportHealth('youtube', 'degradado');
                onFail();
              }
            },
          },
        });
      } catch (e) {
        if (!closed) {
          reportHealth('youtube', 'degradado');
          onFail();
          setError((e as Error).message);
        }
      }
    }
    void start();
    const hostNode = host.current;
    return () => {
      closed = true;
      clearTimeout(timeout);
      instance?.destroy();
      hostNode?.replaceChildren();
    };
  }, [url, attempt, onFail, reportHealth, adjustYouTubeVolume, log]);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    let id: ReturnType<typeof setTimeout> | undefined;
    const apply = async (ms: number) => {
      try {
        const videos = await adjustYouTubeVolume(currentVolume.current, ms);
        if (live && videos < 1) throw new Error('YouTube dejó de confirmar el volumen.');
        if (live && videos > 0) onAdjust?.();
      } catch (e) {
        if (live) {
          log(`No se pudo ajustar el volumen de YouTube: ${(e as Error).message}`);
          reportHealth('youtube', 'degradado');
          onFail();
        }
      } finally {
        if (live) id = setTimeout(() => void apply(0), REAPPLY_MS);
      }
    };
    void apply(ramp);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [volume, ramp, url, attempt, adjustYouTubeVolume, log, onAdjust, reportHealth, onFail, ready]);
  return (
    <div className="youtube-stage">
      <div ref={host} className="youtube-host" aria-label="Video de YouTube" />
      {error && (
        <div className="youtube-error" role="status">
          <span>{error}</span>
          <button className="button secondary" onClick={() => setAttempt((i) => i + 1)}>
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
