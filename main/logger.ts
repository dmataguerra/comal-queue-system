import { appendFileSync, existsSync, renameSync, statSync, unlinkSync } from 'node:fs';
import {
  LOG_LEVELS,
  loggerFromSink,
  type LogContext,
  type Logger,
  type LogLevel,
} from '../shared/logging.js';
export interface LoggerOptions {
  version?: string;
  component?: string;
  /** Entries below this level are not written. */
  minLevel?: LogLevel;
  maxBytes?: number;
  maxFiles?: number;
  /** Identical consecutive entries inside this window are collapsed into one summary line. */
  repeatWindowMs?: number;
  now?: () => Date;
}
export interface LogEntry {
  time: string;
  level: LogLevel;
  component: string;
  version: string;
  session: string;
  message: string;
  context?: LogContext;
}
export interface FileLogger extends Logger {
  /** Most recent entry written at `error` level, for diagnostics. */
  lastError(): { time: string; message: string } | null;
}
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_MESSAGE = 500;
function safeContext(context: LogContext | undefined): LogContext | undefined {
  if (!context || !Object.keys(context).length) return undefined;
  try {
    return JSON.parse(
      JSON.stringify(context, (_key, value: unknown) =>
        value instanceof Error ? { name: value.name, message: value.message } : value,
      ),
    ) as LogContext;
  } catch {
    return { unserializable: true };
  }
}
/**
 * JSON-lines file logger with size rotation (`file`, `file.1` … `file.N`).
 * Writes are synchronous so an entry is on disk before the process can exit, and a
 * logging failure never throws into the caller.
 */
export function createLogger(path: string, options: LoggerOptions = {}): FileLogger {
  const now = options.now ?? (() => new Date());
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const maxFiles = options.maxFiles ?? MAX_FILES;
  const repeatWindowMs = options.repeatWindowMs ?? 30000;
  const minLevel = LOG_LEVELS.indexOf(options.minLevel ?? 'debug');
  const session = `${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  let previousKey = '';
  let previousAt = 0;
  let suppressed = 0;
  let lastError: { time: string; message: string } | null = null;
  function rotate(incomingBytes: number) {
    if (maxBytes <= 0 || !existsSync(path) || statSync(path).size + incomingBytes <= maxBytes)
      return;
    if (maxFiles <= 0) {
      unlinkSync(path);
      return;
    }
    const oldest = `${path}.${maxFiles}`;
    if (existsSync(oldest)) unlinkSync(oldest);
    for (let n = maxFiles - 1; n >= 1; n--) {
      if (existsSync(`${path}.${n}`)) renameSync(`${path}.${n}`, `${path}.${n + 1}`);
    }
    renameSync(path, `${path}.1`);
  }
  function write(entry: LogEntry) {
    const line = JSON.stringify(entry) + '\n';
    try {
      rotate(Buffer.byteLength(line));
      appendFileSync(path, line);
    } catch {
      try {
        console.warn(line.trimEnd());
      } catch {
        /* A logging failure must never stop the queue. */
      }
    }
  }
  function log(
    level: LogLevel,
    rawMessage: string,
    context: LogContext | undefined,
    component: string,
  ) {
    if (LOG_LEVELS.indexOf(level) < minLevel) return;
    const date = now();
    const message = String(rawMessage)
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, MAX_MESSAGE);
    const base = {
      time: date.toISOString(),
      component,
      version: options.version ?? 'unknown',
      session,
    };
    const key = `${level}|${component}|${message}`;
    if (key === previousKey && date.getTime() - previousAt < repeatWindowMs) {
      suppressed++;
      return;
    }
    if (suppressed)
      write({
        ...base,
        level: 'info',
        component: 'logger',
        message: `Previous entry repeated ${suppressed} times.`,
        context: { repeated: suppressed },
      });
    suppressed = 0;
    previousKey = key;
    previousAt = date.getTime();
    if (level === 'error') lastError = { time: base.time, message: message.slice(0, 200) };
    const cleanContext = safeContext(context);
    write({ ...base, level, message, ...(cleanContext ? { context: cleanContext } : {}) });
  }
  return { ...loggerFromSink(log, options.component ?? 'main'), lastError: () => lastError };
}
