import {useEffect,useRef,useState} from 'react';
import {formatear} from '../../nucleo/turnos';
import type {Anuncio} from '../../main/contrato';
import {useTurnero} from '../comun/turnero';
import {pausa,precargar,reproducir} from './audio';

const PAUSA_REPETICION=300;
const TARJETA_MINIMA=4000;

/**
 * RF-03 y RF-11 · atenuar música → aviso → voz → [pausa → voz] → restaurar.
 * Un llamado nuevo a media secuencia la cancela y mantiene la música atenuada (§7).
 * Al montar o recargar no se repite ningún anuncio viejo: solo reacciona a eventos nuevos.
 */
export function useAnuncios(){
 const {instantanea:{actual},config,inventario,suscribirAnuncio,registrar}=useTurnero();
 const [anuncio,setAnuncio]=useState<Anuncio|null>(null),[atenuado,setAtenuado]=useState(false),[errorAudio,setErrorAudio]=useState('');
 const ultimos=useRef({config,inventario});ultimos.current={config,inventario};
 const enCurso=useRef<AbortController|null>(null),vozFaltante=useRef(new Set<number>());

 useEffect(()=>{
  precargar(inventario).then(()=>setErrorAudio('')).catch((error:Error)=>{setErrorAudio(error.message);registrar(`Audio: ${error.message}`);});
 },[inventario,registrar]);

 useEffect(()=>suscribirAnuncio(nuevo=>{
  enCurso.current?.abort();
  const control=new AbortController(),signal=control.signal;enCurso.current=control;
  setAnuncio(nuevo);setAtenuado(true);
  // CU-06 2a · la configuración se toma al inicio: un cambio aplica en el siguiente llamado.
  const {config:{repeticiones,volumenVoz},inventario:{aviso,voz}}=ultimos.current;
  const inicio=performance.now();
  (async()=>{
   try{
    if(aviso)await reproducir(aviso,volumenVoz,signal);
    const url=voz[nuevo.n];
    if(!url){
     if(!vozFaltante.current.has(nuevo.n)){vozFaltante.current.add(nuevo.n);registrar(`Falta la voz del turno ${formatear(nuevo.n)}; solo suena el aviso.`);}
    }else for(let vez=0;vez<repeticiones&&!signal.aborted;vez++){
     if(vez>0)await pausa(PAUSA_REPETICION,signal);
     await reproducir(url,volumenVoz,signal);
    }
   }catch(error){
    if(!signal.aborted){setErrorAudio((error as Error).message);registrar(`Audio: ${(error as Error).message}`);}
   }
   if(signal.aborted)return;
   setAtenuado(false);
   await pausa(TARJETA_MINIMA-(performance.now()-inicio),signal);
   if(!signal.aborted){setAnuncio(null);enCurso.current=null;}
  })();
 }),[suscribirAnuncio,registrar]);

 // CU-03 · si el operador deshace, el número equivocado sale de la TV de inmediato y se calla.
 useEffect(()=>{
  if(!anuncio||actual===anuncio.n)return;
  enCurso.current?.abort();enCurso.current=null;
  setAnuncio(null);setAtenuado(false);
 },[actual,anuncio]);

 useEffect(()=>()=>enCurso.current?.abort(),[]);
 return {anuncio,atenuado,errorAudio};
}
