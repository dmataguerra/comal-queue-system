import { useEffect } from 'react';
import type { Config } from '../../shared/contract';
import { useTurnero } from '../comun/turnero';
import { YouTubeVideo } from './YouTubeVideo';
import { Banner } from './content/Banner';
import { mediaName } from './content/playlist';
import { useFailedVideos } from './content/useFailedVideos';
import { useYoutubeAvailability } from './content/useYoutubeAvailability';
import { Videos } from './content/Videos';

interface Props {
  videos: string[];
  banner: string[];
  config: Config;
  atenuado: boolean;
  confirmarAtenuacion: () => void;
  registrar: (mensaje: string) => void;
}

export function Contenido({
  videos,
  banner,
  config,
  atenuado,
  registrar,
  confirmarAtenuacion,
}: Props) {
  const { informarSalud, youtubeAdmitido } = useTurnero();
  const { youtubeDisponible, youtubeFallo } = useYoutubeAvailability(
    config.youtubeUrl,
    informarSalud,
  );
  const { reproducibles, marcarFallido } = useFailedVideos(videos);
  const volumen = atenuado ? config.volumenMusica * config.atenuacionMusica : config.volumenMusica;
  useEffect(() => {
    if (
      atenuado &&
      !(youtubeAdmitido && config.youtubeUrl && youtubeDisponible) &&
      !reproducibles.length
    )
      confirmarAtenuacion();
  }, [
    atenuado,
    config.youtubeUrl,
    youtubeAdmitido,
    youtubeDisponible,
    reproducibles.length,
    confirmarAtenuacion,
  ]);
  if (youtubeAdmitido && config.youtubeUrl && youtubeDisponible)
    return (
      <YouTubeVideo
        url={config.youtubeUrl}
        volumen={volumen}
        rampa={atenuado ? 150 : 400}
        alAjustar={atenuado ? confirmarAtenuacion : undefined}
        alFallar={youtubeFallo}
      />
    );
  if (reproducibles.length)
    return (
      <Videos
        videos={reproducibles}
        volumen={volumen}
        atenuado={atenuado}
        confirmarAtenuacion={confirmarAtenuacion}
        alFallar={(url) => {
          registrar(`Video no reproducible, se salta: ${mediaName(url)}`);
          marcarFallido(url);
        }}
      />
    );
  return <Banner imagenes={banner} segundos={config.segundosBanner} />;
}
