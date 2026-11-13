export interface YouTubeSource {
  videoId?: string;
  playlistId?: string;
}
export function parseYouTube(input: string): YouTubeSource {
  const url = new URL(input.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw new Error('Usa un enlace HTTPS de YouTube.');
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let videoId: string | undefined;
  let playlistId: string | undefined;
  if (host === 'youtu.be') videoId = parts[0];
  else if (
    ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)
  ) {
    videoId =
      url.pathname === '/watch'
        ? (url.searchParams.get('v') ?? undefined)
        : ['embed', 'shorts', 'live'].includes(parts[0])
          ? parts[1]
          : undefined;
    if (videoId === 'videoseries') videoId = undefined;
    playlistId = url.searchParams.get('list') ?? undefined;
  } else throw new Error('El enlace debe ser de YouTube.');
  if (
    (videoId && !/^[\w-]{11}$/.test(videoId)) ||
    (playlistId && !/^[\w-]{10,100}$/.test(playlistId)) ||
    (!videoId && !playlistId)
  ) {
    throw new Error('Introduce un enlace válido de video o playlist de YouTube.');
  }
  return { videoId, playlistId };
}
export function isYouTube(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    parseYouTube(value);
    return true;
  } catch {
    return false;
  }
}
