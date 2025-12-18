/**
 * Export Types
 * Types for exporting tasks to external integrations
 */

/**
 * GitHub Issue export options
 */
export interface GitHubIssueOptions {
  labels?: string[]
  assignees?: string[]
  milestone?: number
}

/**
 * GitHub Issue creation payload
 */
export interface GitHubIssuePayload {
  title: string
  body: string
  labels?: string[]
  assignees?: string[]
  milestone?: number
}

/**
 * GitHub Issue response from API
 */
export interface GitHubIssueResponse {
  id: number
  number: number
  title: string
  body: string | null
  state: string
  htmlUrl: string
  createdAt: string
  labels: Array<{
    id: number
    name: string
    color: string
  }>
  assignees: Array<{
    login: string
  }>
}

/**
 * Export result
 */
export interface ExportResult {
  exportId: string
  externalId: string
  externalUrl: string
  status: 'success' | 'failed'
  errorMessage?: string
}

/**
 * Bulk export options
 */
export interface BulkExportOptions {
  taskIds: string[]
  options?: GitHubIssueOptions
}

/**
 * Bulk export result
 */
export interface BulkExportResult {
  total: number
  successful: number
  failed: number
  results: ExportResult[]
}
