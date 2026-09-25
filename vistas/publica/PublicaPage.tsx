import { useEffect } from 'react';
import { formatear } from '../../nucleo/turnos';
import { useTurnero } from '../comun/turnero';
import { PublicFooter } from '../comun/components/PublicFooter';
import { Icon } from '../comun/components/Icon';
import { TarjetaAnuncio } from './TarjetaAnuncio';
import './youtube.css';
import { AnimatedBackground } from '../comun/components/AnimatedBackground';
import { Contenido } from './Contenido';
import { useAnuncios } from './useAnuncios';

/** RF-02, RF-05, RF-08, RF-09 · turno actual destacado, hasta 5 llamados y el área de contenido. */
export function PublicaPage() {
  const {
    instantanea: { actual, llamados },
    config,
    inventario,
    registrar,
  } = useTurnero();
  const { anuncio, atenuado, errorAudio } = useAnuncios();
  useEffect(() => {
    document.title = 'Troyanos · Turnos';
  }, []);
  // Una sola lista, del más reciente al más viejo: los turnos salen conforme se llaman.
  const filas = [
    ...(actual === null ? [] : [{ n: actual, ultimo: true }]),
    ...llamados.map((n) => ({ n, ultimo: false })),
  ];

  return (
    <div
      className={`public-screen ${anuncio ? 'is-announcing' : ''} ${config.youtubeUrl ? 'has-youtube' : ''}`}
    >
      <AnimatedBackground />
      <section className="public-queue glass-panel" aria-labelledby="public-title">
        <header className="public-queue-heading">
          <div className="public-title-row">
            <h1 id="public-title">Pedidos listos</h1>
          </div>
        </header>
        <div className="public-turn-list" key={actual ?? 'vacio'} aria-live="polite">
          {filas.map(({ n, ultimo }) => (
            <div
              className={`public-turn ${(anuncio ? anuncio.n === n : ultimo) ? 'latest' : ''} ${anuncio?.n === n ? 'calling' : ''}`}
              key={n}
            >
              {(anuncio ? anuncio.n === n : ultimo) && (
                <span className="public-turn-state">
                  {anuncio?.n === n ? 'Llamando ahora' : 'Pedido listo'}
                </span>
              )}
              <strong>{formatear(n)}</strong>
              {(anuncio ? anuncio.n === n : ultimo) && (
                <span className="pickup-label">Recoge tu pedido</span>
              )}
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
          <Contenido
            videos={inventario.videos}
            banner={inventario.banner}
            config={config}
            atenuado={atenuado}
            registrar={registrar}
          />
        </div>
        <TarjetaAnuncio anuncio={anuncio} />
      </section>
      {errorAudio && (
        <div className="display-notices">
          <div className="audio-warning" role="alert">
            {errorAudio}
          </div>
        </div>
      )}
      <PublicFooter messages={config.mensajes} />
    </div>
  );
}
