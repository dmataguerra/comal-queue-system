import { useState } from 'react';
import './multimedia.css';
import { YouTubePanel } from './YouTubePanel';
import type { ContentCategory } from '../../shared/contract';
import { Icon } from '../common/components/Icon';
import { useQueue } from '../common/queue-context';
const fileName = (url: string) => decodeURIComponent(url.split('/').pop() ?? url);
const FORMATS: Record<
  ContentCategory,
  {
    extensiones: string[];
    nombres: string;
  }
> = {
  videos: { extensiones: ['mp4', 'webm'], nombres: 'MP4 o WebM' },
  banner: { extensiones: ['jpg', 'jpeg', 'png', 'webp'], nombres: 'JPG, PNG o WebP' },
};
function skipReason(category: ContentCategory, name: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const { extensiones: extensions, nombres: names } = FORMATS[category];
  return extensions.includes(extension)
    ? `“${name}” no se agregó: el archivo está vacío o incompleto. Espera a que termine de descargarse y vuelve a intentarlo.`
    : `“${name}” no se agregó: formato no admitido (usa ${names}).`;
}
function MediaFileRow({
  url,
  esVideo: isVideo,
  ocupado: busy,
  quitar: remove,
}: {
  url: string;
  esVideo: boolean;
  ocupado: boolean;
  quitar: (url: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const name = fileName(url);
  return (
    <article className={`media-file ${failed ? 'broken' : ''}`}>
      <div className="media-preview">
        {isVideo ? (
          <video src={url} muted preload="metadata" onError={() => setFailed(true)} />
        ) : (
          <img src={url} alt="" onError={() => setFailed(true)} />
        )}
        <span>
          <Icon name={failed ? 'warning' : isVideo ? 'play' : 'image'} />
        </span>
      </div>
      <div className="media-file-info">
        <strong title={name}>{name}</strong>
        <small>
          {failed
            ? 'No se puede mostrar: quítalo y vuelve a subirlo'
            : isVideo
              ? 'Video de la rotación'
              : 'Imagen del carrusel'}
        </small>
      </div>
      <button
        className="icon-button media-remove"
        disabled={busy}
        onClick={() => remove(url)}
        aria-label={`Quitar ${name}`}
        title={`Quitar ${name}`}
      >
        <Icon name="trash" />
      </button>
    </article>
  );
}
interface LibraryProps {
  category: ContentCategory;
  title: string;
  description: string;
  requirements: string;
  notice?: string;
  files: string[];
  busy: boolean;
  onAdd: (category: ContentCategory) => void;
  onRemove: (url: string) => void;
}
function Library({
  category: category,
  title: title,
  description: description,
  requirements: requirements,
  notice: notice,
  files: files,
  busy: busy,
  onAdd: add,
  onRemove: remove,
}: LibraryProps) {
  const isVideo = category === 'videos';
  return (
    <section className="panel media-library-panel">
      <div className="media-library-heading">
        <span className="section-icon">
          <Icon name={isVideo ? 'media' : 'image'} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="media-count">
          {files.length} {files.length === 1 ? 'archivo' : 'archivos'}
        </span>
      </div>
      <div className="media-actions">
        <button className="button primary" disabled={busy} onClick={() => add(category)}>
          <Icon name="plus" />
          Agregar {isVideo ? 'videos' : 'imágenes'}
        </button>
        <span className="media-requirements">{requirements}</span>
      </div>
      {notice && (
        <p className="media-library-notice">
          <Icon name="info" />
          {notice}
        </p>
      )}
      {files.length ? (
        <div className="media-file-grid">
          {files.map((url) => (
            <MediaFileRow key={url} url={url} esVideo={isVideo} ocupado={busy} quitar={remove} />
          ))}
        </div>
      ) : (
        <div className="media-empty">
          <Icon name={isVideo ? 'media' : 'image'} />
          <div>
            <strong>{isVideo ? 'No hay videos cargados' : 'No hay imágenes cargadas'}</strong>
            <p>
              {isVideo
                ? 'La pantalla 2 mostrará el carrusel de imágenes.'
                : 'Si tampoco hay videos, se mostrarán los logotipos de bienvenida.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
export function MultimediaPanel({
  notificar: notify,
}: {
  notificar: (message: string, error?: boolean) => void;
}) {
  const {
    inventario: inventory,
    config,
    importarContenido: importContent,
    quitarContenido: removeContent,
  } = useQueue();
  const [busy, setBusy] = useState(false);
  async function add(category: ContentCategory) {
    setBusy(true);
    try {
      const {
        agregados: added,
        omitidos: skipped,
        cancelado: canceled,
        motivos: reasonMap,
      } = await importContent(category);
      if (canceled) return;
      const reasonText = skipped
        .map((name) => reasonMap?.[name] ?? skipReason(category, name))
        .join(' ');
      if (added.length) {
        const count = added.length;
        notify(
          `${count} ${count === 1 ? 'archivo agregado' : 'archivos agregados'} a la pantalla 2.${reasonText ? ` ${reasonText}` : ''}`,
          skipped.length > 0,
        );
      } else notify(reasonText || 'No se agregó ningún archivo.', true);
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(url: string) {
    const name = fileName(url);
    if (
      !window.confirm(
        `¿Quitar “${name}” de la pantalla 2? El archivo se eliminará de la carpeta de contenido.`,
      )
    )
      return;
    setBusy(true);
    try {
      const removed = await removeContent(url);
      notify(
        removed ? `${name} se quitó de la pantalla 2.` : 'El archivo ya no estaba disponible.',
        !removed,
      );
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="multimedia-workspace">
      <YouTubePanel notificar={notify} />
      <div className="media-library-layout">
        <Library
          category="videos"
          title="Videos"
          description="Se reproducen en orden aleatorio y de forma continua."
          requirements="MP4 (H.264) o WebM · hasta 1080p"
          files={inventory.videos}
          busy={busy}
          onAdd={(category) => void add(category)}
          onRemove={(url) => void remove(url)}
        />
        <Library
          category="banner"
          title="Imágenes"
          description="Aparecen como carrusel cuando no hay videos disponibles."
          requirements="JPG, PNG o WebP · 1920 × 1080 recomendado"
          notice={
            config.youtubeUrl || inventory.videos.length
              ? config.youtubeUrl
                ? 'YouTube está seleccionado. Si no está disponible, la TV intenta reproducir los videos locales; si tampoco se pueden reproducir, muestra las imágenes de respaldo.'
                : 'La TV intenta reproducir los videos locales. Si todos fallan, muestra las imágenes de respaldo.'
              : undefined
          }
          files={inventory.banner}
          busy={busy}
          onAdd={(category) => void add(category)}
          onRemove={(url) => void remove(url)}
        />
      </div>
      <div className="media-note">
        <Icon name="info" />
        <p>
          Espera a que el archivo termine de descargarse antes de agregarlo. Si agregas uno con el
          mismo nombre, se conserva el anterior y se crea una copia numerada.
        </p>
      </div>
    </div>
  );
}
