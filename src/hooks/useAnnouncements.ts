import {useEffect,useRef,useState} from 'react';
import {useSystem} from './useSystem';
import {enableAnnouncementAudio,playAnnouncement,preloadAnnouncement} from '../services/announcementAudio';
import type {Announcement} from '../types';
export function useAnnouncements(){
 const {state,subscribe,connected}=useSystem();
 const [current,setCurrent]=useState<Announcement|null>(null),[audioEnabled,setAudioEnabled]=useState(false),[audioError,setAudioError]=useState('');
 const queue=useRef<Announcement[]>([]),seen=useRef(new Set<string>()),busy=useRef(false),live=useRef(true),abort=useRef<AbortController|null>(null);
 const latest=useRef({state,audioEnabled});latest.current={state,audioEnabled};
 const run=useRef<()=>void>(()=>{});
 run.current=()=>{
  if(busy.current||!live.current)return;let event=queue.current.shift();
  while(event&&!latest.current.state?.turns.some(t=>t.id===event!.turnId))event=queue.current.shift();if(!event)return;
  busy.current=true;setCurrent(event);const controller=new AbortController();abort.current=controller;
  const duration=(latest.current.state?.settings.announcementSeconds??6)*1000;
  const audio=latest.current.audioEnabled?playAnnouncement(event.number,event.counter,controller.signal).catch(e=>{if(!controller.signal.aborted)setAudioError(e.message);}):Promise.resolve();
  Promise.all([new Promise(resolve=>setTimeout(resolve,duration)),audio]).finally(()=>{
   if(!live.current)return;setCurrent(null);busy.current=false;abort.current=null;setTimeout(()=>run.current(),160);
  });
 };
 useEffect(()=>subscribe(event=>{if(seen.current.has(event.id))return;seen.current.add(event.id);if(seen.current.size>1000)seen.current.delete(seen.current.values().next().value!);queue.current.push(event);if(latest.current.audioEnabled)void preloadAnnouncement(event.number,event.counter).catch(()=>{});run.current();}),[subscribe]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;queue.current=[];abort.current?.abort();};},[]);
 useEffect(()=>{if(!connected){queue.current=[];abort.current?.abort();setCurrent(null);}},[connected]);
 useEffect(()=>{if(current&&state&&!state.turns.some(t=>t.id===current.turnId)){abort.current?.abort();setCurrent(null);}},[state,current]);
 async function enableAudio(){try{await enableAnnouncementAudio();setAudioEnabled(true);setAudioError('');}catch(e){setAudioError((e as Error).message);}}
 async function testAudio(){try{await enableAnnouncementAudio();setAudioEnabled(true);setAudioError('');await playAnnouncement('99',1,new AbortController().signal);}catch(e){setAudioError((e as Error).message);}}
 return{current,audioEnabled,audioError,enableAudio,testAudio};
}
