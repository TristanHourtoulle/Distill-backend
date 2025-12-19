/**
 * List Directory Tool
 * Lists contents of a directory in a GitHub repository
 */

import { GitHubService } from '../../services/github.service.js'
import type {
  ListDirInput,
  ListDirOutput,
  FileEntry,
  AgentContext,
  ToolExecutionOptions,
  ToolDefinition,
} from '../../types/agent.types.js'
import { DEFAULT_TOOL_OPTIONS } from '../../types/agent.types.js'

/**
 * Tool definition for Claude
 */
export const listDirDefinition: ToolDefinition = {
  name: 'list_dir',
  description: `List the contents of a directory in the repository. Returns files and subdirectories with their types. Use this to explore the project structure.

Best practices:
- Start by listing the root directory to understand the project structure
- Use this before reading files to know what's available
- Check for common directories like src/, lib/, components/, etc.`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the directory to list. Use "/" or "" for root directory.',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth to recurse into subdirectories (default: 1, max: 5)',
      },
    },
    required: ['path'],
  },
}

/**
 * Execute the list_dir tool
 */
export async function listDir(
  input: ListDirInput,
  context: AgentContext,
  options: ToolExecutionOptions = DEFAULT_TOOL_OPTIONS
): Promise<ListDirOutput> {
  const { path } = input
  const maxDepth = Math.min(input.maxDepth ?? 1, options.maxDepth ?? 5)

  // Normalize path
  const normalizedPath = path === '/' || path === '' ? '' : path.replace(/^\//, '')

  console.log(`[list_dir] Input path: "${path}", normalized: "${normalizedPath}", maxDepth: ${maxDepth}`)

  // Get tree from GitHub
  const tree = await GitHubService.getTree(
    context.userId,
    context.owner,
    context.repo,
    context.branch
  )

  console.log(`[list_dir] Tree returned ${tree.length} nodes`)

  // Filter entries for the requested path
  const entries: FileEntry[] = []
  const seenDirs = new Set<string>()
  const seenFiles = new Set<string>()

  for (const item of tree) {
    // Check if item is in the requested directory
    const itemPath = item.path
    let relativePath: string

    if (normalizedPath === '') {
      // Root directory - get top-level items
      relativePath = itemPath
    } else if (itemPath.startsWith(normalizedPath + '/')) {
      // Item is under the requested path
      relativePath = itemPath.substring(normalizedPath.length + 1)
    } else {
      continue // Not in requested directory
    }

    // Get the first component of the relative path
    const pathParts = relativePath.split('/')
    const firstName = pathParts[0]
    if (!firstName) continue

    // If the path has multiple components, it means there's an implicit directory
    if (pathParts.length > 1) {
      // This is a nested item - infer the top-level directory
      if (!seenDirs.has(firstName)) {
        seenDirs.add(firstName)
        entries.push({
          name: firstName,
          path: normalizedPath ? `${normalizedPath}/${firstName}` : firstName,
          type: 'directory',
        })
      }
    } else {
      // This is a direct child (depth 1)
      if (item.type === 'file') {
        if (!seenFiles.has(firstName)) {
          seenFiles.add(firstName)
          entries.push({
            name: firstName,
            path: item.path,
            type: 'file',
            size: item.size,
          })
        }
      } else if (item.type === 'directory') {
        if (!seenDirs.has(firstName)) {
          seenDirs.add(firstName)
          entries.push({
            name: firstName,
            path: normalizedPath ? `${normalizedPath}/${firstName}` : firstName,
            type: 'directory',
          })
        }
      }
    }
  }

  // Sort: directories first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  // Apply limit
  const maxResults = options.maxResults ?? 100
  const truncated = entries.length > maxResults

  console.log(`[list_dir] Found ${entries.length} entries (${seenDirs.size} dirs, ${seenFiles.size} files)`)
  if (entries.length > 0) {
    console.log(`[list_dir] First 10 entries:`, entries.slice(0, 10).map(e => ({ name: e.name, type: e.type })))
  }

  return {
    path: normalizedPath || '/',
    entries: entries.slice(0, maxResults),
    truncated,
  }
}
