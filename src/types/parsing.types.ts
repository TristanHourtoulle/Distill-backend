/**
 * Parsing Types
 * Types for LLM-based meeting parsing and task extraction
 */

import type { TaskType, TaskComplexity } from '@prisma/client'

/**
 * Extracted task from meeting content
 */
export interface ExtractedTask {
  title: string
  description: string
  type: TaskType
  complexity: TaskComplexity
  priority: number
  estimatedFilesCount?: number | undefined
  impactedFilesPreview?: string[] | undefined
}

/**
 * Parsed meeting result
 */
export interface ParsedMeetingResult {
  summary: string
  tasks: ExtractedTask[]
  metadata: {
    participantsDetected?: string[] | undefined
    topicsDiscussed?: string[] | undefined
    decisionsmade?: string[] | undefined
  }
  tokensUsed: {
    input: number
    output: number
  }
}

/**
 * Parsing configuration
 */
export interface ParsingConfig {
  model: string
  maxTokens: number
  temperature: number
}

/**
 * Parsing progress callback
 */
export type ParsingProgressCallback = (phase: string, message: string) => void

/**
 * Default parsing configuration
 */
export const DEFAULT_PARSING_CONFIG: ParsingConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.3,
}
