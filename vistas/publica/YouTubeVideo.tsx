import { useEffect, useRef, useState } from 'react';
import { parseYouTube } from '../../nucleo/youtube';
import { useTurnero } from '../comun/turnero';
import { cargarYouTube, type YouTubePlayer } from './youtubeApi';

// Se reaplica el volumen: el iframe tarda en aparecer y cada video nuevo de la playlist lo reinicia.
const REAPLICAR_MS = 2000;

export function YouTubeVideo({
  url,
  volumen,
  rampa,
}: {
  url: string;
  volumen: number;
  rampa: number;
}) {
  const { ajustarVolumenYouTube, registrar } = useTurnero();
  const host = useRef<HTMLDivElement>(null);
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
        // Sin `origin`: YouTube no acepta turnero://. El volumen se ajusta desde main (RF-11).
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
            ...(fuente.playlistId
              ? { listType: 'playlist', list: fuente.playlistId }
              : { playlist: fuente.videoId! }),
          },
          events: {
            onReady: ({ target }) => {
              if (cerrado) return;
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
    const nodoHost = host.current;
    return () => {
      cerrado = true;
      instancia?.destroy();
      // Si la API nunca enlazó, destroy() no quita el iframe y seguiría sonando.
      nodoHost?.replaceChildren();
    };
  }, [url, intento]);

  useEffect(() => {
    const aplicar = (ms: number) =>
      ajustarVolumenYouTube(volumenActual.current, ms).catch((e: Error) =>
        registrar(`No se pudo ajustar el volumen de YouTube: ${e.message}`),
      );
    void aplicar(rampa);
    const id = setInterval(() => void aplicar(0), REAPLICAR_MS);
    return () => clearInterval(id);
  }, [volumen, rampa, url, intento, ajustarVolumenYouTube, registrar]);

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
