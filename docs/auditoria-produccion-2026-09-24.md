# Auditoría de preparación para producción — Comal++

> **Registro histórico / evidencia fechada.** Resultados, hashes, conteos y pendientes corresponden a la ejecución descrita, no a cualquier compilación posterior con el mismo número de versión. Consulte [documentación vigente](README.md), [revisión del 1 de octubre](actualizacion-documentacion-2026-10-01.md) y [lista de publicación](lista-publicacion.md) para cambios y aceptación actual. Se conserva el cuerpo original como evidencia.

> **Evidencia histórica:** esta auditoría describe el estado observado antes del trabajo Phase 5. Varias carencias aquí indicadas tienen cambios posteriores en el código. Use la [arquitectura vigente](arquitectura.md), la [guía operativa](operacion-recuperacion.md), las pruebas y la [lista de publicación](lista-publicacion.md) para evaluar el estado actual; no tome esta auditoría como aceptación de producción.

Fecha local: 24 de septiembre de 2026. Revisión inspeccionada: `529b5d4`, paquete `0.3.0`. Objetivo: funcionamiento local en navegador y, prioritariamente, aplicación Windows.

## Dictamen

**Todavía no está listo para declarar producción bajo ese alcance.** Hay una base funcional de escritorio con buenas pruebas del dominio y un smoke de Electron que pasa. Sin embargo, el navegador no está implementado, falta la voz del turno 40 y hay fallos operativos de persistencia, recuperación y visibilidad de errores. La instalación Windows actual tampoco queda certificada por ejecutar el código fuente con Electron.

Una prueba supervisada en COMAL puede servir para validar el equipo y la operación después de resolver los bloqueos inmediatos. No equivale a aceptar una jornada desatendida ni a certificar el modo navegador.

La ausencia de SQLite no es un defecto: para una lista pequeña con un único proceso escritor, el estado JSON atómico es suficiente. Los problemas relevantes son la recuperación y cómo se comunican sus fallos.

## Alcance y evidencia

Se revisaron los módulos de `main/`, `nucleo/`, las vistas de operador/pública, proveedor compartido, componentes, estilos, arranque, scripts de pruebas, configuración TypeScript/Vite, empaquetado, catálogo de audio y documentación operativa. Los generadores de audio son herramientas auxiliares: esta auditoría verifica el catálogo entregado y su validador, no certifica proveedores de síntesis. Los PDF/manuales históricos no se consideran evidencia del comportamiento actual.

Se ejecutaron comprobaciones con datos aislados en `test-results/`, sin modificar la lógica del producto ni la jornada real.

| Comprobación | Resultado y límite |
| --- | --- |
| Estado Git al iniciar | Limpio; ya no existen los conflictos de la revisión anterior. |
| `npm test` | **57 pruebas aprobadas**, 0 fallos. Primer intento restringido falló antes de las pruebas al consultar usuario Windows; la ejecución posterior completó correctamente. |
| `npm run build` | **Aprobado:** TypeScript y compilación de vistas/proceso principal. |
| Smoke Electron (`scripts/smoke-desktop.mjs`, tras build) | **Aprobado:** anuncios FIFO 55→66, menús a dos tamaños, eliminación sin restauración, geometría de seis pedidos y anuncios a 1080p/1440p/4K. |
| YouTube en smoke | Se creó el iframe y la tarjeta apareció sobre él. No prueba que el video avance, que se oiga, que la playlist rote o que el volumen realmente baje. |
| `npm run format:check` | **Falló: 31 archivos** con diferencias de formato. Es deuda de calidad, no prueba de fallo funcional. |
| `node tooling/audio/verify-audio.mjs` | **Falló:** falta `contenido/voz/40.wav`. El script inspecciona WAV; la aplicación prioriza MP3. |
| Decodificación real en Chromium del catálogo elegido por la app | **99 voces válidas; turno 40 sin voz.** `40.mp3` tiene 0 bytes; no hay WAV de respaldo. El aviso de voz faltante quedó en el log, sin aviso visual de error. |
| Diseño adicional con seis pedidos | 1280×720: las cajas de los textos «Pedido listo» y «Recoge tu pedido» exceden aproximadamente 1.5 px los límites de su fila. El número sigue visible y no hay desbordamiento de página. 1366×768 y 1920×1080: esa comprobación pasó con tolerancia de 1 px. |
| Fallo de escritura provocado en copia aislada | La respuesta sigue siendo `ANUNCIAR`, con turno actual 98, aunque no se genera `estado.json`. Solo hay mensaje de log. |
| Sembrado de contenido tras primer inicio sin origen | Al aparecer el origen en un segundo intento, no se copia: el inventario ya creó el destino vacío. |
| Clave desconocida `__proto__` en configuración | `validarConfig` lanza `validadores[clave] is not a function`. |
| `npm audit --json` | 0 vulnerabilidades reportadas por el registro consultado. No certifica toda la seguridad de Electron ni la aplicación. |
| Instalador, instalación limpia, actualización y recuperación eléctrica | **No ejecutados.** En `release/` se encontró un instalador 0.2.0 del 14 de septiembre, frente al paquete 0.3.0 actual. |

Evidencia adicional: resultado JSON (`../test-results/audit-1EuYVI/result.json`, evidencia local de la auditoría; no incluida en el repositorio), TV a 720p (`../test-results/audit-1EuYVI/public-1280.png`, evidencia local de la auditoría; no incluida en el repositorio), script temporal de diagnóstico (`../test-results/audit-production.mjs`, evidencia local de la auditoría; no incluida en el repositorio). `test-results/` está ignorado por Git: copiar los resultados al expediente de entrega si se requiere conservarlos. Las capturas del smoke también viven allí. La captura emulada de 720p ocupa la esquina superior izquierda de una superficie física mayor; el margen oscuro restante pertenece a la emulación.

## Hallazgos y trabajo necesario

Prioridades: **P0** bloquea el alcance solicitado o una función esencial; **P1** corregir antes de operación estable sin supervisión; **P2** mejora y mantenimiento. «Confirmado» indica comportamiento observado o dependencia inequívoca del código; «riesgo» indica un camino de fallo identificado que todavía requiere prueba integral.

### PROD-01 · P0 · No existe operación en navegador — confirmado

El proveedor lee exclusivamente `window.turnero`, que instala el preload de Electron. Sin él muestra «Esta vista solo funciona dentro de la aplicación del turnero». Vite sirve las vistas de desarrollo; no implementa el servicio local ni sincronización web. El contenido además usa `turnero://`, y el control de volumen de YouTube depende de IPC.

**Evidencia:** `vistas/comun/turnero.tsx:40,90`, `main/preload.cts`, `vite.config.ts`, `main/contenido.ts:16` y `main/adaptador-ipc.ts`.

**Falta:** adaptador web con un servicio local autoritativo, API de acciones, estado y eventos; rutas HTTP para multimedia; importación compatible con navegador; arranque y cierre documentados. Mantener un solo propietario del estado para que app y navegador no creen colas independientes. Definir si el navegador funciona con la app abierta o con un lanzador de servicio independiente. Si el alcance es solo esa PC, enlazar a loopback; no exponer una API de escritura a la LAN por defecto. Incorporar validación de origen/sesión para acciones desde páginas web y activación explícita de audio según el navegador.

**Cierre:** Chrome/Edge en localhost pueden llamar, repetir, quitar, corregir, reiniciar y administrar contenido; dos vistas comparten estado; las funciones locales pasan con internet desconectado. No basta con abrir el HTML.

### PROD-02 · P0 · El turno 40 no se anuncia con voz — confirmado

`contenido/voz/40.mp3` está vacío y `40.wav` no existe. El inventario omite el MP3 y el secuenciador solo escribe que falta la voz; el operador recibe «anunciado». El chequeo de audio debe coincidir con el archivo que la app realmente elige, incluyendo prioridad MP3/WAV. Contar cien nombres no valida cien voces.

**Evidencia:** `main/contenido.ts:159`, `vistas/publica/useAnuncios.ts:49`, `tooling/audio/verify-audio.mjs` y resultado de decodificación.

**Falta:** restaurar voz 40, validar 00–99 y aviso antes de empaquetar, comprobar decodificación y no silencio, y llevar fallos al operador. Añadir una comprobación inicial «audio listo» y un botón de prueba. Escuchar y confirmar la correspondencia entre número y frase sigue siendo necesario: decodificar no detecta una grabación del número equivocado.

**Cierre:** 100 voces seleccionadas reproducibles y correctas dentro del instalador, con bloqueo de publicación si falta una.

### PROD-03 · P1 · Se confirma la llamada aunque no se guarde — confirmado

`persistir()` captura el error y continúa. Es razonable mantener el servicio en pantalla, pero el contrato no comunica «operando sin guardar». Tras reiniciar pueden perderse llamadas mientras el operador creía que todo funcionaba. La lectura de archivos también trata cualquier error de acceso como estado vacío.

**Evidencia:** `main/store.ts:54`, `main/persistencia.ts:54`, `main/contrato.ts`; reproducción con una ruta temporal bloqueada por un directorio.

**Falta:** estado visible de persistencia, último guardado correcto, reintento controlado y recuperación. Diferenciar archivo inexistente, permisos, daño y disco lleno; conservar una última copia válida y un procedimiento de restauración. Guardar `config.json` atómicamente también: hoy la selección de YouTube escribe directamente sobre el archivo (`main/main.ts:205`).

**Cierre:** al simular fallo de disco el operador sabe que no se guardó, sigue el procedimiento acordado y recupera el estado según una política explícita; nunca recibe un éxito sin advertencia de persistencia.

### PROD-04 · P1 · «Anunciado» no confirma entrega a la TV — confirmado por arquitectura

Los eventos de anuncio se difunden sin confirmación. Se pierden si la ventana pública no existe, está recargando o aún no tiene suscriptor. El estado reaparece al reconectar, pero los anuncios no se reconstruyen. La detección de display no comprueba que la vista y el audio estén listos. Además, la cola vive en el renderizador y desaparece al cerrarlo.

**Evidencia:** `main/adaptador-ipc.ts:99`, `vistas/comun/turnero.tsx:64`, `vistas/publica/useAnuncios.ts`, `vistas/operador/OperadorPage.tsx:47`.

**Falta:** estado de salud de TV/audio, acuse de recibido/iniciado/terminado y número de anuncios pendientes. Definir qué se hace al reconectar: reanunciar con control o pedir acción al operador, evitando repetir ciegamente pedidos viejos. Incorporar recuperación acotada ante bloqueo de vista y pantalla de error recuperable para fallos React.

**Cierre:** llamar mientras la TV se desconecta o recarga no produce un éxito engañoso; el personal sabe qué llamadas debe repetir.

### PROD-05 · P1 · La cola puede acumular retrasos importantes — riesgo cuantificable

Cada tarea retiene como mínimo **6 segundos** antes de comenzar la siguiente. La cola FIFO no tiene límite ni indicador. Con 20 llamadas inmediatas, la última empieza aproximadamente 114 segundos después, aun si la voz dura solo 1–2 segundos. La vigencia de cinco minutos se calcula desde la captura, no desde que se reproduce; una acumulación grande puede anunciar un pedido ya retirado de la lista.

**Evidencia:** `nucleo/cola.ts`, `vistas/publica/useAnuncios.ts:9,66`, `main/store.ts:132`.

**Falta:** medir el ritmo real en hora pico, mostrar pendientes y definir un límite/política de congestión. Acordar cómo interactúan voz, tarjeta, caducidad y corrección; conservar FIFO sin dejar retrasos invisibles.

**Cierre:** ensayo con la carga máxima acordada, medición de latencia de primer y último anuncio, y ausencia de anuncios obsoletos.

### PROD-06 · P1 · Primer arranque y actualizaciones no reparan audio ausente — confirmado

`sembrarContenido` no hace nada si el destino existe. Si no pudo sembrar en el primer inicio, `inventariar` crea las carpetas vacías; futuros intentos creen que el contenido ya estaba instalado. Tampoco hay un mecanismo para instalar una voz nueva/corregida sobre una carpeta de datos existente sin sobrescribir material del administrador.

**Evidencia:** `main/contenido.ts:188,207`; reproducción con origen ausente en primera ejecución y presente en la segunda.

**Falta:** manifiesto/versionado del contenido esencial, marcador de instalación completada y reparación de faltantes. Separar voces obligatorias del contenido editable, respetando las eliminaciones voluntarias de videos e imágenes. Tratar creación de carpeta de datos dentro del manejo de errores de arranque (`main/main.ts:56`).

**Cierre:** primer inicio interrumpido o incompleto se repara; una actualización entrega la voz corregida en una instalación ya usada.

### PROD-07 · P1 · Multimedia puede bloquear o conservar contenido viejo — confirmado por código

La importación usa `copyFileSync` en el proceso principal: copiar un archivo grande o desde USB lento detiene temporalmente sus acciones y comunicaciones. El vigilante solo compara listas de URLs; reemplazar el contenido bajo el mismo nombre no produce cambios y el audio decodificado sigue en caché. Los errores del vigilante/inventario no tienen recuperación local; una eliminación concurrente o un error de acceso puede lanzar fuera del arranque.

**Evidencia:** `main/contenido.ts:86,210–218`, `vistas/publica/audio.ts:5–24`.

**Falta:** copias asíncronas a temporal y publicación al terminar, progreso/límite de tamaño razonable, metadatos o versión para invalidar caché, y manejo de errores de vigilancia. Comprobar y notificar rechazos de `video.play()`; hoy se silencian (`Contenido.tsx:139`).

**Cierre:** importar un video grande no demora nuevas llamadas; reemplazar una voz o imagen se refleja; desconectar el origen o borrar archivos durante la operación no tumba el proceso.

### PROD-08 · P1 si se usa YouTube · Falta degradación automática a local

La selección de YouTube tiene prioridad incondicional y su componente muestra el error, pero no devuelve el control al carrusel/video local. El volumen se ajusta ejecutando código dentro del iframe cada dos segundos; es una integración dependiente del reproductor externo que requiere pruebas adicionales. La app sí puede funcionar sin internet usando contenido local.

**Evidencia:** `vistas/publica/Contenido.tsx:35`, `YouTubeVideo.tsx`, `main/adaptador-ipc.ts:31`.

**Falta:** distinguir fuente elegida de fuente efectiva, volver a contenido local ante timeout/error sostenido, aviso en operador y política de reintento. Validar avance del video, playlist, sonido y atenuación en el enlace real de COMAL. El clima también es externo; debe considerarse opcional y evitar mostrar indefinidamente un dato viejo después de perder conexión.

**Cierre:** al desconectar internet durante YouTube, los anuncios siguen y el contenido local entra automáticamente. Si se aplaza, operar explícitamente en modo local y documentar que YouTube no está aceptado.

### PROD-09 · P2 para el defecto medido · Falta completar aceptación visual

La comprobación adicional detectó que las cajas de dos textos exceden aproximadamente 1.5 px la fila destacada a 1280×720 con seis turnos, incluso después de cargar las fuentes. Es un ajuste menor: no se observó que el número desaparezca ni que la página requiera desplazamiento. El smoke habitual comienza en 1080p para TV. En operador, el smoke comprueba un menú concreto, pero no todas las filas con seis pedidos, toda la página Multimedia ni todas las escalas de Windows. La aceptación en el equipo real sigue pendiente y sí es necesaria para producción.

**Evidencia:** `vistas/comun/styles/public.css:118–158`, `scripts/smoke-desktop.mjs`, resultado JSON de auditoría.

**Falta:** ajustar tamaños al alto efectivo disponible y establecer resoluciones/escalas admitidas. Probar 720p, 1366×768, 1080p y escala 100/125/150 % con seis filas, banners de error, Ayuda, multimedia y menús inferiores. La TV no debe requerir desplazamiento; en operador, el desplazamiento vertical puede ser válido si las acciones siguen accesibles.

**Cierre:** geometría sin desbordamientos y lectura presencial desde la distancia real. No certificar responsividad solo por una captura a 1080p.

### PROD-10 · P1 · Falta completar la operación Windows

Hay reconexión por display agregado/eliminado y recarga del renderizador si termina. No hay tratamiento explícito de cambios de resolución/escala/display principal, suspensión/reanudación o ventana bloqueada. Cerrar el operador cierra toda la app inmediatamente. No hay inicio automático configurado en el producto ni protección explícita frente a suspensión de pantalla.

**Evidencia:** `main/ventanas.ts:48,87,163`, `main/main.ts`.

**Falta:** manejar cambios de métricas y reubicar ventanas, recuperación tras suspensión/HDMI y una salida controlada durante servicio. Configurar y documentar inicio al iniciar sesión, política de energía y recuperación tras reinicio; puede ser configuración de Windows, no tiene que ser un servicio complejo. Presentar selección de pantalla/audio y acceso a diagnósticos para que el personal no edite IDs a mano.

**Cierre:** arranque desde Windows limpio, apagado/encendido de TV, cambio de escala, suspensión y reinicio pasan sin que el operador tenga que usar herramientas de desarrollo.

### PROD-11 · P1 · Configuración desconocida puede lanzar una excepción

La prueba de pertenencia usa `clave in validadores`, que incluye propiedades heredadas. `__proto__` se trata como validador y provoca una excepción. En lectura inicial hay captura general; en recarga por vigilancia esa excepción no tiene protección equivalente.

**Evidencia:** `main/config.ts:54–66,123`; reproducción directa con JSON que contiene `__proto__`.

**Falta:** comprobar exclusivamente propiedades propias y proteger la recarga completa, conservando la última configuración válida. Añadir prueba para claves heredadas y errores de acceso.

**Cierre:** cualquier clave desconocida se ignora/registra, ninguna edición inválida cierra la app.

### PROD-12 · P1 · Falta evidencia de la distribución que recibirá COMAL

El build y smoke usan el repositorio con Electron sin empaquetar. Ese modo permite una ventana pública en un solo monitor; el empaquetado la omite cuando no hay monitor secundario. Por tanto, no son equivalentes. `release/` conserva una versión 0.2.0, sin evidencia de instalación actual 0.3.0.

**Falta:** generar instalador de revisión identificada y verificarlo en usuario estándar/PC limpia sin Node; probar primera instalación, actualización, conservación de contenido/configuración, reinstalación y reversión. Guardar versión, hash y resultados del artefacto. Para distribución sostenida, definir firma del ejecutable/instalador y responsable de publicaciones. Una actualización automática no es requisito si existe un procedimiento manual probado.

**Cierre:** instalar el artefacto exacto de entrega y pasar los casos P0/P1 pertinentes con la TV y bocinas reales.

### PROD-13 · P2 · Seguridad, diagnóstico y mantenimiento incompletos

La base incluye aislamiento de contexto, sandbox, Node desactivado en renderizadores, bloqueo de ventanas nuevas, CSP y autorización del operador para mutaciones. Conviene preservar esto al añadir navegador. Falta homogeneizar validación de remitente/frame/origen en IPC: `obtener` no valida remitente y volumen acepta cualquier vista que no sea operador. No se demostró una explotación; es endurecimiento antes de ampliar interfaces.

El registro es un archivo de crecimiento indefinido, sin rotación ni pantalla de diagnóstico. No hay límite de reintentos de carga ni panel que muestre versión, última escritura, salud de TV/audio y exportación de errores. No se encontró una puerta de calidad de CI versionada en `.github/`.

**Falta:** controles coherentes por canal, permisos mínimos para contenido remoto, logs rotados, diagnóstico entendible y validación automática antes de publicar. Aplicar el formato pendiente en un cambio separado. Mantener dependencias bloqueadas y revisar avisos periódicamente; los 0 avisos de esta consulta no sustituyen estos controles.

### PROD-14 · P2 · Documentación y SQA deben corresponder al producto

README y varios `.tex` mezclan NestJS/Socket.IO/SQLite con la arquitectura local actual; el manual de audio promete catálogo completo. Esto lleva a desplegar o respaldar rutas equivocadas. También hay restos de datos SQLite y componentes/estilos históricos: identificar los que realmente se distribuyen y retirar lo obsoleto con revisión.

Se corrigieron dos expectativas del plan SQA anterior: quitar un turno no abre confirmación; más de seis caracteres se limitan en el campo mediante `maxLength`, mientras el dominio rechaza entradas largas. La prueba debe distinguir esos límites. También se actualizó la puerta de conflictos: ya están resueltos en esta revisión.

**Cierre:** un manual operativo vigente que explique instalación local, dos pantallas, JSON, audio 00–99, vigencia de cinco minutos, corrección, pendientes de audio, contingencia y respaldo; sin instrucciones de la arquitectura vieja.

## Orden recomendado para completar producción

1. **Antes de la prueba con clientes:** reparar voz 40, validar catálogo elegido por la app, corregir desbordamiento en la resolución de COMAL, generar/probar instalador actual y acordar contingencia manual. Usar contenido local si YouTube no pasa aceptación.
2. **Antes de una jornada estable sin supervisión:** persistencia visible y recuperable, estado real de TV/audio, recuperación del contenido inicial, configuración robusta, límites y visibilidad de cola, importación que no bloquee y reconexión Windows. Completar el ensayo de recuperación y carga.
3. **Para cumplir el requisito de navegador:** implementar adaptador y servicio local compartido, audio con activación y pruebas equivalentes. Puede trabajarse como entrega separada, pero hasta entonces no afirmar que el producto funciona en navegador.
4. **Para mantenerlo en producción:** release reproducible, pruebas automáticas obligatorias, manual único, diagnósticos, responsable de soporte y procedimiento de actualización/reversión.

## Evidencia mínima que aún falta reunir

| Área | Evidencia de aceptación requerida |
| --- | --- |
| Rendimiento | Medir del Enter a actualización y al inicio de voz sin cola; fijar objetivo (p. ej. menos de 1 s) y medir retraso con carga real. |
| Estabilidad | Ensayo continuo equivalente a jornada 08:30–15:00; anotar memoria/CPU al inicio y periódicamente, errores, rotaciones multimedia y respuesta. No ejecutado en esta auditoría. |
| Audio | Todas las voces correctas, volumen comprendido desde puntos de espera, sin superposición; repetir tras HDMI/suspensión. |
| Windows | Instalación limpia, upgrade/reversión, usuario estándar, sin entorno de desarrollo, escala real, cable y salida de audio reales. |
| Recuperación | Fallos de guardado/acceso, archivo dañado, contenido incompleto, cierre/reapertura y restauración de copia probados. |
| Navegador | Contrato funcional completo en Chrome/Edge local, reconexión y comportamiento offline con dos clientes. |
| Usabilidad | Personal de barra completa llamadas, repeticiones, correcciones y contingencia sin asistencia técnica. |

El siguiente paso técnico es cerrar los hallazgos con pruebas de regresión específicas y luego ejecutar el plan SQA actualizado sobre el instalador final. No se han aplicado aquí esas correcciones al producto.
