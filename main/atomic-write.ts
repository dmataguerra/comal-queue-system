import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs';
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const transient = new Set(['EPERM', 'EBUSY', 'EACCES']);
export function renameWithRetries(
  source: string,
  destination: string,
  options: {
    renombrar?: typeof renameSync;
    esperar?: (ms: number) => void;
  } = {},
) {
  for (let attempt = 1; ; attempt++) {
    try {
      (options.renombrar ?? renameSync)(source, destination);
      return;
    } catch (error) {
      if (attempt >= 4 || !transient.has((error as NodeJS.ErrnoException).code ?? '')) throw error;
      (options.esperar ?? sleep)(25 * attempt);
    }
  }
}
export function writeJsonAtomic(
  filePath: string,
  data: unknown,
  indent?: number,
  options: {
    renombrar?: typeof renameSync;
    esperar?: (ms: number) => void;
  } = {},
): void {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let created = false;
  try {
    const fd = openSync(tempPath, 'wx');
    created = true;
    try {
      writeFileSync(fd, `${JSON.stringify(data, null, indent)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameWithRetries(tempPath, filePath, options);
  } finally {
    if (created) rmSync(tempPath, { force: true });
  }
}
