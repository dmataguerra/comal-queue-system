import { Icon } from '../../comun/components/Icon';
import { SizeControl } from '../../comun/components/SizeControl';
import { VolumeControl } from '../../comun/components/VolumeControl';
import { useTema } from '../../comun/tema';

interface TopbarProps {
  crumb: string;
  notify: (text: string, error?: boolean) => void;
  onOpenHelp: () => void;
}

export function Topbar({ crumb, notify, onOpenHelp }: TopbarProps) {
  const { tema, cambiarTema } = useTema();
  return (
    <header className="admin-topbar">
      <div className="breadcrumb">
        Turnero
        <Icon name="chevron" />
        <span>{crumb}</span>
      </div>
      <div className="theme-controls">
        <SizeControl notificar={notify} />
        <VolumeControl notificar={notify} />
        <button
          type="button"
          className="theme-switch"
          role="switch"
          aria-checked={tema === 'morado'}
          aria-label="Tema morado en operador y cliente"
          title="Cambiar el tema de ambas pantallas"
          onClick={() => {
            try {
              cambiarTema();
            } catch {
              notify('No se pudo guardar el tema. Intenta de nuevo.', true);
            }
          }}
        >
          <span className="theme-switch-track" aria-hidden="true">
            <span className="theme-switch-thumb" />
          </span>
          <span>{tema === 'morado' ? 'Morado' : 'Azul'}</span>
        </button>
        <button className="button secondary help-button" onClick={onOpenHelp}>
          <Icon name="info" />
          Ayuda<kbd>F1</kbd>
        </button>
      </div>
    </header>
  );
}
