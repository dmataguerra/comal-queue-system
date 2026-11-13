import { useEffect } from 'react';
import type { Config } from '../../shared/contract';
import { useQueue } from '../common/queue-context';
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
  ducked: boolean;
  confirmDucking: () => void;
  log: (message: string) => void;
}

export function MediaContent({
  videos,
  banner,
  config,
  ducked: ducked,
  log: log,
  confirmDucking: confirmDucking,
}: Props) {
  const { informarSalud: reportHealth, youtubeAdmitido: youtubeAllowed } = useQueue();
  const { youtubeAvailable: youtubeAvailable, youtubeFailed: youtubeFailed } =
    useYoutubeAvailability(config.youtubeUrl, reportHealth);
  const { playable: playable, markFailed: markFailed } = useFailedVideos(videos);
  const volume = ducked ? config.volumenMusica * config.atenuacionMusica : config.volumenMusica;
  useEffect(() => {
    if (ducked && !(youtubeAllowed && config.youtubeUrl && youtubeAvailable) && !playable.length)
      confirmDucking();
  }, [
    ducked,
    config.youtubeUrl,
    youtubeAllowed,
    youtubeAvailable,
    playable.length,
    confirmDucking,
  ]);
  if (youtubeAllowed && config.youtubeUrl && youtubeAvailable)
    return (
      <YouTubeVideo
        url={config.youtubeUrl}
        volumen={volume}
        rampa={ducked ? 150 : 400}
        alAjustar={ducked ? confirmDucking : undefined}
        alFallar={youtubeFailed}
      />
    );
  if (playable.length)
    return (
      <Videos
        videos={playable}
        volume={volume}
        ducked={ducked}
        confirmDucking={confirmDucking}
        onFail={(url) => {
          log(`Video no reproducible, se salta: ${mediaName(url)}`);
          markFailed(url);
        }}
      />
    );
  return <Banner imagenes={banner} segundos={config.segundosBanner} />;
}
