import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { ProjectService } from '../services/project.service.js'
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdSchema,
  createProjectRuleSchema,
  updateProjectRuleSchema,
} from '../schemas/project.schema.js'

const app = new Hono()

// All routes require authentication
app.use('*', authMiddleware)

// ============================================
// Project CRUD
// ============================================

/**
 * GET /projects
 * List all projects for the authenticated user
 */
app.get('/', async (c) => {
  const userId = c.get('userId')
  const projects = await ProjectService.listByUser(userId)
  return c.json({ data: projects })
})

/**
 * GET /projects/:id
 * Get a specific project
 */
app.get('/:id', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const project = await ProjectService.getById(id, userId)
  return c.json({ data: project })
})

/**
 * POST /projects
 * Create a new project
 */
app.post('/', zValidator('json', createProjectSchema), async (c) => {
  const userId = c.get('userId')
  const input = c.req.valid('json')
  const project = await ProjectService.create(userId, input)
  return c.json({ data: project }, 201)
})

/**
 * PATCH /projects/:id
 * Update a project
 */
app.patch('/:id', zValidator('param', projectIdSchema), zValidator('json', updateProjectSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  const project = await ProjectService.update(id, userId, input)
  return c.json({ data: project })
})

/**
 * DELETE /projects/:id
 * Delete a project
 */
app.delete('/:id', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  await ProjectService.delete(id, userId)
  return c.body(null, 204)
})

// ============================================
// Project Branches
// ============================================

/**
 * GET /projects/:id/branches
 * List available branches for a project
 */
app.get('/:id/branches', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const branches = await ProjectService.listBranches(id, userId)
  return c.json({ data: branches })
})

// ============================================
// Project Indexation
// ============================================

/**
 * POST /projects/:id/index
 * Trigger re-indexation of a project (queues a background job)
 */
app.post('/:id/index', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  // Get optional priority from query/body
  const priority = (c.req.query('priority') ?? 'normal') as 'low' | 'normal' | 'high'

  const result = await ProjectService.triggerIndexation(id, userId, priority)
  return c.json({ data: result, message: 'Indexation job queued' })
})

/**
 * GET /projects/:id/job
 * Get the current indexation job status for a project
 */
app.get('/:id/job', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const job = await ProjectService.getIndexJobStatus(id, userId)
  if (!job) {
    return c.json({ data: null, message: 'No indexation job found' })
  }
  return c.json({ data: job })
})

/**
 * GET /projects/:id/status
 * Get detailed indexation status of a project
 */
app.get('/:id/status', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const status = await ProjectService.getIndexStatus(id, userId)
  return c.json({ data: status })
})

/**
 * GET /projects/:id/files
 * Get indexed files for a project
 */
app.get('/:id/files', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  // Parse query parameters
  const fileTypeParam = c.req.query('fileType')
  const limit = parseInt(c.req.query('limit') ?? '100', 10)
  const offset = parseInt(c.req.query('offset') ?? '0', 10)

  // Build options object conditionally to avoid undefined
  const options: { fileType?: string; limit: number; offset: number } = { limit, offset }
  if (fileTypeParam) {
    options.fileType = fileTypeParam
  }

  const result = await ProjectService.getIndexedFiles(id, userId, options)
  return c.json({
    data: result.files,
    meta: { total: result.total, limit, offset },
  })
})

// ============================================
// Project Rules
// ============================================

/**
 * GET /projects/:id/rules
 * List all rules for a project
 */
app.get('/:id/rules', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const rules = await ProjectService.listRules(id, userId)
  return c.json({ data: rules })
})

/**
 * POST /projects/:id/rules
 * Create a new rule for a project
 */
app.post(
  '/:id/rules',
  zValidator('param', projectIdSchema),
  zValidator('json', createProjectRuleSchema),
  async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    const rule = await ProjectService.createRule(id, userId, input)
    return c.json({ data: rule }, 201)
  }
)

/**
 * PATCH /projects/:id/rules/:ruleId
 * Update a rule
 */
app.patch(
  '/:id/rules/:ruleId',
  zValidator('param', projectIdSchema),
  zValidator('json', updateProjectRuleSchema),
  async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const ruleId = c.req.param('ruleId')
    const input = c.req.valid('json')
    const rule = await ProjectService.updateRule(id, ruleId, userId, input)
    return c.json({ data: rule })
  }
)

/**
 * DELETE /projects/:id/rules/:ruleId
 * Delete a rule
 */
app.delete('/:id/rules/:ruleId', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const ruleId = c.req.param('ruleId')
  await ProjectService.deleteRule(id, ruleId, userId)
  return c.body(null, 204)
})

export default app
