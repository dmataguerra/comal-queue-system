import { useEffect, useState } from 'react';
import type { Anuncio } from '../../shared/contract';
import { formatear } from '../../nucleo/turnos';
import { Icon } from '../comun/components/Icon';

export function TarjetaAnuncio({ anuncio }: { anuncio: Anuncio | null }) {
  // Retener la presentación durante la salida sin cambiar la cola ni el audio.
  const [visible, setVisible] = useState(anuncio);
  useEffect(() => {
    if (anuncio) setVisible(anuncio);
  }, [anuncio]);
  return (
    <section
      className={`public-focus ${anuncio ? 'is-visible' : ''}`}
      aria-label="Anuncio de turno"
      aria-hidden={!anuncio}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && !anuncio) setVisible(null);
      }}
    >
      {visible && (
        <div
          className="announcement-backdrop"
          role="status"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="announcement-card glass-panel" key={visible.id}>
            <span className="announcement-status">Recoge tu pedido</span>
            <strong className="announcement-number">{formatear(visible.n)}</strong>
            <p>
              <Icon name="receipt" />
              Presenta tu ticket al recoger
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
