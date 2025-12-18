import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import 'dotenv/config'

import authRoutes from './routes/auth.routes.js'
import projectsRoutes from './routes/projects.routes.js'
import jobsRoutes from './routes/jobs.routes.js'
import githubRoutes from './routes/github.routes.js'
import meetingsRoutes from './routes/meetings.routes.js'
import tasksRoutes from './routes/tasks.routes.js'
import agentRoutes from './routes/agent.routes.js'
import exportRoutes from './routes/export.routes.js'
import { JobQueueService } from './services/job-queue.service.js'

const app = new Hono()

// Global error handler
app.onError((err, c) => {
  // Check if it's an AppError-like object (has statusCode and code)
  if (
    err !== null &&
    typeof err === 'object' &&
    'statusCode' in err &&
    'code' in err
  ) {
    const appErr = err as { message?: string; statusCode: number; code: string }
    return c.json(
      { error: appErr.message ?? 'Error', code: appErr.code },
      appErr.statusCode as 400 | 401 | 403 | 404 | 409 | 500 | 502
    )
  }

  // Log unexpected errors
  console.error('Unexpected error:', err)

  return c.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    500
  )
})

// Global middlewares
app.use('*', logger())
app.use('*', cors({
  origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  credentials: true,
}))

// Mount routes
app.route('/api/auth', authRoutes)
app.route('/api/projects', projectsRoutes)
app.route('/api/jobs', jobsRoutes)
app.route('/api/github', githubRoutes)
app.route('/api/meetings', meetingsRoutes)
app.route('/api/tasks', tasksRoutes)
app.route('/api/agent', agentRoutes)
app.route('/api/export', exportRoutes)

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

  // Start the job queue worker
  JobQueueService.startWorker()
  console.log('Job queue worker started')
})

export default app
