"""Shared document styling for reproducible, current Comal++ PDF manuals."""
from pathlib import Path
from html import escape
import re
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, Spacer, SimpleDocTemplate, PageBreak

NAVY = colors.HexColor('#073B68')
BLUE = colors.HexColor('#0568D8')
INK = colors.HexColor('#19324A')
STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle(name='CoverComal', fontName='Helvetica-Bold', fontSize=27, leading=32, textColor=NAVY, spaceAfter=18))
STYLES.add(ParagraphStyle(name='ComalH1', fontName='Helvetica-Bold', fontSize=17, leading=22, textColor=NAVY, spaceBefore=14, spaceAfter=9, keepWithNext=True))
STYLES.add(ParagraphStyle(name='ComalH2', fontName='Helvetica-Bold', fontSize=12.5, leading=17, textColor=BLUE, spaceBefore=12, spaceAfter=6, keepWithNext=True))
STYLES.add(ParagraphStyle(name='ComalBody', fontName='Helvetica', fontSize=10, leading=14.5, textColor=INK, spaceAfter=8))
STYLES.add(ParagraphStyle(name='ComalBullet', parent=STYLES['ComalBody'], leftIndent=12, firstLineIndent=-9))
STYLES.add(ParagraphStyle(name='ComalSmall', parent=STYLES['ComalBody'], fontSize=8, leading=11, textColor=colors.HexColor('#60758A')))

def clean(text):
    return text.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-').replace('\ufeff', '')

def p(text, style='ComalBody'):
    return Paragraph(clean(text), STYLES[style])

def inline(text):
    text = escape(clean(text))
    text = re.sub(r'\[([^]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    # Small monospaced fragments wrap reliably inside the body paragraphs.
    text = re.sub(r'`([^`]+)`', r'<font name="Courier" size="9">\1</font>', text)
    return text

def markdown(text, include_title=False):
    story = []
    for chunk in re.split(r'\n\s*\n', text.strip()):
        lines = chunk.strip().splitlines()
        if lines[0].startswith('# '):
            if include_title:
                story.append(p(inline(lines[0][2:]), 'ComalH1'))
            continue
        if lines[0].startswith('## '):
            story.append(p(inline(lines[0][3:]), 'ComalH1'))
            if len(lines) > 1:
                story.append(p(inline(' '.join(lines[1:]))))
        elif lines[0].startswith('### '):
            story.append(p(inline(lines[0][4:]), 'ComalH2'))
            if len(lines) > 1:
                story.append(p(inline(' '.join(lines[1:]))))
        elif all(re.match(r'(- |\d+\. )', line) for line in lines):
            for line in lines:
                story.append(p(inline(re.sub(r'^- ', '- ', line)), 'ComalBullet'))
        else:
            story.append(p(inline(' '.join(lines))))
    return story

def cover(title, subtitle, note):
    return [Spacer(1, 45), p('COMAL++ · FACULTAD DE INFORMÁTICA UAQ', 'ComalSmall'), Spacer(1, 18), p(title, 'CoverComal'), p(subtitle), Spacer(1, 20), p(note), PageBreak()]

def build(path, title, story, technical=False):
    def footer(canvas, doc):
        canvas.saveState()
        w, h = A4
        canvas.setFillColor(NAVY)
        canvas.rect(0, h-8, w, 8, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor('#60758A'))
        canvas.setFont('Helvetica', 8)
        canvas.drawString(45, 27, 'Comal++ 0.4.0 · 1 de octubre de 2026')
        canvas.drawRightString(w-45, 27, str(doc.page))
        canvas.restoreState()
    doc = SimpleDocTemplate(str(path), pagesize=A4, rightMargin=45, leftMargin=45, topMargin=45, bottomMargin=45, title=title, author='Comal++', subject='Current documentation for Comal++ 0.4.0')
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
