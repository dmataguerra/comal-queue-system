export type Counter = 0 | 1 | 2;
export type TurnStatus = 'ready' | 'delivered' | 'cancelled';

export interface Turn {
  id: string;
  number: string;
  counter: Counter;
  status: TurnStatus;
  createdAt: string;
  readyAt: string;
  lastAnnouncedAt: string;
  rank: number;
}

export interface Announcement {
  id: string;
  turnId: string;
  number: string;
  counter: Counter;
  createdAt: string;
}

export interface Multimedia {
  type: 'fallback' | 'youtube' | 'local';
  url: string | null;
  playlistId: string | null;
  playing: boolean;
  volume: number;
  muted: boolean;
}

export interface Settings {
  announcementSeconds: number;
  autoRotate: boolean;
  footerMessages: string[];
}

export interface Track {
  id: string;
  title: string;
  url: string;
}

export interface Playlist {
  id: string;
  name: string;
  cover: string;
  tracks: Track[];
}

export interface AppState {
  turns: Turn[];
  multimedia: Multimedia;
  playlists: Playlist[];
  settings: Settings;
}
