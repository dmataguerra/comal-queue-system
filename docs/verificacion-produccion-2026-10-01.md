# Verificación de producción: puntos 4, 5, 8, 9 y 10

> **Registro histórico / evidencia fechada.** Resultados, hashes, conteos y pendientes corresponden a la ejecución descrita, no a cualquier compilación posterior con el mismo número de versión. Consulte [documentación vigente](README.md), [revisión del 1 de octubre](actualizacion-documentacion-2026-10-01.md) y [lista de publicación](lista-publicacion.md) para cambios y aceptación actual. Se conserva el cuerpo original como evidencia.

Fecha local: 1 de octubre de 2026, America/Mexico_City. Los logs posteriores a las 18:00 muestran 2 de octubre en UTC.
Base obtenida con `git fetch`: `origin/codex/rebuild-ci-cd`, commit `5c901043335a0e7032331a9b26392c9e97d63c13`.
Rama de trabajo: `codex/production-readiness`. Los cambios están en el árbol de trabajo; no se publicó un release.

**Dictamen: no listo para publicación de producción.** Las correcciones y pruebas locales siguientes pasan, pero falta identidad de firma, aprobación operacional en destino y evidencia de protecciones remotas. No se acepta una excepción para publicar unsigned.

## Cambios por punto

| Punto | Cambio mínimo y comportamiento comprobado |
| --- | --- |
| 4. Audio | Falta de aviso, voz silenciada, ausencia/fallo de voz o contexto suspendido no confirman «Anunciado». Se registra fallo, se conserva el turno y continúa la cola. La captura informa «en cola de audio» hasta recibir acuse. Revisión por tamaño/timestamps invalida buffers al reemplazar voz/aviso bajo el mismo nombre; la vigilancia conserva inventario anterior y registra errores de exploración. Un rechazo de video.play se registra y activa respaldo local. Se reusa el retry de guardado atómico para publicar contenido ante bloqueos transitorios Windows. |
| 5. Navegador/YouTube | YouTube web se rechaza con mensaje visible; no se monta iframe aunque Electron lo configure. Multimedia local y acuses HTTP continúan. Salud y logs web ya no son no-op. En escritorio: inicio silenciado, confirmación del volumen vigente antes de playback, salud correcta solo con estado playing, rechazo de solicitudes obsoletas/video desconectado y respaldo local al perder control. |
| 8. Cola | Se mantienen las reglas existentes: seis anuncios FIFO incluyendo activo, advertencia desde cinco, rechazo antes de guardar/mutar al llenarse, espera 45 s y duración máxima de tarea 30 s. Duplicados tienen IDs independientes; no se aceptan acuses terminales tardíos. Se añadió aviso visible antes de que otro número retire el más antiguo de los seis turnos recientes. Ayuda y recuperación describen esta diferencia y la vigencia de cinco minutos. |
| 9. Recuperación | Restore valida estado/config antes de tocar destino; fechas imposibles, estructura/JSON inválidos, config inválida y rutas superpuestas se rechazan. Se conserva destino anterior y se reintenta rename transitorio con el mecanismo existente. Nuevo `test:recovery` ejecuta el CLI real y compara hashes. Migración valida conservación byte a byte de SQLite y rechazo de config legacy corrupta. El smoke upgrade incorpora deadlines HTTP/DevTools y rechazo al desconectarse, como el instalado. |
| 10. Seguridad/publicación | Audit actual sin vulnerabilidades. CD exige entorno production, ambos secretos y huella aprobada; elimina publicación unsigned. Comprueba Setup/app/desinstalador, timestamp, hash exacto y actualización/reversión del artefacto firmado. Publica SHA-256/SBOM y conserva evidencias. CI ejecuta recuperación CLI y conserva diagnósticos al pasar. |

## Comandos y resultados

Salidas consolidadas: `test-results/production-readiness/`. Las pruebas usan carpetas aisladas bajo `test-results/`; el smoke instalado y upgrade ejecutan instaladores NSIS reales del mismo producto. No se manipularon los datos de operación de la aplicación.

| Comando ejecutado | Resultado y evidencia |
| --- | --- |
| `git fetch origin codex/rebuild-ci-cd`; `git switch -c codex/production-readiness origin/codex/rebuild-ci-cd` | Base remota y rama nueva verificadas. |
| `node --version`; `npm --version`; `npm ci` | Node 22.19.0, npm 10.9.3; 573 paquetes instalados desde lockfile. `npm-ci.log`. |
| `npm run verify:audio` | 100 voces: 99 MP3 seleccionados y un WAV; aviso WAV. `audio-catalog.log`. |
| `npm test` | 126 pruebas pasan, 0 fallos/canceladas/omitidas. `tests.log`. Incluye fallback de archivos vacíos, reemplazo de voz bajo el mismo nombre y cache invalidado, FIFO, saturación sin mutación, caducidad, repetidos, errores de audio/decodificación/dispositivo, rampas, persistencia, respaldo y migración. |
| `npm run build` | TypeScript/Vite y proceso principal pasan. `build.log`. |
| `npm run format:check`; `npm run lint`; `git diff --check` | Pasan. `format.log`, `lint.log`; diff sin errores de whitespace. |
| `npm audit --json` | 0 vulnerabilidades; high=0, critical=0; 644 dependencias en informe del registro. `audit.json`. Sin cambios especulativos de versiones. |
| `npm sbom --sbom-format cyclonedx` | SBOM válido con 573 componentes instalados. `sbom.json`. La cifra difiere de audit por dependencias opcionales/de plataforma. No certifica derechos de recursos gráficos o voces. |
| `npx electron scripts/smoke-desktop.mjs` | 101 audios seleccionados decodificados en Chromium; llamada offline, FIFO 55→66 y geometría 1080p/1440p/4K. `desktop.log`. No certifica reproducción audible de YouTube. |
| `npx electron scripts/smoke-audio-controls.mjs` | Volumen, autorización IPC, acuses por fila, recarga, aviso/voz ausentes, carga inválida, reemplazo real de 40.wav por bytes corruptos (mismo nombre) detectado como fallo y restauración de esos bytes con llamada recuperada. `audio-controls.log`; `test-results/audio-controls-DWM3Io/turnero.log`. |
| `npx electron scripts/smoke-browser.mjs` | Acuse por HTTP; rechazo YouTube, config de escritorio sin iframe web, salud/registro y bloqueo de solicitudes externas. `browser.log`. Chromium automatizado con autoplay permitido; Chrome/Edge real requiere aceptación con gesto de usuario. |
| `npx electron scripts/smoke-hardening.mjs` | Saturación sin mutación, seis IDs del mismo número, retiro de pendientes, IPC durante importación y aviso del turno más antiguo (43). `hardening.log`. |
| `node scripts/smoke-media.mjs` | Desarrollo y built pasan: video real avanza; dos llamadas con aviso y dos voces cada una, ducking=0.09 antes de los seis inicios, gain de voz=0.8 y restauración=0.6. Pausa de repetición ≥300 ms; rechazo simulado de video.play activa banners y queda en log. `media.log`; `test-results/media-smoke-gO9aq2/audio-timing.json` y `test-results/media-smoke-nG6fZJ/audio-timing.json`. |
| `npm run test:full-day:preflight` | PREFLIGHT_PASS: siete anuncios, uno después de recarga. `preflight.log`; `test-results/full-day-oNjlHV/jornada-completa.json`. No acredita 390 minutos. Temperatura WMI no disponible (acceso denegado); consta en informe. |
| `npm run test:recovery` | CLI backup/restore reales, hashes idénticos para JSON/voz/log, confirmación de app cerrada obligatoria, respaldo corrupto rechazado, destino corrupto restaurado y anterior conservado. `recovery.log`; `test-results/recovery-cli-dOAnSk/resultado.json`. |
| `node scripts/package-desktop.mjs --win --publish never` | Instalador final generado con build actual. `package.log`. |
| `npm run test:installed` | Instalación real aislada, estado tras reinicio, ruta predeterminada simulada con perfil aislado, voz 40 y ausencia de eventos Defender 1123; hash exacto abajo. `installed.log`; `test-results/installed-GyEV3e/resultado.json`. Cuenta estándar en destino aún pendiente. |
| `npm run test:upgrade` | Binario real 0.2.0 creó SQLite con 42; 0.3.1 lo conservó y guardó 43; reinstalación 0.2.0 con respaldo recuperó 42. Última ejecución sobre el hash final: `upgrade.log`; `test-results/upgrade-wTAEmJ/resultado.json`. Los nuevos turnos 0.3.1 no se transfieren a 0.2.0. |
| `Get-FileHash` / `Get-AuthenticodeSignature` | SHA-256 del Setup final abajo; `NotSigned`. No hay identidad aprobada con la que demostrar el camino firmado exitoso. |
| `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/verificar-firmas.ps1 -Instalador "release/Comal++ Setup 0.3.1.exe" -CarpetaInstalada "test-results/installed-GyEV3e/app" -HuellaEsperada "0000000000000000000000000000000000000000"` | Código 1 esperado: Setup, app y desinstalador son `NotSigned`, sin timestamp, Aceptado=false. `signatures.json`. Huella nula usada exclusivamente como prueba negativa; no es identidad aprobada. La política de ejecución se cambia solo para este proceso. |
| `node test-results/production-readiness/validate-release-gates.mjs` | YAML parseado; cuatro configuraciones inválidas rechazadas al ejecutar el bloque PowerShell real (sin secretos, secreto incompleto, huella ausente, tag incorrecto). `release-gates.log`, `release-gates.json`. Caso positivo comprueba solo sintaxis; no firma ni protecciones remotas. |
| `gh api repos/dmataguerra/comal-queue-system/environments/production` | Código 4: GitHub CLI sin autenticación. `github-environment.json`. No se pudo acreditar revisores/protecciones ni ejecutar CD remoto. |

Instalador validado: `release/Comal++ Setup 0.3.1.exe`.
SHA-256: `452D1E4B8BC12D8CF32180B102D6383049F24711C6C72B0CA831441EAFC1144C`.
Baseline 0.2.0 usado: `release/archive-0.2.0/Comal++ Setup 0.2.0.exe`.
SHA-256 observado: `B469D2651A0C65C19B9C98109684BA9A0E035935C78CF66A619CF445691583D7`.
Ambos ensayos locales usan instaladores unsigned; no prueban confianza pública del firmante.

El primer npm ci/test y el smoke Electron restringidos fallaron por acceso al cache/consulta de usuario `uv_os_get_passwd ENOMEM` y procesos GPU. Fuera del aislamiento pasaron. El primer browser y CLI backup reprodujeron `EPERM` al publicar una carpeta; se mantuvo rechazo visible y se reusó retry acotado de Windows. El CLI y smokes posteriores pasan. No se desactivó Defender ni se modificó permanentemente la política de ejecución.

## Estado final y evidencia faltante

| Punto | Estado | Evidencia local | Riesgo restante / próximo paso concreto |
| --- | --- | --- | --- |
| 4 | needs hardware validation | Catálogo, 101 decodes, fallos observables, recuperación, timing y gain medidos | En PC del local escuchar 00/40/99 y aviso; desconectar/reconectar HDMI/bocinas, suspender Windows y repetir llamadas/volumen. Un contexto running no demuestra salida física ni pronunciación correcta. |
| 5 | needs hardware validation | YouTube navegador deshabilitado y verificado; rechazo HTTP sin iframe; tests de inicio/rampas/obsolescencia y fallback local | YouTube escritorio real, primera carga/playlist/reconexión/cambio de volumen con internet, y Chrome/Edge real con gesto de usuario necesitan validación en hardware. Para piloto usar contenido local. |
| 8 | fixed | Unitarias y smoke: rechazo sin guardar, IDs, vencimiento, continuación y advertencias visibles | Cadencia visual mínima de 6 s se conserva; no acredita carga ni latencia de toda la jornada. Ejecutar resistencia real y acordar uso de pantalla como seis turnos recientes. |
| 9 | fixed | CLI real con hashes, corrupción rechazada, SQLite preservada, instalación y upgrade/rollback reales | Apagado físico/disco lleno/permisos revocados en destino no simulados integralmente; fallos de escritura están cubiertos por pruebas de inyección. Restaurar con app cerrada: flag expresa confirmación humana, no detecta procesos. Conciliar manualmente turnos nuevos al revertir a 0.2.0. |
| 10 | blocked | Audit cero, SBOM, build/instalación y gate firmado implementado | Obtener firmante aprobado; configurar secretos y huella, revisores y restricciones de tags/rama; ejecutar CD y verificar firmas válidas del artefacto final. Aprobar derechos de voces/imágenes/marcas y responsable de soporte. Ejecutar jornada real de 390 min y aceptación en usuario estándar/hardware destino. |

Los límites que se aceptan en el código son el modo local sin YouTube web, la ventana de seis turnos recientes y los plazos finitos con recuperación manual visible. No se aceptan publicación unsigned, confianza de firmante sin verificar ni sustituir la jornada/hardware por el preflight. El release permanece bloqueado hasta adjuntar esa evidencia al checklist de publicación.

## Actualización del 2 de octubre de 2026

La jornada local completa terminó **PASS (390 minutos reales)** el 2 de octubre de 2026, con 124/124 anuncios completados y 422 comprobaciones de integridad correctas. Véase el [resultado de jornada del 2 de octubre](resultado-jornada-2026-10-02.md). Este resultado posterior resuelve el pendiente de resistencia local; la aceptación del hardware destino y del candidato/instalador final permanece separada.
