# Publicación de Comal++ 0.3.0

## Estado al 26 de septiembre de 2026

La rama es `codex/comal-architecture-refactor`, con HEAD `8560767cda5525b7efbbe6f867d4c27e4ea98f97`. El instalador descrito aquí se construyó **con cambios locales sin confirmar** sobre ese commit. Por tanto, el commit por sí solo no reproduce el binario. Para una publicación definitiva, confirme los cambios, reconstruya desde el commit final y registre el nuevo hash.

El instalador local `release/Comal++ Setup 0.3.0.exe` mide **125,123,434 bytes** y tiene SHA-256 **`DF5ED721D234CDFA7C49BCBC0D1566642FA5E3634B461CB359BB6691D0A89DAC`**. `Get-AuthenticodeSignature` informa **NotSigned**. Este artefacto aún no es una entrega final aprobada.

El 0.2.0 y su `latest.yml` antiguo se conservaron en `release/archive-0.2.0/`. No hay `latest.yml` vigente para 0.3.0 ni un flujo de actualización automática configurado. Esos archivos antiguos no deben acompañar la entrega 0.3.0.

## Evidencia disponible

- `npm run build` y `npm test` pasaron; `npm test` terminó con 88 pruebas correctas. `npm run test:browser` comprobó operador, pantalla pública, sincronización, acuse visible del audio y bloqueo de solicitudes externas. `npm run test:desktop` comprobó las vistas, audio y geometría en 1080p, 1440p y 4K.
- `npm run test:installed` instaló silenciosamente **ese SHA-256** en una carpeta aislada, verificó el ejecutable y contenido de fábrica, llamó el turno 42 y comprobó que `estado.json` conservó el turno tras reiniciar. Evidencia: `test-results/installed-ehEZMZ/resultado.json` (ignorada por Git).
- `npm run test:upgrade` instaló 0.2.0, creó el turno 42 en SQLite y respaldó ese perfil; instaló 0.3.0, migró el 42 y guardó el 43; reinstaló 0.2.0 y recuperó el 42 desde el respaldo. Evidencia: `test-results/upgrade-HrKZ8k/resultado.json` (ignorada por Git). Ambas pruebas usaron la cuenta Windows actual y rutas aisladas.
- Quedan pendientes la cuenta estándar independiente, salida audible en bocinas, presentación en la TV real, firma digital y aceptación en el local.

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
npm run desktop:build:signed
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\Comal++ Setup 0.3.0.exe'
Get-AuthenticodeSignature -LiteralPath 'release\Comal++ Setup 0.3.0.exe'
npm run test:installed
npm run test:upgrade
```

El certificado de firma debe proporcionarlo el responsable de publicación según la [política de seguridad](seguridad-y-publicacion.md). Compruebe `Status: Valid` tanto para el instalador como para el ejecutable instalado. Registre commit, estado Git limpio, versión, tamaño, SHA-256, firma, fecha, pruebas y responsable en una copia de la [lista de publicación](lista-publicacion.md). Una nueva compilación, firma o cambio de origen genera otro binario y exige repetir el hash y la prueba instalada.

## Aceptación pendiente en destino

Con datos respaldados y una cuenta Windows estándar, repita instalación limpia, actualización desde 0.2.0 y reversión con restauración del respaldo. En la PC, TV y bocinas reales del local, confirme pantallas extendidas, escalas, HDMI, llamadas 40 y otro turno, audio audible, acuse mostrado al operador, multimedia sin internet, desconexión y reconexión de TV, cierre y reinicio, persistencia, `turnero.log` y recuperación. Registre evidencia y resultado de cada paso; el acuse de software no certifica que el sonido salió por las bocinas.
