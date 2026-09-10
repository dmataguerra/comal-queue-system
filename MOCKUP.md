# Comal++ interactive mockup

An interactive Spanish-language demonstration built with plain HTML, CSS and JavaScript. The project planning documents remain unchanged.

## Open locally

Run `npm start` (or `node serve.mjs`) from this directory and open http://127.0.0.1:4173. No packages need to be installed. You can also open `dist/index.html` directly for a single-window demonstration; use the local server for reliable cross-tab synchronization.

## Views and walkthrough

- **Panel de caja** (`#caja`): enter an existing printed number 01–99, register it, mark it ready, repeat the call, then mark it delivered. The live customer preview updates with every change.
- **Pantalla pública** (`#pantalla`): large latest called number, all other ready tickets, fullscreen and audio. Open it in a second window via Configuración to demonstrate synchronized changes in the same browser. Lists above eight additional ready tickets rotate automatically every six seconds.
- **Historial** (`#historial`): filter and search the event history. Reused numbers retain independent order records.
- **Configuración** (`#ajustes`): audio test, simulated connection loss/recovery, session opening/closing, simulated sign-in and resetting sample data.
- The **···** button on a ticket exposes correction and cancellation, with confirmation.

The initial data includes preparing, ready and delivered orders. All confirmed changes persist in this browser’s local storage. Resetting the demo replaces this demo’s data only. No midnight reset occurs. Voice calls queue sequentially and require activation; enable audio in only one tab. The demo coordinates audio ownership across tabs in the same browser.

## Scope and limitations

This is a working interface mockup, not the proposed production backend. Authentication and connection loss are simulated. Orders and event history use localStorage, rather than SQLite. Same-browser windows synchronize with storage events; separate devices do not. Storage can be cleared or disabled by the browser. The production server must enforce authorization, atomic transitions and uniqueness across concurrent operators.

The demo uses browser speech synthesis, preferring an installed local Spanish voice. Offline speech and actual speaker output must be tested on the target computer. It does not include the proposed 99 prerecorded audio files, a real SSE server, receipt printing, payments, or a validated three-TV installation. Fullscreen availability depends on browser permissions. Public mode has no ticket mutation controls; it is not a security boundary in this frontend-only demo.

All UI assets are local and have no CDN dependencies. The optional browser WebMCP interface exposes queue readback and ticket registration through the same core rules, gated to the cashier demo session for mutations. It is feature-detected and does not affect normal browser use.

## Verification

`npm run check` validates JavaScript syntax. `npm test` checks ticket range, active duplicates, reuse/history, out-of-order readiness, duplicate transitions, correction/cancellation, disconnected operations, session closure and 99-ticket persistence.

Browser visual/interaction testing and WebMCP registration validation were not performed in this delivery. The optional agent API requires a browser that exposes `document.modelContext`.

Authored files: `dist/index.html`, `dist/styles.css`, `dist/queue.js`, `dist/app.js`, `dist/favicon.svg`. `serve.mjs` provides a small localhost-only static server.
