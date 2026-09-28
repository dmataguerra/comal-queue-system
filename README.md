# Comal++

[![CI](https://github.com/dmataguerra/comal-queue-system/actions/workflows/ci.yml/badge.svg)](https://github.com/dmataguerra/comal-queue-system/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D6.svg)](https://www.microsoft.com/windows)

> Sistema local de turnos para anunciar pedidos listos en el restaurante, con pantalla pública, audio y operación sin depender de una red.

Comal++ es una aplicación de escritorio para Windows orientada a operaciones de mostrador. La persona operadora captura los dos últimos dígitos del pedido (`00`-`99`); la pantalla pública muestra el turno y reproduce el aviso y la voz correspondientes. No registra ventas ni imprime tickets.

## Estado del proyecto

| Campo | Estado |
| --- | --- |
| Versión | `0.3.1` |
| Plataforma soportada | Windows x64 |
| Operación normal | Local, sin internet |
| Persistencia | Archivos JSON locales |
| Distribución | Instalador NSIS para Windows |
| Licencia | [MIT](LICENSE) |

La versión actual corrige el guardado en carpetas protegidas de Documentos/OneDrive y prepara la publicación con firma pública gratuita. Todavía no existe un certificado público aprobado.

## Contenido

- [Capacidades](#capacidades)
- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Inicio rápido](#inicio-rápido)
- [Comandos](#comandos)
- [Datos y operación](#datos-y-operación)
- [Seguridad](#seguridad)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Documentación](#documentación)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## Capacidades

- Cola de pedidos de `00` a `99` con llamadas, repetición, corrección y eliminación.
- Ventana de operador y pantalla pública independientes.
- Avisos y voces locales para operar sin internet.
- Multimedia local y respaldo local cuando YouTube no está disponible.
- Servidor HTTP de bucle local para abrir las vistas en un navegador de la misma PC.
- Diagnósticos de versión, persistencia, ventanas, audio, contenido, espacio y errores recientes.
- Actualización que conserva los datos existentes y migración controlada desde perfiles compatibles de `0.2.0`.
- Instalador Windows NSIS sin acceso directo automático en el Escritorio.

## Arquitectura

Electron ejecuta el proceso principal y dos ventanas React construidas con Vite: **operador** y **pública**. Las ventanas se comunican mediante IPC validado y la lógica de turnos permanece en `nucleo/`, sin dependencia de Electron.

```text
React -> transporte de renderer -> preload aislado -> IPC validado
                                                   -> aplicación de cola
                                                        -> núcleo puro
                                                   -> persistencia JSON
Electron -> ventanas, contenido local, HTTP loopback y ciclo de vida
```

El servidor local escucha únicamente en `127.0.0.1`. Sirve las dos vistas en `http://127.0.0.1:4317/` y `http://127.0.0.1:4317/publica`, pero no expone una API de administración ni admite acceso desde otros equipos. La [arquitectura vigente](docs/current-architecture.md) contiene el detalle técnico y los límites de este diseño.

En Windows, la pantalla pública se coloca en una pantalla secundaria configurada como **pantalla extendida** cuando está disponible. Sin una pantalla secundaria, la aplicación empaquetada abre la vista pública como una ventana normal en el display primario, junto con la ventana del operador.

## Requisitos

### Para desarrollo y empaquetado

- Windows.
- Node.js `22.13.0` o posterior.
- npm incluido con Node.js.
- Una cuenta con permisos para instalar dependencias y generar el instalador.

### Para operación en el local

- Una PC Windows x64.
- Una TV o pantalla secundaria en modo extendido.
- Salida de audio y bocinas configuradas.
- Instalador generado y probado en el hardware real.

## Inicio rápido

```powershell
git clone https://github.com/dmataguerra/comal-queue-system.git
cd comal-queue-system
npm ci
npm run dev
```

`npm run dev` inicia Vite y Electron para desarrollo. Para ejecutar el código compilado:

```powershell
npm run build
npm start
```

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Inicia el entorno de desarrollo. |
| `npm run build` | Compila vistas, proceso principal y tipos. |
| `npm start` | Ejecuta la aplicación compilada. |
| `npm run desktop:build` | Genera el instalador Windows NSIS en `release/`. |
| `npm run desktop:dir` | Genera una carpeta de aplicación sin instalador. |
| `npm test` | Ejecuta validación de audio y pruebas unitarias. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run format:check` | Comprueba el formato con Prettier. |
| `npm run test:desktop` | Ejecuta build y smoke tests de Electron. |
| `npm run test:browser` | Valida las vistas en Chromium con transporte de navegador. |
| `npm run test:installed` | Prueba un instalador ya generado en datos aislados. |
| `npm run test:upgrade` | Valida migración y recuperación entre versiones. |
| `npm run verify:audio` | Comprueba las voces `00`-`99` y el aviso. |

Para una publicación firmada se utilizan `npm run desktop:build:signed` y el certificado del responsable. La firma local protegida por TPM se prepara con `npm run desktop:build:local-signed` y `COMAL_SIGNING_CERT_SHA1`; no reemplaza una firma pública ni elimina por sí sola los avisos de SmartScreen.

## Datos y operación

En producción, los datos se guardan fuera de Documentos/OneDrive, normalmente en:

```text
%APPDATA%/comal-local/datos
```

La aplicación mantiene `config.json`, `estado.json`, `turnero.log` y `contenido/`. La ruta efectiva aparece en **Ayuda -> Diagnósticos**. Para pruebas aisladas puede establecerse `TURNERO_DATOS`.

El instalador incluye contenido de fábrica que se copia durante el primer arranque. Los archivos locales de `contenido/videos`, `contenido/banner`, `contenido/voz` y `contenido/aviso.wav` funcionan sin red; para cada voz y para el aviso se prefiere un MP3 no vacío cuando existe y, en caso contrario, WAV.

Al actualizar se conservan los datos anteriores y se copian una sola vez. Si la copia falla, el arranque informa del problema. El registro usa líneas JSON, rota al alcanzar 5 MB y conserva hasta cinco archivos anteriores (`turnero.log.1` a `turnero.log.5`). La [guía de operación y recuperación](docs/operacion-recuperacion.md) explica respaldos, restauración y salud de persistencia.

## Seguridad

- El servidor web se limita a loopback y no ofrece administración por red.
- Las ventanas usan aislamiento de contexto y sandbox.
- IPC valida el canal, el origen de la ventana, el frame principal y los payloads.
- El contenido local se sirve con raíces permitidas, validación asíncrona y rechazo de rutas o enlaces simbólicos fuera de esas raíces.
- La CI ejecuta formato, lint, pruebas, build, auditoría de vulnerabilidades de severidad alta o crítica y smoke tests de escritorio.

Para reportar una vulnerabilidad, evita publicar detalles sensibles en un issue. Contacta al propietario del repositorio mediante los canales disponibles en GitHub y proporciona pasos reproducibles, impacto y versión afectada. La [guía de seguridad y publicación](docs/seguridad-y-publicacion.md) describe los controles implementados.

## Estructura del repositorio

| Directorio | Responsabilidad |
| --- | --- |
| `main/` | Proceso principal de Electron, ventanas, IPC, configuración y persistencia. |
| `nucleo/` | Reglas puras de turnos y cola. |
| `vistas/` | Interfaces React del operador y la pantalla pública. |
| `shared/` | Contratos y canales compartidos entre procesos. |
| `contenido/` | Recursos de fábrica para instalaciones nuevas. |
| `tooling/audio/` | Generación y validación del catálogo de voz. |
| `scripts/` | Automatización de desarrollo, empaquetado y pruebas. |
| `docs/` | Arquitectura, operación, seguridad y documentación histórica. |

## Validación

La validación local recomendada antes de abrir un pull request es:

```powershell
npm ci
npm run format:check
npm run lint
npm test
npm run build
```

El catálogo de audio exige una voz para cada número `00`-`99`, rechaza archivos vacíos y revisa el aviso. Las pruebas de escritorio usan datos aislados bajo `test-results/`, comprueban ambas vistas, llamadas y multimedia, y decodifican las voces seleccionadas en Chromium. La reproducción real de YouTube requiere una aceptación adicional con internet.

Las pruebas de instalación, actualización, reversión y escala de pantalla requieren artefactos o hardware específicos. Consulta los scripts y la [lista de publicación](docs/lista-publicacion.md) antes de declarar una entrega operativa.

## Documentación

- [Arquitectura vigente](docs/current-architecture.md): diseño instalado y límites técnicos.
- [Operación y recuperación](docs/operacion-recuperacion.md): guardado atómico, respaldos y restauración.
- [Seguridad y publicación](docs/seguridad-y-publicacion.md): CSP, IPC, CI, auditoría y firma.
- [Lista de publicación](docs/lista-publicacion.md): comprobaciones para cada instalador.
- [Instalación desde USB](README-INSTALACION-USB.md): procedimiento para la PC del restaurante.
- [Firma local](docs/firma-local.md): requisitos y límites de la firma protegida por TPM.
- [Firma pública gratuita](docs/firma-publica-gratuita.md): preparación de la publicación firmada.

Los documentos LaTeX y la [arquitectura histórica](docs/arquitectura.md) son material de referencia. No deben interpretarse como instrucciones actuales si contradicen la arquitectura vigente.

## Limitaciones conocidas

- Con una pantalla secundaria la vista pública se muestra en fullscreen como `tv`; sin ella se muestra como una ventana normal en el display primario.
- El operador y la pantalla pública pueden abrirse en Chrome o Edge de la misma PC, pero el acceso desde teléfonos u otros equipos no está habilitado.
- El acuse de audio confirma el flujo de software, no la salida física por HDMI o bocinas.
- Si falla el guardado de un turno, la acción se rechaza y la cola no cambia.
- YouTube y el clima dependen de servicios externos; el contenido local se utiliza como respaldo.
- La aceptación final requiere pruebas en la PC, TV, bocinas y red reales del local.

## Contribuir

1. Crea una rama desde la base actual.
2. Instala las dependencias con `npm ci`.
3. Mantén los cambios enfocados y actualiza la documentación cuando cambie el comportamiento.
4. Ejecuta formato, lint, pruebas y build antes de abrir el pull request.
5. Describe el contexto, el comportamiento esperado, la validación realizada y cualquier limitación pendiente.

Los cambios que afecten IPC, persistencia, seguridad, audio o empaquetado deben incluir pruebas o una justificación explícita de por qué no son aplicables.

## Licencia

El código propio se distribuye bajo [MIT](LICENSE). Los recursos y dependencias de terceros conservan sus respectivas licencias. Comal++ no distribuye ni imprime tickets y no requiere una base de datos o servicio de red para su operación normal.
