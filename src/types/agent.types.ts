/**
 * Agent Types
 * Types for the LLM agent that analyzes code
 */

import type { AgentActionType } from '@prisma/client'

/**
 * Tool input types
 */
export interface ListDirInput {
  path: string
  maxDepth?: number | undefined
}

export interface ReadFileInput {
  path: string
  startLine?: number | undefined
  endLine?: number | undefined
}

export interface SearchCodeInput {
  query: string
  filePattern?: string | undefined
  maxResults?: number | undefined
}

export interface GetImportsInput {
  path: string
}

/**
 * Tool output types
 */
export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number | undefined
}

export interface ListDirOutput {
  path: string
  entries: FileEntry[]
  truncated: boolean
}

export interface ReadFileOutput {
  path: string
  content: string
  lineCount: number
  truncated: boolean
  language?: string | undefined
}

export interface SearchResult {
  file: string
  line: number
  content: string
  context?: string | undefined
}

export interface SearchCodeOutput {
  query: string
  results: SearchResult[]
  totalMatches: number
  truncated: boolean
}

export interface ImportInfo {
  source: string
  specifiers: string[]
  isDefault: boolean
  isNamespace: boolean
}

export interface ExportInfo {
  name: string
  type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'default'
}

export interface GetImportsOutput {
  path: string
  imports: ImportInfo[]
  exports: ExportInfo[]
}

/**
 * Tool definition for Claude function calling
 */
export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

/**
 * Tool execution result
 */
export interface ToolResult {
  toolName: AgentActionType
  input: unknown
  output: unknown
  durationMs: number
  tokensEstimate?: number | undefined
  error?: string | undefined
}

/**
 * Agent context for tool execution
 */
export interface AgentContext {
  projectId: string
  userId: string
  owner: string
  repo: string
  branch: string
  // Cached project info
  detectedStack?: Record<string, unknown> | undefined
  indexedFilesCount?: number | undefined
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  maxFileSize?: number | undefined // Max bytes to read
  maxResults?: number | undefined // Max search results
  maxDepth?: number | undefined // Max directory depth
  timeout?: number | undefined // Execution timeout in ms
}

/**
 * Default tool execution options
 */
export const DEFAULT_TOOL_OPTIONS: ToolExecutionOptions = {
  maxFileSize: 100000, // 100KB
  maxResults: 50,
  maxDepth: 5,
  timeout: 30000, // 30 seconds
}
