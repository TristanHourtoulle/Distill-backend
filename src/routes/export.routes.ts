import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { ExportService } from '../services/export.service.js'

const app = new Hono()

// All routes require authentication
app.use('*', authMiddleware)

// ============================================
// Schemas
// ============================================

const taskIdSchema = z.object({
  taskId: z.string().uuid(),
})

const exportIdSchema = z.object({
  exportId: z.string().uuid(),
})

const projectIdSchema = z.object({
  projectId: z.string().uuid(),
})

const gitHubExportOptionsSchema = z.object({
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.number().int().positive().optional(),
})

const bulkExportSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
  options: gitHubExportOptionsSchema.optional(),
})

// ============================================
// Export Routes
// ============================================

/**
 * POST /export/github/:taskId
 * Export a single task to GitHub Issues
 */
app.post(
  '/github/:taskId',
  zValidator('param', taskIdSchema),
  zValidator('json', gitHubExportOptionsSchema.optional()),
  async (c) => {
    const userId = c.get('userId')
    const { taskId } = c.req.valid('param')
    const options = c.req.valid('json') ?? {}

    const result = await ExportService.exportToGitHubIssue(taskId, userId, options)

    return c.json({
      data: result,
      message: 'Task exported to GitHub Issues successfully',
    })
  }
)

/**
 * POST /export/github/bulk
 * Bulk export tasks to GitHub Issues
 */
app.post('/github/bulk', zValidator('json', bulkExportSchema), async (c) => {
  const userId = c.get('userId')
  const { taskIds, options } = c.req.valid('json')

  const result = await ExportService.bulkExportToGitHubIssues(userId, {
    taskIds,
    options,
  })

  return c.json({
    data: result,
    message: `Exported ${result.successful}/${result.total} tasks successfully`,
  })
})

/**
 * GET /export/task/:taskId
 * Get export history for a task
 */
app.get('/task/:taskId', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { taskId } = c.req.valid('param')

  const exports = await ExportService.getTaskExports(taskId, userId)

  return c.json({ data: exports })
})

/**
 * GET /export/:exportId
 * Get export details by ID
 */
app.get('/:exportId', zValidator('param', exportIdSchema), async (c) => {
  const userId = c.get('userId')
  const { exportId } = c.req.valid('param')

  const taskExport = await ExportService.getExport(exportId, userId)

  return c.json({ data: taskExport })
})

/**
 * GET /export/project/:projectId/stats
 * Get export statistics for a project
 */
app.get('/project/:projectId/stats', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { projectId } = c.req.valid('param')

  const stats = await ExportService.getProjectExportStats(projectId, userId)

  return c.json({ data: stats })
})

/**
 * POST /export/setup/github
 * Setup GitHub Issues integration for the user
 */
app.post('/setup/github', async (c) => {
  const userId = c.get('userId')

  const integrationId = await ExportService.ensureGitHubIntegration(userId)

  return c.json({
    data: { integrationId },
    message: 'GitHub Issues integration configured successfully',
  })
})

export default app
