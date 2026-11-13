import { useEffect, useState } from 'react';
import { normalize } from '../../core/turns';
import { latestDeliveries } from '../../shared/announcement-policy';
import { useQueue } from '../common/queue-context';
import { Icon } from '../common/components/Icon';
import { MultimediaPanel } from './MultimediaPanel';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { HelpCenter } from './help/HelpCenter';
import { GuidedTour } from './help/GuidedTour';
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

export function OperatorPage() {
  const {
    instantanea: snapshot,
    pantallas: screens,
    entregasAudio: audioDeliveries = [],
    despachar: dispatch,
    youtubeAdmitido: youtubeAllowed,
  } = useQueue();
  const { actual: current, llamados: calledTurns, puedeDeshacer: canUndo } = snapshot;
  const [page, setPage] = useState<OperatorPage>('turnos');
  const [entry, setEntry] = useState('');
  const { inputRef, helpActiveRef, focusCapture } = useCaptureFocus();
  const { message, isError, notify, notifyError } = useNotifications();
  const notices = useOperatorNotices({
    snapshot: snapshot,
    screens: screens,
    audioDeliveries: audioDeliveries,
    youtubeAllowed: youtubeAllowed,
  });
  const actions = useQueueActions({
    entry,
    clearEntry: () => setEntry(''),
    current: current,
    canUndo: canUndo,
    dispatch: dispatch,
    notify,
    notifyError,
    focusCapture,
  });
  const confirmation = useTurnConfirmation({
    busy: actions.busy,
    current: current,
    called: calledTurns,
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

  const parsedEntry = normalize(entry);
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
                  hint={entryHint(entry, parsedEntry, current, calledTurns)}
                  busy={actions.busy}
                  inputRef={inputRef}
                  onSubmit={actions.call}
                  message={message}
                  isError={isError}
                />
                <UndoPanel busy={actions.busy} canUndo={canUndo} onUndo={actions.undoLast} />
              </div>
              <OnScreenPanel
                current={current}
                called={calledTurns}
                recentDeliveries={latestDeliveries(audioDeliveries)}
                busy={actions.busy}
                onRequestAction={confirmation.requestAction}
              />
            </div>
          ) : page === 'diagnostico' ? (
            <DiagnosticsPanel />
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
          youtubeAdmitido={youtubeAllowed}
          onDiagnostics={help.openDiagnostics}
        />
      )}
      {help.tour && <GuidedTour id={help.tour} onNavigate={setPage} onExit={help.exitTour} />}
    </div>
  );
}
