import {useEffect, useState} from 'react';
import {useSystem} from '../hooks/useSystem';
import {useAnnouncements} from '../hooks/useAnnouncements';
import {CounterLabel} from '../components/CounterLabel';
import {PublicFooter} from '../components/PublicFooter';
import {MediaPlayer} from '../components/MediaPlayer';
import {Brand} from '../components/Brand';
import {Icon} from '../components/Icon';
import {StatusBadge} from '../components/StatusBadge';
import type {Multimedia} from '../types';

const fallback: Multimedia = {type:'fallback',url:null,playlistId:null,playing:false,muted:false,volume:55};

export function PublicPage() {
  const {state, connected} = useSystem();
  const {current, audioEnabled, audioError, enableAudio} = useAnnouncements();
  const [page, setPage] = useState(0), [controls, setControls] = useState(false);
  const turns = state?.turns ?? [], pages = Math.max(1, Math.ceil(turns.length / 5));
  useEffect(() => { setPage(0); }, [turns[0]?.id, turns[0]?.lastAnnouncedAt]);
  useEffect(() => {
    if (state?.settings.autoRotate === false || pages < 2) return;
    const id = setInterval(() => setPage(p => (p + 1) % pages), 8000);
    return () => clearInterval(id);
  }, [pages, state?.settings.autoRotate]);
  const visible = turns.slice((page % pages) * 5, (page % pages) * 5 + 5);
  const latest = turns[0];
  useEffect(() => { document.title = 'Comal++ · Turnos listos'; }, []);

  return <div className={`public-screen ${current ? 'is-announcing' : ''}`}>
    <section className="public-media" aria-label="Multimedia y anuncios">
      <MediaPlayer config={state?.multimedia ?? fallback} playlists={state?.playlists ?? []} ducked={Boolean(current)} audioEnabled={audioEnabled}/>
    </section>
    <section className="public-queue glass-panel" aria-labelledby="public-title">
      <header className="public-queue-heading">
        <span className="eyebrow"><span className="status-dot"/>LISTOS PARA RECOGER</span>
        <div className="public-title-row"><h1 id="public-title">Turnos listos</h1><span className="public-count">{turns.length}</span></div>
        <p>Busca tu número y acércate al mostrador.</p>
      </header>
      <div className="public-turn-list" key={page % pages}>
        {visible.map(turn => <div className={`public-turn ${turn.id === latest?.id ? 'latest' : ''} ${turn.id === current?.turnId ? 'calling' : ''}`} key={turn.id}>
          <strong>{turn.number}</strong>
          <div className="public-turn-detail">
            <span className="public-turn-state">{turn.id === current?.turnId ? 'Llamando ahora' : turn.id === latest?.id ? 'Último llamado' : 'Listo para recoger'}</span>
            {turn.counter !== 0 ? <CounterLabel counter={turn.counter}/> : <span className="pickup-label">Recoge tu pedido</span>}
          </div>
          <Icon name="arrow"/>
        </div>)}
        {!turns.length && <div className="public-empty"><span className="empty-icon"><Icon name="coffee"/></span><h2>No hay pedidos<br/>listos para recoger</h2><p>Tu número aparecerá aquí.<br/>Mantén tu ticket a la mano.</p></div>}
      </div>
      <div className="public-queue-bottom"><span><Icon name="receipt"/>Presenta tu ticket al recoger</span>{pages > 1 && <div className="public-pagination"><span>{page % pages + 1} / {pages}</span>{state?.settings.autoRotate === false && <button onClick={() => setPage(p => (p + 1) % pages)} aria-label="Siguiente página de turnos"><Icon name="arrow"/></button>}</div>}</div>
    </section>
    <section className="public-focus" aria-label="Último llamado">
      <div className="display-brand"><Brand compact/><span>Un buen café. Un buen momento.</span></div>
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
        {latest ? <div className="latest-call glass-panel" key={`${latest.id}-${latest.lastAnnouncedAt}`}><div><span className="eyebrow">ÚLTIMO LLAMADO</span><strong>{latest.number}</strong></div><div className="latest-call-copy"><StatusBadge tone="ready">Listo para recoger</StatusBadge>{latest.counter !== 0 ? <CounterLabel counter={latest.counter}/> : <span>Acércate por tu pedido</span>}<p>Disfruta tu momento.</p></div><Icon name="arrow"/></div> : <div className="welcome-copy"><span className="eyebrow">BIENVENIDO A COMAL++</span><h2>El café también<br/>nos une.</h2><p>Un momento para ti, mientras esperas.</p></div>}
      </div>}
    </section>
    <div className={`public-tools ${controls ? 'show' : ''}`}>
      <button className="public-tool-toggle" onClick={() => setControls(c => !c)} aria-label="Opciones de la pantalla" aria-expanded={controls} aria-controls="display-options"><Icon name="settings"/></button>
      <div className="public-tool-options" id="display-options"><a href="/" className="icon-button" aria-label="Panel del cajero"><Icon name="ticket"/></a><button className="icon-button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label="Pantalla completa"><Icon name="expand"/></button><button className="icon-button" onClick={enableAudio} aria-label="Activar audio"><Icon name="volume"/></button></div>
    </div>
    <div className="display-notices">
      {!audioEnabled && <button className="audio-activation" onClick={enableAudio}><Icon name="volume"/>Activar audio de esta pantalla<Icon name="arrow"/></button>}
      {audioError && <div className="audio-warning" role="alert">{audioError}</div>}
      {!connected && <div className="public-connection-warning" role="alert"><Icon name="warning"/>{state ? 'Sin conexión local. La información puede estar desactualizada. Consulta en caja.' : 'Conectando con el servidor local…'}</div>}
    </div>
    <PublicFooter messages={state?.settings.footerMessages ?? ['El café también nos une','Presenta tu ticket al recoger tu pedido']}/>
  </div>;
}
