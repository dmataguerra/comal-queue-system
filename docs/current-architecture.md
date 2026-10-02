# Current desktop architecture

The installed app is a local Electron application. The main process owns queue state and opens separate operator and public display windows. When a secondary display exists, the public window uses it in fullscreen; without one, it falls back to a normal window on the primary display. The public Electron window cannot dispatch queue actions or request diagnostics. A loopback-only HTTP server serves the views, actions, diagnostics and content controls to trusted clients on the same PC; it does not listen on the LAN or authenticate separate browser roles. No external network service or database is required for normal queue operation.

```text
React views -> renderer transport -> sandboxed preload -> validated IPC
                                                    -> queue application -> pure queue core
                                                     ^
                                                     | storage ports
                                            JSON persistence adapter
Electron main -> window lifecycle, local content protocol, loopback HTTP server, OS dialogs, composition
Shared contract -> renderer, preload, IPC adapter, queue application
```

`nucleo/` contains pure queue and URL rules. `shared/contract.ts` describes the IPC payloads and compatibility-sensitive configuration fields. `shared/ipc-channels.ts` names each IPC capability. The sandboxed preload must keep channel literals inline; a test checks that they match the channel declarations. The renderer uses `vistas/comun/transport.ts` so components and the provider do not depend on Electron imports. `backend/queue-store.ts` is the sole owner of queue state and depends on storage ports. `main/store.ts` binds those ports to the existing `main/persistencia.ts` JSON implementation. State snapshots pass through `main/adaptador-ipc.ts`.

`main/main.ts` composes those pieces and manages startup. `main/servidor-web.ts` serves the built views and `public/browser-transport.js` enables the same validated browser transport without exposing Electron APIs. It binds to `127.0.0.1`; `TURNERO_PUERTO='0'` requests a free port for isolated tests, announced in that instance's log; with the normal default, if port 4317 is unavailable, the Electron windows remain the supported path and the failure is logged. `main/content-protocol.ts` serves only local files from the built views and data content roots. It streams media with byte ranges, performs asynchronous file checks, and rejects paths or symlinks escaping those roots. Both windows use context isolation and sandboxing. IPC authorization checks the registered window, main frame, and exact local page URL, then validates payloads before invoking operations. The public display uses local media when YouTube is unavailable.

In production, `config.json`, `estado.json`, `turnero.log`, and editable `contenido/` stay under `%APPDATA%/comal-local/datos`, or under `TURNERO_DATOS` in tests. Factory `contenido/` ships beside the executable and is seeded on first run. Persisted JSON keys and content URLs remain unchanged for existing 0.3 data. On first startup without `estado.json`, `main/migracion-02.ts` imports the supported turn and configuration data from a 0.2.0 SQLite profile and leaves the original database untouched. The installer must still be checked on a Windows machine with the intended TV and audio hardware before operational acceptance.

The older [architecture document](arquitectura.md) includes historical proposals. Its topology B, WebSocket, and server sections do not describe the installed product.

## State, audio and compatibility

The queue accepts one to six digits and retains the last two, including 00. It displays a current number and up to five earlier numbers; another distinct call displaces the oldest. Each number expires five minutes after its latest call. Undo is one level and session-only; removal clears it. Accepted actions save before broadcasting. Full audio capacity or save failure rejects the call without changing queue state.

Audio capacity is separate: six active/pending announcements, warning from five, start deadline 45 seconds and task limit 30 seconds. Acknowledgements validate session ID and number and do not allow terminal states to be reversed. Startup/reconnection do not replay old audio. Multiple public views can duplicate playback; there is no single audio-output election.

The HTTP API uses Server-Sent Events at `/api/events`, not WebSocket or Socket.IO. It checks exact Host and, for POST, same Origin, JSON content type and `X-Turnero-Cliente: navegador`. It has no per-browser authentication. Browser YouTube is explicitly disabled; desktop YouTube is optional and falls back to local media on failure.

## Current interface

Help is in the operator header and F1; Diagnostics is linked at its end. Compact expandable notices replace large stacked warnings. Size offers 70-130% in ten-point steps; Azul/Morado theme reserves control space. Both clocks use 12 hours with am/pm, while `recargaDiaria` remains 24-hour HH:MM. Wave animation is subtle and honors reduced motion. Theme/size use same-origin localStorage: Electron and HTTP browser preferences are independent and outside JSON backups.

The [documentation index](README.md) links the refreshed technical chapters, user manuals and dated evidence. Legacy SQLite applies only to migration; no active order-history table, counter assignment or delivered/cancelled business workflow exists in 0.4.0.
