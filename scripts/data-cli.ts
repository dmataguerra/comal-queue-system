import { createBackup, restoreBackup } from '../main/backup.js';
const [action, source, destination, confirmation] = process.argv.slice(2);
try {
  if (action === 'backup' && source && destination) {
    console.log(`Respaldo creado: ${createBackup(source, destination)}`);
  } else if (action === 'restore' && source && destination) {
    const previous = restoreBackup(source, destination, confirmation === '--app-cerrada');
    console.log(`Respaldo restaurado en ${destination}.`);
    if (previous) console.log(`Datos anteriores conservados en ${previous}.`);
  } else {
    throw new Error(
      'Uso: tsx scripts/data-cli.ts backup <datos> <destino> | restore <respaldo> <datos> --app-cerrada',
    );
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
