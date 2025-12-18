import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { JobQueueService } from '../services/job-queue.service.js'
import { NotFoundError } from '../lib/errors.js'

const app = new Hono()

// All routes require authentication
app.use('*', authMiddleware)

/**
 * Schema for job ID parameter
 */
const jobIdSchema = z.object({
  id: z.string().uuid('Invalid job ID'),
})

/**
 * GET /jobs
 * List all jobs for the authenticated user
 */
app.get('/', async (c) => {
  const userId = c.get('userId')

  // Parse query parameters
  const type = c.req.query('type') as 'indexation' | 'analysis' | 'export' | undefined
  const status = c.req.query('status') as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | undefined

  const jobs = JobQueueService.getJobs({
    userId,
    type,
    status,
  })

  return c.json({
    data: jobs.map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      error: job.error,
      attempts: job.attempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    })),
  })
})

/**
 * GET /jobs/stats
 * Get job statistics for the authenticated user
 */
app.get('/stats', async (c) => {
  const userId = c.get('userId')
  const stats = JobQueueService.getStats({ userId })
  return c.json({ data: stats })
})

/**
 * GET /jobs/:id
 * Get a specific job
 */
app.get('/:id', zValidator('param', jobIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const job = JobQueueService.getJob(id)

  if (!job) {
    throw new NotFoundError('Job not found')
  }

  // Verify ownership
  if (job.userId !== userId) {
    throw new NotFoundError('Job not found')
  }

  return c.json({
    data: {
      id: job.id,
      type: job.type,
      status: job.status,
      priority: job.priority,
      progress: job.progress,
      result: job.result,
      error: job.error,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    },
  })
})

/**
 * DELETE /jobs/:id
 * Cancel a pending job
 */
app.delete('/:id', zValidator('param', jobIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const job = JobQueueService.getJob(id)

  if (!job) {
    throw new NotFoundError('Job not found')
  }

  // Verify ownership
  if (job.userId !== userId) {
    throw new NotFoundError('Job not found')
  }

  const cancelled = JobQueueService.cancelJob(id)

  if (!cancelled) {
    return c.json({ error: 'Cannot cancel this job (already running or completed)' }, 400)
  }

  return c.json({ message: 'Job cancelled' })
})

export default app
