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
import type { StreamEvent, StreamEventEmitter } from '../types/streaming.types.js'

/**
 * Analysis result structure (enhanced for detailed GitHub Issues)
 */
export interface AnalysisResult {
  // Core fields
  taskType: string
  summary: string
  context: string
  expectedBehavior: string

  // Acceptance criteria
  acceptanceCriteria: string[]

  // Files
  filesToCreate: Array<{
    path: string
    description: string
    suggestedCode?: string | undefined
  }>
  filesToModify: Array<{
    path: string
    changes: Array<{
      location: string
      action: 'add' | 'modify' | 'remove'
      description: string
      reason: string
      beforeCode?: string | undefined
      afterCode?: string | undefined
    }>
  }>

  // Functions/Components to create (enhanced with input/output examples)
  functionsToCreate: Array<{
    name: string
    signature: string
    description: string
    location: string // Legacy field
    file?: string | undefined
    lineToInsert?: string | undefined
    implementation?: string | undefined
    inputExample?: {
      description: string
      value: string
    }
    outputExample?: {
      description: string
      value: string
    }
    whyThisApproach?: string | undefined
  }>

  // Implementation steps
  implementationSteps: Array<{
    order: number
    title: string
    description: string
    rationale?: string | undefined
    files: string[]
    codeExample?: string | undefined
  }>

  // Edge cases (enhanced with input/implementation)
  edgeCases: Array<{
    scenario: string
    expectedBehavior: string
    input?: string | undefined
    implementation?: string | undefined
  }>

  // Testing (legacy field)
  testingInstructions: Array<{
    type: 'unit' | 'integration' | 'manual'
    description: string
    steps: string[]
  }>

  // Test cases (new enhanced field)
  testCases?: Array<{
    name: string
    type: 'unit' | 'integration' | 'e2e'
    file?: string | undefined
    testCode?: string | undefined
    assertion?: string | undefined
    steps?: string[] | undefined
  }>

  // Code quality checks
  codeQualityChecks?: Array<{
    check: string
    command: string
    expectedResult: string
  }>

  // Risks (enhanced with affected files)
  risks: Array<{
    description: string
    severity: 'low' | 'medium' | 'high'
    mitigation: string
    affectedFiles?: string[] | undefined
  }>

  // Dependencies
  dependencies: string[]

  // Breaking changes
  breakingChanges: {
    hasBreakingChanges: boolean
    description?: string | undefined
    migrationSteps?: string[] | undefined
  }

  // Metadata
  metadata: {
    estimatedEffort: string
    affectedComponents: string[]
    requiresTests: boolean
    requiresDocumentation: boolean
  }

  // Bug-specific fields (optional, enhanced)
  bugAnalysis?: {
    rootCause: string
    rootCauseExplanation?: string | undefined
    problematicCode?: {
      file: string
      lines: string
      code: string
    }
    reproductionSteps: string[]
  }
  fix?: {
    approach: string
    whyThisApproach?: string | undefined
    codeDiff?: {
      before: string
      after: string
    }
    alternatives?: Array<{
      approach: string
      whyNotChosen: string
    }>
  }
  regressionRisks?: Array<{
    area: string
    mitigation: string
    testToAdd?: string | undefined
  }>

  // Modification-specific fields (optional, enhanced)
  currentState?: string
  targetState?: string
  impactAnalysis?: {
    directlyAffected: string[] | Array<{ file: string; lines?: string; reason: string }>
    potentiallyAffected: string[] | Array<{ file: string; reason: string }>
    noChangeNeeded: string[]
  }
  backwardsCompatibility?: {
    isCompatible: boolean
    breakingChanges: string[]
    migrationRequired: boolean
    migrationSteps?: string[] | undefined
  }
  beforeAfterExamples?: Array<{
    scenario: string
    before: string
    after: string
  }>

  // Legacy fields for backwards compatibility
  testingRecommendations?: string[]
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
  model: 'claude-3-5-haiku-20241022', // Haiku: ~10x cheaper than Sonnet, faster, max 8192 output tokens
  maxTokens: 8192,
  maxIterations: 25,
  temperature: 0.3,
}

/**
 * Progress callback for tracking agent progress (legacy)
 */
export type AgentProgressCallback = (
  phase: string,
  message: string,
  stats: Partial<AgentStats>
) => void

/**
 * Streaming callback options
 */
export interface StreamingOptions {
  /** Emit streaming events for real-time updates */
  onStreamEvent?: StreamEventEmitter
  /** Include detailed tool results in stream */
  includeToolResults?: boolean
  /** Include AI thinking/text content in stream */
  includeThinking?: boolean
}

/**
 * Helper to create a stream event with timestamp
 */
function createStreamEvent<T extends StreamEvent['type']>(
  type: T,
  data: Omit<Extract<StreamEvent, { type: T }>, 'type' | 'timestamp'>
): Extract<StreamEvent, { type: T }> {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as Extract<StreamEvent, { type: T }>
}

/**
 * Get a human-readable description for a tool
 */
function getToolDescription(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'list_dir':
      return `Exploring directory: ${input['path'] || '/'}`
    case 'read_file':
      return `Reading file: ${input['path']}`
    case 'search_code':
      return `Searching for: "${input['pattern']}" in ${input['path'] || 'codebase'}`
    case 'get_imports':
      return `Analyzing imports in: ${input['path']}`
    default:
      return `Executing ${toolName}`
  }
}

/**
 * Summarize tool result for streaming
 */
function summarizeToolResult(toolName: string, result: ToolResult): string {
  if (result.error) {
    return `Error: ${result.error}`
  }

  switch (toolName) {
    case 'list_dir': {
      const output = result.output as { files?: string[]; directories?: string[] }
      const fileCount = output.files?.length || 0
      const dirCount = output.directories?.length || 0
      return `Found ${fileCount} files and ${dirCount} directories`
    }
    case 'read_file': {
      const output = result.output as { content?: string; lineCount?: number }
      return `Read ${output.lineCount || 'unknown'} lines`
    }
    case 'search_code': {
      const output = result.output as { matches?: unknown[] }
      return `Found ${output.matches?.length || 0} matches`
    }
    case 'get_imports': {
      const output = result.output as { imports?: string[] }
      return `Found ${output.imports?.length || 0} imports`
    }
    default:
      return 'Completed'
  }
}

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
    onProgress?: AgentProgressCallback,
    streaming?: StreamingOptions
  ): Promise<{ result: AnalysisResult; stats: AgentStats; logs: ToolResult[] }> {
    const startTime = Date.now()
    const toolLogs: ToolResult[] = []
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let analysisId: string | undefined

    // Helper to emit stream events
    const emit = (event: StreamEvent) => {
      streaming?.onStreamEvent?.(event)
    }

    // Emit initial phase
    emit(createStreamEvent('phase', {
      phase: 'initializing',
      message: 'Starting analysis...',
    }))

    onProgress?.('loading', 'Loading task and project data...', {})
    emit(createStreamEvent('phase', {
      phase: 'loading',
      message: 'Loading task and project data...',
    }))

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
    emit(createStreamEvent('phase', {
      phase: 'analyzing',
      message: 'AI is analyzing the codebase...',
      analysisId,
    }))

    let iterations = 0

    // Agent loop
    while (iterations < this.config.maxIterations) {
      iterations++

      onProgress?.('analyzing', `Iteration ${iterations}...`, {
        iterations,
        toolCalls: toolLogs.length,
      })

      // Emit progress event
      emit(createStreamEvent('progress', {
        iteration: iterations,
        toolCalls: toolLogs.length,
        tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
        durationMs: Date.now() - startTime,
        analysisId,
      }))

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

        emit(createStreamEvent('phase', {
          phase: 'parsing',
          message: 'Processing analysis results...',
          analysisId,
        }))

        // Emit thinking content if enabled
        if (streaming?.includeThinking) {
          emit(createStreamEvent('thinking', {
            content: textContent.text.substring(0, 500) + (textContent.text.length > 500 ? '...' : ''),
            isPartial: textContent.text.length > 500,
            analysisId,
          }))
        }

        // Parse the result
        const result = this.parseAnalysisResult(textContent.text)

        const stats: AgentStats = {
          iterations,
          toolCalls: toolLogs.length,
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
          durationMs: Date.now() - startTime,
        }

        // Emit file discovered events
        for (const file of result.filesToCreate) {
          emit(createStreamEvent('file_discovered', {
            action: 'create',
            path: file.path,
            description: file.description,
            analysisId,
          }))
        }
        for (const file of result.filesToModify) {
          emit(createStreamEvent('file_discovered', {
            action: 'modify',
            path: file.path,
            analysisId,
          }))
        }

        onProgress?.('complete', 'Analysis complete', stats)

        emit(createStreamEvent('phase', {
          phase: 'complete',
          message: 'Analysis complete',
          analysisId,
        }))

        emit(createStreamEvent('result', {
          analysisId: analysisId || '',
          summary: result.summary,
          stats: {
            iterations: stats.iterations,
            toolCalls: stats.toolCalls,
            tokensUsed: stats.tokensUsed,
            durationMs: stats.durationMs,
            filesToCreate: result.filesToCreate.length,
            filesToModify: result.filesToModify.length,
          },
        }))

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
          const toolInput = toolUse.input as Record<string, unknown>

          onProgress?.('tool', `Executing ${toolUse.name}...`, {
            iterations,
            toolCalls: toolLogs.length + 1,
          })

          // Emit tool_call event
          emit(createStreamEvent('tool_call', {
            tool: toolUse.name,
            input: toolInput,
            description: getToolDescription(toolUse.name, toolInput),
            analysisId,
          }))

          emit(createStreamEvent('phase', {
            phase: 'tool_execution',
            message: getToolDescription(toolUse.name, toolInput),
            analysisId,
          }))

          const toolStartTime = Date.now()
          const toolResult = await executeTool(
            toolUse.name as ToolName,
            toolUse.input,
            agentContext
          )

          toolLogs.push(toolResult)

          // Emit tool_result event
          if (streaming?.includeToolResults !== false) {
            emit(createStreamEvent('tool_result', {
              tool: toolUse.name,
              success: !toolResult.error,
              summary: summarizeToolResult(toolUse.name, toolResult),
              durationMs: Date.now() - toolStartTime,
              analysisId,
            }))
          }

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
   * Try to fix truncated JSON by closing open brackets
   */
  private tryFixTruncatedJson(jsonStr: string): string {
    // Step 1: Count open brackets and detect string state
    let openBraces = 0
    let openBrackets = 0
    let inString = false
    let escapeNext = false

    for (const char of jsonStr) {
      if (escapeNext) {
        escapeNext = false
        continue
      }

      if (char === '\\') {
        escapeNext = true
        continue
      }

      if (char === '"') {
        inString = !inString
        continue
      }

      if (!inString) {
        if (char === '{') openBraces++
        if (char === '}') openBraces--
        if (char === '[') openBrackets++
        if (char === ']') openBrackets--
      }
    }

    // Step 2: If we're in a string, close it
    if (inString) {
      jsonStr += '"'
    }

    // Step 3: Clean up incomplete patterns BEFORE closing brackets
    // This is critical - we need to remove orphan keys/values first

    // Remove orphan key at the very end (key without colon): ,"keyName"
    jsonStr = jsonStr.replace(/,\s*"[^"]*"\s*$/, '')

    // Remove incomplete key-value (key with colon but no value): ,"keyName":
    jsonStr = jsonStr.replace(/,\s*"[^"]*"\s*:\s*$/, '')

    // Remove incomplete string value: ,"key": "partial
    // After closing quote, we might have: ,"key": "partial"
    // If the value looks incomplete (short, no proper ending), remove the whole pair
    jsonStr = jsonStr.replace(/,\s*"[^"]*"\s*:\s*"[^"]{0,20}"\s*$/, '')

    // Remove incomplete array value: ,"key": [
    jsonStr = jsonStr.replace(/,\s*"[^"]*"\s*:\s*\[\s*$/, '')

    // Remove incomplete object value: ,"key": {
    jsonStr = jsonStr.replace(/,\s*"[^"]*"\s*:\s*\{\s*$/, '')

    // Remove incomplete number/boolean/null: ,"key": 123 or ,"key": tru or ,"key": nul
    jsonStr = jsonStr.replace(/,\s*"[^"]*"\s*:\s*[a-z0-9.]+\s*$/i, '')

    // Step 4: Now close any unclosed brackets/braces
    // Recount after cleanup
    openBraces = 0
    openBrackets = 0
    inString = false
    escapeNext = false

    for (const char of jsonStr) {
      if (escapeNext) {
        escapeNext = false
        continue
      }
      if (char === '\\') {
        escapeNext = true
        continue
      }
      if (char === '"') {
        inString = !inString
        continue
      }
      if (!inString) {
        if (char === '{') openBraces++
        if (char === '}') openBraces--
        if (char === '[') openBrackets++
        if (char === ']') openBrackets--
      }
    }

    while (openBrackets > 0) {
      jsonStr += ']'
      openBrackets--
    }
    while (openBraces > 0) {
      jsonStr += '}'
      openBraces--
    }

    // Step 5: Final cleanup - remove trailing commas before closing brackets
    jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1')

    return jsonStr
  }

  /**
   * Parse the analysis result from Claude's response
   */
  private parseAnalysisResult(text: string): AnalysisResult {
    // Strategy: Find JSON content regardless of any prose the model wrote
    let jsonStr = ''

    // Method 1: Complete code block ```json ... ```
    const completeBlock = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (completeBlock && completeBlock[1]) {
      jsonStr = completeBlock[1]
    }

    // Method 2: Incomplete code block (truncated) ```json ...
    if (!jsonStr) {
      const incompleteBlock = text.match(/```json\s*([\s\S]*)/)
      if (incompleteBlock && incompleteBlock[1]) {
        jsonStr = incompleteBlock[1]
      }
    }

    // Method 3: Look for JSON starting with { "taskType" (our expected format)
    if (!jsonStr) {
      const taskTypeMatch = text.match(/\{\s*"taskType"[\s\S]*/)
      if (taskTypeMatch) {
        jsonStr = taskTypeMatch[0]
      }
    }

    // Method 4: Find any JSON object starting with {
    if (!jsonStr) {
      const jsonStart = text.indexOf('{')
      if (jsonStart !== -1) {
        jsonStr = text.substring(jsonStart)
      }
    }

    // If still no JSON found, use the whole text
    if (!jsonStr) {
      jsonStr = text
    }

    // Clean up the JSON string
    jsonStr = jsonStr.trim()

    // Remove any trailing prose after the JSON (e.g., "}Some explanation")
    // Find the last } and truncate there
    const lastBrace = jsonStr.lastIndexOf('}')
    if (lastBrace !== -1 && lastBrace < jsonStr.length - 1) {
      const afterBrace = jsonStr.substring(lastBrace + 1).trim()
      // If there's non-whitespace after the last }, it's probably prose
      if (afterBrace && !afterBrace.startsWith('```')) {
        jsonStr = jsonStr.substring(0, lastBrace + 1)
      }
    }

    // Try to fix truncated JSON by closing open brackets
    jsonStr = this.tryFixTruncatedJson(jsonStr)

    // Debug: log the JSON we're trying to parse
    console.log('=== JSON Parsing Debug ===')
    console.log('JSON length:', jsonStr.length)
    console.log('JSON start:', jsonStr.substring(0, 200))
    console.log('JSON end:', jsonStr.substring(Math.max(0, jsonStr.length - 200)))
    console.log('=== End Debug ===')

    try {
      const parsed = JSON.parse(jsonStr) as Partial<AnalysisResult>

      // Provide defaults for all fields
      return {
        // Core fields
        taskType: parsed.taskType || 'feature',
        summary: parsed.summary || 'Analysis completed',
        context: parsed.context || '',
        expectedBehavior: parsed.expectedBehavior || '',

        // Acceptance criteria
        acceptanceCriteria: parsed.acceptanceCriteria || [],

        // Files
        filesToCreate: parsed.filesToCreate || [],
        filesToModify: parsed.filesToModify || [],

        // Functions (enhanced with input/output examples)
        functionsToCreate: (parsed.functionsToCreate || []).map(f => {
          const result: {
            name: string
            signature: string
            description: string
            location: string
            file?: string
            lineToInsert?: string
            implementation?: string
            inputExample?: { description: string; value: string }
            outputExample?: { description: string; value: string }
            whyThisApproach?: string
          } = {
            name: f.name,
            signature: f.signature,
            description: f.description,
            location: f.location || f.file || '',
          }
          if (f.file) result.file = f.file
          if (f.lineToInsert) result.lineToInsert = f.lineToInsert
          if (f.implementation) result.implementation = f.implementation
          if (f.inputExample) result.inputExample = f.inputExample
          if (f.outputExample) result.outputExample = f.outputExample
          if (f.whyThisApproach) result.whyThisApproach = f.whyThisApproach
          return result
        }),

        // Implementation
        implementationSteps: parsed.implementationSteps || [],

        // Edge cases (enhanced with input/implementation)
        edgeCases: (parsed.edgeCases || []).map(e => {
          const result: {
            scenario: string
            expectedBehavior: string
            input?: string
            implementation?: string
          } = {
            scenario: e.scenario,
            expectedBehavior: e.expectedBehavior,
          }
          if (e.input) result.input = e.input
          if (e.implementation) result.implementation = e.implementation
          return result
        }),

        // Testing (legacy)
        testingInstructions: parsed.testingInstructions || [],

        // Risks (enhanced with affected files)
        risks: (parsed.risks || []).map(r => {
          const result: {
            description: string
            severity: 'low' | 'medium' | 'high'
            mitigation: string
            affectedFiles?: string[]
          } = {
            description: r.description,
            severity: r.severity || 'medium',
            mitigation: r.mitigation,
          }
          if (r.affectedFiles) result.affectedFiles = r.affectedFiles
          return result
        }),

        // Dependencies
        dependencies: parsed.dependencies || [],

        // Breaking changes
        breakingChanges: parsed.breakingChanges || {
          hasBreakingChanges: false,
        },

        // Metadata
        metadata: parsed.metadata || {
          estimatedEffort: 'Unknown',
          affectedComponents: [],
          requiresTests: true,
          requiresDocumentation: false,
        },

        // Optional fields - only include if present
        ...(parsed.testCases && { testCases: parsed.testCases }),
        ...(parsed.codeQualityChecks && { codeQualityChecks: parsed.codeQualityChecks }),
        ...(parsed.bugAnalysis && { bugAnalysis: parsed.bugAnalysis }),
        ...(parsed.fix && { fix: parsed.fix }),
        ...(parsed.regressionRisks && { regressionRisks: parsed.regressionRisks }),
        ...(parsed.currentState && { currentState: parsed.currentState }),
        ...(parsed.targetState && { targetState: parsed.targetState }),
        ...(parsed.impactAnalysis && { impactAnalysis: parsed.impactAnalysis }),
        ...(parsed.backwardsCompatibility && { backwardsCompatibility: parsed.backwardsCompatibility }),
        ...(parsed.beforeAfterExamples && { beforeAfterExamples: parsed.beforeAfterExamples }),
        ...(parsed.testingRecommendations && { testingRecommendations: parsed.testingRecommendations }),
      }
    } catch (parseError) {
      // If JSON parsing fails, log the error and return fallback
      console.error('=== JSON Parse Error ===')
      console.error('Error:', parseError instanceof Error ? parseError.message : parseError)
      console.error('=== End Error ===')

      return {
        taskType: 'feature',
        summary: text.substring(0, 500),
        context: '',
        expectedBehavior: '',
        acceptanceCriteria: [],
        filesToCreate: [],
        filesToModify: [],
        functionsToCreate: [],
        implementationSteps: [],
        edgeCases: [],
        testingInstructions: [],
        risks: [
          {
            description: 'Could not parse structured response',
            severity: 'high',
            mitigation: 'Review the raw analysis output manually',
          },
        ],
        dependencies: [],
        breakingChanges: { hasBreakingChanges: false },
        metadata: {
          estimatedEffort: 'Unknown',
          affectedComponents: [],
          requiresTests: true,
          requiresDocumentation: false,
        },
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
  onProgress?: AgentProgressCallback,
  streaming?: StreamingOptions
): Promise<{ result: AnalysisResult; stats: AgentStats; logs: ToolResult[] }> {
  const orchestrator = new AgentOrchestrator(config)
  return orchestrator.analyzeTask(taskId, userId, onProgress, streaming)
}
