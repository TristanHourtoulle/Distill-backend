/**
 * Read File Tool
 * Reads the content of a file from a GitHub repository
 */

import { GitHubService } from '../../services/github.service.js'
import type {
  ReadFileInput,
  ReadFileOutput,
  AgentContext,
  ToolExecutionOptions,
  ToolDefinition,
} from '../../types/agent.types.js'
import { DEFAULT_TOOL_OPTIONS } from '../../types/agent.types.js'

/**
 * Tool definition for Claude
 */
export const readFileDefinition: ToolDefinition = {
  name: 'read_file',
  description: `Read the contents of a file from the repository. Returns the file content as text with line numbers.

Best practices:
- Use list_dir first to find the file path
- For large files, use startLine and endLine to read specific sections
- Check the file extension to understand the content type
- Look for imports at the top of files to understand dependencies`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to read (e.g., "src/index.ts")',
      },
      startLine: {
        type: 'number',
        description: 'Optional: First line number to read (1-indexed)',
      },
      endLine: {
        type: 'number',
        description: 'Optional: Last line number to read (1-indexed)',
      },
    },
    required: ['path'],
  },
}

/**
 * Detect language from file extension
 */
function detectLanguage(path: string): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase()

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    php: 'php',
    vue: 'vue',
    svelte: 'svelte',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    dockerfile: 'dockerfile',
    prisma: 'prisma',
  }

  return ext ? languageMap[ext] : undefined
}

/**
 * Execute the read_file tool
 */
export async function readFile(
  input: ReadFileInput,
  context: AgentContext,
  options: ToolExecutionOptions = DEFAULT_TOOL_OPTIONS
): Promise<ReadFileOutput> {
  const { path, startLine, endLine } = input
  const maxFileSize = options.maxFileSize ?? 100000

  // Normalize path
  const normalizedPath = path.replace(/^\//, '')

  // Get file content from GitHub
  const fileData = await GitHubService.getFileContent(
    context.userId,
    context.owner,
    context.repo,
    normalizedPath,
    context.branch
  )

  // Check file size
  let truncated = false
  let fileContent = fileData.content

  if (fileContent.length > maxFileSize) {
    fileContent = fileContent.substring(0, maxFileSize)
    truncated = true
  }

  // Split into lines
  const allLines = fileContent.split('\n')
  const totalLines = allLines.length

  // Apply line range if specified
  let lines = allLines
  if (startLine !== undefined || endLine !== undefined) {
    const start = Math.max(1, startLine ?? 1) - 1 // Convert to 0-indexed
    const end = Math.min(totalLines, endLine ?? totalLines)
    lines = allLines.slice(start, end)

    if (end < totalLines || start > 0) {
      truncated = true
    }
  }

  // Add line numbers
  const startIdx = startLine ? startLine - 1 : 0
  const numberedContent = lines
    .map((line: string, idx: number) => `${(startIdx + idx + 1).toString().padStart(4, ' ')} | ${line}`)
    .join('\n')

  // Detect language
  const language = detectLanguage(normalizedPath)

  return {
    path: normalizedPath,
    content: numberedContent,
    lineCount: totalLines,
    truncated,
    language,
  }
}
