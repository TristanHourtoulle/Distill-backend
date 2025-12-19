/**
 * Search Code Tool
 * Searches for code patterns in a GitHub repository
 */

import { GitHubService } from '../../services/github.service.js'
import type {
  SearchCodeInput,
  SearchCodeOutput,
  SearchResult,
  AgentContext,
  ToolExecutionOptions,
  ToolDefinition,
} from '../../types/agent.types.js'
import { DEFAULT_TOOL_OPTIONS } from '../../types/agent.types.js'

/**
 * Tool definition for Claude
 */
export const searchCodeDefinition: ToolDefinition = {
  name: 'search_code',
  description: `Search for code patterns in the repository. Returns matching lines with file paths and line numbers.

Best practices:
- Use specific search terms for better results
- Search for function names, class names, or unique identifiers
- Use filePattern to limit search to specific file types (e.g., "*.ts", "*.tsx")
- Search for imports to find where a module is used`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query (text to find in code)',
      },
      filePattern: {
        type: 'string',
        description: 'Optional: File pattern to search in (e.g., "*.ts", "*.tsx", "src/**/*.ts")',
      },
      maxResults: {
        type: 'number',
        description: 'Optional: Maximum number of results to return (default: 20, max: 50)',
      },
    },
    required: ['query'],
  },
}

/**
 * Check if a file matches the given pattern
 */
function matchesPattern(filePath: string, pattern?: string): boolean {
  if (!pattern) return true

  // Handle comma-separated patterns (e.g., "*.ts,*.tsx")
  if (pattern.includes(',')) {
    const patterns = pattern.split(',').map(p => p.trim())
    return patterns.some(p => matchesSinglePattern(filePath, p))
  }

  return matchesSinglePattern(filePath, pattern)
}

/**
 * Check if a file matches a single pattern
 */
function matchesSinglePattern(filePath: string, pattern: string): boolean {
  // Handle common patterns more flexibly
  // *.ts or *.tsx should match any .ts or .tsx file anywhere in the tree
  // src/*.ts should match files in src/ directory only
  // **/*.ts should match any .ts file anywhere

  // If pattern starts with *, treat it as matching any path ending with that extension
  if (pattern.startsWith('*') && !pattern.includes('/')) {
    // Pattern like *.ts or *.tsx - match extension anywhere
    const extensionPattern = pattern.substring(1) // Remove leading *
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
    const regex = new RegExp(`${extensionPattern}$`, 'i')
    return regex.test(filePath)
  }

  // Full pattern matching for paths with directories
  // Support: folder/*, folder/**/*.ext
  const normalizedPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DOUBLESTAR\}\}/g, '.*')

  const regex = new RegExp(`^${normalizedPattern}$`)
  return regex.test(filePath)
}

/**
 * Get context lines around a match
 */
function getContextLines(lines: string[], lineIdx: number, contextSize: number = 1): string {
  const start = Math.max(0, lineIdx - contextSize)
  const end = Math.min(lines.length, lineIdx + contextSize + 1)

  return lines
    .slice(start, end)
    .map((line, idx) => {
      const lineNum = start + idx + 1
      const marker = lineNum === lineIdx + 1 ? '>' : ' '
      return `${marker} ${lineNum.toString().padStart(4, ' ')} | ${line}`
    })
    .join('\n')
}

/**
 * Execute the search_code tool
 */
export async function searchCode(
  input: SearchCodeInput,
  context: AgentContext,
  options: ToolExecutionOptions = DEFAULT_TOOL_OPTIONS
): Promise<SearchCodeOutput> {
  const { query, filePattern } = input
  const maxResults = Math.min(input.maxResults ?? 20, options.maxResults ?? 50)

  // Try GitHub code search first (faster but may have limitations)
  try {
    const githubResults = await GitHubService.searchCode(
      context.userId,
      context.owner,
      context.repo,
      query
    )

    // Filter by pattern if provided
    const filtered = filePattern
      ? githubResults.filter((r) => matchesPattern(r.path, filePattern))
      : githubResults

    // If GitHub search returns no results, fall back to manual search
    // GitHub Code Search API has limitations (repo must be indexed, rate limits, etc.)
    if (filtered.length === 0) {
      console.log(`[search_code] GitHub API returned 0 results for "${query}", falling back to manual search`)
      return searchCodeManually(input, context, options)
    }

    // Map to our format
    const results: SearchResult[] = filtered.slice(0, maxResults).map((r) => ({
      file: r.path,
      line: 1, // GitHub search doesn't provide exact line numbers
      content: r.textMatches?.[0]?.fragment ?? '',
    }))

    return {
      query,
      results,
      totalMatches: filtered.length,
      truncated: filtered.length > maxResults,
    }
  } catch (error) {
    // Fallback to manual search through files
    console.log(`[search_code] GitHub API error, falling back to manual search:`, error instanceof Error ? error.message : error)
    return searchCodeManually(input, context, options)
  }
}

/**
 * Manual code search (fallback)
 * Searches through files directly when GitHub search is not available
 */
async function searchCodeManually(
  input: SearchCodeInput,
  context: AgentContext,
  options: ToolExecutionOptions
): Promise<SearchCodeOutput> {
  const { query, filePattern } = input
  const maxResults = Math.min(input.maxResults ?? 20, options.maxResults ?? 50)

  console.log(`[search_code] Manual search starting for query: "${query}", pattern: "${filePattern || 'none'}"`)

  // Get file tree
  const tree = await GitHubService.getTree(
    context.userId,
    context.owner,
    context.repo,
    context.branch
  )

  console.log(`[search_code] Tree has ${tree.length} total nodes`)

  // Filter to only files, excluding common non-code files
  const codeFiles = tree.filter((item) => {
    if (item.type !== 'file') return false

    // Skip common non-code files
    const skipPatterns = [
      /node_modules/,
      /\.git/,
      /dist\//,
      /build\//,
      /\.lock$/,
      /\.min\./,
      /\.map$/,
      /\.png$/,
      /\.jpg$/,
      /\.jpeg$/,
      /\.gif$/,
      /\.svg$/,
      /\.ico$/,
      /\.woff/,
      /\.ttf$/,
      /\.eot$/,
    ]

    if (skipPatterns.some((pattern) => pattern.test(item.path))) {
      return false
    }

    // Apply file pattern filter
    return matchesPattern(item.path, filePattern)
  })

  console.log(`[search_code] Filtered to ${codeFiles.length} searchable files`)
  if (codeFiles.length > 0) {
    console.log(`[search_code] First 5 files to search:`, codeFiles.slice(0, 5).map(f => f.path))
  }

  const results: SearchResult[] = []
  const queryLower = query.toLowerCase()

  // Search through files (limit to avoid timeout)
  const filesToSearch = codeFiles.slice(0, 100) // Limit files to search
  let filesSearched = 0
  let filesWithErrors = 0

  for (const file of filesToSearch) {
    if (results.length >= maxResults) break

    try {
      const fileData = await GitHubService.getFileContent(
        context.userId,
        context.owner,
        context.repo,
        file.path,
        context.branch
      )

      filesSearched++
      const lines = fileData.content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        if (results.length >= maxResults) break

        const line = lines[i]
        if (line && line.toLowerCase().includes(queryLower)) {
          results.push({
            file: file.path,
            line: i + 1,
            content: line.trim(),
            context: getContextLines(lines, i),
          })
        }
      }
    } catch {
      // Skip files that can't be read
      filesWithErrors++
      continue
    }
  }

  console.log(`[search_code] Searched ${filesSearched} files, ${filesWithErrors} errors, found ${results.length} matches`)

  return {
    query,
    results,
    totalMatches: results.length,
    truncated: results.length >= maxResults,
  }
}
