/**
 * Indexation Types
 * Types used by the IndexationService for project analysis
 */

/**
 * File type categories for indexed files
 */
export type FileType =
  | 'component'
  | 'hook'
  | 'api'
  | 'util'
  | 'config'
  | 'type'
  | 'test'
  | 'style'
  | 'page'
  | 'layout'
  | 'middleware'
  | 'service'
  | 'model'
  | 'schema'
  | 'other'

/**
 * Detected tech stack for a project
 */
export interface DetectedStack {
  framework?: string // next, nuxt, express, hono, etc.
  language: string // typescript, javascript
  styling?: string[] // tailwind, scss, css-in-js, etc.
  database?: string // prisma, drizzle, mongoose, etc.
  testing?: string[] // jest, vitest, mocha, etc.
  stateManagement?: string[] // zustand, redux, jotai, etc.
  packageManager: string // npm, yarn, pnpm, bun
  monorepo?: string // turborepo, nx, lerna
  other: string[] // Additional detected technologies
}

/**
 * Structure summary for quick project overview
 */
export interface StructureSummary {
  totalFiles: number
  totalDirectories: number
  filesByType: Record<FileType, number>
  mainDirectories: string[] // Top-level important directories
  entryPoints: string[] // main files, index files
  configFiles: string[] // package.json, tsconfig, etc.
}

/**
 * Extracted exports from a file
 */
export interface FileExports {
  default?: string // Default export name
  named: string[] // Named exports
  types?: string[] // Type exports (for TypeScript)
}

/**
 * Extracted imports from a file
 */
export interface FileImports {
  local: string[] // Relative imports (./foo, ../bar)
  external: string[] // Package imports (react, lodash)
}

/**
 * Result of analyzing a single file
 */
export interface FileAnalysis {
  path: string
  fileType: FileType
  exports: FileExports
  imports: FileImports
  lineCount: number
  sha: string
}

/**
 * Progress callback for indexation
 */
export interface IndexationProgress {
  phase: 'fetching_tree' | 'analyzing_files' | 'detecting_stack' | 'saving' | 'completed'
  current: number
  total: number
  currentFile?: string
}

/**
 * Full indexation result
 */
export interface IndexationResult {
  success: boolean
  filesIndexed: number
  detectedStack: DetectedStack
  structureSummary: StructureSummary
  errors: string[]
}

/**
 * Configuration for indexation
 */
export interface IndexationConfig {
  maxFileSize: number // Max file size to analyze in bytes
  maxFiles: number // Max number of files to index
  skipDirectories: string[] // Directories to skip
  includeExtensions: string[] // File extensions to include
}

export const DEFAULT_INDEXATION_CONFIG: IndexationConfig = {
  maxFileSize: 100 * 1024, // 100KB
  maxFiles: 1000,
  skipDirectories: [
    'node_modules',
    '.git',
    '.next',
    '.nuxt',
    'dist',
    'build',
    'out',
    'coverage',
    '.turbo',
    '.cache',
    '__pycache__',
    'vendor',
    '.idea',
    '.vscode',
  ],
  includeExtensions: [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.vue',
    '.svelte',
    '.json',
    '.yaml',
    '.yml',
    '.md',
    '.prisma',
    '.graphql',
    '.gql',
    '.css',
    '.scss',
    '.sass',
    '.less',
  ],
}
