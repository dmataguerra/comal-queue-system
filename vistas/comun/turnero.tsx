import {createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {Accion,Anuncio,Inicial,ResultadoDespacho,TurneroApi} from '../../main/contrato';

declare global { interface Window { turnero?: TurneroApi } }

interface Contexto extends Inicial {
 despachar:(accion:Accion)=>Promise<ResultadoDespacho>;
 suscribirAnuncio:(fn:(anuncio:Anuncio)=>void)=>()=>void;
 registrar:(mensaje:string)=>void;
}
const TurneroContext=createContext<Contexto|null>(null);

/** Las vistas nunca tocan el núcleo: reciben estado y despachan acciones por el adaptador (§2). */
export function TurneroProvider({children}:{children:ReactNode}){
 const api=window.turnero;
 const [inicial,setInicial]=useState<Inicial|null>(null),[error,setError]=useState('');
 const anuncios=useRef(new Set<(anuncio:Anuncio)=>void>());
 // Funciones estables: los efectos que se suscriben no deben reiniciarse en cada render.
 const acciones=useMemo(()=>({
  despachar:(accion:Accion)=>api!.despachar(accion),
  suscribirAnuncio:(fn:(anuncio:Anuncio)=>void)=>{anuncios.current.add(fn);return()=>{anuncios.current.delete(fn);};},
  registrar:(mensaje:string)=>api?.registrar(mensaje),
 }),[api]);
 useEffect(()=>{
  if(!api)return;
  // Primero se escucha y luego se pide la instantánea: la respuesta siempre es más nueva que lo que llegó antes.
  const quitar=[
   api.alCambiarEstado((instantanea,anuncio)=>{setInicial(previo=>previo&&{...previo,instantanea});if(anuncio)anuncios.current.forEach(fn=>fn(anuncio));}),
   api.alCambiarConfig(config=>setInicial(previo=>previo&&{...previo,config})),
   api.alCambiarContenido(inventario=>setInicial(previo=>previo&&{...previo,inventario})),
   api.alCambiarPantallas(pantallas=>setInicial(previo=>previo&&{...previo,pantallas})),
  ];
  api.obtener().then(setInicial).catch((e:Error)=>setError(e.message));
  return()=>quitar.forEach(fn=>fn());
 },[api]);
 if(!api)return <div className="turnero-aviso">Esta vista solo funciona dentro de la aplicación del turnero.</div>;
 if(error)return <div className="turnero-aviso">No se pudo cargar el estado del turnero: {error}</div>;
 if(!inicial)return null;
 return <TurneroContext.Provider value={{...inicial,...acciones}}>{children}</TurneroContext.Provider>;
}

export function useTurnero(){const contexto=useContext(TurneroContext);if(!contexto)throw new Error('TurneroProvider es obligatorio');return contexto;}
