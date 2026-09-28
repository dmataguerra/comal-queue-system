import { rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(root, 'build');
if (dirname(output) !== root || basename(output) !== 'build')
  throw new Error('Unexpected TypeScript build directory.');
rmSync(output, { recursive: true, force: true });
