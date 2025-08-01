import type { Context, Next } from "hono"
import { ErrorHandler } from "./handler"
import { isKuuzukiError } from "./types"

/**
 * Error handling middleware for Hono
 */
export function errorMiddleware() {
  return async (c: Context, next: Next) => {
    try {
      await next()
    } catch (error) {
      // Create context from request
      const context = ErrorHandler.createHttpContext(c.req)

      // Handle the error
      const kuuzukiError = ErrorHandler.handle(error, context)

      // Get appropriate HTTP status code
      const statusCode = ErrorHandler.getHttpStatusCode(kuuzukiError)

      // Format error for HTTP response
      const response = ErrorHandler.formatForHttp(kuuzukiError)

      return c.json(response, statusCode as any)
    }
  }
}

/**
 * Global error handler for Hono
 */
export function globalErrorHandler(err: Error, c: Context) {
  // Create context from request
  const context = ErrorHandler.createHttpContext(c.req)

  // Handle the error
  const kuuzukiError = ErrorHandler.handle(err, context)

  // Get appropriate HTTP status code
  const statusCode = ErrorHandler.getHttpStatusCode(kuuzukiError)

  // Format error for HTTP response
  const response = ErrorHandler.formatForHttp(kuuzukiError)

  return c.json(response, statusCode as any)
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends any[]>(handler: (...args: T) => Promise<any>) {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      // Re-throw as KuuzukiError if not already
      if (!isKuuzukiError(error)) {
        throw ErrorHandler.handle(error)
      }
      throw error
    }
  }
}

/**
 * Validation error handler for Zod validation failures
 */
export function validationErrorHandler(error: any, c: Context) {
  if (error.name === "ZodError") {
    const context = ErrorHandler.createHttpContext(c.req)
    const validationError = ErrorHandler.handle(
      new Error(`Validation failed: ${error.issues.map((i: any) => i.message).join(", ")}`),
      context,
    )

    const statusCode = ErrorHandler.getHttpStatusCode(validationError)
    const response = ErrorHandler.formatForHttp(validationError)

    return c.json(response, statusCode as any)
  }

  // Fall back to global error handler
  return globalErrorHandler(error, c)
}
