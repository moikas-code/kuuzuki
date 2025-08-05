// Safe JSON parsing utilities with proper error handling

export class JsonParseError extends Error {
  constructor(message: string, public readonly originalError: Error) {
    super(message);
    this.name = 'JsonParseError';
  }
}

/**
 * Safely parse JSON with proper error handling
 */
export function safeJsonParse<T = unknown>(
  text: string,
  context?: string
): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = context 
      ? `Failed to parse JSON in ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`
      : `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    throw new JsonParseError(message, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Safely parse JSON with a fallback value
 */
export function safeJsonParseWithFallback<T>(
  text: string,
  fallback: T,
  context?: string
): T {
  try {
    return safeJsonParse<T>(text, context);
  } catch (error) {
    // Log the error but return fallback
    console.warn(`JSON parse failed, using fallback:`, error);
    return fallback;
  }
}

/**
 * Validate and parse JSON with schema validation
 */
export function parseJsonWithValidation<T>(
  text: string,
  validator: (value: unknown) => value is T,
  context?: string
): T {
  const parsed = safeJsonParse(text, context);
  
  if (!validator(parsed)) {
    throw new JsonParseError(
      `JSON validation failed${context ? ` in ${context}` : ''}`,
      new Error('Parsed JSON does not match expected schema')
    );
  }
  
  return parsed;
}

/**
 * Type guard for checking if a value is a valid JSON object
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for checking if a value is a valid JSON array
 */
export function isJsonArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
