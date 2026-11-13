import { useEffect } from 'react';
import { format } from '../../core/turns';
import { useQueue } from '../common/queue-context';
import { PublicFooter } from '../common/components/PublicFooter';
import { Icon } from '../common/components/Icon';
import { AnnouncementCard } from './AnnouncementCard';
import './youtube.css';
import { AnimatedBackground } from '../common/components/AnimatedBackground';
import { MediaContent } from './MediaContent';
import { useAnnouncements } from './useAnnouncements';
import { DisplayCanvas } from './DisplayCanvas';
export function DisplayPage() {
  const {
    instantanea: { actual: current, llamados: calledTurns },
    config,
    inventario: inventory,
    registrar: log,
  } = useQueue();
  const {
    announcement: announcement,
    ducked: ducked,
    confirmDucking: confirmDucking,
  } = useAnnouncements();
  useEffect(() => {
    document.title = 'Troyanos · Turnos';
  }, []);
  const rows = [
    ...(current === null ? [] : [{ n: current, ultimo: true }]),
    ...calledTurns.map((n) => ({ n, ultimo: false })),
  ];
  return (
    <DisplayCanvas>
      <div
        className={`public-screen ${announcement ? 'is-announcing' : ''} ${config.youtubeUrl ? 'has-youtube' : ''}`}
      >
        <AnimatedBackground />
        <section className="public-queue glass-panel" aria-labelledby="public-title">
          <header className="public-queue-heading">
            <div className="public-title-row">
              <h1 id="public-title">Pedidos listos</h1>
            </div>
          </header>
          <div className="public-turn-list" key={current ?? 'vacio'} aria-live="polite">
            {rows.map(({ n, ultimo: last }) => (
              <div
                className={`public-turn ${(announcement ? announcement.n === n : last) ? 'latest' : ''} ${announcement?.n === n ? 'calling' : ''}`}
                key={n}
              >
                {(announcement ? announcement.n === n : last) && (
                  <span className="public-turn-state">
                    {announcement?.n === n ? 'Llamando ahora' : 'Pedido listo'}
                  </span>
                )}
                <strong>{format(n)}</strong>
              </div>
            ))}
          </div>
          <div className="public-queue-bottom">
            <span>
              <Icon name="receipt" />
              Presenta tu ticket al recoger
            </span>
          </div>
        </section>
        <section className="public-media-frame" aria-label="Contenido">
          <div className="public-media">
            <MediaContent
              videos={inventory.videos}
              banner={inventory.banner}
              config={config}
              ducked={ducked}
              confirmDucking={confirmDucking}
              log={log}
            />
          </div>
          <AnnouncementCard anuncio={announcement} />
        </section>
        <PublicFooter messages={config.mensajes} />
      </div>
    </DisplayCanvas>
  );
}
