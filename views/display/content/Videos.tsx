import { Clip } from './Clip';
import { useMediaRotation } from './useMediaRotation';

interface VideosProps {
  videos: string[];
  volume: number;
  ducked: boolean;
  confirmDucking: () => void;
  onFail: (url: string) => void;
}

export function Videos({
  videos,
  volume: volume,
  ducked: ducked,
  onFail: onFail,
  confirmDucking: confirmDucking,
}: VideosProps) {
  const {
    pieces: pieces,
    advance: advance,
    preloadNext: preloadNext,
    remove: remove,
  } = useMediaRotation(videos);
  return (
    <div className="content-stage">
      {pieces.map((piece, index) => (
        <Clip
          key={piece.id}
          url={piece.url}
          active={index === 0}
          volume={volume}
          ramp={ducked ? 150 : 400}
          onAdjust={ducked ? confirmDucking : undefined}
          onEnded={advance}
          onNearEnd={preloadNext}
          onFail={() => {
            onFail(piece.url);
            remove(piece.id);
          }}
        />
      ))}
    </div>
  );
}
