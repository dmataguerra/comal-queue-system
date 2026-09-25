# Publicación de Comal++ 0.3.0

El `package.json`, la raíz de `package-lock.json` y la configuración de `electron-builder` indican la versión **0.3.0**. El instalador esperado para Windows x64 es `release/Comal++ Setup 0.3.0.exe` (NSIS). `release/` también contiene un instalador 0.2.0 y un `latest.yml` antiguo; ninguno demuestra el estado de la versión actual.

## Estado de la revisión

La base de esta revisión es `529b5d422e3c02d19e4f83280ec975525a46ac0f`. El código de la aplicación quedó dividido en los commits `113e325` (núcleo) y `7474021` (interfaz). El instalador anterior de 0.3.0 tenía SHA-256 `9E7F16E471A1468AAA790A145324CC9ECCD2A26A67DFD64D3F12412F46FA6E96`; ya no representa el código actual.

El 25 de septiembre de 2026 se reconstruyó `release/Comal++ Setup 0.3.0.exe` desde esos dos commits con `npm run desktop:build`: tamaño **125,116,558 bytes**, SHA-256 **`573B4EFBC3A400180113969F9579E36D1B813DCB6FCA0C57CF2BF141B8A57229`**. Authenticode informa **NotSigned**. El `app.asar` contiene `package.json` 0.3.0, `build/main/main.js` y ambas vistas bajo `dist/`. El contenido externo incluye `40.wav` y las dos imágenes locales. Este hash identifica el instalador local reconstruido; debe conservarse el binario junto con la revisión publicada para poder rastrear la entrega.

La instalación aislada del instalador nuevo terminó con código 0 en `test-results/verify-installer-ui-20260925`; se comprobaron el ejecutable, `40.wav` y las dos imágenes. Las pruebas de escritorio del árbol de código pasaron, incluida la decodificación de 101 audios y la carga de imágenes. El ejecutable recién instalado no se sometió de nuevo a la secuencia completa de turnos y cierre. La aceptación en la PC, TV y bocinas reales de COMAL sigue pendiente.

## Comandos de construcción y validación

En Windows con Node.js 22 o posterior, desde el repositorio:

```powershell
git rev-parse HEAD
git status --short
npm ci
npm run format:check
npm run verify:audio
npm run lint
npm test
npm run build
npm run test:desktop
npm run desktop:build
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\Comal++ Setup 0.3.0.exe'
```

Registre en el expediente de entrega el commit, versión, fecha, salida exacta del instalador, tamaño y SHA-256. `npm run desktop:build` produce un artefacto sin firma cuando no hay certificado configurado. Para una distribución firmada siga la [política de seguridad y publicación](seguridad-y-publicacion.md) y use `npm run desktop:build:signed` con credenciales inyectadas por el responsable de publicación.

## Prueba manual del instalador exacto

1. Copie el instalador cuyo hash se registró a una cuenta Windows estándar de prueba. Verifique de nuevo el hash antes de ejecutarlo.
2. Cierre cualquier instalación previa y respalde `Documentos\Turnero Comal` según la [guía de operación](operacion-recuperacion.md). Instale y compruebe que el ejecutable informa la versión 0.3.0.
3. Con dos pantallas en modo extendido y datos de prueba aislados, abra la aplicación. Confirme que la ventana del operador queda en la pantalla principal y la pública en la secundaria.
4. Llame el turno 40 y otro turno. Confirme imagen y voz audibles, guardado en `estado.json`, corrección de turno y recuperación tras cerrar y abrir la aplicación.
5. Compruebe imágenes y videos locales sin internet, reconexión de la TV, importación de un archivo pequeño, aviso por archivo demasiado grande y respaldo/restauración con la aplicación detenida.
6. Revise `turnero.log`, cierre limpio y ausencia de procesos Electron residuales. Registre las condiciones de PC, TV, bocinas, escala de pantalla y resultado.

La prueba en la PC y pantalla reales del local sigue siendo obligatoria antes de declarar lista la publicación.
