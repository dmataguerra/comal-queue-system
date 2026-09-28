# Multimedia: requisitos y limitaciones (texto para el manual)

## Qué se muestra en la TV

La pantalla 2 muestra una sola fuente a la vez, en este orden de prioridad:

1. **YouTube**, si hay un enlace configurado.
2. **Videos**, si hay al menos uno cargado.
3. **Imágenes**, como carrusel, solo cuando no hay YouTube ni videos.
4. **Logotipos de bienvenida**, si no hay nada de lo anterior.

> Si agregas una imagen y no aparece en la TV, revisa si hay videos cargados o un enlace de YouTube activo. Quítalos para que se vea el carrusel.

## Videos

| Requisito | Valor |
| --- | --- |
| Formatos admitidos | **MP4** (video H.264 + audio AAC, el más compatible) o **WebM** |
| No se reproducen | MOV, AVI, MKV, WMV y MP4 con códec **H.265/HEVC** |
| Resolución recomendada | Hasta **1920 × 1080** (1080p), horizontal 16:9 |
| Tamaño recomendado | Hasta **300 MB** por video |
| Reproducción | Orden aleatorio y continuo. Si un video no se puede reproducir, se salta al siguiente |

No hay un límite de tamaño obligatorio: los archivos se copian al disco de esta misma computadora. Un video muy pesado tarda más en copiarse y ocupa más espacio.

## Imágenes

| Requisito | Valor |
| --- | --- |
| Formatos admitidos | **JPG**, **PNG** o **WebP** |
| Medida recomendada | **1920 × 1080 px** (horizontal 16:9) |
| Encuadre | La imagen llena el recuadro y **se recorta en los bordes**. Deja textos y logotipos al centro, con margen |
| Tiempo en pantalla | 8 segundos por imagen (ajustable en `segundosBanner` de `config.json`, entre 3 y 120) |

## Al agregar archivos

- **Espera a que el archivo termine de descargarse** antes de agregarlo. Un archivo que todavía se descarga está vacío y se rechaza.
- Si un archivo no cumple los requisitos, aparece un aviso con el nombre y el motivo (formato no admitido, o archivo vacío o incompleto).
- Si un archivo cargado no se puede mostrar (dañado o con un códec no compatible), su tarjeta aparece en amarillo con **"No se puede mostrar"**. Quítalo con el ícono de basura y vuelve a subirlo.
- Si agregas un archivo con el mismo nombre que otro, se conserva el anterior y se crea una copia numerada, por ejemplo `promo (2).mp4`.
- Los cambios se ven en la TV al momento, sin reiniciar la aplicación.
