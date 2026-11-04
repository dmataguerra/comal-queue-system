import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
function isInside(root: string, target: string): boolean {
  const path = relative(root, target);
  return Boolean(path) && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}
// Se comprueba la ruta real para que un enlace no permita salir de la carpeta autorizada.
export async function fileWithin(root: string, requested: string): Promise<string | null> {
  const candidate = resolve(root, requested);
  if (!isInside(root, candidate)) return null;
  try {
    const [actualRoot, actualFile] = await Promise.all([realpath(root), realpath(candidate)]);
    if (!isInside(actualRoot, actualFile)) return null;
    return (await stat(actualFile)).isFile() ? actualFile : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
