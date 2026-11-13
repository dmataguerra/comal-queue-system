import { useCallback, useEffect, useMemo, useState } from 'react';

/** Remembers videos that failed to play and exposes only the playable ones. */
export function useFailedVideos(videos: string[]) {
  const [failed, setFailed] = useState(new Set<string>());
  useEffect(() => setFailed(new Set()), [videos]);
  const playable = useMemo(() => videos.filter((url) => !failed.has(url)), [videos, failed]);
  const markFailed = useCallback(
    (url: string) => setFailed((previous) => new Set(previous).add(url)),
    [],
  );
  return { playable: playable, markFailed: markFailed };
}
