import { Clip } from './Clip';
import { useMediaRotation } from './useMediaRotation';

interface VideosProps {
  videos: string[];
  volumen: number;
  atenuado: boolean;
  confirmarAtenuacion: () => void;
  alFallar: (url: string) => void;
}

export function Videos({
  videos,
  volumen: volume,
  atenuado: ducked,
  alFallar: onFail,
  confirmarAtenuacion: confirmDucking,
}: VideosProps) {
  const {
    piezas: pieces,
    avanzar: advance,
    precargarSiguiente: preloadNext,
    quitar: remove,
  } = useMediaRotation(videos);
  return (
    <div className="content-stage">
      {pieces.map((piece, index) => (
        <Clip
          key={piece.id}
          url={piece.url}
          activo={index === 0}
          volumen={volume}
          rampa={ducked ? 150 : 400}
          alAjustar={ducked ? confirmDucking : undefined}
          alTerminar={advance}
          alCasiTerminar={preloadNext}
          alFallar={() => {
            onFail(piece.url);
            remove(piece.id);
          }}
        />
      ))}
    </div>
  );
}
