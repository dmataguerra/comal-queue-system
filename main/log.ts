import { appendFileSync } from 'node:fs';

export type Registrar = (mensaje: string) => void;

/** Registro de una línea por evento en turnero.log (CU-04 2b, CU-06 1a). Nunca lanza. */
export function crearRegistro(ruta: string): Registrar {
  return (mensaje) => {
    const linea = `${new Date().toISOString()} ${mensaje}`;
    console.warn(linea);
    try { appendFileSync(ruta, `${linea}\n`); } catch { /* el log nunca debe tumbar la app */ }
  };
}
