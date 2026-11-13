import { useCallback, useEffect, useRef, useState } from 'react';
import { shuffle } from './playlist';

export interface Piece {
  id: number;
  url: string;
}

/**
 * Shuffled-bag video rotation. Keeps the current piece plus an optional preloaded next one.
 */
export function useMediaRotation(videos: string[]) {
  const bag = useRef<string[]>([]),
    counter = useRef(0);
  const take = useCallback(
    (previous?: string) => {
      bag.current = bag.current.filter((url) => videos.includes(url));
      if (!bag.current.length) bag.current = shuffle(videos, previous);
      return { id: ++counter.current, url: bag.current.shift()! };
    },
    [videos],
  );
  const [pieces, setPieces] = useState<Piece[]>(() => [take()]);
  useEffect(() => {
    setPieces((currentPieces) => {
      const live = currentPieces.filter((piece) => videos.includes(piece.url));
      if (!live.length) return [take()];
      return live.length === currentPieces.length ? currentPieces : live;
    });
  }, [videos, pieces.length, take]);
  const advance = () => setPieces(([current, next]) => [next ?? take(current?.url)]);
  const preloadNext = () =>
    setPieces((currentPieces) =>
      currentPieces.length > 1 ? currentPieces : [...currentPieces, take(currentPieces[0]?.url)],
    );
  const remove = (id: number) =>
    setPieces((currentPieces) => currentPieces.filter((p) => p.id !== id));
  return { pieces: pieces, advance: advance, preloadNext: preloadNext, remove: remove };
}
