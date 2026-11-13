import { useCallback, useEffect, useState } from 'react';

/** Tracks whether YouTube can be played: resets per URL and follows the browser online state. */
export function useYoutubeAvailability(
  youtubeUrl: string | null | undefined,
  informarSalud: (tipo: 'audio' | 'youtube', estado: 'correcto' | 'degradado') => void,
) {
  const [youtubeDisponible, setYoutubeDisponible] = useState(true);
  const youtubeFallo = useCallback(() => setYoutubeDisponible(false), []);
  useEffect(() => {
    setYoutubeDisponible(true);
    const desconectar = () => {
      setYoutubeDisponible(false);
      if (youtubeUrl) informarSalud('youtube', 'degradado');
    };
    const reconectar = () => setYoutubeDisponible(true);
    window.addEventListener('offline', desconectar);
    window.addEventListener('online', reconectar);
    return () => {
      window.removeEventListener('offline', desconectar);
      window.removeEventListener('online', reconectar);
    };
  }, [youtubeUrl, informarSalud]);
  return { youtubeDisponible, youtubeFallo };
}
