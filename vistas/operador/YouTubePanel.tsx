import {useEffect, useState, type FormEvent} from 'react';
import {parseYouTube} from '../../nucleo/youtube';
import {useTurnero} from '../comun/turnero';
import {Icon} from '../comun/components/Icon';

export function YouTubePanel({notificar}: {notificar: (mensaje: string, error?: boolean) => void}) {
  const {config, configurarYouTube} = useTurnero();
  const [url, setUrl] = useState(config.youtubeUrl ?? '');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { setUrl(config.youtubeUrl ?? ''); }, [config.youtubeUrl]);

  async function guardar(valor: string | null) {
    setOcupado(true);
    try {
      if (valor) parseYouTube(valor);
      await configurarYouTube(valor);
      notificar(valor ? 'YouTube seleccionado para la pantalla 2.' : 'Contenido local seleccionado para la pantalla 2.');
    } catch (error) { notificar((error as Error).message, true); }
    finally { setOcupado(false); }
  }
  function reproducir(event: FormEvent) { event.preventDefault(); void guardar(url.trim()); }

  return <section className="panel media-library-panel">
    <div className="media-library-heading"><span className="section-icon"><Icon name="play"/></span><div><h2>YouTube</h2><p>Video o playlist en reproducción continua. Requiere internet.</p></div></div>
    <form onSubmit={reproducir} className="youtube-form">
      <label htmlFor="youtube-url">Enlace de YouTube</label>
      <input id="youtube-url" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…"/>
      <div className="media-actions">
        <button className="button primary" disabled={ocupado}><Icon name="play"/>Reproducir YouTube</button>
        <button className="button secondary" type="button" disabled={ocupado || !config.youtubeUrl} onClick={() => void guardar(null)}><Icon name="folder"/>Usar contenido local</button>
      </div>
      <p className="section-subtitle">{config.youtubeUrl ? 'Fuente seleccionada: YouTube. El video se repite o la playlist continúa automáticamente.' : 'Fuente seleccionada: videos e imágenes locales.'}</p>
    </form>
  </section>;
}
