import {useEffect, useState} from 'react';
import {useSystem} from '../hooks/useSystem';
import {useAnnouncements} from '../hooks/useAnnouncements';
import {CounterLabel} from '../components/CounterLabel';
import {PublicFooter} from '../components/PublicFooter';
import {MediaPlayer} from '../components/MediaPlayer';
import {Icon} from '../components/Icon';
import {StatusBadge} from '../components/StatusBadge';
import {AnimatedBackground} from '../components/AnimatedBackground';
import type {Multimedia} from '../types';

const fallback: Multimedia = {type:'fallback',url:null,playlistId:null,playing:false,muted:false,volume:55};

export function PublicPage() {
  const {state, connected} = useSystem();
  const {current, audioEnabled, audioError} = useAnnouncements();
  const [page, setPage] = useState(0), [youtubeActive, setYoutubeActive] = useState(false);
  const turns = state?.turns ?? [], pages = Math.max(1, Math.ceil(turns.length / 5));
  useEffect(() => { setPage(0); }, [turns[0]?.id, turns[0]?.lastAnnouncedAt]);
  useEffect(() => {
    if (state?.settings.autoRotate === false || pages < 2) return;
    const id = setInterval(() => setPage(p => (p + 1) % pages), 8000);
    return () => clearInterval(id);
  }, [pages, state?.settings.autoRotate]);
  const visible = turns.slice((page % pages) * 5, (page % pages) * 5 + 5);
  const latest = turns[0];
  const multimedia = state?.multimedia ?? fallback;
  const footerMessages = (state?.settings.footerMessages ?? ['El café también nos une','Presenta tu ticket al recoger tu pedido']).map(message=>message.replace(/Comal\+\+/gi,'Troyanos'));
  useEffect(() => { document.title = 'Troyanos · Turnos listos'; }, []);

  return <div className={`public-screen ${current ? 'is-announcing' : ''} ${youtubeActive ? 'has-active-youtube' : 'has-media-fallback'}`}>
    <AnimatedBackground/>
    <section className="public-queue glass-panel" aria-labelledby="public-title">
      <header className="public-queue-heading">
        <div className="public-title-row"><h1 id="public-title">Turnos listos</h1></div>
      </header>
      <div className="public-turn-list" key={page % pages}>
        {visible.map(turn => <div className={`public-turn ${turn.id === latest?.id ? 'latest' : ''} ${turn.id === current?.turnId ? 'calling' : ''}`} key={turn.id}>
          <strong>{turn.number}</strong>
          <div className="public-turn-detail">
            {(turn.id === current?.turnId || turn.id === latest?.id) && <span className="public-turn-state">{turn.id === current?.turnId ? 'Llamando ahora' : 'Último llamado'}</span>}
            {turn.counter !== 0 ? <CounterLabel counter={turn.counter}/> : <span className="pickup-label">Recoge tu pedido</span>}
          </div>
          <Icon name="arrow"/>
        </div>)}
      </div>
      <div className="public-queue-bottom"><span><Icon name="receipt"/>Presenta tu ticket al recoger</span>{pages > 1 && <div className="public-pagination"><span>{page % pages + 1} / {pages}</span>{state?.settings.autoRotate === false && <button onClick={() => setPage(p => (p + 1) % pages)} aria-label="Siguiente página de turnos"><Icon name="arrow"/></button>}</div>}</div>
    </section>
    <section className="public-media-frame" aria-label="Multimedia y anuncios">
      <div className="public-media"><MediaPlayer config={multimedia} playlists={state?.playlists ?? []} ducked={Boolean(current)} audioEnabled={audioEnabled} onYoutubeActivityChange={setYoutubeActive}/></div>
      {(current || !youtubeActive) && <section className="public-focus" aria-label={current?'Anuncio de turno':'Contenido de espera'}>
      {current ? <div className="announcement-backdrop" role="status" aria-live="assertive" aria-atomic="true">
        <div className="announcement-card glass-panel" key={current.id}>
          <StatusBadge tone="ready">Tu pedido está listo</StatusBadge>
          <span className="announcement-caption">TURNO</span>
          <strong className="announcement-number">{current.number}</strong>
          {current.counter !== 0 ? <CounterLabel counter={current.counter}/> : <span className="announcement-pickup">Acércate a recoger tu pedido</span>}
          <div className="announcement-rule"/>
          <p><Icon name="receipt"/>Presenta tu ticket en el mostrador</p>
        </div>
      </div> : <div className="public-resting">
        <div className="welcome-copy"><span className="welcome-logo-plate"><img src="/assets/uaq-informatica-logo.png" alt="Universidad Autónoma de Querétaro · Facultad de Informática"/></span><h2>El café también<br/>nos une.</h2><p>Un momento para ti, mientras esperas.</p></div>
        {latest && <div className="latest-call glass-panel" key={`${latest.id}-${latest.lastAnnouncedAt}`}><div><span className="eyebrow">ÚLTIMO LLAMADO</span><strong>{latest.number}</strong></div><div className="latest-call-copy">{latest.counter !== 0 ? <CounterLabel counter={latest.counter}/> : <span>Acércate por tu pedido</span>}<p>Disfruta tu momento.</p></div><Icon name="arrow"/></div>}
      </div>}
      </section>}
    </section>
    {(audioError || !connected) && <div className="display-notices">
      {audioError && <div className="audio-warning" role="alert">{audioError}</div>}
      {!connected && <div className="public-connection-warning" role="alert"><Icon name="warning"/>{state ? 'Sin conexión local. La información puede estar desactualizada. Consulta en caja.' : 'Conectando con el servidor local…'}</div>}
    </div>}
    <PublicFooter messages={footerMessages}/>
  </div>;
}
