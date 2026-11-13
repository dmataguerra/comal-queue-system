# Historial de cambios

## Sin publicar — herramientas de QA y documentación

Cambios posteriores a la etiqueta `v1.0.0`. No modifican el comportamiento de la aplicación ni su versión.

- Suite de QA en `qa/`: TestLink 1.9.20 en Docker limitado a `127.0.0.1:8090`, automatización Selenium de la interfaz y adaptador XML-RPC.
- Catálogo de 46 escenarios y 12 casos de uso con matriz de trazabilidad.
- Nuevos comandos `npm run qa:integration`, `qa:ui` y `qa:regression`; dependencias de desarrollo `selenium-webdriver` y `xmlrpc`.
- Regresión final del 8 de noviembre de 2026 sobre 1.0.0: 37 PASS, 0 FAIL y 9 BLOCKED por requerir hardware físico o una persona. Ver el [reporte final](qa/management/reporte-final.md).
- Prueba adicional del servidor local para contenido (`main/servidor-web-contenido.test.ts`).
- Presentación de QA en español y capítulo de evidencia QA en la documentación técnica.
- Formularios de retroalimentación para clientes y cajeros en `docs/feedback/`.
- Documentación revisada el 12 de noviembre de 2026: referencias de versión actualizadas a 1.0.0, manuales de texto regenerados y PDF técnico compilado con LuaLaTeX.

## 1.0.0 — 2026-11-04

Primera entrega estable de Comal++ para El Comal, Facultad de Informática de la UAQ. La versión 0.4.1 fue un candidato de preparación; sus cambios se incorporan a esta entrega.

- Ayuda integrada por tareas, búsqueda, recorridos y manual PDF local.
- Mejoras de validación HTTP, contraste y dependencias, con pruebas ampliadas de seguridad y accesibilidad.
- Corrección de sincronización del smoke de escala de pantalla y diagnósticos de geometría y tipografía.
- README en español con identidad troyana, capturas reales, demostración de las dos ventanas, tecnologías y acceso a manuales.
- Metadatos de aplicación e instalador actualizados a 1.0.0, sin cambiar el formato persistente de turnos ni reiniciar el progreso de ayuda.

Consulta las [notas de 1.0.0](docs/publicacion-1.0.0.md). La distribución del instalador depende de la validación y firma del workflow CD.

## 0.4.1 — candidato previo, incorporado en 1.0.0

- Centro de ayuda por tareas, búsqueda, recorridos informativos y acceso al manual local.
- Manejo de errores al transmitir archivos por HTTP.
- Actualización de dependencias y correcciones de contraste.
- Nuevas pruebas de seguridad HTTP, concurrencia, reglas de turnos y accesibilidad.
- Validación de ayuda y PDF dentro del instalador y ampliación de CI.
- Renovación de comentarios del código y documentación de preparación de versión.

Consulte [las notas de 0.4.1](docs/publicacion-0.4.1.md) y [el informe QA fechado](docs/qa-2026-11-03.md) para conocer el alcance y las comprobaciones pendientes. Las evidencias de versiones anteriores conservan su identidad original.
