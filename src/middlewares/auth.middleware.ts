import { Context, Next } from 'hono'
import { auth } from '../lib/auth.js'
import { UnauthorizedError } from '../lib/errors.js'

// Extend Hono context with user info
declare module 'hono' {
  interface ContextVariableMap {
    userId: string
    userEmail: string
  }
}

/**
 * Authentication middleware that validates the session
 * and adds user info to the context
 */
export async function authMiddleware(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session?.user) {
    throw new UnauthorizedError('Authentication required')
  }

  // Set user info in context for use in route handlers
  c.set('userId', session.user.id)
  c.set('userEmail', session.user.email)

  await next()
}
