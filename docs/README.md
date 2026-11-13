# Documentación de Comal++

Versión estable: **1.0.0**. Consulte [las notas de versión](publicacion-1.0.0.md) para cambios y compatibilidad de las guías 0.4.0. El candidato 0.4.1 quedó incorporado en esta entrega. La disponibilidad del instalador depende de CD; los informes de pruebas conservan la fecha y el artefacto al que corresponden.

## Guías vigentes

- [Reporte final de QA](../qa/management/reporte-final.md): regresión del 8 de noviembre de 2026 sobre 1.0.0, con 46 escenarios, 37 PASS, 0 FAIL y 9 BLOCKED. Se complementa con el [alcance](../qa/management/alcance-y-entregable-final.md), el [plan](../qa/management/plan.md), el [catálogo](../qa/catalogo/README.md), [TestLink local](../qa/testlink/README.md), el [resumen por caso](qa/regression-summary.json) y las [presentaciones](qa/README-presentation.md).
- [Informe QA del 3 de noviembre de 2026](qa-2026-11-03.md): pruebas del último commit de ayuda, correcciones, evidencia y límites para publicación.
- [Formularios de retroalimentación](feedback/formularios-retroalimentacion.md) para clientes y cajeros, con sus imágenes.
- [Centro de ayuda interactivo](centro-ayuda-interactivo.md) y [evaluación de la feature](evaluacion-centro-ayuda.md): tareas, recorridos informativos y acceso local al PDF.
- [Continuar el manual de usuario](user-manual/README.md): edición visual 0.4.0 del 2 de noviembre, fuente editable y generación del PDF.
- [Manual del operador](user-manual/operador.md) y [requisitos multimedia](user-manual/multimedia-requisitos.md).
- [Instalación desde USB](../README-INSTALACION-USB.md).
- [Arquitectura](current-architecture.md), [anuncios e importación](anuncios-e-importacion.md) y [escala pública](escalado-pantalla-publica.md).
- [Operación y recuperación](operacion-recuperacion.md).
- [CI/CD](CI-CD.md), [seguridad](seguridad-y-publicacion.md), [lista de publicación](lista-publicacion.md) y [jornada real](prueba-jornada-real.md).
- [Firma local](firma-local.md) y [preparación de firma pública](firma-publica-gratuita.md): no acreditan identidad emitida.
- [Requerimientos y casos de uso](casos-de-uso.md), con tabla vigente y notas originales identificadas.

## Manuales generados

- [Manual de Usuario](user-manual/Manual-de-Usuario.pdf).
- [Guía Rápida de Caja](user-manual/Guia-Rapida-Cajero.pdf).
- [Manual técnico](technical-documentation.pdf), fuentes en [technical-documentation.tex](technical-documentation.tex) y **58 capítulos** de `01-product/` a `11-reference/`.

Las fuentes técnicas están actualizadas a Electron/JSON/IPC/HTTP-SSE. NestJS/SQLite/Socket.IO solo corresponden a la versión histórica y migración.

Los PDF de usuario se generan desde `user-manual/operador.md` con ReportLab (se requiere Python con ReportLab y pypdf):

```powershell
py -3 docs/user-manual/source/build_user_manuals.py
```

El manual técnico se compila con LuaLaTeX desde `docs/`, usando la clase incluida y los paquetes de `preamble.tex` (`minted` necesita Pygments y `-shell-escape`):

```powershell
latexmk -lualatex -shell-escape -interaction=nonstopmode -halt-on-error technical-documentation.tex
```

El exportador anterior `source/build_technical_documentation.py` (ReportLab) se conserva, pero no admite las tablas y figuras del capítulo de evidencia QA y se detiene al encontrarlas.

Revisar páginas renderizadas y registrar resultados tras regenerar.

Para comprobar enlaces, fuentes, rutas HTTP, comandos y contenido PDF, ejecutar `py -3 docs/source/verify_documentation.py` (también requiere pdfplumber). El informe se guarda en `test-results/docs-validation/resultado.json`; no sustituye la revisión visual ni las pruebas de aplicación.

## Revisión del 12 de noviembre de 2026

Se contrastaron las guías vigentes, los 58 capítulos técnicos y los documentos de `qa/` con el código de la rama `qa/automated-regression-suite`. Se actualizaron las referencias de versión a 1.0.0, el número de escenarios de QA (46), los comandos `qa:*`, las pruebas de ayuda y accesibilidad de CI y la forma de compilar el PDF técnico. Los informes fechados no se modificaron.

## Informes históricos

Auditorías, planes SQA, pendientes, revisión de firmas, notas de publicación y verificación de producción describen **sus propias ejecuciones**. No son una lista actual de funciones ausentes ni certifican artefactos posteriores. Consulta [el registro de actualización](actualizacion-documentacion-2026-10-01.md).

El diseño anterior de [arquitectura](arquitectura.md) se conserva como propuesta histórica. Capturas y auxiliares TeX de septiembre no prueban validación actual; consulta [el inventario de capturas](user-manual/SCREENSHOTS_REQUIRED.md).

## Actualización del 2 de octubre de 2026

La jornada local completa terminó **PASS (390 minutos reales)** el 2 de octubre de 2026, con 124/124 anuncios completados y 422 comprobaciones de integridad correctas. Véase el [resultado de jornada del 2 de octubre](resultado-jornada-2026-10-02.md). Este resultado posterior resuelve el pendiente de resistencia local; la aceptación del hardware destino y del candidato/instalador final permanece separada.
