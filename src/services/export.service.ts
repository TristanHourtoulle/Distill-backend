/**
 * Export Service
 * Handles exporting tasks to external integrations (GitHub Issues, etc.)
 */

import { Octokit } from 'octokit'
import { Prisma } from '@prisma/client'
import { db } from '../lib/db.js'
import { NotFoundError, ForbiddenError, ValidationError, AppError } from '../lib/errors.js'
import type {
  GitHubIssueOptions,
  GitHubIssuePayload,
  GitHubIssueResponse,
  ExportResult,
  BulkExportOptions,
  BulkExportResult,
} from '../types/export.types.js'

/**
 * Analysis result from database (JSON fields)
 */
interface AnalysisFiles {
  path: string
  description?: string
  template?: string
  changes?: Array<{
    location: string
    description: string
    reason: string
  }>
}

interface AnalysisStep {
  order: number
  description: string
  files: string[]
}

interface AnalysisRisk {
  description: string
  mitigation: string
}

/**
 * Export Service
 */
export class ExportService {
  /**
   * Export a task to GitHub Issues
   */
  static async exportToGitHubIssue(
    taskId: string,
    userId: string,
    options: GitHubIssueOptions = {}
  ): Promise<ExportResult> {
    // Get task with analysis and project
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            userId: true,
            githubOwner: true,
            githubRepoName: true,
          },
        },
        analyses: {
          where: { status: 'completed' },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!task) {
      throw new NotFoundError('Task not found')
    }

    if (task.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    // Get GitHub integration for user
    const integration = await db.integration.findFirst({
      where: {
        userId,
        type: 'github_issues',
        isActive: true,
      },
    })

    if (!integration) {
      throw new ValidationError('GitHub Issues integration not configured. Please connect your GitHub account.')
    }

    // Get GitHub token from Account
    const account = await db.account.findFirst({
      where: {
        userId,
        providerId: 'github',
      },
    })

    if (!account?.accessToken) {
      throw new ValidationError('GitHub not connected. Please reconnect your GitHub account.')
    }

    // Create export record
    const taskExport = await db.taskExport.create({
      data: {
        taskId,
        integrationId: integration.id,
        status: 'pending',
      },
    })

    try {
      // Get latest analysis
      const analysis = task.analyses[0]

      // Build issue body
      const issueBody = this.buildIssueBody(task, analysis)

      // Create GitHub issue
      const octokit = new Octokit({ auth: account.accessToken })

      const issuePayload: GitHubIssuePayload = {
        title: task.title,
        body: issueBody,
      }

      if (options.labels && options.labels.length > 0) {
        issuePayload.labels = options.labels
      }
      if (options.assignees && options.assignees.length > 0) {
        issuePayload.assignees = options.assignees
      }
      if (options.milestone) {
        issuePayload.milestone = options.milestone
      }

      const { data: issue } = await octokit.rest.issues.create({
        owner: task.project.githubOwner,
        repo: task.project.githubRepoName,
        ...issuePayload,
      })

      const issueResponse: GitHubIssueResponse = {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: issue.state,
        htmlUrl: issue.html_url,
        createdAt: issue.created_at,
        labels: issue.labels
          .filter((l): l is { id?: number; name?: string; color?: string } => typeof l === 'object')
          .map((l) => ({
            id: l.id ?? 0,
            name: l.name ?? '',
            color: l.color ?? '',
          })),
        assignees: issue.assignees?.map((a) => ({ login: a.login })) ?? [],
      }

      // Update export record
      await db.taskExport.update({
        where: { id: taskExport.id },
        data: {
          status: 'success',
          externalId: String(issue.number),
          externalUrl: issue.html_url,
          exportedContent: issueResponse as unknown as Prisma.InputJsonValue,
        },
      })

      // Update task status
      await db.task.update({
        where: { id: taskId },
        data: { status: 'exported' },
      })

      return {
        exportId: taskExport.id,
        externalId: String(issue.number),
        externalUrl: issue.html_url,
        status: 'success',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Update export as failed
      await db.taskExport.update({
        where: { id: taskExport.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      })

      throw new AppError(`Failed to create GitHub issue: ${errorMessage}`, 502, 'GITHUB_ERROR')
    }
  }

  /**
   * Bulk export tasks to GitHub Issues
   */
  static async bulkExportToGitHubIssues(
    userId: string,
    options: BulkExportOptions
  ): Promise<BulkExportResult> {
    const results: ExportResult[] = []
    let successful = 0
    let failed = 0

    for (const taskId of options.taskIds) {
      try {
        const result = await this.exportToGitHubIssue(taskId, userId, options.options)
        results.push(result)
        successful++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.push({
          exportId: '',
          externalId: '',
          externalUrl: '',
          status: 'failed',
          errorMessage,
        })
        failed++
      }
    }

    return {
      total: options.taskIds.length,
      successful,
      failed,
      results,
    }
  }

  /**
   * Get export history for a task
   */
  static async getTaskExports(taskId: string, userId: string) {
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

    const exports = await db.taskExport.findMany({
      where: { taskId },
      orderBy: { exportedAt: 'desc' },
      include: {
        integration: {
          select: {
            type: true,
          },
        },
      },
    })

    return exports
  }

  /**
   * Get export by ID
   */
  static async getExport(exportId: string, userId: string) {
    const taskExport = await db.taskExport.findUnique({
      where: { id: exportId },
      include: {
        task: {
          include: {
            project: {
              select: { userId: true },
            },
          },
        },
        integration: {
          select: { type: true },
        },
      },
    })

    if (!taskExport) {
      throw new NotFoundError('Export not found')
    }

    if (taskExport.task.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    return taskExport
  }

  /**
   * Build GitHub issue body from task and analysis
   */
  private static buildIssueBody(
    task: {
      title: string
      description: string
      type: string
      complexity: string
    },
    analysis?: {
      filesToCreate: unknown
      filesToModify: unknown
      implementationSteps: unknown
      risks: unknown
      dependencies: unknown
      reasoning: string | null
    }
  ): string {
    const sections: string[] = []

    // Header section
    sections.push(`## Description\n\n${task.description}`)

    // Task metadata
    sections.push(`## Task Info\n\n| Property | Value |\n|----------|-------|\n| Type | ${task.type} |\n| Complexity | ${task.complexity} |`)

    if (!analysis) {
      sections.push('> **Note:** This task has not been analyzed yet.')
      return sections.join('\n\n')
    }

    // Summary
    if (analysis.reasoning) {
      sections.push(`## Analysis Summary\n\n${analysis.reasoning}`)
    }

    // Files to Create
    const filesToCreate = (analysis.filesToCreate as AnalysisFiles[] | null) ?? []
    if (filesToCreate.length > 0) {
      const filesList = filesToCreate
        .map((f) => `- \`${f.path}\`${f.description ? ` - ${f.description}` : ''}`)
        .join('\n')
      sections.push(`## Files to Create\n\n${filesList}`)
    }

    // Files to Modify
    const filesToModify = (analysis.filesToModify as AnalysisFiles[] | null) ?? []
    if (filesToModify.length > 0) {
      const modifyList = filesToModify
        .map((f) => {
          const changes = f.changes ?? []
          const changeDesc =
            changes.length > 0
              ? changes.map((c) => `  - ${c.location}: ${c.description}`).join('\n')
              : ''
          return `- \`${f.path}\`${changeDesc ? '\n' + changeDesc : ''}`
        })
        .join('\n')
      sections.push(`## Files to Modify\n\n${modifyList}`)
    }

    // Implementation Steps
    const steps = (analysis.implementationSteps as AnalysisStep[] | null) ?? []
    if (steps.length > 0) {
      const stepsList = steps
        .sort((a, b) => a.order - b.order)
        .map((s) => `${s.order}. ${s.description}${s.files.length > 0 ? ` (\`${s.files.join('`, `')}\`)` : ''}`)
        .join('\n')
      sections.push(`## Implementation Steps\n\n${stepsList}`)
    }

    // Risks
    const risks = (analysis.risks as AnalysisRisk[] | null) ?? []
    if (risks.length > 0) {
      const risksList = risks
        .map((r) => `- **${r.description}**\n  - Mitigation: ${r.mitigation}`)
        .join('\n')
      sections.push(`## Risks\n\n${risksList}`)
    }

    // Dependencies
    const dependencies = (analysis.dependencies as string[] | null) ?? []
    if (dependencies.length > 0) {
      sections.push(`## Dependencies\n\n${dependencies.map((d) => `- ${d}`).join('\n')}`)
    }

    // Footer
    sections.push('---\n*Generated by Distill*')

    return sections.join('\n\n')
  }

  /**
   * Create or get GitHub Issues integration for a user
   */
  static async ensureGitHubIntegration(userId: string): Promise<string> {
    let integration = await db.integration.findFirst({
      where: {
        userId,
        type: 'github_issues',
      },
    })

    if (!integration) {
      integration = await db.integration.create({
        data: {
          userId,
          type: 'github_issues',
          isActive: true,
        },
      })
    }

    return integration.id
  }

  /**
   * Get export statistics for a project
   */
  static async getProjectExportStats(projectId: string, userId: string) {
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

    const stats = await db.taskExport.groupBy({
      by: ['status'],
      where: {
        task: { projectId },
      },
      _count: { id: true },
    })

    const totalTasks = await db.task.count({
      where: { projectId },
    })

    const exportedTasks = await db.task.count({
      where: { projectId, status: 'exported' },
    })

    return {
      totalTasks,
      exportedTasks,
      pendingExport: totalTasks - exportedTasks,
      byStatus: stats.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id
          return acc
        },
        {} as Record<string, number>
      ),
    }
  }
}
