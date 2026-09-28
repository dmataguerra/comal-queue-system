from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image, Table,
                                TableStyle, PageBreak, KeepTogether)

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "user-manual"
ASSETS = ROOT / "public" / "assets"
NAVY = colors.HexColor("#073B68")
BLUE = colors.HexColor("#0568D8")
PALE = colors.HexColor("#EAF4FC")
INK = colors.HexColor("#19324A")
MUTED = colors.HexColor("#60758A")
GREEN = colors.HexColor("#137A54")
RED = colors.HexColor("#A33A3A")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=27, leading=31, textColor=NAVY, spaceAfter=8))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontName="Helvetica", fontSize=12, leading=17, textColor=MUTED))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=23, textColor=NAVY, spaceBefore=12, spaceAfter=8))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=NAVY, spaceBefore=10, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4, leading=13.3, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.8, leading=10.2, textColor=MUTED))
styles.add(ParagraphStyle(name="Step", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.3, leading=13, textColor=INK, leftIndent=5, spaceAfter=4))
styles.add(ParagraphStyle(name="Quick", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=14, textColor=INK, spaceAfter=5))

def P(text, style="Bodyx"):
    return Paragraph(text, styles[style])

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY); canvas.rect(0, h - 0.34*cm, w, 0.34*cm, stroke=0, fill=1)
    canvas.setFont("Helvetica", 7.5); canvas.setFillColor(MUTED)
    canvas.drawString(1.55*cm, 0.9*cm, "Troyanos · Manual de operación")
    canvas.drawRightString(w - 1.55*cm, 0.9*cm, f"Página {doc.page}")
    canvas.restoreState()

def cover(story, title, subtitle, quick=False):
    logo = ASSETS / "troyanos-logo.png"
    if logo.exists():
        story += [Image(str(logo), width=4.5*cm, height=2.35*cm), Spacer(1, 1.35*cm)]
    story += [P("TROYANOS · FACULTAD DE INFORMÁTICA UAQ", "Small"), Spacer(1, .3*cm), P(title, "CoverTitle"), P(subtitle, "CoverSub"), Spacer(1, .7*cm)]
    note = "Guía de consulta para el personal de caja." if quick else "Manual práctico para operar turnos listos, pantalla pública y ambiente multimedia."
    story += [Table([[P(note, "Bodyx")]], colWidths=[15.5*cm], style=[("BACKGROUND",(0,0),(-1,-1),PALE),("BOX",(0,0),(-1,-1),.7,BLUE),("LEFTPADDING",(0,0),(-1,-1),14),("RIGHTPADDING",(0,0),(-1,-1),14),("TOPPADDING",(0,0),(-1,-1),11),("BOTTOMPADDING",(0,0),(-1,-1),11)]), Spacer(1, .8*cm)]
    campus = ASSETS / "comal-image-1.jpg"
    if campus.exists() and not quick:
        story += [Image(str(campus), width=15.5*cm, height=7.1*cm)]

def label(text, tone=BLUE):
    return Table([[P(text, "Small")]], colWidths=[15.5*cm], style=[("BACKGROUND",(0,0),(-1,-1), colors.HexColor("#F4F8FB")),("LINEBEFORE",(0,0),(0,-1),3,tone),("LEFTPADDING",(0,0),(-1,-1),9),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)])

def action(title, what, when, steps, result):
    parts = [P(title, "H2x"), P(f"<b>Qué hace.</b> {what}"), P(f"<b>Cuándo usarlo.</b> {when}")]
    parts.append(P("<b>Pasos.</b> " + " → ".join(steps), "Step"))
    parts.append(P(f"<b>Resultado esperado.</b> {result}"))
    return parts

def screenshot(path, caption, max_width=15.5*cm, max_height=8.4*cm):
    """Return a consistently scaled screenshot with a readable caption."""
    w, h = ImageReader(str(path)).getSize()
    scale = min(max_width / w, max_height / h)
    return [Image(str(path), width=w*scale, height=h*scale), P(caption, "Small"), Spacer(1, .18*cm)]

SCREENSHOTS = ROOT / "docs" / "user-manual" / "source" / "screenshots"

def manual():
    story=[]; cover(story, "Manual de Usuario", "Sistema de turnos listos · Versión actual")
    story += [PageBreak(), P("1. Antes de empezar", "H1x"), P("Troyanos muestra en la pantalla pública los pedidos que ya están listos para recogerse. El personal de caja registra el número impreso en el ticket y, si corresponde, el mostrador de entrega. La pantalla se actualiza en la red local."), label("Alcance actual: el sistema no cobra, no imprime tickets, no crea ventas y no requiere iniciar sesión."), P("Roles de uso", "H2x")]
    role_data=[[P("Persona", "Small"),P("Uso habitual", "Small")],[P("Personal de caja"),P("Registra turnos listos, los vuelve a anunciar, actualiza el mostrador y confirma la entrega." )],[P("Persona que configura el equipo"),P("Desde el mismo espacio de trabajo ajusta la pantalla, anuncios y multimedia. No hay una cuenta de administrador separada." )],[P("Cliente"),P("Consulta la pantalla pública; no puede cambiar turnos." )]]
    story += [Table(role_data, colWidths=[4.1*cm,11.4*cm], style=[("BACKGROUND",(0,0),(-1,0),NAVY),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.35,colors.HexColor("#D9E2EA")),("VALIGN",(0,0),(-1,-1),"TOP"),("BACKGROUND",(0,1),(-1,-1),colors.white),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#F6FAFD")]),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6)]), Spacer(1,.25*cm), P("Conexión", "H2x"), P("Verifica que la parte superior indique <b>Conectado</b>. Si aparece <b>Sin conexión local</b>, los turnos guardados pueden seguir visibles, pero no se pueden hacer cambios hasta recuperar la conexión.")]
    story += [P("2. Operación diaria", "H1x")]
    for a in [
      ("Crear un turno listo", "Registra que un pedido ya puede recogerse.", "Cuando cocina o barra entrega un pedido a caja.", ["En <b>Turnos</b>, escribe el número de 01 a 99", "elige <b>Sin mostrador</b>, <b>Mostrador 1</b> o <b>Mostrador 2</b>", "pulsa <b>Marcar como listo</b>"], "El turno aparece al inicio de <b>Turnos listos</b>, se muestra en la pantalla pública y queda como <i>Último llamado</i>."),
      ("Elegir o cambiar el punto de recogida", "Asocia el turno con un mostrador.", "Cuando el pedido debe recogerse en un lugar concreto o cambió de punto.", ["En la creación, selecciona el mostrador antes de marcarlo listo", "para cambiarlo después, pulsa el botón de tres puntos del turno", "elige el mostrador y pulsa <b>Guardar mostrador</b>"], "La fila y la pantalla pública muestran el mostrador elegido."),
      ("Volver a anunciar", "Muestra de nuevo un turno activo en la pantalla pública.", "Cuando la persona no se ha acercado después del primer aviso.", ["En <b>Volver a anunciar</b>, elige el turno", "pulsa <b>Volver a anunciar</b>"], "El turno vuelve a quedar como el llamado más reciente y se muestra el anuncio visual."),
      ("Confirmar entrega", "Quita un turno porque el pedido ya fue recogido.", "En el momento de entregar el pedido y recibir el ticket.", ["Pulsa los tres puntos del turno", "pulsa <b>Entregado</b>"], "El turno deja de aparecer en la lista y en la pantalla pública."),
      ("Retirar una captura incorrecta", "Quita un turno que se registró por error. No modifica el cobro ni el ticket.", "Solo si el número se capturó incorrectamente o el pedido no debía anunciarse.", ["Pulsa los tres puntos del turno", "elige <b>Retirar por error de captura</b>", "confirma con <b>Sí, retirar turno</b>"], "El turno se retira de la pantalla pública.")]: story += action(*a)
    story += [P("3. Pantalla pública y último llamado", "H1x"), P("Abre <b>Pantalla pública</b> desde el menú lateral o desde el enlace al final de la lista. Esta vista es solo para consulta de clientes."), P("Qué muestra", "H2x"), P("La lista presenta hasta cinco turnos por página. El primero se destaca como <b>Último llamado</b>. Cuando hay más de cinco, la pantalla cambia de página automáticamente cada pocos segundos si la rotación está activada. Cada anuncio muestra el número grande y, si se asignó, el mostrador."), label("Importante sobre el audio: en esta versión, la pantalla pública presenta los anuncios de forma visual. La prueba de voz disponible en Configuración se reproduce solo en el equipo de caja; no activa el audio de la pantalla pública." , RED), P("4. Multimedia", "H1x")]
    for a in [
      ("Usar música local", "Selecciona una lista de música disponible en el equipo.", "Cuando se requiera ambiente sin depender de internet.", ["Abre <b>Multimedia</b>", "selecciona <b>Música local</b>", "pulsa reproducir en una lista", "usa pausar, silenciar o el control de volumen según se necesite"], "La pantalla pública reproduce la lista seleccionada. Si no hay reproducción disponible, conserva las imágenes de bienvenida."),
      ("Usar YouTube", "Envía un video o lista de YouTube a la pantalla pública.", "Solo cuando haya conexión a internet y el contenido permita reproducción integrada.", ["En <b>Multimedia</b>, deja seleccionada la pestaña <b>YouTube</b>", "pega la URL del video o lista", "pulsa <b>Reproducir</b>"], "La pantalla intenta reproducir el contenido. Si no está disponible, los turnos siguen funcionando y se muestran las imágenes de bienvenida."),
      ("Detener multimedia", "Vuelve a la imagen de bienvenida.", "Cuando se desea dejar de reproducir video o música.", ["Pulsa el botón de detener, identificado como <b>Mostrar imagen de bienvenida</b>"], "La pantalla deja de reproducir la fuente multimedia seleccionada.")]: story += action(*a)
    story += [PageBreak(), P("5. Configuración", "H1x")]
    for a in [
      ("Cambiar la duración del anuncio", "Define el tiempo mínimo que permanece visible el anuncio.", "Cuando el mensaje visual necesita más o menos tiempo de lectura.", ["Abre <b>Configuración</b>", "escribe entre 3 y 20 segundos en <b>Duración mínima del anuncio</b>", "pulsa <b>Guardar configuración</b>"], "Los siguientes anuncios visuales usan la nueva duración."),
      ("Actualizar los mensajes del pie", "Cambia los mensajes que se alternan en la parte inferior de la pantalla.", "Al iniciar una campaña, avisar un horario o cambiar un mensaje de atención.", ["Abre <b>Configuración</b>", "escribe un mensaje por línea en <b>Mensajes del pie de pantalla</b>", "pulsa <b>Guardar configuración</b>"], "La pantalla pública alterna los mensajes guardados con la fecha y la hora."),
      ("Activar o detener la rotación", "Controla el cambio automático entre páginas de turnos.", "Cuando hay más de cinco turnos y se quiere mostrar todas las páginas automáticamente.", ["Usa el interruptor <b>Rotación de turnos</b> en la barra superior"], "Con el interruptor activo, la pantalla cambia de página automáticamente; con él desactivado, se mantiene la página actual."),
      ("Probar la voz local", "Reproduce una muestra de voz en el navegador del equipo de caja.", "Al inicio de la jornada para verificar bocinas del puesto de caja.", ["Abre <b>Configuración</b>", "pulsa <b>Probar turno 99 · Mostrador 1</b>"], "Se escucha una prueba local en caja. Esta prueba no confirma el audio de la pantalla pública.")]: story += action(*a)
    story += [P("6. Flujos frecuentes", "H1x"), label("Pedido listo: escribir turno → elegir mostrador si aplica → Marcar como listo → confirmar que aparezca en la lista."), Spacer(1,.15*cm), label("Cliente no acude: elegir turno en Volver a anunciar → Volver a anunciar → confirmar el aviso visual en la pantalla."), Spacer(1,.15*cm), label("Pedido entregado: abrir acciones de la fila → Entregado → comprobar que desaparezca de la pantalla."), PageBreak(), P("7. Solución de problemas y preguntas frecuentes", "H1x")]
    faq=[["Situación","Qué hacer"],["No puedo guardar cambios","Revisa que la barra superior diga Conectado. Si no, espera a recuperar la conexión local."],["El número no se acepta","Usa solo números del 01 al 99. Un turno activo no puede repetirse."],["El turno no aparece","Busca el mensaje de confirmación. Si hay muchos turnos, revisa las otras páginas de la pantalla pública."],["El cliente ya recogió","Abre las acciones del turno y pulsa Entregado."],["La música o YouTube no se oye","Comprueba volumen y silencio. YouTube requiere internet y puede bloquear contenidos no permitidos. La pantalla pública mantiene las imágenes y turnos aunque no haya contenido."],["No se oye el anuncio en la pantalla","Es una limitación actual: el anuncio público es visual. La prueba de voz solo funciona en el equipo de caja."],["¿Puedo iniciar sesión o administrar usuarios?","No. La versión actual no incluye cuentas, contraseñas ni roles protegidos."]]
    rows=[]
    for i,row in enumerate(faq): rows.append([P(row[0],"Small" if i==0 else "Bodyx"),P(row[1],"Small" if i==0 else "Bodyx")])
    story += [Table(rows, colWidths=[4.6*cm,10.9*cm], repeatRows=1, style=[("BACKGROUND",(0,0),(-1,0),NAVY),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.35,colors.HexColor("#D9E2EA")),("VALIGN",(0,0),(-1,-1),"TOP"),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#F6FAFD")]),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5)]), Spacer(1,.3*cm), P("Consejo final", "H2x"), P("Registra solamente pedidos que ya están listos. El sistema está diseñado para informar a la sala de espera; no reemplaza el ticket ni el proceso de cobro."), PageBreak(), P("8. Referencia visual", "H1x")]
    captions = ["Panel de caja al iniciar la operación.", "Panel después de marcar un turno como listo.", "Detalle de un turno y acciones disponibles.", "Selector de turnos para volver a anunciar.", "Pantalla pública con turnos listos.", "Sección Multimedia y listas por género.", "Campo para reproducir una URL de YouTube.", "Configuración de anuncios, voz y operación local."]
    for i, caption in enumerate(captions, 1):
        story += screenshot(SCREENSHOTS / f"captura-{i}.png", f"Captura {i}. {caption}")
        if i in (2, 4, 6): story.append(PageBreak())
    SimpleDocTemplate(str(OUT/"Manual-de-Usuario.pdf"), pagesize=A4, rightMargin=1.55*cm,leftMargin=1.55*cm, topMargin=1.35*cm,bottomMargin=1.4*cm, title="Manual de Usuario Troyanos").build(story, onFirstPage=header_footer, onLaterPages=header_footer)

def quick():
    story=[]
    logo = ASSETS / "troyanos-logo.png"
    if logo.exists(): story += [Image(str(logo), width=2.8*cm, height=1.45*cm), Spacer(1,.12*cm)]
    story += [P("Guía Rápida Cajero", "H1x"), P("Turnos listos · Consulta junto a la computadora", "Small"), Spacer(1,.15*cm), P("OPERACIÓN EN MENOS DE UN MINUTO", "H2x")]
    cards=[("1", "Crear turno listo", "Escribe 01-99 → elige mostrador si aplica → <b>Marcar como listo</b>."), ("2", "Confirmar que se vea", "El turno aparece arriba en <b>Turnos listos</b> y en la pantalla pública."), ("3", "Volver a anunciar", "Elige el turno en <b>Volver a anunciar</b> → pulsa el botón con el mismo nombre."), ("4", "Entregar", "En los tres puntos del turno → <b>Entregado</b>. El turno desaparece de las pantallas."), ("5", "Corregir mostrador", "En los tres puntos → elige el mostrador → <b>Guardar mostrador</b>."), ("6", "Quitar error", "En los tres puntos → <b>Retirar por error de captura</b> → confirma. No cambia el cobro.")]
    data=[]
    for num,title,desc in cards:
        badge=Table([[P(num,"CoverTitle")]], colWidths=[1.25*cm], rowHeights=[1.35*cm], style=[("BACKGROUND",(0,0),(-1,-1),BLUE),("TEXTCOLOR",(0,0),(-1,-1),colors.white),("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE")])
        content=[P(title,"H2x"),P(desc,"Quick")]
        data.append([badge,content])
    story += [Table(data, colWidths=[1.55*cm,13.95*cm], style=[("GRID",(0,0),(-1,-1),.45,colors.HexColor("#D8E3EC")),("BACKGROUND",(0,0),(-1,-1),colors.white),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]), Spacer(1,.25*cm), label("Punto de recogida: selecciona Sin mostrador, Mostrador 1 o Mostrador 2. Usa solo el número impreso en el ticket."), Spacer(1,.12*cm), label("Último llamado: el primer turno de la lista es el más reciente. Si el cliente no llega, vuelve a anunciarlo."), Spacer(1,.12*cm), label("Si aparece Sin conexión local, no se pueden guardar cambios. Espera a que el estado vuelva a indicar Conectado.", RED), Spacer(1,.18*cm), P("<b>Recordatorio.</b> La pantalla pública muestra anuncios visuales. La prueba de voz se escucha únicamente en el equipo de caja.", "Small"), PageBreak(), P("Referencia visual", "H1x")]
    for i in range(1, 9):
        story += screenshot(SCREENSHOTS / f"captura-{i}.png", f"Captura {i}", max_height=8.4*cm)
        if i < 8: story.append(PageBreak())
    SimpleDocTemplate(str(OUT/"Guia-Rapida-Cajero.pdf"), pagesize=A4, rightMargin=1.55*cm,leftMargin=1.55*cm, topMargin=1.35*cm,bottomMargin=1.4*cm, title="Guía Rápida Cajero Troyanos").build(story, onFirstPage=header_footer, onLaterPages=header_footer)

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    manual(); quick()
