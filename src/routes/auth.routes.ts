import { Hono } from 'hono'
import { auth } from '../lib/auth.js'

const app = new Hono()

// Mount all BetterAuth routes under /api/auth
app.on(['GET', 'POST'], '/*', (c) => {
  return auth.handler(c.req.raw)
})

export default app
