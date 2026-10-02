# Documentación de Comal++

Base vigente: **0.3.1**, revisión del **1 de octubre de 2026**. Las guías se contrastan con el código; los informes de pruebas conservan la fecha y el artefacto al que corresponden.

## Guías vigentes

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
- [Manual técnico](technical-documentation.pdf), fuentes en [technical-documentation.tex](technical-documentation.tex) y **57 capítulos** de `01-product/` a `11-reference/`.

Las fuentes técnicas están actualizadas a Electron/JSON/IPC/HTTP-SSE. NestJS/SQLite/Socket.IO solo corresponden a la versión histórica y migración.

Los PDF de usuario se generan desde `user-manual/operador.md`; el técnico desde los mismos capítulos LaTeX, mediante el generador alternativo de ReportLab. Generar el PDF no acredita compilación TeX.

```powershell
python docs/user-manual/source/build_user_manuals.py
python docs/source/build_technical_documentation.py
```

Se requiere Python con ReportLab y pypdf. Para la composición LaTeX original, desde `docs/`, usar la clase incluida y paquetes de `preamble.tex`:

```powershell
latexmk -pdf -shell-escape -interaction=nonstopmode -halt-on-error technical-documentation.tex
```

Revisar páginas renderizadas y registrar resultados tras regenerar.

Para comprobar enlaces, fuentes, rutas HTTP, comandos y contenido PDF, ejecutar `python docs/source/verify_documentation.py` (también requiere pdfplumber). El informe se guarda en `test-results/docs-validation/resultado.json`; no sustituye la revisión visual ni las pruebas de aplicación.

## Informes históricos

Auditorías, planes SQA, pendientes, revisión de firmas, notas de publicación y verificación de producción describen **sus propias ejecuciones**. No son una lista actual de funciones ausentes ni certifican artefactos posteriores. Consulta [el registro de actualización](actualizacion-documentacion-2026-10-01.md).

El diseño anterior de [arquitectura](arquitectura.md) se conserva como propuesta histórica. Capturas y auxiliares TeX de septiembre no prueban validación actual; consulta [el inventario de capturas](user-manual/SCREENSHOTS_REQUIRED.md).
