// Type guards and utilities for better error handling

export interface NodeError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  path?: string;
}

export function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error;
}

export function isFileNotFoundError(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT';
}

export function isPermissionError(error: unknown): boolean {
  return isNodeError(error) && (error.code === 'EACCES' || error.code === 'EPERM');
}

export function isNetworkError(error: unknown): boolean {
  return isNodeError(error) && (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNRESET'
  );
}

export function getErrorCode(error: unknown): string | undefined {
  return isNodeError(error) ? error.code : undefined;
}
