import { createContext,useContext,useEffect,useRef,useState,type ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Announcement,SystemState } from '../types';
interface SystemContext {state:SystemState|null;connected:boolean;subscribe:(fn:(event:Announcement)=>void)=>()=>void}
const Context=createContext<SystemContext|null>(null);
export function SystemProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<SystemState|null>(null),[connected,setConnected]=useState(false);
 const listeners=useRef(new Set<(event:Announcement)=>void>());
 useEffect(()=>{
  const socket=io({transports:['websocket'],reconnection:true,reconnectionDelay:800,reconnectionDelayMax:5000});
  socket.on('state',(next:SystemState)=>{setState(next);setConnected(socket.connected);});
  socket.on('connect',()=>setConnected(true));socket.on('disconnect',()=>setConnected(false));socket.on('connect_error',()=>setConnected(false));
  socket.on('announcement',(event:Announcement)=>listeners.current.forEach(fn=>fn(event)));
  return()=>{socket.disconnect();};
 },[]);
 return <Context.Provider value={{state,connected,subscribe:fn=>{listeners.current.add(fn);return()=>{listeners.current.delete(fn);};}}}>{children}</Context.Provider>;
}
export function useSystem(){const context=useContext(Context);if(!context)throw new Error('SystemProvider is required');return context;}
