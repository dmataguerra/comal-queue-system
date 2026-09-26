import { useState } from 'react';
import './multimedia.css';
import { YouTubePanel } from './YouTubePanel';
import type { CategoriaContenido } from '../../shared/contract';
import { Icon } from '../comun/components/Icon';
import { useTurnero } from '../comun/turnero';

const nombreArchivo = (url: string) => decodeURIComponent(url.split('/').pop() ?? url);

const FORMATOS: Record<CategoriaContenido, { extensiones: string[]; nombres: string }> = {
  videos: { extensiones: ['mp4', 'webm'], nombres: 'MP4 o WebM' },
  banner: { extensiones: ['jpg', 'jpeg', 'png', 'webp'], nombres: 'JPG, PNG o WebP' },
};

function motivoOmitido(categoria: CategoriaContenido, nombre: string) {
  const extension = nombre.split('.').pop()?.toLowerCase() ?? '';
  const { extensiones, nombres } = FORMATOS[categoria];
  return extensiones.includes(extension)
    ? `“${nombre}” no se agregó: el archivo está vacío o incompleto. Espera a que termine de descargarse y vuelve a intentarlo.`
    : `“${nombre}” no se agregó: formato no admitido (usa ${nombres}).`;
}

function Archivo({
  url,
  esVideo,
  ocupado,
  quitar,
}: {
  url: string;
  esVideo: boolean;
  ocupado: boolean;
  quitar: (url: string) => void;
}) {
  const [falla, setFalla] = useState(false);
  const nombre = nombreArchivo(url);
  return (
    <article className={`media-file ${falla ? 'broken' : ''}`}>
      <div className="media-preview">
        {esVideo ? (
          <video src={url} muted preload="metadata" onError={() => setFalla(true)} />
        ) : (
          <img src={url} alt="" onError={() => setFalla(true)} />
        )}
        <span>
          <Icon name={falla ? 'warning' : esVideo ? 'play' : 'image'} />
        </span>
      </div>
      <div className="media-file-info">
        <strong title={nombre}>{nombre}</strong>
        <small>
          {falla
            ? 'No se puede mostrar: quítalo y vuelve a subirlo'
            : esVideo
              ? 'Video de la rotación'
              : 'Imagen del carrusel'}
        </small>
      </div>
      <button
        className="icon-button media-remove"
        disabled={ocupado}
        onClick={() => quitar(url)}
        aria-label={`Quitar ${nombre}`}
        title={`Quitar ${nombre}`}
      >
        <Icon name="trash" />
      </button>
    </article>
  );
}

interface BibliotecaProps {
  categoria: CategoriaContenido;
  titulo: string;
  descripcion: string;
  requisitos: string;
  aviso?: string;
  archivos: string[];
  ocupado: boolean;
  agregar: (categoria: CategoriaContenido) => void;
  quitar: (url: string) => void;
}

function Biblioteca({
  categoria,
  titulo,
  descripcion,
  requisitos,
  aviso,
  archivos,
  ocupado,
  agregar,
  quitar,
}: BibliotecaProps) {
  const esVideo = categoria === 'videos';
  return (
    <section className="panel media-library-panel">
      <div className="media-library-heading">
        <span className="section-icon">
          <Icon name={esVideo ? 'media' : 'image'} />
        </span>
        <div>
          <h2>{titulo}</h2>
          <p>{descripcion}</p>
        </div>
        <span className="media-count">
          {archivos.length} {archivos.length === 1 ? 'archivo' : 'archivos'}
        </span>
      </div>
      <div className="media-actions">
        <button className="button primary" disabled={ocupado} onClick={() => agregar(categoria)}>
          <Icon name="plus" />
          Agregar {esVideo ? 'videos' : 'imágenes'}
        </button>
        <span className="media-requirements">{requisitos}</span>
      </div>
      {aviso && (
        <p className="media-library-notice">
          <Icon name="info" />
          {aviso}
        </p>
      )}
      {archivos.length ? (
        <div className="media-file-grid">
          {archivos.map((url) => (
            <Archivo key={url} url={url} esVideo={esVideo} ocupado={ocupado} quitar={quitar} />
          ))}
        </div>
      ) : (
        <div className="media-empty">
          <Icon name={esVideo ? 'media' : 'image'} />
          <div>
            <strong>{esVideo ? 'No hay videos cargados' : 'No hay imágenes cargadas'}</strong>
            <p>
              {esVideo
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
  notificar,
}: {
  notificar: (mensaje: string, error?: boolean) => void;
}) {
  const { inventario, config, importarContenido, quitarContenido } = useTurnero();
  const [ocupado, setOcupado] = useState(false);

  async function agregar(categoria: CategoriaContenido) {
    setOcupado(true);
    try {
      const {
        agregados,
        omitidos,
        cancelado,
        motivos: razones,
      } = await importarContenido(categoria);
      if (cancelado) return;
      const motivos = omitidos
        .map((nombre) => razones?.[nombre] ?? motivoOmitido(categoria, nombre))
        .join(' ');
      if (agregados.length) {
        const cantidad = agregados.length;
        notificar(
          `${cantidad} ${cantidad === 1 ? 'archivo agregado' : 'archivos agregados'} a la pantalla 2.${motivos ? ` ${motivos}` : ''}`,
          omitidos.length > 0,
        );
      } else notificar(motivos || 'No se agregó ningún archivo.', true);
    } catch (error) {
      notificar((error as Error).message, true);
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(url: string) {
    const nombre = nombreArchivo(url);
    if (
      !window.confirm(
        `¿Quitar “${nombre}” de la pantalla 2? El archivo se eliminará de la carpeta de contenido.`,
      )
    )
      return;
    setOcupado(true);
    try {
      const eliminado = await quitarContenido(url);
      notificar(
        eliminado ? `${nombre} se quitó de la pantalla 2.` : 'El archivo ya no estaba disponible.',
        !eliminado,
      );
    } catch (error) {
      notificar((error as Error).message, true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="multimedia-workspace">
      <YouTubePanel notificar={notificar} />
      <div className="media-library-layout">
        <Biblioteca
          categoria="videos"
          titulo="Videos"
          descripcion="Se reproducen en orden aleatorio y de forma continua."
          requisitos="MP4 (H.264) o WebM · hasta 1080p"
          archivos={inventario.videos}
          ocupado={ocupado}
          agregar={(categoria) => void agregar(categoria)}
          quitar={(url) => void quitar(url)}
        />
        <Biblioteca
          categoria="banner"
          titulo="Imágenes"
          descripcion="Aparecen como carrusel cuando no hay videos disponibles."
          requisitos="JPG, PNG o WebP · 1920 × 1080 recomendado"
          aviso={
            config.youtubeUrl || inventario.videos.length
              ? `Ahora se muestra${config.youtubeUrl ? ' YouTube' : 'n los videos'}. Las imágenes aparecen en la TV solo cuando no hay videos ni YouTube.`
              : undefined
          }
          archivos={inventario.banner}
          ocupado={ocupado}
          agregar={(categoria) => void agregar(categoria)}
          quitar={(url) => void quitar(url)}
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
