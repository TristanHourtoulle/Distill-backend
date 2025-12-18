/**
 * Job Queue Types
 * Types for background job processing
 */

/**
 * Job status
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Job type
 */
export type JobType = 'indexation' | 'analysis' | 'export'

/**
 * Job priority levels
 */
export type JobPriority = 'low' | 'normal' | 'high'

/**
 * Progress information for a job
 */
export interface JobProgress {
  phase: string
  current: number
  total: number
  message?: string | undefined
}

/**
 * Job definition
 */
export interface Job<T = unknown> {
  id: string
  type: JobType
  status: JobStatus
  priority: JobPriority
  payload: T
  progress: JobProgress | null
  result: unknown | null
  error: string | null
  attempts: number
  maxAttempts: number
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  userId: string
}

/**
 * Indexation job payload
 */
export interface IndexationJobPayload {
  projectId: string
  userId: string
  force?: boolean
}

/**
 * Job creation options
 */
export interface CreateJobOptions<T = unknown> {
  type: JobType
  payload: T
  userId: string
  priority?: JobPriority
  maxAttempts?: number
}

/**
 * Job update data
 */
export interface JobUpdate {
  status?: JobStatus
  progress?: JobProgress
  result?: unknown
  error?: string
}

/**
 * Job filter options
 */
export interface JobFilter {
  type?: JobType | undefined
  status?: JobStatus | undefined
  userId?: string | undefined
  projectId?: string | undefined
}

/**
 * Job statistics
 */
export interface JobStats {
  pending: number
  running: number
  completed: number
  failed: number
  total: number
}

/**
 * Job event types for callbacks
 */
export type JobEventType = 'started' | 'progress' | 'completed' | 'failed'

/**
 * Job event callback
 */
export type JobEventCallback = (job: Job, event: JobEventType) => void
