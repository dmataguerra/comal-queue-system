import { useEffect, useState, type FormEvent } from 'react';
import { parseYouTube } from '../../nucleo/youtube';
import { useTurnero } from '../comun/turnero';
import { Icon } from '../comun/components/Icon';

const CLAVE_RECIENTES = 'comal.youtube.recientes';
const MAX_RECIENTES = 3;

function leerRecientes(): string[] {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
    return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECIENTES) : [];
  } catch {
    return [];
  }
}

export function YouTubePanel({
  notificar,
}: {
  notificar: (mensaje: string, error?: boolean) => void;
}) {
  const { config, configurarYouTube } = useTurnero();
  const [url, setUrl] = useState(config.youtubeUrl ?? '');
  const [recientes, setRecientes] = useState<string[]>(leerRecientes);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    setUrl(config.youtubeUrl ?? '');
  }, [config.youtubeUrl]);

  async function guardar(valor: string | null) {
    setOcupado(true);
    try {
      if (valor) parseYouTube(valor);
      await configurarYouTube(valor);
      if (valor) {
        const nuevos = [valor, ...recientes.filter((reciente) => reciente !== valor)].slice(0, MAX_RECIENTES);
        setRecientes(nuevos);
        try {
          localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(nuevos));
        } catch {
          // La selección de YouTube sigue siendo válida aunque el navegador no permita guardar preferencias.
        }
      }
      notificar(
        valor
          ? 'YouTube seleccionado para la pantalla 2.'
          : 'Contenido local seleccionado para la pantalla 2.',
      );
    } catch (error) {
      notificar((error as Error).message, true);
    } finally {
      setOcupado(false);
    }
  }
  function reproducir(event: FormEvent) {
    event.preventDefault();
    void guardar(url.trim());
  }

  return (
    <section className="panel media-library-panel">
      <div className="media-library-heading">
        <span className="section-icon">
          <Icon name="play" />
        </span>
        <div>
          <h2>YouTube</h2>
          <p>Requiere internet.</p>
        </div>
      </div>
      <form onSubmit={reproducir} className="youtube-form">
        <label htmlFor="youtube-url">Enlace de YouTube</label>
        <input
          id="youtube-url"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
        {recientes.length > 0 && (
          <div className="youtube-recent-links">
            <span>Enlaces recientes</span>
            <div>
              {recientes.map((reciente) => (
                <button
                  key={reciente}
                  type="button"
                  className="recent-link"
                  title={reciente}
                  onClick={() => setUrl(reciente)}
                  disabled={ocupado}
                >
                  <Icon name="clock" />
                  <span>{reciente}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="media-actions">
          <button className="button primary" disabled={ocupado}>
            <Icon name="play" />
            Reproducir YouTube
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={ocupado || !config.youtubeUrl}
            onClick={() => void guardar(null)}
          >
            <Icon name="folder" />
            Usar contenido local
          </button>
        </div>
      </form>
    </section>
  );
}
