# Plan de SQA — prueba en las instalaciones de COMAL

**Fecha de prueba:** 25 de septiembre de 2026  
**Sistema:** Comal++ / turnero local, versión declarada `0.3.0`  
**Responsables:** desarrollador: ______ · operador de barra: ______ · responsable de COMAL: ______  
**Estado de este documento:** plan y registro por completar; ninguna casilla marcada implica una prueba realizada.

## 1. Objetivo y alcance real

Comprobar en la computadora, monitor de barra y TV reales que el operador puede llamar tickets, que el público ve y escucha los anuncios correctos, que la interfaz permanece legible y que el sistema se recupera de interrupciones. La implementación actual es **Electron local con dos ventanas, IPC y `estado.json`**. La TV debe ser una **pantalla extendida** de la misma PC; no se debe planear una prueba desde celulares ni una instalación servidor/SQLite. YouTube y el clima requieren internet, pero el flujo de turnos y el contenido local deben funcionar sin él.

**Criterio de salida:** todos los casos P0 aprobados en el equipo real, sin defectos críticos abiertos; los P1 fallidos tienen solución y repetición de prueba antes de operar. Registrar cualquier limitación P2 aceptada por COMAL. No interpretar que una prueba automatizada sustituye la inspección de TV, bocinas y operación humana.

## 2. Puertas previas: hoy, antes de llevar el instalador

| ID | Verificación / acción | Aceptación | Resultado / evidencia |
| --- | --- | --- | --- |
| PRE-01 · P0 | Resolver los conflictos de Git existentes en `vistas/comun/styles/public.css` y `vistas/publica/TarjetaAnuncio.tsx`; revisar los otros cambios locales. | Sin archivos `UU` ni marcadores de conflicto; se sabe qué revisión se instalará. | ____ |
| PRE-02 · P0 | Ejecutar `npm ci`, `npm test`, `npm run build` y `npm run format:check` desde la raíz. | Salida 0 de cada comando; registrar commit, versión y hora. No aplicar formato automáticamente durante la prueba. | ____ |
| PRE-03 · P0 | Ejecutar `npm run test:desktop` con internet disponible. | Pasa el smoke test; revisar capturas de `test-results/` para operador, multimedia y TV 1080p/1440p/4K. Si falla por YouTube, separar fallo de red/proveedor del resto y repetir la parte local. | ____ |
| PRE-04 · P0 | Generar `npm run desktop:build` y probar el instalador generado, no uno anterior. | Nombre y versión del instalador coinciden con `package.json`; se instala y abre. El `release/Comal++ Setup 0.2.0.exe` presente en el árbol no prueba la versión actual `0.3.0`. | ____ |
| PRE-05 · P0 | Preparar carpeta de respaldo del contenido, `config.json` y `estado.json` **con la app cerrada**; preparar también archivos de video e imagen válidos para prueba. | Copia identificada por fecha y ubicación; existe medio de restauración; suficiente espacio libre para instalación y multimedia. | ____ |
| PRE-06 · P1 | Llevar copia local del instalador, cable/adaptadores HDMI, bocinas o cable de audio, mouse/teclado, videos MP4 H.264 y al menos dos imágenes JPG/PNG. | Material disponible aunque falle el internet del local. | ____ |

> **Aislamiento:** hacer las pruebas destructivas (quitar archivos, editar configuración, simular día nuevo) en una carpeta de datos de prueba con `TURNERO_DATOS` o en una copia de los datos, nunca sobre la jornada activa. La instalación empaquetada usa por defecto `Documentos\Turnero Comal`. Guardar antes y restaurar después. No cambiar la fecha del equipo de COMAL durante la operación real.

## 3. Levantamiento al llegar (anotar valores reales)

| Dato | Valor |
| --- | --- |
| PC, Windows, usuario, RAM, espacio libre | ____ |
| Resolución y escala de Windows del monitor de barra | ____ |
| Resolución y escala de Windows de la TV; orientación y distancia de lectura | ____ |
| Conexión física y audio: HDMI, TV/bocina seleccionada, volumen | ____ |
| Versión del instalador, commit, ruta de instalación | ____ |
| Carpeta de datos, carpeta de respaldo y hora local | ____ |
| Internet disponible / modo local elegido | ____ |
| Operador y responsable que validan la prueba | ____ |

Configurar Windows en **Extender estas pantallas**, con el monitor del operador como **principal**. Confirmar que la TV no duplica el monitor de barra. Identificar el dispositivo de salida de audio que efectivamente escuchan los clientes y acordar un volumen cómodo desde la zona más alejada.

## 4. Secuencia de pruebas funcionales

Marcar **Pasa / Falla / No aplica** y anotar evidencia (foto, video corto, captura o línea de `turnero.log`) y número de incidencia. Usar tickets de prueba que nadie esté recogiendo; avisar al personal antes de emitir audio.

| ID | Prioridad | Acción | Resultado esperado | Estado / evidencia |
| --- | --- | --- | --- | --- |
| INS-01 | P0 | Instalar desde el artefacto PRE-04 y abrir con la TV ya conectada. | Ventana de operador en monitor principal y ventana pública a pantalla completa en TV; sin pantallas negras ni diálogo de error. | ____ |
| INS-02 | P0 | Cerrar y abrir la app; intentar abrir una segunda instancia. | Reabre en las pantallas correctas; la segunda instancia enfoca la primera, no crea otra cola. | ____ |
| INS-03 | P0 | Desconectar y reconectar la TV con la app abierta; encenderla después del arranque. | El operador muestra aviso de TV ausente; al detectarla, vuelve la vista pública. La captura del ticket jamás aparece en la TV. | ____ |
| QUE-01 | P0 | En estado vacío, capturar `213298` y Enter. | Operador y TV muestran **98**; se escucha aviso y voz “98”; un solo anuncio. Los dos últimos dígitos son los únicos usados. | ____ |
| QUE-02 | P0 | Capturar `0`, luego `99`, luego `00`. | Se muestran **00**, **99**, **00** según cada llamada; cero es válido y 99→00 no exige secuencia. | ____ |
| QUE-03 | P0 | Capturar seis números distintos seguidos. | El actual y hasta cinco anteriores aparecen en orden reciente; sin duplicados, filas cortadas ni scroll en TV. | ____ |
| QUE-04 | P0 | Volver a capturar el número actual; después anunciar de nuevo uno de la lista desde el menú. | El actual solo repite audio sin cambiar la lista; el número anterior vuelve arriba, sin duplicarse, y se anuncia. | ____ |
| QUE-05 | P0 | Capturar vacío, letras, caracteres mixtos y más de seis dígitos. | Mensaje claro de error; TV, cola y audio permanecen intactos. | ____ |
| QUE-06 | P0 | Llamar un número nuevo y pulsar **Corregir última captura** una vez y luego otra vez. | Restaura la lista previa una sola vez y no genera otro anuncio. Ctrl+Z en el campo solo edita texto. | ____ |
| QUE-07 | P0 | Abrir menú de un turno, **Quitar de la pantalla**, cancelar primero y confirmar después. | Cancelar no cambia nada; confirmar elimina solo ese número; deshacer ya no lo restaura. | ____ |
| QUE-08 | P1 | Llamar un turno, esperar cinco minutos; repetirlo antes de que venza. | Desaparece cinco minutos después de su **último** anuncio; repetirlo reinicia el plazo. Probar con reloj real, sin cambiar hora del sistema. | ____ |
| AUD-01 | P0 | Hacer una llamada desde la posición de barra y escuchar desde la posición de cliente. | Aviso y voz completos, audibles, número correcto, sin distorsión ni eco excesivo; la tarjeta visual acompaña el llamado. | ____ |
| AUD-02 | P0 | Lanzar dos llamados rápidamente y luego quitar el primero de la lista. | Voces en orden de llegada, sin superposición; un anuncio ya encolado termina aunque se quite su turno. | ____ |
| AUD-03 | P1 | Con video local reproduciéndose, llamar un turno. | El sonido del video baja durante el anuncio y vuelve al volumen previo al terminar; la voz no se tapa. | ____ |
| MED-01 | P1 | En Multimedia, importar MP4 H.264/WebM y dos JPG/PNG/WebP; observar TV sin reiniciar. | Importación reflejada en inventario y TV; videos en rotación; con cero videos, carrusel; con cero imágenes, logotipos. | ____ |
| MED-02 | P1 | Importar archivo vacío/no admitido, otro con nombre duplicado y un video con códec no reproducible. | Mensaje de omisión o copia numerada; el video fallido se salta y la cola de turnos sigue operando. | ____ |
| MED-03 | P1 | Eliminar un archivo de prueba desde Multimedia; confirmar que su reproducción termina o avanza. | Sale del inventario y del disco de prueba sin reiniciar; ningún archivo ajeno se elimina. | ____ |
| MED-04 | P1 | Si COMAL usará YouTube, configurar enlace real permitido y luego cortar internet. | Con internet se reproduce; al perder red la cola y los anuncios siguen funcionando. Registrar el comportamiento real del reproductor y volver a contenido local para operar sin red. | ____ |
| CFG-01 | P1 | En datos de prueba, modificar `mensajes`, `segundosBanner`, `repeticiones` y volúmenes en `config.json`. | Cambios válidos se reflejan sin reiniciar; JSON temporalmente inválido conserva configuración anterior; revisar `turnero.log`. Restaurar la configuración acordada. | ____ |
| PER-01 | P0 | Llamar un turno, cerrar y reabrir durante el mismo día. | Vuelven los turnos aún vigentes y no se vuelve a anunciar audio antiguo; deshacer no queda disponible después de reiniciar. | ____ |
| PER-02 | P1 | En copia aislada, arrancar con `estado.json` dañado y luego con fecha previa. | Arranca vacío y registra el problema, sin bloquear la apertura. | ____ |
| OFF-01 | P0 | Apagar Wi-Fi/desconectar internet y repetir QUE-01 con contenido local. | Llamada, sincronización de ventanas, voz y video/carrusel local siguen funcionando. | ____ |
| REC-01 | P0 | Cerrar inesperadamente y reiniciar la aplicación; si el personal autoriza, probar corte/reinicio de la PC fuera de atención. | Abre sin pasos técnicos y recupera turnos vigentes; no reproduce anuncios viejos. Documentar cualquier pérdida. | ____ |

**Orden recomendado en sitio:** INS → QUE → AUD → diseño → multimedia/configuración en datos de prueba → persistencia/offline/recuperación → restauración y aceptación. Evitar ensayos de cinco minutos o reinicios de Windows durante atención al público.

## 5. Diseño, respuesta visual y uso del operador

La aplicación de operador tiene tamaño mínimo **900 × 600**. Verificar al menos **900 × 650** y la resolución real del monitor, con escala de Windows **100 %, 125 % y la escala que usará COMAL**. En TV, verificar la resolución real y, si es posible, 1920 × 1080; las comprobaciones automatizadas también cubren 1440p y 4K, pero la TV física decide la aceptación.

| ID | Prioridad | Comprobación visual / accesibilidad | Aceptación | Estado / evidencia |
| --- | --- | --- | --- | --- |
| VIS-01 | P0 | TV con cola vacía, un turno y seis turnos; tarjeta de anuncio entrando y saliendo. | Números, título, pie y multimedia visibles; ningún texto cortado, desplazamiento, solapamiento o salto del marco multimedia. | ____ |
| VIS-02 | P0 | Mirar la TV desde el punto más lejano donde esperan clientes y con iluminación real. | El turno actual y llamados se distinguen rápidamente; contraste, tamaño y reflejos aceptados por personal de COMAL. | ____ |
| VIS-03 | P0 | Operador: Turnos, Multimedia, Ayuda (F1), menús de primera/última fila, avisos y modales. | Controles visibles y accionables; menús caben en pantalla; foco de teclado perceptible; Escape cierra el menú. | ____ |
| VIS-04 | P1 | Navegar con Tab/Shift+Tab y Enter sin mouse; abrir/cerrar Ayuda. | Se puede llamar y corregir con teclado; el foco vuelve a captura y no queda atrapado. | ____ |
| VIS-05 | P1 | Activar “Reducir movimiento” en Windows si está disponible; observar animación y ticker. | El contenido importante sigue legible y estable; registrar si el movimiento causa incomodidad. | ____ |
| VIS-06 | P1 | Probar imágenes/video 16:9 y una imagen con texto cercano a bordes. | No se corta texto crítico de COMAL; elegir material con margen central antes de la jornada. | ____ |

## 6. Preparación final para operar y reversión

1. Cerrar la app; respaldar `Documentos\Turnero Comal` completo (o la ruta `TURNERO_DATOS` definida), incluyendo `estado.json`, `config.json`, `contenido/` y `turnero.log`. Etiquetar copia **antes de pruebas**.
2. Ejecutar las pruebas que alteran estado y archivos con datos aislados. Si se probó sobre la carpeta real, cerrar la app, restaurar respaldo y volver a abrir. Verificar la fuente multimedia elegida, mensajes y volúmenes.
3. Confirmar que la TV está extendida, ventana pública a pantalla completa, sonido sale por el dispositivo correcto y no queda una cola de prueba visible. Hacer una llamada final acordada con el personal y retirarla.
4. Registrar versión final, hora, resultados y pendientes. Si aparece P0 fallido, no declarar listo el sistema: corregir, generar nuevo instalador y repetir al menos los casos afectados y el smoke básico.
5. Si una instalación nueva falla, cerrar la app y usar el instalador anterior **solo si ya fue verificado en este equipo**, restaurando los datos respaldados si corresponde. No mezclar ejecutable de una versión con datos modificados sin comprobar apertura y llamadas.

## 7. Registro de incidencias y aceptación

**Severidad:** P0 = impide llamar/ver/escuchar, expone la captura al público, pierde datos o bloquea arranque; P1 = falla funcional o visual importante con alternativa temporal; P2 = detalle menor. Para cada fallo: ID, pasos exactos, resultado esperado/real, versión, resolución/escala, hora, evidencia, responsable, corrección y resultado de repetición.

| ID caso | Pasa / falla / N/A | Incidencia y evidencia | Repetición tras corrección |
| --- | --- | --- | --- |
| ____ | ____ | ____ | ____ |
| ____ | ____ | ____ | ____ |
| ____ | ____ | ____ | ____ |

**Decisión:** [ ] Apto para prueba con clientes  [ ] Apto con limitaciones P2 aceptadas  [ ] No apto  
**P0 pendientes:** ____ · **P1 pendientes:** ____ · **P2 aceptados:** ____  
**Firma desarrollador / hora:** ____ · **Firma operador:** ____ · **Firma responsable COMAL:** ____

## 8. Fuentes actuales para mantener este plan

`package.json`, `main/main.ts`, `main/ventanas.ts`, `main/store.ts`, `main/config.ts`, `main/persistencia.ts`, `main/contenido.ts`, `nucleo/turnos.ts`, `vistas/operador/OperadorPage.tsx`, `vistas/operador/MultimediaPanel.tsx`, `vistas/publica/PublicaPage.tsx`, `vistas/publica/useAnuncios.ts`, `vistas/publica/Contenido.tsx` y `scripts/smoke-desktop.mjs`. El `README.md` y varios `.tex` aún mezclan información de la arquitectura anterior; ante diferencias, confirmar el comportamiento con el código y el instalador que se llevará.
