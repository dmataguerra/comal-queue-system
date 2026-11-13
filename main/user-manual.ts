import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export function createManualOpener(options: {
  origen: string;
  cache: string;
  abrir: (filePath: string) => Promise<string>;
}) {
  // Sharing the pending open avoids launching two readers when clicked repeatedly.
  let pending: Promise<void> | undefined;
  const open = async () => {
    let pdf: Buffer;
    try {
      pdf = await readFile(options.origen);
    } catch {
      throw new Error(
        'No se encontró el manual PDF. Reinstala la aplicación o consulta al responsable.',
      );
    }
    if (pdf.subarray(0, 5).toString() !== '%PDF-')
      throw new Error('El manual PDF está incompleto. Consulta al responsable.');
    const hash = createHash('sha256').update(pdf).digest('hex');
    const destination = join(options.cache, `manual-usuario-0.4.0-${hash.slice(0, 16)}.pdf`);
    await mkdir(options.cache, { recursive: true });
    const previous = await readFile(destination).catch(() => null);
    if (!previous?.equals(pdf)) await writeFile(destination, pdf);
    const error = await options.abrir(destination);
    if (error)
      throw new Error(
        'No se pudo abrir el manual PDF. Comprueba que Windows tenga un lector de PDF.',
      );
  };
  return () => {
    if (!pending)
      pending = open().finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
