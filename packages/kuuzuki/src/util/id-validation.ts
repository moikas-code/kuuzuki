/**
 * ID validation utilities to prevent path traversal attacks
 */

/**
 * Validates a session ID to ensure it's safe for file system operations
 * @param id The session ID to validate
 * @returns The validated ID
 * @throws Error if the ID is invalid
 */
export function validateSessionID(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid session ID: must be a non-empty string')
  }

  // Check for path traversal attempts
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error('Invalid session ID: contains illegal characters')
  }

  // Check for other dangerous characters
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('Invalid session ID: must contain only alphanumeric characters, underscores, and hyphens')
  }

  // Check length limits
  if (id.length > 100) {
    throw new Error('Invalid session ID: too long')
  }

  return id
}

/**
 * Validates a message ID to ensure it's safe for file system operations
 * @param id The message ID to validate
 * @returns The validated ID
 * @throws Error if the ID is invalid
 */
export function validateMessageID(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid message ID: must be a non-empty string')
  }

  // Check for path traversal attempts
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error('Invalid message ID: contains illegal characters')
  }

  // Check for other dangerous characters
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('Invalid message ID: must contain only alphanumeric characters, underscores, and hyphens')
  }

  // Check length limits
  if (id.length > 100) {
    throw new Error('Invalid message ID: too long')
  }

  return id
}