import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { GitHubService } from '../services/github.service.js'

const app = new Hono()

// All routes require authentication
app.use('*', authMiddleware)

/**
 * Schema for repo owner/name parameters
 */
const repoParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
})

/**
 * Schema for file path query
 */
const fileQuerySchema = z.object({
  path: z.string().min(1),
  branch: z.string().min(1),
})

/**
 * Schema for search query
 */
const searchQuerySchema = z.object({
  q: z.string().min(1),
})

// ============================================
// User Repositories
// ============================================

/**
 * GET /github/repos
 * List all repositories accessible to the authenticated user
 */
app.get('/repos', async (c) => {
  const userId = c.get('userId')
  const repos = await GitHubService.listUserRepos(userId)
  return c.json({ data: repos })
})

// ============================================
// Repository Information
// ============================================

/**
 * GET /github/repos/:owner/:repo
 * Get detailed information about a repository
 */
app.get('/repos/:owner/:repo', zValidator('param', repoParamsSchema), async (c) => {
  const userId = c.get('userId')
  const { owner, repo } = c.req.valid('param')
  const repoInfo = await GitHubService.getRepoInfo(userId, owner, repo)
  return c.json({ data: repoInfo })
})

/**
 * GET /github/repos/:owner/:repo/branches
 * List all branches of a repository
 */
app.get('/repos/:owner/:repo/branches', zValidator('param', repoParamsSchema), async (c) => {
  const userId = c.get('userId')
  const { owner, repo } = c.req.valid('param')
  const branches = await GitHubService.listBranches(userId, owner, repo)
  return c.json({ data: branches })
})

/**
 * GET /github/repos/:owner/:repo/tree
 * Get the file tree of a repository at a specific branch
 */
app.get('/repos/:owner/:repo/tree', zValidator('param', repoParamsSchema), async (c) => {
  const userId = c.get('userId')
  const { owner, repo } = c.req.valid('param')

  // Get branch from query param, default to main or master
  const branch = c.req.query('branch') ?? 'main'

  const tree = await GitHubService.getTree(userId, owner, repo, branch)
  return c.json({ data: tree })
})

/**
 * GET /github/repos/:owner/:repo/file
 * Get the content of a specific file
 */
app.get('/repos/:owner/:repo/file', zValidator('param', repoParamsSchema), zValidator('query', fileQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { owner, repo } = c.req.valid('param')
  const { path, branch } = c.req.valid('query')

  const file = await GitHubService.getFileContent(userId, owner, repo, path, branch)
  return c.json({ data: file })
})

/**
 * GET /github/repos/:owner/:repo/search
 * Search for code in a repository
 */
app.get('/repos/:owner/:repo/search', zValidator('param', repoParamsSchema), zValidator('query', searchQuerySchema), async (c) => {
  const userId = c.get('userId')
  const { owner, repo } = c.req.valid('param')
  const { q } = c.req.valid('query')

  const results = await GitHubService.searchCode(userId, owner, repo, q)
  return c.json({ data: results })
})

// ============================================
// Access Verification
// ============================================

/**
 * GET /github/verify
 * Verify if a repository URL is accessible
 */
app.get('/verify', async (c) => {
  const userId = c.get('userId')
  const url = c.req.query('url')

  if (!url) {
    return c.json({ error: 'URL parameter is required' }, 400)
  }

  const hasAccess = await GitHubService.checkRepoAccess(userId, url)
  const parsed = GitHubService.parseRepoUrl(url)

  return c.json({
    data: {
      hasAccess,
      parsed,
    },
  })
})

export default app
