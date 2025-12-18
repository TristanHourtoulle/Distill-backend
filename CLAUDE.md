# CLAUDE.md — Règles du projet Distill Backend

## À propos

Backend API de Distill — service REST qui gère l'authentification, la connexion aux repos GitHub, l'extraction de tâches via LLM, et l'agent d'analyse de code.

## Stack technique

- **Runtime** : Node.js 20+
- **Framework** : Hono
- **Langage** : TypeScript 5 (strict mode)
- **ORM** : Prisma
- **Base de données** : PostgreSQL
- **Auth** : BetterAuth (GitHub OAuth)
- **Validation** : Zod
- **LLM** : Claude API (Anthropic)
- **GitHub** : Octokit

## Règles obligatoires

### Structure des routes (Hono)

```typescript
// routes/projects.routes.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '@/middlewares/auth.middleware'
import { createProjectSchema } from '@/schemas/project.schema'
import { ProjectService } from '@/services/project.service'

const app = new Hono()

// Toutes les routes nécessitent auth
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const userId = c.get('userId')
  const projects = await ProjectService.listByUser(userId)
  return c.json({ data: projects })
})

app.post('/', zValidator('json', createProjectSchema), async (c) => {
  const userId = c.get('userId')
  const input = c.req.valid('json')
  const project = await ProjectService.create(userId, input)
  return c.json({ data: project }, 201)
})

export default app
```

### Services

Les services contiennent toute la logique métier. Les routes sont des "thin controllers".

```typescript
// services/project.service.ts
import { db } from '@/lib/db'
import { GitHubService } from './github.service'
import { NotFoundError, ForbiddenError } from '@/lib/errors'

export class ProjectService {
  static async listByUser(userId: string) {
    return db.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  static async create(userId: string, input: CreateProjectInput) {
    // Vérifier accès au repo
    const hasAccess = await GitHubService.checkRepoAccess(userId, input.githubRepoUrl)
    if (!hasAccess) {
      throw new ForbiddenError('No access to this repository')
    }

    return db.project.create({
      data: {
        ...input,
        userId,
        status: 'pending',
      },
    })
  }

  static async getById(projectId: string, userId: string) {
    const project = await db.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      throw new NotFoundError('Project not found')
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied')
    }

    return project
  }
}
```

### Gestion des erreurs

Utiliser les classes d'erreurs custom, jamais throw une string.

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class GitHubError extends AppError {
  constructor(message: string) {
    super(message, 502, 'GITHUB_ERROR')
  }
}
```

### Middleware d'erreurs

```typescript
// middlewares/error.middleware.ts
import { Context, Next } from 'hono'
import { AppError } from '@/lib/errors'

export async function errorMiddleware(c: Context, next: Next) {
  try {
    await next()
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(
        { error: error.message, code: error.code },
        error.statusCode
      )
    }

    console.error('Unexpected error:', error)
    return c.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      500
    )
  }
}
```

### Validation avec Zod

Toujours valider les inputs avec Zod.

```typescript
// schemas/project.schema.ts
import { z } from 'zod'

export const createProjectSchema = z.object({
  githubRepoUrl: z.string().url().regex(/github\.com/),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  preferredBranch: z.string().min(1),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
```

### Prisma

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
```

### GitHub API (Octokit)

```typescript
// services/github.service.ts
import { Octokit } from 'octokit'
import { decrypt } from '@/lib/encryption'
import { db } from '@/lib/db'
import { GitHubError } from '@/lib/errors'

export class GitHubService {
  private static async getClient(userId: string): Promise<Octokit> {
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user?.githubAccessToken) {
      throw new GitHubError('GitHub not connected')
    }

    const token = decrypt(user.githubAccessToken)
    return new Octokit({ auth: token })
  }

  static async listBranches(userId: string, owner: string, repo: string) {
    const octokit = await this.getClient(userId)
    
    try {
      const { data } = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      })
      return data
    } catch (error) {
      throw new GitHubError(`Failed to list branches: ${error.message}`)
    }
  }

  static async getFileContent(
    userId: string,
    owner: string,
    repo: string,
    path: string,
    branch: string
  ) {
    const octokit = await this.getClient(userId)
    
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    })

    if ('content' in data) {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }

    throw new GitHubError('Not a file')
  }
}
```

### Agent LLM

```typescript
// agent/orchestrator.ts
import Anthropic from '@anthropic-ai/sdk'
import { tools } from './tools'
import { buildSystemPrompt } from './prompts'

interface AgentContext {
  projectId: string
  owner: string
  repo: string
  branch: string
  userId: string
}

export async function runAgent(
  task: Task,
  project: Project,
  context: AgentContext
) {
  const client = new Anthropic()
  const systemPrompt = buildSystemPrompt(project, task, context.branch)
  
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Analyse cette tâche: ${task.title}\n\n${task.description}` }
  ]

  let iterations = 0
  const maxIterations = 20

  while (iterations < maxIterations) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      return parseAnalysisResult(response.content)
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults = await executeTools(response.content, context)
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
    }

    iterations++
  }

  throw new Error('Max iterations reached')
}
```

### Chiffrement des tokens

```typescript
// lib/encryption.ts
import crypto from 'crypto'

const algorithm = 'aes-256-gcm'
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
  
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
```

## Conventions

### Language

All code must be written in **English**:
- Comments in English
- Function and variable names in English
- Documentation in English
- Error messages in English
- Commit messages in English

### Nommage

- **Fichiers** : kebab-case (`project.service.ts`, `auth.middleware.ts`)
- **Classes** : PascalCase (`ProjectService`, `GitHubError`)
- **Fonctions** : camelCase (`listByUser`, `getFileContent`)
- **Variables** : camelCase
- **Constantes** : SCREAMING_SNAKE_CASE (`MAX_ITERATIONS`)

### Réponses API

```typescript
// Succès
{ data: T }
{ data: T, meta: { page, total } }

// Erreur
{ error: string, code?: string }
```

### Status HTTP

- `200` : OK
- `201` : Created
- `204` : No Content (delete)
- `400` : Bad Request (validation)
- `401` : Unauthorized
- `403` : Forbidden
- `404` : Not Found
- `500` : Internal Server Error
- `502` : Bad Gateway (GitHub API error)

## Structure des dossiers

```
src/
├── index.ts          # Entry point
├── routes/           # Route handlers
├── services/         # Business logic
├── lib/              # Shared utilities
├── middlewares/      # Hono middlewares
├── schemas/          # Zod schemas
├── types/            # TypeScript types
└── agent/            # LLM agent logic
    ├── tools/
    ├── orchestrator.ts
    └── prompts.ts
```

## Commandes utiles

```bash
pnpm dev                    # Dev server
pnpm prisma studio          # Admin BDD
pnpm prisma migrate dev     # Migrations
pnpm lint                   # Linter
```
