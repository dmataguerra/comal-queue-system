from pathlib import Path
import json

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "qa" / "Comal Queue System Quality Assurance.pptx"
ASSETS = ROOT / "docs" / "user-manual" / "source" / "screenshots" / "0.4.0"

NAVY = RGBColor(10, 22, 38)
NAVY2 = RGBColor(17, 36, 58)
TEAL = RGBColor(42, 190, 174)
ORANGE = RGBColor(245, 163, 72)
WHITE = RGBColor(245, 248, 250)
MUTED = RGBColor(166, 185, 202)
RED = RGBColor(236, 111, 102)
GREEN = RGBColor(91, 214, 151)


def add_text(slide, text, x, y, w, h, size=18, color=WHITE, bold=False,
             font="Aptos", align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.04)
    tf.margin_right = Inches(0.04)
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    return box


def add_rich_lines(slide, lines, x, y, w, h, size=16, leading=1.15):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.04)
    tf.margin_right = Inches(0.04)
    for index, (text, color, bold) in enumerate(lines):
        p = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        p.space_after = Pt(8)
        p.line_spacing = leading
        run = p.add_run()
        run.text = text
        run.font.name = "Aptos"
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return box


def rect(slide, x, y, w, h, fill, radius=False, line=None):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line or fill
    return shape


def title(slide, kicker, heading, source):
    add_text(slide, kicker.upper(), 0.65, 0.35, 11.8, 0.28, 10, TEAL, True)
    add_text(slide, heading, 0.65, 0.72, 12.0, 0.62, 27, WHITE, True)
    rect(slide, 0.65, 1.45, 1.0, 0.05, ORANGE)
    add_text(slide, source, 0.65, 7.18, 12.0, 0.25, 8, MUTED)


def pill(slide, text, x, y, w, color=GREEN):
    rect(slide, x, y, w, 0.36, color, True)
    add_text(slide, text, x, y + 0.02, w, 0.28, 11, NAVY, True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE)


def add_image(slide, filename, x, y, w, h):
    path = ASSETS / filename
    if path.exists():
        slide.shapes.add_picture(str(path), Inches(x), Inches(y), width=Inches(w), height=Inches(h))
        return True
    return False


def new_slide(prs, bg=NAVY):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    rect(slide, 0, 0, 13.333, 7.5, bg)
    return slide


def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # 1 — cover
    slide = new_slide(prs)
    rect(slide, 8.3, 0, 5.03, 7.5, NAVY2)
    add_text(slide, "COMAL", 0.72, 0.62, 3.2, 0.45, 16, TEAL, True)
    add_text(slide, "Comal Queue System\nQuality Assurance", 0.72, 1.55, 7.1, 1.55, 34, WHITE, True)
    add_text(slide, "Evidencia local de casos de uso, Selenium UI y TestLink", 0.75, 3.42, 6.7, 0.5, 17, MUTED)
    pill(slide, "QA · 04 NOV 2026", 0.75, 5.82, 1.9, ORANGE)
    add_text(slide, "Presentación basada únicamente en artefactos del repositorio.\nNo se modificó código productivo.", 0.75, 6.42, 6.6, 0.55, 11, MUTED)
    add_image(slide, "publica-anuncio.png", 8.78, 1.55, 3.85, 2.16)
    add_image(slide, "turnos.png", 8.78, 4.12, 3.85, 2.64)

    # 2 — executive summary
    slide = new_slide(prs)
    title(slide, "01 · Resumen", "Qué demuestra la evidencia", "Fuentes: qa/management/reporte-final.md · alcance-y-entregable-final.md")
    cards = [
        ("12", "casos de uso", "Inventario actualizado y trazado a implementación.", TEAL),
        ("43", "escenarios diseñados", "Catálogo estructurado; estado inicial planned.", ORANGE),
        ("3/3", "Selenium UI PASS", "COMAL-QA-001, 003 y 011.", GREEN),
        ("PASS", "integración COMAL-QA-001", "Ticket 42: operador ↔ vista pública.", GREEN),
    ]
    for i, (num, label, body, color) in enumerate(cards):
        x = 0.7 + (i % 2) * 6.15
        y = 1.9 + (i // 2) * 2.15
        rect(slide, x, y, 5.55, 1.65, NAVY2, True)
        add_text(slide, num, x + 0.25, y + 0.22, 1.35, 0.58, 28, color, True)
        add_text(slide, label, x + 1.75, y + 0.28, 3.4, 0.32, 16, WHITE, True)
        add_text(slide, body, x + 1.75, y + 0.72, 3.45, 0.5, 11, MUTED)
    add_text(slide, "Lectura correcta", 0.78, 6.35, 2.0, 0.28, 13, ORANGE, True)
    add_text(slide, "43 escenarios son diseño/cobertura prevista; no son 43 ejecuciones aprobadas.", 2.35, 6.32, 9.5, 0.35, 14, WHITE)

    # 3 — use cases
    slide = new_slide(prs)
    title(slide, "02 · Alcance funcional", "Casos de uso → escenarios → evidencia", "Fuente: qa/catalogo/casos-de-uso-actualizados.md")
    use_cases = [
        ("CU-01—03", "Operación de turnos", "captura · rellamada · corrección"),
        ("CU-04—06", "Multimedia y jornada", "anuncios · configuración · recuperación"),
        ("CU-07—10", "Gestión y ayuda", "quitar · manual · diagnósticos · tema"),
        ("CU-11—12", "Transporte y continuidad", "HTTP/SSE · respaldo/restauración"),
    ]
    for i, (code, name, desc) in enumerate(use_cases):
        x = 0.72 + (i % 2) * 6.12
        y = 1.85 + (i // 2) * 1.95
        rect(slide, x, y, 5.55, 1.45, NAVY2, True)
        add_text(slide, code, x + 0.25, y + 0.22, 1.55, 0.3, 12, TEAL, True)
        add_text(slide, name, x + 1.85, y + 0.2, 3.35, 0.35, 16, WHITE, True)
        add_text(slide, desc, x + 1.85, y + 0.72, 3.35, 0.34, 11, MUTED)
    rect(slide, 0.75, 6.0, 11.8, 0.62, RGBColor(28, 52, 74), True)
    add_text(slide, "Trazabilidad", 1.0, 6.15, 1.3, 0.25, 12, ORANGE, True)
    add_text(slide, "caso de uso  →  COMAL-QA-xxx  →  Selenium / otra técnica  →  resultado  →  TestLink", 2.35, 6.13, 9.5, 0.28, 13, WHITE)

    # 4 — test matrix
    slide = new_slide(prs)
    title(slide, "03 · Ejecución real", "Selenium UI: tres escenarios, tres PASS", "Fuentes: qa/automation/ui.mjs · qa/management/alcance-y-entregable-final.md")
    rows = [
        ("COMAL-QA-001", "Llamar 42 y sincronizar las vistas", "PASS", "captura local"),
        ("COMAL-QA-003", "Rechazar captura inválida sin mutar el turno", "PASS", "captura local"),
        ("COMAL-QA-011", "Corregir la última captura sin anunciarla", "PASS", "captura local"),
    ]
    rect(slide, 0.78, 1.9, 11.85, 0.48, RGBColor(28, 52, 74), True)
    for x, txt in [(1.0, "CASO"), (3.0, "FLUJO"), (10.45, "RESULTADO"), (11.4, "EVIDENCIA")]:
        add_text(slide, txt, x, 2.04, 1.0, 0.2, 10, MUTED, True)
    for i, (case, flow, result, evidence) in enumerate(rows):
        y = 2.48 + i * 0.96
        rect(slide, 0.78, y, 11.85, 0.78, NAVY2, True)
        add_text(slide, case, 1.0, y + 0.23, 1.7, 0.25, 12, TEAL, True)
        add_text(slide, flow, 3.0, y + 0.17, 6.9, 0.42, 12, WHITE)
        pill(slide, result, 10.35, y + 0.2, 0.8, GREEN)
        add_text(slide, evidence, 11.35, y + 0.24, 1.0, 0.24, 9, MUTED)
    add_text(slide, "La suite crea capturas durante la ejecución; los escenarios restantes permanecen planned.", 0.9, 6.2, 11.2, 0.35, 13, ORANGE, True)

    # 5 — integration and TestLink
    slide = new_slide(prs)
    title(slide, "04 · Integración", "COMAL-QA-001 en TestLink", "Fuente: qa/management/reporte-final.md · qa/automation/integration.mjs")
    rect(slide, 0.8, 1.9, 3.25, 3.65, NAVY2, True)
    add_text(slide, "Flujo validado", 1.1, 2.2, 2.5, 0.35, 17, TEAL, True)
    add_rich_lines(slide, [
        ("1  Selenium introduce 42", WHITE, False),
        ("2  La vista pública muestra 42", WHITE, False),
        ("3  TestLink confirma el resultado", WHITE, False),
        ("4  Evidencia queda disponible localmente", WHITE, False),
    ], 1.1, 2.85, 2.55, 2.1, 13)
    add_text(slide, "Caso", 4.7, 2.05, 1.1, 0.25, 11, MUTED, True)
    add_text(slide, "COMAL-QA-001 → TestLink COMAL-50", 4.7, 2.35, 5.9, 0.35, 18, WHITE, True)
    add_text(slide, "Build", 4.7, 3.05, 1.1, 0.25, 11, MUTED, True)
    add_text(slide, "7", 4.7, 3.35, 1.0, 0.5, 27, ORANGE, True)
    add_text(slide, "Ejecución", 6.2, 3.05, 1.5, 0.25, 11, MUTED, True)
    add_text(slide, "9", 6.2, 3.35, 1.0, 0.5, 27, GREEN, True)
    pill(slide, "PASS", 4.7, 4.45, 1.15, GREEN)
    add_text(slide, "Persistencia validada al recrear contenedores sin volúmenes.", 4.7, 5.12, 6.8, 0.35, 13, WHITE)
    add_text(slide, "La infraestructura y el smoke no sustituyen la regresión completa.", 4.7, 5.68, 6.8, 0.32, 12, ORANGE)

    # 6 — evidence visuals
    slide = new_slide(prs)
    title(slide, "05 · Evidencia visual", "Capturas locales del producto", "Fuente: docs/user-manual/source/screenshots/0.4.0/inventario.json")
    add_image(slide, "captura-ticket.png", 0.8, 1.85, 3.4, 2.5)
    add_image(slide, "publica-lista.png", 4.95, 1.85, 1.7, 3.15)
    add_image(slide, "diagnosticos.png", 7.35, 1.85, 5.05, 2.7)
    add_text(slide, "Captura de ticket", 0.8, 4.55, 3.4, 0.3, 12, WHITE, True, align=PP_ALIGN.CENTER)
    add_text(slide, "Vista pública", 4.95, 5.15, 1.7, 0.3, 12, WHITE, True, align=PP_ALIGN.CENTER)
    add_text(slide, "Diagnósticos", 7.35, 4.7, 5.05, 0.3, 12, WHITE, True, align=PP_ALIGN.CENTER)
    rect(slide, 0.8, 5.75, 11.6, 0.8, RGBColor(28, 52, 74), True)
    add_text(slide, "Nota de procedencia", 1.05, 5.93, 1.7, 0.25, 11, ORANGE, True)
    add_text(slide, "Son recursos locales del manual 0.4.0; se muestran como apoyo visual y no se presentan como una ejecución nueva.", 2.8, 5.9, 9.1, 0.35, 11, WHITE)

    # 7 — limitations
    slide = new_slide(prs)
    title(slide, "06 · Límites y pendientes", "Qué no debe sobreinterpretarse", "Fuentes: qa/management/reporte-final.md · qa/testlink/README.md")
    rect(slide, 0.75, 1.85, 5.7, 4.35, NAVY2, True)
    add_text(slide, "Adjuntos de la UI", 1.05, 2.18, 3.0, 0.35, 17, RED, True)
    add_text(slide, "La interfaz devolvió error 6002 al insertar los tres adjuntos de la corrida UI.", 1.05, 2.78, 4.8, 0.8, 15, WHITE, True)
    add_text(slide, "Resultado: PASS con evidencia local; no se declaran adjuntos remotos inexistentes.", 1.05, 3.85, 4.8, 0.65, 13, MUTED)
    add_text(slide, "Las capturas locales son la fuente auditable de esa corrida.", 1.05, 5.15, 4.8, 0.45, 13, TEAL, True)
    rect(slide, 6.75, 1.85, 5.7, 4.35, NAVY2, True)
    add_text(slide, "Pendientes explícitos", 7.05, 2.18, 3.0, 0.35, 17, ORANGE, True)
    add_rich_lines(slide, [
        ("• Ejecutar la regresión de los 43 escenarios.", WHITE, False),
        ("• Validar audio, monitores, legibilidad e instalador en equipo físico.", WHITE, False),
        ("• Automatizar escenarios Selenium restantes cuando haya aislamiento definido.", WHITE, False),
        ("• Mantener separados planned, PASS y evidencia de infraestructura.", WHITE, False),
    ], 7.05, 2.8, 4.8, 2.7, 13)

    # 8 — reproducibility
    slide = new_slide(prs)
    title(slide, "07 · Reproducibilidad", "Artefactos y comandos disponibles", "Fuentes: qa/catalogo/README.md · qa/testlink/README.md")
    rect(slide, 0.8, 1.85, 5.85, 3.85, NAVY2, True)
    add_text(slide, "Fuentes de QA", 1.1, 2.15, 2.2, 0.3, 17, TEAL, True)
    add_rich_lines(slide, [
        ("qa/catalogo/casos-prueba.json", WHITE, False),
        ("qa/catalogo/matriz-trazabilidad.csv", WHITE, False),
        ("qa/automation/ui.mjs", WHITE, False),
        ("qa/automation/integration.mjs", WHITE, False),
        ("qa/management/reporte-final.md", WHITE, False),
    ], 1.1, 2.75, 4.7, 2.3, 13)
    rect(slide, 6.95, 1.85, 5.55, 3.85, NAVY2, True)
    add_text(slide, "Flujo documentado", 7.25, 2.15, 2.5, 0.3, 17, ORANGE, True)
    add_rich_lines(slide, [
        (r".\qa\testlink\setup.ps1", WHITE, False),
        (r".\qa\testlink\verify.ps1", WHITE, False),
        ("npm run qa:integration", WHITE, False),
        ("npm run qa:ui", WHITE, False),
        ("node qa\\automation\\import-catalog.mjs", WHITE, False),
    ], 7.25, 2.75, 4.7, 2.3, 13)
    add_text(slide, "Esta presentación se regenera con el script incluido junto al PPTX.", 0.95, 6.3, 11.4, 0.35, 14, WHITE, True)

    # 9 — close
    slide = new_slide(prs)
    add_text(slide, "COMAL QUEUE SYSTEM", 0.75, 0.8, 4.5, 0.32, 12, TEAL, True)
    add_text(slide, "Calidad demostrada,\nalcance delimitado.", 0.75, 1.65, 7.5, 1.3, 36, WHITE, True)
    add_text(slide, "La evidencia disponible respalda una integración QA repetible.\nLa regresión completa de 43 escenarios sigue siendo trabajo pendiente.", 0.8, 3.45, 7.4, 0.72, 17, MUTED)
    pill(slide, "Selenium 3/3 PASS", 0.8, 5.25, 2.05, GREEN)
    pill(slide, "COMAL-QA-001 PASS", 3.05, 5.25, 2.25, TEAL)
    add_image(slide, "publica-lista.png", 9.1, 1.2, 2.25, 4.15)
    add_text(slide, "Fin", 0.8, 6.7, 1.0, 0.3, 12, ORANGE, True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
