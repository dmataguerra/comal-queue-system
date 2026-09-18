import {useEffect} from 'react';
import {formatear} from '../../nucleo/turnos';
import {useTurnero} from '../comun/turnero';
import {PublicFooter} from '../comun/components/PublicFooter';
import {Icon} from '../comun/components/Icon';
import {StatusBadge} from '../comun/components/StatusBadge';
import {AnimatedBackground} from '../comun/components/AnimatedBackground';
import {Contenido} from './Contenido';
import {useAnuncios} from './useAnuncios';

/** RF-02, RF-05, RF-08, RF-09 · turno actual destacado, hasta 5 llamados y el área de contenido. */
export function PublicaPage() {
  const {instantanea: {actual, llamados}, config, inventario, registrar} = useTurnero();
  const {anuncio, atenuado, errorAudio} = useAnuncios();
  useEffect(() => { document.title = 'Troyanos · Turnos'; }, []);

  return <div className={`public-screen ${anuncio ? 'is-announcing' : ''}`}>
    <AnimatedBackground/>
    <section className="public-queue glass-panel" aria-labelledby="public-title">
      <header className="public-queue-heading">
        <div className="public-title-row"><h1 id="public-title">Pedidos listos</h1></div>
      </header>
      <div className={`public-current ${actual === null ? 'empty' : ''}`} aria-live="polite">
        <span className="public-current-label">Turno actual</span>
        <strong key={anuncio?.id ?? actual ?? 'vacio'}>{actual === null ? '––' : formatear(actual)}</strong>
      </div>
      <div className="public-called">
        <span className="public-called-label">Llamados</span>
        <div className="public-called-list">
          {llamados.map(n => <strong key={n}>{formatear(n)}</strong>)}
        </div>
      </div>
      <div className="public-queue-bottom"><span><Icon name="receipt"/>Presenta tu ticket al recoger</span></div>
    </section>
    <section className="public-media-frame" aria-label="Contenido">
      <div className="public-media">
        <Contenido videos={inventario.videos} banner={inventario.banner} config={config} atenuado={atenuado} registrar={registrar}/>
      </div>
      {anuncio && <section className="public-focus" aria-label="Anuncio de turno">
        <div className="announcement-backdrop" role="status" aria-live="assertive" aria-atomic="true">
          <div className="announcement-card glass-panel" key={anuncio.id}>
            <StatusBadge tone="ready">Tu pedido está listo</StatusBadge>
            <span className="announcement-caption">TURNO</span>
            <strong className="announcement-number">{formatear(anuncio.n)}</strong>
            <span className="announcement-pickup">Acércate a recoger tu pedido</span>
            <div className="announcement-rule"/>
            <p><Icon name="receipt"/>Presenta tu ticket en la barra</p>
          </div>
        </div>
      </section>}
    </section>
    {errorAudio && <div className="display-notices"><div className="audio-warning" role="alert">{errorAudio}</div></div>}
    <PublicFooter messages={config.mensajes}/>
  </div>;
}
