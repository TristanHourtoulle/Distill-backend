import { z } from 'zod'

/**
 * Meeting Zod Schemas
 * Validation for meeting-related API endpoints
 */

// Enums matching Prisma schema
export const meetingSourceSchema = z.enum(['upload', 'paste', 'webhook'])
export const meetingStatusSchema = z.enum(['pending', 'processing', 'completed', 'error'])

/**
 * Schema for meeting ID parameter
 */
export const meetingIdSchema = z.object({
  id: z.string().uuid(),
})

/**
 * Schema for creating a new meeting
 */
export const createMeetingSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  rawContent: z.string().min(10).max(100000), // Meeting content (10 chars min, 100k max)
  referenceBranch: z.string().min(1).max(100),
  source: meetingSourceSchema.optional().default('paste'),
  metadata: z.record(z.string(), z.unknown()).optional(), // JSON object for meeting date, participants, etc.
  meetingDate: z.string().datetime().optional(), // ISO 8601 date string
})

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>

/**
 * Schema for updating a meeting
 */
export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  rawContent: z.string().min(10).max(100000).optional(),
  referenceBranch: z.string().min(1).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  meetingDate: z.string().datetime().optional(),
  status: meetingStatusSchema.optional(),
})

export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>

/**
 * Schema for meeting list query parameters
 */
export const meetingListQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: meetingStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export type MeetingListQuery = z.infer<typeof meetingListQuerySchema>
