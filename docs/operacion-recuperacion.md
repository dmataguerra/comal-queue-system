# Operación y recuperación local

La aplicación guarda sus datos en `Documentos\Turnero Comal` en producción, o en la carpeta indicada por `TURNERO_DATOS`. Cierre la aplicación antes de manipular esa carpeta. En desarrollo, los datos están en la raíz del repositorio salvo que se defina `TURNERO_DATOS`.

## Guardado y salud

Los cambios de `config.json` realizados desde la aplicación y los cambios de `estado.json` se escriben primero en un archivo temporal en la misma carpeta, se vacían al disco y después sustituyen el archivo anterior. Un error de escritura se registra en `turnero.log`. Si falla el guardado de turnos, la ventana del operador muestra una advertencia: los cambios recientes pueden perderse tras un reinicio. La aplicación vuelve a intentar guardar con el siguiente cambio de turno; cuando lo consigue, retira la advertencia y registra la recuperación.

Si falta `estado.json`, se inicia una jornada vacía. Si pertenece a otro día, también se inicia vacía y se conserva el archivo anterior hasta el siguiente guardado. Si contiene JSON, estructura o fechas inválidas, la aplicación intenta crear una copia `estado.json.corrupto-*` y comienza vacía; revise el registro y conserve la copia para diagnóstico. Si el archivo no puede leerse por permisos u otro error de E/S, el inicio falla con un mensaje en lugar de tratarlo como ausente. Para recuperar un turno tras un reinicio inesperado, compruebe la fecha y el contenido de `estado.json` antes de continuar la operación.

## Copias y restauración

Haga copias con la aplicación cerrada. Desde el repositorio y con las dependencias instaladas, ejecute:

```powershell
npx tsx scripts/datos.ts backup "$env:USERPROFILE\Documents\Turnero Comal" "D:\Respaldos Comal"
```

La utilidad copia `config.json`, `estado.json`, `contenido/` y `turnero.log` cuando existen. Crea una carpeta nueva con fecha, hora e identificador único; el nombre final aparece solo cuando termina la copia. Compruebe que contiene los archivos esperados antes de moverla a otro disco. El registro puede contener rutas locales; protéjalo como dato de operación.

Para restaurar, cierre la aplicación y compruebe en el Administrador de tareas que `Comal++` no sigue ejecutándose. Cree primero una copia de la carpeta de datos actual. Después ejecute:

```powershell
npx tsx scripts/datos.ts restore "D:\Respaldos Comal\turnero-..." "$env:USERPROFILE\Documents\Turnero Comal" --app-cerrada
```

La opción `--app-cerrada` es una confirmación explícita de que verificó el cierre; la utilidad no puede detectar de forma fiable todas las instancias remotas o renombradas. La restauración prepara una carpeta nueva y luego la coloca en la ruta de datos. Conserva los datos anteriores en una carpeta `Turnero Comal.antes-de-restaurar-*` junto a la ruta de datos. Inicie la aplicación y compruebe en la ventana del operador la pantalla pública, el audio y los turnos. Un `estado.json` de otra fecha no reabre turnos de una jornada anterior.

## Incidencias durante la operación

| Situación | Acción |
| --- | --- |
| La TV se desconecta | Revise energía, cable y modo de pantalla extendida. La vista pública reaparece cuando Windows detecta la pantalla. |
| La vista pública o la del operador se bloquea | La aplicación intenta recargar la vista. Si no vuelve, reinicie la aplicación y revise `turnero.log`. |
| Configuración inválida | Corrija `config.json` con la aplicación cerrada. Los valores inválidos se sustituyen por los predeterminados y se registran. |
| Falta audio | Revise `contenido/voz` y el aviso; ejecute `npm run verify:audio` desde el repositorio antes de instalar. |
| YouTube o internet falla | Use videos e imágenes locales en `contenido/`. La lista de turnos y la voz local funcionan sin internet. |
| Poco espacio en disco | Libere espacio en la unidad de datos antes de importar contenido o continuar la jornada. |

La importación acepta videos de hasta 2 GB e imágenes de hasta 25 MB. Antes de copiar exige espacio libre para el archivo más una reserva de 512 MB cuando el sistema puede informar el espacio disponible. Si el sistema no ofrece esa medición, mantiene el límite de tamaño y sigue verificando el resultado de la copia. Un archivo rechazado se informa en la ventana del operador y se registra sin rutas de origen.

La aplicación requiere una segunda pantalla en modo extendido para mostrar la vista pública en producción. YouTube y el clima son servicios externos opcionales y pueden dejar de funcionar sin conexión.

## Diagnósticos, registro y política de recuperación

Abra **Ayuda** y seleccione el enlace a **Diagnósticos** al final de la lista. El panel muestra versiones, rutas de datos, ventanas, último guardado, último error, recuento de contenido y espacio libre. Si una lectura falla, se muestran los datos restantes; «No disponible» indica que la comprobación no pudo realizarse. El panel se actualiza cada 10 segundos mientras permanece abierto. No se exponen rutas ni errores técnicos en la pantalla pública.

`turnero.log` contiene una línea JSON por evento con hora ISO y local, nivel, componente, versión y sesión. Al alcanzar 5 MB rota a `.1`; conserva hasta `.5`. Un mismo mensaje repetido durante 30 segundos se resume en el siguiente evento distinto. Si el registro falla, la aplicación continúa y escribe a la consola cuando puede. Los errores de archivo y medios se truncan; no copie datos sensibles en nombres de medios o mensajes de configuración.

| Condición | Operador y continuidad | Registro y recuperación |
| --- | --- | --- |
| `estado.json` ausente o de otro día | Inicia jornada vacía; puede operar. | Día anterior se registra. No se requiere reintento; el siguiente cambio guarda el archivo. |
| Estado corrupto | Inicia vacío con aviso de recuperación; puede operar tras revisar los turnos. | Copia `estado.json.corrupto-*` si es posible. Se recupera al confirmar o restaurar datos válidos con la app cerrada. |
| Estado ilegible por permisos | El arranque se detiene con error. | Revisar permiso/ruta y reabrir; no se trata como jornada vacía. |
| Guardado de estado o configuración falla | Turnos siguen en memoria con aviso persistente; cambio de YouTube fallido no se aplica. | Registra inicio del fallo. El estado se reintenta con el siguiente cambio y registra recuperación; para configuración, corrija disco/permisos y repita la acción. |
| Configuración inválida | Se conserva la última configuración válida o valores predeterminados al arrancar. | Registra la validación; corrija `config.json` y vuelva a cargar o reinicie. |
| Ventana pública termina o TV se desconecta | La barra indica TV no disponible; las llamadas siguen en la cola de estado. | Se registra. La vista se recarga o vuelve al reconectar Windows; repita manualmente llamadas emitidas durante la ausencia de TV si procede. |
| Ventana de operador termina | Se intenta recargar; si se cierra, termina la aplicación. | Se registra. Reabrir y comprobar estado antes de seguir. |
| Audio falla o falta una voz | La tarjeta visual sigue; el indicador audio marca degradado. | Se registra la voz o fallo. Reponga archivos con la app cerrada y reinicie; compruebe sonido en el equipo real. |
| YouTube o internet falla | La pantalla usa videos o banners locales; los turnos continúan. | El indicador cambia a no disponible. Al volver la conexión se intenta YouTube de nuevo; si falla un enlace, cambie a uno válido o use fuente local. |
| Espacio bajo | Se rechazan importaciones que no dejan 512 MB y guardados de estado con menos de 16 MB libres; se muestra alerta. | Se registra el rechazo. Libere espacio y repita la operación; si Windows no informa espacio, se confía en el resultado de escritura. |
| Cierre durante operación o temporal previo | Se detiene la vigilancia y temporizadores; la escritura atómica deja original válido o temporal. | Al reiniciar se usa el archivo principal; temporales y copias no se importan como estado. El inicio retira temporales `estado.json`/`config.json` con el nombre conocido y más de un minuto de antigüedad. Otros archivos quedan intactos. |

La herramienta de respaldo copia también los archivos de registro rotados cuando existen y excluye temporales. Una restauración reinicia la sesión en memoria: los turnos de un `estado.json` de hoy reaparecen sin reproducir audio antiguo; los de otro día no reaparecen. Verifique versión, lista, contenido, configuración, TV y voz después de restaurar.
