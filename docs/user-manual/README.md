# Manual de usuario de Comal++ 0.4.0

Esta carpeta reúne el contenido vigente y los materiales para continuar el manual. La base de trabajo se reconcilió el 1 de noviembre de 2026 desde `main` (`88134cb`) y la rama anterior `docs/user-manual` (`64f6cc1`).

## Qué manual revisar

| Material                                                                            | Uso y estado                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Manual visual de 12 páginas](../../output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf) | Edición de octubre recuperada de `docs/user-manual`. Incluye capturas de 0.4.0, instrucciones por tarea e índice. Es la referencia visual para continuar la edición. |
| [Guía del operador](operador.md)                                                    | Fuente de consulta para comprobar el comportamiento de 0.4.0. Conservar sus reglas al editar el manual visual.                                                       |
| [Manual de texto de 4 páginas](Manual-de-Usuario.pdf)                               | Exportación de la guía del operador incluida en `main`. Es un documento distinto del manual visual.                                                                  |
| [Guía rápida de una página](Guia-Rapida-Cajero.pdf)                                 | Consulta breve junto al equipo de caja.                                                                                                                              |
| [Requisitos multimedia](multimedia-requisitos.md)                                   | Formatos, tamaños y recomendaciones para archivos locales.                                                                                                           |
| [Inventario de capturas pendientes](SCREENSHOTS_REQUIRED.md)                        | Identifica las capturas antiguas y lo que hace falta conservar para una edición reproducible.                                                                        |

## Qué se conservó de la rama anterior

- Se recuperó el PDF visual de 12 páginas sin modificarlo. Procede del commit `e18094e`, incluido en `docs/user-manual`. Su SHA-256 es `9c44afd9ed96f6c8fb80eac0c3bf3ec20f6cdaf5aa2bc5aa3d1a7b055e1f6e13`.
- Se conservan de `main` la guía del operador 0.4.0, los requisitos multimedia, el generador vigente y las pruebas actualizadas. La rama antigua contenía instrucciones de 0.3.1 y materiales de una interfaz anterior.
- La aplicación no cambia en esta reconciliación. El trabajo continúa en la rama local `codex/manual-usuario-0.4.0`; la rama anterior se conserva como referencia.

## Dónde nos quedamos

El manual visual ya tiene una estructura completa: preparación del equipo, primer llamado, repetir/corregir/quitar, pantalla pública y audio, ajustes, archivos, YouTube, rutina diaria, problemas, datos y otras formas de acceso.

El pendiente principal es **recuperar o reconstruir su fuente editable**. En los archivos versionados revisados no aparece el generador o documento que produjo esas 12 páginas. El script [build_user_manuals.py](source/build_user_manuals.py) genera el manual de texto y la guía rápida; no reproduce la edición visual. Ejecutarlo no actualiza el PDF de `output/pdf/`.

Las ocho imágenes de `source/screenshots/captura-1.png` a `captura-8.png` pertenecen a una interfaz anterior. No deben sustituir las capturas de la edición visual ni presentarse como imágenes actuales de 0.4.0.

## Cómo continuar

1. **Usar el PDF visual como referencia de diseño.** Conservar su organización por tareas y sus ejemplos; revisar cada instrucción contra `operador.md` y la interfaz actual.
2. **Preparar una fuente editable versionada.** Si se localiza el original, incorporar también sus recursos. Si no aparece, reconstruirlo dentro de `source/visual/`, con texto y capturas separados y un comando de generación documentado. No reemplazar el PDF recuperado hasta comparar la nueva exportación.
3. **Recuperar o volver a tomar las capturas de 0.4.0.** Guardar los originales con nombres descriptivos y registrar commit, fecha, resolución, escala y transporte. Usar tickets ficticios y ocultar rutas personales. El detalle está en el inventario de capturas.
4. **Revisar contenido y navegación.** Comprobar nombres de botones, ejemplos, reglas de seis turnos y cinco minutos, estados de audio, avisos y restricciones del navegador. Aclarar en la página 7 que 1080p es una recomendación, según los requisitos multimedia. En la página 6, distinguir las preferencias compartidas entre ventanas de escritorio de las preferencias independientes del navegador.
5. **Exportar y revisar las 12 páginas.** Comprobar legibilidad, recortes, índice y enlaces internos. Mantener la guía rápida en una página y verificar que use los mismos términos.

El siguiente trabajo concreto es preparar la fuente editable del manual visual y su inventario de imágenes. La documentación técnica, los instaladores y la publicación quedan fuera de este trabajo.

## Generar los documentos de texto existentes

Desde la raíz del repositorio, con Python, ReportLab y pypdf disponibles:

```powershell
python docs/user-manual/source/build_user_manuals.py
python docs/source/verify_documentation.py
```

El primer comando actualiza `Manual-de-Usuario.pdf` y `Guia-Rapida-Cajero.pdf`. El segundo comprueba documentación, enlaces y contenido de los PDF de texto; no verifica automáticamente el diseño ni la navegación del manual visual. Después de regenerar, revisar también las páginas renderizadas.
