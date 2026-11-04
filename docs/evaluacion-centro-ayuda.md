# Evaluación del centro de ayuda interactivo

Rama: `codex/centro-ayuda-interactivo`. Alcance acordado: [arquitectura y criterios de aceptación](centro-ayuda-interactivo.md).

## Rúbrica

Cada dimensión se clasifica como **PASS**, **FAIL** o **LIMITACIÓN**. PASS requiere una ejecución o revisión identificable que cubra el criterio descrito. LIMITACIÓN significa que la evidencia no permite concluir; nunca equivale a PASS.

| Dimensión                  | Condición de aprobación                                                                                                | Evidencia esperada                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Contenido y búsqueda       | Tareas, búsqueda normalizada, estado vacío útil y términos coherentes con 0.4.0.                                       | Aserciones sobre resultados y revisión del catálogo.                    |
| Recorridos                 | Completo y tres individuales; Anterior/Siguiente/Salir; objetivo ausente o deshabilitado recuperable.                  | Smoke de los cuatro IDs y del fallo de ancla.                           |
| Integridad operativa       | El recorrido no despacha acciones, cambia archivos ni configuración; la entrada del ticket se conserva.                | Espías del transporte, comparación de estados y revisión de callbacks.  |
| Bloqueo de operación       | Ratón y teclado no activan controles reales bajo la guía.                                                              | Intentos de interacción con la superposición activa y cola sin cambios. |
| Navegación y foco          | Ayuda/F1, Escape, Tab, retorno al centro y conservación de página/entrada funcionan sin robo de foco.                  | Aserciones de foco y estado, con y sin cambios de ventana/página.       |
| Responsividad              | Temas azul/morado, 70/100/130%, escritorio desde 900 × 600 y navegador más estrecho; ningún control queda inaccesible. | Matriz de tamaños, geometría y capturas revisadas.                      |
| Movimiento y actualización | Redimensionar/desplazar no desalinean la guía; movimiento reducido se respeta.                                         | Aserciones de límites y pruebas de resize/scroll/preferencia.           |
| Progreso                   | Solo finalizar persiste; cancelar no marca; corrupción o bloqueo de almacenamiento no rompen ayuda.                    | Pruebas con storage válido, inválido y fallido.                         |
| PDF y distribución         | PDF vigente local en build/empaquetado; apertura fija segura en escritorio y descarga en navegador sin popup.          | Hash/tipo/respuesta, prueba de IPC y evidencia de artefacto.            |
| Regresiones e integración  | Tipos, lint, formato, build y pruebas pertinentes pasan; permisos y CSP no se amplían para abrir rutas arbitrarias.    | Comandos con resultado y revisión de límites de seguridad.              |

## Severidad de hallazgos

- **P1:** cambios a datos reales por un recorrido informativo, posibilidad de activar una acción por debajo de la guía, apertura arbitraria de archivos o bloqueo de operación sin salida. Debe resolverse antes de aceptar la feature.
- **P2:** tarea o recorrido principal que no se completa, PDF inaccesible, pérdida de entrada, foco inutilizable o controles fuera del viewport en una configuración soportada. Requiere corrección y nueva evidencia.
- **P3:** problemas de texto, espaciado o presentación que no impiden comprender ni usar la ayuda. Se corrigen cuando afectan a los criterios de legibilidad acordados.

## Bucle de evaluación

1. El agente de pruebas ejecuta escenarios en datos aislados y guarda comandos, resultado y capturas pertinentes. Registra los fallos iniciales sin sobrescribir su explicación.
2. El arquitecto compara el código y esa evidencia con la rúbrica. Cada hallazgo identifica archivo, condición de reproducción, impacto y severidad.
3. El agente responsable corrige. Se reejecuta el escenario afectado y las regresiones que el cambio pueda alterar.
4. El arquitecto revisa la corrección y marca el hallazgo como resuelto, pendiente o limitado por falta de evidencia.
5. El principal contrasta el estado final de todas las dimensiones y comunica tanto los resultados como los límites.

No se declara una suite ejecutada a partir de un archivo de prueba presente. No se certifican sonido físico, hardware de la cafetería ni un navegador real distinto del entorno efectivamente probado.

## Registro de iteraciones

| Iteración | Evaluación                                                    | Resultado       | Evidencia y siguiente paso                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0        | Diseño, decisiones del usuario y riesgos del código existente | PASS documental | Auditoría de arquitectura: React compartido, foco automático de captura, CSP, bloqueo de nuevas ventanas y PDF fuera de `dist`. Contratos documentados antes de integrar. No constituye aprobación funcional. |
| E1        | Implementación y ejecución inicial                            | LIMITACIÓN      | Todavía en curso al crear este registro. Completar con resultados reales del agente de pruebas y revisión independiente.                                                                                      |

### E1 revisión estática del PDF

**PASS de revisión de código**, sin aprobación aún de ejecución instalada: el canal valida operador, frame principal y ausencia de argumentos; la copia usa origen fijo y caché por hash fuera de asar, repara bytes divergentes y agrupa aperturas simultáneas. La descarga del navegador usa GET local, MIME PDF, Blob y revocación diferida, sin popup. La CSP y la protección de navegación permanecen intactas.

Archivos revisados: `main/manual-usuario.ts`, sus pruebas, `main/adaptador-ipc.ts`, `main/main.ts`, `main/preload.cts`, `public/browser-transport.js`, `main/servidor-web.ts`, `shared/contract.ts`, `shared/ipc-channels.ts` y `vite.config.ts`.

**LIMITACIÓN registrada en E1:** faltaba comprobar archivo y apertura desde artefacto asar, descarga Chromium, rechazo del IPC desde la pública y presentación recuperable de fallos. La evidencia posterior E3/E5 cubre distribución, extracción, descarga y rechazo desde la pública; las pruebas unitarias cubren los errores de apertura. No se identificó un hallazgo bloqueante en aquella revisión estática.

### E1 hallazgo H1 progreso con almacenamiento bloqueado

**FAIL reproducido por el arquitecto. Severidad P2.** En `vistas/operador/ayuda/progreso.ts`, completar dos recorridos consecutivos con `getItem` devolviendo `null` y `setItem` lanzando una excepción devuelve primero `["llamar"]` y luego `["corregir"]`. Se pierde el completado anterior durante la misma sesión, en contra del fallback en memoria acordado.

La comprobación ejecutó el módulo con `node --import tsx --input-type=module` y un almacenamiento simulado bloqueado. Resultado observado: `preservesFirst: false`. No acredita todavía una prueba visual de la interfaz.

Retroalimentación enviada al implementador y al agente de pruebas: conservar el conjunto acumulado en memoria cuando falla la persistencia; evaluar al menos dos recorridos distintos en la misma sesión.

### E2 corrección y reverificación H1

**PASS reproducido por el arquitecto. H1 resuelto.** `guardarCompletado` recibe ahora los completados actuales y los une al almacenamiento válido. `OperadorPage` pasa el estado acumulado desde el actualizador React.

Con el mismo almacenamiento simulado bloqueado, completar llamar y después corregir devuelve `["llamar", "corregir"]`. La evaluación directa se ejecutó y terminó correctamente. La comprobación visual integrada del agente de pruebas sigue siendo necesaria para validar badges y navegación.

### E2 revisión estática del frontend

**PASS de revisión de código**, pendiente de la matriz ejecutada. Se revisaron catálogo y búsqueda, progreso, centro, motor de recorridos, estilos, componente Modal e integración con OperadorPage. El contenido no recibe funciones de mutación; los callbacks de foco y los bloques `finally` respetan la ayuda activa. La guía bloquea interacciones mediante `inert`, superposición y captura de eventos; limpia los listeners al salir. Los objetivos ausentes conservan salida y navegación.

Escape cierra toda la ayuda; Finalizar y el botón de salida del recorrido vuelven al centro. La distinción está reflejada en el diseño. No se identificó otro hallazgo P1/P2 en esta revisión; queda por contrastar geometría, interacción y foco con la evidencia ejecutada, especialmente al terminar una operación asíncrona iniciada antes de abrir ayuda.

### E3 foco, cierre y validación sobre navegadores y paquete

La revisión independiente señaló como riesgo el retorno del foco cuando el nodo de origen se desmonta al navegar desde Diagnósticos. **No se confirmó un fallo de producto en la reproducción inicial.** Se reforzó la restauración con nodo original, identificador lógico, captura, Ayuda y contenedor principal como candidatos, respetando nodos ocultos o inertes. Multimedia se conserva montada durante el recorrido para retener su borrador.

El encabezado del centro se hizo sticky para mantener visible el cierre al consultar contenido o llegar al PDF. Son mejoras preventivas; no se presentan como fallos ejecutados que no se hayan observado.

**PASS ejecutado y evidencia contrastada por el arquitecto:** `test-results/help-native/run-D6ddZI/resultado.json` registra Chrome 156.0.8078.79 y Edge 156.0.4314.58 nativos en modo headless, limitados a conexiones loopback. Ambos completaron los cuatro recorridos, búsqueda con acentos, progreso, conservación del ticket, descarga del PDF con hash idéntico y ausencia de mutaciones de cola. Se verificaron también el cierre visible tras desplazar hasta el PDF, retorno de foco desde Diagnósticos y borrador de YouTube intacto después del recorrido completo.

**PASS del recurso empaquetado:** `test-results/help-native/asar.json` comprueba el PDF y las tres imágenes dentro de `release/win-unpacked/resources/app.asar`. El PDF coincide con SHA-256 `ac3fca8b514eb6d1f71ce8e1123c64623258f22e3d6f32e0582b8d01f00e96db`. El helper ejecutado desde el ASAR real extrajo bytes idénticos fuera de él: `test-results/help-packed-RNMidA/resultado.json`.

**LIMITACIONES vigentes:** el lector externo del sistema se interceptó durante las pruebas; no se probó una asociación concreta de lector PDF ni se instaló un NSIS nuevo. La matriz ampliada de responsividad del smoke, su revisión de capturas y las regresiones finales seguían en ejecución al registrar E3. Estos resultados parciales no constituyen todavía la evaluación integral final.

### E4 matriz integrada y hallazgo H3 de ancho reducido

**FAIL ejecutado en la matriz integrada:** `test-results/help-QdBXbo/resultado.json`. Escritorio completó funcionalidad y su matriz de apariencia. El navegador completó búsqueda, artículos, recorridos, ausencia de efectos operativos, progreso, bloqueo de interacción, foco desde Diagnósticos, fallo de almacenamiento y objetivo ausente. La matriz HTTP se detuvo en viewport efectivo 392 × 720 y escala 130% por desbordamiento horizontal del documento.

La tarjeta del recorrido sí estaba dentro del viewport (`left: 16`, `right: 376`, `top: 240`, `bottom: 703.94`) y no tenía desbordamiento horizontal propio. La captura `browser-390-720-azul-130-tour.png` muestra el ensanchamiento de la interfaz inferior. La causa debe distinguirse del comportamiento previo de la vista antes de atribuirla a la ayuda. El resultado de la matriz continúa siendo FAIL hasta corregir o delimitar explícitamente esa condición y repetirla.

Retroalimentación enviada al principal e implementador: contrastar la geometría sin ayuda a igual ancho y escala, corregir la causa y repetir la matriz; no eliminar la aserción de límites de la tarjeta ni declarar un PASS global con esta ejecución incompleta. H3 queda pendiente de corrección y reverificación.

### Clasificación de fallos iniciales del harness

`help-hIMYLg` y `help-Ws8CcZ` registraron fallos iniciales al comprobar foco justo después de cerrar. La inspección identificó que la restauración espera uno o dos frames y el compositor de ventanas ocultas podía demorarlos. El harness incorporó espera del foco y bombeo de frames, conservando la aserción de retorno. Esas comprobaciones pasaron en QdBXbo. No se presentan estos dos fallos de sincronización del test como defectos confirmados del producto.

La revisión visual independiente de las capturas 900 × 600 a 130%, azul y morado, confirmó texto legible, controles del recorrido alcanzables y cierre visible al llegar al PDF. Esta revisión parcial no sustituye la matriz pendiente en ancho reducido.

Se añadió un criterio visual para 390/480 px: el solapamiento parcial entre globo y panel resaltado es aceptable si conserva contexto reconocible; cubrir el 100% del objetivo no lo es. Debe contrastarse con rectángulos y capturas del estado final. En anchos muy pequeños no se promete ver simultáneamente todo un panel operativo grande y toda la explicación; sí deben permanecer visibles la explicación y sus controles, más una referencia útil al objetivo.

### E4 correcciones de responsividad y contexto visual

- **QA-RESP-01, P2, FAIL ejecutado:** el documento Multimedia se ensanchó en el recorrido completo, paso 5, a 392 × 720 efectivos y 130%, con el contenido de fábrica. El ancho mínimo implícito de la cuadrícula propagaba el ancho del contenido. La corrección inspeccionada usa columnas `minmax(0, 1fr)` y `min-width: 0` en los contenedores pertinentes de `multimedia.css`. No se elimina la comprobación de overflow del documento.
- **QA-TOUR-02, P2, FAIL visual:** el globo cubría por completo el campo real del ticket en la captura `browser-390-720-azul-130-tour.png`, paso 0. La corrección inspeccionada alinea el objetivo hacia el inicio en anchos pequeños, descuenta la barra fija y busca la posición del globo con menor intersección cuando no hay un rectángulo libre. El motor observa también cambios del área principal.

Los dos hallazgos constan en `bugs` de QdBXbo. El test expone el selector del objetivo actual mediante `data-tour-target` y compara la intersección con el control real, no solo con el marco resaltado; acepta solapamiento parcial, pero exige menos del 99.5% de ocultación. En E4 quedaron pendientes de reverificación; E5 los resolvió con ejecución completa. La revisión de la corrección de código no sustituyó el PASS ejecutado.

### E5 reverificación integrada sobre el build corregido

**PASS ejecutado y contrastado:** `test-results/help-EWrvOO/resultado.json`, 29 evaluaciones, con 28 combinaciones de apariencia en escritorio y 56 en el transporte HTTP: 84 en total. La matriz cubre siete escalas de 70% a 130%, temas azul/morado y tamaños solicitados de 1366 × 900 y 900 × 600 en escritorio; el navegador añade 480 × 720 y 390 × 720. El viewport efectivo de la última configuración fue 392 × 720 en el entorno de prueba.

La ejecución incluye los siete pasos del recorrido completo en las combinaciones estrechas a 130%, más PDF, progreso bloqueado/corrupto, objetivos ausentes, movimiento reducido, teclado, punteros, conservación de datos y retorno del foco. Los cuatro recorridos individuales/completo terminan sin cambios operativos. Se conserva evidencia de 76 capturas.

**QA-RESP-01 y QA-TOUR-02 resueltos:** no hay desbordamiento horizontal en las configuraciones comprobadas y ningún objetivo real queda oculto al 100% bajo el globo. La revisión visual independiente de `browser-390-720-azul-130-tour.png`, `browser-390-720-morado-130-multimedia-step-5.png` y `browser-390-720-azul-130-center-bottom.png` confirma el ticket visible sobre la explicación, navegación accesible, contexto parcial del panel Multimedia y cierre del centro visible junto al acceso al PDF.

La última comprobación nativa complementaria es `test-results/help-native/run-akQx4j/resultado.json`: Chrome 156.0.8078.80 y Edge 156.0.4314.58 completaron cuatro recorridos y descargaron el PDF exacto sin red externa. También se verificó que una operación iniciada antes de abrir Ayuda no roba después el foco al resolverse su promesa (`pendingOperationDoesNotStealFocus: true`).

El paquete corregido se verificó con `--dir`; el helper del ASAR real terminó PASS en `test-results/help-packed-x9T27p/resultado.json`. El lector externo permaneció interceptado. Los registros `help-unit-final.log`, `help-lint-final.log` y `help-format-final.log` confirman 128 pruebas unitarias aprobadas, lint y formato correctos.

## Estado por criterio tras E5

| Dimensión                  | Resultado        | Evidencia final                                                                                                                                   |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contenido y búsqueda       | PASS             | EWrvOO: F1, búsqueda normalizada, artículos y navegación; catálogo contrastado con 0.4.0.                                                         |
| Recorridos                 | PASS             | EWrvOO: llamar, corregir, multimedia y completo, Anterior/Siguiente/Salir y objetivo ausente.                                                     |
| Integridad operativa       | PASS             | EWrvOO: cola, configuración, entregas de audio y archivos conservados; akQx4j: `mutations: []`.                                                   |
| Bloqueo de operación       | PASS             | EWrvOO: intento nativo de ratón y teclado, foco fuera de fondo inerte y ausencia de llamadas reales.                                              |
| Navegación y foco          | PASS             | EWrvOO: ayuda/cierre/Diagnósticos; akQx4j: borrador, foco y promesa previa sin robo de foco.                                                      |
| Responsividad              | PASS             | EWrvOO: 84 combinaciones, sin overflow y sin objetivo totalmente oculto; capturas estrechas revisadas.                                            |
| Movimiento y actualización | PASS             | EWrvOO: geometría tras resize/scroll y modo de movimiento reducido.                                                                               |
| Progreso                   | PASS             | EWrvOO y reverificación directa H1: completar, cancelar, recargar, JSON corrupto y almacenamiento fallido.                                        |
| PDF y distribución         | PASS con límites | EWrvOO y Chrome/Edge: descarga/hash y rechazo desde pública; x9T27p: extracción desde ASAR real. Lector OS interceptado, NSIS nuevo no instalado. |
| Regresiones e integración  | PASS             | Build, 128 unitarias, lint, formato y cuatro regresiones desktop/browser/interface/theme con EXIT 0; cierre E6.                                   |

## Límites de aceptación

- Los recorridos son informativos. En pantallas estrechas el globo puede tapar parcialmente un panel grande; no se promete mostrar a la vez todo el panel y la explicación. El objetivo conserva contexto reconocible y los controles de la guía permanecen accesibles en las configuraciones comprobadas. A 390 px solicitados y 130%, el encabezado de fondo «Imágenes» puede envolver su última letra; es una limitación visual no bloqueante, no una presentación perfecta en ese extremo.
- El progreso pertenece a cada origen: escritorio y navegador no se sincronizan. Si el almacenamiento está bloqueado, se conserva en memoria durante esa sesión, sin prometer recuperación tras reiniciar.
- La copia y descarga del PDF están verificadas; la asociación con un lector concreto de Windows y una instalación NSIS nueva no se ejecutaron.
- No se certifican lector de pantalla real, hardware de la cafetería ni salida audible mediante estas comprobaciones de ayuda.

### E6 cierre de regresiones y veredicto

**PASS:** el agente de pruebas confirmó código de salida 0 en el smoke completo EWrvOO y en las cuatro regresiones. El arquitecto contrastó sus registros: `regression-desktop.log`, `regression-browser.log`, `regression-interface.log` y `regression-theme.log`, dentro de `test-results/help-EWrvOO/`. Las negativas deliberadas de interface se acompañan del PASS final y no son fallos pendientes.

Los tres hallazgos confirmados del ciclo quedan resueltos: H1 progreso en memoria, QA-RESP-01 desbordamiento horizontal y QA-TOUR-02 objetivo totalmente oculto. La diferencia entre fallos reales, revisiones preventivas y sincronización del harness permanece registrada.

**Veredicto del revisor de arquitectura:** las diez dimensiones de la rúbrica están aceptadas para el alcance local acordado, con los límites explícitos anteriores. No quedan hallazgos P1/P2 pendientes identificados en esta revisión. El agente principal realiza el chequeo final de integración y conserva la responsabilidad del informe y del commit.

Las limitaciones temporales se sustituyen por conclusiones respaldadas cuando se ejecuten las comprobaciones correspondientes.
