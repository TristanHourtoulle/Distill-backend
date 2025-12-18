import { TaskStatus, TaskComplexity, TaskType, Prisma } from '@prisma/client'
import { db } from '../lib/db.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js'
import type { UpdateTaskInput, TaskListQuery } from '../schemas/task.schema.js'

/**
 * Task Service
 * Handles all business logic for tasks
 */
export class TaskService {
  /**
   * List tasks with optional filters
   */
  static async list(userId: string, query: TaskListQuery) {
    const { projectId, meetingId, status, complexity, type, limit, offset } = query

    // Build where clause with ownership check
    const where: Prisma.TaskWhereInput = {
      project: {
        userId, // Only tasks for projects owned by the user
      },
    }

    if (projectId) {
      where.projectId = projectId
    }

    if (meetingId) {
      where.meetingId = meetingId
    }

    if (status) {
      where.status = status as TaskStatus
    }

    if (complexity) {
      where.complexity = complexity as TaskComplexity
    }

    if (type) {
      where.type = type as TaskType
    }

    // Get tasks with pagination
    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          meeting: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: { analyses: true },
          },
        },
      }),
      db.task.count({ where }),
    ])

    return { tasks, total }
  }

  /**
   * Get a task by ID
   */
  static async getById(taskId: string, userId: string) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            userId: true,
            githubRepoUrl: true,
          },
        },
        meeting: {
          select: {
            id: true,
            title: true,
            referenceBranch: true,
          },
        },
        analyses: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        exports: {
          orderBy: { exportedAt: 'desc' },
        },
      },
    })

    if (!task) {
      throw new NotFoundError('Task not found')
    }

    // Check ownership via project
    if (task.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    return task
  }

  /**
   * Update a task
   */
  static async update(taskId: string, userId: string, input: UpdateTaskInput) {
    // Verify access
    const existing = await this.getById(taskId, userId)

    // Cannot update if analyzing
    if (existing.status === 'analyzing') {
      throw new ValidationError('Cannot update task while analyzing')
    }

    // Build update data
    const updateData: Prisma.TaskUpdateInput = {}

    if (input.title !== undefined) {
      updateData.title = input.title
    }

    if (input.description !== undefined) {
      updateData.description = input.description
    }

    if (input.type !== undefined) {
      updateData.type = input.type as TaskType
    }

    if (input.complexity !== undefined) {
      updateData.complexity = input.complexity as TaskComplexity
    }

    if (input.status !== undefined) {
      updateData.status = input.status as TaskStatus
    }

    if (input.priority !== undefined) {
      updateData.priority = input.priority
    }

    if (input.estimatedFilesCount !== undefined) {
      updateData.estimatedFilesCount = input.estimatedFilesCount
    }

    if (input.impactedFilesPreview !== undefined) {
      updateData.impactedFilesPreview = input.impactedFilesPreview as unknown as Prisma.InputJsonValue
    }

    const task = await db.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        meeting: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    return task
  }

  /**
   * Delete a task
   */
  static async delete(taskId: string, userId: string) {
    // Verify access
    const task = await this.getById(taskId, userId)

    // Cannot delete if analyzing
    if (task.status === 'analyzing') {
      throw new ValidationError('Cannot delete task while analyzing')
    }

    await db.task.delete({
      where: { id: taskId },
    })
  }

  /**
   * Bulk update task status
   */
  static async bulkUpdateStatus(
    taskIds: string[],
    status: TaskStatus,
    userId: string
  ): Promise<number> {
    // Verify all tasks belong to user
    const tasks = await db.task.findMany({
      where: {
        id: { in: taskIds },
        project: { userId },
      },
      select: { id: true, status: true },
    })

    if (tasks.length !== taskIds.length) {
      throw new ForbiddenError('Some tasks not found or access denied')
    }

    // Check none are analyzing
    const analyzing = tasks.filter((t) => t.status === 'analyzing')
    if (analyzing.length > 0) {
      throw new ValidationError('Cannot update tasks that are currently analyzing')
    }

    const result = await db.task.updateMany({
      where: {
        id: { in: taskIds },
        project: { userId },
      },
      data: { status },
    })

    return result.count
  }

  /**
   * Get task statistics for a project
   */
  static async getProjectStats(projectId: string, userId: string) {
    // Verify access
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    const [total, byStatus, byComplexity, byType] = await Promise.all([
      db.task.count({ where: { projectId } }),
      db.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { id: true },
      }),
      db.task.groupBy({
        by: ['complexity'],
        where: { projectId },
        _count: { id: true },
      }),
      db.task.groupBy({
        by: ['type'],
        where: { projectId },
        _count: { id: true },
      }),
    ])

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id
          return acc
        },
        {} as Record<string, number>
      ),
      byComplexity: byComplexity.reduce(
        (acc, item) => {
          acc[item.complexity] = item._count.id
          return acc
        },
        {} as Record<string, number>
      ),
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count.id
          return acc
        },
        {} as Record<string, number>
      ),
    }
  }

  /**
   * Update task status
   */
  static async updateStatus(taskId: string, status: TaskStatus) {
    return db.task.update({
      where: { id: taskId },
      data: { status },
    })
  }
}
