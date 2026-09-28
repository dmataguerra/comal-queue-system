# Publicación de Comal++ 0.3.0

## Estado al 26 de septiembre de 2026

La rama es `codex/comal-architecture-refactor`, con HEAD `d6030b10f4063ccc3f050a8ebce497f6cde82cd1`. El árbol Git está limpio y ese commit contiene los cambios de arquitectura, interfaz, smoke tests y documentación publicados. El instalador descrito más abajo pertenece a una compilación anterior y no es reproducible desde este commit; para una publicación definitiva hay que reconstruirlo y registrar un nuevo hash.

El instalador local `release/Comal++ Setup 0.3.0.exe` mide **125,123,434 bytes** y tiene SHA-256 **`DF5ED721D234CDFA7C49BCBC0D1566642FA5E3634B461CB359BB6691D0A89DAC`**. `Get-AuthenticodeSignature` informa **NotSigned**. Este artefacto aún no es una entrega final aprobada.

El 0.2.0 y su `latest.yml` antiguo se conservaron en `release/archive-0.2.0/`. No hay `latest.yml` vigente para 0.3.0 ni un flujo de actualización automática configurado. Esos archivos antiguos no deben acompañar la entrega 0.3.0.

## Evidencia disponible

- `npm run build`, `npm run lint` y `npm test` pasaron en el commit actual; `npm test` terminó con 88 pruebas correctas. `npm run test:browser` comprobó operador, pantalla pública, sincronización, acuse visible del audio y bloqueo de solicitudes externas. `npm run test:desktop` comprobó las vistas, audio y geometría en 1080p, 1440p y 4K.
- `npm run test:installed` instaló silenciosamente **ese SHA-256** en una carpeta aislada, verificó el ejecutable y contenido de fábrica, llamó el turno 42 y comprobó que `estado.json` conservó el turno tras reiniciar. Evidencia: `test-results/installed-ehEZMZ/resultado.json` (ignorada por Git).
- `npm run test:upgrade` instaló 0.2.0, creó el turno 42 en SQLite y respaldó ese perfil; instaló 0.3.0, migró el 42 y guardó el 43; reinstaló 0.2.0 y recuperó el 42 desde el respaldo. Evidencia: `test-results/upgrade-HrKZ8k/resultado.json` (ignorada por Git). Ambas pruebas usaron la cuenta Windows actual y rutas aisladas.
- Quedan pendientes una ejecución con cuenta estándar independiente, la salida audible en bocinas, la presentación en la TV real, la emisión y verificación del certificado de firma local y la aceptación en el local.

## Procedimiento de publicación

Desde un árbol Git limpio y con Node.js 22 o posterior en Windows:

```powershell
git rev-parse HEAD
git status --short
npm ci
npm run format:check
npm run lint
npm test
npm run test:browser
npx electron scripts/smoke-display-scale.mjs
npm run desktop:build:signed
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\Comal++ Setup 0.3.0.exe'
Get-AuthenticodeSignature -LiteralPath 'release\Comal++ Setup 0.3.0.exe'
npm run test:installed
npm run test:upgrade
```

Para la modalidad de certificado local protegido por TPM, sustituya el empaquetado anterior por `$env:COMAL_SIGNING_CERT_SHA1='<huella>'; npm run desktop:build:local-signed` en PowerShell, usando la cuenta y el almacén de Windows documentados en [firma-local.md](firma-local.md). No mezcle variables `CSC_LINK` o `WIN_CSC_LINK` con esa modalidad.

El certificado de firma debe proporcionarlo el responsable de publicación según la [política de seguridad](seguridad-y-publicacion.md). Compruebe `Status: Valid` tanto para el instalador como para el ejecutable instalado. Registre commit, estado Git limpio, versión, tamaño, SHA-256, firma, fecha, pruebas y responsable en una copia de la [lista de publicación](lista-publicacion.md). Una nueva compilación, firma o cambio de origen genera otro binario y exige repetir el hash y la prueba instalada.

## Aceptación pendiente en destino

Con datos respaldados y una cuenta Windows estándar, repita instalación limpia, actualización desde 0.2.0 y reversión con restauración del respaldo. En la PC, TV y bocinas reales del local, confirme pantallas extendidas, escalas, HDMI, llamadas 40 y otro turno, audio audible, acuse mostrado al operador, multimedia sin internet, desconexión y reconexión de TV, cierre y reinicio, persistencia, `turnero.log` y recuperación. Registre evidencia y resultado de cada paso; el acuse de software no certifica que el sonido salió por las bocinas.
