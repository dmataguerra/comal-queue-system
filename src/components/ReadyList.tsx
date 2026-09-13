import {useState} from 'react';
import type {Counter,Turn} from '../types';
import {useSystem} from '../hooks/useSystem';
import {api} from '../services/api';
import {CounterLabel} from './CounterLabel';
import {Modal} from './Modal';
import {Icon} from './Icon';
import {StatusBadge} from './StatusBadge';
export function ReadyList({notify}:{notify:(message:string,error?:boolean)=>void}){
 const {state,connected}=useSystem();const [selected,setSelected]=useState<Turn|null>(null),[counter,setCounter]=useState<Counter>(0),[busy,setBusy]=useState(false),[confirmCancel,setConfirmCancel]=useState(false);
 async function update(update:{counter?:Counter;status?:'delivered'|'cancelled'}){if(!selected)return;setBusy(true);try{await api.updateTurn(selected.id,update);notify(update.status==='delivered'?`Turno ${selected.number} entregado.`:update.status==='cancelled'?`Turno ${selected.number} retirado.`:`Mostrador del turno ${selected.number} actualizado.`);setSelected(null);setConfirmCancel(false);}catch(e){notify((e as Error).message,true);}finally{setBusy(false);}}
 const turns=state?.turns??[];
 return <section className="panel ready-panel" aria-labelledby="ready-heading">
  <div className="ready-heading"><div><span className="eyebrow">PENDIENTES DE RECOGER</span><h2 id="ready-heading">Turnos listos <span className="count-badge">{turns.length}</span></h2></div><StatusBadge tone={connected?'ready':'neutral'}>{connected?'En vivo':'Sin conexión'}</StatusBadge></div>
  <div className="queue-column-labels"><span>TURNO</span><span>PUNTO DE RECOGIDA</span><span className="sr-only">Acciones</span></div>
  <div className="cashier-ready-list">
   {turns.map((turn,index)=><div className={`cashier-turn ${index===0?'most-recent':''}`} key={turn.id}>
    <div className="cashier-ticket"><strong>{turn.number}</strong>{index===0&&<span>Último llamado</span>}</div>
    <div className="cashier-counter">{turn.counter?<CounterLabel counter={turn.counter}/>:<span className="counter-dash">Sin mostrador</span>}<span className="row-ready"><i/>Listo para recoger</span></div>
    <button className="icon-button turn-menu" onClick={()=>{setSelected(turn);setCounter(turn.counter);setConfirmCancel(false);}} aria-label={`Acciones del turno ${turn.number}`} title={`Gestionar turno ${turn.number}`}><Icon name="more"/></button>
   </div>)}
   {!turns.length&&<div className="empty-state"><span className="empty-icon"><Icon name="checkCircle"/></span><h3>Todo al día</h3><p>Los turnos que registres aparecerán aquí y en la pantalla pública.</p><span className="empty-caption">Un nuevo pedido. Un nuevo momento.</span></div>}
  </div>
  <div className="ready-list-footer"><Icon name="monitor"/><span>Los turnos se muestran en la pantalla pública.</span><a href="/pantalla" target="_blank" rel="noopener" aria-label="Ver pantalla pública"><Icon name="external"/></a></div>
  {selected&&<Modal title={`Turno ${selected.number}`} onClose={()=>setSelected(null)}>
   {confirmCancel?<><p className="modal-copy">Este turno se retirará de la pantalla. Esta acción no modifica el cobro del ticket.</p><div className="modal-actions"><button className="button secondary" onClick={()=>setConfirmCancel(false)}>Volver</button><button className="button danger" disabled={busy||!connected} onClick={()=>update({status:'cancelled'})}>Sí, retirar turno</button></div></>:<>
    <div className="modal-ticket-summary"><strong>{selected.number}</strong><StatusBadge tone="ready">Listo para recoger</StatusBadge></div>
    <p className="modal-copy">Actualiza el punto de entrega o confirma que el cliente ya recogió su pedido.</p><label className="form-label" htmlFor="edit-counter">¿Dónde se recoge?</label><div className="select-wrap"><Icon name="counter"/><select id="edit-counter" value={counter} onChange={e=>setCounter(Number(e.target.value) as Counter)}><option value="0">Sin mostrador</option><option value="1">Mostrador 1</option><option value="2">Mostrador 2</option></select><Icon name="chevron"/></div>
    <div className="modal-actions"><button className="button secondary" onClick={()=>update({counter})} disabled={busy||!connected||counter===selected.counter}>Guardar mostrador</button><button className="button primary" onClick={()=>update({status:'delivered'})} disabled={busy||!connected}><Icon name="check"/>Entregado</button></div><button className="text-danger" onClick={()=>setConfirmCancel(true)} disabled={busy||!connected}>Retirar por error de captura</button>
   </>}
  </Modal>}
 </section>;
}
