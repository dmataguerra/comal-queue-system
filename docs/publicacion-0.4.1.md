# Comal++ 0.4.1 — candidato para revisión

Esta actualización incorpora el centro de ayuda por tareas, los recorridos informativos y el manual local preparados después de 0.4.0, junto con las correcciones de QA. El cambio de versión no publica un instalador ni crea una etiqueta.

## Cambios

- Lecturas HTTP de multimedia con manejo de errores para evitar cierres del proceso principal.
- Dependencias actualizadas, sin hallazgos altos o críticos en la auditoría registrada.
- Mayor contraste de texto y verificación automatizada de accesibilidad en ambos temas.
- Regresiones de entradas, concurrencia, instalación, ayuda, escalado y movimiento reducido integradas en validación.
- Comentarios del código propio renovados: explicaciones breves de reglas y comportamientos que requieren contexto.

## Documentación y compatibilidad

Las guías de arquitectura, operación, seguridad e instalación conservan el comportamiento de 0.4.0 y aplican a 0.4.1 salvo los cambios aquí descritos. Los nombres del PDF y las capturas que contienen `0.4.0` identifican los recursos existentes; se conservan para no romper el acceso al manual. La versión del formato de progreso de ayuda es independiente de la versión del programa y no se reinicia por esta actualización.

Los informes fechados, hashes, resultados y publicaciones anteriores son históricos. El [informe QA](qa-2026-11-03.md) corresponde al candidato 0.4.0 que allí se identifica; no certifica por sí mismo los bytes de un futuro instalador 0.4.1. Los cambios de comentarios y versión requieren sus propias comprobaciones antes de generar ese instalador.

## Antes de publicar

Seguir la [lista de publicación](lista-publicacion.md), generar y probar el instalador 0.4.1, verificar su SHA-256 y las firmas aprobadas. Permanecen pendientes la aceptación del hardware y audio físicos, servicios externos y revisión de 28 hallazgos moderados de herramientas de desarrollo. La jornada de 390 minutos se omitió por decisión del responsable; el preflight aprobado no la sustituye.

Para dos televisores con la misma cola, la aplicación abre una ventana pública en un display secundario. Un splitter HDMI de una entrada y dos salidas puede duplicar esa señal hacia ambas TV; el monitor del operador debe conservar su salida independiente y Windows debe usar escritorio extendido.
