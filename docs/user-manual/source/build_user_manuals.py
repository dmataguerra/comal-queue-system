"""Regenerate current user manuals; the Markdown operator guide is canonical."""
from pathlib import Path
import sys

DOCS = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(DOCS/'source'))
from pdf_layout import build, cover, markdown

OUT = DOCS/'user-manual'

QUICK = '''
## Antes de atender
Configura Windows con pantalla extendida y la salida de audio correcta. Abre Ayuda en el encabezado o con F1; al final abre Diagnósticos. Prueba un número acordado y escucha en las bocinas.

## Llamar
En Turnos escribe de uno a seis dígitos y pulsa Enter. Solo cuentan los dos últimos: 213298 -> 98, 8 -> 08, 100 -> 00. Se guarda antes de anunciar. Un rechazo conserva el ticket para reintentar.

## Lo que ve el cliente
Hasta seis números: actual y cinco anteriores. Otro número distinto desplaza al más antiguo. Cada número vence cinco minutos después de su última llamada. La lista no registra ventas ni entregas.

## Repetir y corregir
Repite escribiendo el número o con Anunciar. Corregir última captura revierte una sola llamada sin voz. Quitar retira el número y descarta la corrección y sus anuncios pendientes. Anunciar/Quitar piden confirmación; se puede omitir por sesión.

## Audio y avisos
Hay seis lugares de audio, incluido el activo; aviso desde cinco. Si está lleno, espera y vuelve a pulsar Enter: el turno no cambió. Despliega la franja para leer los avisos. En espera/Anunciando no significa terminado; Anunciado confirma software, no sonido físico. Falló el audio/No anunciado requiere revisión y posible repetición.

## Controles
Voz y multimedia se aplican por separado; voz superior a 100% puede distorsionar y en 0% falla el anuncio. Tamaño: 70–130% en pasos de 10%. Tema Azul/Morado. Relojes con am/pm. F1 abre Ayuda y Escape la cierra. Escritorio y navegador guardan preferencias independientes.

## Multimedia y fallos
Escritorio: YouTube disponible, luego videos, imágenes y bienvenida. Navegador: solo contenido local. MP4/WebM hasta 2 GB; JPG/JPEG/PNG/WebP hasta 25 MB; reserva de 512 MB al copiar si puede medirse. Si falla guardado, la llamada no se aplicó: revisa disco/permisos y reintenta. Si falta TV/sonido, revisa conexión, modo extendido, bocinas y acuse.

## Cierre y recuperación
Cierra la app antes de respaldar/restaurar. Usa la ruta de Diagnósticos y pide apoyo al responsable. Al reiniciar solo vuelven números del día no vencidos, sin audio antiguo ni deshacer. Después de actualizar/restaurar, comprueba TV, voces y datos antes de atender.
'''

def main():
    text = (OUT/'operador.md').read_text(encoding='utf-8-sig')
    full = cover('Manual de Usuario', 'Comal++ 0.4.0 · 1 de octubre de 2026', 'Guía vigente para operar turnos listos, pantalla pública, audio y multimedia local. Las capturas de la interfaz anterior no se utilizan como instrucciones actuales.')
    full += markdown(text)
    build(OUT/'Manual-de-Usuario.pdf', 'Comal++ Manual de Usuario 0.4.0', full)
    # Quick consultation starts on the first page, without a separate cover.
    quick = markdown('# Guía rápida\n\n## Comal++ 0.4.0 - Consulta de caja\n\n'+QUICK)
    build(OUT/'Guia-Rapida-Cajero.pdf', 'Comal++ Guía Rápida 0.4.0', quick)
    print(OUT/'Manual-de-Usuario.pdf')
    print(OUT/'Guia-Rapida-Cajero.pdf')

if __name__=='__main__':
    main()
