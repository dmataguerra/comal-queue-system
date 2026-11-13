import { useEffect, useRef, useState } from 'react';
import { useQueue } from '../queue-context';
import { Icon } from './Icon';
export function VolumeControl({
  notificar: notify,
}: {
  notificar: (message: string, error?: boolean) => void;
}) {
  const { config, configurarVolumen: configureVolume } = useQueue();
  const panel = useRef<HTMLDetailsElement>(null);
  const [voice, setVoice] = useState(100);
  const [music, setMusic] = useState(60);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const closePanel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector('summary')?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        panel.current?.open &&
        event.target instanceof Node &&
        !panel.current.contains(event.target)
      )
        panel.current.open = false;
    };
    document.addEventListener('keydown', closePanel);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', closePanel);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);
  return (
    <details
      className="volume-control"
      ref={panel}
      onToggle={() => {
        if (panel.current?.open) {
          setVoice(Math.round(config.volumenVoz * 100));
          setMusic(Math.round(config.volumenMusica * 100));
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
          setSaving(true);
          void configureVolume(voice / 100, music / 100)
            .then(() => {
              if (panel.current) panel.current.open = false;
              notify('Volumen guardado.');
            })
            .catch(() => notify('No se pudo guardar el volumen. Intenta de nuevo.', true))
            .finally(() => setSaving(false));
        }}
      >
        <strong>Volumen</strong>
        <label htmlFor="voice-volume">
          Voz de turnos <output>{voice}%</output>
        </label>
        <input
          id="voice-volume"
          type="range"
          min="0"
          max="300"
          step="5"
          value={voice}
          disabled={saving}
          onChange={(e) => setVoice(Number(e.target.value))}
        />
        <small>
          {voice > 100
            ? 'Amplificación de voz; puede distorsionar.'
            : 'Se aplica al siguiente anuncio.'}
        </small>
        <label htmlFor="media-volume">
          Multimedia <output>{music}%</output>
        </label>
        <input
          id="media-volume"
          type="range"
          min="0"
          max="100"
          step="5"
          value={music}
          disabled={saving}
          onChange={(e) => setMusic(Number(e.target.value))}
        />
        <small>Videos locales y YouTube. Baja durante los llamados.</small>
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Aplicar'}
        </button>
      </form>
    </details>
  );
}
