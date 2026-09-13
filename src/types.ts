export type Counter = 0 | 1 | 2;
export interface Turn { id: string; number: string; counter: Counter; status: 'ready'|'delivered'|'cancelled'; createdAt: number; readyAt: number; lastAnnouncedAt: number; rank: number }
export interface Announcement { id: string; turnId: string; number: string; counter: Counter; createdAt: number }
export interface Track { id: string; title: string; url: string; duration?: number }
export interface Playlist { id: string; name: string; cover: string; tracks: Track[] }
export interface Multimedia { type: 'fallback'|'youtube'|'local'; url: string|null; playlistId: string|null; playing: boolean; volume: number; muted: boolean }
export interface Settings { announcementSeconds: number; footerMessages: string[]; autoRotate?: boolean }
export interface SystemState { turns: Turn[]; multimedia: Multimedia; playlists: Playlist[]; settings: Settings }
export interface YouTubePlayer {
  playVideo(): void; pauseVideo():void; mute():void; unMute():void; isMuted():boolean;
  setVolume(v:number):void; getVolume():number; getCurrentTime():number; getPlayerState():number;
  loadVideoById(id:string):void; loadPlaylist(options:{listType:string;list:string}):void;
  setLoop(loop:boolean):void; destroy():void;
}
declare global {
  interface Window {
    YT?: {Player: new (el:HTMLElement,options:Record<string,unknown>)=>YouTubePlayer};
    onYouTubeIframeAPIReady?:()=>void;
  }
}
