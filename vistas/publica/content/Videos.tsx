import { Clip } from './Clip';
import { useMediaRotation } from './useMediaRotation';

interface VideosProps {
  videos: string[];
  volumen: number;
  atenuado: boolean;
  confirmarAtenuacion: () => void;
  alFallar: (url: string) => void;
}

export function Videos({ videos, volumen, atenuado, alFallar, confirmarAtenuacion }: VideosProps) {
  const { piezas, avanzar, precargarSiguiente, quitar } = useMediaRotation(videos);
  return (
    <div className="content-stage">
      {piezas.map((pieza, indice) => (
        <Clip
          key={pieza.id}
          url={pieza.url}
          activo={indice === 0}
          volumen={volumen}
          rampa={atenuado ? 150 : 400}
          alAjustar={atenuado ? confirmarAtenuacion : undefined}
          alTerminar={avanzar}
          alCasiTerminar={precargarSiguiente}
          alFallar={() => {
            alFallar(pieza.url);
            quitar(pieza.id);
          }}
        />
      ))}
    </div>
  );
}
