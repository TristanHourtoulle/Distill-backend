import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { MeetingService } from '../services/meeting.service.js'
import {
  createMeetingSchema,
  updateMeetingSchema,
  meetingIdSchema,
  meetingListQuerySchema,
} from '../schemas/meeting.schema.js'

const app = new Hono()

// All routes require authentication
app.use('*', authMiddleware)

// ============================================
// Meeting CRUD
// ============================================

/**
 * GET /meetings
 * List all meetings for the authenticated user
 * Optional query parameters: projectId, status, limit, offset
 */
app.get('/', async (c) => {
  const userId = c.get('userId')

  // Parse query parameters
  const query = meetingListQuerySchema.parse({
    projectId: c.req.query('projectId'),
    status: c.req.query('status'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  const result = await MeetingService.list(userId, query)

  return c.json({
    data: result.meetings,
    meta: {
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    },
  })
})

/**
 * GET /meetings/:id
 * Get a specific meeting with its tasks
 */
app.get('/:id', zValidator('param', meetingIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const meeting = await MeetingService.getById(id, userId)
  return c.json({ data: meeting })
})

/**
 * POST /meetings
 * Create a new meeting
 */
app.post('/', zValidator('json', createMeetingSchema), async (c) => {
  const userId = c.get('userId')
  const input = c.req.valid('json')
  const meeting = await MeetingService.create(userId, input)
  return c.json({ data: meeting }, 201)
})

/**
 * PATCH /meetings/:id
 * Update a meeting
 */
app.patch(
  '/:id',
  zValidator('param', meetingIdSchema),
  zValidator('json', updateMeetingSchema),
  async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    const meeting = await MeetingService.update(id, userId, input)
    return c.json({ data: meeting })
  }
)

/**
 * DELETE /meetings/:id
 * Delete a meeting
 */
app.delete('/:id', zValidator('param', meetingIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  await MeetingService.delete(id, userId)
  return c.body(null, 204)
})

// ============================================
// Meeting Tasks
// ============================================

/**
 * GET /meetings/:id/tasks
 * Get all tasks for a specific meeting
 */
app.get('/:id/tasks', zValidator('param', meetingIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  // This uses getById which returns tasks
  const meeting = await MeetingService.getById(id, userId)

  return c.json({ data: meeting.tasks })
})

export default app
