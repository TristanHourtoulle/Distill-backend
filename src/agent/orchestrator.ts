/**
 * Agent Orchestrator
 * Manages the LLM agent loop for task analysis
 */

import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam, TextBlock } from '@anthropic-ai/sdk/resources/messages.js'
import { db } from '../lib/db.js'
import { AppError } from '../lib/errors.js'
import { buildSystemPrompt } from './prompts.js'
import { getAnthropicTools, executeTool, formatToolResult, type ToolName } from './tools/index.js'
import type { AgentContext, ToolResult } from '../types/agent.types.js'

/**
 * Analysis result structure
 */
export interface AnalysisResult {
  summary: string
  filesToCreate: Array<{
    path: string
    description: string
    template?: string | undefined
  }>
  filesToModify: Array<{
    path: string
    changes: Array<{
      location: string
      description: string
      reason: string
    }>
  }>
  implementationSteps: Array<{
    order: number
    description: string
    files: string[]
  }>
  risks: Array<{
    description: string
    mitigation: string
  }>
  dependencies: string[]
  testingRecommendations: string[]
}

/**
 * Agent execution statistics
 */
export interface AgentStats {
  iterations: number
  toolCalls: number
  tokensUsed: {
    input: number
    output: number
  }
  durationMs: number
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  model: string
  maxTokens: number
  maxIterations: number
  temperature: number
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  maxIterations: 25,
  temperature: 0.3,
}

/**
 * Progress callback for tracking agent progress
 */
export type AgentProgressCallback = (
  phase: string,
  message: string,
  stats: Partial<AgentStats>
) => void

/**
 * Agent Orchestrator Service
 */
export class AgentOrchestrator {
  private client: Anthropic
  private config: OrchestratorConfig

  constructor(config: Partial<OrchestratorConfig> = {}) {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) {
      throw new AppError('ANTHROPIC_API_KEY not configured', 500, 'CONFIG_ERROR')
    }

    this.client = new Anthropic({ apiKey })
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config }
  }

  /**
   * Run the agent to analyze a task
   */
  async analyzeTask(
    taskId: string,
    userId: string,
    onProgress?: AgentProgressCallback
  ): Promise<{ result: AnalysisResult; stats: AgentStats; logs: ToolResult[] }> {
    const startTime = Date.now()
    const toolLogs: ToolResult[] = []
    let totalInputTokens = 0
    let totalOutputTokens = 0

    onProgress?.('loading', 'Loading task and project data...', {})

    // Load task with project context
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            userId: true,
            name: true,
            description: true,
            githubOwner: true,
            githubRepoName: true,
            preferredBranch: true,
            detectedStack: true,
          },
        },
        meeting: {
          select: {
            referenceBranch: true,
          },
        },
      },
    })

    if (!task) {
      throw new AppError('Task not found', 404, 'NOT_FOUND')
    }

    if (task.project.userId !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN')
    }

    // Get indexed files count
    const indexedFilesCount = await db.projectIndex.count({
      where: { projectId: task.projectId },
    })

    // Build agent context
    const agentContext: AgentContext = {
      projectId: task.projectId,
      userId,
      owner: task.project.githubOwner,
      repo: task.project.githubRepoName,
      branch: task.meeting?.referenceBranch || task.project.preferredBranch,
      detectedStack: task.project.detectedStack as Record<string, unknown> | undefined,
      indexedFilesCount,
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      {
        name: task.project.name,
        description: task.project.description ?? undefined,
        detectedStack: task.project.detectedStack as Record<string, unknown> | undefined,
        branch: agentContext.branch,
        indexedFilesCount,
      },
      {
        title: task.title,
        description: task.description,
        type: task.type,
        complexity: task.complexity,
      }
    )

    // Initialize messages
    const messages: MessageParam[] = [
      {
        role: 'user',
        content: `Please analyze this task and provide implementation guidance: "${task.title}"`,
      },
    ]

    // Get tools
    const tools = getAnthropicTools()

    onProgress?.('analyzing', 'Starting analysis...', { iterations: 0, toolCalls: 0 })

    let iterations = 0

    // Agent loop
    while (iterations < this.config.maxIterations) {
      iterations++

      onProgress?.('analyzing', `Iteration ${iterations}...`, {
        iterations,
        toolCalls: toolLogs.length,
      })

      // Call Claude
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        tools,
        messages,
      })

      // Track tokens
      totalInputTokens += response.usage.input_tokens
      totalOutputTokens += response.usage.output_tokens

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Extract final response
        const textContent = response.content.find(
          (block): block is TextBlock => block.type === 'text'
        )

        if (!textContent) {
          throw new AppError('No text response from agent', 500, 'AGENT_ERROR')
        }

        onProgress?.('parsing', 'Parsing analysis result...', {
          iterations,
          toolCalls: toolLogs.length,
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
        })

        // Parse the result
        const result = this.parseAnalysisResult(textContent.text)

        const stats: AgentStats = {
          iterations,
          toolCalls: toolLogs.length,
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
          durationMs: Date.now() - startTime,
        }

        onProgress?.('complete', 'Analysis complete', stats)

        return { result, stats, logs: toolLogs }
      }

      if (response.stop_reason === 'tool_use') {
        // Execute tools
        const toolUseBlocks = response.content.filter(
          (block): block is ToolUseBlock => block.type === 'tool_use'
        )

        // Add assistant message with tool uses
        messages.push({
          role: 'assistant',
          content: response.content as ContentBlock[],
        })

        // Execute each tool and collect results
        const toolResults: ToolResultBlockParam[] = []

        for (const toolUse of toolUseBlocks) {
          onProgress?.('tool', `Executing ${toolUse.name}...`, {
            iterations,
            toolCalls: toolLogs.length + 1,
          })

          const toolResult = await executeTool(
            toolUse.name as ToolName,
            toolUse.input,
            agentContext
          )

          toolLogs.push(toolResult)

          // Format result for Claude
          const formattedResult = toolResult.error
            ? `Error: ${toolResult.error}`
            : formatToolResult(toolResult)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: formattedResult,
          })
        }

        // Add tool results as user message
        messages.push({
          role: 'user',
          content: toolResults,
        })
      } else {
        // Unexpected stop reason
        throw new AppError(
          `Unexpected agent stop reason: ${response.stop_reason}`,
          500,
          'AGENT_ERROR'
        )
      }
    }

    // Max iterations reached
    throw new AppError(
      `Agent exceeded maximum iterations (${this.config.maxIterations})`,
      500,
      'AGENT_TIMEOUT'
    )
  }

  /**
   * Parse the analysis result from Claude's response
   */
  private parseAnalysisResult(text: string): AnalysisResult {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch?.[1] ?? text

    try {
      const parsed = JSON.parse(jsonStr.trim()) as Partial<AnalysisResult>

      // Provide defaults for missing fields
      return {
        summary: parsed.summary || 'Analysis completed',
        filesToCreate: parsed.filesToCreate || [],
        filesToModify: parsed.filesToModify || [],
        implementationSteps: parsed.implementationSteps || [],
        risks: parsed.risks || [],
        dependencies: parsed.dependencies || [],
        testingRecommendations: parsed.testingRecommendations || [],
      }
    } catch {
      // If JSON parsing fails, try to extract structured info from text
      return {
        summary: text.substring(0, 500),
        filesToCreate: [],
        filesToModify: [],
        implementationSteps: [],
        risks: [
          {
            description: 'Could not parse structured response',
            mitigation: 'Review the raw analysis output manually',
          },
        ],
        dependencies: [],
        testingRecommendations: [],
      }
    }
  }
}

/**
 * Create and run the agent for a task
 */
export async function runAgentAnalysis(
  taskId: string,
  userId: string,
  config?: Partial<OrchestratorConfig>,
  onProgress?: AgentProgressCallback
): Promise<{ result: AnalysisResult; stats: AgentStats; logs: ToolResult[] }> {
  const orchestrator = new AgentOrchestrator(config)
  return orchestrator.analyzeTask(taskId, userId, onProgress)
}
