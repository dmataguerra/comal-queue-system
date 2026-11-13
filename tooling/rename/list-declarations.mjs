// Lists renameable declarations (not object/interface property names) per file, so the
// Spanish -> English name map can be built from an exact inventory.
// Usage: node tooling/rename/list-declarations.mjs <dir-or-file>... > out.tsv
// Output: file<TAB>kind<TAB>name<TAB>count   (count = declarations of that name in the file)
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const KINDS = {
  [ts.SyntaxKind.FunctionDeclaration]: 'function',
  [ts.SyntaxKind.VariableDeclaration]: 'variable',
  [ts.SyntaxKind.Parameter]: 'parameter',
  [ts.SyntaxKind.ClassDeclaration]: 'class',
  [ts.SyntaxKind.InterfaceDeclaration]: 'interface',
  [ts.SyntaxKind.TypeAliasDeclaration]: 'type',
  [ts.SyntaxKind.EnumDeclaration]: 'enum',
  [ts.SyntaxKind.BindingElement]: 'binding',
  [ts.SyntaxKind.TypeParameter]: 'typeParameter',
};
const walk = (p) =>
  statSync(p).isDirectory()
    ? readdirSync(p).flatMap((n) => (n === 'node_modules' ? [] : walk(join(p, n))))
    : /\.(ts|tsx|cts|mjs|js)$/.test(p)
      ? [p]
      : [];
for (const arg of process.argv.slice(2)) {
  for (const file of walk(resolve(root, arg))) {
    const text = readFileSync(file, 'utf8');
    const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.Unknown;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
    const counts = new Map();
    const visit = (node) => {
      const k = KINDS[node.kind];
      if (k && node.name && ts.isIdentifier(node.name)) {
        const key = `${k}\t${node.name.text}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    const rel = relative(root, file).replaceAll('\\', '/');
    for (const [key, n] of counts) console.log(`${rel}\t${key}\t${n}`);
  }
}
