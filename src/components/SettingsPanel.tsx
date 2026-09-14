import {useEffect,useState} from 'react';
import {useSystem} from '../hooks/useSystem';
import {api} from '../services/api';
import {enableAnnouncementAudio,playAnnouncement} from '../services/announcementAudio';
import {Icon} from './Icon';
export function SettingsPanel({notify}:{notify:(message:string,error?:boolean)=>void}){
 const {state,connected}=useSystem();const [seconds,setSeconds]=useState(state?.settings.announcementSeconds??6),[messages,setMessages]=useState(state?.settings.footerMessages.join('\n')??''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(state){setSeconds(state.settings.announcementSeconds);setMessages(state.settings.footerMessages.join('\n'));}},[state?.settings.announcementSeconds,state?.settings.footerMessages.join('\n')]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);try{await api.settings({announcementSeconds:seconds,footerMessages:messages.split('\n').map(s=>s.trim()).filter(Boolean)});notify('Configuración guardada en este equipo.');}catch(e){notify((e as Error).message,true);}finally{setBusy(false);}}
 async function testAudio(){try{await enableAnnouncementAudio();await playAnnouncement('99',1,new AbortController().signal);notify('Prueba de audio local completada.');}catch(e){notify((e as Error).message,true);}}
 return <div className="settings-page">
  <section className="panel settings-panel">
   <div className="section-heading with-icon"><span className="section-icon"><Icon name="monitor"/></span><div><h2>Anuncios y pantalla</h2><p>La información que ven tus clientes.</p></div></div>
   <form onSubmit={save}>
    <label htmlFor="announcement-duration">Duración mínima del anuncio</label><div className="duration-field"><input id="announcement-duration" type="number" min="3" max="20" value={seconds} onChange={e=>setSeconds(Number(e.target.value))}/><span>segundos</span></div><p className="field-hint">El anuncio permanece hasta que termine la voz. El video sigue avanzando.</p>
    <label htmlFor="footer-messages">Mensajes del pie de pantalla</label><textarea id="footer-messages" rows={5} value={messages} onChange={e=>setMessages(e.target.value)} placeholder="Un mensaje por línea"/><p className="field-hint">Un mensaje por línea. Se alternan con la fecha y la hora.</p>
    <button className="button primary" disabled={!connected||busy}><Icon name="check"/>{busy?'Guardando…':'Guardar configuración'}</button>
   </form>
  </section>
  <section className="panel settings-panel">
   <div className="section-heading with-icon"><span className="section-icon quiet"><Icon name="volume"/></span><div><h2>Voz y operación local</h2><p>Todo preparado para recibir a tus clientes.</p></div></div>
   <p className="section-subtitle">99 números y tres mensajes de recogida, disponibles sin internet.</p><button className="button secondary" onClick={testAudio}><Icon name="volume"/>Probar turno 99 · Mostrador 1</button>
   <div className="settings-note"><Icon name="info"/><p>Activa el audio en la pantalla pública al comenzar la jornada. Si replicas esa pantalla en tres televisores, utiliza una sola salida de sonido para evitar eco.</p></div>
   <h3 className="settings-subheading">Siempre cerca, siempre local</h3><p className="section-subtitle">Tus turnos y preferencias se guardan en este equipo. Las pantallas se actualizan a través de la conexión local.</p><a className="button secondary" href="/pantalla" target="_blank" rel="noopener"><Icon name="monitor"/>Abrir pantalla pública</a>
   <div className="settings-note"><Icon name="folder"/><p>Para música sin internet, añade tus pistas a la biblioteca local. YouTube es una opción adicional y requiere conexión.</p></div>
  </section>
 </div>;
}
