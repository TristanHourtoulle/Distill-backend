import Anthropic from '@anthropic-ai/sdk'
import { TaskType, TaskComplexity, Prisma } from '@prisma/client'
import { db } from '../lib/db.js'
import { ValidationError, AppError } from '../lib/errors.js'
import type {
  ExtractedTask,
  ParsedMeetingResult,
  ParsingConfig,
  ParsingProgressCallback,
} from '../types/parsing.types.js'
import { DEFAULT_PARSING_CONFIG } from '../types/parsing.types.js'

/**
 * Parsing Service
 * Handles LLM-based meeting content parsing and task extraction
 */
export class ParsingService {
  private static client: Anthropic | null = null

  /**
   * Get or create Anthropic client
   */
  private static getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env['ANTHROPIC_API_KEY']
      if (!apiKey) {
        throw new AppError('ANTHROPIC_API_KEY not configured', 500, 'CONFIG_ERROR')
      }
      this.client = new Anthropic({ apiKey })
    }
    return this.client
  }

  /**
   * Build system prompt for task extraction
   */
  private static buildSystemPrompt(projectContext?: string): string {
    return `You are an expert software project manager. Your task is to analyze meeting notes or summaries and extract actionable development tasks.

${projectContext ? `Project Context:\n${projectContext}\n\n` : ''}

Rules:
1. Extract ONLY development tasks (features, bugfixes, modifications, refactoring, documentation)
2. Each task must be specific and actionable
3. Estimate complexity based on scope (simple: 1-3 files, moderate: 4-10 files, critical: 10+ files)
4. Assign priority from 0 (highest) to N (lowest) based on discussion order and urgency
5. Include brief description of what needs to be done
6. If a file or component is mentioned, include it in impactedFilesPreview

Task Types:
- feature: New functionality
- bugfix: Bug fixes
- modification: Changes to existing features
- refactor: Code improvements without feature changes
- documentation: Docs, comments, README updates

Complexity Levels:
- simple: Small, isolated changes (1-3 files)
- moderate: Medium scope changes (4-10 files)
- critical: Large, cross-cutting changes (10+ files)

Respond with a valid JSON object containing:
{
  "summary": "Brief summary of the meeting/notes",
  "tasks": [
    {
      "title": "Task title (imperative, e.g., 'Add user authentication')",
      "description": "Detailed description of what needs to be done",
      "type": "feature|bugfix|modification|refactor|documentation",
      "complexity": "simple|moderate|critical",
      "priority": 0,
      "estimatedFilesCount": 5,
      "impactedFilesPreview": ["src/auth/...", "src/api/..."]
    }
  ],
  "metadata": {
    "participantsDetected": ["Name1", "Name2"],
    "topicsDiscussed": ["Topic1", "Topic2"],
    "decisionsMade": ["Decision1", "Decision2"]
  }
}

Only respond with valid JSON, no additional text.`
  }

  /**
   * Parse meeting content and extract tasks
   */
  static async parseMeeting(
    meetingId: string,
    userId: string,
    config: Partial<ParsingConfig> = {},
    onProgress?: ParsingProgressCallback
  ): Promise<ParsedMeetingResult> {
    const client = this.getClient()
    const fullConfig = { ...DEFAULT_PARSING_CONFIG, ...config }

    onProgress?.('loading', 'Loading meeting data...')

    // Get meeting with project info
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          select: {
            id: true,
            userId: true,
            name: true,
            description: true,
            detectedStack: true,
          },
        },
      },
    })

    if (!meeting) {
      throw new ValidationError('Meeting not found')
    }

    if (meeting.project.userId !== userId) {
      throw new ValidationError('Access denied')
    }

    if (meeting.status === 'processing') {
      throw new ValidationError('Meeting is already being processed')
    }

    // Update status to processing
    await db.meeting.update({
      where: { id: meetingId },
      data: { status: 'processing' },
    })

    try {
      onProgress?.('parsing', 'Extracting tasks from meeting content...')

      // Build project context
      const stack = meeting.project.detectedStack as Record<string, unknown> | null
      const projectContext = [
        `Project: ${meeting.project.name}`,
        meeting.project.description ? `Description: ${meeting.project.description}` : null,
        stack ? `Tech Stack: ${JSON.stringify(stack)}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      // Call Claude API
      const response = await client.messages.create({
        model: fullConfig.model,
        max_tokens: fullConfig.maxTokens,
        temperature: fullConfig.temperature,
        system: this.buildSystemPrompt(projectContext),
        messages: [
          {
            role: 'user',
            content: `Please analyze the following meeting notes and extract development tasks:\n\n${meeting.rawContent}`,
          },
        ],
      })

      onProgress?.('processing', 'Processing LLM response...')

      // Extract text content
      const textContent = response.content.find((block) => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new ValidationError('Invalid response from LLM')
      }

      // Debug: log Claude's raw response
      console.log('=== Claude Response ===')
      console.log(textContent.text)
      console.log('=== End Claude Response ===')

      // Parse JSON response
      let parsed: ParsedMeetingResult
      try {
        let jsonStr = textContent.text.trim()

        // Handle markdown code blocks (```json ... ``` or ``` ... ```)
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonStr = codeBlockMatch[1].trim()
        }
        const rawParsed = JSON.parse(jsonStr) as {
          summary: string
          tasks: Array<{
            title: string
            description: string
            type: string
            complexity: string
            priority: number
            estimatedFilesCount?: number
            impactedFilesPreview?: string[]
          }>
          metadata: {
            participantsDetected?: string[]
            topicsDiscussed?: string[]
            decisionsMade?: string[]
          }
        }

        // Validate and normalize tasks
        const tasks: ExtractedTask[] = rawParsed.tasks.map((task, index) => ({
          title: task.title,
          description: task.description,
          type: this.normalizeTaskType(task.type),
          complexity: this.normalizeComplexity(task.complexity),
          priority: task.priority ?? index,
          estimatedFilesCount: task.estimatedFilesCount,
          impactedFilesPreview: task.impactedFilesPreview,
        }))

        parsed = {
          summary: rawParsed.summary,
          tasks,
          metadata: {
            participantsDetected: rawParsed.metadata?.participantsDetected,
            topicsDiscussed: rawParsed.metadata?.topicsDiscussed,
            decisionsmade: rawParsed.metadata?.decisionsMade,
          },
          tokensUsed: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
          },
        }
      } catch {
        throw new ValidationError('Failed to parse LLM response as JSON')
      }

      onProgress?.('saving', 'Saving extracted tasks...')

      // Save tasks to database
      await this.saveParsedTasks(meetingId, meeting.project.id, parsed.tasks)

      // Update meeting with parsed summary
      await db.meeting.update({
        where: { id: meetingId },
        data: {
          parsedSummary: parsed.summary,
          status: 'completed',
          metadata: parsed.metadata as unknown as Prisma.InputJsonValue,
        },
      })

      onProgress?.('complete', `Extracted ${parsed.tasks.length} tasks`)

      return parsed
    } catch (error) {
      // Update status to error
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: 'error' },
      })

      throw error
    }
  }

  /**
   * Save extracted tasks to database
   */
  private static async saveParsedTasks(
    meetingId: string,
    projectId: string,
    tasks: ExtractedTask[]
  ): Promise<void> {
    // Delete existing tasks for this meeting (re-parsing)
    await db.task.deleteMany({
      where: { meetingId },
    })

    // Create new tasks
    for (const task of tasks) {
      const createData: Prisma.TaskCreateInput = {
        meeting: { connect: { id: meetingId } },
        project: { connect: { id: projectId } },
        title: task.title,
        description: task.description,
        type: task.type,
        complexity: task.complexity,
        priority: task.priority,
        status: 'pending',
      }

      // Only add optional fields if they have values
      if (task.estimatedFilesCount !== undefined) {
        createData.estimatedFilesCount = task.estimatedFilesCount
      }

      if (task.impactedFilesPreview !== undefined) {
        createData.impactedFilesPreview = task.impactedFilesPreview as unknown as Prisma.InputJsonValue
      }

      await db.task.create({ data: createData })
    }
  }

  /**
   * Normalize task type string to enum
   */
  private static normalizeTaskType(type: string): TaskType {
    const normalized = type.toLowerCase().trim()
    const validTypes: TaskType[] = ['feature', 'bugfix', 'modification', 'documentation', 'refactor']

    if (validTypes.includes(normalized as TaskType)) {
      return normalized as TaskType
    }

    // Map common variations
    if (normalized.includes('bug') || normalized.includes('fix')) return 'bugfix'
    if (normalized.includes('doc')) return 'documentation'
    if (normalized.includes('refactor')) return 'refactor'
    if (normalized.includes('modif') || normalized.includes('change')) return 'modification'

    return 'feature' // Default
  }

  /**
   * Normalize complexity string to enum
   */
  private static normalizeComplexity(complexity: string): TaskComplexity {
    const normalized = complexity.toLowerCase().trim()

    if (normalized === 'simple' || normalized === 'easy' || normalized === 'low') {
      return 'simple'
    }

    if (normalized === 'critical' || normalized === 'complex' || normalized === 'high') {
      return 'critical'
    }

    return 'moderate' // Default
  }

  /**
   * Re-parse a meeting (useful for improving extraction)
   */
  static async reparseMeeting(
    meetingId: string,
    userId: string,
    config: Partial<ParsingConfig> = {}
  ): Promise<ParsedMeetingResult> {
    // Simply call parseMeeting - it handles deleting old tasks
    return this.parseMeeting(meetingId, userId, config)
  }
}
