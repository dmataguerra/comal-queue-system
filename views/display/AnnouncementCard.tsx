import { useEffect, useState } from 'react';
import type { Announcement } from '../../shared/contract';
import { format } from '../../core/turns';
import { Icon } from '../common/components/Icon';
export function AnnouncementCard({ anuncio: announcement }: { anuncio: Announcement | null }) {
  const [visible, setVisible] = useState(announcement);
  useEffect(() => {
    if (announcement) setVisible(announcement);
  }, [announcement]);
  return (
    <section
      className={`public-focus ${announcement ? 'is-visible' : ''}`}
      aria-label="Anuncio de turno"
      aria-hidden={!announcement}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && !announcement) setVisible(null);
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
            <strong className="announcement-number">{format(visible.n)}</strong>
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
