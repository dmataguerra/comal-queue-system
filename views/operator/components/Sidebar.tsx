import { Brand } from '../../common/components/Brand';
import { Icon } from '../../common/components/Icon';
import type { OperatorPage } from '../hooks/useHelpAndTours';

interface SidebarProps {
  page: OperatorPage;
  setPage: (page: OperatorPage) => void;
  focusCapture: () => void;
  inert: boolean;
}

export function Sidebar({ page, setPage, focusCapture, inert }: SidebarProps) {
  return (
    <aside className="sidebar" inert={inert}>
      <Brand />
      <span className="nav-label">ESPACIO DE TRABAJO</span>
      <nav aria-label="Navegación principal">
        <button
          aria-label="Turnos"
          title="Turnos"
          className={page === 'turnos' ? 'active' : ''}
          aria-current={page === 'turnos' ? 'page' : undefined}
          onClick={() => {
            setPage('turnos');
            setTimeout(focusCapture);
          }}
        >
          <Icon name="receipt" />
          <span>Turnos</span>
          {page === 'turnos' && <i className="nav-active-dot" />}
        </button>
        <button
          aria-label="Multimedia"
          title="Multimedia"
          className={page === 'multimedia' ? 'active' : ''}
          aria-current={page === 'multimedia' ? 'page' : undefined}
          onClick={() => {
            setPage('multimedia');
            window.scrollTo({ top: 0 });
          }}
        >
          <Icon name="media" />
          <span>Multimedia</span>
          {page === 'multimedia' && <i className="nav-active-dot" />}
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-faculty">
          <img src="/assets/uaq-informatica-logo.png" alt="Facultad de Informática · UAQ" />
        </div>
      </div>
    </aside>
  );
}
