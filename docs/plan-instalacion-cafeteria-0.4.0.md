# Plan de instalación de Comal++ 0.4.0 en la cafetería

Fecha de revisión: 5 de octubre de 2026. Estado: **candidato local 0.4.0 generado y probado; firma y aceptación en destino pendientes**.

## Artefacto preparado

El instalador local es `release/Comal++ Setup 0.4.0.exe`. La carpeta `release/INSTALADOR_0.4.0` contiene el Setup, SHA-256, guía USB, evidencia y un instalador anterior para reversión. El nombre interno sigue siendo `comal-local` y el producto visible `Comal++`; ambos metadatos y las versiones del Setup y aplicación se comprobaron como 0.4.0. No hay certificado de firma disponible en esta sesión. Consultar `VERIFICACION.md` en el paquete para el alcance exacto de las pruebas.

## Resultado de la revisión inicial, antes de preparar el artefacto

- El checkout actual declara `0.3.1` en `package.json` y `package-lock.json`; el archivo disponible es `release/Comal++ Setup 0.3.1.exe`.
- La rama de documentación en `.worktrees/documentacion` declara `0.4.0` en ambos archivos y en su README, pero sus notas indican que el tag y la publicación están pendientes. No contiene un instalador 0.4.0.
- `README-INSTALACION-USB.md` sigue indicando `0.3.1` en ambos árboles. Se debe actualizar solo cuando exista el artefacto final validado.
- El nombre interno del paquete es `comal-local` y el nombre visible configurado es `Comal++`. Con la configuración actual, el nombre esperado del nuevo instalador es `Comal++ Setup 0.4.0.exe` para Windows x64.
- El `SHA256.txt` local no corresponde al instalador 0.3.1 presente: archivo `26C76C06D3A1123F793CFC06C248C1458EDAF724A25834F8B08DC71840D2AF80`; hash calculado `A805986D72CD6F918714A6238A2BDC19E133EADF646B13CAD9A5989C8452A307`. No usar ese par para verificar una copia.
- El instalador 0.3.1 presente aparece como `NotSigned` en Windows. La documentación de publicación exige firma y validación del artefacto final.
- No se pudo consultar la publicación remota desde este entorno. Antes de instalar, confirmar en la fuente oficial el tag, commit, archivo, firma y hash de 0.4.0.

## 1. Preparar el artefacto

1. Obtener el instalador 0.4.0 de la publicación oficial o generarlo desde el commit final aprobado. Confirmar que tag `v0.4.0`, `package.json`, `package-lock.json`, nombre del Setup y versión mostrada por Windows coincidan.
2. Comprobar firma digital del Setup, aplicación y desinstalador según `docs/lista-publicacion.md`. Registrar firmante y resultado.
3. Calcular SHA-256 del Setup definitivo y guardarlo junto al archivo, con el nombre exacto del instalador. Recalcularlo después de copiarlo a la USB.
4. Ejecutar la lista de publicación y las pruebas de instalación/actualización sobre **ese mismo hash**. Actualizar la guía USB para 0.4.0 y retirar instrucciones que nombren 0.3.1 como candidato actual.
5. Llevar una copia verificada del instalador anterior y del procedimiento de reversión. No sobrescribir ni renombrar el instalador anterior.

## 2. Preparar la computadora de la cafetería

1. Acordar una ventana sin clientes y registrar responsable, fecha, versión instalada, usuario de Windows, ruta de datos indicada en **Ayuda → Diagnósticos**, configuración de TV/HDMI, bocinas, volumen y contenido multimedia.
2. Cerrar Comal++ y confirmar que no queden procesos de la aplicación.
3. Respaldar `config.json`, `estado.json`, `contenido/` y `turnero.log` desde la ruta de datos real. Guardar una copia fuera de la PC y comprobar que se puede abrir. Conservar el respaldo sin alterarlo.
4. Revisar espacio libre, conexión de TV y bocinas, y disponibilidad del usuario habitual de operación. Preparar contenido local para la prueba sin internet.

## 3. Instalar y aceptar

1. Verificar en la PC el hash y la firma del instalador copiado. Si difieren de la evidencia aprobada, detener la instalación.
2. Ejecutar `Comal++ Setup 0.4.0.exe` con el usuario previsto. Conservar la carpeta de datos existente y abrir la aplicación.
3. Confirmar que la versión mostrada sea 0.4.0 y que configuración, turnos y multimedia previos permanezcan. Comprobar operador y pantalla pública en la TV extendida.
4. Llamar `00`, `01`, `09`, `40`, `55`, `66` y `99`; comprobar visualización, voz completa, estado anunciado, repetición y corrección. Probar dos llamados seguidos y la cola llena sin pérdida de turnos.
5. Con video local, comprobar que la multimedia baja antes del timbre y voz, y recupera su volumen al terminar. Repetir tras pausa, cambio de video y reconexión de bocinas/HDMI.
6. Desconectar temporalmente internet y comprobar llamadas, pantalla y voces locales. Reiniciar la aplicación y confirmar persistencia de turnos, TV, audio e imágenes.
7. Registrar hora, resultado, capturas o logs, versión, SHA-256, firma y aceptación del responsable de la cafetería. Conservar USB y respaldo hasta completar la prueba.

## 4. Si falla la aceptación

1. Dejar de llamar turnos, cerrar la aplicación y guardar copia de los datos y `turnero.log` tal como quedaron tras el fallo.
2. Registrar los turnos emitidos después del respaldo para conciliarlos manualmente.
3. Reinstalar el instalador anterior **verificado** y restaurar el respaldo previo mediante el procedimiento de `docs/operacion-recuperacion.md`. Comprobar operador, TV, audio y turnos antes de volver a atender.

**Condición de salida:** completar la firma aprobada y la aceptación en la PC de la cafetería. Firmar o reconstruir cambia el hash: repetir la verificación y las pruebas sobre el archivo final.
