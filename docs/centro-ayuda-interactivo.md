# Centro de ayuda interactivo

Estado: implementado y verificado localmente el 2 de noviembre de 2026, dentro del alcance y los límites registrados en la evaluación. Base: `ea8b306`, que incluye `main` y el manual visual terminado. Rama de trabajo: `codex/centro-ayuda-interactivo`.

## Objetivo

Ayudar al personal de caja a consultar una tarea o reconocer los controles de Comal++ sin salir de la aplicación. El mismo centro funciona en Electron y en el navegador local, en español y sin servicios externos para su contenido esencial.

La ayuda vive únicamente en el operador. La pantalla pública continúa mostrando pedidos y multimedia.

## Decisiones confirmadas

- Centro de ayuda en un modal amplio, abierto desde Ayuda o F1.
- Búsqueda sencilla por tareas, con texto, imágenes y resultados útiles sin distinguir mayúsculas o acentos.
- Recorridos informativos sobre los controles reales. No anuncian tickets, corrigen turnos, importan archivos ni cambian configuración.
- Un recorrido completo y tres recorridos individuales: llamar, corregir y multimedia.
- Inicio manual. No se lanza automáticamente al arrancar.
- Guardar localmente solo los recorridos completados, con versión y por origen. Cancelar no equivale a completar.
- Acceso al manual PDF visual vigente, disponible localmente en ambos entornos.

## Alcance de la primera versión

El centro ofrece una entrada por tareas, búsqueda, consulta del contenido y acceso a recorridos. Mantiene un enlace reconocible a Diagnósticos para preservar el flujo de soporte existente.

Cada recorrido presenta un paso a la vez con título, explicación breve y controles Anterior, Siguiente y Salir. Resalta el control correspondiente y puede navegar entre Turnos y Multimedia para explicarlos. La superposición impide operar los controles reales mientras dura el recorrido.

El recorrido completo utiliza el mismo contenido de los recorridos individuales; no se mantiene una segunda versión independiente de las explicaciones.

La operación puede continuar en segundo plano: se reciben estados y los anuncios ya aceptados siguen su curso. La ayuda no pausa la cola, la expiración ni la pantalla pública.

## Fuera del alcance

- Simulador de práctica, acciones de prueba o entrenamiento con audio real.
- Tutor que confirme que el usuario ejecutó una acción operativa.
- Lanzamiento automático, cuentas, progreso sincronizado entre equipos o almacenamiento remoto.
- Acceso desde otros equipos de la red o cambios a las restricciones del navegador y YouTube.
- Lector PDF completo dentro de React, edición del PDF o generación del manual durante el arranque.
- Chat, inteligencia artificial, analítica de uso o dependencias de internet para consultar la ayuda.

## Organización y contratos

### Contenido y búsqueda

Un catálogo tipado del frontend describe tareas, palabras de búsqueda, imágenes y recorridos. Sus identificadores deben permanecer estables para enlazar contenidos y conservar los completados.

La búsqueda es una función pura: normaliza espacios, mayúsculas y diacríticos; consulta título, resumen y términos asociados. Una búsqueda vacía muestra el catálogo y una búsqueda sin coincidencias explica cómo reformularla o volver a todas las tareas.

El catálogo no recibe el transporte de turnos ni callbacks de mutación. Su función es explicar y navegar dentro de la ayuda.

La implementación se organiza en `views/operator/help/`: `content.ts`, `HelpCenter.tsx`, `GuidedTour.tsx`, `progress.ts` y `help.css`. Los recorridos usan los identificadores `completo`, `llamar`, `corregir` y `multimedia`. Los pasos contienen identificador, página, ancla, título y descripción. No se añade una biblioteca externa para esta primera versión.

### Integración con el operador

`OperatorPage` conserva la propiedad de la página activa, el texto del ticket y las acciones de operación. El centro recibe callbacks limitados para cerrar, iniciar un recorrido, consultar Diagnósticos o abrir el PDF.

El motor de recorridos recibe identificadores de pasos, la página donde se encuentra cada control y anclas estables, por ejemplo atributos `data-help`. No se apoya en el texto traducido de un botón ni en su posición entre los hijos de un contenedor.

Al iniciar, conserva la página y el foco de origen. Al salir o completar, restaura la página y un foco adecuado, sin borrar la entrada del ticket. Abrir ayuda sobre una confirmación pendiente no debe confirmar ni cancelar implícitamente la acción operativa.

El foco automático de captura existente en `OperatorPage` debe respetar tanto el centro como el recorrido. No debe enviar el foco al ticket durante una búsqueda, al pulsar Tab o al devolver el foco a la ventana.

### Presentación del recorrido

El control real puede estar deshabilitado, como Corregir cuando no hay un llamado pendiente; todavía se puede explicar sin activarlo. Si una ancla no existe o no puede mostrarse, el recorrido debe mantener disponibles sus controles y una explicación; nunca dejar al usuario atrapado esperando indefinidamente.

La geometría se vuelve a medir tras cambiar de pantalla, desplazar, redimensionar o modificar el tamaño de la interfaz. El texto del paso permanece dentro del área visible y permite desplazamiento interno cuando no cabe. Se respeta movimiento reducido.

En anchos pequeños el globo puede solaparse parcialmente con un panel grande: la guía es informativa y no exige pulsar el control real. Debe quedar contexto visual reconocible; no se acepta que el globo cubra por completo el objetivo resaltado. Cuando exista espacio al desplazar la página, se prioriza recolocar el objetivo o el globo antes de aceptar ese solapamiento.

El teclado se mantiene dentro de la ayuda activa; Escape cierra toda la ayuda y el foco vuelve al lugar previsto. Finalizar o usar el botón Salir del recorrido restaura la página de origen y vuelve al centro de ayuda. Los controles tienen nombres accesibles y el paso actual se anuncia con su posición dentro del recorrido.

### Progreso local

El almacenamiento usa una clave propia de ayuda, separada de tema, tamaño, configuración y datos operativos. Incluye versión del esquema y un conjunto de identificadores completados.

Leer JSON inválido, datos de otra versión o un almacenamiento bloqueado no debe impedir consultar ayuda. Los fallos se resuelven con estado en memoria. Solo finalizar el último paso marca ese recorrido como completado; salir, retroceder o cerrar no modifica ese resultado.

Clave acordada: `comal.ayuda.progreso.v1`, con formato `{ version: '0.4.0-1', completados: [] }`. El estado parcial de un recorrido no se persiste.

Electron y navegador conservan progreso independiente porque tienen distinto origen. No se comunica por IPC, SSE ni archivos de turnos.

## Acceso al PDF

Contrato compartido implementado: `TurneroApi.abrirManual(): Promise<void>`, sin argumentos de ruta ni URL. Los componentes no importan Electron y consumen esta capacidad desde el mismo transporte que distingue escritorio y navegador.

El build incorpora el PDF ya versionado a `dist/manual/manual-usuario-0.4.0.pdf`. No se requiere Python ni ReportLab para compilar la aplicación. El empaquetado existente incluye `dist`; se debe comprobar que el archivo también esté presente en el artefacto empaquetado.

### Escritorio

Un canal IPC dedicado, autorizado únicamente al operador y a su frame principal, valida que no existan argumentos y abre ese único manual. No expone un abridor genérico de rutas o enlaces.

Si el archivo está dentro de `app.asar`, el lector externo de Windows no puede leer esa ruta como un archivo ordinario. El proceso principal copia el PDF fijo a `app.getPath('userData')/manual/`, con nombre derivado del hash del documento, antes de `shell.openPath`. Repara la copia si difiere y agrupa las aperturas simultáneas. La ruta de salida no la elige el renderer. Esta caché está separada de los datos operativos y no requiere red ni puerto HTTP.

No se relajan `setWindowOpenHandler`, la protección de navegación ni la CSP para esta función. Si el archivo falta o Windows rechaza la apertura, el operador recibe un mensaje recuperable.

### Navegador

El servidor local sirve `/manual/manual-usuario-0.4.0.pdf` como `application/pdf`, conservando sus verificaciones de Host y sus límites de rutas.

La implementación del transporte descarga el recurso con `fetch`, verifica el resultado y crea una descarga local con Blob y un enlace con `download`. No utiliza ventanas emergentes ni intenta navegar la vista del operador. La URL temporal se revoca después de iniciar la descarga, sin invalidarla antes de que el navegador la procese.

Una caída de la descarga se presenta como error de ayuda, no como fallo del turno. La disponibilidad de PDF en escritorio no depende de que el puerto HTTP local esté libre.

## Criterios de aceptación

1. Ayuda y F1 abren el mismo centro en escritorio y navegador; Escape cierra y restaura el foco. El acceso a Diagnósticos continúa disponible.
2. Las tareas pueden buscarse con o sin acentos, en mayúsculas y con espacios extra. El resultado vacío es comprensible y permite recuperar el catálogo.
3. Se pueden iniciar los tres recorridos individuales y el completo. Anterior, Siguiente y Salir funcionan en cada uno, incluso con Corregir deshabilitado o un objetivo ausente.
4. Los recorridos no envían acciones ni cambios al transporte. El texto escrito antes de abrirlos se conserva; al salir se recupera la página de origen.
5. No se pueden activar controles operativos con ratón o teclado atravesando la superposición. Los mensajes y actualizaciones de fondo no roban el foco de la ayuda.
6. Solo completar guarda progreso. El almacenamiento corrupto o bloqueado no rompe el centro y las preferencias de ayuda no alteran las de operación.
7. El contenido es legible en los dos temas y con tamaño 70%, 100% y 130%. En el escritorio se prueba al menos 900 × 600; en navegador también un ancho menor con contenido desplazable y controles siempre alcanzables.
8. Redimensionar, desplazar y navegar entre Turnos y Multimedia mantiene el resaltado alineado y el texto visible. Se prueba teclado y movimiento reducido.
9. El PDF final se incluye en build y empaquetado, se abre o descarga sin internet y conserva el contenido del manual vigente. No se permite abrir rutas arbitrarias ni PDF desde la pantalla pública Electron.
10. Compilación, tipos, lint, formato y regresiones pertinentes pasan. Las pruebas aisladas conservan evidencia de búsquedas, recorridos, foco, progreso, responsividad, PDF y ausencia de mutaciones.

## Reparto de trabajo

- Arquitectura: este alcance, contratos, límites y revisión de coherencia.
- Implementación: catálogo, centro, recorridos, anclas y estilos compartidos del frontend.
- Agente principal: distribución y acceso al PDF, integración, coordinación y revisión final de todas las facetas.
- Pruebas: smoke dedicado en datos aislados, escritorio/navegador, tamaños, temas, teclado y regresiones relevantes.

Los resultados ejecutados, las correcciones y las limitaciones están registrados en la evaluación. Esta verificación local no acredita aceptación del hardware físico.

## Evaluación y retroalimentación

La [rúbrica de evaluación](evaluacion-centro-ayuda.md) separa criterios, evidencia y resultado. El flujo es evaluar, registrar un hallazgo con severidad, corregir, repetir la comprobación afectada y volver a revisar las regresiones pertinentes.

El arquitecto revisa independientemente código y resultados del agente de pruebas. El agente principal revisa la integración completa y entrega el informe final. Una aserción escrita, una captura aislada o una aprobación de diseño no sustituyen una ejecución; cuando no exista evidencia, se registra como limitación.
