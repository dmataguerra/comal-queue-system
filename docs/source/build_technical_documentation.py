"""Alternative PDF export from the current LaTeX chapter text, without TeX.

This intentionally does not assert that a LaTeX compiler has passed. The
original master remains available for latexmk in an appropriately configured
environment. Supports the plain section/paragraph source format used here.
"""
from pathlib import Path
from html import escape
import re
from reportlab.platypus import PageBreak, KeepTogether
from pdf_layout import build, cover, p

DOCS = Path(__file__).resolve().parents[1]

def decode(text):
    replacements = {
        r'\textbackslash{}': '\\', r'\textasciitilde{}': '~',
        r'\textasciicircum{}': '^', r'\&': '&', r'\%': '%',
        r'\$': '$', r'\#': '#', r'\_': '_', r'\{': '{', r'\}': '}',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text

def main():
    master = (DOCS/'technical-documentation.tex').read_text(encoding='utf-8')
    chapters = [name for name in re.findall(r'\\input\{([^}]+)\}', master) if name != 'preamble']
    story = cover('Technical Documentation', 'Software 0.3.1 · 1 October 2026', 'Local Electron architecture, operator/public interfaces, JSON persistence, IPC and HTTP/SSE, quality, recovery and release controls. Exported from the current 57 LaTeX chapters using ReportLab; this file does not certify TeX compilation.')
    story.append(p('Contents', 'ComalH1'))
    for name in chapters:
        text = (DOCS/(name+'.tex')).read_text(encoding='utf-8')
        for kind, title in re.findall(r'\\(section|subsection)\{([^\n]+)\}', text):
            story.append(p(escape(decode(title)), 'ComalH2' if kind=='section' else 'ComalSmall'))
    for name in chapters:
        text = (DOCS/(name+'.tex')).read_text(encoding='utf-8')
        for block in re.split(r'\n\s*\n', text.strip()):
            if block.startswith('\\section') or block.startswith('\\subsection'):
                for kind, title in re.findall(r'\\(section|subsection)\{([^\n]+)\}', block):
                    if kind=='section':
                        story.append(PageBreak())
                    story.append(p(escape(decode(title)), 'ComalH1' if kind=='section' else 'ComalH2'))
            else:
                decoded = decode(block)
                if re.search(r'\\[A-Za-z]+\{', decoded):
                    raise ValueError(f'Unsupported LaTeX markup in {name}: {decoded[:100]}')
                paragraph = p(escape(decoded.replace('\n', ' ')), 'ComalSmall' if decoded.startswith('Evidence:') else 'ComalBody')
                if decoded.startswith('Evidence:'):
                    # Keep the source line beside the statement it substantiates.
                    previous = story.pop()
                    story.append(KeepTogether([previous, paragraph]))
                else:
                    story.append(paragraph)
    out = DOCS/'technical-documentation.pdf'
    build(out, 'Comal++ Technical Documentation 0.3.1', story, technical=True)
    print(out)

if __name__=='__main__':
    main()
