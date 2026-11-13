export const ERROR_CODES = [
  'AUDIO_QUEUE_FULL',
  'STATE_SAVE_FAILED',
  'DAY_ROLLOVER_FAILED',
  'DISK_FULL',
  'CONFIG_SAVE_FAILED',
  'CONTENT_FOLDER_UNAVAILABLE',
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
/** Wire shape of a failure crossing IPC or HTTP. `message` is user-facing Spanish text. */
export interface ApiError {
  code: ErrorCode;
  message: string;
}
export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };
export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}
const isErrorCode = (value: unknown): value is ErrorCode =>
  ERROR_CODES.includes(value as ErrorCode);
/** Reads the code of an AppError or of an ApiError-shaped value; anything else is INTERNAL. */
export function errorCodeOf(error: unknown): ErrorCode {
  if (error && typeof error === 'object' && 'code' in error && isErrorCode(error.code))
    return error.code;
  return 'INTERNAL';
}
export function errorMessageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
    return error.message;
  return String(error);
}
export const toApiError = (error: unknown): ApiError => ({
  code: errorCodeOf(error),
  message: errorMessageOf(error),
});
