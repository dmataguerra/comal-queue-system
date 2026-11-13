# Manual de usuario de Comal++

> **Estado al 12 de noviembre de 2026.** La aplicación vigente es **1.0.0**. La guía del operador, el manual de texto y la guía rápida están actualizados a 1.0.0. El manual visual conserva su edición y nombre **0.4.0**: la aplicación lo incluye como `manual-usuario-0.4.0.pdf` y sus procedimientos siguen vigentes, pero no ilustra el centro de ayuda añadido después. Las secciones siguientes documentan cómo se preparó esa edición.

La edición visual se actualizó el **2 de noviembre de 2026** en `codex/manual-usuario-0.4.0`. Mantiene 12 páginas y ya cuenta con fuente editable, imágenes separadas y generación reproducible. La base de trabajo procede de `main` (`88134cb`) y de la rama anterior `docs/user-manual` (`64f6cc1`).

## Qué manual revisar

| Material                                                                            | Uso y estado                                                                                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [Manual visual de 12 páginas](../../output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf) | Edición visual vigente: instrucciones breves, capturas centradas y navegación por secciones.                   |
| [Guía del operador](operador.md)                                                    | Fuente de consulta para comprobar el comportamiento de 1.0.0. Conservar sus reglas al editar el manual visual. |
| [Manual de texto](Manual-de-Usuario.pdf)                                            | Exportación de la guía del operador 1.0.0. Es un documento distinto del manual visual.                         |
| [Guía rápida de una página](Guia-Rapida-Cajero.pdf)                                 | Consulta breve junto al equipo de caja.                                                                        |
| [Requisitos multimedia](multimedia-requisitos.md)                                   | Formatos, tamaños y recomendaciones para archivos locales.                                                     |
| [Inventario de capturas pendientes](SCREENSHOTS_REQUIRED.md)                        | Identifica las capturas antiguas y lo que hace falta conservar para una edición reproducible.                  |

## Qué se conservó de la rama anterior

- Se conservó la edición visual de octubre como referencia, disponible en el historial del commit `5bc12ad`. Su SHA-256 original es `9c44afd9ed96f6c8fb80eac0c3bf3ec20f6cdaf5aa2bc5aa3d1a7b055e1f6e13`. La salida actual contiene la nueva edición de noviembre.
- Se conservan de `main` la guía del operador 0.4.0, los requisitos multimedia, el generador vigente y las pruebas actualizadas. La rama antigua contenía instrucciones de 0.3.1 y materiales de una interfaz anterior.
- La aplicación no cambia en esta reconciliación. El trabajo continúa en la rama local `codex/manual-usuario-0.4.0`; la rama anterior se conserva como referencia.

## Estado de la edición visual

El manual visual ya tiene una estructura completa: preparación del equipo, primer llamado, repetir/corregir/quitar, pantalla pública y audio, ajustes, archivos, YouTube, rutina diaria, problemas, datos y otras formas de acceso.

La fuente editable ya está reconstruida en [source/visual](source/visual/README.md). El texto está en [contenido.json](source/visual/contenido.json), la composición en [build_manual_visual.py](source/visual/build_manual_visual.py) y las imágenes en el [inventario de 0.4.0](source/screenshots/0.4.0/inventario.json).

La nueva edición reduce el texto extraíble de 1,633 a 1,136 palabras, aproximadamente un 30%, incluidos títulos y navegación. Las capturas están centradas y ampliadas; la barra de ajustes se volvió a capturar a resolución 2x. Se unificaron títulos, tarjetas, pasos y notas. El índice, las pestañas y los marcadores del PDF permiten navegar entre secciones. Se aclararon la recomendación de 1080p y las preferencias independientes del navegador.

El script [build_user_manuals.py](source/build_user_manuals.py) sigue generando el manual de texto y la guía rápida; no actualiza la edición visual.

Las ocho imágenes de `source/screenshots/captura-1.png` a `captura-8.png` pertenecen a una interfaz anterior. No deben sustituir las capturas de la edición visual ni presentarse como imágenes actuales de 0.4.0.

## Cómo continuar

1. Editar las instrucciones en `source/visual/contenido.json`; mantenerlas breves y contrastarlas con `operador.md` y la aplicación.
2. Cambiar imágenes si cambia la interfaz o mejora su legibilidad; actualizar procedencia, dimensiones y hashes en el inventario. Los recursos recuperados conservan la limitación de no conocer su fecha y commit exactos de captura.
3. Generar primero un candidato con `--output`, renderizar y revisar las 12 páginas completas y probar índice y pestañas.
4. Exportar al nombre definitivo y comprobar que su SHA-256 coincide con el candidato revisado. Mantener la guía rápida en una página y usar los mismos términos.

La fuente y el inventario ya están preparados. La documentación técnica, los instaladores y la publicación quedan fuera de este trabajo.

## Generar el manual visual

Desde la raíz, con Python, ReportLab, Pillow y pypdf:

```powershell
python docs/user-manual/source/visual/build_manual_visual.py
```

Actualiza únicamente el PDF visual en `output/pdf/`. El generador comprueba páginas, centrado, resolución, recursos, enlaces y solapamientos de texto. El [README de la fuente](source/visual/README.md) documenta la generación de candidatos y la revisión visual.

## Generar los documentos de texto existentes

Desde la raíz del repositorio, con Python, ReportLab y pypdf disponibles:

```powershell
python docs/user-manual/source/build_user_manuals.py
python docs/source/verify_documentation.py
```

El primer comando actualiza `Manual-de-Usuario.pdf` y `Guia-Rapida-Cajero.pdf`. El segundo comprueba documentación, enlaces y contenido de los PDF de texto; no verifica automáticamente el diseño ni la navegación del manual visual. Después de regenerar, revisar también las páginas renderizadas.
