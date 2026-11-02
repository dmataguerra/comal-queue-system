"""Build the visual manual from editable text and recovered 0.4.0 screenshots.

Run from any directory. Requires ReportLab, Pillow and pypdf.
All geometry uses points measured from the top left of landscape A4.
"""
from __future__ import annotations

import argparse
from html import escape
import hashlib
import json
from pathlib import Path
import re

import reportlab
from PIL import Image
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ASSETS = HERE.parent / "screenshots" / "0.4.0"
DEFAULT_OUTPUT = ROOT / "output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf"
W, H = landscape(A4)
M = 38
CW = W - 2 * M
NAVY = "#0B3F66"
BLUE = "#0067D8"
INK = "#233C50"
MUTED = "#526B80"
BG = "#F7FAFD"
PALE = "#EAF3FC"
LINE = "#DAE5EF"
WHITE = "#FFFFFF"
TONES = {"neutro": MUTED, "azul": BLUE, "verde": "#19705B", "rojo": "#B23A47", "ambar": "#95610A"}


def color(value):
    return colors.HexColor(value)


def register_fonts():
    # Vera and its license ship with ReportLab; no host-specific font paths.
    fonts = Path(reportlab.__file__).parent / "fonts"
    pdfmetrics.registerFont(TTFont("Comal", str(fonts / "Vera.ttf")))
    pdfmetrics.registerFont(TTFont("Comal-Bold", str(fonts / "VeraBd.ttf")))
    pdfmetrics.registerFontFamily("Comal", normal="Comal", bold="Comal-Bold")


def markup(value):
    value = escape(value)
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    return value.replace("\n", "<br/>")


class Manual:
    def __init__(self, output, content):
        self.output = output
        self.content = content
        self.c = canvas.Canvas(str(output), pagesize=(W, H), invariant=1, pageCompression=1)
        self.c.setTitle("Comal++ | Manual de usuario | 0.4.0")
        self.c.setAuthor("Comal++")
        self.c.setSubject("Guía visual de operación. Edición del " + content["edicion"])
        self.c.setKeywords("Comal++, manual de usuario, 0.4.0, español")
        self.page = 0
        self.measures = {"textos": [], "imagenes": []}
        self.active = ""

    def box(self, x, y, w, h, fill=WHITE, stroke=None, radius=12):
        self.c.setFillColor(color(fill))
        self.c.setStrokeColor(color(stroke or fill))
        self.c.setLineWidth(0.8)
        self.c.roundRect(x, H - y - h, w, h, radius, fill=1, stroke=bool(stroke))

    def line(self, x1, y1, x2, y2, stroke=LINE, width=1):
        self.c.setStrokeColor(color(stroke))
        self.c.setLineWidth(width)
        self.c.line(x1, H - y1, x2, H - y2)

    def text(self, value, x, y, w, size=11.5, leading=None, bold=False,
             fill=INK, max_h=None, align=0):
        style = ParagraphStyle(
            "manual", fontName="Comal-Bold" if bold else "Comal",
            fontSize=size, leading=leading or size * 1.42,
            textColor=color(fill), alignment=align,
            splitLongWords=False, allowWidows=0, allowOrphans=0,
        )
        paragraph = Paragraph(markup(value), style)
        _, height = paragraph.wrap(w, H)
        if max_h is not None and height > max_h + 0.1:
            raise ValueError(f"Page {self.page}: text exceeds box ({height:.1f}>{max_h}): {value}")
        if x < 0 or y < 0 or x + w > W + 0.1 or y + height > H - 8:
            raise ValueError(f"Page {self.page}: text outside page: {value}")
        paragraph.drawOn(self.c, x, H - y - height)
        self.measures["textos"].append({
            "pagina": self.page, "texto": value, "caja": [round(v, 2) for v in (x, y, w, height)],
            "tamano_pt": size,
        })
        return height

    def arrow(self, x, y, length=24, stroke=BLUE):
        self.line(x, y, x + length, y, stroke, 1.6)
        self.line(x + length - 5, y - 4, x + length, y, stroke, 1.6)
        self.line(x + length - 5, y + 4, x + length, y, stroke, 1.6)

    def icon(self, name, x, y, size=26, stroke=BLUE):
        c = self.c
        c.saveState()
        c.translate(x, H - y - size)
        c.scale(size / 24, size / 24)
        c.setStrokeColor(color(stroke))
        c.setLineWidth(1.6)
        c.setLineCap(1)
        c.setLineJoin(1)
        if name == "pantalla":
            c.roundRect(2, 7, 20, 14, 2, fill=0, stroke=1)
            c.line(12, 7, 12, 3); c.line(7, 3, 17, 3)
        elif name == "sonido":
            p = c.beginPath(); p.moveTo(3, 9); p.lineTo(7, 9); p.lineTo(12, 5)
            p.lineTo(12, 19); p.lineTo(7, 15); p.lineTo(3, 15); p.close()
            c.drawPath(p)
            c.arc(12, 7, 19, 17, -65, 130); c.arc(11, 3, 23, 21, -65, 130)
        elif name == "reloj":
            c.circle(12, 12, 9); c.line(12, 12, 12, 17); c.line(12, 12, 16, 10)
        elif name == "encender":
            c.arc(3, 3, 21, 21, 135, 270); c.line(12, 13, 12, 23)
        elif name == "guardar":
            c.roundRect(3, 3, 18, 18, 2, fill=0, stroke=1)
            c.rect(7, 14, 10, 7, fill=0, stroke=1); c.rect(7, 3, 10, 7, fill=0, stroke=1)
        elif name == "teclado":
            c.roundRect(1, 5, 22, 14, 2, fill=0, stroke=1)
            for xx in (5, 9, 13, 17):
                c.line(xx, 14, xx + 1, 14); c.line(xx, 10, xx + 1, 10)
            c.line(7, 7, 17, 7)
        elif name == "papelera":
            c.line(3, 18, 21, 18); c.line(9, 21, 15, 21)
            c.line(6, 18, 7, 3); c.line(7, 3, 17, 3); c.line(17, 3, 18, 18)
            c.line(10, 14, 10, 7); c.line(14, 14, 14, 7)
        elif name in ("repetir", "deshacer"):
            c.arc(4, 4, 21, 21, 65, -285 if name == "repetir" else -215)
            c.line(4, 19, 4, 13); c.line(4, 19, 10, 19)
        elif name == "carpeta":
            p = c.beginPath(); p.moveTo(2, 4); p.lineTo(2, 20); p.lineTo(9, 20)
            p.lineTo(12, 17); p.lineTo(22, 17); p.lineTo(22, 4); p.close(); c.drawPath(p)
        c.restoreState()

    def badge(self, number, x, y, size=24):
        self.box(x, y, size, size, BLUE, radius=size / 2)
        self.text(str(number), x, y + 3.5, size, size=11, bold=True, fill=WHITE, align=1)

    def picture(self, name, x, y, w, h, padding=8, frame=True):
        path = ASSETS / (name + ".png")
        with Image.open(path) as image:
            pw, ph = image.size
        scale = min((w - 2 * padding) / pw, (h - 2 * padding) / ph)
        dw, dh = pw * scale, ph * scale
        dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
        if frame:
            self.box(x, y, w, h, WHITE, LINE, 12)
        self.c.drawImage(ImageReader(str(path)), dx, H - dy - dh, dw, dh, mask="auto")
        self.measures["imagenes"].append({
            "pagina": self.page, "archivo": name + ".png",
            "caja_contenedora": [round(v, 3) for v in (x, y, w, h)],
            "caja_imagen": [round(v, 3) for v in (dx, dy, dw, dh)],
            "dpi": round(pw / dw * 72, 1),
        })

    def note(self, value, y=510, x=M, w=CW, h=31):
        self.box(x, y, w, h, PALE, radius=7)
        self.line(x + 1, y + 6, x + 1, y + h - 6, BLUE, 2.4)
        self.text(value, x + 13, y + 8, w - 26, size=9.7, leading=13.4, max_h=h - 10)

    def header(self, p):
        self.box(0, 0, W, H, BG, radius=0)
        self.box(0, 0, W, 5, BLUE, radius=0)
        self.text(p["seccion"].upper(), M, 26, 300, size=9, bold=True, fill=BLUE)
        self.text("MANUAL DE USUARIO / 0.4.0", W - M - 250, 26, 250,
                  size=8, fill=MUTED, align=2)
        self.text(p["titulo"], M, 56, CW, size=24, bold=True, fill=NAVY, max_h=35)
        self.text(p["intro"], M, 99, CW, size=11.2, fill=MUTED, max_h=32)

    def footer(self):
        self.line(M, 554, W - M, 554)
        self.text("Comal++ 0.4.0", M, 566, 140, size=8.3, bold=True, fill=NAVY)
        self.text("Índice", 205, 566, 65, size=8.3, fill=BLUE)
        self.c.linkRect("", "portada", (200, H - 585, 270, H - 559), relative=0, thickness=0)
        for i, nav in enumerate(self.content["navegacion"]):
            x = 300 + i * 94
            active = self.active == nav["titulo"]
            self.box(x, 562, 86, 22, BLUE if active else BG, radius=6)
            self.text(nav["titulo"], x, 566, 86, size=8.1, bold=active,
                      fill=WHITE if active else MUTED, align=1)
            self.c.linkRect("", nav["destino"], (x, H - 584, x + 86, H - 562), thickness=0)
        self.text(f"{self.page:02d} / 12", W - M - 75, 566, 75,
                  size=8.3, bold=True, fill=NAVY, align=2)

    def steps(self, rows, y, h=68):
        gap = 18
        width = (CW - gap * (len(rows) - 1)) / len(rows)
        for i, (title, desc) in enumerate(rows):
            x = M + i * (width + gap)
            self.badge(i + 1, x, y)
            self.text(title, x + 34, y - 1, width - 34, size=12.2, bold=True, fill=NAVY)
            self.text(desc, x + 34, y + 23, width - 36, size=10.5, max_h=h - 23)

    def portada(self, p):
        self.box(0, 0, W, H, NAVY, radius=0)
        self.box(W - 18, 0, 18, H, BLUE, radius=0)
        self.text("COMAL++", M, 39, 300, size=16, bold=True, fill=WHITE)
        self.text("MANUAL DE OPERACIÓN / 0.4.0", M, 72, 350, size=9, fill="#BCDDF5")
        self.text(p["titulo"], M, 132, 350, size=43, leading=49, bold=True, fill=WHITE, max_h=105)
        self.text(p["intro"], M, 263, 330, size=13, fill="#D4E8F7", max_h=50)
        self.picture(p["imagen"], 392, 132, 406, 243, padding=6)
        self.text("ENCUENTRA LO QUE NECESITAS", M, 397, 500, size=8.8, bold=True, fill="#BCDDF5")
        gap = 14; width = (CW - 3 * gap) / 4
        for i, nav in enumerate(self.content["navegacion"]):
            x = M + i * (width + gap)
            self.box(x, 427, width, 93, WHITE, radius=10)
            self.text(nav["titulo"], x + 14, 442, width - 28, size=13.5, bold=True, fill=NAVY)
            self.text(p["temas"][i], x + 14, 467, width - 28, size=9.5, fill=MUTED, max_h=29)
            self.text(nav["rango"], x + 14, 502, width - 28, size=8.2, bold=True, fill=BLUE)
            self.c.linkRect("", nav["destino"], (x, H - 520, x + width, H - 427), thickness=0)
        self.text("Edición visual / " + self.content["edicion"], M, 556, CW,
                  size=8.5, fill="#BCDDF5")

    def panorama(self, p):
        # Whole interface for orientation; following pages magnify each control.
        self.picture(p["imagen"], (W - 515) / 2, 133, 515, 323, padding=0, frame=False)
        for i, (title, desc) in enumerate(p["claves"]):
            x = M + i * (CW + 15) / 3
            self.text(title, x, 462, (CW - 30) / 3, size=11.5, bold=True, fill=NAVY, align=1)
            self.text(desc, x, 482, (CW - 30) / 3, size=9.7, fill=MUTED, align=1)
        self.note(p["nota"], y=513)

    def llamada(self, p):
        self.picture(p["imagen"], (W - 362) / 2, 134, 362, 265, padding=0, frame=False)
        self.steps(p["pasos"], 415, h=65)
        for i, (source, target) in enumerate(p["ejemplos"]):
            x = M + i * (CW + 18) / 3
            width = (CW - 36) / 3
            self.box(x, 480, width, 31, WHITE, LINE, 7)
            self.text(source, x + 12, 486, 104, size=11, bold=True, fill=NAVY, align=1)
            self.arrow(x + 125, 496, 22)
            self.text(target, x + 161, 483, 57, size=15, bold=True, fill=BLUE, align=1)
        self.text(p["nota"], M, 526, CW, size=9.5, fill=MUTED, align=1, max_h=15)

    def acciones(self, p):
        gap = 18; width = (CW - gap * 2) / 3
        for i, card in enumerate(p["tarjetas"]):
            x = M + i * (width + gap)
            self.box(x, 144, width, 323, WHITE, LINE)
            self.icon(card["icono"], x + (width - 28) / 2, 165, 28)
            self.text(card["titulo"], x + 16, 208, width - 32, size=16, bold=True, fill=NAVY, align=1)
            image_width = 190 if card["imagen"] == "corregir-captura" else width - 28
            self.picture(card["imagen"], x + (width - image_width) / 2, 248,
                         image_width, 85, padding=0, frame=False)
            self.text(card["texto"], x + 18, 356, width - 36, size=10.4, max_h=72)
            self.text(card["resultado"], x + 18, 434, width - 36, size=9.2, fill=MUTED, max_h=26)
        self.note(p["nota"], y=482, h=31)
        self.text(p["detalle"], M, 528, CW, size=9.0, fill=MUTED, max_h=15, align=1)

    def pantalla(self, p):
        self.box(M, 142, 217, 352, WHITE, LINE)
        self.picture(p["imagen"], M + 17, 156, 183, 325, padding=0, frame=False)
        x = 279; width = (W - M - x - 14) / 2
        for i, (number, label, desc) in enumerate(p["cifras"]):
            xx = x + i * (width + 14)
            self.box(xx, 142, width, 112, WHITE, LINE)
            self.text(number, xx + 14, 148, 53, size=34, bold=True, fill=BLUE)
            self.text(label, xx + 69, 163, width - 81, size=11.2, bold=True, fill=NAVY, max_h=34)
            self.text(desc, xx + 14, 213, width - 28, size=9.3, fill=MUTED, max_h=29)
        self.text(p["etiqueta"].upper(), x, 275, W - M - x, size=8.7, bold=True, fill=MUTED)
        for i, (title, desc, tone) in enumerate(p["estados"]):
            y = 300 + i * 38
            self.box(x, y, W - M - x, 32, WHITE, radius=6)
            self.box(x + 11, y + 12, 7, 7, TONES[tone], radius=3.5)
            self.text(title, x + 28, y + 8, 140, size=10.3, bold=True, fill=TONES[tone])
            self.text(desc, x + 175, y + 8, 335, size=9.8, max_h=16)
        self.note(p["nota"], y=511, h=32)

    def ajustes(self, p):
        self.picture(p["imagen_barra"], (W - 442) / 2, 140, 442, 64, padding=0, frame=False)
        self.box(M, 226, 282, 267, WHITE, LINE)
        self.picture(p["imagen_volumen"], M + 32, 244, 218, 232, padding=0, frame=False)
        x = 344; width = W - M - x
        volume = p["volumen"]
        self.text(volume["titulo"], x, 229, width, size=15, bold=True, fill=NAVY)
        self.text(volume["texto"], x, 258, width, size=11.2, max_h=32)
        for i, item in enumerate(volume["rangos"]):
            self.text(item, x, 296 + 24 * i, width, size=10.3, max_h=20)
        self.text(volume["nota"], x, 351, width, size=9.5, fill=MUTED, max_h=30)
        gap = 14; card_width = (width - gap) / 2
        for i, (title, desc) in enumerate(p["preferencias"]):
            xx = x + i * (card_width + gap)
            self.box(xx, 410, card_width, 83, WHITE, LINE, 9)
            self.text(title, xx + 14, 424, card_width - 28, size=12.2, bold=True, fill=BLUE)
            self.text(desc, xx + 14, 451, card_width - 28, size=10.3, max_h=34)
        self.note(p["nota"], y=512, h=32)

    def archivos(self, p):
        self.picture(p["imagen"], (W - 720) / 2, 138, 720, 245, padding=0, frame=False)
        self.text(p["nota"], M, 390, CW, size=9.2, fill=MUTED, align=1, max_h=14)
        self.steps(p["pasos"], 418, h=63)
        gap = 18; width = (CW - gap) / 2
        for i, (title, formats, limit) in enumerate(p["formatos"]):
            x = M + i * (width + gap)
            self.box(x, 484, width, 57, WHITE, LINE, 8)
            self.text(title, x + 12, 493, 70, size=11, bold=True, fill=BLUE)
            self.text(formats, x + 83, 492, width - 95, size=10.2, bold=True, fill=NAVY)
            self.text(limit, x + 12, 517, width - 24, size=9.5, max_h=16)

    def youtube(self, p):
        self.picture(p["imagen"], (W - 702) / 2, 153, 702, 186, padding=0, frame=False)
        gap = 20; width = (CW - gap) / 2
        for i, (title, desc) in enumerate(p["acciones"]):
            x = M + i * (width + gap)
            self.badge(i + 1, x, 360)
            self.text(title, x + 35, 359, width - 35, size=12.2, bold=True, fill=NAVY)
            self.text(desc, x + 35, 383, width - 36, size=10.5, max_h=34)
        self.text(p["flujo_titulo"], M, 440, CW, size=10.7, bold=True, fill=MUTED, align=1)
        flow_width = 158; gap = 32; start = (W - (4 * flow_width + 3 * gap)) / 2
        for i, title in enumerate(p["flujo"]):
            x = start + i * (flow_width + gap)
            self.box(x, 467, flow_width, 35, WHITE, LINE, 8)
            self.text(title, x, 476, flow_width, size=11, bold=True, fill=NAVY, align=1)
            if i < 3:
                self.arrow(x + flow_width + 7, 485, 18)
        self.note(p["nota"], y=518, h=26)

    def jornada(self, p):
        gap = 20; width = (CW - gap * 2) / 3
        for i, card in enumerate(p["tarjetas"]):
            x = M + i * (width + gap)
            self.box(x, 154, width, 331, WHITE, LINE)
            self.box(x + (width - 56) / 2, 179, 56, 56, PALE, radius=14)
            self.icon(card["icono"], x + (width - 28) / 2, 193, 28)
            self.text(card["titulo"], x + 18, 259, width - 36, size=16, bold=True, fill=NAVY, align=1)
            for j, item in enumerate(card["pasos"]):
                y = 311 + j * 51
                self.box(x + 19, y + 5, 5, 5, BLUE, radius=2.5)
                self.text(item, x + 34, y, width - 53, size=10.7, max_h=42)
        self.note(p["nota"], y=507, h=36)

    def problemas(self, p):
        gap = 20; width = (CW - gap) / 2
        for i, (title, action, icon) in enumerate(p["casos"]):
            x = M + (i % 2) * (width + gap)
            y = 147 + (i // 2) * 117
            self.box(x, y, width, 101, WHITE, LINE, 10)
            self.icon(icon, x + 16, y + 20, 23)
            self.text(title, x + 53, y + 16, width - 69, size=11.6, bold=True, fill=NAVY, max_h=34)
            self.text(action, x + 53, y + 47, width - 69, size=10.1, max_h=43)
        self.note(p["nota"], y=520, h=25)

    def ayuda(self, p):
        self.picture(p["imagen"], (W - 702) / 2, 160, 702, 202, padding=0, frame=False)
        self.text(p["pie_imagen"], M, 371, CW, size=9.3, fill=MUTED, align=1)
        gap = 20; width = (CW - gap) / 2
        for i, (title, body) in enumerate(p["tarjetas"]):
            x = M + i * (width + gap)
            self.box(x, 406, width, 91, WHITE, LINE, 10)
            self.text(title, x + 16, 420, width - 32, size=12.1, bold=True, fill=NAVY)
            self.text(body, x + 16, 447, width - 32, size=10.2, max_h=44)
        self.note(p["nota"], y=514, h=31)

    def acceso(self, p):
        gap = 22; width = (CW - gap) / 2
        for i in range(2):
            self.box(M + i * (width + gap), 149, width, 315, WHITE, LINE)
        left, right = p["instalar"], p["navegador"]
        self.text(left["titulo"], M + 18, 170, width - 36, size=15, bold=True, fill=NAVY)
        for i, step in enumerate(left["pasos"]):
            y = 218 + i * 43
            self.badge(i + 1, M + 18, y, 21)
            self.text(step, M + 50, y + 1, width - 68, size=10.5, max_h=36)
        self.text(left["nota"], M + 18, 416, width - 36, size=9.5, fill=MUTED, max_h=32)
        x = M + width + gap
        self.text(right["titulo"], x + 18, 170, width - 36, size=15, bold=True, fill=NAVY)
        self.text(right["texto"], x + 18, 206, width - 36, size=10.5)
        for i, (label, url) in enumerate(right["enlaces"]):
            y = 255 + i * 69
            self.text(label.upper(), x + 18, y, width - 36, size=8.5, bold=True, fill=MUTED)
            self.text(url, x + 18, y + 22, width - 36, size=11.4, bold=True, fill=BLUE)
            self.c.linkURL(url, (x + 18, H - y - 43, x + width - 18, H - y - 20), thickness=0)
        self.text(right["nota"], x + 18, 416, width - 36, size=9.5, fill=MUTED, max_h=32)
        width = (CW - 32) / 3
        for i, (key, action) in enumerate(p["atajos"]):
            x = M + i * (width + 16)
            self.box(x, 494, width, 46, PALE, radius=8)
            self.text(key, x + 14, 508, 73, size=11.5, bold=True, fill=BLUE)
            self.text(action, x + 92, 508, width - 104, size=9.6, max_h=15)

    def build(self):
        for i, page in enumerate(self.content["paginas"], 1):
            self.page = i
            self.c.bookmarkPage(page["id"])
            self.c.addOutlineEntry(page["titulo"].replace("\n", " "), page["id"], level=0)
            if page["layout"] != "portada":
                self.active = page["seccion"]
                self.header(page)
            getattr(self, page["layout"])(page)
            if page["layout"] != "portada":
                self.footer()
            self.c.showPage()
        self.c.save()
        self.validate()

    def validate(self):
        reader = PdfReader(self.output)
        expected = len(self.content["paginas"])
        if len(reader.pages) != expected or expected != 12:
            raise ValueError("The manual must contain 12 pages")
        inventory = json.loads((ASSETS / "inventario.json").read_text(encoding="utf-8"))
        for asset in inventory["imagenes"]:
            path = ASSETS / asset["archivo"]
            if hashlib.sha256(path.read_bytes()).hexdigest() != asset["sha256"]:
                raise ValueError(f"Asset differs from its inventory: {path.name}")
            with Image.open(path) as image:
                if list(image.size) != asset["tamano_px"]:
                    raise ValueError(f"Asset dimensions differ: {path.name}")
        for item in self.measures["imagenes"]:
            x, y, w, h = item["caja_contenedora"]
            ix, iy, iw, ih = item["caja_imagen"]
            if abs((ix + iw / 2) - (x + w / 2)) > 0.01:
                raise ValueError("Image is not horizontally centered")
            if abs((iy + ih / 2) - (y + h / 2)) > 0.01:
                raise ValueError("Image is not vertically centered")
            if item["dpi"] < 110:
                raise ValueError(f"Insufficient image resolution: {item}")
        pages = []
        page_refs = {p.indirect_reference.idnum: i for i, p in enumerate(reader.pages)}
        internal_links = 0
        external_links = 0
        for i, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            if "\ufffd" in text or "\u25a0" in text:
                raise ValueError(f"Replacement glyph on page {i}")
            for ref in page.get("/Annots", []):
                annotation = ref.get_object()
                destination = annotation.get("/Dest")
                if destination:
                    if destination[0].idnum not in page_refs:
                        raise ValueError(f"Broken internal link on page {i}")
                    internal_links += 1
                elif annotation.get("/A", {}).get("/S") == "/URI":
                    external_links += 1
            pages.append({"pagina": i, "palabras": len(text.split()),
                          "enlaces": len(page.get("/Annots", []))})
        if internal_links != 59 or external_links != 2 or len(reader.outline) != 12:
            raise ValueError("Incomplete index, section links or PDF outline")
        # Distinct text blocks must never paint on top of each other.
        text_blocks = self.measures["textos"]
        for i, a in enumerate(text_blocks):
            ax, ay, aw, ah = a["caja"]
            for b in text_blocks[i + 1:]:
                if a["pagina"] != b["pagina"]:
                    continue
                bx, by, bw, bh = b["caja"]
                if min(ax + aw, bx + bw) - max(ax, bx) > 0.2 and min(ay + ah, by + bh) - max(ay, by) > 0.2:
                    raise ValueError(f"Overlapping text on page {a['pagina']}: {a['texto']} / {b['texto']}")
        report = {
            "estado": "PASS", "archivo": self.output.name,
            "sha256": hashlib.sha256(self.output.read_bytes()).hexdigest(),
            "edicion": self.content["edicion"], "paginas": pages,
            "palabras_totales": sum(p["palabras"] for p in pages),
            "imagenes_centradas": len(self.measures["imagenes"]),
            "dpi_minimo": min(i["dpi"] for i in self.measures["imagenes"]),
            "enlaces_internos": internal_links, "enlaces_externos": external_links,
            "marcadores": len(reader.outline), "recursos_verificados": len(inventory["imagenes"]),
            "texto_e_imagenes": self.measures,
            "revision_visual": "Requiere renderizar y revisar cada pagina despues de generar.",
        }
        target = ROOT / "test-results/manual-visual/maquetacion.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({k: v for k, v in report.items() if k != "texto_e_imagenes"}, ensure_ascii=True, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    content = json.loads((HERE / "contenido.json").read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    register_fonts()
    Manual(args.output, content).build()


if __name__ == "__main__":
    main()
