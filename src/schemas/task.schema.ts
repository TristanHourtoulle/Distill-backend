import { z } from 'zod'

/**
 * Task Zod Schemas
 * Validation for task-related API endpoints
 */

// Enums matching Prisma schema
export const taskTypeSchema = z.enum(['feature', 'bugfix', 'modification', 'documentation', 'refactor'])
export const taskComplexitySchema = z.enum(['simple', 'moderate', 'critical'])
export const taskStatusSchema = z.enum(['pending', 'analyzing', 'analyzed', 'exported', 'archived'])

/**
 * Schema for task ID parameter
 */
export const taskIdSchema = z.object({
  id: z.string().uuid(),
})

/**
 * Schema for updating a task
 */
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  type: taskTypeSchema.optional(),
  complexity: taskComplexitySchema.optional(),
  status: taskStatusSchema.optional(),
  priority: z.number().int().min(0).optional(),
  estimatedFilesCount: z.number().int().min(0).optional(),
  impactedFilesPreview: z.array(z.string()).optional(),
})

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

/**
 * Schema for task list query parameters
 */
export const taskListQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
  status: taskStatusSchema.optional(),
  complexity: taskComplexitySchema.optional(),
  type: taskTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export type TaskListQuery = z.infer<typeof taskListQuerySchema>

/**
 * Schema for bulk status update
 */
export const bulkStatusUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
  status: taskStatusSchema,
})

export type BulkStatusUpdateInput = z.infer<typeof bulkStatusUpdateSchema>
