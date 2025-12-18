import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import 'dotenv/config'

import { errorMiddleware } from './middlewares/error.middleware.js'

const app = new Hono()

// Global middlewares
app.use('*', logger())
app.use('*', cors({
  origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  credentials: true,
}))
app.use('*', errorMiddleware)

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// API routes placeholder
app.get('/', (c) => {
  return c.json({
    message: 'Distill API',
    docs: '/health'
  })
})

// Start server
const port = parseInt(process.env['PORT'] ?? '4000', 10)

console.log(`Starting Distill API on port ${port}...`)

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Server running at http://localhost:${info.port}`)
})

export default app
