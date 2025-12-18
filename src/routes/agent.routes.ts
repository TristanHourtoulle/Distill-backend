import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { AnalysisService } from '../services/analysis.service.js'

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
