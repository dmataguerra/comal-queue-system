# Revision de firmas — 27 de septiembre de 2026

Estado: NO aprobado para entrega firmada.

Se revisaron los cambios existentes en la rama codex/windows-code-signing y los
artefactos 0.3.1. No se encontraron certificados de firma en las consultas a
CurrentUser/My y LocalMachine/My. La consulta del TPM no fue concluyente:
no debe interpretarse como prueba de que el hardware este deshabilitado.

El instalador, el ejecutable instalado y el desinstalador de
test-results/installed-ZHohyZ/app tienen estado NotSigned y carecen de sello de
tiempo. El SHA-256 del instalador es
A4F9ED4381A1943644033F29742451F020DA647B57FE3B65C170589417454BCF.
El mensaje de electron-builder «signing with signtool.exe» no acredita firma.

## Cambios de esta revision

- El preflight local comprueba vigencia, EKU Code Signing, clave RSA en TPM y
  politica no exportable antes de empaquetar.
- scripts/verificar-firmas.ps1 exige los tres archivos, Authenticode Valid,
  huella esperada, EKU Code Signing y presencia de certificado de sello de tiempo.
  Calcula SHA-256 y termina con codigo 1 si falta cualquier requisito.
- Se comprobo el rechazo de los tres artefactos actuales sin firma. Todavia no
  hay artefactos firmados para comprobar el camino de aceptacion.

## Pasos pendientes

1. Para distribucion publica, obtener acceso aprobado a un servicio de firma o
   certificado autorizado. SignPath Foundation sigue pendiente; no hay evidencia
   de solicitud enviada ni aprobacion. No prometer fecha de aprobacion.
2. Confirmar responsable/publicador, permisos de recursos distribuidos, MFA,
   politica de firma y privacidad, y enlaces publicos de codigo y descargas.
3. Configurar la identidad real. Un servicio administrado puede requerir una
   integracion especifica; las variables PFX no sustituyen esa integracion.
4. Reconstruir firmando aplicacion y desinstalador antes de incluirlos en NSIS,
   y firmar el Setup final con sello de tiempo.
5. Instalar en entorno de prueba y ejecutar el verificador con la huella real:

   powershell.exe -NoProfile -File scripts/verificar-firmas.ps1 -Instalador '<Setup.exe>' -CarpetaInstalada '<carpeta>' -HuellaEsperada '<40 caracteres hex>'

   La politica de ejecucion de este equipo bloqueo el script inicialmente. La
   prueba se ejecuto con una excepcion aprobada limitada al proceso; no se cambio
   la politica persistente. El preflight local tambien requiere una politica que
   permita ejecutar el script revisado.
6. Validar cadena y timestamp con SignTool verify /pa /all /v, registrar nuevos
   hashes y repetir instalacion, actualizacion y arranque en Windows destino.

La alternativa local requiere identidad elegida, TPM comprobado, emision de clave
no exportable y confianza autorizada en el equipo destino. No equivale a firma
publica ni garantiza reputacion SmartScreen. No se emitieron certificados ni se
modificaron almacenes de confianza durante esta revision.

La aceptacion funcional tambien sigue pendiente: el ultimo smoke instalado
termino con fallo GPU. No se demostro aun si se limita al entorno automatizado;
no puede declararse que la firma sea el unico bloqueo de produccion.

Referencia: https://signpath.org/terms.html (consultada durante esta revision).
