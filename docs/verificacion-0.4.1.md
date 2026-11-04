# Validación de fuentes de 0.4.1 — 4 de noviembre de 2026

Estado: candidato sin publicar, preparado en `codex/qa-production-2026-11-03` para revisión contra `main`.

La revisión renueva comentarios del código propio y prepara los metadatos de 0.4.1. Conserva avisos legales de terceros y directivas necesarias para las herramientas. Los comentarios nuevos explican reglas de captura, validación de rutas, apertura del PDF, errores esperables y recorridos informativos.

## Comprobaciones

- Formato y lint: aprobados.
- Pruebas unitarias, integración y ciclo de vida: 137 aprobadas, ninguna fallida u omitida.
- Build de producción y comprobación de tipos: aprobados.
- Auditoría de dependencias: cero hallazgos altos o críticos; 28 moderados en herramientas, pendientes de revisión.
- Validación documental: enlaces locales, comandos, rutas HTTP, estructura de capítulos y PDF existentes aprobados. Las fechas, nombres y hashes históricos permanecen intactos.
- Accesibilidad: 22 evaluaciones aprobadas en escritorio, navegador, ambos temas y pantalla pública. Los resultados incompletos requieren revisión humana.
- Centro de ayuda: 29 evaluaciones aprobadas y 76 capturas, incluyendo recorridos, foco, teclado, persistencia del avance, tamaños de pantalla y acceso al PDF en escritorio y navegador.

Las salidas locales están en `test-results/release-041/`; son archivos generados excluidos de Git. GitHub Actions vuelve a ejecutar las puertas de validación en el PR. Estos resultados de fuentes no equivalen a una aprobación de CI todavía pendiente ni certifican un instalador 0.4.1.

## Límites de entrega

No se creó etiqueta, publicación ni instalador 0.4.1. La instalación, actualización y reversión descritas en el [informe QA anterior](qa-2026-11-03.md) corresponden exclusivamente al artefacto allí identificado. Antes de distribuir 0.4.1 se debe generar y comprobar su propio instalador, firma, hash y aceptación física de PC, TV y bocinas, siguiendo la [lista de publicación](lista-publicacion.md).

El responsable eligió el preflight corto y no una jornada nueva de 390 minutos. Las verificaciones de hardware, servicios externos, accesibilidad manual y hallazgos moderados permanecen pendientes. La entrega termina con el PR abierto; no se fusiona ni publica automáticamente.
