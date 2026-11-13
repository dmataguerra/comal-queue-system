export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogContext = Record<string, unknown>;
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Returns a logger that tags every entry with the given component name. */
  child(component: string): Logger;
}
export const isLogLevel = (value: unknown): value is LogLevel =>
  LOG_LEVELS.includes(value as LogLevel);
export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child: () => silentLogger,
};
/** Builds a logger over a plain sink. Useful for tests and adapters. */
export function loggerFromSink(
  sink: (
    level: LogLevel,
    message: string,
    context: LogContext | undefined,
    component: string,
  ) => void,
  component = 'main',
): Logger {
  const at =
    (level: LogLevel) =>
    (message: string, context?: LogContext): void =>
      sink(level, message, context, component);
  return {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    child: (name) => loggerFromSink(sink, name),
  };
}
/** Logger that forwards only the message text; handy for assertions in tests. */
export const messageLogger = (sink: (message: string) => void): Logger =>
  loggerFromSink((_level, message) => sink(message));
