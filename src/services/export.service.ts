/**
 * Export Service
 * Handles exporting tasks to external integrations (GitHub Issues, etc.)
 */

import { Octokit } from 'octokit'
import { Prisma } from '@prisma/client'
import { db } from '../lib/db.js'
import { NotFoundError, ForbiddenError, ValidationError, AppError } from '../lib/errors.js'
import type {
  GitHubIssueOptions,
  GitHubIssuePayload,
  GitHubIssueResponse,
  ExportResult,
  BulkExportOptions,
  BulkExportResult,
} from '../types/export.types.js'

/**
 * Analysis result from database (JSON fields) - Enhanced structure
 */
interface AnalysisFileToCreate {
  path: string
  description: string
  suggestedCode?: string
}

interface AnalysisFileChange {
  location: string
  action?: 'add' | 'modify' | 'remove'
  description: string
  reason: string
  beforeCode?: string
  afterCode?: string
}

interface AnalysisFileToModify {
  path: string
  changes: AnalysisFileChange[]
}

interface AnalysisFunctionToCreate {
  name: string
  signature: string
  description: string
  location: string
  file?: string
  lineToInsert?: string
  implementation?: string
  inputExample?: {
    description: string
    value: string
  }
  outputExample?: {
    description: string
    value: string
  }
  whyThisApproach?: string
}

interface AnalysisStep {
  order: number
  title?: string
  description: string
  rationale?: string
  files: string[]
  codeExample?: string
}

interface AnalysisEdgeCase {
  scenario: string
  expectedBehavior: string
  input?: string
  implementation?: string
}

interface AnalysisTestCase {
  name: string
  type: 'unit' | 'integration' | 'e2e'
  file?: string
  testCode?: string
  assertion?: string
  steps?: string[]
}

interface AnalysisCodeQualityCheck {
  check: string
  command: string
  expectedResult: string
}

interface AnalysisTestInstruction {
  type: 'unit' | 'integration' | 'manual'
  description: string
  steps: string[]
}

interface AnalysisRisk {
  description: string
  severity?: 'low' | 'medium' | 'high'
  mitigation: string
}

interface AnalysisBreakingChanges {
  hasBreakingChanges: boolean
  description?: string
  migrationSteps?: string[]
}

interface AnalysisMetadata {
  estimatedEffort?: string
  affectedComponents?: string[]
  requiresTests?: boolean
  requiresDocumentation?: boolean
}

interface AnalysisBugInfo {
  rootCause?: string
  rootCauseExplanation?: string
  problematicCode?: {
    file: string
    lines: string
    code: string
  }
  reproductionSteps?: string[]
}

interface AnalysisFix {
  approach?: string
  whyThisApproach?: string
  codeDiff?: {
    before: string
    after: string
  }
  alternatives?: Array<{
    approach: string
    whyNotChosen: string
  }>
}

interface AnalysisRegressionRisk {
  area: string
  mitigation: string
  testToAdd?: string
}

interface AnalysisImpact {
  directlyAffected?: string[] | Array<{ file: string; lines?: string; reason: string }>
  potentiallyAffected?: string[] | Array<{ file: string; reason: string }>
  noChangeNeeded?: string[]
}

interface AnalysisBeforeAfterExample {
  scenario: string
  before: string
  after: string
}

interface AnalysisBackwardsCompat {
  isCompatible?: boolean
  breakingChanges?: string[]
  migrationRequired?: boolean
}

/**
 * Export Service
 */
export class ExportService {
  /**
   * Export a task to GitHub Issues
   */
  static async exportToGitHubIssue(
    taskId: string,
    userId: string,
    options: GitHubIssueOptions = {}
  ): Promise<ExportResult> {
    // Get task with analysis and project
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            userId: true,
            githubOwner: true,
            githubRepoName: true,
          },
        },
        analyses: {
          where: { status: 'completed' },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!task) {
      throw new NotFoundError('Task not found')
    }

    if (task.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    // Get GitHub token from Account (OAuth login)
    const account = await db.account.findFirst({
      where: {
        userId,
        providerId: 'github',
      },
    })

    if (!account?.accessToken) {
      throw new ValidationError('GitHub not connected. Please reconnect your GitHub account.')
    }

    // Get or create GitHub integration for user
    let integration = await db.integration.findFirst({
      where: {
        userId,
        type: 'github_issues',
        isActive: true,
      },
    })

    // Auto-create integration if user has GitHub account but no integration
    if (!integration) {
      integration = await db.integration.create({
        data: {
          userId,
          type: 'github_issues',
          isActive: true,
        },
      })
    }

    // Create export record
    const taskExport = await db.taskExport.create({
      data: {
        taskId,
        integrationId: integration.id,
        status: 'pending',
      },
    })

    try {
      // Get latest analysis
      const analysis = task.analyses[0]

      // Build issue body
      const issueBody = this.buildIssueBody(task, analysis)

      // Create GitHub issue
      const octokit = new Octokit({ auth: account.accessToken })

      const issuePayload: GitHubIssuePayload = {
        title: task.title,
        body: issueBody,
      }

      if (options.labels && options.labels.length > 0) {
        issuePayload.labels = options.labels
      }
      if (options.assignees && options.assignees.length > 0) {
        issuePayload.assignees = options.assignees
      }
      if (options.milestone) {
        issuePayload.milestone = options.milestone
      }

      const { data: issue } = await octokit.rest.issues.create({
        owner: task.project.githubOwner,
        repo: task.project.githubRepoName,
        ...issuePayload,
      })

      const issueResponse: GitHubIssueResponse = {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: issue.state,
        htmlUrl: issue.html_url,
        createdAt: issue.created_at,
        labels: issue.labels
          .filter((l): l is { id?: number; name?: string; color?: string } => typeof l === 'object')
          .map((l) => ({
            id: l.id ?? 0,
            name: l.name ?? '',
            color: l.color ?? '',
          })),
        assignees: issue.assignees?.map((a) => ({ login: a.login })) ?? [],
      }

      // Update export record
      await db.taskExport.update({
        where: { id: taskExport.id },
        data: {
          status: 'success',
          externalId: String(issue.number),
          externalUrl: issue.html_url,
          exportedContent: issueResponse as unknown as Prisma.InputJsonValue,
        },
      })

      // Update task status
      await db.task.update({
        where: { id: taskId },
        data: { status: 'exported' },
      })

      return {
        exportId: taskExport.id,
        externalId: String(issue.number),
        externalUrl: issue.html_url,
        status: 'success',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Update export as failed
      await db.taskExport.update({
        where: { id: taskExport.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      })

      throw new AppError(`Failed to create GitHub issue: ${errorMessage}`, 502, 'GITHUB_ERROR')
    }
  }

  /**
   * Bulk export tasks to GitHub Issues
   */
  static async bulkExportToGitHubIssues(
    userId: string,
    options: BulkExportOptions
  ): Promise<BulkExportResult> {
    const results: ExportResult[] = []
    let successful = 0
    let failed = 0

    for (const taskId of options.taskIds) {
      try {
        const result = await this.exportToGitHubIssue(taskId, userId, options.options)
        results.push(result)
        successful++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.push({
          exportId: '',
          externalId: '',
          externalUrl: '',
          status: 'failed',
          errorMessage,
        })
        failed++
      }
    }

    return {
      total: options.taskIds.length,
      successful,
      failed,
      results,
    }
  }

  /**
   * Get export history for a task
   */
  static async getTaskExports(taskId: string, userId: string) {
    // Verify access
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { userId: true },
        },
      },
    })

    if (!task) {
      throw new NotFoundError('Task not found')
    }

    if (task.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    const exports = await db.taskExport.findMany({
      where: { taskId },
      orderBy: { exportedAt: 'desc' },
      include: {
        integration: {
          select: {
            type: true,
          },
        },
      },
    })

    return exports
  }

  /**
   * Get export by ID
   */
  static async getExport(exportId: string, userId: string) {
    const taskExport = await db.taskExport.findUnique({
      where: { id: exportId },
      include: {
        task: {
          include: {
            project: {
              select: { userId: true },
            },
          },
        },
        integration: {
          select: { type: true },
        },
      },
    })

    if (!taskExport) {
      throw new NotFoundError('Export not found')
    }

    if (taskExport.task.project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    return taskExport
  }

  /**
   * Build GitHub issue body from task and analysis - Enhanced format
   */
  private static buildIssueBody(
    task: {
      title: string
      description: string
      type: string
      complexity: string
    },
    analysis?: {
      filesToCreate: unknown
      filesToModify: unknown
      implementationSteps: unknown
      risks: unknown
      dependencies: unknown
      reasoning: string | null
      // Enhanced fields
      context?: unknown
      expectedBehavior?: unknown
      acceptanceCriteria?: unknown
      functionsToCreate?: unknown
      edgeCases?: unknown
      testingInstructions?: unknown
      testCases?: unknown
      codeQualityChecks?: unknown
      breakingChanges?: unknown
      metadata?: unknown
      // Bug-specific
      bugAnalysis?: unknown
      fix?: unknown
      regressionRisks?: unknown
      // Modification-specific
      currentState?: unknown
      targetState?: unknown
      impactAnalysis?: unknown
      backwardsCompatibility?: unknown
      beforeAfterExamples?: unknown
    }
  ): string {
    const sections: string[] = []
    const taskType = task.type.toLowerCase()

    // Determine emoji based on task type
    const typeEmoji = this.getTypeEmoji(taskType)

    if (!analysis) {
      // No analysis - simple format
      sections.push(`## ${typeEmoji} Description\n\n${task.description}`)
      sections.push(`## 📊 Metadata\n\n| Property | Value |\n|----------|-------|\n| **Type** | ${task.type} |\n| **Complexity** | ${this.getComplexityEmoji(task.complexity)} ${task.complexity} |`)
      sections.push('> **Note:** This task has not been analyzed yet.')
      sections.push('---\n*Generated by Distill*')
      return sections.join('\n\n')
    }

    // Build based on task type
    if (taskType === 'bugfix') {
      return this.buildBugFixIssueBody(task, analysis)
    } else if (taskType === 'modification') {
      return this.buildModificationIssueBody(task, analysis)
    } else {
      return this.buildFeatureIssueBody(task, analysis)
    }
  }

  /**
   * Build issue body for Feature tasks
   */
  private static buildFeatureIssueBody(
    task: { title: string; description: string; type: string; complexity: string },
    analysis: Record<string, unknown>
  ): string {
    const sections: string[] = []

    // Description section
    sections.push(`## 📋 Description\n\n${task.description}`)

    // Context
    const context = analysis['context'] as string | undefined
    if (context) {
      sections.push(`### Context\n${context}`)
    }

    // Expected behavior
    const expectedBehavior = analysis['expectedBehavior'] as string | undefined
    if (expectedBehavior) {
      sections.push(`### Expected Behavior\n${expectedBehavior}`)
    }

    // Acceptance Criteria
    const acceptanceCriteria = (analysis['acceptanceCriteria'] as string[] | null) ?? []
    if (acceptanceCriteria.length > 0) {
      const criteriaList = acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n')
      sections.push(`---\n\n## 🎯 Acceptance Criteria\n\n${criteriaList}`)
    }

    // Implementation Plan
    sections.push('---\n\n## 🔧 Implementation Plan')

    // Files to Create
    const filesToCreate = (analysis['filesToCreate'] as AnalysisFileToCreate[] | null) ?? []
    if (filesToCreate.length > 0) {
      let filesTable = '### Files to Create\n\n| File | Description |\n|------|-------------|\n'
      filesTable += filesToCreate
        .map((f) => `| \`${f.path}\` | ${f.description} |`)
        .join('\n')
      sections.push(filesTable)

      // Add suggested code if available
      for (const file of filesToCreate) {
        if (file.suggestedCode) {
          sections.push(`\n**\`${file.path}\`**\n\n\`\`\`typescript\n${file.suggestedCode}\n\`\`\``)
        }
      }
    }

    // Files to Modify
    const filesToModify = (analysis['filesToModify'] as AnalysisFileToModify[] | null) ?? []
    if (filesToModify.length > 0) {
      let modifySection = '### Files to Modify\n\n'
      for (const file of filesToModify) {
        modifySection += `#### \`${file.path}\`\n\n`
        if (file.changes && file.changes.length > 0) {
          modifySection += '| Location | Action | Description |\n|----------|--------|-------------|\n'
          for (const change of file.changes) {
            const action = change.action || 'modify'
            modifySection += `| ${change.location} | ${action} | ${change.description} |\n`
          }
          // Add code diffs if available
          for (const change of file.changes) {
            if (change.beforeCode || change.afterCode) {
              modifySection += `\n**${change.location}**\n\n`
              if (change.beforeCode) {
                modifySection += `\`\`\`diff\n- ${change.beforeCode.split('\n').join('\n- ')}\n`
              }
              if (change.afterCode) {
                modifySection += `+ ${change.afterCode.split('\n').join('\n+ ')}\n\`\`\`\n`
              }
            }
          }
        }
      }
      sections.push(modifySection)
    }

    // Functions/Components to Create (Enhanced with input/output examples)
    const functionsToCreate = (analysis['functionsToCreate'] as AnalysisFunctionToCreate[] | null) ?? []
    if (functionsToCreate.length > 0) {
      let funcSection = '### Functions / Components to Create\n\n'

      for (const func of functionsToCreate) {
        const location = func.file || func.location
        const insertAt = func.lineToInsert ? ` at ${func.lineToInsert}` : ''

        funcSection += `#### \`${func.name}\`\n\n`
        funcSection += `**Location:** \`${location}\`${insertAt}\n\n`
        funcSection += `**Description:** ${func.description}\n\n`

        // Signature
        funcSection += '```typescript\n'
        funcSection += `${func.signature}\n`
        funcSection += '```\n\n'

        // Implementation example (if provided)
        if (func.implementation) {
          funcSection += '**Implementation:**\n\n'
          funcSection += '```typescript\n'
          funcSection += `${func.implementation}\n`
          funcSection += '```\n\n'
        }

        // Input/Output examples (enhanced)
        if (func.inputExample || func.outputExample) {
          funcSection += '**Example:**\n\n'
          funcSection += '| Input | Output |\n|-------|--------|\n'
          const inputVal = func.inputExample?.value || '-'
          const outputVal = func.outputExample?.value || '-'
          funcSection += `| \`${inputVal}\` | \`${outputVal}\` |\n\n`

          if (func.inputExample?.description) {
            funcSection += `*Input:* ${func.inputExample.description}\n\n`
          }
          if (func.outputExample?.description) {
            funcSection += `*Output:* ${func.outputExample.description}\n\n`
          }
        }

        // Why this approach
        if (func.whyThisApproach) {
          funcSection += `**Why this approach:** ${func.whyThisApproach}\n\n`
        }

        funcSection += '---\n\n'
      }
      sections.push(funcSection)
    }

    // Implementation Steps
    const steps = (analysis['implementationSteps'] as AnalysisStep[] | null) ?? []
    if (steps.length > 0) {
      let stepsSection = '---\n\n## 📝 Detailed Steps\n\n'
      const sortedSteps = steps.sort((a, b) => a.order - b.order)
      for (const step of sortedSteps) {
        const title = step.title || step.description.substring(0, 50)
        stepsSection += `### ${step.order}. ${title}\n\n`
        stepsSection += `${step.description}\n\n`
        if (step.rationale) {
          stepsSection += `**Why?** ${step.rationale}\n\n`
        }
        if (step.files && step.files.length > 0) {
          stepsSection += `**Files:** \`${step.files.join('`, `')}\`\n\n`
        }
        if (step.codeExample) {
          stepsSection += `\`\`\`typescript\n${step.codeExample}\n\`\`\`\n\n`
        }
      }
      sections.push(stepsSection)
    }

    // Edge Cases (Enhanced with input and implementation)
    const edgeCases = (analysis['edgeCases'] as AnalysisEdgeCase[] | null) ?? []
    if (edgeCases.length > 0) {
      let edgeSection = '---\n\n## ⚠️ Edge Cases to Handle\n\n'

      // Check if we have enhanced edge cases with input/implementation
      const hasEnhanced = edgeCases.some(e => e.input || e.implementation)

      if (hasEnhanced) {
        for (const edge of edgeCases) {
          edgeSection += `### ${edge.scenario}\n\n`
          if (edge.input) {
            edgeSection += `**Input:** \`${edge.input}\`\n\n`
          }
          edgeSection += `**Expected behavior:** ${edge.expectedBehavior}\n\n`
          if (edge.implementation) {
            edgeSection += `**Implementation:**\n\`\`\`typescript\n${edge.implementation}\n\`\`\`\n\n`
          }
        }
      } else {
        // Fallback to simple table format
        edgeSection += '| Scenario | Expected Behavior |\n|----------|------------------|\n'
        for (const edge of edgeCases) {
          edgeSection += `| ${edge.scenario} | ${edge.expectedBehavior} |\n`
        }
      }
      sections.push(edgeSection)
    }

    // Testing Instructions (legacy format)
    const testingInstructions = (analysis['testingInstructions'] as AnalysisTestInstruction[] | null) ?? []
    if (testingInstructions.length > 0) {
      let testSection = '---\n\n## 🧪 Testing\n\n'
      for (const test of testingInstructions) {
        const typeEmoji = test.type === 'unit' ? '🔬' : test.type === 'integration' ? '🔗' : '👆'
        testSection += `### ${typeEmoji} ${test.type.charAt(0).toUpperCase() + test.type.slice(1)} Test: ${test.description}\n\n`
        for (let i = 0; i < test.steps.length; i++) {
          testSection += `${i + 1}. ${test.steps[i]}\n`
        }
        testSection += '\n'
      }
      sections.push(testSection)
    }

    // Test Cases (enhanced with actual test code)
    const testCases = (analysis['testCases'] as AnalysisTestCase[] | null) ?? []
    if (testCases.length > 0) {
      let testCaseSection = testingInstructions.length === 0 ? '---\n\n## 🧪 Test Cases\n\n' : '### Specific Test Cases\n\n'

      // Group by type
      const unitTests = testCases.filter(t => t.type === 'unit')
      const integrationTests = testCases.filter(t => t.type === 'integration')
      const e2eTests = testCases.filter(t => t.type === 'e2e')

      if (unitTests.length > 0) {
        testCaseSection += '#### 🔬 Unit Tests\n\n'
        for (const test of unitTests) {
          testCaseSection += `**${test.name}**\n`
          if (test.file) {
            testCaseSection += `*File:* \`${test.file}\`\n\n`
          }
          if (test.testCode) {
            testCaseSection += '```typescript\n'
            testCaseSection += `${test.testCode}\n`
            testCaseSection += '```\n\n'
          }
          if (test.assertion) {
            testCaseSection += `*Assertion:* ${test.assertion}\n\n`
          }
        }
      }

      if (integrationTests.length > 0) {
        testCaseSection += '#### 🔗 Integration Tests\n\n'
        for (const test of integrationTests) {
          testCaseSection += `**${test.name}**\n`
          if (test.file) {
            testCaseSection += `*File:* \`${test.file}\`\n\n`
          }
          if (test.steps && test.steps.length > 0) {
            for (let i = 0; i < test.steps.length; i++) {
              testCaseSection += `${i + 1}. ${test.steps[i]}\n`
            }
            testCaseSection += '\n'
          }
          if (test.testCode) {
            testCaseSection += '```typescript\n'
            testCaseSection += `${test.testCode}\n`
            testCaseSection += '```\n\n'
          }
        }
      }

      if (e2eTests.length > 0) {
        testCaseSection += '#### 🎯 E2E Tests\n\n'
        for (const test of e2eTests) {
          testCaseSection += `**${test.name}**\n\n`
          if (test.steps && test.steps.length > 0) {
            for (let i = 0; i < test.steps.length; i++) {
              testCaseSection += `${i + 1}. ${test.steps[i]}\n`
            }
            testCaseSection += '\n'
          }
        }
      }

      sections.push(testCaseSection)
    }

    // Code Quality Checks
    const codeQualityChecks = (analysis['codeQualityChecks'] as AnalysisCodeQualityCheck[] | null) ?? []
    if (codeQualityChecks.length > 0) {
      let qualitySection = '---\n\n## ✅ Code Quality Checks\n\n'
      qualitySection += '| Check | Command | Expected |\n|-------|---------|----------|\n'
      for (const check of codeQualityChecks) {
        qualitySection += `| ${check.check} | \`${check.command}\` | ${check.expectedResult} |\n`
      }
      sections.push(qualitySection)
    }

    // Risks
    const risks = (analysis['risks'] as AnalysisRisk[] | null) ?? []
    if (risks.length > 0) {
      let riskSection = '---\n\n## ⚠️ Risks\n\n'
      for (const risk of risks) {
        const severityEmoji = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢'
        riskSection += `- ${severityEmoji} **${risk.description}**\n  - Mitigation: ${risk.mitigation}\n`
      }
      sections.push(riskSection)
    }

    // Dependencies
    const dependencies = (analysis['dependencies'] as string[] | null) ?? []
    if (dependencies.length > 0) {
      sections.push(`---\n\n## 🔗 Dependencies\n\n${dependencies.map((d) => `- ${d}`).join('\n')}`)
    }

    // Metadata
    const metadata = analysis['metadata'] as AnalysisMetadata | undefined
    const breakingChanges = analysis['breakingChanges'] as AnalysisBreakingChanges | undefined
    const filesToCreateCount = filesToCreate.length
    const filesToModifyCount = filesToModify.length
    const totalFiles = filesToCreateCount + filesToModifyCount

    let metadataSection = '---\n\n## 📊 Metadata\n\n'
    metadataSection += '| Property | Value |\n|----------|-------|\n'
    metadataSection += `| **Complexity** | ${this.getComplexityEmoji(task.complexity)} ${task.complexity} |\n`
    metadataSection += `| **Files to create** | ${filesToCreateCount} |\n`
    metadataSection += `| **Files to modify** | ${filesToModifyCount} |\n`
    metadataSection += `| **Total files impacted** | ${totalFiles} |\n`
    if (metadata?.estimatedEffort) {
      metadataSection += `| **Estimated effort** | ${metadata.estimatedEffort} |\n`
    }
    if (breakingChanges) {
      metadataSection += `| **Breaking changes** | ${breakingChanges.hasBreakingChanges ? '⚠️ Yes' : '✅ No'} |\n`
    }
    if (metadata?.requiresTests !== undefined) {
      metadataSection += `| **Requires tests** | ${metadata.requiresTests ? 'Yes' : 'No'} |\n`
    }
    sections.push(metadataSection)

    // Footer
    sections.push('---\n*🤖 Generated by Distill*')

    return sections.join('\n\n')
  }

  /**
   * Build issue body for Bug Fix tasks
   */
  private static buildBugFixIssueBody(
    task: { title: string; description: string; type: string; complexity: string },
    analysis: Record<string, unknown>
  ): string {
    const sections: string[] = []

    // Bug Description
    sections.push(`## 🐛 Bug Description\n\n${task.description}`)

    // Current vs Expected behavior
    const currentState = analysis['currentState'] as string | undefined
    const expectedBehavior = analysis['expectedBehavior'] as string | undefined
    if (currentState) {
      sections.push(`### Current Behavior\n${currentState}`)
    }
    if (expectedBehavior) {
      sections.push(`### Expected Behavior\n${expectedBehavior}`)
    }

    // Bug Analysis (Enhanced)
    const bugAnalysis = analysis['bugAnalysis'] as AnalysisBugInfo | undefined
    if (bugAnalysis) {
      let bugSection = '---\n\n## 🔍 Root Cause Analysis\n\n'
      if (bugAnalysis.rootCause) {
        bugSection += `### Origin\n${bugAnalysis.rootCause}\n\n`
      }
      if (bugAnalysis.rootCauseExplanation) {
        bugSection += `### Technical Explanation\n${bugAnalysis.rootCauseExplanation}\n\n`
      }
      if (bugAnalysis.problematicCode) {
        bugSection += `### Problematic Code\n\n`
        bugSection += `**File:** \`${bugAnalysis.problematicCode.file}\` (${bugAnalysis.problematicCode.lines})\n\n`
        bugSection += `\`\`\`typescript\n${bugAnalysis.problematicCode.code}\n\`\`\`\n`
      }
      if (bugAnalysis.reproductionSteps && bugAnalysis.reproductionSteps.length > 0) {
        bugSection += `\n### Reproduction Steps\n\n`
        for (let i = 0; i < bugAnalysis.reproductionSteps.length; i++) {
          bugSection += `${i + 1}. ${bugAnalysis.reproductionSteps[i]}\n`
        }
      }
      sections.push(bugSection)
    }

    // Proposed Fix (Enhanced with why and alternatives)
    const fix = analysis['fix'] as AnalysisFix | undefined
    if (fix) {
      let fixSection = '---\n\n## 🔧 Proposed Fix\n\n'
      if (fix.approach) {
        fixSection += `### Approach\n${fix.approach}\n\n`
      }
      if (fix.whyThisApproach) {
        fixSection += `**Why this approach:** ${fix.whyThisApproach}\n\n`
      }
      if (fix.codeDiff) {
        fixSection += `### Code Changes\n\n\`\`\`diff\n`
        if (fix.codeDiff.before) {
          fixSection += `- ${fix.codeDiff.before.split('\n').join('\n- ')}\n`
        }
        if (fix.codeDiff.after) {
          fixSection += `+ ${fix.codeDiff.after.split('\n').join('\n+ ')}\n`
        }
        fixSection += `\`\`\`\n`
      }
      if (fix.alternatives && fix.alternatives.length > 0) {
        fixSection += `\n### Alternatives Considered\n\n`
        for (const alt of fix.alternatives) {
          fixSection += `- **${alt.approach}**\n  - *Why not chosen:* ${alt.whyNotChosen}\n`
        }
      }
      sections.push(fixSection)
    }

    // Files to Modify (include standard sections)
    const filesToModify = (analysis['filesToModify'] as AnalysisFileToModify[] | null) ?? []
    if (filesToModify.length > 0) {
      let modifySection = '---\n\n## 📁 Files to Modify\n\n'
      modifySection += '| File | Change | Lines |\n|------|--------|-------|\n'
      for (const file of filesToModify) {
        for (const change of file.changes || []) {
          modifySection += `| \`${file.path}\` | ${change.description} | ${change.location} |\n`
        }
      }
      sections.push(modifySection)
    }

    // Regression Risks (Enhanced with test to add)
    const regressionRisks = (analysis['regressionRisks'] as AnalysisRegressionRisk[] | null) ?? []
    if (regressionRisks.length > 0) {
      let regressionSection = '---\n\n## ⚠️ Regression Risks\n\n'
      for (const risk of regressionRisks) {
        regressionSection += `- [ ] **${risk.area}**\n`
        regressionSection += `  - *Mitigation:* ${risk.mitigation}\n`
        if (risk.testToAdd) {
          regressionSection += `  - *Test to add:* \`${risk.testToAdd}\`\n`
        }
      }
      sections.push(regressionSection)
    }

    // Testing
    const testingInstructions = (analysis['testingInstructions'] as AnalysisTestInstruction[] | null) ?? []
    if (testingInstructions.length > 0) {
      let testSection = '---\n\n## 🧪 Validation Tests\n\n'
      for (const test of testingInstructions) {
        testSection += `### ${test.description}\n\n`
        for (let i = 0; i < test.steps.length; i++) {
          testSection += `${i + 1}. ${test.steps[i]}\n`
        }
        testSection += '\n'
      }
      sections.push(testSection)
    }

    // Metadata
    const risks = (analysis['risks'] as AnalysisRisk[] | null) ?? []
    const highSeverity = risks.some(r => r.severity === 'high')

    let metadataSection = '---\n\n## 📊 Metadata\n\n'
    metadataSection += '| Property | Value |\n|----------|-------|\n'
    metadataSection += `| **Severity** | ${highSeverity ? '🔴 High' : task.complexity === 'critical' ? '🟠 High' : '🟡 Medium'} |\n`
    metadataSection += `| **Fix complexity** | ${this.getComplexityEmoji(task.complexity)} ${task.complexity} |\n`
    metadataSection += `| **Files impacted** | ${filesToModify.length} |\n`
    metadataSection += `| **Regression risk** | ${regressionRisks.length > 0 ? 'Medium' : 'Low'} |\n`
    sections.push(metadataSection)

    // Footer
    sections.push('---\n*🤖 Generated by Distill*')

    return sections.join('\n\n')
  }

  /**
   * Build issue body for Modification tasks
   */
  private static buildModificationIssueBody(
    task: { title: string; description: string; type: string; complexity: string },
    analysis: Record<string, unknown>
  ): string {
    const sections: string[] = []

    // Description
    sections.push(`## ✏️ Modification Description\n\n${task.description}`)

    // Context
    const context = analysis['context'] as string | undefined
    if (context) {
      sections.push(`### Context\n${context}`)
    }

    // Current vs Target State
    const currentState = analysis['currentState'] as string | undefined
    const targetState = analysis['targetState'] as string | undefined
    if (currentState || targetState) {
      let stateSection = ''
      if (currentState) {
        stateSection += `### Current State\n${currentState}\n\n`
      }
      if (targetState) {
        stateSection += `### Target State\n${targetState}`
      }
      sections.push(stateSection)
    }

    // Before/After Examples (Enhanced)
    const beforeAfterExamples = (analysis['beforeAfterExamples'] as AnalysisBeforeAfterExample[] | null) ?? []
    if (beforeAfterExamples.length > 0) {
      let examplesSection = '### Before/After Examples\n\n'
      for (const example of beforeAfterExamples) {
        examplesSection += `**${example.scenario}**\n\n`
        examplesSection += `| Before | After |\n|--------|-------|\n`
        examplesSection += `| ${example.before} | ${example.after} |\n\n`
      }
      sections.push(examplesSection)
    }

    // Objectives/Acceptance Criteria
    const acceptanceCriteria = (analysis['acceptanceCriteria'] as string[] | null) ?? []
    if (acceptanceCriteria.length > 0) {
      const criteriaList = acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n')
      sections.push(`---\n\n## 🎯 Objectives\n\n${criteriaList}`)
    }

    // Files to Modify with detailed changes
    const filesToModify = (analysis['filesToModify'] as AnalysisFileToModify[] | null) ?? []
    if (filesToModify.length > 0) {
      let modifySection = '---\n\n## 🔧 Modification Plan\n\n'

      for (const file of filesToModify) {
        modifySection += `### \`${file.path}\`\n\n`

        if (file.changes && file.changes.length > 0) {
          modifySection += '| Section | Action | Description |\n|---------|--------|-------------|\n'
          for (const change of file.changes) {
            modifySection += `| ${change.location} | ${change.action || 'modify'} | ${change.description} |\n`
          }
          modifySection += '\n'

          // Code diffs
          for (const change of file.changes) {
            if (change.beforeCode && change.afterCode) {
              modifySection += `**${change.location}**\n\n`
              modifySection += `**Before:**\n\`\`\`typescript\n${change.beforeCode}\n\`\`\`\n\n`
              modifySection += `**After:**\n\`\`\`typescript\n${change.afterCode}\n\`\`\`\n\n`
            }
          }
        }
      }
      sections.push(modifySection)
    }

    // Impact Analysis (Enhanced with reasons)
    const impactAnalysis = analysis['impactAnalysis'] as AnalysisImpact | undefined
    if (impactAnalysis) {
      let impactSection = '---\n\n## 🔗 Impact Analysis\n\n'

      // Check if we have enhanced format (objects with reason) or simple format (strings)
      const hasEnhancedFormat = impactAnalysis.directlyAffected?.some(
        item => typeof item === 'object' && item !== null
      )

      if (hasEnhancedFormat) {
        // Enhanced format with detailed info
        if (impactAnalysis.directlyAffected && impactAnalysis.directlyAffected.length > 0) {
          impactSection += '### ✅ Directly Affected (Must Update)\n\n'
          for (const item of impactAnalysis.directlyAffected) {
            if (typeof item === 'object' && item !== null) {
              const lines = item.lines ? ` (${item.lines})` : ''
              impactSection += `- **\`${item.file}\`**${lines}\n  - *Reason:* ${item.reason}\n`
            } else {
              impactSection += `- \`${item}\`\n`
            }
          }
          impactSection += '\n'
        }
        if (impactAnalysis.potentiallyAffected && impactAnalysis.potentiallyAffected.length > 0) {
          impactSection += '### ⚠️ Potentially Affected (Verify)\n\n'
          for (const item of impactAnalysis.potentiallyAffected) {
            if (typeof item === 'object' && item !== null) {
              impactSection += `- **\`${item.file}\`**\n  - *Reason:* ${item.reason}\n`
            } else {
              impactSection += `- \`${item}\`\n`
            }
          }
          impactSection += '\n'
        }
        if (impactAnalysis.noChangeNeeded && impactAnalysis.noChangeNeeded.length > 0) {
          impactSection += '### ✓ No Change Needed\n\n'
          for (const file of impactAnalysis.noChangeNeeded) {
            impactSection += `- \`${file}\`\n`
          }
        }
      } else {
        // Simple table format (backwards compatible)
        impactSection += '| File | Impact | Action Required |\n|------|--------|----------------|\n'

        if (impactAnalysis.directlyAffected) {
          for (const file of impactAnalysis.directlyAffected) {
            const fileName = typeof file === 'string' ? file : (file as { file: string }).file
            impactSection += `| \`${fileName}\` | Direct | ✅ Must update |\n`
          }
        }
        if (impactAnalysis.potentiallyAffected) {
          for (const file of impactAnalysis.potentiallyAffected) {
            const fileName = typeof file === 'string' ? file : (file as { file: string }).file
            impactSection += `| \`${fileName}\` | Potential | ⚠️ Verify |\n`
          }
        }
        if (impactAnalysis.noChangeNeeded) {
          for (const file of impactAnalysis.noChangeNeeded) {
            impactSection += `| \`${file}\` | None | ✓ No change |\n`
          }
        }
      }
      sections.push(impactSection)
    }

    // Edge Cases
    const edgeCases = (analysis['edgeCases'] as AnalysisEdgeCase[] | null) ?? []
    if (edgeCases.length > 0) {
      let edgeSection = '---\n\n## ⚠️ Edge Cases\n\n'
      edgeSection += '| Case | Before | After |\n|------|--------|-------|\n'
      for (const edge of edgeCases) {
        edgeSection += `| ${edge.scenario} | - | ${edge.expectedBehavior} |\n`
      }
      sections.push(edgeSection)
    }

    // Testing
    const testingInstructions = (analysis['testingInstructions'] as AnalysisTestInstruction[] | null) ?? []
    if (testingInstructions.length > 0) {
      let testSection = '---\n\n## 🧪 Testing\n\n'

      const existingTests = testingInstructions.filter(t => t.type === 'unit')
      const newTests = testingInstructions.filter(t => t.type !== 'unit')

      if (existingTests.length > 0) {
        testSection += '### Existing Tests to Update\n'
        for (const test of existingTests) {
          testSection += `- [ ] ${test.description}\n`
        }
        testSection += '\n'
      }

      if (newTests.length > 0) {
        testSection += '### Manual Tests\n'
        for (const test of newTests) {
          testSection += `\n**${test.description}**\n`
          for (let i = 0; i < test.steps.length; i++) {
            testSection += `${i + 1}. ${test.steps[i]}\n`
          }
        }
      }
      sections.push(testSection)
    }

    // Metadata
    const backwardsCompat = analysis['backwardsCompatibility'] as AnalysisBackwardsCompat | undefined
    const metadata = analysis['metadata'] as AnalysisMetadata | undefined

    let metadataSection = '---\n\n## 📊 Metadata\n\n'
    metadataSection += '| Property | Value |\n|----------|-------|\n'
    metadataSection += `| **Complexity** | ${this.getComplexityEmoji(task.complexity)} ${task.complexity} |\n`
    metadataSection += `| **Files impacted** | ${filesToModify.length} |\n`
    if (metadata?.estimatedEffort) {
      metadataSection += `| **Estimated effort** | ${metadata.estimatedEffort} |\n`
    }
    if (backwardsCompat) {
      metadataSection += `| **Backwards compatible** | ${backwardsCompat.isCompatible ? '✅ Yes' : '⚠️ No'} |\n`
      if (backwardsCompat.migrationRequired) {
        metadataSection += `| **Migration required** | Yes |\n`
      }
    }
    if (metadata?.requiresTests !== undefined) {
      const testsInfo = metadata.requiresTests
        ? `${testingInstructions.length} tests`
        : 'No'
      metadataSection += `| **Tests required** | ${testsInfo} |\n`
    }
    sections.push(metadataSection)

    // Footer
    sections.push('---\n*🤖 Generated by Distill*')

    return sections.join('\n\n')
  }

  /**
   * Get emoji for task type
   */
  private static getTypeEmoji(taskType: string): string {
    switch (taskType.toLowerCase()) {
      case 'feature':
        return '📋'
      case 'bugfix':
        return '🐛'
      case 'modification':
        return '✏️'
      case 'refactor':
        return '♻️'
      case 'documentation':
        return '📚'
      default:
        return '📋'
    }
  }

  /**
   * Get emoji for complexity
   */
  private static getComplexityEmoji(complexity: string): string {
    switch (complexity.toLowerCase()) {
      case 'simple':
        return '🟢'
      case 'moderate':
        return '🟡'
      case 'critical':
        return '🔴'
      default:
        return '🟡'
    }
  }

  /**
   * Create or get GitHub Issues integration for a user
   */
  static async ensureGitHubIntegration(userId: string): Promise<string> {
    let integration = await db.integration.findFirst({
      where: {
        userId,
        type: 'github_issues',
      },
    })

    if (!integration) {
      integration = await db.integration.create({
        data: {
          userId,
          type: 'github_issues',
          isActive: true,
        },
      })
    }

    return integration.id
  }

  /**
   * Get export statistics for a project
   */
  static async getProjectExportStats(projectId: string, userId: string) {
    // Verify access
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    const stats = await db.taskExport.groupBy({
      by: ['status'],
      where: {
        task: { projectId },
      },
      _count: { id: true },
    })

    const totalTasks = await db.task.count({
      where: { projectId },
    })

    const exportedTasks = await db.task.count({
      where: { projectId, status: 'exported' },
    })

    return {
      totalTasks,
      exportedTasks,
      pendingExport: totalTasks - exportedTasks,
      byStatus: stats.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id
          return acc
        },
        {} as Record<string, number>
      ),
    }
  }
}
