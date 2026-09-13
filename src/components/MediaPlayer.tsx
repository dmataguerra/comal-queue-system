import {useEffect,useRef,useState} from 'react';
import type {Multimedia,Playlist,YouTubePlayer} from '../types';
import {loadYouTubeAPI,parseYouTube} from '../services/youtube';
import {Icon} from './Icon';
interface Props {config:Multimedia;playlists:Playlist[];ducked:boolean;audioEnabled:boolean}
export function MediaPlayer({config,playlists,ducked,audioEnabled}:Props){
 const host=useRef<HTMLDivElement>(null),player=useRef<YouTubePlayer|null>(null),audio=useRef<HTMLAudioElement>(null);
 const [error,setError]=useState(''),[blocked,setBlocked]=useState(false),[youtubeReady,setYoutubeReady]=useState(false),[trackIndex,setTrackIndex]=useState(0),[retry,setRetry]=useState(0);
 const [playerStatus,setPlayerStatus]=useState(''),[playbackTime,setPlaybackTime]=useState(0);
 const [online,setOnline]=useState(navigator.onLine);
 const latest=useRef({config,ducked,audioEnabled});latest.current={config,ducked,audioEnabled};
 const previousMute=useRef<{muted:boolean;volume:number}|null>(null);
 const playlist=playlists.find(p=>p.id===config.playlistId),tracks=playlist?.tracks??[],track=tracks[trackIndex%Math.max(1,tracks.length)];
 useEffect(()=>{const yes=()=>setOnline(true),no=()=>setOnline(false);window.addEventListener('online',yes);window.addEventListener('offline',no);return()=>{window.removeEventListener('online',yes);window.removeEventListener('offline',no);};},[]);
 useEffect(()=>{setTrackIndex(0);setError('');setBlocked(false);},[config.type,config.playlistId,config.url]);
 useEffect(()=>{
  if(config.type!=='youtube'||!config.url||!online)return;
  let disposed=false,watchdog:ReturnType<typeof setTimeout>|undefined;setError('');setYoutubeReady(false);setPlayerStatus('Cargando YouTube');
  async function initialize(){try{
   const source=parseYouTube(config.url!);await loadYouTubeAPI();if(disposed||!host.current||!window.YT)return;
   const mount=document.createElement('div');host.current.replaceChildren(mount);
   const p=new window.YT.Player(mount,{width:'100%',height:'100%',videoId:source.videoId,playerVars:{autoplay:1,mute:1,playsinline:1,controls:1,rel:0,origin:window.location.origin,...(source.playlistId?{listType:'playlist',list:source.playlistId}:{})},events:{
    onReady:()=>{if(disposed)return;player.current=p;setYoutubeReady(true);p.setVolume(latest.current.config.volume);if(latest.current.ducked||!latest.current.audioEnabled||latest.current.config.muted)p.mute();else p.unMute();p.setLoop(true);if(latest.current.config.playing)p.playVideo();else p.pauseVideo();},
    onStateChange:(event:{data:number})=>{if(disposed)return;if(event.data===1){setError('');setBlocked(false);clearTimeout(watchdog);setPlayerStatus('Reproduciendo');}else if(event.data===2)setPlayerStatus('En pausa');else if(event.data===3)setPlayerStatus('Cargando');else if(event.data===0)setPlayerStatus('Finalizado');},
    onError:(event:{data:number})=>{if(disposed)return;clearTimeout(watchdog);setError([101,150].includes(event.data)?'El autor no permite reproducir este contenido aquí. Selecciona otro video.':event.data===153?'YouTube no pudo validar este reproductor. La pantalla local sigue disponible.':'Este contenido de YouTube no está disponible.');setPlayerStatus('No disponible');},
    onAutoplayBlocked:()=>{if(!disposed){setBlocked(true);setPlayerStatus('Pulsa reproducir');}}
   }});
   player.current=p;watchdog=setTimeout(()=>{if(!disposed&&p.getPlayerState?.()!==1){setError('YouTube no respondió. Puedes seguir usando los turnos y la música local.');setBlocked(true);}},18000);
  }catch(e){if(!disposed)setError((e as Error).message);}}
  void initialize();return()=>{disposed=true;clearTimeout(watchdog);player.current?.destroy();player.current=null;setYoutubeReady(false);};
 },[config.type,config.url,online,retry]);
 useEffect(()=>{if(!player.current||!youtubeReady)return;if(config.playing)player.current.playVideo();else player.current.pauseVideo();},[config.playing,youtubeReady]);
 useEffect(()=>{
  if(!player.current||!youtubeReady||ducked)return;player.current.setVolume(config.volume);if(config.muted||!audioEnabled)player.current.mute();else player.current.unMute();
 },[config.volume,config.muted,audioEnabled,youtubeReady,ducked]);
 useEffect(()=>{
  const p=player.current;
  if(p&&youtubeReady){if(ducked){if(!previousMute.current)previousMute.current={muted:p.isMuted(),volume:p.getVolume()};p.mute();}else if(previousMute.current){const saved=previousMute.current;previousMute.current=null;p.setVolume(saved.volume);if(saved.muted||!audioEnabled||config.muted)p.mute();else p.unMute();}}
 },[ducked,youtubeReady,audioEnabled,config.muted]);
 useEffect(()=>{
  const el=audio.current;if(!el||config.type!=='local'||!track)return;
  el.volume=Math.min(1,Math.max(0,config.volume/100));el.muted=ducked||config.muted||!audioEnabled;
 },[config.volume,config.muted,audioEnabled,ducked,config.type,track]);
 useEffect(()=>{
  const el=audio.current;if(!el||config.type!=='local')return;
  if(config.playing)void el.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));else el.pause();
 },[config.playing,config.type,track?.url,audioEnabled]);
 useEffect(()=>{const id=setInterval(()=>{if(config.type==='youtube'&&player.current?.getCurrentTime)setPlaybackTime(player.current.getCurrentTime());else if(config.type==='local'&&audio.current)setPlaybackTime(audio.current.currentTime);},500);return()=>clearInterval(id);},[config.type]);
 function resume(){if(config.type==='youtube'){if(error){setRetry(x=>x+1);return;}player.current?.playVideo();if(audioEnabled&&!ducked&&!config.muted)player.current?.unMute();setBlocked(false);}else{void audio.current?.play().then(()=>setBlocked(false));}}
 const fallback=config.type!=='youtube'||!online||Boolean(error);
 return <div className="media-stage" data-media-type={config.type} data-muted={ducked||config.muted||!audioEnabled} data-playback-time={playbackTime.toFixed(1)} data-player-status={playerStatus}>
  <div className={`coffee-fallback ${fallback?'visible':''}`} role="img" aria-hidden={!fallback} aria-label="Café servido en una cafetería"/>
  {config.type==='youtube'&&online&&<div ref={host} className={`youtube-host ${error?'has-error':''}`} aria-label="Reproductor de YouTube"/>}
  {config.type==='local'&&track&&<audio ref={audio} src={track.url} preload="auto" onEnded={()=>setTrackIndex(index=>(index+1)%tracks.length)} onError={()=>{setError('No se pudo reproducir esta pista local. Comprueba el archivo en la biblioteca.');}}/>}
  {config.type==='local'&&track&&<div className="local-now-playing"><Icon name="music"/><div><span>{playlist?.name}</span><strong>{track.title}</strong></div><span className={`equalizer ${config.playing?'playing':''}`} aria-label={config.playing?'Música en reproducción':'Música en pausa'}><i/><i/><i/><i/></span></div>}
  {((config.type==='youtube'&&(!online||error))||(config.type==='local'&&error))&&<div className="media-unavailable"><Icon name="info"/><span>{!online?'Sin internet · Los turnos siguen funcionando':error}</span>{online&&config.type==='youtube'&&<button onClick={()=>setRetry(x=>x+1)}>Reintentar</button>}</div>}
  {blocked&&!error&&<button className="media-play-prompt" onClick={resume}><Icon name="play"/>Iniciar reproducción</button>}
 </div>;
}
