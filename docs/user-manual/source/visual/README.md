# Fuente del manual visual

Edición del 2 de noviembre de 2026 para Comal++ 0.4.0. El contenido, las imágenes y la composición están separados para poder actualizar el manual sin reconstruirlo desde un PDF.

| Archivo                                                        | Función                                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [contenido.json](contenido.json)                               | Texto editable de las 12 páginas. Admite negrita con dos asteriscos y saltos de línea. |
| [build_manual_visual.py](build_manual_visual.py)               | Generador ReportLab con cuadrícula, colores y tipografía compartidos.                  |
| [Inventario de imágenes](../screenshots/0.4.0/inventario.json) | Archivos, dimensiones, recortes, procedencia y SHA-256.                                |
| [capture_toolbar.mjs](capture_toolbar.mjs)                     | Captura opcional de la barra de ajustes con Electron, perfil aislado y escala 2x.      |

## Generar y revisar

Se necesita Python con `reportlab`, `Pillow` y `pypdf`. Se usan las fuentes Vera incluidas en ReportLab, sin depender de fuentes instaladas en Windows. Su licencia está en `reportlab/fonts/bitstream-vera-license.txt` dentro del paquete.

Desde la raíz del repositorio:

```powershell
python docs/user-manual/source/visual/build_manual_visual.py --output test-results/manual-visual/candidato.pdf
pdftoppm -r 130 -png test-results/manual-visual/candidato.pdf test-results/manual-visual/pagina
```

El generador comprueba 12 páginas, hashes y dimensiones de las imágenes, centrado en ambos ejes, resolución efectiva mínima de 110 ppp, bloques de texto sin superposición, ausencia de glifos de reemplazo, 59 enlaces internos, dos enlaces locales y 12 marcadores. Guarda medidas y resultados en `test-results/manual-visual/maquetacion.json`.

Revisar las 12 páginas completas: legibilidad, escala, cortes, títulos y espacio entre bloques. Abrir el PDF y comprobar índice, pestañas y marcadores. Después generar el definitivo:

```powershell
python docs/user-manual/source/visual/build_manual_visual.py
python docs/source/verify_documentation.py
```

La salida es `output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf`. Es determinista: el mismo texto, imágenes, dependencias y generador producen el mismo archivo. Comparar su SHA-256 con el candidato revisado. La validación general de documentación no reemplaza esta revisión visual.

## Criterios de edición

- Una tarea principal por página y de una a tres instrucciones por bloque.
- Título, frase de orientación, imagen o diagrama y una nota breve cuando haga falta.
- Imágenes proporcionadas y centradas dentro de su espacio; nunca estirarlas para llenar un recuadro.
- Cuerpo entre 10 y 12 puntos. Reservar tamaños menores para pies, navegación y notas.
- Mismos colores, márgenes, tarjetas y pasos. El color acompaña etiquetas; no es la única forma de distinguir estados.
- Conservar la diferencia entre seis turnos visibles y seis anuncios de audio, y la vigencia de cinco minutos.
- Mantener la referencia completa en `operador.md`; el manual visual prioriza la consulta rápida.

## Capturas y procedencia

Once imágenes proceden del PDF de octubre guardado en el commit `5bc12ad`. Se extrajeron sin ampliar sus píxeles; los recortes enfocan controles o excluyen rutas locales de Diagnósticos. No se conoce la fecha o commit exactos de esas capturas.

La barra de ajustes se capturó de nuevo el 2 de noviembre: Electron, ventana de 1800 × 1200 píxeles CSS, escala 2, zoom 1 y perfil temporal en `test-results/`. El inventario registra fecha, commit y región. La captura no verifica sonido físico.

Para repetir solo esa captura, instalar las dependencias de la aplicación y compilar primero:

```powershell
npm run build
node_modules/electron/dist/electron.exe docs/user-manual/source/visual/capture_toolbar.mjs
```

El script usa un perfil propio y un puerto libre. No anuncia tickets ni modifica la configuración habitual. Actualiza `barra-ajustes.png` y su registro; después regenerar y revisar el PDF.

## Revisión del 2 de noviembre

Se revisaron las 12 páginas renderizadas a 130 ppp. Se contrastaron instrucciones y botones con la guía y el código de 0.4.0. La compilación de la aplicación y la captura aislada terminaron correctamente.

El texto extraíble pasó de 1,633 a 1,136 palabras, incluida navegación; no se cuenta el texto dentro de capturas. Los 12 encuadres están centrados y la resolución efectiva mínima es 111.4 ppp. El detalle se conserva en el informe generado de maquetación.
