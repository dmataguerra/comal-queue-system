export interface FuenteYouTube {
  videoId?: string;
  playlistId?: string;
}

/** Solo acepta URLs de YouTube e identificadores válidos; nunca ejecuta la URL recibida. */
export function parseYouTube(entrada: string): FuenteYouTube {
  const url = new URL(entrada.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw new Error('Usa un enlace HTTPS de YouTube.');
  const host = url.hostname.toLowerCase();
  const partes = url.pathname.split('/').filter(Boolean);
  let videoId: string | undefined;
  let playlistId: string | undefined;
  if (host === 'youtu.be') videoId = partes[0];
  else if (
    ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)
  ) {
    videoId =
      url.pathname === '/watch'
        ? (url.searchParams.get('v') ?? undefined)
        : ['embed', 'shorts', 'live'].includes(partes[0])
          ? partes[1]
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

export function esYouTube(valor: unknown): valor is string {
  if (typeof valor !== 'string' || valor.length > 2000) return false;
  try {
    parseYouTube(valor);
    return true;
  } catch {
    return false;
  }
}
