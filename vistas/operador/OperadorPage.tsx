import {useEffect,useRef,useState} from 'react';
import {formatear,normalizar} from '../../nucleo/turnos';
import {useTurnero} from '../comun/turnero';
import {useClock} from '../comun/hooks/useClock';
import {Brand} from '../comun/components/Brand';
import {Icon} from '../comun/components/Icon';
import {Modal} from '../comun/components/Modal';
import {StatusBadge} from '../comun/components/StatusBadge';
import {AnimatedBackground} from '../comun/components/AnimatedBackground';

const pantallaTexto={tv:'Pantalla pública en la TV',ventana:'Pantalla pública en ventana',ninguna:'Sin pantalla pública'};

/** RF-01, RF-07, RF-16, RF-17 · solo teclado: número + Enter, Ctrl+Z para deshacer, F1 para ayuda. */
export function OperadorPage(){
 const {instantanea,pantallas,despachar}=useTurnero(),clock=useClock();
 const {actual,llamados,puedeDeshacer}=instantanea;
 const [entrada,setEntrada]=useState(''),[ocupado,setOcupado]=useState(false),[mensaje,setMensaje]=useState(''),[esError,setEsError]=useState(false),[ayuda,setAyuda]=useState(false);
 const input=useRef<HTMLInputElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const previa=normalizar(entrada);
 function notificar(texto:string,error=false){setMensaje(texto);setEsError(error);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setMensaje(''),8000);}
 async function llamar(e:React.FormEvent){
  e.preventDefault();if(ocupado)return;setOcupado(true);
  try{
   const resultado=await despachar({tipo:'LLAMAR',entrada});
   if(resultado.efecto==='CAPTURA_INVALIDA')notificar(entrada.trim()?'Captura inválida: escribe solo números, de 1 a 6 dígitos. La TV no cambió.':'Escribe el número del ticket antes de presionar Enter.',true);
   else if(resultado.anuncio){notificar(resultado.anuncio.n===actual?`Turno ${formatear(resultado.anuncio.n)} anunciado de nuevo.`:`Turno ${formatear(resultado.anuncio.n)} anunciado.`);setEntrada('');}
  }catch(error){notificar((error as Error).message,true);}
  finally{setOcupado(false);input.current?.focus();}
 }
 async function deshacerUltimo(){
  if(ocupado||!puedeDeshacer)return;setOcupado(true);
  try{const {instantanea:nueva}=await despachar({tipo:'DESHACER'});notificar(nueva.actual===null?'Llamado deshecho. La TV quedó sin turno actual.':`Llamado deshecho. En la TV: turno ${formatear(nueva.actual)}.`);}
  catch(error){notificar((error as Error).message,true);}
  finally{setOcupado(false);input.current?.focus();}
 }
 const atajos=useRef({deshacerUltimo});atajos.current={deshacerUltimo};
 useEffect(()=>{
  function tecla(e:KeyboardEvent){
   if(e.key==='F1'){e.preventDefault();setAyuda(true);}
   else if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();void atajos.current.deshacerUltimo();}
  }
  const enfocar=()=>input.current?.focus();
  window.addEventListener('keydown',tecla);window.addEventListener('focus',enfocar);
  return()=>{window.removeEventListener('keydown',tecla);window.removeEventListener('focus',enfocar);};
 },[]);
 useEffect(()=>{document.title='Troyanos · Operador';},[]);
 const pista=!entrada.trim()?'Se usan los dos últimos dígitos del ticket.':previa===null?'Solo números, de 1 a 6 dígitos.':previa===actual?'Ya está en la TV: solo se repite el anuncio.':llamados.includes(previa)?'Está en llamados: vuelve a ser el turno actual.':'Turno nuevo.';
 return <div className="admin-shell">
  <AnimatedBackground/>
  <a href="#admin-main" className="skip-link">Ir al contenido</a>
  <aside className="sidebar">
   <Brand/>
   <span className="nav-label">ESPACIO DE TRABAJO</span>
   <nav aria-label="Navegación principal">
    <button className="active" aria-current="page" onClick={()=>input.current?.focus()}><Icon name="receipt"/><span>Turnos</span><i className="nav-active-dot"/></button>
    <button onClick={()=>setAyuda(true)}><Icon name="info"/><span>Ayuda</span></button>
   </nav>
   <div className="sidebar-bottom">
    <div className="sidebar-session"><span className="session-avatar"><Icon name="counter"/></span><div><strong>Barra</strong><span>Operación local</span></div></div>
   </div>
  </aside>
  <div className="admin-workspace">
   <header className="admin-topbar"><div className="breadcrumb">Troyanos<Icon name="chevron"/><span>Turnos</span></div><span className={`connection-status ${pantallas.publica==='ninguna'?'disconnected':'connected'}`}><i/>{pantallaTexto[pantallas.publica]}</span><span className="topbar-divider"/><button className="button secondary help-button" onClick={()=>setAyuda(true)}><Icon name="info"/>Ayuda<kbd>F1</kbd></button></header>
   <main id="admin-main" className="admin-main" tabIndex={-1}>
    <div className="page-heading"><div><span className="eyebrow">OPERACIÓN DIARIA</span><h1>Llamar turnos</h1></div><div className="workspace-clock"><strong>{clock.time}</strong><span>{clock.date}</span></div></div>
    {pantallas.publica==='ninguna'&&<div className="connection-banner" role="alert"><Icon name="warning"/><span>No se detecta la TV. La pantalla pública no se muestra para que el campo de captura nunca aparezca en ella. Revisa que la TV esté encendida y conectada: en cuanto se detecte, la pantalla pública vuelve sola.</span></div>}
    <div className="turns-layout">
     <div className="entry-column">
      <section className="panel new-turn-panel">
       <div className="section-heading with-icon"><span className="section-icon"><Icon name="receipt"/></span><div><h2>Llamar turno</h2><p>Teclea el ticket y presiona Enter. Para repetir, teclea el mismo número.</p></div></div>
       <form onSubmit={llamar}>
        <label htmlFor="turn-number">Número del ticket <span className="input-format">1 a 6 dígitos</span></label>
        <div className="call-entry">
         <input className="turn-number-input" id="turn-number" ref={input} type="text" inputMode="numeric" maxLength={6} placeholder="213298" autoComplete="off" autoFocus value={entrada} onChange={e=>setEntrada(e.target.value)} aria-invalid={Boolean(entrada.trim())&&previa===null} aria-describedby="call-preview-hint ticket-feedback"/>
         <div className={`call-preview ${previa===null?'empty':''}`} aria-live="polite"><span>Se anunciará</span><strong>{previa===null?'––':formatear(previa)}</strong></div>
        </div>
        <p id="call-preview-hint" className="field-hint">{pista}</p>
        <button className="button primary register-button" disabled={ocupado}><Icon name="volume"/>Anunciar en la TV<kbd>Enter</kbd></button>
       </form>
       <div id="ticket-feedback" className={`form-feedback ${mensaje?(esError?'error':'success'):'neutral'}`} role="status" aria-live="polite"><Icon name={mensaje?(esError?'warning':'checkCircle'):'info'}/><span>{mensaje||'Cada llamado suena en la TV con aviso y voz.'}</span></div>
      </section>
      <section className="panel repeat-panel">
       <div className="section-heading with-icon"><span className="section-icon quiet"><Icon name="undo"/></span><div><h2>Corregir captura</h2><p>Quita el último llamado de la TV, sin volver a anunciar.</p></div></div>
       <div className="undo-row"><button className="button secondary" onClick={deshacerUltimo} disabled={ocupado||!puedeDeshacer}><Icon name="undo"/>Deshacer último<kbd>Ctrl+Z</kbd></button><span>{puedeDeshacer?'Solo se puede deshacer una vez.':'No hay un llamado que deshacer.'}</span></div>
      </section>
     </div>
     <section className="panel ready-panel" aria-labelledby="screen-heading">
      <div className="ready-heading"><div><span className="eyebrow">LO QUE VE EL CLIENTE</span><h2 id="screen-heading">En pantalla <span className="count-badge">{actual===null?0:llamados.length+1}</span></h2></div><StatusBadge tone={pantallas.publica==='ninguna'?'neutral':'ready'}>{pantallas.publica==='ninguna'?'Sin TV':'En vivo'}</StatusBadge></div>
      <div className="cashier-ready-list">
       {actual!==null&&<div className="cashier-turn most-recent"><div className="cashier-ticket"><strong>{formatear(actual)}</strong><span>Turno actual</span></div><div className="cashier-counter"><span className="row-ready"><i/>Destacado en la TV</span></div></div>}
       {llamados.map((n,i)=><div className="cashier-turn" key={n}><div className="cashier-ticket"><strong>{formatear(n)}</strong></div><div className="cashier-counter"><span className="counter-dash">{i===0?'Llamado anterior':`Hace ${i+1} llamados`}</span></div></div>)}
       {actual===null&&<div className="empty-state"><span className="empty-icon"><Icon name="checkCircle"/></span><h3>Sin llamados en esta jornada</h3><p>El primer número que anuncies aparecerá aquí y en la TV.</p></div>}
      </div>
      <div className="ready-list-footer"><Icon name="monitor"/><span>La TV muestra el turno actual y hasta 5 llamados.</span></div>
     </section>
    </div>
    <footer className="workspace-footer"><span>Facultad de Informática <i/> UAQ</span><span>Crear · crecer · consolidar</span></footer>
   </main>
  </div>
  {ayuda&&<Modal title="Cómo usar el turnero" onClose={()=>{setAyuda(false);input.current?.focus();}}>
   <dl className="help-list">
    <dt><kbd>Enter</kbd> Llamar</dt><dd>Teclea el número del ticket y presiona Enter. Solo cuentan los dos últimos dígitos: <strong>213298</strong> se anuncia como <strong>98</strong>. Antes de presionar Enter ves el número que va a salir.</dd>
    <dt><Icon name="volume"/> Repetir</dt><dd>Teclea el mismo número. Si ya es el turno actual, solo se repite el anuncio; si está en llamados, vuelve a ser el actual sin duplicarse.</dd>
    <dt><kbd>Ctrl+Z</kbd> Corregir</dt><dd>Quita de la TV el último llamado, sin anunciar. Solo se puede deshacer una vez; el siguiente llamado correcto trae su propio anuncio.</dd>
    <dt><Icon name="monitor"/> La TV no muestra nada</dt><dd>Revisa que esté encendida y conectada. La pantalla pública aparece sola cuando se detecta.</dd>
    <dt><Icon name="calendar"/> Cada día</dt><dd>La lista arranca vacía al comenzar la jornada. Si se va la luz, al volver se recupera lo que estaba en pantalla.</dd>
   </dl>
  </Modal>}
 </div>;
}
