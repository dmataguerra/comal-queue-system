import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Keep legacy uninstallers away from Desktop even when moving the install directory. */
export function prepararCompatibilidadNsis(raiz, temporal) {
  const plantillas = join(raiz, 'node_modules', 'app-builder-lib', 'templates', 'nsis');
  const original = readFileSync(join(plantillas, 'include', 'installUtil.nsh'), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
  const anterior = `  !insertMacro setIsTryToKeepShortcuts

  \${if} $isTryToKeepShortcuts == "true"
    !insertmacro readReg $R5 "$rootKey" "\${INSTALL_REGISTRY_KEY}" KeepShortcuts
    # if true, it means that old uninstaller supports --keep-shortcuts flag
    \${if} $R5 == "true"
    \${andIf} \${FileExists} "$appExe"
      StrCpy $0 "$0 --keep-shortcuts"
    \${endIf}
  \${endIf}`;
  if (original.split(anterior).length !== 2)
    throw new Error(
      'Cambió la plantilla de actualización NSIS. Revisar la compatibilidad antes de publicar.',
    );
  const nuevo = `  # Comal: preserve existing shortcuts even when the installation path changes.
  # The new installer refreshes Start Menu; it never writes to protected Desktop.
  !insertmacro readReg $R5 "$rootKey" "\${INSTALL_REGISTRY_KEY}" KeepShortcuts
  \${if} $R5 == "true"
    StrCpy $0 "$0 --keep-shortcuts"
  \${endIf}`;
  const recursos = join(temporal, 'nsis-compat');
  cpSync(plantillas, recursos, { recursive: true });
  writeFileSync(join(recursos, 'installUtil.nsh'), original.replace(anterior, nuevo));
  // NSIS resolves includes in the compiler working directory first. Override only
  // this include in staging, keeping electron-builder's standard signed uninstaller.
  const escapar = (ruta) => ruta.replaceAll('$', '$$').replaceAll('"', '$\\"');
  const inclusion = join(recursos, 'comal.nsh');
  writeFileSync(inclusion, `!cd "${escapar(recursos)}"\n`);
  return inclusion;
}
