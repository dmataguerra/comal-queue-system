"""Check documentation targets, command/API coverage and generated PDF content."""
from pathlib import Path
import json
import re
from urllib.parse import unquote
from pypdf import PdfReader
import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT/'docs'

def main():
    errors = []
    checks = {}
    files = [*ROOT.glob('*.md'), *DOCS.rglob('*.md'), ROOT/'tooling/audio/README.md', *ROOT.glob('public/assets/icons/*/README.md')]
    local_links = 0
    for file in files:
        text = file.read_text(encoding='utf-8-sig')
        for match in re.finditer(r'!?\[[^\n\]]*\]\(([^)\n]+)\)', text):
            target = match.group(1).strip().split(' "', 1)[0].strip('<>')
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'):
                continue
            path = unquote(target.split('#', 1)[0])
            local_links += 1
            if not (file.parent/path).exists():
                errors.append(f'Missing link in {file.relative_to(ROOT)}: {target}')
    checks['local_links'] = local_links

    master = (DOCS/'technical-documentation.tex').read_text(encoding='utf-8')
    inputs = re.findall(r'\\input\{([^}]+)\}', master)
    chapters = [name for name in inputs if name!='preamble']
    if len(chapters)!=57:
        errors.append(f'Expected 57 chapters, got {len(chapters)}')
    for name in inputs:
        if not (DOCS/(name+'.tex')).is_file():
            errors.append('Missing input '+name)
    checks['tex_inputs'] = len(inputs)
    for file in DOCS.rglob('*.tex'):
        text = file.read_text(encoding='utf-8')
        unescaped = re.sub(r'\\[{}]', '', text)
        level = 0
        for char in unescaped:
            if char=='{': level+=1
            elif char=='}': level-=1
            if level<0: break
        if level!=0:
            errors.append(f'Unbalanced TeX braces: {file.relative_to(ROOT)}')
        begun = re.findall(r'\\begin\{([^}]+)\}', text)
        ended = re.findall(r'\\end\{([^}]+)\}', text)
        if sorted(begun)!=sorted(ended):
            errors.append(f'Unbalanced environments: {file.relative_to(ROOT)}')

    package = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    scripts = set(package['scripts'])
    commands = set()
    current_md = [file for file in files if '> **Registro histórico' not in file.read_text(encoding='utf-8-sig')]
    for file in current_md:
        commands.update(re.findall(r'npm run ([A-Za-z0-9:_-]+)', file.read_text(encoding='utf-8-sig')))
    unknown = commands-scripts
    if unknown: errors.append('Unknown npm commands: '+', '.join(sorted(unknown)))
    checks['npm_commands'] = sorted(commands)

    endpoints = (DOCS/'06-api/endpoints.tex').read_text(encoding='utf-8')
    server = (ROOT/'main/servidor-web.ts').read_text(encoding='utf-8')
    routes = set(re.findall(r"url\.pathname === '(/api/[^']+)'", server))
    for route in routes:
        if route not in endpoints:
            errors.append('Undocumented HTTP route '+route)
    checks['http_routes'] = sorted(routes)
    technical = '\n'.join((DOCS/(name+'.tex')).read_text(encoding='utf-8') for name in chapters)
    for old in ['server/state.service.ts', 'src/App.tsx', 'server/database.ts', 'tests/backend.test.ts', 'electron/main.cjs']:
        if old in technical: errors.append('Obsolete source reference '+old)

    # The reviewed parallel snapshot must match source byte-for-byte.
    source = ROOT.parent.parent
    snapshot_files = ['main/main.ts','scripts/smoke-browser.mjs','scripts/smoke-full-day.mjs','scripts/smoke-hardening.mjs','scripts/smoke-interface.mjs','scripts/smoke-theme.mjs','vistas/comun/components/AnimatedBackground.tsx','vistas/comun/components/SizeControl.tsx','vistas/comun/hooks/useClock.ts','vistas/comun/styles/interfaz.css','vistas/comun/styles/tema.css','vistas/comun/tamanio.ts','vistas/operador/OperadorPage.tsx']
    if source!=ROOT and (source/'package.json').exists():
        for name in snapshot_files:
            if (source/name).read_bytes()!=(ROOT/name).read_bytes():
                errors.append('Parallel source changed since stable snapshot: '+name)
        checks['stable_snapshot_files'] = len(snapshot_files)

    pdfs = {
        'technical-documentation.pdf': ['Persistence and legacy database migration', 'HTTP routes', 'Documentation status', 'TURNERO_PUERTO'],
        'user-manual/Manual-de-Usuario.pdf': ['1. Antes de atender', '2. Llamar', '8. Cierre', '70%', '130%', 'am/pm', '45 segundos'],
        'user-manual/Guia-Rapida-Cajero.pdf': ['Antes de atender', 'Cierre y recuperación', '213298', 'am/pm', '120'],
    }
    # Quick manual describes 70-130 and has no reason to assert a timeout value.
    pdfs['user-manual/Guia-Rapida-Cajero.pdf'].remove('120')
    checks['pdfs'] = {}
    for name, terms in pdfs.items():
        path = DOCS/name
        reader = PdfReader(path)
        text = '\n'.join(page.extract_text() for page in reader.pages)
        for term in terms:
            if term not in text:
                errors.append(f'Missing generated PDF text in {name}: {term}')
        if '\ufffd' in text or '\u25a0' in text:
            errors.append('Replacement glyph in '+name)
        if len(text)<1800:
            errors.append('PDF content unexpectedly short: '+name)
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages,1):
                for word in page.extract_words():
                    if word['x0']<0 or word['x1']>page.width+1 or word['top']<0 or word['bottom']>page.height+1:
                        errors.append(f'Out-of-page text in {name} page {i}: {word["text"]}')
        checks['pdfs'][name] = {'pages':len(reader.pages), 'characters':len(text)}
    result = {'status':'FAIL' if errors else 'PASS', 'checks':checks, 'errors':errors, 'latex_compilation':'not verified; ReportLab export', 'application_endurance':'390 minutes not executed'}
    out = ROOT/'test-results/docs-validation'
    out.mkdir(parents=True, exist_ok=True)
    (out/'resultado.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors: raise SystemExit(1)

if __name__=='__main__':
    main()
