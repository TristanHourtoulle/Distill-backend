import { z } from 'zod'

/**
 * Schema for creating a new project
 */
export const createProjectSchema = z.object({
  githubRepoUrl: z
    .string()
    .url('Invalid URL format')
    .regex(/github\.com/, 'Must be a GitHub repository URL'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  preferredBranch: z
    .string()
    .min(1, 'Branch name is required'),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

/**
 * Schema for updating a project
 */
export const updateProjectSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  preferredBranch: z
    .string()
    .min(1, 'Branch name cannot be empty')
    .optional(),
})

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

/**
 * Schema for project ID parameter
 */
export const projectIdSchema = z.object({
  id: z.string().uuid('Invalid project ID'),
})

export type ProjectIdParam = z.infer<typeof projectIdSchema>

/**
 * Schema for creating a project rule
 */
export const createProjectRuleSchema = z.object({
  type: z.enum(['must_do', 'must_not_do', 'convention', 'pattern']),
  content: z
    .string()
    .min(1, 'Rule content is required')
    .max(1000, 'Rule content must be at most 1000 characters'),
  priority: z.number().int().min(0).default(0),
})

export type CreateProjectRuleInput = z.infer<typeof createProjectRuleSchema>

/**
 * Schema for updating a project rule
 */
export const updateProjectRuleSchema = z.object({
  content: z
    .string()
    .min(1, 'Rule content is required')
    .max(1000, 'Rule content must be at most 1000 characters')
    .optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateProjectRuleInput = z.infer<typeof updateProjectRuleSchema>
