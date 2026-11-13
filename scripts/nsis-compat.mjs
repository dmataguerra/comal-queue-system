import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export function prepareNsisCompatibility(root, tempDir) {
  const templates = join(root, 'node_modules', 'app-builder-lib', 'templates', 'nsis');
  const original = readFileSync(join(templates, 'include', 'installUtil.nsh'), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
  const previousBlock = `  !insertMacro setIsTryToKeepShortcuts

  \${if} $isTryToKeepShortcuts == "true"
    !insertmacro readReg $R5 "$rootKey" "\${INSTALL_REGISTRY_KEY}" KeepShortcuts
    # if true, it means that old uninstaller supports --keep-shortcuts flag
    \${if} $R5 == "true"
    \${andIf} \${FileExists} "$appExe"
      StrCpy $0 "$0 --keep-shortcuts"
    \${endIf}
  \${endIf}`;
  if (original.split(previousBlock).length !== 2)
    throw new Error(
      'Cambió la plantilla de actualización NSIS. Revisar la compatibilidad antes de publicar.',
    );
  const replacement = `  # Comal: preserve existing shortcuts even when the installation path changes.
  # The new installer refreshes Start Menu; it never writes to protected Desktop.
  !insertmacro readReg $R5 "$rootKey" "\${INSTALL_REGISTRY_KEY}" KeepShortcuts
  \${if} $R5 == "true"
    StrCpy $0 "$0 --keep-shortcuts"
  \${endIf}`;
  const resourcesDir = join(tempDir, 'nsis-compat');
  cpSync(templates, resourcesDir, { recursive: true });
  writeFileSync(
    join(resourcesDir, 'installUtil.nsh'),
    original.replace(previousBlock, replacement),
  );
  const escapeNsis = (filePath) => filePath.replaceAll('$', '$$').replaceAll('"', '$\\"');
  const includeFile = join(resourcesDir, 'comal.nsh');
  writeFileSync(includeFile, `!cd "${escapeNsis(resourcesDir)}"\n`);
  return includeFile;
}
