export interface YouTubePlayer {
  playVideo(): void;
  setLoop(loop: boolean): void;
  setVolume(volume: number): void;
  unMute(): void;
  mute(): void;
  destroy(): void;
}
export async function startYouTube(
  player: YouTubePlayer,
  volumeLevel: () => number,
  adjust: (value: number, ms: number) => Promise<number>,
  live: () => boolean,
): Promise<boolean> {
  player.mute();
  player.setLoop(true);
  while (live()) {
    const requested = volumeLevel();
    const videos = await adjust(requested, 0);
    if (!live()) return false;
    if (requested !== volumeLevel()) continue;
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
let loading: Promise<YouTubeApi> | undefined;
export function loadYouTube(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(), 15000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      delete window.onYouTubeIframeAPIReady;
      reject(new Error('No se pudo conectar con YouTube. Comprueba la conexión a internet.'));
    }
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (window.YT) resolve(window.YT);
      else fail();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fail;
    document.head.append(script);
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
