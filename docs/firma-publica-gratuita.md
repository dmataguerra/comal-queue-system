# Firma pública gratuita de Windows

Estado: preparación; no hay certificado público emitido ni solicitud aprobada.

## Bloqueo observado y corrección

La captura del 27 de septiembre muestra **Controlled folder access**, no una detección de malware ni el aviso de reputación SmartScreen. Windows impide escribir en `Documentos/Turnero Comal`, ubicado bajo OneDrive por la redirección de Documentos del equipo. Comal no integra el servicio OneDrive: usaba `app.getPath('documents')`.

Un segundo evento, a la 01:00, identificó al instalador al intentar crear un acceso directo en un Escritorio dentro de OneDrive. NSIS habilita ese acceso directo por defecto y puede terminar con éxito pese al bloqueo. La configuración ahora desactiva explícitamente el acceso directo del Escritorio y conserva el del menú Inicio. La aceptación debe revisar también eventos 1123 de Defender posteriores a la instalación. Los instaladores/desinstaladores históricos conservan su configuración anterior y pueden generar avisos al ejecutarlos.

El evento de las 01:03 provenía de `old-uninstaller.exe`, ejecutado desde una carpeta temporal por el instalador. La prueba inicial filtraba solo la ruta del Setup y del ejecutable instalado, por lo que omitió ese bloqueo; aquel resultado no acredita ausencia de avisos. La prueba corregida incluye el desinstalador temporal. El empaquetador adapta una copia temporal de la plantilla NSIS para pasar `--keep-shortcuts` a desinstaladores anteriores que declaren soportarlo, incluso si cambia la carpeta de instalación. Conserva la generación normal del desinstalador para que pueda firmarse cuando haya certificado. Si cambia la plantilla de electron-builder, el empaquetado falla hasta revisar la adaptación. Los accesos antiguos del Escritorio no se eliminan automáticamente; si apuntan a una instalación antigua, usar el menú Inicio.

La aplicación empaquetada ahora guarda en `app.getPath('userData')/datos`, normalmente `%APPDATA%/comal-local/datos`. Confirmar la ruta efectiva en **Ayuda → Diagnósticos**. No utiliza Documentos para los nuevos guardados ni requiere añadir exclusiones de Defender. Una política que proteja también el perfil de la aplicación requiere evaluación en el equipo de destino; no se puede garantizar compatibilidad con todas las políticas.

En una actualización, si el destino todavía no existe, se copian configuración, turnos, contenido y registro desde la ubicación anterior; nunca se escriben ni borran los originales. La copia se publica completa mediante renombrado. Si no puede leerse o copiarse, el arranque muestra un error para evitar comenzar una jornada vacía inadvertidamente. Los archivos antiguos que solo estén en la nube deben estar disponibles para copiarlos. Una vez migrado, la app no vuelve a importar la copia antigua. `TURNERO_DATOS` sigue siendo una anulación explícita para pruebas o instalaciones administradas; apuntarla a Documentos puede reproducir el bloqueo.

## Opción seleccionada: SignPath Foundation

La licencia elegida para el código propio es MIT, aprobada por OSI y compatible con uso, modificación y redistribución comercial. No cambia las licencias de dependencias, fuentes, iconos, modelos de voz ni materiales de terceros. `private: true` en package.json previene publicación accidental en npm; no indica la visibilidad del repositorio de GitHub.

SignPath Foundation ofrece firma gratuita a proyectos abiertos elegibles. El certificado identifica a la fundación como publicador; no es un certificado emitido con el nombre personal del desarrollador. La aprobación es externa y no está garantizada. Esta vía evita instalar un certificado autofirmado en cada PC. Tampoco garantiza reputación inmediata de SmartScreen ni acceso automático a carpetas protegidas.

Datos preparados para la solicitud:

- Proyecto: Comal++ / comal-queue-system.
- Repositorio configurado: https://github.com/dmataguerra/comal-queue-system.
- Descripción: aplicación de escritorio para Windows que administra turnos de pedidos, presenta una pantalla pública y reproduce anuncios de voz locales; no registra ventas ni imprime tickets.
- Licencia del código propio: MIT.
- Plataforma: Electron, Windows x64, instalador NSIS y ejecutable Comal++.exe.
- Compilación: npm ci, npm test, npm run build y empaquetado con electron-builder.

Antes de enviar en https://signpath.org/apply.html:

1. Confirmar acceso público al código, licencia y una página de descargas con una versión publicada. No se confirmó la visibilidad remota desde esta sesión.
2. Revisar procedencia y permisos de redistribución de todos los recursos entregados, especialmente voces MP3, WAV, imágenes y videos. Agregar MIT no relicencia esos recursos ni demuestra que cumplen las condiciones de la fundación.
3. Identificar a las personas autoras, revisoras y aprobadoras; activar MFA en sus cuentas. Publicar la política de firma y privacidad con roles reales. No afirmar patrocinio de SignPath antes de la aceptación.
4. Enviar la solicitud con el contacto del responsable y los enlaces públicos reales. No se ha enviado información ni aceptado condiciones en nombre del responsable.
5. Tras la aprobación, configurar el flujo de compilación y firma con los identificadores y credenciales que asigne SignPath. Firmar el ejecutable y el desinstalador antes de incluirlos en NSIS; firmar el instalador final después. No basta firmar únicamente el Setup ni un ZIP.
6. Verificar Authenticode, firmante, sello de tiempo y SHA-256 del artefacto final. Probar instalación, llamada de turnos, reinicio y actualización en Windows 11 con usuario estándar. Mantener las protecciones de Windows activas.

La integración del servicio queda pendiente de esos datos y de la aprobación. No se han creado claves autofirmadas porque requerirían configurar confianza en cada equipo y no cumplen la preferencia de instalación sin preparación previa.

## Fuentes

- [Microsoft: carpetas protegidas y redirección de OneDrive](https://learn.microsoft.com/en-us/defender-endpoint/controlled-folder-access-overview).
- [Microsoft: firma y reputación SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).
- [SignPath: requisitos del programa gratuito](https://signpath.org/terms.html).
- [OSI: licencia MIT](https://opensource.org/license/mit).
- [Electron: rutas de aplicación](https://www.electronjs.org/docs/latest/api/app#appgetpathname).

## Puerta de publicación de la implementación vigente

Revisado el 1 de octubre de 2026: esta guía prepara una identidad, no acredita su emisión o aceptación. CD exige `production`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` y la huella aprobada `COMAL_SIGNER_SHA1`; sin ellos no publica. Verifica firma/timestamp de Setup, app y desinstalador, hash exacto y upgrade/rollback. `COMAL_SIGNING_CERT_SHA1` corresponde al flujo local TPM y es una variable distinta. Integrar otro servicio de firma requiere adaptar y validar el workflow: no se asume una integración SignPath implementada. Los resultados de consultas anteriores del equipo siguen siendo evidencia fechada, no una comprobación actual del TPM. Véanse [CI/CD](CI-CD.md) y [la lista de publicación](lista-publicacion.md).
