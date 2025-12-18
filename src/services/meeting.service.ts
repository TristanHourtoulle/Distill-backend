import { MeetingSource, MeetingStatus, Prisma } from '@prisma/client'
import { db } from '../lib/db.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js'
import type { CreateMeetingInput, UpdateMeetingInput, MeetingListQuery } from '../schemas/meeting.schema.js'
import { ParsingService } from './parsing.service.js'

/**
 * Meeting Service
 * Handles all business logic for meetings
 */
export class MeetingService {
  /**
   * List meetings with optional filters
   */
  static async list(userId: string, query: MeetingListQuery) {
    const { projectId, status, limit, offset } = query

    // Build where clause
    const where: Prisma.MeetingWhereInput = {
      project: {
        userId, // Only meetings for projects owned by the user
      },
    }

    if (projectId) {
      where.projectId = projectId
    }

    if (status) {
      where.status = status as MeetingStatus
    }

    // Get meetings with pagination
    const [meetings, total] = await Promise.all([
      db.meeting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              githubRepoUrl: true,
            },
          },
          _count: {
            select: { tasks: true },
          },
        },
      }),
      db.meeting.count({ where }),
    ])

    return { meetings, total }
  }

  /**
   * Get a meeting by ID
   */
  static async getById(meetingId: string, userId: string) {
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            userId: true,
            githubRepoUrl: true,
            preferredBranch: true,
          },
        },
        tasks: {
          orderBy: { priority: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            complexity: true,
            status: true,
            priority: true,
            estimatedFilesCount: true,
          },
        },
      },
    })

    if (!meeting) {
      throw new NotFoundError('Meeting not found')
    }

    // Check ownership via project
    if (meeting.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    return meeting
  }

  /**
   * Create a new meeting
   */
  static async create(userId: string, input: CreateMeetingInput) {
    // Verify project exists and belongs to user
    const project = await db.project.findUnique({
      where: { id: input.projectId },
      select: { id: true, userId: true, preferredBranch: true },
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied to this project')
    }

    // Validate reference branch if provided
    const referenceBranch = input.referenceBranch || project.preferredBranch

    // Build create data - avoid undefined values for exactOptionalPropertyTypes
    const createData: Prisma.MeetingCreateInput = {
      project: { connect: { id: input.projectId } },
      title: input.title,
      rawContent: input.rawContent,
      referenceBranch,
      source: (input.source || 'paste') as MeetingSource,
      status: 'pending',
    }

    // Only add optional fields if they have values
    if (input.metadata) {
      createData.metadata = input.metadata as unknown as Prisma.InputJsonValue
    }

    if (input.meetingDate) {
      createData.meetingDate = new Date(input.meetingDate)
    }

    const meeting = await db.meeting.create({
      data: createData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            githubRepoUrl: true,
          },
        },
      },
    })

    // Automatically trigger parsing in background (fire-and-forget)
    ParsingService.parseMeeting(meeting.id, userId).catch((error) => {
      console.error(`Failed to auto-parse meeting ${meeting.id}:`, error)
    })

    return meeting
  }

  /**
   * Update a meeting
   */
  static async update(meetingId: string, userId: string, input: UpdateMeetingInput) {
    // First verify the meeting exists and user has access
    const existing = await this.getById(meetingId, userId)

    // Cannot update if processing
    if (existing.status === 'processing') {
      throw new ValidationError('Cannot update meeting while processing')
    }

    // Build update data
    const updateData: Prisma.MeetingUpdateInput = {}

    if (input.title !== undefined) {
      updateData.title = input.title
    }

    if (input.rawContent !== undefined) {
      updateData.rawContent = input.rawContent
      // Reset parsed summary if raw content changes
      updateData.parsedSummary = null
    }

    if (input.referenceBranch !== undefined) {
      updateData.referenceBranch = input.referenceBranch
    }

    if (input.metadata !== undefined) {
      updateData.metadata = input.metadata as unknown as Prisma.InputJsonValue
    }

    if (input.meetingDate !== undefined) {
      updateData.meetingDate = new Date(input.meetingDate)
    }

    if (input.status !== undefined) {
      updateData.status = input.status as MeetingStatus
    }

    const meeting = await db.meeting.update({
      where: { id: meetingId },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            githubRepoUrl: true,
          },
        },
      },
    })

    return meeting
  }

  /**
   * Delete a meeting
   */
  static async delete(meetingId: string, userId: string) {
    // Verify access
    const meeting = await this.getById(meetingId, userId)

    // Cannot delete if processing
    if (meeting.status === 'processing') {
      throw new ValidationError('Cannot delete meeting while processing')
    }

    await db.meeting.delete({
      where: { id: meetingId },
    })
  }

  /**
   * List meetings for a specific project
   */
  static async listByProject(projectId: string, userId: string) {
    // Verify project access
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    const meetings = await db.meeting.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    })

    return meetings
  }

  /**
   * Get meeting statistics for a project
   */
  static async getProjectStats(projectId: string, userId: string) {
    // Verify project access
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    const [total, byStatus] = await Promise.all([
      db.meeting.count({ where: { projectId } }),
      db.meeting.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { id: true },
      }),
    ])

    const statusCounts = byStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total,
      pending: statusCounts['pending'] || 0,
      processing: statusCounts['processing'] || 0,
      completed: statusCounts['completed'] || 0,
      error: statusCounts['error'] || 0,
    }
  }

  /**
   * Update meeting status
   */
  static async updateStatus(meetingId: string, status: MeetingStatus, parsedSummary?: string) {
    const updateData: Prisma.MeetingUpdateInput = { status }

    if (parsedSummary !== undefined) {
      updateData.parsedSummary = parsedSummary
    }

    return db.meeting.update({
      where: { id: meetingId },
      data: updateData,
    })
  }
}
