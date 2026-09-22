export interface YouTubePlayer {
  playVideo(): void;
  setLoop(loop: boolean): void;
  setVolume(volume: number): void;
  unMute(): void;
  destroy(): void;
}
interface PlayerOptions {
  videoId?: string;
  width: string;
  height: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady(event: {target: YouTubePlayer}): void;
    onError(event: {data: number}): void;
    onAutoplayBlocked(): void;
  };
}
interface YouTubeApi { Player: new (host: HTMLElement, options: PlayerOptions) => YouTubePlayer }
declare global { interface Window { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void } }
let carga: Promise<YouTubeApi> | undefined;

export function cargarYouTube(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (carga) return carga;
  carga = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement('script');
    const temporizador = setTimeout(() => fallar(), 15000);
    function fallar() {
      clearTimeout(temporizador);
      script.remove();
      delete window.onYouTubeIframeAPIReady;
      reject(new Error('No se pudo conectar con YouTube. Comprueba la conexión a internet.'));
    }
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(temporizador);
      if (window.YT) resolve(window.YT); else fallar();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fallar;
    document.head.append(script);
  }).catch(error => { carga = undefined; throw error; });
  return carga;
}
