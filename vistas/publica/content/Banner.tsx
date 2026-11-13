import { useEffect, useState } from 'react';

function useBannerRotation(total: number, segundos: number) {
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    if (total < 2) return;
    const id = setInterval(() => setIndice((i) => (i + 1) % total), segundos * 1000);
    return () => clearInterval(id);
  }, [total, segundos]);
  return indice;
}

export function Banner({ imagenes, segundos }: { imagenes: string[]; segundos: number }) {
  const indice = useBannerRotation(imagenes.length, segundos);
  return (
    <div
      className="content-stage banner-stage"
      role="region"
      aria-label="Imágenes de la Facultad de Informática"
    >
      {imagenes.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={i === indice % imagenes.length ? 'visible' : ''}
        />
      ))}
      {!imagenes.length && (
        <div className="banner-logos">
          <img src="/assets/troyanos-logo.png" alt="Troyanos" />
          <img src="/assets/uaq-informatica-logo.png" alt="Facultad de Informática UAQ" />
        </div>
      )}
    </div>
  );
}
