export interface YouTubePlayer {
  playVideo(): void;
  setLoop(loop: boolean): void;
  setVolume(volume: number): void;
  unMute(): void;
  mute(): void;
  destroy(): void;
}

/** Inicio seguro: confirmar el volumen vigente antes de quitar silencio o iniciar playback. */
export async function iniciarYouTube(
  player: YouTubePlayer,
  volumen: () => number,
  ajustar: (valor: number, ms: number) => Promise<number>,
  vigente: () => boolean,
): Promise<boolean> {
  player.mute();
  player.setLoop(true);
  while (vigente()) {
    const solicitado = volumen();
    const videos = await ajustar(solicitado, 0);
    if (!vigente()) return false;
    if (solicitado !== volumen()) continue;
    if (videos < 1) throw new Error('YouTube no confirmó el volumen antes de reproducir.');
    player.unMute();
    player.playVideo();
    return true;
  }
  return false;
}
interface PlayerOptions {
  videoId?: string;
  width: string;
  height: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady(event: { target: YouTubePlayer }): void;
    onError(event: { data: number }): void;
    onAutoplayBlocked(): void;
    onStateChange(event: { data: number }): void;
  };
}
interface YouTubeApi {
  Player: new (host: HTMLElement, options: PlayerOptions) => YouTubePlayer;
}
declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}
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
      if (window.YT) resolve(window.YT);
      else fallar();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fallar;
    document.head.append(script);
  }).catch((error) => {
    carga = undefined;
    throw error;
  });
  return carga;
}
