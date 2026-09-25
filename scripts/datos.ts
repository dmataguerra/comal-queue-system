import { crearRespaldo, restaurarRespaldo } from '../main/respaldo.js';

const [accion, origen, destino, confirmacion] = process.argv.slice(2);

try {
  if (accion === 'backup' && origen && destino) {
    console.log(`Respaldo creado: ${crearRespaldo(origen, destino)}`);
  } else if (accion === 'restore' && origen && destino) {
    const anterior = restaurarRespaldo(origen, destino, confirmacion === '--app-cerrada');
    console.log(`Respaldo restaurado en ${destino}.`);
    if (anterior) console.log(`Datos anteriores conservados en ${anterior}.`);
  } else {
    throw new Error(
      'Uso: tsx scripts/datos.ts backup <datos> <destino> | restore <respaldo> <datos> --app-cerrada',
    );
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
