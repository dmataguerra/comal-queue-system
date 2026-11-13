// Compiler-driven rename for the Spanish -> English migration.
//
// Uses the TypeScript language service, so only real declarations and their references
// change. Object property names that are part of a wire or disk contract (config.json and
// estado.json keys, IPC payloads, window.turnero API) are never declaration targets here:
// renaming a local that is used in shorthand `{ name }` produces `{ name: newName }`.
//
// Usage: node tooling/rename/rename-symbols.mjs <map.json> [--dry]
// map.json: {
//   "files": { "old/path.ts": "new/path.ts", "old/dir": "new/dir" },
//   "symbols": [ { "file": "path/after/file/renames.ts", "name": "old", "to": "new" } ]
// }
// File renames run first; symbol entries refer to the NEW file paths.
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const [mapPath, flag] = process.argv.slice(2);
const dry = flag === '--dry';
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const toPosix = (p) => p.replaceAll('\\', '/');
const abs = (p) => toPosix(resolve(root, p));

const parsed = ts.getParsedCommandLineOfConfigFile(
  join(root, 'tsconfig.eslint.json'),
  {},
  { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => console.error(d.messageText) },
);
const files = new Map(); // path -> { text, version }
// Files outside tsconfig (browser script, tooling) are added because the map names them.
const extraRoots = (map.symbols ?? []).map((s) => abs(s.file));
// Old path -> new path for every move done so far, so the program never sees a stale copy.
const moved = [];
const remap = (f) => {
  for (const [a, b, isDir] of moved) {
    if (f === a) return b;
    if (isDir && f.startsWith(a + '/')) return b + f.slice(a.length);
  }
  return f;
};
const listFiles = () =>
  [
    ...new Set([...parsed.fileNames.map((f) => remap(toPosix(f))), ...files.keys(), ...extraRoots]),
  ].filter((f) => /\.(ts|tsx|cts|mts|js|mjs|cjs)$/.test(f) && (files.has(f) || existsSync(f)));
const read = (f) => {
  f = toPosix(f);
  if (remap(f) !== f) return undefined;
  if (!files.has(f)) {
    if (!existsSync(f)) return undefined;
    files.set(f, { text: readFileSync(f, 'utf8'), version: 0, dirty: false });
  }
  return files.get(f).text;
};
const host = {
  getScriptFileNames: listFiles,
  getScriptVersion: (f) => String(files.get(toPosix(f))?.version ?? 0),
  getScriptSnapshot: (f) => {
    const t = read(f);
    return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t);
  },
  getCurrentDirectory: () => root,
  getCompilationSettings: () => ({ ...parsed.options, allowJs: true }),
  getDefaultLibFileName: ts.getDefaultLibFilePath,
  fileExists: (f) => files.has(toPosix(f)) || ts.sys.fileExists(f),
  readFile: (f) => read(f),
  readDirectory: ts.sys.readDirectory,
  // Moved-into folders such as core/ only exist in memory until results are written; module
  // resolution must still see them or every import into them stays unresolved.
  directoryExists: (d) => {
    const dir = toPosix(d).replace(/\/$/, '') + '/';
    for (const f of files.keys()) if (f.startsWith(dir)) return true;
    return ts.sys.directoryExists(d);
  },
  getDirectories: ts.sys.getDirectories,
};
const service = ts.createLanguageService(host, ts.createDocumentRegistry());
const prefs = { providePrefixAndSuffixTextForRename: true, allowRenameOfImportPath: false };

function applyEdits(edits) {
  // Group per file, apply from the end so offsets stay valid.
  const perFile = new Map();
  for (const { fileName, textChanges } of edits) {
    const f = toPosix(fileName);
    perFile.set(f, [...(perFile.get(f) ?? []), ...textChanges]);
  }
  for (const [f, changes] of perFile) {
    let text = read(f);
    if (text === undefined) continue;
    const seen = new Set();
    for (const c of changes.sort((a, b) => b.span.start - a.span.start)) {
      const key = `${c.span.start}:${c.span.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      text = text.slice(0, c.span.start) + c.newText + text.slice(c.span.start + c.span.length);
    }
    const entry = files.get(f);
    entry.text = text;
    entry.version++;
    entry.dirty = true;
  }
}

// ---- 1. File and folder moves (imports updated by the language service).
const moves = [];
for (const [from, to] of Object.entries(map.files ?? {})) {
  const a = abs(from);
  const b = abs(to);
  if (!existsSync(a)) throw new Error(`Missing source for move: ${from}`);
  applyEdits(service.getEditsForFileRename(a, b, {}, prefs));
  moves.push([a, b]);
  moved.push([a, b, statSync(a).isDirectory()]);
  // Re-key loaded files under the new path so later lookups see them.
  const isDir = statSync(a).isDirectory();
  for (const [f, entry] of [...files]) {
    const inside = isDir ? f.startsWith(a + '/') : f === a;
    if (!inside) continue;
    files.delete(f);
    files.set(isDir ? b + f.slice(a.length) : b, entry);
  }
  if (isDir) {
    const walk = (d) =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : [toPosix(join(d, e.name))],
      );
    for (const f of walk(a)) {
      const target = b + f.slice(a.length);
      if (!files.has(target) && /\.(ts|tsx|cts|mjs|js)$/.test(f))
        files.set(target, { text: readFileSync(f, 'utf8'), version: 1, dirty: true });
    }
  } else if (!files.has(b)) {
    files.set(b, { text: readFileSync(a, 'utf8'), version: 1, dirty: true });
  }
}

// ---- 2. Symbol renames.
const DECL = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.BindingElement,
  ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.TypeParameter,
]);
const problems = [];
let renamed = 0;
for (const { file, name, to } of map.symbols ?? []) {
  const f = abs(file);
  const program = service.getProgram();
  const source = program.getSourceFile(f);
  if (!source) {
    problems.push(`not in program: ${file}`);
    continue;
  }
  // Every declaration of `name` in this file (a param named `logger` may appear many times).
  const positions = [];
  const visit = (node) => {
    if (
      ts.isIdentifier(node) &&
      node.text === name &&
      DECL.has(node.parent.kind) &&
      node.parent.name === node &&
      // An import specifier is renamed through its export, not locally.
      node.parent.kind !== ts.SyntaxKind.ImportSpecifier
    )
      positions.push(node.getStart(source));
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!positions.length) {
    problems.push(`no declaration of ${name} in ${file}`);
    continue;
  }
  const edits = new Map();
  for (const pos of positions) {
    const locations = service.findRenameLocations(f, pos, false, false, prefs) ?? [];
    for (const loc of locations) {
      const lf = toPosix(loc.fileName);
      if (lf.includes('/node_modules/')) continue;
      const list = edits.get(lf) ?? [];
      list.push({
        span: loc.textSpan,
        newText: `${loc.prefixText ?? ''}${to}${loc.suffixText ?? ''}`,
      });
      edits.set(lf, list);
    }
  }
  applyEdits([...edits].map(([fileName, textChanges]) => ({ fileName, textChanges })));
  renamed++;
}

// ---- 3. Write results.
const changed = [...files].filter(([, e]) => e.dirty).map(([f]) => f);
console.log(
  JSON.stringify(
    { moves: moves.length, symbolsRenamed: renamed, filesChanged: changed.length, problems },
    null,
    2,
  ),
);
if (dry) process.exit(problems.length ? 1 : 0);
for (const [a, b] of moves) {
  mkdirSync(dirname(b), { recursive: true });
  execFileSync('git', ['mv', relative(root, a), relative(root, b)], { cwd: root });
}
for (const f of changed) writeFileSync(f, files.get(f).text);
