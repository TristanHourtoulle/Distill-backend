import { TaskComplexity, Prisma } from '@prisma/client'
import { db } from '../lib/db.js'
import { NotFoundError, ForbiddenError } from '../lib/errors.js'
import type {
  ComplexityFactors,
  ComplexityEstimation,
  EstimationConfig,
} from '../types/complexity.types.js'
import {
  DEFAULT_ESTIMATION_CONFIG,
  COMPLEXITY_PATTERNS,
} from '../types/complexity.types.js'

/**
 * Complexity Estimation Service
 * Analyzes tasks and estimates their complexity based on various factors
 */
export class ComplexityService {
  /**
   * Estimate complexity for a single task
   */
  static async estimateTask(
    taskId: string,
    userId: string,
    config: Partial<EstimationConfig> = {}
  ): Promise<ComplexityEstimation> {
    const fullConfig = { ...DEFAULT_ESTIMATION_CONFIG, ...config }

    // Get task with project context
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            userId: true,
            detectedStack: true,
          },
        },
      },
    })

    if (!task) {
      throw new NotFoundError('Task not found')
    }

    if (task.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    // Get indexed files count for context
    const indexedFilesCount = await db.projectIndex.count({
      where: { projectId: task.projectId },
    })

    // Analyze task
    const factors = this.analyzeTaskFactors(task.title, task.description, indexedFilesCount)
    const estimation = this.calculateComplexity(factors, fullConfig)

    // Update task with new estimation
    const updateData: Prisma.TaskUpdateInput = {
      complexity: estimation.complexity,
      estimatedFilesCount: estimation.suggestedFilesCount,
    }

    // Only set impactedFilesPreview if there's meaningful data
    if (task.impactedFilesPreview || estimation.suggestedFilesCount > 0) {
      const preview = task.impactedFilesPreview as string[] | null
      if (!preview || preview.length === 0) {
        // Generate a placeholder based on project stack
        const stack = task.project.detectedStack as Record<string, unknown> | null
        if (stack) {
          updateData.impactedFilesPreview = this.suggestImpactedFiles(
            task.title,
            task.description,
            stack
          ) as unknown as Prisma.InputJsonValue
        }
      }
    }

    await db.task.update({
      where: { id: taskId },
      data: updateData,
    })

    return estimation
  }

  /**
   * Estimate complexity for all tasks in a meeting
   */
  static async estimateMeetingTasks(
    meetingId: string,
    userId: string,
    config: Partial<EstimationConfig> = {}
  ): Promise<ComplexityEstimation[]> {
    // Verify access
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          select: { userId: true },
        },
        tasks: {
          select: { id: true },
        },
      },
    })

    if (!meeting) {
      throw new NotFoundError('Meeting not found')
    }

    if (meeting.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    // Estimate each task
    const estimations: ComplexityEstimation[] = []
    for (const task of meeting.tasks) {
      const estimation = await this.estimateTask(task.id, userId, config)
      estimations.push(estimation)
    }

    return estimations
  }

  /**
   * Analyze task text and extract complexity factors
   */
  private static analyzeTaskFactors(
    title: string,
    description: string,
    projectFilesCount: number
  ): ComplexityFactors {
    const fullText = `${title} ${description}`.toLowerCase()
    const words = fullText.split(/\s+/)

    return {
      scopeIndicators: this.countPatternMatches(fullText, COMPLEXITY_PATTERNS.scopeIndicators),
      techKeywords: this.countPatternMatches(fullText, COMPLEXITY_PATTERNS.techKeywords),
      crossCutting: this.countPatternMatches(fullText, COMPLEXITY_PATTERNS.crossCutting),
      descriptionLength: Math.min(words.length / 100, 1), // Normalize to 0-1
      questionWords: this.countPatternMatches(fullText, COMPLEXITY_PATTERNS.uncertainty),
      fileTypesDiversity: this.estimateFileTypesDiversity(fullText),
      estimatedFilesCount: this.estimateFilesFromDescription(fullText, projectFilesCount),
    }
  }

  /**
   * Count pattern matches in text
   */
  private static countPatternMatches(text: string, patterns: string[]): number {
    let count = 0
    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi')
      const matches = text.match(regex)
      if (matches) {
        count += matches.length
      }
    }
    return Math.min(count, 5) // Cap at 5 for normalization
  }

  /**
   * Estimate file types diversity from description
   */
  private static estimateFileTypesDiversity(text: string): number {
    const fileTypes = [
      'component', 'hook', 'service', 'api', 'route',
      'model', 'type', 'util', 'config', 'test',
      'style', 'css', 'scss', 'middleware', 'controller',
    ]

    let diversity = 0
    for (const type of fileTypes) {
      if (text.includes(type)) {
        diversity++
      }
    }

    return Math.min(diversity, 5) // Cap at 5
  }

  /**
   * Estimate number of files to modify from description
   */
  private static estimateFilesFromDescription(text: string, projectFilesCount: number): number {
    // Base estimate on keywords
    let estimate = 1

    // Scope multipliers
    if (text.includes('all') || text.includes('every')) {
      estimate = Math.ceil(projectFilesCount * 0.2) // 20% of files
    } else if (text.includes('multiple') || text.includes('several')) {
      estimate = 5
    } else if (text.includes('few')) {
      estimate = 3
    }

    // Feature-specific estimates
    if (text.includes('authentication') || text.includes('auth')) {
      estimate = Math.max(estimate, 8)
    }
    if (text.includes('database') || text.includes('migration')) {
      estimate = Math.max(estimate, 6)
    }
    if (text.includes('api') && text.includes('endpoint')) {
      estimate = Math.max(estimate, 4)
    }

    return Math.min(estimate, 50) // Cap at 50
  }

  /**
   * Calculate final complexity from factors
   */
  private static calculateComplexity(
    factors: ComplexityFactors,
    config: EstimationConfig
  ): ComplexityEstimation {
    const { weights, thresholds } = config

    // Calculate weighted score
    const score =
      (factors.scopeIndicators / 5) * weights.scopeIndicators +
      (factors.techKeywords / 5) * weights.techKeywords +
      (factors.crossCutting / 5) * weights.crossCutting +
      factors.descriptionLength * weights.descriptionLength +
      (factors.questionWords / 5) * weights.questionWords +
      (factors.fileTypesDiversity / 5) * weights.fileTypesDiversity +
      Math.min(factors.estimatedFilesCount / 20, 1) * weights.estimatedFilesCount

    // Determine complexity level
    let complexity: TaskComplexity
    if (score <= thresholds.simple) {
      complexity = 'simple'
    } else if (score <= thresholds.moderate) {
      complexity = 'moderate'
    } else {
      complexity = 'critical'
    }

    // Calculate confidence based on factor consistency
    const confidence = this.calculateConfidence(factors, complexity)

    // Generate reasoning
    const reasoning = this.generateReasoning(factors, complexity, score)

    return {
      complexity,
      score: Math.round(score),
      confidence,
      factors,
      reasoning,
      suggestedFilesCount: factors.estimatedFilesCount,
    }
  }

  /**
   * Calculate confidence in the estimation
   */
  private static calculateConfidence(
    factors: ComplexityFactors,
    _complexity: TaskComplexity
  ): number {
    // Higher confidence when factors align
    let confidence = 0.5 // Base confidence

    // If we have clear indicators
    if (factors.scopeIndicators > 2 || factors.techKeywords > 2) {
      confidence += 0.2
    }

    // If description provides good context
    if (factors.descriptionLength > 0.5) {
      confidence += 0.1
    }

    // If files estimate is reasonable
    if (factors.estimatedFilesCount >= 1 && factors.estimatedFilesCount <= 20) {
      confidence += 0.1
    }

    // Reduce confidence if many uncertainty words
    if (factors.questionWords > 2) {
      confidence -= 0.2
    }

    return Math.max(0.2, Math.min(confidence, 0.95))
  }

  /**
   * Generate human-readable reasoning
   */
  private static generateReasoning(
    factors: ComplexityFactors,
    complexity: TaskComplexity,
    score: number
  ): string {
    const reasons: string[] = []

    if (factors.scopeIndicators > 2) {
      reasons.push('broad scope indicated by keywords')
    }

    if (factors.techKeywords > 2) {
      reasons.push('involves complex technical areas')
    }

    if (factors.crossCutting > 2) {
      reasons.push('affects multiple system areas')
    }

    if (factors.estimatedFilesCount > 10) {
      reasons.push(`estimated to impact ${factors.estimatedFilesCount}+ files`)
    } else if (factors.estimatedFilesCount <= 3) {
      reasons.push('limited file impact expected')
    }

    if (factors.questionWords > 1) {
      reasons.push('contains uncertainty indicators')
    }

    const reasonStr = reasons.length > 0
      ? reasons.join(', ')
      : 'standard complexity indicators'

    return `Estimated as ${complexity} (score: ${Math.round(score)}/100): ${reasonStr}.`
  }

  /**
   * Suggest impacted files based on task and stack
   */
  private static suggestImpactedFiles(
    title: string,
    description: string,
    stack: Record<string, unknown>
  ): string[] {
    const text = `${title} ${description}`.toLowerCase()
    const suggestions: string[] = []

    // Framework-specific suggestions
    if (stack['nextjs'] || stack['react']) {
      if (text.includes('component')) {
        suggestions.push('src/components/...')
      }
      if (text.includes('api') || text.includes('endpoint')) {
        suggestions.push('src/app/api/... or src/pages/api/...')
      }
      if (text.includes('hook')) {
        suggestions.push('src/hooks/...')
      }
    }

    if (stack['hono'] || stack['express']) {
      if (text.includes('route') || text.includes('endpoint')) {
        suggestions.push('src/routes/...')
      }
      if (text.includes('middleware')) {
        suggestions.push('src/middlewares/...')
      }
    }

    // Generic suggestions
    if (text.includes('service')) {
      suggestions.push('src/services/...')
    }
    if (text.includes('type') || text.includes('interface')) {
      suggestions.push('src/types/...')
    }
    if (text.includes('test')) {
      suggestions.push('tests/... or __tests__/...')
    }
    if (text.includes('config')) {
      suggestions.push('src/config/... or *.config.ts')
    }

    return suggestions.slice(0, 5) // Limit to 5 suggestions
  }

  /**
   * Get complexity distribution for a project
   */
  static async getProjectComplexityStats(
    projectId: string,
    userId: string
  ): Promise<{
    total: number
    byComplexity: Record<TaskComplexity, number>
    averageFilesCount: number
  }> {
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

    const tasks = await db.task.findMany({
      where: { projectId },
      select: {
        complexity: true,
        estimatedFilesCount: true,
      },
    })

    const byComplexity: Record<TaskComplexity, number> = {
      simple: 0,
      moderate: 0,
      critical: 0,
    }

    let totalFilesCount = 0
    let tasksWithFilesCount = 0

    for (const task of tasks) {
      byComplexity[task.complexity]++
      if (task.estimatedFilesCount) {
        totalFilesCount += task.estimatedFilesCount
        tasksWithFilesCount++
      }
    }

    return {
      total: tasks.length,
      byComplexity,
      averageFilesCount: tasksWithFilesCount > 0
        ? Math.round(totalFilesCount / tasksWithFilesCount)
        : 0,
    }
  }
}
