import { db } from '../lib/db.js'
import { GitHubService } from './github.service.js'
import type { TreeNode } from '../types/github.types.js'
import type { Prisma } from '@prisma/client'
import {
  type FileType,
  type DetectedStack,
  type StructureSummary,
  type FileExports,
  type FileImports,
  type FileAnalysis,
  type IndexationResult,
  type IndexationConfig,
  DEFAULT_INDEXATION_CONFIG,
} from '../types/indexation.types.js'
import type { JobProgress } from '../types/job.types.js'

/**
 * Progress callback type for indexation
 */
export type ProgressCallback = (progress: JobProgress) => void

export class IndexationService {
  /**
   * Index a project - fetches files, analyzes them, and stores results
   */
  static async indexProject(
    projectId: string,
    userId: string,
    config: Partial<IndexationConfig> = {}
  ): Promise<IndexationResult> {
    const mergedConfig = { ...DEFAULT_INDEXATION_CONFIG, ...config }
    const errors: string[] = []

    // Get project info
    const project = await db.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    const branch = project.preferredBranch

    try {
      // Update status to indexing
      await db.project.update({
        where: { id: projectId },
        data: { status: 'indexing' },
      })

      // Fetch repository tree
      const tree = await GitHubService.getTree(
        userId,
        project.githubOwner,
        project.githubRepoName,
        branch
      )

      // Filter files to index
      const filesToIndex = this.filterFiles(tree, mergedConfig)

      // Limit number of files
      const limitedFiles = filesToIndex.slice(0, mergedConfig.maxFiles)

      // Analyze files and extract metadata
      const analyses: FileAnalysis[] = []

      for (const file of limitedFiles) {
        try {
          // Skip large files
          if (file.size && file.size > mergedConfig.maxFileSize) {
            continue
          }

          const content = await GitHubService.getFileContent(
            userId,
            project.githubOwner,
            project.githubRepoName,
            file.path,
            branch
          )

          const analysis = this.analyzeFile(file.path, content.content, file.sha)
          analyses.push(analysis)
        } catch (error) {
          errors.push(`Failed to analyze ${file.path}: ${error}`)
        }
      }

      // Detect tech stack
      const detectedStack = await this.detectStack(
        userId,
        project.githubOwner,
        project.githubRepoName,
        branch,
        tree
      )

      // Generate structure summary
      const structureSummary = this.generateStructureSummary(tree, analyses)

      // Save to database
      await this.saveIndexation(projectId, analyses, detectedStack, structureSummary)

      return {
        success: true,
        filesIndexed: analyses.length,
        detectedStack,
        structureSummary,
        errors,
      }
    } catch (error) {
      // Update status to error
      await db.project.update({
        where: { id: projectId },
        data: { status: 'error' },
      })

      throw error
    }
  }

  /**
   * Index a project with progress reporting
   * Used by the job queue for background processing
   */
  static async indexProjectWithProgress(
    projectId: string,
    userId: string,
    onProgress?: ProgressCallback,
    config: Partial<IndexationConfig> = {}
  ): Promise<IndexationResult> {
    const mergedConfig = { ...DEFAULT_INDEXATION_CONFIG, ...config }
    const errors: string[] = []

    const reportProgress = (phase: string, current: number, total: number, message?: string) => {
      if (onProgress) {
        onProgress({ phase, current, total, message })
      }
    }

    // Get project info
    const project = await db.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    const branch = project.preferredBranch

    try {
      // Update status to indexing
      await db.project.update({
        where: { id: projectId },
        data: { status: 'indexing' },
      })

      // Phase 1: Fetch repository tree
      reportProgress('fetching_tree', 0, 1, 'Fetching repository structure...')

      const tree = await GitHubService.getTree(
        userId,
        project.githubOwner,
        project.githubRepoName,
        branch
      )

      reportProgress('fetching_tree', 1, 1, 'Repository structure fetched')

      // Filter files to index
      const filesToIndex = this.filterFiles(tree, mergedConfig)
      const limitedFiles = filesToIndex.slice(0, mergedConfig.maxFiles)

      // Phase 2: Analyze files
      const analyses: FileAnalysis[] = []
      const totalFiles = limitedFiles.length

      for (let i = 0; i < limitedFiles.length; i++) {
        const file = limitedFiles[i]
        if (!file) continue

        reportProgress('analyzing_files', i, totalFiles, `Analyzing ${file.path}...`)

        try {
          // Skip large files
          if (file.size && file.size > mergedConfig.maxFileSize) {
            continue
          }

          const content = await GitHubService.getFileContent(
            userId,
            project.githubOwner,
            project.githubRepoName,
            file.path,
            branch
          )

          const analysis = this.analyzeFile(file.path, content.content, file.sha)
          analyses.push(analysis)
        } catch (error) {
          errors.push(`Failed to analyze ${file.path}: ${error}`)
        }
      }

      reportProgress('analyzing_files', totalFiles, totalFiles, 'File analysis complete')

      // Phase 3: Detect tech stack
      reportProgress('detecting_stack', 0, 1, 'Detecting tech stack...')

      const detectedStack = await this.detectStack(
        userId,
        project.githubOwner,
        project.githubRepoName,
        branch,
        tree
      )

      reportProgress('detecting_stack', 1, 1, 'Tech stack detected')

      // Phase 4: Generate summary and save
      reportProgress('saving', 0, 1, 'Saving indexation results...')

      const structureSummary = this.generateStructureSummary(tree, analyses)
      await this.saveIndexation(projectId, analyses, detectedStack, structureSummary)

      reportProgress('saving', 1, 1, 'Indexation complete')

      return {
        success: true,
        filesIndexed: analyses.length,
        detectedStack,
        structureSummary,
        errors,
      }
    } catch (error) {
      // Update status to error
      await db.project.update({
        where: { id: projectId },
        data: { status: 'error' },
      })

      throw error
    }
  }

  /**
   * Filter files based on config
   */
  private static filterFiles(tree: TreeNode[], config: IndexationConfig): TreeNode[] {
    return tree.filter(node => {
      // Only include files
      if (node.type !== 'file') return false

      // Check if in a skipped directory
      const pathParts = node.path.split('/')
      for (const part of pathParts) {
        if (config.skipDirectories.includes(part)) {
          return false
        }
      }

      // Check extension
      const ext = this.getExtension(node.path)
      return config.includeExtensions.includes(ext)
    })
  }

  /**
   * Get file extension
   */
  private static getExtension(path: string): string {
    const parts = path.split('.')
    if (parts.length < 2) return ''
    return '.' + parts.pop()!.toLowerCase()
  }

  /**
   * Analyze a single file
   */
  private static analyzeFile(path: string, content: string, sha: string): FileAnalysis {
    const fileType = this.detectFileType(path, content)
    const exports = this.extractExports(content)
    const imports = this.extractImports(content)
    const lineCount = content.split('\n').length

    return {
      path,
      fileType,
      exports,
      imports,
      lineCount,
      sha,
    }
  }

  /**
   * Detect file type based on path and content
   */
  private static detectFileType(path: string, content: string): FileType {
    const lowerPath = path.toLowerCase()
    const fileName = path.split('/').pop()?.toLowerCase() ?? ''

    // Config files
    if (
      fileName.includes('config') ||
      fileName.includes('.config.') ||
      ['package.json', 'tsconfig.json', '.env', '.env.local', '.eslintrc'].some(c =>
        fileName.includes(c)
      )
    ) {
      return 'config'
    }

    // Test files
    if (
      lowerPath.includes('.test.') ||
      lowerPath.includes('.spec.') ||
      lowerPath.includes('__tests__') ||
      lowerPath.includes('__mocks__')
    ) {
      return 'test'
    }

    // Style files
    if (['.css', '.scss', '.sass', '.less'].some(ext => lowerPath.endsWith(ext))) {
      return 'style'
    }

    // Type definition files
    if (lowerPath.endsWith('.d.ts') || lowerPath.includes('/types/') || lowerPath.includes('/types.')) {
      return 'type'
    }

    // Schema files (Prisma, GraphQL, Zod)
    if (
      lowerPath.endsWith('.prisma') ||
      lowerPath.endsWith('.graphql') ||
      lowerPath.endsWith('.gql') ||
      lowerPath.includes('/schemas/') ||
      lowerPath.includes('.schema.')
    ) {
      return 'schema'
    }

    // Middleware
    if (lowerPath.includes('middleware')) {
      return 'middleware'
    }

    // API routes
    if (
      lowerPath.includes('/api/') ||
      lowerPath.includes('/routes/') ||
      lowerPath.includes('.route.') ||
      lowerPath.includes('.routes.')
    ) {
      return 'api'
    }

    // Pages (Next.js, Nuxt, etc.)
    if (
      lowerPath.includes('/pages/') ||
      lowerPath.includes('/app/') && lowerPath.includes('page.')
    ) {
      return 'page'
    }

    // Layouts
    if (lowerPath.includes('layout')) {
      return 'layout'
    }

    // Hooks (React)
    if (
      lowerPath.includes('/hooks/') ||
      fileName.startsWith('use') && (lowerPath.endsWith('.ts') || lowerPath.endsWith('.tsx'))
    ) {
      return 'hook'
    }

    // Services
    if (lowerPath.includes('/services/') || lowerPath.includes('.service.')) {
      return 'service'
    }

    // Models
    if (lowerPath.includes('/models/') || lowerPath.includes('.model.')) {
      return 'model'
    }

    // Utils/Helpers
    if (
      lowerPath.includes('/utils/') ||
      lowerPath.includes('/lib/') ||
      lowerPath.includes('/helpers/') ||
      lowerPath.includes('.util.') ||
      lowerPath.includes('.helper.')
    ) {
      return 'util'
    }

    // Components (React, Vue, Svelte)
    if (
      lowerPath.includes('/components/') ||
      (lowerPath.endsWith('.tsx') && this.hasJsxContent(content)) ||
      lowerPath.endsWith('.vue') ||
      lowerPath.endsWith('.svelte')
    ) {
      return 'component'
    }

    // TSX files with JSX are likely components
    if (lowerPath.endsWith('.tsx') && this.hasJsxContent(content)) {
      return 'component'
    }

    return 'other'
  }

  /**
   * Check if content contains JSX
   */
  private static hasJsxContent(content: string): boolean {
    // Simple heuristic: check for JSX patterns
    return /<[A-Z][a-zA-Z]*/.test(content) || /return\s*\(?\s*</.test(content)
  }

  /**
   * Extract exports from file content
   */
  private static extractExports(content: string): FileExports {
    const result: FileExports = { named: [] }

    // Default export: export default X
    const defaultMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/)
    if (defaultMatch?.[1]) {
      result.default = defaultMatch[1]
    }

    // Named exports: export const X, export function X, export class X
    const namedExportRegex = /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g
    let match
    while ((match = namedExportRegex.exec(content)) !== null) {
      if (match[1]) {
        result.named.push(match[1])
      }
    }

    // Export { X, Y, Z }
    const bracketExportRegex = /export\s*\{([^}]+)\}/g
    while ((match = bracketExportRegex.exec(content)) !== null) {
      if (match[1]) {
        const names = match[1].split(',').map(n => {
          // Handle "X as Y" syntax - take the exported name
          const parts = n.trim().split(/\s+as\s+/)
          const name = parts[1] ?? parts[0] ?? ''
          return name.trim()
        }).filter(n => n && n !== 'type')
        result.named.push(...names)
      }
    }

    // Type exports: export type X, export interface X
    const typeExportRegex = /export\s+(?:type|interface)\s+(\w+)/g
    const types: string[] = []
    while ((match = typeExportRegex.exec(content)) !== null) {
      if (match[1]) {
        types.push(match[1])
      }
    }
    if (types.length > 0) {
      result.types = types
    }

    return result
  }

  /**
   * Extract imports from file content
   */
  private static extractImports(content: string): FileImports {
    const local: string[] = []
    const external: string[] = []

    // Match import statements
    const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      if (importPath) {
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          local.push(importPath)
        } else {
          // Extract package name (handle scoped packages like @org/pkg)
          const packageName = importPath.startsWith('@')
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0]
          if (packageName && !external.includes(packageName)) {
            external.push(packageName)
          }
        }
      }
    }

    // Also check require() calls
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1]
      if (importPath) {
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          if (!local.includes(importPath)) {
            local.push(importPath)
          }
        } else {
          const packageName = importPath.startsWith('@')
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0]
          if (packageName && !external.includes(packageName)) {
            external.push(packageName)
          }
        }
      }
    }

    return { local, external }
  }

  /**
   * Detect the tech stack of the project
   */
  private static async detectStack(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    tree: TreeNode[]
  ): Promise<DetectedStack> {
    const stack: DetectedStack = {
      language: 'javascript',
      packageManager: 'npm',
      other: [],
    }

    // Check for package.json
    const packageJsonNode = tree.find(n => n.path === 'package.json')
    if (packageJsonNode) {
      try {
        const content = await GitHubService.getFileContent(userId, owner, repo, 'package.json', branch)
        const packageJson = JSON.parse(content.content)
        this.analyzePackageJson(packageJson, stack)
      } catch {
        // Ignore parse errors
      }
    }

    // Detect TypeScript
    const hasTypeScript = tree.some(
      n => n.path === 'tsconfig.json' || n.path.endsWith('.ts') || n.path.endsWith('.tsx')
    )
    if (hasTypeScript) {
      stack.language = 'typescript'
    }

    // Detect package manager
    if (tree.some(n => n.path === 'pnpm-lock.yaml')) {
      stack.packageManager = 'pnpm'
    } else if (tree.some(n => n.path === 'yarn.lock')) {
      stack.packageManager = 'yarn'
    } else if (tree.some(n => n.path === 'bun.lockb')) {
      stack.packageManager = 'bun'
    }

    // Detect monorepo
    if (tree.some(n => n.path === 'turbo.json')) {
      stack.monorepo = 'turborepo'
    } else if (tree.some(n => n.path === 'nx.json')) {
      stack.monorepo = 'nx'
    } else if (tree.some(n => n.path === 'lerna.json')) {
      stack.monorepo = 'lerna'
    }

    // Detect Prisma
    if (tree.some(n => n.path.endsWith('.prisma'))) {
      stack.database = 'prisma'
    }

    // Detect Vue/Nuxt
    if (tree.some(n => n.path.endsWith('.vue'))) {
      stack.framework = tree.some(n => n.path === 'nuxt.config.ts' || n.path === 'nuxt.config.js')
        ? 'nuxt'
        : 'vue'
    }

    // Detect Svelte/SvelteKit
    if (tree.some(n => n.path.endsWith('.svelte'))) {
      stack.framework = tree.some(n => n.path === 'svelte.config.js')
        ? 'sveltekit'
        : 'svelte'
    }

    return stack
  }

  /**
   * Analyze package.json to detect technologies
   */
  private static analyzePackageJson(
    packageJson: Record<string, unknown>,
    stack: DetectedStack
  ): void {
    const allDeps: string[] = []

    if (typeof packageJson['dependencies'] === 'object' && packageJson['dependencies'] !== null) {
      allDeps.push(...Object.keys(packageJson['dependencies'] as Record<string, unknown>))
    }
    if (typeof packageJson['devDependencies'] === 'object' && packageJson['devDependencies'] !== null) {
      allDeps.push(...Object.keys(packageJson['devDependencies'] as Record<string, unknown>))
    }

    // Framework detection
    if (allDeps.includes('next')) {
      stack.framework = 'next'
    } else if (allDeps.includes('hono')) {
      stack.framework = 'hono'
    } else if (allDeps.includes('express')) {
      stack.framework = 'express'
    } else if (allDeps.includes('fastify')) {
      stack.framework = 'fastify'
    } else if (allDeps.includes('koa')) {
      stack.framework = 'koa'
    } else if (allDeps.includes('remix')) {
      stack.framework = 'remix'
    } else if (allDeps.includes('astro')) {
      stack.framework = 'astro'
    }

    // Styling detection
    const styling: string[] = []
    if (allDeps.includes('tailwindcss')) styling.push('tailwind')
    if (allDeps.includes('styled-components')) styling.push('styled-components')
    if (allDeps.includes('@emotion/react') || allDeps.includes('@emotion/styled')) styling.push('emotion')
    if (allDeps.includes('sass') || allDeps.includes('node-sass')) styling.push('sass')
    if (styling.length > 0) stack.styling = styling

    // Database/ORM detection
    if (allDeps.includes('prisma') || allDeps.includes('@prisma/client')) {
      stack.database = 'prisma'
    } else if (allDeps.includes('drizzle-orm')) {
      stack.database = 'drizzle'
    } else if (allDeps.includes('mongoose')) {
      stack.database = 'mongoose'
    } else if (allDeps.includes('typeorm')) {
      stack.database = 'typeorm'
    } else if (allDeps.includes('sequelize')) {
      stack.database = 'sequelize'
    }

    // Testing detection
    const testing: string[] = []
    if (allDeps.includes('jest')) testing.push('jest')
    if (allDeps.includes('vitest')) testing.push('vitest')
    if (allDeps.includes('mocha')) testing.push('mocha')
    if (allDeps.includes('@testing-library/react')) testing.push('testing-library')
    if (allDeps.includes('cypress')) testing.push('cypress')
    if (allDeps.includes('playwright')) testing.push('playwright')
    if (testing.length > 0) stack.testing = testing

    // State management detection
    const stateManagement: string[] = []
    if (allDeps.includes('zustand')) stateManagement.push('zustand')
    if (allDeps.includes('redux') || allDeps.includes('@reduxjs/toolkit')) stateManagement.push('redux')
    if (allDeps.includes('jotai')) stateManagement.push('jotai')
    if (allDeps.includes('recoil')) stateManagement.push('recoil')
    if (allDeps.includes('mobx')) stateManagement.push('mobx')
    if (stateManagement.length > 0) stack.stateManagement = stateManagement

    // Other notable dependencies
    const other: string[] = []
    if (allDeps.includes('zod')) other.push('zod')
    if (allDeps.includes('trpc') || allDeps.includes('@trpc/server')) other.push('trpc')
    if (allDeps.includes('graphql')) other.push('graphql')
    if (allDeps.includes('react-query') || allDeps.includes('@tanstack/react-query')) other.push('react-query')
    if (allDeps.includes('swr')) other.push('swr')
    if (allDeps.includes('axios')) other.push('axios')
    if (allDeps.includes('socket.io')) other.push('socket.io')
    if (allDeps.includes('better-auth')) other.push('better-auth')
    if (allDeps.includes('next-auth')) other.push('next-auth')
    if (allDeps.includes('clerk')) other.push('clerk')
    stack.other = other
  }

  /**
   * Generate a structure summary
   */
  private static generateStructureSummary(
    tree: TreeNode[],
    analyses: FileAnalysis[]
  ): StructureSummary {
    const filesByType: Record<FileType, number> = {
      component: 0,
      hook: 0,
      api: 0,
      util: 0,
      config: 0,
      type: 0,
      test: 0,
      style: 0,
      page: 0,
      layout: 0,
      middleware: 0,
      service: 0,
      model: 0,
      schema: 0,
      other: 0,
    }

    for (const analysis of analyses) {
      filesByType[analysis.fileType]++
    }

    // Get main directories (top-level, excluding common non-code dirs)
    const mainDirectories = new Set<string>()
    const skipDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo'])

    for (const node of tree) {
      if (node.type === 'directory') {
        const topLevel = node.path.split('/')[0]
        if (topLevel && !skipDirs.has(topLevel)) {
          mainDirectories.add(topLevel)
        }
      }
    }

    // Find entry points
    const entryPoints = tree
      .filter(n => {
        const fileName = n.path.split('/').pop() ?? ''
        return (
          n.type === 'file' &&
          (fileName === 'index.ts' ||
            fileName === 'index.tsx' ||
            fileName === 'index.js' ||
            fileName === 'main.ts' ||
            fileName === 'main.tsx' ||
            fileName === 'app.ts' ||
            fileName === 'app.tsx' ||
            fileName === 'server.ts')
        )
      })
      .map(n => n.path)
      .slice(0, 10)

    // Find config files
    const configFiles = tree
      .filter(n => {
        const fileName = n.path.split('/').pop() ?? ''
        return (
          n.type === 'file' &&
          (fileName === 'package.json' ||
            fileName === 'tsconfig.json' ||
            fileName.includes('.config.') ||
            fileName === '.env.example')
        )
      })
      .map(n => n.path)
      .slice(0, 10)

    return {
      totalFiles: tree.filter(n => n.type === 'file').length,
      totalDirectories: tree.filter(n => n.type === 'directory').length,
      filesByType,
      mainDirectories: Array.from(mainDirectories).slice(0, 10),
      entryPoints,
      configFiles,
    }
  }

  /**
   * Save indexation results to database
   */
  private static async saveIndexation(
    projectId: string,
    analyses: FileAnalysis[],
    detectedStack: DetectedStack,
    structureSummary: StructureSummary
  ): Promise<void> {
    // Delete existing indexes for this project
    await db.projectIndex.deleteMany({
      where: { projectId },
    })

    // Insert new indexes
    if (analyses.length > 0) {
      await db.projectIndex.createMany({
        data: analyses.map(a => ({
          projectId,
          filePath: a.path,
          fileType: a.fileType,
          exports: a.exports as unknown as Prisma.InputJsonValue,
          imports: a.imports as unknown as Prisma.InputJsonValue,
          lineCount: a.lineCount,
          lastCommitSha: a.sha,
        })),
      })
    }

    // Update project with detected stack and summary
    await db.project.update({
      where: { id: projectId },
      data: {
        detectedStack: detectedStack as unknown as Prisma.InputJsonValue,
        structureSummary: structureSummary as unknown as Prisma.InputJsonValue,
        status: 'ready',
        lastIndexedAt: new Date(),
      },
    })
  }

  /**
   * Get indexation status for a project
   */
  static async getIndexStatus(projectId: string) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        status: true,
        lastIndexedAt: true,
        detectedStack: true,
        structureSummary: true,
        _count: {
          select: { indexes: true },
        },
      },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    return {
      status: project.status,
      lastIndexedAt: project.lastIndexedAt,
      detectedStack: project.detectedStack,
      structureSummary: project.structureSummary,
      indexedFilesCount: project._count.indexes,
    }
  }

  /**
   * Get indexed files for a project
   */
  static async getIndexedFiles(
    projectId: string,
    options: { fileType?: FileType; limit?: number; offset?: number } = {}
  ) {
    const { fileType, limit = 100, offset = 0 } = options

    const where: { projectId: string; fileType?: string } = { projectId }
    if (fileType) {
      where.fileType = fileType
    }

    const [files, total] = await Promise.all([
      db.projectIndex.findMany({
        where,
        orderBy: { filePath: 'asc' },
        take: limit,
        skip: offset,
      }),
      db.projectIndex.count({ where }),
    ])

    return { files, total }
  }
}
