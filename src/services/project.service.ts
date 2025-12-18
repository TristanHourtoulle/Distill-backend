import { db } from '../lib/db.js'
import { GitHubService } from './github.service.js'
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../lib/errors.js'
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateProjectRuleInput,
  UpdateProjectRuleInput,
} from '../schemas/project.schema.js'

export class ProjectService {
  /**
   * List all projects for a user
   */
  static async listByUser(userId: string) {
    return db.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            meetings: true,
            tasks: true,
            rules: true,
          },
        },
      },
    })
  }

  /**
   * Get a project by ID with ownership check
   */
  static async getById(projectId: string, userId: string) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
        _count: {
          select: {
            meetings: true,
            tasks: true,
            indexes: true,
          },
        },
      },
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied to this project')
    }

    return project
  }

  /**
   * Create a new project
   */
  static async create(userId: string, input: CreateProjectInput) {
    // Parse the GitHub URL
    const parsed = GitHubService.parseRepoUrl(input.githubRepoUrl)
    if (!parsed) {
      throw new ValidationError('Invalid GitHub repository URL')
    }

    // Check if user has access to the repository
    const hasAccess = await GitHubService.checkRepoAccess(userId, input.githubRepoUrl)
    if (!hasAccess) {
      throw new ForbiddenError('No access to this repository. Make sure you have the correct permissions.')
    }

    // Check if project already exists for this repo
    const existing = await db.project.findFirst({
      where: {
        userId,
        githubOwner: parsed.owner,
        githubRepoName: parsed.repo,
      },
    })

    if (existing) {
      throw new ConflictError('A project for this repository already exists')
    }

    // Get repo info to get the default branch
    const repoInfo = await GitHubService.getRepoInfo(userId, parsed.owner, parsed.repo)

    // Create the project
    return db.project.create({
      data: {
        userId,
        githubRepoUrl: input.githubRepoUrl,
        githubOwner: parsed.owner,
        githubRepoName: parsed.repo,
        defaultBranch: repoInfo.defaultBranch,
        preferredBranch: input.preferredBranch,
        name: input.name,
        description: input.description ?? null,
        status: 'pending',
      },
    })
  }

  /**
   * Update a project
   */
  static async update(projectId: string, userId: string, input: UpdateProjectInput) {
    // Verify ownership
    const project = await this.getById(projectId, userId)

    // If changing preferred branch, verify it exists
    if (input.preferredBranch && input.preferredBranch !== project.preferredBranch) {
      const branches = await GitHubService.listBranches(
        userId,
        project.githubOwner,
        project.githubRepoName
      )
      const branchExists = branches.some(b => b.name === input.preferredBranch)
      if (!branchExists) {
        throw new ValidationError(`Branch "${input.preferredBranch}" does not exist`)
      }
    }

    // Build update data, only including defined fields
    const updateData: Record<string, string | null> = {}
    if (input.name !== undefined) updateData['name'] = input.name
    if (input.description !== undefined) updateData['description'] = input.description ?? null
    if (input.preferredBranch !== undefined) updateData['preferredBranch'] = input.preferredBranch

    return db.project.update({
      where: { id: projectId },
      data: updateData,
    })
  }

  /**
   * Delete a project
   */
  static async delete(projectId: string, userId: string) {
    // Verify ownership
    await this.getById(projectId, userId)

    await db.project.delete({
      where: { id: projectId },
    })
  }

  /**
   * List available branches for a project
   */
  static async listBranches(projectId: string, userId: string) {
    const project = await this.getById(projectId, userId)

    return GitHubService.listBranches(
      userId,
      project.githubOwner,
      project.githubRepoName
    )
  }

  /**
   * Trigger re-indexation of a project
   */
  static async triggerIndexation(projectId: string, userId: string) {
    // Verify ownership
    await this.getById(projectId, userId)

    // Update status to indexing
    await db.project.update({
      where: { id: projectId },
      data: { status: 'indexing' },
    })

    // TODO: Implement actual indexation in task 2.3
    // For now, just return the updated project
    return db.project.findUnique({
      where: { id: projectId },
    })
  }

  // ============================================
  // Project Rules
  // ============================================

  /**
   * List all rules for a project
   */
  static async listRules(projectId: string, userId: string) {
    await this.getById(projectId, userId)

    return db.projectRule.findMany({
      where: { projectId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
  }

  /**
   * Create a new rule for a project
   */
  static async createRule(projectId: string, userId: string, input: CreateProjectRuleInput) {
    await this.getById(projectId, userId)

    return db.projectRule.create({
      data: {
        projectId,
        type: input.type,
        content: input.content,
        priority: input.priority,
      },
    })
  }

  /**
   * Update a rule
   */
  static async updateRule(
    projectId: string,
    ruleId: string,
    userId: string,
    input: UpdateProjectRuleInput
  ) {
    await this.getById(projectId, userId)

    const rule = await db.projectRule.findUnique({
      where: { id: ruleId },
    })

    if (!rule || rule.projectId !== projectId) {
      throw new NotFoundError('Rule not found')
    }

    // Build update data, only including defined fields
    const updateData: Record<string, string | number | boolean> = {}
    if (input.content !== undefined) updateData['content'] = input.content
    if (input.priority !== undefined) updateData['priority'] = input.priority
    if (input.isActive !== undefined) updateData['isActive'] = input.isActive

    return db.projectRule.update({
      where: { id: ruleId },
      data: updateData,
    })
  }

  /**
   * Delete a rule
   */
  static async deleteRule(projectId: string, ruleId: string, userId: string) {
    await this.getById(projectId, userId)

    const rule = await db.projectRule.findUnique({
      where: { id: ruleId },
    })

    if (!rule || rule.projectId !== projectId) {
      throw new NotFoundError('Rule not found')
    }

    await db.projectRule.delete({
      where: { id: ruleId },
    })
  }
}
