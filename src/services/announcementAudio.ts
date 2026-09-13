let context:AudioContext|null=null;
const buffers=new Map<string,Promise<AudioBuffer>>();
function getContext(){return context??(context=new AudioContext());}
function buffer(url:string){if(!buffers.has(url))buffers.set(url,fetch(url).then(r=>{if(!r.ok)throw new Error('Falta un archivo local de anuncio.');return r.arrayBuffer();}).then(b=>getContext().decodeAudioData(b)));return buffers.get(url)!;}
export async function enableAnnouncementAudio(){const ctx=getContext();await ctx.resume();if(ctx.state!=='running')throw new Error('Pulsa de nuevo para activar el audio de esta pantalla.');await Promise.all([buffer('/audio/turns/99.wav'),buffer('/audio/ready.wav'),buffer('/audio/counters/1.wav'),buffer('/audio/counters/2.wav')]);}
export function preloadAnnouncement(number:string,counter:number){return Promise.all([buffer(`/audio/turns/${number}.wav`),buffer(counter?`/audio/counters/${counter}.wav`:'/audio/ready.wav')]);}
export async function playAnnouncement(number:string,counter:number,signal:AbortSignal){
 const ctx=getContext();if(ctx.state!=='running')throw new Error('Activa el audio en esta pantalla.');
 const parts=await preloadAnnouncement(number,counter);if(signal.aborted)return;
 for(const part of parts){if(signal.aborted)break;await new Promise<void>((resolve,reject)=>{
  const source=ctx.createBufferSource();source.buffer=part;const gain=ctx.createGain();gain.gain.value=.95;source.connect(gain);gain.connect(ctx.destination);
  const stop=()=>{try{source.stop();}catch{}resolve();};signal.addEventListener('abort',stop,{once:true});
  source.onended=()=>{signal.removeEventListener('abort',stop);source.disconnect();gain.disconnect();resolve();};
  try{source.start();}catch(e){signal.removeEventListener('abort',stop);reject(e);}
 });}
}
