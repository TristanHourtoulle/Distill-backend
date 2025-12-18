/**
 * Agent Tools Index
 * Exports all tools and provides tool execution infrastructure
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages.js'
import type { AgentContext, ToolExecutionOptions, ToolResult, ToolDefinition } from '../../types/agent.types.js'
import { DEFAULT_TOOL_OPTIONS } from '../../types/agent.types.js'

// Import tool implementations
import { listDir, listDirDefinition } from './list-dir.tool.js'
import { readFile, readFileDefinition } from './read-file.tool.js'
import { searchCode, searchCodeDefinition } from './search-code.tool.js'
import { getImports, getImportsDefinition } from './get-imports.tool.js'

/**
 * All available tool definitions
 */
export const toolDefinitions: ToolDefinition[] = [
  listDirDefinition,
  readFileDefinition,
  searchCodeDefinition,
  getImportsDefinition,
]

/**
 * Convert our tool definitions to Anthropic's Tool format
 */
export function getAnthropicTools(): Tool[] {
  return toolDefinitions.map((def) => ({
    name: def.name,
    description: def.description,
    input_schema: def.input_schema as Tool['input_schema'],
  }))
}

/**
 * Tool name type
 */
export type ToolName = 'list_dir' | 'read_file' | 'search_code' | 'get_imports'

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: ToolName,
  input: unknown,
  context: AgentContext,
  options: ToolExecutionOptions = DEFAULT_TOOL_OPTIONS
): Promise<ToolResult> {
  const startTime = Date.now()

  try {
    let output: unknown

    switch (toolName) {
      case 'list_dir':
        output = await listDir(input as Parameters<typeof listDir>[0], context, options)
        break

      case 'read_file':
        output = await readFile(input as Parameters<typeof readFile>[0], context, options)
        break

      case 'search_code':
        output = await searchCode(input as Parameters<typeof searchCode>[0], context, options)
        break

      case 'get_imports':
        output = await getImports(input as Parameters<typeof getImports>[0], context, options)
        break

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }

    const durationMs = Date.now() - startTime

    // Estimate tokens based on output size
    const outputStr = JSON.stringify(output)
    const tokensEstimate = Math.ceil(outputStr.length / 4)

    return {
      toolName: toolName as ToolResult['toolName'],
      input,
      output,
      durationMs,
      tokensEstimate,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      toolName: toolName as ToolResult['toolName'],
      input,
      output: null,
      durationMs,
      error: errorMessage,
    }
  }
}

/**
 * Format tool result for Claude
 * Converts the result to a string that Claude can understand
 */
export function formatToolResult(result: ToolResult): string {
  if (result.error) {
    return `Error executing ${result.toolName}: ${result.error}`
  }

  // Format based on tool type
  switch (result.toolName) {
    case 'list_dir': {
      const output = result.output as { path: string; entries: Array<{ name: string; type: string }>; truncated: boolean }
      const entries = output.entries
        .map((e) => `${e.type === 'directory' ? '📁' : '📄'} ${e.name}`)
        .join('\n')
      return `Contents of ${output.path}:\n${entries}${output.truncated ? '\n... (truncated)' : ''}`
    }

    case 'read_file': {
      const output = result.output as { path: string; content: string; lineCount: number; truncated: boolean; language?: string }
      let header = `File: ${output.path} (${output.lineCount} lines`
      if (output.language) header += `, ${output.language}`
      header += ')'
      if (output.truncated) header += ' [truncated]'
      return `${header}\n\n${output.content}`
    }

    case 'search_code': {
      const output = result.output as { query: string; results: Array<{ file: string; line: number; content: string; context?: string }>; totalMatches: number; truncated: boolean }
      if (output.results.length === 0) {
        return `No matches found for "${output.query}"`
      }
      const results = output.results
        .map((r) => {
          const location = `${r.file}:${r.line}`
          return r.context || `${location}: ${r.content}`
        })
        .join('\n\n')
      return `Found ${output.totalMatches} matches for "${output.query}"${output.truncated ? ' (showing first ' + output.results.length + ')' : ''}:\n\n${results}`
    }

    case 'get_imports': {
      const output = result.output as { path: string; imports: Array<{ source: string; specifiers: string[]; isDefault: boolean }>; exports: Array<{ name: string; type: string }> }
      const imports = output.imports
        .map((i) => {
          const specs = i.specifiers.join(', ')
          return `- ${i.source}${specs ? ` (${i.isDefault ? 'default: ' : ''}${specs})` : ''}`
        })
        .join('\n')
      const exportsStr = output.exports.map((e) => `- ${e.name} (${e.type})`).join('\n')

      return `Dependencies for ${output.path}:\n\nImports:\n${imports || '(none)'}\n\nExports:\n${exportsStr || '(none)'}`
    }

    default:
      return JSON.stringify(result.output, null, 2)
  }
}

// Re-export individual tools for direct use
export { listDir, readFile, searchCode, getImports }
export { listDirDefinition, readFileDefinition, searchCodeDefinition, getImportsDefinition }
