import { Icon } from '../../common/components/Icon';
import { SizeControl } from '../../common/components/SizeControl';
import { VolumeControl } from '../../common/components/VolumeControl';
import { useTheme } from '../../common/theme';

interface TopbarProps {
  crumb: string;
  notify: (text: string, error?: boolean) => void;
  onOpenHelp: () => void;
}

export function Topbar({ crumb, notify, onOpenHelp }: TopbarProps) {
  const { theme: theme, toggleTheme: changeTheme } = useTheme();
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
          aria-checked={theme === 'morado'}
          aria-label="Tema morado en operador y cliente"
          title="Cambiar el tema de ambas pantallas"
          onClick={() => {
            try {
              changeTheme();
            } catch {
              notify('No se pudo guardar el tema. Intenta de nuevo.', true);
            }
          }}
        >
          <span className="theme-switch-track" aria-hidden="true">
            <span className="theme-switch-thumb" />
          </span>
          <span>{theme === 'morado' ? 'Morado' : 'Azul'}</span>
        </button>
        <button className="button secondary help-button" onClick={onOpenHelp}>
          <Icon name="info" />
          Ayuda<kbd>F1</kbd>
        </button>
      </div>
    </header>
  );
}
