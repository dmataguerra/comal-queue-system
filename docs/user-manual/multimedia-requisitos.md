# Multimedia: requisitos vigentes · Comal++ 0.4.0

Revisado el 1 de octubre de 2026 contra `main/contenido.ts` y la reproducción de la pantalla pública.

## Qué se muestra en la TV

La pantalla pública muestra una sola fuente a la vez. En escritorio, la prioridad es:

1. **YouTube**, si hay un enlace configurado, disponible y con control de reproducción confirmado.
2. **Videos**, si hay al menos uno cargado.
3. **Imágenes**, como carrusel, si no hay YouTube disponible ni videos reproducibles.
4. **Logotipos de bienvenida**, si no hay nada de lo anterior.

> Si agregas una imagen y no aparece en la TV, revisa si hay videos cargados o un enlace de YouTube activo. Quítalos para que se vea el carrusel.

**Navegador:** YouTube no está admitido; siempre se usa respaldo local aunque el escritorio tenga un enlace. La fuente de contenido no silencia las voces: los anuncios locales funcionan también sobre el carrusel.

## Videos

| Requisito | Valor |
| --- | --- |
| Formatos admitidos | **MP4** (video H.264 + audio AAC, el más compatible) o **WebM** |
| Fuera del contrato admitido | MOV, AVI, MKV, WMV y MP4 con **H.265/HEVC**; preparar MP4 H.264/AAC o WebM y comprobar el decodificador real |
| Resolución recomendada | Hasta **1920 × 1080** (1080p), horizontal 16:9 |
| Tamaño recomendado | Hasta **300 MB** por video |
| Reproducción | Orden aleatorio y continuo. Si un video no se puede reproducir, se salta al siguiente |

El límite obligatorio de importación es **2 GB por video** y **25 MB por imagen**. Cuando puede medirse el disco, la copia debe dejar **512 MB libres**. Un archivo muy pesado tarda más en copiarse y puede rechazarse por espacio. La extensión no garantiza un códec reproducible: comprobar en Chromium y en el equipo final.

## Imágenes

| Requisito | Valor |
| --- | --- |
| Formatos admitidos | **JPG/JPEG**, **PNG** o **WebP** |
| Medida recomendada | **1920 × 1080 px** (horizontal 16:9) |
| Encuadre | La imagen llena el recuadro y **se recorta en los bordes**. Deja textos y logotipos al centro, con margen |
| Tiempo en pantalla | 8 segundos por imagen (ajustable en `segundosBanner` de `config.json`, entre 3 y 120) |

## Al agregar archivos

- **Espera a que el archivo termine de descargarse** antes de agregarlo. Un archivo que todavía se descarga está vacío y se rechaza.
- Si un archivo no cumple los requisitos, aparece un aviso con el nombre y el motivo (formato no admitido, o archivo vacío o incompleto).
- Si un archivo cargado no se puede mostrar (dañado o con un códec no compatible), su tarjeta aparece en amarillo con **"No se puede mostrar"**. Quítalo con el ícono de basura y vuelve a subirlo.
- Si agregas un archivo con el mismo nombre que otro, se conserva el anterior y se crea una copia numerada, por ejemplo `promo (2).mp4`.
- Los cambios se ven en la TV al momento, sin reiniciar la aplicación.

## Copia y recuperación

La copia es asíncrona: la captura de turnos sigue disponible. Se verifica un temporal completo antes de publicar y los nombres concurrentes no sobrescriben el anterior. El destino debe admitir enlaces duros (habitualmente NTFS); la USB de origen no lo requiere. Los fallos muestran motivos y conservan archivos existentes. Véase [anuncios e importación](../anuncios-e-importacion.md).
