# Current desktop architecture

The installed app is a local Electron application. The main process owns queue state and opens separate operator and public display windows. The public display cannot dispatch queue actions or request diagnostics. A loopback-only HTTP server can serve the operator and public views to a browser on the same PC, but it does not expose an administration API or listen on the LAN. No external network service or database is required for normal queue operation.

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

`main/main.ts` composes those pieces and manages startup. `main/servidor-web.ts` serves the built views and `public/browser-transport.js` enables the same validated browser transport without exposing Electron APIs. It binds to `127.0.0.1`; if port 4317 is unavailable, the Electron windows remain the supported path and the failure is logged. `main/content-protocol.ts` serves only local files from the built views and data content roots. It streams media with byte ranges, performs asynchronous file checks, and rejects paths or symlinks escaping those roots. Both windows use context isolation and sandboxing. IPC authorization checks the registered window, main frame, and exact local page URL, then validates payloads before invoking operations. The public display uses local media when YouTube is unavailable.

In production, `config.json`, `estado.json`, `turnero.log`, and editable `contenido/` stay under `%APPDATA%/comal-local/datos`, or under `TURNERO_DATOS` in tests. Factory `contenido/` ships beside the executable and is seeded on first run. Persisted JSON keys and content URLs remain unchanged for existing 0.3 data. On first startup without `estado.json`, `main/migracion-02.ts` imports the supported turn and configuration data from a 0.2.0 SQLite profile and leaves the original database untouched. The installer must still be checked on a Windows machine with the intended TV and audio hardware before operational acceptance.

The older [architecture document](arquitectura.md) includes historical proposals. Its topology B, WebSocket, and server sections do not describe the installed product.
