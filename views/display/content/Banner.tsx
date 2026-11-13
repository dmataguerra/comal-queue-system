import { useEffect, useState } from 'react';

function useBannerRotation(total: number, seconds: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (total < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), seconds * 1000);
    return () => clearInterval(id);
  }, [total, seconds]);
  return index;
}

export function Banner({
  imagenes: images,
  segundos: seconds,
}: {
  imagenes: string[];
  segundos: number;
}) {
  const index = useBannerRotation(images.length, seconds);
  return (
    <div
      className="content-stage banner-stage"
      role="region"
      aria-label="Imágenes de la Facultad de Informática"
    >
      {images.map((src, i) => (
        <img key={src} src={src} alt="" className={i === index % images.length ? 'visible' : ''} />
      ))}
      {!images.length && (
        <div className="banner-logos">
          <img src="/assets/troyanos-logo.png" alt="Troyanos" />
          <img src="/assets/uaq-informatica-logo.png" alt="Facultad de Informática UAQ" />
        </div>
      )}
    </div>
  );
}
