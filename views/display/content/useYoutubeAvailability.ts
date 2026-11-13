import { useCallback, useEffect, useState } from 'react';

/** Tracks whether YouTube can be played: resets per URL and follows the browser online state. */
export function useYoutubeAvailability(
  youtubeUrl: string | null | undefined,
  reportHealth: (kind: 'audio' | 'youtube', status: 'correcto' | 'degradado') => void,
) {
  const [youtubeAvailable, setYoutubeAvailable] = useState(true);
  const youtubeFailed = useCallback(() => setYoutubeAvailable(false), []);
  useEffect(() => {
    setYoutubeAvailable(true);
    const disconnect = () => {
      setYoutubeAvailable(false);
      if (youtubeUrl) reportHealth('youtube', 'degradado');
    };
    const reconnect = () => setYoutubeAvailable(true);
    window.addEventListener('offline', disconnect);
    window.addEventListener('online', reconnect);
    return () => {
      window.removeEventListener('offline', disconnect);
      window.removeEventListener('online', reconnect);
    };
  }, [youtubeUrl, reportHealth]);
  return { youtubeAvailable: youtubeAvailable, youtubeFailed: youtubeFailed };
}
