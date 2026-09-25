import type { Anuncio } from '../../main/contrato';
import { formatear } from '../../nucleo/turnos';
import { Icon } from '../comun/components/Icon';

export function TarjetaAnuncio({ anuncio }: { anuncio: Anuncio }) {
  return (
    <section className="public-focus" aria-label="Anuncio de turno">
      <div className="announcement-backdrop" role="status" aria-live="assertive" aria-atomic="true">
        <div className="announcement-card glass-panel" key={anuncio.id}>
          <span className="announcement-caption">TURNO</span>
          <strong className="announcement-number">{formatear(anuncio.n)}</strong>
          <span className="announcement-pickup">Acércate a recoger tu pedido</span>
          <div className="announcement-rule" />
          <p>
            <Icon name="receipt" />
            Presenta tu ticket en la barra
          </p>
        </div>
      </div>
    </section>
  );
}
