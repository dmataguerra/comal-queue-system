import { useEffect, useRef, useState } from 'react';
import { useTurnero } from '../turnero';
import { Icon } from './Icon';

export function VolumeControl({
  notificar,
}: {
  notificar: (mensaje: string, error?: boolean) => void;
}) {
  const { config, configurarVolumen } = useTurnero();
  const panel = useRef<HTMLDetailsElement>(null);
  const [voz, setVoz] = useState(100);
  const [musica, setMusica] = useState(60);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    const cerrar = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector('summary')?.focus();
      }
    };
    const fuera = (event: PointerEvent) => {
      if (
        panel.current?.open &&
        event.target instanceof Node &&
        !panel.current.contains(event.target)
      )
        panel.current.open = false;
    };
    document.addEventListener('keydown', cerrar);
    document.addEventListener('pointerdown', fuera);
    return () => {
      document.removeEventListener('keydown', cerrar);
      document.removeEventListener('pointerdown', fuera);
    };
  }, []);
  return (
    <details
      className="volume-control"
      ref={panel}
      onToggle={() => {
        if (panel.current?.open) {
          setVoz(Math.round(config.volumenVoz * 100));
          setMusica(Math.round(config.volumenMusica * 100));
        }
      }}
    >
      <summary aria-label="Ajustar volumen" title="Volumen">
        <Icon name="volume" />
      </summary>
      <form
        className="volume-popover"
        onSubmit={(e) => {
          e.preventDefault();
          setGuardando(true);
          void configurarVolumen(voz / 100, musica / 100)
            .then(() => {
              if (panel.current) panel.current.open = false;
              notificar('Volumen guardado.');
            })
            .catch(() => notificar('No se pudo guardar el volumen. Intenta de nuevo.', true))
            .finally(() => setGuardando(false));
        }}
      >
        <strong>Volumen</strong>
        <label htmlFor="voice-volume">
          Voz de turnos <output>{voz}%</output>
        </label>
        <input
          id="voice-volume"
          type="range"
          min="0"
          max="300"
          step="5"
          value={voz}
          disabled={guardando}
          onChange={(e) => setVoz(Number(e.target.value))}
        />
        <small>
          {voz > 100
            ? 'Amplificación de voz; puede distorsionar.'
            : 'Se aplica al siguiente anuncio.'}
        </small>
        <label htmlFor="media-volume">
          Multimedia <output>{musica}%</output>
        </label>
        <input
          id="media-volume"
          type="range"
          min="0"
          max="100"
          step="5"
          value={musica}
          disabled={guardando}
          onChange={(e) => setMusica(Number(e.target.value))}
        />
        <small>Videos locales y YouTube. Baja durante los llamados.</small>
        <button className="button primary" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Aplicar'}
        </button>
      </form>
    </details>
  );
}
