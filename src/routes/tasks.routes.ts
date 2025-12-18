import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { TaskService } from '../services/task.service.js'
import { ComplexityService } from '../services/complexity.service.js'
import {
  taskIdSchema,
  updateTaskSchema,
  taskListQuerySchema,
  bulkStatusUpdateSchema,
} from '../schemas/task.schema.js'

const app = new Hono()

// All routes require authentication
app.use('*', authMiddleware)

// ============================================
// Task CRUD
// ============================================

/**
 * GET /tasks
 * List all tasks for the authenticated user
 * Optional query parameters: projectId, meetingId, status, complexity, type, limit, offset
 */
app.get('/', async (c) => {
  const userId = c.get('userId')

  // Parse query parameters
  const query = taskListQuerySchema.parse({
    projectId: c.req.query('projectId'),
    meetingId: c.req.query('meetingId'),
    status: c.req.query('status'),
    complexity: c.req.query('complexity'),
    type: c.req.query('type'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  const result = await TaskService.list(userId, query)

  return c.json({
    data: result.tasks,
    meta: {
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    },
  })
})

/**
 * GET /tasks/:id
 * Get a specific task with analyses and exports
 */
app.get('/:id', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const task = await TaskService.getById(id, userId)
  return c.json({ data: task })
})

/**
 * PATCH /tasks/:id
 * Update a task
 */
app.patch(
  '/:id',
  zValidator('param', taskIdSchema),
  zValidator('json', updateTaskSchema),
  async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    const task = await TaskService.update(id, userId, input)
    return c.json({ data: task })
  }
)

/**
 * DELETE /tasks/:id
 * Delete a task
 */
app.delete('/:id', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  await TaskService.delete(id, userId)
  return c.body(null, 204)
})

// ============================================
// Bulk Operations
// ============================================

/**
 * POST /tasks/bulk/status
 * Bulk update task status
 */
app.post('/bulk/status', zValidator('json', bulkStatusUpdateSchema), async (c) => {
  const userId = c.get('userId')
  const { taskIds, status } = c.req.valid('json')
  const count = await TaskService.bulkUpdateStatus(taskIds, status, userId)
  return c.json({
    data: { updated: count },
    message: `Updated ${count} tasks`,
  })
})

// ============================================
// Complexity Estimation
// ============================================

/**
 * POST /tasks/:id/estimate
 * Estimate complexity for a task
 */
app.post('/:id/estimate', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const estimation = await ComplexityService.estimateTask(id, userId)

  return c.json({
    data: estimation,
    message: `Task estimated as ${estimation.complexity}`,
  })
})

// ============================================
// Statistics
// ============================================

/**
 * GET /tasks/stats/:projectId
 * Get task statistics for a project
 */
app.get('/stats/:projectId', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('projectId')

  const stats = await TaskService.getProjectStats(projectId, userId)

  return c.json({ data: stats })
})

/**
 * GET /tasks/complexity/:projectId
 * Get complexity distribution for a project
 */
app.get('/complexity/:projectId', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('projectId')

  const stats = await ComplexityService.getProjectComplexityStats(projectId, userId)

  return c.json({ data: stats })
})

export default app
