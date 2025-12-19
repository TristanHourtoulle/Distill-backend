/**
 * Analysis Service
 * Manages task analysis with the LLM agent
 */

import { Prisma } from '@prisma/client'
import { db } from '../lib/db.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js'
import {
  runAgentAnalysis,
  type AnalysisResult,
  type AgentStats,
  type AgentProgressCallback,
  type OrchestratorConfig,
  type StreamingOptions,
} from '../agent/orchestrator.js'
import type { ToolResult } from '../types/agent.types.js'

/**
 * Analysis Service
 * Handles running agent analysis and persisting results
 */
export class AnalysisService {
  /**
   * Start analysis for a task
   */
  static async startAnalysis(
    taskId: string,
    userId: string,
    config?: Partial<OrchestratorConfig>,
    onProgress?: AgentProgressCallback,
    streaming?: StreamingOptions
  ): Promise<{
    analysisId: string
    result: AnalysisResult
    stats: AgentStats
  }> {
    // Verify task exists and user has access
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

    // Check if task is already being analyzed
    if (task.status === 'analyzing') {
      throw new ValidationError('Task is already being analyzed')
    }

    // Update task status
    await db.task.update({
      where: { id: taskId },
      data: { status: 'analyzing' },
    })

    // Create analysis record
    const analysis = await db.taskAnalysis.create({
      data: {
        taskId,
        status: 'running',
      },
    })

    try {
      // Run the agent
      const { result, stats, logs } = await runAgentAnalysis(
        taskId,
        userId,
        config,
        onProgress,
        streaming
      )

      // Save agent logs
      await this.saveAgentLogs(analysis.id, logs)

      // Update analysis with results
      await db.taskAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          filesToCreate: result.filesToCreate as unknown as Prisma.InputJsonValue,
          filesToModify: result.filesToModify as unknown as Prisma.InputJsonValue,
          implementationSteps: result.implementationSteps as unknown as Prisma.InputJsonValue,
          risks: result.risks as unknown as Prisma.InputJsonValue,
          dependencies: result.dependencies as unknown as Prisma.InputJsonValue,
          reasoning: result.summary,
          tokensUsed: stats.tokensUsed.input + stats.tokensUsed.output,
          toolCallsCount: stats.toolCalls,
        },
      })

      // Update task status and impacted files
      await db.task.update({
        where: { id: taskId },
        data: {
          status: 'analyzed',
          impactedFilesPreview: this.extractImpactedFiles(result) as unknown as Prisma.InputJsonValue,
          estimatedFilesCount: this.countImpactedFiles(result),
        },
      })

      return { analysisId: analysis.id, result, stats }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Update analysis as failed
      await db.taskAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage,
        },
      })

      // Reset task status
      await db.task.update({
        where: { id: taskId },
        data: { status: 'pending' },
      })

      throw error
    }
  }

  /**
   * Get analysis by ID
   */
  static async getAnalysis(analysisId: string, userId: string) {
    const analysis = await db.taskAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        task: {
          include: {
            project: {
              select: { userId: true, name: true },
            },
          },
        },
        logs: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    })

    if (!analysis) {
      throw new NotFoundError('Analysis not found')
    }

    if (analysis.task.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    return analysis
  }

  /**
   * Get latest analysis for a task
   */
  static async getTaskAnalysis(taskId: string, userId: string) {
    // Verify access
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

    const analysis = await db.taskAnalysis.findFirst({
      where: { taskId },
      orderBy: { startedAt: 'desc' },
      include: {
        logs: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    })

    return analysis
  }

  /**
   * List analyses for a task
   */
  static async listTaskAnalyses(taskId: string, userId: string) {
    // Verify access
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

    const analyses = await db.taskAnalysis.findMany({
      where: { taskId },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        tokensUsed: true,
        toolCallsCount: true,
        errorMessage: true,
      },
    })

    return analyses
  }

  /**
   * Save agent logs to database
   */
  private static async saveAgentLogs(
    analysisId: string,
    logs: ToolResult[]
  ): Promise<void> {
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]
      if (!log) continue

      const createData: Prisma.AgentLogUncheckedCreateInput = {
        taskAnalysisId: analysisId,
        stepNumber: i + 1,
        actionType: log.toolName,
        actionInput: JSON.stringify(log.input),
        actionOutput: log.error || JSON.stringify(log.output).substring(0, 5000),
        durationMs: log.durationMs,
      }

      if (log.tokensEstimate !== undefined) {
        createData.tokensIn = log.tokensEstimate
      }

      await db.agentLog.create({ data: createData })
    }
  }

  /**
   * Extract impacted file paths from analysis result
   */
  private static extractImpactedFiles(result: AnalysisResult): string[] {
    const files = new Set<string>()

    for (const file of result.filesToCreate) {
      files.add(file.path)
    }

    for (const file of result.filesToModify) {
      files.add(file.path)
    }

    return Array.from(files)
  }

  /**
   * Count total impacted files
   */
  private static countImpactedFiles(result: AnalysisResult): number {
    return result.filesToCreate.length + result.filesToModify.length
  }

  /**
   * Get analysis statistics for a project
   */
  static async getProjectAnalysisStats(projectId: string, userId: string) {
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

    const stats = await db.taskAnalysis.aggregate({
      where: {
        task: { projectId },
        status: 'completed',
      },
      _count: { id: true },
      _sum: {
        tokensUsed: true,
        toolCallsCount: true,
      },
      _avg: {
        tokensUsed: true,
        toolCallsCount: true,
      },
    })

    const byStatus = await db.taskAnalysis.groupBy({
      by: ['status'],
      where: { task: { projectId } },
      _count: { id: true },
    })

    return {
      total: stats._count.id,
      totalTokens: stats._sum.tokensUsed || 0,
      totalToolCalls: stats._sum.toolCallsCount || 0,
      avgTokens: Math.round(stats._avg.tokensUsed || 0),
      avgToolCalls: Math.round(stats._avg.toolCallsCount || 0),
      byStatus: byStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id
          return acc
        },
        {} as Record<string, number>
      ),
    }
  }
}
