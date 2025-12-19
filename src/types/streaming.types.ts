/**
 * Streaming Types
 * Types for Server-Sent Events (SSE) streaming during task analysis
 */

/**
 * Analysis phases
 */
export type AnalysisPhase =
  | 'initializing'
  | 'loading'
  | 'exploring'
  | 'analyzing'
  | 'tool_execution'
  | 'synthesizing'
  | 'parsing'
  | 'saving'
  | 'complete'
  | 'error'

/**
 * Base event structure
 */
export interface BaseStreamEvent {
  timestamp: number
  analysisId?: string | undefined
}

/**
 * Phase change event
 */
export interface PhaseEvent extends BaseStreamEvent {
  type: 'phase'
  phase: AnalysisPhase
  message: string
}

/**
 * Tool call event - when the AI calls a tool
 */
export interface ToolCallEvent extends BaseStreamEvent {
  type: 'tool_call'
  tool: string
  input: Record<string, unknown>
  description: string
}

/**
 * Tool result event - result of a tool call
 */
export interface ToolResultEvent extends BaseStreamEvent {
  type: 'tool_result'
  tool: string
  success: boolean
  summary: string
  durationMs: number
}

/**
 * Thinking event - AI's reasoning/thinking process
 */
export interface ThinkingEvent extends BaseStreamEvent {
  type: 'thinking'
  content: string
  isPartial: boolean
}

/**
 * Progress event - stats update
 */
export interface ProgressEvent extends BaseStreamEvent {
  type: 'progress'
  iteration: number
  toolCalls: number
  tokensUsed: {
    input: number
    output: number
  }
  durationMs: number
}

/**
 * File discovered event
 */
export interface FileDiscoveredEvent extends BaseStreamEvent {
  type: 'file_discovered'
  action: 'create' | 'modify'
  path: string
  description?: string
}

/**
 * Result event - final analysis result
 */
export interface ResultEvent extends BaseStreamEvent {
  type: 'result'
  analysisId: string
  summary: string
  stats: {
    iterations: number
    toolCalls: number
    tokensUsed: {
      input: number
      output: number
    }
    durationMs: number
    filesToCreate: number
    filesToModify: number
  }
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseStreamEvent {
  type: 'error'
  code: string
  message: string
  recoverable: boolean
}

/**
 * Union type for all stream events
 */
export type StreamEvent =
  | PhaseEvent
  | ToolCallEvent
  | ToolResultEvent
  | ThinkingEvent
  | ProgressEvent
  | FileDiscoveredEvent
  | ResultEvent
  | ErrorEvent

/**
 * Stream event emitter callback
 */
export type StreamEventEmitter = (event: StreamEvent) => void

/**
 * Stream options
 */
export interface StreamOptions {
  includeToolResults?: boolean
  includeThinking?: boolean
  includeFileDiscovery?: boolean
}
