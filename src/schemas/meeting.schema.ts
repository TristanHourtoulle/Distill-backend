import { z } from 'zod'

/**
 * Meeting Zod Schemas
 * Validation for meeting-related API endpoints
 */

// Enums matching Prisma schema
export const meetingSourceSchema = z.enum(['upload', 'paste', 'webhook'])
export const meetingStatusSchema = z.enum(['pending', 'processing', 'completed', 'error'])

/**
 * Flexible date schema that accepts:
 * - ISO datetime: "2025-12-18T10:30:00Z"
 * - ISO date only: "2025-12-18"
 * Transforms date-only strings to datetime at midnight UTC
 */
const flexibleDateSchema = z.string().transform((val, ctx) => {
  // Try parsing as-is first (full datetime)
  let date = new Date(val)

  // If it's just a date (YYYY-MM-DD), append time
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    date = new Date(`${val}T00:00:00Z`)
  }

  if (isNaN(date.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid date format. Expected ISO date (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:mm:ssZ)',
    })
    return z.NEVER
  }

  return date.toISOString()
})

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
  meetingDate: flexibleDateSchema.optional(), // Accepts YYYY-MM-DD or full ISO datetime
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
  meetingDate: flexibleDateSchema.optional(), // Accepts YYYY-MM-DD or full ISO datetime
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
