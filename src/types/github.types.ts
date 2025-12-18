// GitHub API Types for Distill

export interface RepoSummary {
  id: number
  name: string
  fullName: string
  owner: string
  description: string | null
  url: string
  htmlUrl: string
  defaultBranch: string
  isPrivate: boolean
  language: string | null
  updatedAt: string
}

export interface RepoInfo extends RepoSummary {
  createdAt: string
  pushedAt: string
  size: number
  stargazersCount: number
  forksCount: number
  openIssuesCount: number
  topics: string[]
}

export interface Branch {
  name: string
  commit: string // SHA of the last commit
  protected: boolean
}

export interface TreeNode {
  path: string
  type: 'file' | 'directory'
  sha: string
  size?: number // Only for files
}

export interface FileContent {
  path: string
  content: string
  encoding: string
  sha: string
  size: number
}

export interface SearchResult {
  path: string
  repository: string
  sha: string
  url: string
  score: number
  textMatches?: Array<{
    fragment: string
    matches: Array<{
      text: string
      indices: [number, number]
    }>
  }>
}

// Error types
export class GitHubAuthError extends Error {
  constructor(message = 'GitHub authentication failed') {
    super(message)
    this.name = 'GitHubAuthError'
  }
}

export class GitHubAccessError extends Error {
  constructor(message = 'No access to this repository') {
    super(message)
    this.name = 'GitHubAccessError'
  }
}

export class GitHubRateLimitError extends Error {
  public retryAfter: number

  constructor(retryAfter: number) {
    super(`GitHub rate limit exceeded. Retry after ${retryAfter} seconds`)
    this.name = 'GitHubRateLimitError'
    this.retryAfter = retryAfter
  }
}

export class GitHubNotFoundError extends Error {
  constructor(resource: string) {
    super(`GitHub resource not found: ${resource}`)
    this.name = 'GitHubNotFoundError'
  }
}
