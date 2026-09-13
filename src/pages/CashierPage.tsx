import {useRef,useState} from 'react';
import {useSystem} from '../hooks/useSystem';
import {useClock} from '../hooks/useClock';
import {api,newRequestId} from '../services/api';
import {Brand} from '../components/Brand';
import {Icon} from '../components/Icon';
import {ReadyList} from '../components/ReadyList';
import {MultimediaPanel} from '../components/MultimediaPanel';
import {SettingsPanel} from '../components/SettingsPanel';
import type {Counter} from '../types';
export function CashierPage(){
 const {state,connected}=useSystem(),clock=useClock();const [page,setPage]=useState<'turns'|'multimedia'|'settings'>('turns');
 const [number,setNumber]=useState(''),[counter,setCounter]=useState<Counter>(0),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[isError,setIsError]=useState(false);
 const input=useRef<HTMLInputElement>(null),requestId=useRef(newRequestId()),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function notify(text:string,error=false){setMessage(text);setIsError(error);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setMessage(''),8000);}
 async function create(e:React.FormEvent){e.preventDefault();if(busy||!connected)return;const clean=number.trim();if(!/^\d{1,2}$/.test(clean)||Number(clean)<1||Number(clean)>99){notify('Introduce un número de turno del 01 al 99.',true);input.current?.focus();return;}setBusy(true);try{const turn=await api.createTurn(clean.padStart(2,'0'),counter,requestId.current);notify(`Turno ${turn.number} marcado como listo.`);requestId.current=newRequestId();setNumber('');setRepeat(turn.id);input.current?.focus();}catch(e){notify((e as Error).message,true);}finally{setBusy(false);}}
 async function reannounce(e:React.FormEvent){e.preventDefault();const id=state?.turns.find(t=>t.id===repeat)?.id||state?.turns[0]?.id;if(!id||busy||!connected)return;setBusy(true);try{const turn=await api.announce(id,newRequestId());notify(`Turno ${turn.number} anunciado de nuevo.`);}catch(e){notify((e as Error).message,true);}finally{setBusy(false);}}
 const titles = {turns: ['Panel de caja', 'Cada pedido, en su momento.'], multimedia: ['Multimedia', 'El ambiente también es parte de la experiencia.'], settings: ['Configuración', 'Todo listo para una buena jornada.']};
 return <div className="admin-shell">
  <a href="#admin-main" className="skip-link">Ir al contenido</a>
  <aside className="sidebar">
   <Brand/>
   <span className="nav-label">ESPACIO DE TRABAJO</span>
   <nav aria-label="Navegación principal">{([['turns','receipt','Turnos'],['multimedia','media','Multimedia'],['settings','settings','Configuración']] as const).map(([id,icon,label]) => <button className={page===id?'active':''} onClick={()=>{setPage(id);window.scrollTo({top:0});}} key={id} aria-current={page===id?'page':undefined} aria-label={label} title={label}><Icon name={icon}/><span>{label}</span>{page===id&&<i className="nav-active-dot"/>}</button>)}</nav>
   <a className="sidebar-display" href="/pantalla" target="_blank" rel="noopener"><Icon name="monitor"/><span>Pantalla pública</span><Icon name="external"/></a>
   <div className="sidebar-bottom">
    <div className="sidebar-coffee"><Icon name="coffee"/><p>El café también<br/><strong>nos une.</strong></p><span>COMAL++ · CAFETERÍA</span></div>
    <div className="sidebar-session"><span className="session-avatar"><Icon name="counter"/></span><div><strong>Estación de caja</strong><span>Operación local</span></div></div>
   </div>
  </aside>
  <div className="admin-workspace">
   <header className="admin-topbar"><div className="breadcrumb">Comal++<Icon name="chevron"/><span>{titles[page][0]}</span></div><span className={`connection-status ${connected?'connected':'disconnected'}`}><i/>{connected?'Conectado':'Sin conexión local'}</span><span className="topbar-divider"/><label className="automatic-view">Vista automática<button className={`switch ${state?.settings.autoRotate!==false?'on':''}`} role="switch" aria-checked={state?.settings.autoRotate!==false} aria-label="Vista automática" disabled={!connected} onClick={async()=>{try{await api.settings({autoRotate:state?.settings.autoRotate===false});}catch(e){notify((e as Error).message,true);}}}><span/></button></label></header>
   <main id="admin-main" className="admin-main" tabIndex={-1}>
    <div className="page-heading"><div><span className="eyebrow">{page==='turns'?'OPERACIÓN DIARIA':page==='multimedia'?'PANTALLAS Y SONIDO':'TU ESPACIO'}</span><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p></div><div className="workspace-clock"><strong>{clock.time}</strong><span>{clock.date}</span></div></div>
    {!connected&&<div className="connection-banner" role="alert"><Icon name="warning"/><span>{state?'Se perdió la conexión local. Los turnos guardados siguen visibles; los cambios están deshabilitados.':'Conectando con el servidor local…'}</span></div>}
    {page==='turns'?<>
     <div className="turns-layout">
      <div className="entry-column">
       <section className="panel new-turn-panel">
        <div className="section-heading with-icon"><span className="section-icon"><Icon name="receipt"/></span><div><h2>Nuevo turno listo</h2><p>Del mostrador a la pantalla.</p></div></div>
        <form onSubmit={create}>
         <label htmlFor="turn-number">Número de turno <span className="input-format">01 — 99</span></label>
         <input className="turn-number-input" id="turn-number" ref={input} type="text" inputMode="numeric" maxLength={2} placeholder="01–99" autoComplete="off" value={number} onChange={e=>{setNumber(e.target.value);requestId.current=newRequestId();}} disabled={!connected} aria-invalid={isError&&Boolean(number)} aria-describedby="ticket-feedback"/>
         <label htmlFor="counter">Punto de recogida <span className="optional">Opcional</span></label>
         <div className="select-wrap"><Icon name="counter"/><select id="counter" value={counter} onChange={e=>{setCounter(Number(e.target.value) as Counter);requestId.current=newRequestId();}} disabled={!connected}><option value="0">Sin mostrador</option><option value="1">Mostrador 1</option><option value="2">Mostrador 2</option></select><Icon name="chevron"/></div>
         <button className="button primary register-button" disabled={busy||!connected}><Icon name="checkCircle"/>{busy?'Guardando…':'Marcar como listo'}<Icon name="arrow"/></button>
        </form>
        <div id="ticket-feedback" className={`form-feedback ${message?(isError?'error':'success'):'neutral'}`} role="status" aria-live="polite"><Icon name={message?(isError?'warning':'checkCircle'):'info'}/><span>{message||'Captura el número impreso cuando el pedido esté listo.'}</span></div>
       </section>
       <section className="panel repeat-panel"><div className="section-heading with-icon"><span className="section-icon quiet"><Icon name="volume"/></span><div><h2>Volver a anunciar</h2><p>Un recordatorio para quien aún espera.</p></div></div><form onSubmit={reannounce}><div className="select-wrap"><select aria-label="Turno para volver a anunciar" value={state?.turns.some(t=>t.id===repeat)?repeat:state?.turns[0]?.id??''} onChange={e=>setRepeat(e.target.value)} disabled={!connected||!state?.turns.length}><option value="" disabled>Sin turnos</option>{state?.turns.map(t=><option value={t.id} key={t.id}>Turno {t.number}</option>)}</select><Icon name="chevron"/></div><button className="button secondary" disabled={busy||!connected||!state?.turns.length}><Icon name="volume"/>Volver a anunciar</button></form></section>
      </div>
      <ReadyList notify={notify}/>
     </div>
     <MultimediaPanel notify={notify}/>
    </>:page==='multimedia'?<MultimediaPanel expanded notify={notify}/>:<SettingsPanel notify={notify}/>}
    <footer className="workspace-footer"><span>Comal++ <i/> Hecho para compartir</span><span>El café también nos une.</span></footer>
   </main>
  </div>
  {message&&page!=='turns'&&<div className={`toast ${isError?'error':''}`} role="status"><Icon name={isError?'warning':'checkCircle'}/>{message}</div>}
 </div>;
}
