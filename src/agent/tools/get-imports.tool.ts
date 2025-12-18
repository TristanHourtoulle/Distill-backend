/**
 * Get Imports Tool
 * Extracts import and export information from a source file
 */

import { GitHubService } from '../../services/github.service.js'
import type {
  GetImportsInput,
  GetImportsOutput,
  ImportInfo,
  ExportInfo,
  AgentContext,
  ToolExecutionOptions,
  ToolDefinition,
} from '../../types/agent.types.js'
import { DEFAULT_TOOL_OPTIONS } from '../../types/agent.types.js'

/**
 * Tool definition for Claude
 */
export const getImportsDefinition: ToolDefinition = {
  name: 'get_imports',
  description: `Analyze a source file to extract its imports and exports. Returns structured information about dependencies and exported members.

Best practices:
- Use this to understand file dependencies before making changes
- Check imports to find related files
- Exports tell you what functionality the file provides
- Useful for understanding component/module boundaries`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the source file to analyze (e.g., "src/services/user.service.ts")',
      },
    },
    required: ['path'],
  },
}

/**
 * Parse import statements from TypeScript/JavaScript
 */
function parseImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = []

  // Match various import patterns
  const importRegex = /import\s+(?:(?:(\w+)\s*,\s*)?(?:\{\s*([^}]+)\s*\}|\*\s+as\s+(\w+)))?\s*from\s*['"]([^'"]+)['"]/g
  const defaultOnlyRegex = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g
  const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g

  // Named imports with possible default
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    const defaultImport = match[1]
    const namedImports = match[2]
    const namespaceImport = match[3]
    const source = match[4]

    if (source) {
      if (namespaceImport) {
        // import * as X from 'module'
        imports.push({
          source,
          specifiers: [namespaceImport],
          isDefault: false,
          isNamespace: true,
        })
      } else {
        // import { a, b } from 'module' or import X, { a, b } from 'module'
        const specifiers = namedImports
          ? namedImports.split(',').map((s) => s.trim().split(/\s+as\s+/).pop()?.trim() ?? s.trim())
          : []

        if (defaultImport) {
          imports.push({
            source,
            specifiers: [defaultImport],
            isDefault: true,
            isNamespace: false,
          })
        }

        if (specifiers.length > 0) {
          imports.push({
            source,
            specifiers,
            isDefault: false,
            isNamespace: false,
          })
        }
      }
    }
  }

  // Default-only imports (reset regex)
  while ((match = defaultOnlyRegex.exec(content)) !== null) {
    const defaultImport = match[1]
    const source = match[2]

    // Skip if already captured
    if (source && defaultImport && !imports.some((i) => i.source === source && i.isDefault)) {
      imports.push({
        source,
        specifiers: [defaultImport],
        isDefault: true,
        isNamespace: false,
      })
    }
  }

  // Side-effect imports (reset regex)
  while ((match = sideEffectRegex.exec(content)) !== null) {
    const source = match[1]

    // Skip if already captured
    if (source && !imports.some((i) => i.source === source)) {
      imports.push({
        source,
        specifiers: [],
        isDefault: false,
        isNamespace: false,
      })
    }
  }

  // Deduplicate by source
  const seen = new Map<string, ImportInfo>()
  for (const imp of imports) {
    const existing = seen.get(imp.source)
    if (existing) {
      // Merge specifiers
      existing.specifiers = [...new Set([...existing.specifiers, ...imp.specifiers])]
      if (imp.isDefault) existing.isDefault = true
      if (imp.isNamespace) existing.isNamespace = true
    } else {
      seen.set(imp.source, { ...imp })
    }
  }

  return Array.from(seen.values())
}

/**
 * Parse export statements from TypeScript/JavaScript
 */
function parseExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = []

  // Export patterns
  const patterns = [
    // export function name() or export async function name()
    { regex: /export\s+(?:async\s+)?function\s+(\w+)/g, type: 'function' as const },
    // export class Name
    { regex: /export\s+class\s+(\w+)/g, type: 'class' as const },
    // export const/let/var name
    { regex: /export\s+(?:const|let|var)\s+(\w+)/g, type: 'variable' as const },
    // export type Name
    { regex: /export\s+type\s+(\w+)/g, type: 'type' as const },
    // export interface Name
    { regex: /export\s+interface\s+(\w+)/g, type: 'interface' as const },
    // export default (class/function/expression)
    { regex: /export\s+default\s+(?:class|function)?\s*(\w+)?/g, type: 'default' as const },
  ]

  for (const { regex, type } of patterns) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      const name = match[1] || 'default'
      exports.push({ name, type })
    }
  }

  // Named exports: export { a, b, c }
  const namedExportRegex = /export\s*\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = namedExportRegex.exec(content)) !== null) {
    const matchContent = match[1]
    if (!matchContent) continue
    const names = matchContent.split(',').map((n) => n.trim().split(/\s+as\s+/).pop()?.trim() ?? n.trim())
    for (const name of names) {
      if (name && !exports.some((e) => e.name === name)) {
        exports.push({ name, type: 'variable' })
      }
    }
  }

  return exports
}

/**
 * Execute the get_imports tool
 */
export async function getImports(
  input: GetImportsInput,
  context: AgentContext,
  _options: ToolExecutionOptions = DEFAULT_TOOL_OPTIONS
): Promise<GetImportsOutput> {
  const { path } = input

  // Normalize path
  const normalizedPath = path.replace(/^\//, '')

  // Get file content
  const fileData = await GitHubService.getFileContent(
    context.userId,
    context.owner,
    context.repo,
    normalizedPath,
    context.branch
  )

  // Parse imports and exports
  const imports = parseImports(fileData.content)
  const exportsList = parseExports(fileData.content)

  return {
    path: normalizedPath,
    imports,
    exports: exportsList,
  }
}
