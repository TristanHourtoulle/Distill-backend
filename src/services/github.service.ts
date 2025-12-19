import { Octokit } from 'octokit'
import { db } from '../lib/db.js'
import {
  type RepoSummary,
  type RepoInfo,
  type Branch,
  type TreeNode,
  type FileContent,
  type SearchResult,
  GitHubAuthError,
  GitHubAccessError,
  GitHubRateLimitError,
  GitHubNotFoundError,
} from '../types/github.types.js'

// File extensions to exclude (binary files)
const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.zip', '.tar', '.gz', '.rar',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.exe', '.dll', '.so', '.dylib',
]

export class GitHubService {
  /**
   * Get an authenticated Octokit client for a user
   */
  private static async getClient(userId: string): Promise<Octokit> {
    // Get access token from the Account table (BetterAuth stores OAuth tokens there)
    const account = await db.account.findFirst({
      where: {
        userId,
        providerId: 'github',
      },
    })

    if (!account?.accessToken) {
      throw new GitHubAuthError('GitHub not connected. Please reconnect your GitHub account.')
    }

    // The token is stored by BetterAuth, we use it directly
    // If we stored an encrypted version in User.githubAccessToken, we'd decrypt it
    return new Octokit({ auth: account.accessToken })
  }

  /**
   * Handle GitHub API errors and convert them to our custom error types
   */
  private static handleError(error: unknown, context: string): never {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // Check for rate limiting
      if (message.includes('rate limit') || message.includes('api rate limit')) {
        // Try to extract retry-after from the error
        const retryAfter = 60 // Default to 60 seconds
        throw new GitHubRateLimitError(retryAfter)
      }

      // Check for authentication errors
      if (message.includes('bad credentials') || message.includes('401')) {
        throw new GitHubAuthError('GitHub token is invalid or expired')
      }

      // Check for access errors
      if (message.includes('not found') || message.includes('404')) {
        throw new GitHubNotFoundError(context)
      }

      if (message.includes('403') || message.includes('forbidden')) {
        throw new GitHubAccessError(`No access to ${context}`)
      }
    }

    throw new Error(`GitHub API error: ${context} - ${error}`)
  }

  /**
   * List all repositories accessible to the user
   */
  static async listUserRepos(userId: string): Promise<RepoSummary[]> {
    const octokit = await this.getClient(userId)

    try {
      const repos: RepoSummary[] = []
      let page = 1
      const perPage = 100

      // Paginate through all repos
      while (true) {
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          per_page: perPage,
          page,
          sort: 'updated',
          direction: 'desc',
        })

        if (data.length === 0) break

        for (const repo of data) {
          repos.push({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            owner: repo.owner.login,
            description: repo.description,
            url: repo.url,
            htmlUrl: repo.html_url,
            defaultBranch: repo.default_branch,
            isPrivate: repo.private,
            language: repo.language,
            updatedAt: repo.updated_at ?? new Date().toISOString(),
          })
        }

        if (data.length < perPage) break
        page++
      }

      return repos
    } catch (error) {
      this.handleError(error, 'listing repositories')
    }
  }

  /**
   * Get detailed information about a repository
   */
  static async getRepoInfo(userId: string, owner: string, repo: string): Promise<RepoInfo> {
    const octokit = await this.getClient(userId)

    try {
      const { data } = await octokit.rest.repos.get({ owner, repo })

      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        owner: data.owner.login,
        description: data.description,
        url: data.url,
        htmlUrl: data.html_url,
        defaultBranch: data.default_branch,
        isPrivate: data.private,
        language: data.language,
        updatedAt: data.updated_at ?? new Date().toISOString(),
        createdAt: data.created_at ?? new Date().toISOString(),
        pushedAt: data.pushed_at ?? new Date().toISOString(),
        size: data.size,
        stargazersCount: data.stargazers_count,
        forksCount: data.forks_count,
        openIssuesCount: data.open_issues_count,
        topics: data.topics ?? [],
      }
    } catch (error) {
      this.handleError(error, `repository ${owner}/${repo}`)
    }
  }

  /**
   * List all branches of a repository
   */
  static async listBranches(userId: string, owner: string, repo: string): Promise<Branch[]> {
    const octokit = await this.getClient(userId)

    try {
      const branches: Branch[] = []
      let page = 1
      const perPage = 100

      while (true) {
        const { data } = await octokit.rest.repos.listBranches({
          owner,
          repo,
          per_page: perPage,
          page,
        })

        if (data.length === 0) break

        for (const branch of data) {
          branches.push({
            name: branch.name,
            commit: branch.commit.sha,
            protected: branch.protected,
          })
        }

        if (data.length < perPage) break
        page++
      }

      return branches
    } catch (error) {
      this.handleError(error, `branches of ${owner}/${repo}`)
    }
  }

  /**
   * Get the file tree of a repository at a specific branch
   */
  static async getTree(
    userId: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<TreeNode[]> {
    const octokit = await this.getClient(userId)

    try {
      console.log(`[GitHubService.getTree] Fetching tree for ${owner}/${repo}@${branch}`)

      // Get the branch reference to get the tree SHA
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      })

      const commitSha = refData.object.sha
      console.log(`[GitHubService.getTree] Commit SHA: ${commitSha}`)

      // Get the commit to get the tree SHA
      const { data: commitData } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: commitSha,
      })

      console.log(`[GitHubService.getTree] Tree SHA: ${commitData.tree.sha}`)

      // Get the full tree recursively
      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: commitData.tree.sha,
        recursive: 'true',
      })

      console.log(`[GitHubService.getTree] Raw tree items: ${treeData.tree.length}`)
      if (treeData.tree.length > 0) {
        console.log(`[GitHubService.getTree] First 5 items:`, treeData.tree.slice(0, 5).map(i => ({ path: i.path, type: i.type })))
      }

      const nodes: TreeNode[] = []

      for (const item of treeData.tree) {
        if (!item.path || !item.sha) continue

        // Skip binary files
        const isBinary = BINARY_EXTENSIONS.some(ext =>
          item.path!.toLowerCase().endsWith(ext)
        )
        if (isBinary) continue

        const node: TreeNode = {
          path: item.path,
          type: item.type === 'tree' ? 'directory' : 'file',
          sha: item.sha,
        }
        if (item.size !== undefined) {
          node.size = item.size
        }
        nodes.push(node)
      }

      console.log(`[GitHubService.getTree] Processed nodes: ${nodes.length}`)
      if (nodes.length > 0) {
        console.log(`[GitHubService.getTree] First 5 processed:`, nodes.slice(0, 5).map(n => ({ path: n.path, type: n.type })))
      }

      return nodes
    } catch (error) {
      console.error(`[GitHubService.getTree] Error:`, error)
      this.handleError(error, `tree of ${owner}/${repo}@${branch}`)
    }
  }

  /**
   * Get the content of a file
   */
  static async getFileContent(
    userId: string,
    owner: string,
    repo: string,
    path: string,
    branch: string
  ): Promise<FileContent> {
    const octokit = await this.getClient(userId)

    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      })

      // Check if it's a file (not a directory)
      if (Array.isArray(data)) {
        throw new Error(`Path ${path} is a directory, not a file`)
      }

      if (data.type !== 'file') {
        throw new Error(`Path ${path} is not a file`)
      }

      // Handle large files (content might be null, need to use blob API)
      if (!data.content && data.sha) {
        const { data: blobData } = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: data.sha,
        })

        return {
          path,
          content: Buffer.from(blobData.content, 'base64').toString('utf-8'),
          encoding: 'utf-8',
          sha: data.sha,
          size: blobData.size ?? 0,
        }
      }

      return {
        path,
        content: Buffer.from(data.content ?? '', 'base64').toString('utf-8'),
        encoding: 'utf-8',
        sha: data.sha,
        size: data.size ?? 0,
      }
    } catch (error) {
      this.handleError(error, `file ${path} in ${owner}/${repo}@${branch}`)
    }
  }

  /**
   * Search for code in a repository
   */
  static async searchCode(
    userId: string,
    owner: string,
    repo: string,
    query: string
  ): Promise<SearchResult[]> {
    const octokit = await this.getClient(userId)

    try {
      // GitHub code search requires repo qualifier
      const searchQuery = `${query} repo:${owner}/${repo}`

      const { data } = await octokit.rest.search.code({
        q: searchQuery,
        per_page: 100,
      })

      const results: SearchResult[] = []

      for (const item of data.items) {
        const result: SearchResult = {
          path: item.path,
          repository: item.repository.full_name,
          sha: item.sha,
          url: item.html_url,
          score: item.score,
        }

        if (item.text_matches) {
          result.textMatches = item.text_matches.map(match => ({
            fragment: match.fragment ?? '',
            matches: match.matches?.map(m => ({
              text: m.text ?? '',
              indices: m.indices as [number, number],
            })) ?? [],
          }))
        }

        results.push(result)
      }

      return results
    } catch (error) {
      this.handleError(error, `code search in ${owner}/${repo}`)
    }
  }

  /**
   * Check if the user has access to a repository
   * Throws specific errors to help diagnose issues
   */
  static async checkRepoAccess(userId: string, repoUrl: string): Promise<void> {
    const parsed = this.parseRepoUrl(repoUrl)
    if (!parsed) {
      throw new Error('Invalid GitHub repository URL format')
    }

    // This will throw GitHubAuthError if no token, or GitHubAccessError if no access
    await this.getRepoInfo(userId, parsed.owner, parsed.repo)
  }

  /**
   * Parse a GitHub repo URL to extract owner and repo name
   */
  static parseRepoUrl(url: string): { owner: string; repo: string } | null {
    // Support both HTTPS and SSH URLs
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
    if (!match || !match[1] || !match[2]) {
      return null
    }

    return {
      owner: match[1],
      repo: match[2].replace('.git', ''),
    }
  }
}
