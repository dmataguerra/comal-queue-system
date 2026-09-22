import { useEffect, useRef, useState } from 'react';
import { parseYouTube } from '../../nucleo/youtube';
import { cargarYouTube, type YouTubePlayer } from './youtubeApi';

export function YouTubeVideo({ url, volumen }: { url: string; volumen: number }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const volumenActual = useRef(volumen);
  volumenActual.current = volumen;
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cerrado = false;
    let instancia: YouTubePlayer | null = null;
    setError('');
    async function iniciar() {
      try {
        const fuente = parseYouTube(url);
        const api = await cargarYouTube();
        if (cerrado || !host.current) return;
        const nodo = document.createElement('div');
        host.current.replaceChildren(nodo);
        instancia = new api.Player(nodo, {
          width: '100%',
          height: '100%',
          videoId: fuente.videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            playsinline: 1,
            loop: 1,
            rel: 0,
            origin: window.location.origin,
            ...(fuente.playlistId
              ? { listType: 'playlist', list: fuente.playlistId }
              : { playlist: fuente.videoId! }),
          },
          events: {
            onReady: ({ target }) => {
              if (cerrado) return;
              player.current = target;
              target.setVolume(volumenActual.current * 100);
              target.unMute();
              target.setLoop(true);
              target.playVideo();
            },
            onError: ({ data }) => {
              if (!cerrado)
                setError(
                  `YouTube no puede reproducir este contenido (${data}). Prueba otro enlace desde Multimedia.`,
                );
            },
            onAutoplayBlocked: () => {
              if (!cerrado) setError('Pulsa reproducir en el video para iniciar YouTube.');
            },
          },
        });
      } catch (e) {
        if (!cerrado) setError((e as Error).message);
      }
    }
    void iniciar();
    return () => {
      cerrado = true;
      instancia?.destroy();
      player.current = null;
    };
  }, [url, intento]);

  useEffect(() => {
    player.current?.setVolume(volumen * 100);
  }, [volumen]);

  return (
    <div className="youtube-stage">
      <div ref={host} className="youtube-host" aria-label="Video de YouTube" />
      {error && (
        <div className="youtube-error" role="status">
          <span>{error}</span>
          <button className="button secondary" onClick={() => setIntento((i) => i + 1)}>
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
