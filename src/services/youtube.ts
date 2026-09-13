export function parseYouTube(value:string):{videoId?:string;playlistId?:string} {
 let url:URL;try{url=new URL(value.trim());}catch{throw new Error('Introduce una URL válida de YouTube.');}
 const host=url.hostname.toLowerCase().replace(/^www\./,'');
 if(!['youtube.com','m.youtube.com','music.youtube.com','youtu.be'].includes(host)||!['https:','http:'].includes(url.protocol))throw new Error('Solo se aceptan enlaces de youtube.com o youtu.be.');
 const list=url.searchParams.get('list');const id=host==='youtu.be'?url.pathname.split('/')[1]:url.searchParams.get('v')||(/^\/(?:embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[1]);
 if(list&&/^[a-zA-Z0-9_-]{10,120}$/.test(list))return{playlistId:list};
 if(id&&/^[a-zA-Z0-9_-]{11}$/.test(id))return{videoId:id};
 throw new Error('El enlace debe contener un video o una playlist de YouTube.');
}
let loading:Promise<void>|null=null;
export function loadYouTubeAPI():Promise<void> {
 if(window.YT?.Player)return Promise.resolve();
 if(loading)return loading;
 loading=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
  const timeout=setTimeout(()=>{script.remove();loading=null;reject(new Error('YouTube no está disponible.'));},10000);
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);resolve();};
  script.onerror=()=>{clearTimeout(timeout);script.remove();loading=null;reject(new Error('No se pudo conectar con YouTube.'));};
  document.head.append(script);
 });return loading;
}
