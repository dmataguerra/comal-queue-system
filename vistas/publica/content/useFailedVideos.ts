import { useCallback, useEffect, useMemo, useState } from 'react';

/** Remembers videos that failed to play and exposes only the playable ones. */
export function useFailedVideos(videos: string[]) {
  const [fallidos, setFallidos] = useState(new Set<string>());
  useEffect(() => setFallidos(new Set()), [videos]);
  const reproducibles = useMemo(
    () => videos.filter((url) => !fallidos.has(url)),
    [videos, fallidos],
  );
  const marcarFallido = useCallback(
    (url: string) => setFallidos((previos) => new Set(previos).add(url)),
    [],
  );
  return { reproducibles, marcarFallido };
}
