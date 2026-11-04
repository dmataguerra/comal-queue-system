import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export function crearAperturaManual(opciones: {
  origen: string;
  cache: string;
  abrir: (ruta: string) => Promise<string>;
}) {
  // Compartir la apertura pendiente evita abrir dos lectores al pulsar varias veces.
  let pendiente: Promise<void> | undefined;
  const abrir = async () => {
    let pdf: Buffer;
    try {
      pdf = await readFile(opciones.origen);
    } catch {
      throw new Error(
        'No se encontró el manual PDF. Reinstala la aplicación o consulta al responsable.',
      );
    }
    if (pdf.subarray(0, 5).toString() !== '%PDF-')
      throw new Error('El manual PDF está incompleto. Consulta al responsable.');
    const hash = createHash('sha256').update(pdf).digest('hex');
    const destino = join(opciones.cache, `manual-usuario-0.4.0-${hash.slice(0, 16)}.pdf`);
    await mkdir(opciones.cache, { recursive: true });
    const anterior = await readFile(destino).catch(() => null);
    if (!anterior?.equals(pdf)) await writeFile(destino, pdf);
    const error = await opciones.abrir(destino);
    if (error)
      throw new Error(
        'No se pudo abrir el manual PDF. Comprueba que Windows tenga un lector de PDF.',
      );
  };
  return () => {
    if (!pendiente)
      pendiente = abrir().finally(() => {
        pendiente = undefined;
      });
    return pendiente;
  };
}
