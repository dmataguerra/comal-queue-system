# COMAL Queue

> **Integración actual en copilot:** la aplicación usa la arquitectura local Electron de `arquitechture-v2`; las secciones históricas siguientes y los manuales de documentación describen la versión anterior. Consulta `docs/arquitectura.md` para la arquitectura nueva.
>
> **Multimedia → pantalla 2:** desde el panel del operador puedes agregar videos MP4/WebM e imágenes JPG/JPEG/PNG/WebP, consultar su biblioteca y quitar archivos con confirmación. Los videos se reproducen en rotación aleatoria; si no hay videos reproducibles, aparece el carrusel de imágenes. Los cambios se reflejan sin reiniciar. Los archivos se copian a `contenido/videos` y `contenido/banner` dentro de la carpeta de datos (en producción, `Documentos/Turnero Comal`, salvo `TURNERO_DATOS`). “Abrir carpeta” permite administrarlos directamente. Esta integración adapta Multimedia al contenido local; no incorpora el reproductor anterior de YouTube ni las listas de música.

COMAL Queue is a local ready-order display for the Troyanos/Comal++ cafeteria context represented in this repository. A cashier manually records an existing ticket number when an order is ready; connected public displays receive the ready list and a visual announcement in real time.

## Overview

The implemented workflow covers ready orders only. It does not create sales, print tickets, track preparation, manage inventory, or integrate with a point-of-sale system. Ticket numbers are two digits from `01` through `99`; an active number cannot be duplicated, but it can be reused after delivery or cancellation.

## Main capabilities

- Manual creation, recall, counter assignment, delivery, and cancellation of ready turns.
- SQLite persistence and idempotency for create/recall requests.
- Socket.IO state synchronization and live announcement events.
- A cashier workspace and a read-only public display at `/pantalla`.
- Local music catalogs, a fallback image carousel, and optional YouTube playback.
- Bundled Spanish announcement assets for turns `01`–`99` and counters 1–2.
- Configurable announcement duration, automatic page rotation, and footer messages.

Important current limitation: the public display does not expose or invoke the audio activation callback, so visual announcements are implemented but public-display audio is not operational without a code change. Authentication and authorization are also not implemented.

## Architecture at a glance

React 19 and Vite render both interfaces. A NestJS 11 process exposes HTTP endpoints and a Socket.IO gateway. Node's built-in SQLite driver stores turns, request-id records, and JSON configuration. Electron can package the application for Windows.

## Technology stack

- Node.js `>=22.13.0` and npm
- TypeScript 5, React 19, Vite 7
- NestJS 11, Socket.IO 4
- Node `node:sqlite`
- Electron 44 and electron-builder 26

Exact resolved versions are recorded in `package-lock.json`.

## Repository structure

- `src/` — frontend pages, components, hooks, services, and styles
- `server/` — API, realtime gateway, validation, domain service, media catalog, and SQLite access
- `tests/` — backend service and HTTP/WebSocket regression tests
- `public/` and `data/music/` — bundled visual and audio assets
- `electron/` — Windows desktop launcher
- `tooling/audio/` — reproducible audio generation and verification utilities
- `docs/` — product and process documentation in LaTeX

## Quick start

Prerequisite: Node.js 22.13 or newer.

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/` for the cashier workspace and `http://127.0.0.1:5173/pantalla` for the public display.

Run the checks:

```powershell
npm test
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.server.json
node tooling/audio/verify-audio.mjs
```

Build and run the single-server distribution:

```powershell
npm run build
npm start
```

The production server defaults to `http://127.0.0.1:3001`.

## Documentation

Start with [`docs/README.tex`](docs/README.tex). The complete documentation set is assembled by [`docs/technical-documentation.tex`](docs/technical-documentation.tex); all detailed documents use `.tex` as requested.

The LaTeX sources use Overleaf's `ol-softwaremanual` technical-document template. Its class is vendored in `docs/` so local and Overleaf builds use the same layout. To build locally, run this from `docs/`:

```powershell
latexmk -pdf -shell-escape -interaction=nonstopmode -halt-on-error technical-documentation.tex
```

Key entry points:

- [Current status](docs/10-planning/current-status.tex)
- [Queue domain](docs/05-architecture/queue-domain.tex)
- [API endpoints](docs/06-api/endpoints.tex)
- [Development setup](docs/08-development/development-setup.tex)
- [Known limitations](docs/07-quality/known-limitations.tex)
- [Documentation confidence](docs/11-reference/documentation-status.tex)

## Development status

The backend lifecycle, persistence, validation, local media catalog, and Socket.IO synchronization are implemented and covered by five passing backend tests. The frontend has no automated component or end-to-end tests. Production deployment, backup/restore, monitoring, authentication, and public-display audio activation require further work or stakeholder definition.

## License

No repository license is currently documented. Distribution rights require stakeholder validation.
