import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { AnalysisService } from '../services/analysis.service.js'
import { createSSEResponse, SSEWriter, createKeepAlive } from '../lib/sse.js'
import type { StreamEvent } from '../types/streaming.types.js'
import { db } from '../lib/db.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js'

const app = new Hono()

// All routes require authentication
app.use('*', authMiddleware)

// ============================================
// Schemas
// ============================================

const taskIdSchema = z.object({
  taskId: z.string().uuid(),
})

const analysisIdSchema = z.object({
  id: z.string().uuid(),
})

const projectIdSchema = z.object({
  projectId: z.string().uuid(),
})

// ============================================
// Analysis Routes
// ============================================

/**
 * POST /agent/analyze/:taskId
 * Start analysis for a task
 */
app.post('/analyze/:taskId', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { taskId } = c.req.valid('param')

  const { analysisId, result, stats } = await AnalysisService.startAnalysis(
    taskId,
    userId
  )

  return c.json({
    data: {
      analysisId,
      summary: result.summary,
      filesToCreate: result.filesToCreate.length,
      filesToModify: result.filesToModify.length,
      implementationSteps: result.implementationSteps.length,
      risks: result.risks.length,
      stats,
    },
    message: 'Analysis completed successfully',
  })
})

/**
 * GET /agent/analyze/:taskId/stream
 * Start analysis with real-time SSE streaming
 *
 * Query params:
 * - includeToolResults: boolean (default: true) - Include tool execution results
 * - includeThinking: boolean (default: false) - Include AI thinking content
 *
 * Events emitted:
 * - phase: Current analysis phase (initializing, loading, analyzing, tool_execution, parsing, complete)
 * - tool_call: When AI calls a tool (read_file, list_dir, etc.)
 * - tool_result: Result of a tool call
 * - thinking: AI thinking/reasoning content (if includeThinking=true)
 * - progress: Stats update (iterations, tokens, duration)
 * - file_discovered: When a file to create/modify is identified
 * - result: Final analysis result
 * - error: If an error occurs
 */
app.get('/analyze/:taskId/stream', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { taskId } = c.req.valid('param')

  // Parse query options
  const includeToolResults = c.req.query('includeToolResults') !== 'false'
  const includeThinking = c.req.query('includeThinking') === 'true'

  // Pre-validate task BEFORE starting SSE stream to avoid infinite reconnection loops
  // If validation fails, return a regular HTTP error (not SSE)
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        select: { userId: true },
      },
    },
  })

  if (!task) {
    throw new NotFoundError('Task not found')
  }

  if (task.project.userId !== userId) {
    throw new ForbiddenError('Access denied')
  }

  if (task.status === 'analyzing') {
    throw new ValidationError('Task is already being analyzed')
  }

  // Task is valid, start SSE stream
  return createSSEResponse(async (writer: SSEWriter) => {
    // Set up keep-alive
    const stopKeepAlive = createKeepAlive(writer)

    try {
      // Run analysis with streaming
      await AnalysisService.startAnalysis(
        taskId,
        userId,
        undefined, // Use default config
        undefined, // No legacy progress callback
        {
          onStreamEvent: async (event: StreamEvent) => {
            await writer.sendEvent(event)
          },
          includeToolResults,
          includeThinking,
        }
      )
    } catch (error) {
      // Emit error event
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = error instanceof Error && 'code' in error
        ? String((error as { code?: string }).code)
        : 'UNKNOWN_ERROR'

      await writer.sendEvent({
        type: 'error',
        timestamp: Date.now(),
        code: errorCode,
        message: errorMessage,
        recoverable: false,
      })
    } finally {
      // Clean up
      stopKeepAlive()
      await writer.close()
    }
  })
})

/**
 * GET /agent/analysis/:id
 * Get analysis details by ID
 */
app.get('/analysis/:id', zValidator('param', analysisIdSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const analysis = await AnalysisService.getAnalysis(id, userId)

  return c.json({ data: analysis })
})

/**
 * POST /agent/task/:taskId/reset
 * Reset a stuck task (from 'analyzing' back to 'pending')
 */
app.post('/task/:taskId/reset', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { taskId } = c.req.valid('param')

  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        select: { userId: true },
      },
    },
  })

  if (!task) {
    throw new NotFoundError('Task not found')
  }

  if (task.project.userId !== userId) {
    throw new ForbiddenError('Access denied')
  }

  if (task.status !== 'analyzing') {
    return c.json({
      data: { status: task.status },
      message: 'Task is not stuck (not in analyzing state)',
    })
  }

  const updated = await db.task.update({
    where: { id: taskId },
    data: { status: 'pending' },
    select: { id: true, status: true },
  })

  return c.json({
    data: updated,
    message: 'Task reset to pending',
  })
})

/**
 * GET /agent/task/:taskId/analysis
 * Get latest analysis for a task
 */
app.get('/task/:taskId/analysis', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { taskId } = c.req.valid('param')

  const analysis = await AnalysisService.getTaskAnalysis(taskId, userId)

  if (!analysis) {
    return c.json({ data: null, message: 'No analysis found for this task' })
  }

  return c.json({ data: analysis })
})

/**
 * GET /agent/task/:taskId/analyses
 * List all analyses for a task
 */
app.get('/task/:taskId/analyses', zValidator('param', taskIdSchema), async (c) => {
  const userId = c.get('userId')
  const { taskId } = c.req.valid('param')

  const analyses = await AnalysisService.listTaskAnalyses(taskId, userId)

  return c.json({ data: analyses })
})

/**
 * GET /agent/project/:projectId/stats
 * Get analysis statistics for a project
 */
app.get('/project/:projectId/stats', zValidator('param', projectIdSchema), async (c) => {
  const userId = c.get('userId')
  const { projectId } = c.req.valid('param')

  const stats = await AnalysisService.getProjectAnalysisStats(projectId, userId)

  return c.json({ data: stats })
})

export default app
