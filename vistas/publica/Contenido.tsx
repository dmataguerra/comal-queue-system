import {useEffect,useMemo,useRef,useState} from 'react';
import type {Config} from '../../main/contrato';
import {TrojanMascot} from '../comun/components/TrojanMascot';

interface Props {videos:string[];banner:string[];config:Config;atenuado:boolean;registrar:(mensaje:string)=>void}

const nombre=(url:string)=>decodeURIComponent(url.split('/').pop()??url);

/** Fisher–Yates. Al rebarajar, el primero nunca es el que acaba de sonar. */
function barajar(lista:string[],evitar?:string){
 const bolsa=[...lista];
 for(let i=bolsa.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bolsa[i],bolsa[j]]=[bolsa[j],bolsa[i]];}
 if(bolsa.length>1&&bolsa[0]===evitar)[bolsa[0],bolsa[1]]=[bolsa[1],bolsa[0]];
 return bolsa;
}

/** CU-04 · videos locales en bolsa aleatoria; sin videos (o si todos fallan), modo banner (RF-12). */
export function Contenido({videos,banner,config,atenuado,registrar}:Props){
 const [fallidos,setFallidos]=useState(new Set<string>());
 useEffect(()=>setFallidos(new Set()),[videos]);
 const reproducibles=useMemo(()=>videos.filter(url=>!fallidos.has(url)),[videos,fallidos]);
 const volumen=atenuado?config.volumenMusica*config.atenuacionMusica:config.volumenMusica;
 if(reproducibles.length)return <Videos videos={reproducibles} volumen={volumen} atenuado={atenuado} alFallar={url=>{registrar(`Video no reproducible, se salta: ${nombre(url)}`);setFallidos(previos=>new Set(previos).add(url));}}/>;
 return <Banner imagenes={banner} segundos={config.segundosBanner}/>;
}

interface Pieza {id:number;url:string}

function Videos({videos,volumen,atenuado,alFallar}:{videos:string[];volumen:number;atenuado:boolean;alFallar:(url:string)=>void}){
 const bolsa=useRef<string[]>([]),contador=useRef(0);
 const tomar=(anterior?:string)=>{
  bolsa.current=bolsa.current.filter(url=>videos.includes(url));
  if(!bolsa.current.length)bolsa.current=barajar(videos,anterior);
  return {id:++contador.current,url:bolsa.current.shift()!};
 };
 // [0] es el clip en pantalla; [1], si existe, el siguiente precargado en oculto (§8 medida 2).
 const [piezas,setPiezas]=useState<Pieza[]>(()=>[tomar()]);
 // Si el administrador borra el video en curso, o un clip falla, se pasa al siguiente sin reiniciar la app.
 useEffect(()=>{setPiezas(actuales=>{
  const vigentes=actuales.filter(pieza=>videos.includes(pieza.url));
  if(!vigentes.length)return [tomar()];
  return vigentes.length===actuales.length?actuales:vigentes;
 });},[videos,piezas.length]);
 const avanzar=()=>setPiezas(([actual,siguiente])=>[siguiente??tomar(actual?.url)]);
 const precargarSiguiente=()=>setPiezas(actuales=>actuales.length>1?actuales:[...actuales,tomar(actuales[0]?.url)]);
 return <div className="content-stage">{piezas.map((pieza,indice)=><Clip key={pieza.id} url={pieza.url} activo={indice===0} volumen={volumen} rampa={atenuado?150:400} alTerminar={avanzar} alCasiTerminar={precargarSiguiente} alFallar={()=>{alFallar(pieza.url);setPiezas(actuales=>actuales.filter(p=>p.id!==pieza.id));}}/>)}</div>;
}

interface ClipProps {url:string;activo:boolean;volumen:number;rampa:number;alTerminar:()=>void;alCasiTerminar:()=>void;alFallar:()=>void}

/** Un <video> nuevo por clip; al salir se libera su decodificador (§8 medida 1). */
function Clip({url,activo,volumen,rampa,alTerminar,alCasiTerminar,alFallar}:ClipProps){
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const video=ref.current!;return()=>{video.pause();video.removeAttribute('src');video.load();};},[]);
 useEffect(()=>{
  const video=ref.current!;
  if(!activo){video.pause();return;}
  video.volume=volumen;
  void video.play().catch(()=>{});
 },[activo]); // el volumen al activarse; los cambios posteriores los lleva la rampa
 // RF-11 · el volumen se interpola: 150 ms al atenuar, 400 ms al restaurar.
 useEffect(()=>{
  const video=ref.current!;if(!activo)return;
  const desde=video.volume,inicio=performance.now();let cuadro=0;
  const paso=(ahora:number)=>{const t=Math.min(1,(ahora-inicio)/rampa);video.volume=desde+(volumen-desde)*t;if(t<1)cuadro=requestAnimationFrame(paso);};
  cuadro=requestAnimationFrame(paso);
  return()=>cancelAnimationFrame(cuadro);
 },[volumen,rampa,activo]);
 return <video ref={ref} className={`content-video ${activo?'visible':''}`} src={url} preload="auto" playsInline muted={!activo}
  onEnded={activo?alTerminar:undefined} onError={alFallar}
  onTimeUpdate={activo?e=>{const video=e.currentTarget;if(video.duration-video.currentTime<5)alCasiTerminar();}:undefined}/>;
}

function Banner({imagenes,segundos}:{imagenes:string[];segundos:number}){
 const [indice,setIndice]=useState(0);
 useEffect(()=>{
  if(imagenes.length<2)return;
  const id=setInterval(()=>setIndice(i=>(i+1)%imagenes.length),segundos*1000);
  return()=>clearInterval(id);
 },[imagenes.length,segundos]);
 return <div className="content-stage banner-stage" role="region" aria-label="Imágenes de la Facultad de Informática">
  {imagenes.map((src,i)=><img key={src} src={src} alt="" className={i===indice%imagenes.length?'visible':''}/>)}
  {!imagenes.length&&<div className="banner-logos"><img src="/assets/troyanos-logo.png" alt="Troyanos"/><img src="/assets/uaq-informatica-logo.png" alt="Facultad de Informática UAQ"/></div>}
  <TrojanMascot/>
 </div>;
}
