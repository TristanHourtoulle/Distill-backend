import { randomUUID } from 'crypto'
import {
  type Job,
  type JobType,
  type JobProgress,
  type CreateJobOptions,
  type JobUpdate,
  type JobFilter,
  type JobStats,
  type JobEventType,
  type JobEventCallback,
  type IndexationJobPayload,
} from '../types/job.types.js'
import { IndexationService } from './indexation.service.js'

/**
 * In-memory job queue service
 * Can be upgraded to Redis-backed queue (BullMQ) for production
 */
export class JobQueueService {
  // In-memory job storage
  private static jobs: Map<string, Job> = new Map()

  // Event listeners
  private static listeners: Map<string, JobEventCallback[]> = new Map()

  // Processing flag per job type to prevent concurrent processing
  private static processing: Map<JobType, boolean> = new Map()

  // Worker interval reference
  private static workerInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Start the job worker
   */
  static startWorker(intervalMs: number = 1000): void {
    if (this.workerInterval) {
      return // Already running
    }

    console.log('Starting job queue worker...')
    this.workerInterval = setInterval(() => {
      this.processNextJob()
    }, intervalMs)
  }

  /**
   * Stop the job worker
   */
  static stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval)
      this.workerInterval = null
      console.log('Job queue worker stopped')
    }
  }

  /**
   * Create a new job
   */
  static createJob<T>(options: CreateJobOptions<T>): Job<T> {
    const job: Job<T> = {
      id: randomUUID(),
      type: options.type,
      status: 'pending',
      priority: options.priority ?? 'normal',
      payload: options.payload,
      progress: null,
      result: null,
      error: null,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      userId: options.userId,
    }

    this.jobs.set(job.id, job as Job)
    console.log(`Job created: ${job.id} (${job.type})`)

    return job
  }

  /**
   * Get a job by ID
   */
  static getJob(jobId: string): Job | null {
    return this.jobs.get(jobId) ?? null
  }

  /**
   * Get jobs by filter
   */
  static getJobs(filter: JobFilter = {}): Job[] {
    const jobs = Array.from(this.jobs.values())

    return jobs.filter(job => {
      if (filter.type && job.type !== filter.type) return false
      if (filter.status && job.status !== filter.status) return false
      if (filter.userId && job.userId !== filter.userId) return false
      if (filter.projectId) {
        const payload = job.payload as { projectId?: string }
        if (payload.projectId !== filter.projectId) return false
      }
      return true
    }).sort((a, b) => {
      // Sort by priority (high > normal > low), then by creation time
      const priorityOrder = { high: 0, normal: 1, low: 2 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  /**
   * Update a job
   */
  static updateJob(jobId: string, update: JobUpdate): Job | null {
    const job = this.jobs.get(jobId)
    if (!job) return null

    if (update.status !== undefined) job.status = update.status
    if (update.progress !== undefined) job.progress = update.progress
    if (update.result !== undefined) job.result = update.result
    if (update.error !== undefined) job.error = update.error

    this.jobs.set(jobId, job)

    // Emit progress event
    if (update.progress) {
      this.emitEvent(jobId, 'progress')
    }

    return job
  }

  /**
   * Cancel a job
   */
  static cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status === 'running') {
      // Cannot cancel running job (would need abort controller)
      return false
    }

    if (job.status === 'pending') {
      job.status = 'cancelled'
      job.completedAt = new Date()
      this.jobs.set(jobId, job)
      return true
    }

    return false
  }

  /**
   * Delete a job
   */
  static deleteJob(jobId: string): boolean {
    return this.jobs.delete(jobId)
  }

  /**
   * Get job statistics
   */
  static getStats(filter: JobFilter = {}): JobStats {
    const jobs = this.getJobs(filter)

    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      total: jobs.length,
    }
  }

  /**
   * Register an event listener
   */
  static on(jobId: string, callback: JobEventCallback): void {
    const listeners = this.listeners.get(jobId) ?? []
    listeners.push(callback)
    this.listeners.set(jobId, listeners)
  }

  /**
   * Remove event listeners for a job
   */
  static off(jobId: string): void {
    this.listeners.delete(jobId)
  }

  /**
   * Emit an event for a job
   */
  private static emitEvent(jobId: string, event: JobEventType): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    const listeners = this.listeners.get(jobId) ?? []
    for (const listener of listeners) {
      try {
        listener(job, event)
      } catch (error) {
        console.error(`Error in job event listener: ${error}`)
      }
    }
  }

  /**
   * Process the next pending job
   */
  private static async processNextJob(): Promise<void> {
    // Get next pending job
    const pendingJobs = this.getJobs({ status: 'pending' })
    if (pendingJobs.length === 0) return

    const job = pendingJobs[0]
    if (!job) return

    // Check if already processing this job type
    if (this.processing.get(job.type)) {
      return
    }

    // Mark as processing
    this.processing.set(job.type, true)

    try {
      await this.executeJob(job)
    } finally {
      this.processing.set(job.type, false)
    }
  }

  /**
   * Execute a job
   */
  private static async executeJob(job: Job): Promise<void> {
    // Update status to running
    job.status = 'running'
    job.startedAt = new Date()
    job.attempts++
    this.jobs.set(job.id, job)
    this.emitEvent(job.id, 'started')

    console.log(`Executing job: ${job.id} (${job.type}), attempt ${job.attempts}/${job.maxAttempts}`)

    try {
      let result: unknown

      switch (job.type) {
        case 'indexation':
          result = await this.executeIndexationJob(job as Job<IndexationJobPayload>)
          break
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }

      // Mark as completed
      job.status = 'completed'
      job.completedAt = new Date()
      job.result = result
      this.jobs.set(job.id, job)
      this.emitEvent(job.id, 'completed')

      console.log(`Job completed: ${job.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Job failed: ${job.id} - ${errorMessage}`)

      // Check if should retry
      if (job.attempts < job.maxAttempts) {
        // Reset to pending for retry
        job.status = 'pending'
        job.error = errorMessage
        this.jobs.set(job.id, job)
        console.log(`Job will retry: ${job.id} (${job.attempts}/${job.maxAttempts})`)
      } else {
        // Mark as failed
        job.status = 'failed'
        job.completedAt = new Date()
        job.error = errorMessage
        this.jobs.set(job.id, job)
        this.emitEvent(job.id, 'failed')
        console.log(`Job permanently failed: ${job.id}`)
      }
    }
  }

  /**
   * Execute an indexation job
   */
  private static async executeIndexationJob(job: Job<IndexationJobPayload>): Promise<unknown> {
    const { projectId, userId } = job.payload

    // Create a progress callback
    const onProgress = (progress: JobProgress) => {
      this.updateJob(job.id, { progress })
    }

    // Run indexation with progress tracking
    const result = await IndexationService.indexProjectWithProgress(
      projectId,
      userId,
      onProgress
    )

    return result
  }

  /**
   * Create and queue an indexation job
   */
  static queueIndexation(projectId: string, userId: string, priority: 'low' | 'normal' | 'high' = 'normal'): Job<IndexationJobPayload> {
    // Check if there's already a pending/running job for this project
    const existingJobs = this.getJobs({
      type: 'indexation',
      projectId,
    }).filter(j => j.status === 'pending' || j.status === 'running')

    if (existingJobs.length > 0) {
      // Return existing job instead of creating a new one
      return existingJobs[0] as Job<IndexationJobPayload>
    }

    return this.createJob<IndexationJobPayload>({
      type: 'indexation',
      payload: { projectId, userId },
      userId,
      priority,
      maxAttempts: 3,
    })
  }

  /**
   * Get indexation job for a project
   */
  static getProjectIndexationJob(projectId: string): Job<IndexationJobPayload> | null {
    const jobs = this.getJobs({ type: 'indexation', projectId })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return (jobs[0] as Job<IndexationJobPayload>) ?? null
  }

  /**
   * Clean up old completed/failed jobs
   */
  static cleanupOldJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now()
    let cleaned = 0

    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        const age = now - (job.completedAt?.getTime() ?? job.createdAt.getTime())
        if (age > maxAgeMs) {
          this.jobs.delete(id)
          this.listeners.delete(id)
          cleaned++
        }
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old jobs`)
    }

    return cleaned
  }
}
