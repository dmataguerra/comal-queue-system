import { useEffect, useState, type FormEvent } from 'react';
import { parseYouTube } from '../../core/youtube';
import { useQueue } from '../common/queue-context';
import { Icon } from '../common/components/Icon';
const RECENT_KEY = 'comal.youtube.recientes';
const MAX_RECENT = 3;
function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}
export function YouTubePanel({
  notificar: notify,
}: {
  notificar: (message: string, error?: boolean) => void;
}) {
  const { config, configurarYouTube: configureYouTube } = useQueue();
  const [url, setUrl] = useState(config.youtubeUrl ?? '');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setUrl(config.youtubeUrl ?? '');
  }, [config.youtubeUrl]);
  async function save(value: string | null) {
    setBusy(true);
    try {
      if (value) parseYouTube(value);
      await configureYouTube(value);
      if (value) {
        const updated = [value, ...recent.filter((recentItem) => recentItem !== value)].slice(
          0,
          MAX_RECENT,
        );
        setRecent(updated);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
        } catch {
          /* The operation continues even if the transport cannot be notified. */
        }
      }
      notify(
        value
          ? 'YouTube seleccionado para la pantalla 2.'
          : 'Contenido local seleccionado para la pantalla 2.',
      );
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  function play(event: FormEvent) {
    event.preventDefault();
    void save(url.trim());
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
      <form onSubmit={play} className="youtube-form">
        <label htmlFor="youtube-url">Enlace de YouTube</label>
        <input
          id="youtube-url"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
        {recent.length > 0 && (
          <div className="youtube-recent-links">
            <span>Enlaces recientes</span>
            <div>
              {recent.map((recentItem) => (
                <button
                  key={recentItem}
                  type="button"
                  className="recent-link"
                  title={recentItem}
                  onClick={() => setUrl(recentItem)}
                  disabled={busy}
                >
                  <Icon name="clock" />
                  <span>{recentItem}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="media-actions">
          <button className="button primary" disabled={busy}>
            <Icon name="play" />
            Reproducir YouTube
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={busy || !config.youtubeUrl}
            onClick={() => void save(null)}
          >
            <Icon name="folder" />
            Usar contenido local
          </button>
        </div>
      </form>
    </section>
  );
}
