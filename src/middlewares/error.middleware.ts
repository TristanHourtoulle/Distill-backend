import type { Context, Next } from 'hono'
import { AppError } from '../lib/errors.js'

/**
 * Global error handling middleware
 * Catches all errors and returns a consistent JSON response
 */
export async function errorMiddleware(c: Context, next: Next): Promise<Response> {
  try {
    await next()
    return c.res
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(
        { error: error.message, code: error.code },
        error.statusCode as 400 | 401 | 403 | 404 | 409 | 500 | 502
      )
    }

    // Log unexpected errors
    console.error('Unexpected error:', error)

    return c.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      500
    )
  }
}
