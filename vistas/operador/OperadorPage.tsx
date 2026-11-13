import { useEffect, useState } from 'react';
import { normalizar } from '../../nucleo/turnos';
import { ultimasEntregas } from '../../shared/politica-anuncios';
import { useTurnero } from '../comun/turnero';
import { Icon } from '../comun/components/Icon';
import { MultimediaPanel } from './MultimediaPanel';
import { DiagnosticoPanel } from './DiagnosticoPanel';
import { HelpCenter } from './ayuda/HelpCenter';
import { GuidedTour } from './ayuda/GuidedTour';
import { CallTurnPanel } from './components/CallTurnPanel';
import { ConfirmActionDialog } from './components/ConfirmActionDialog';
import { NoticesBanner } from './components/NoticesBanner';
import { OnScreenPanel } from './components/OnScreenPanel';
import { PageHeading } from './components/PageHeading';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { UndoPanel } from './components/UndoPanel';
import { useCaptureFocus } from './hooks/useCaptureFocus';
import { useHelpAndTours, type OperatorPage } from './hooks/useHelpAndTours';
import { useNotifications } from './hooks/useNotifications';
import { useOperatorNotices } from './hooks/useOperatorNotices';
import { useQueueActions } from './hooks/useQueueActions';
import { useTurnConfirmation } from './hooks/useTurnConfirmation';
import { entryHint } from './turns/entryHint';
import { pageTitleOf } from './turns/pageTitle';

export function OperadorPage() {
  const { instantanea, pantallas, entregasAudio = [], despachar, youtubeAdmitido } = useTurnero();
  const { actual, llamados, puedeDeshacer } = instantanea;
  const [page, setPage] = useState<OperatorPage>('turnos');
  const [entry, setEntry] = useState('');
  const { inputRef, helpActiveRef, focusCapture } = useCaptureFocus();
  const { message, isError, notify, notifyError } = useNotifications();
  const notices = useOperatorNotices({
    snapshot: instantanea,
    screens: pantallas,
    audioDeliveries: entregasAudio,
    youtubeAllowed: youtubeAdmitido,
  });
  const actions = useQueueActions({
    entry,
    clearEntry: () => setEntry(''),
    current: actual,
    canUndo: puedeDeshacer,
    dispatch: despachar,
    notify,
    notifyError,
    focusCapture,
  });
  const confirmation = useTurnConfirmation({
    busy: actions.busy,
    current: actual,
    called: llamados,
    announceAgain: actions.announceAgain,
    removeTurn: actions.removeTurn,
    notify,
  });
  const help = useHelpAndTours({
    page,
    setPage,
    pending: confirmation.pending,
    inputRef,
    helpActiveRef,
    focusCapture,
  });
  useEffect(() => {
    document.title = 'Troyanos · Operador';
  }, []);

  const parsedEntry = normalizar(entry);
  const heading = pageTitleOf(page);
  const touring = help.tour !== null;
  return (
    <div className="admin-shell">
      <a href="#admin-main" className="skip-link" inert={touring}>
        Ir al contenido
      </a>
      <Sidebar page={page} setPage={setPage} focusCapture={focusCapture} inert={touring} />
      <div className="admin-workspace" inert={touring}>
        <Topbar crumb={heading.crumb} notify={notify} onOpenHelp={help.openHelp} />
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <PageHeading heading={heading} />
          <NoticesBanner notices={notices} />
          {page === 'turnos' ? (
            <div className="turns-layout">
              <div className="entry-column">
                <CallTurnPanel
                  entry={entry}
                  setEntry={setEntry}
                  parsedEntry={parsedEntry}
                  hint={entryHint(entry, parsedEntry, actual, llamados)}
                  busy={actions.busy}
                  inputRef={inputRef}
                  onSubmit={actions.call}
                  message={message}
                  isError={isError}
                />
                <UndoPanel busy={actions.busy} canUndo={puedeDeshacer} onUndo={actions.undoLast} />
              </div>
              <OnScreenPanel
                current={actual}
                called={llamados}
                recentDeliveries={ultimasEntregas(entregasAudio)}
                busy={actions.busy}
                onRequestAction={confirmation.requestAction}
              />
            </div>
          ) : page === 'diagnostico' ? (
            <DiagnosticoPanel />
          ) : null}
          {(page === 'multimedia' ||
            (help.tour !== null && help.beforeTour.current.pagina === 'multimedia')) && (
            <div hidden={page !== 'multimedia'} data-help="multimedia">
              <MultimediaPanel notificar={notify} />
            </div>
          )}
          <footer className="workspace-footer">
            <span>
              Facultad de Informática <i /> UAQ
            </span>
            <span>Crear · crecer · consolidar</span>
          </footer>
        </main>
      </div>
      {message && page === 'multimedia' && (
        <div className={`toast ${isError ? 'error' : ''}`} role="status">
          <Icon name={isError ? 'warning' : 'checkCircle'} />
          {message}
        </div>
      )}
      {confirmation.pending && (
        <ConfirmActionDialog
          pending={confirmation.pending}
          dontAsk={confirmation.dontAsk}
          setDontAsk={confirmation.setDontAsk}
          busy={actions.busy}
          onConfirm={confirmation.confirmAction}
          onCancel={confirmation.cancelAction}
        />
      )}
      {help.helpOpen && (
        <HelpCenter
          onClose={help.closeHelp}
          onStartTour={help.startTour}
          completados={help.completed}
          youtubeAdmitido={youtubeAdmitido}
          onDiagnostics={help.openDiagnostics}
        />
      )}
      {help.tour && <GuidedTour id={help.tour} onNavigate={setPage} onExit={help.exitTour} />}
    </div>
  );
}
