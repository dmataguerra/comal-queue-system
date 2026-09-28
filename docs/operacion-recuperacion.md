# Operación y recuperación local

La aplicación guarda sus datos en `%APPDATA%\comal-local\datos` en producción, o en la carpeta indicada por `TURNERO_DATOS`. Cierre la aplicación antes de manipular esa carpeta. En desarrollo, los datos están en la raíz del repositorio salvo que se defina `TURNERO_DATOS`.

La ruta efectiva se muestra en **Ayuda → Diagnósticos**. Desde 0.3.1, Documentos/OneDrive ya no es el destino de escritura. Si todavía no existe la carpeta nueva, se copian los datos de `Documentos/Turnero Comal` una sola vez y se conserva el original. Si falla la copia, el arranque informa del problema; no comience con datos vacíos ni elimine el original. Tras migrar, los respaldos deben hacerse de la nueva ruta. Volver a 0.3.0 reutilizaría la copia antigua de Documentos, no los turnos posteriores a la migración.

## Guardado y salud

Los cambios de `config.json` realizados desde la aplicación y los cambios de `estado.json` se escriben primero en un archivo temporal en la misma carpeta, se vacían al disco y después sustituyen el archivo anterior. Un error de escritura se registra en `turnero.log`. El turno solo se confirma y anuncia después de guardar correctamente. Si falla, la ventana del operador muestra una advertencia, la cola y la TV no cambian, y el operador puede reintentar cuando corrija disco o permisos.

Si falta `estado.json`, se inicia una jornada vacía. Si pertenece a otro día, también se inicia vacía y se conserva el archivo anterior hasta el siguiente guardado. Si contiene JSON, estructura o fechas inválidas, la aplicación intenta crear una copia `estado.json.corrupto-*` y comienza vacía; revise el registro y conserve la copia para diagnóstico. Si el archivo no puede leerse por permisos u otro error de E/S, el inicio falla con un mensaje en lugar de tratarlo como ausente. Para recuperar un turno tras un reinicio inesperado, compruebe la fecha y el contenido de `estado.json` antes de continuar la operación.

## Copias y restauración

Haga copias con la aplicación cerrada. Desde el repositorio y con las dependencias instaladas, ejecute:

```powershell
npx tsx scripts/datos.ts backup "$env:APPDATA\comal-local\datos" "D:\Respaldos Comal"
```

La utilidad copia `config.json`, `estado.json`, `contenido/` y `turnero.log` cuando existen. Crea una carpeta nueva con fecha, hora e identificador único; el nombre final aparece solo cuando termina la copia. Compruebe que contiene los archivos esperados antes de moverla a otro disco. El registro puede contener rutas locales; protéjalo como dato de operación.

Para restaurar, cierre la aplicación y compruebe en el Administrador de tareas que `Comal++` no sigue ejecutándose. Cree primero una copia de la carpeta de datos actual. Después ejecute:

```powershell
npx tsx scripts/datos.ts restore "D:\Respaldos Comal\turnero-..." "$env:APPDATA\comal-local\datos" --app-cerrada
```

La opción `--app-cerrada` es una confirmación explícita de que verificó el cierre; la utilidad no puede detectar de forma fiable todas las instancias remotas o renombradas. La restauración prepara una carpeta nueva y luego la coloca en la ruta de datos. Conserva los datos anteriores en una carpeta `datos.antes-de-restaurar-*` junto a la ruta de datos. Inicie la aplicación y compruebe en la ventana del operador la pantalla pública, el audio y los turnos. Un `estado.json` de otra fecha no reabre turnos de una jornada anterior.

### Actualización desde 0.2.0 y reversión

La versión 0.2.0 guardaba turnos y configuración en `comal.sqlite` dentro del perfil de Electron, no en `%APPDATA%\comal-local\datos`. Con 0.2.0 cerrada, respalde el directorio que contiene `comal.sqlite` junto con posibles archivos `comal.sqlite-wal` y `comal.sqlite-shm`. Conserve también el instalador 0.2.0 verificado. Al abrir 0.3.0 por primera vez, si no existe `estado.json`, se leen sin modificar la base anterior, los turnos listos anunciados durante la jornada actual (máximo seis) y los mensajes/YouTube compatibles; se escriben los JSON nuevos. Los turnos de otras fechas y el historial permanecen en la base anterior. Compruebe turno, configuración y contenido antes de operar.

Para volver a 0.2.0, cierre 0.3.0, reinstale el instalador 0.2.0 verificado y restaure el respaldo del perfil de 0.2.0 con la aplicación cerrada. Los turnos creados después de migrar a 0.3.0 no aparecen en 0.2.0: registre esos turnos antes de revertir y concílielos manualmente. `npm run test:upgrade` prueba esta secuencia con datos aislados.

## Incidencias durante la operación

| Situación | Acción |
| --- | --- |
| La TV se desconecta | Revise energía, cable y modo de pantalla extendida. La vista pública reaparece cuando Windows detecta la pantalla. |
| La vista pública o la del operador se bloquea | La aplicación intenta recargar la vista. Si no vuelve, reinicie la aplicación y revise `turnero.log`. |
| Configuración inválida | Corrija `config.json` con la aplicación cerrada. Los valores inválidos se sustituyen por los predeterminados y se registran. |
| Falta audio | Revise `contenido/voz` y el aviso; ejecute `npm run verify:audio` desde el repositorio antes de instalar. |
| La primera copia de contenido quedó incompleta | Al arrancar se reponen las voces y el aviso obligatorios faltantes o vacíos desde el instalador. Los archivos vacíos reemplazados se conservan con sufijo `.incompleto-*`. Para banners y videos, cierre la aplicación, respalde datos y reponga manualmente solo los archivos necesarios. |
| YouTube o internet falla | Use videos e imágenes locales en `contenido/`. La lista de turnos y la voz local funcionan sin internet. |
| Poco espacio en disco | Libere espacio en la unidad de datos antes de importar contenido o continuar la jornada. |

La importación acepta videos de hasta 2 GB e imágenes de hasta 25 MB. Antes de copiar exige espacio libre para el archivo más una reserva de 512 MB cuando el sistema puede informar el espacio disponible. Si el sistema no ofrece esa medición, mantiene el límite de tamaño y sigue verificando el resultado de la copia. Un archivo rechazado se informa en la ventana del operador y se registra sin rutas de origen.

Cuando existe una segunda pantalla configurada como extendida, la vista pública se muestra allí en pantalla completa. Sin una segunda pantalla, la aplicación la muestra como una ventana normal en el display primario; el operador puede cambiar entre ambas ventanas en la misma PC. YouTube y el clima son servicios externos opcionales y pueden dejar de funcionar sin conexión.

## Diagnósticos, registro y política de recuperación

Abra **Ayuda** y seleccione el enlace a **Diagnósticos** al final de la lista. El panel muestra versiones, rutas de datos, ventanas, último guardado, último error, recuento de contenido y espacio libre. Si una lectura falla, se muestran los datos restantes; «No disponible» indica que la comprobación no pudo realizarse. El panel se actualiza cada 10 segundos mientras permanece abierto. No se exponen rutas ni errores técnicos en la pantalla pública.

`turnero.log` contiene una línea JSON por evento con hora ISO y local, nivel, componente, versión y sesión. Al alcanzar 5 MB rota a `.1`; conserva hasta `.5`. Un mismo mensaje repetido durante 30 segundos se resume en el siguiente evento distinto. Si el registro falla, la aplicación continúa y escribe a la consola cuando puede. Los errores de archivo y medios se truncan; no copie datos sensibles en nombres de medios o mensajes de configuración.

| Condición | Operador y continuidad | Registro y recuperación |
| --- | --- | --- |
| `estado.json` ausente o de otro día | Inicia jornada vacía; puede operar. | Día anterior se registra. No se requiere reintento; el siguiente cambio guarda el archivo. |
| Estado corrupto | Inicia vacío con aviso de recuperación; puede operar tras revisar los turnos. | Copia `estado.json.corrupto-*` si es posible. Se recupera al confirmar o restaurar datos válidos con la app cerrada. |
| Estado ilegible por permisos | El arranque se detiene con error. | Revisar permiso/ruta y reabrir; no se trata como jornada vacía. |
| No se puede crear la carpeta de datos | El arranque se detiene y muestra la ruta y el error de Windows. | Revise permisos, ruta y espacio disponible antes de reabrir. Si la carpeta nunca se creó, el error se escribe en la consola porque todavía no existe `turnero.log`. |
| Guardado de estado o configuración falla | La acción de turno no se aplica ni se anuncia; cambio de YouTube fallido tampoco se aplica. | Registra el fallo. Corrija disco/permisos y repita la acción; al guardar correctamente se retira la advertencia. |
| Configuración inválida | Se conserva la última configuración válida o valores predeterminados al arrancar. | Registra la validación; corrija `config.json` y vuelva a cargar o reinicie. |
| Ventana pública termina o TV se desconecta | La barra indica TV no disponible; las llamadas siguen en la cola de estado. | Se registra. La vista se recarga o vuelve al reconectar Windows; repita manualmente llamadas emitidas durante la ausencia de TV si procede. |
| Ventana de operador termina | Se intenta recargar; si se cierra, termina la aplicación. | Se registra. Reabrir y comprobar estado antes de seguir. |
| Audio falla o falta una voz | El operador ve el acuse del último anuncio: pendiente, terminado o fallo en la vista pública. | Se registra la voz o fallo. El acuse confirma reproducción en software, no que el HDMI o las bocinas emitieron sonido. Compruebe sonido en el equipo real. |
| YouTube o internet falla | La pantalla usa videos o banners locales; los turnos continúan. | El indicador cambia a no disponible. Al volver la conexión se intenta YouTube de nuevo; si falla un enlace, cambie a uno válido o use fuente local. |
| Espacio bajo | Se rechazan importaciones que no dejan 512 MB y guardados de estado con menos de 16 MB libres; se muestra alerta. | Se registra el rechazo. Libere espacio y repita la operación; si Windows no informa espacio, se confía en el resultado de escritura. |
| Cierre durante operación o temporal previo | Se detiene la vigilancia y temporizadores; la escritura atómica deja original válido o temporal. | Al reiniciar se usa el archivo principal; temporales y copias no se importan como estado. El inicio retira temporales `estado.json`/`config.json` con el nombre conocido y más de un minuto de antigüedad. Otros archivos quedan intactos. |

La herramienta de respaldo copia también los archivos de registro rotados cuando existen y excluye temporales. Una restauración reinicia la sesión en memoria: los turnos de un `estado.json` de hoy reaparecen sin reproducir audio antiguo; los de otro día no reaparecen. Verifique versión, lista, contenido, configuración, TV y voz después de restaurar.
