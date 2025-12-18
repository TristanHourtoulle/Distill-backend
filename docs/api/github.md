# GitHub

This documentation outlines the **GitHub proxy endpoints** that provide access to GitHub API features.
Each endpoint requires authentication and uses the user's GitHub OAuth token.

---

## GET

### List user repositories

* `GET /api/github/repos` : Returns all repositories accessible to the authenticated user.

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": 123456789,
      "name": "my-repo",
      "fullName": "owner/my-repo",
      "owner": "owner",
      "description": "Repository description",
      "url": "https://api.github.com/repos/owner/my-repo",
      "htmlUrl": "https://github.com/owner/my-repo",
      "defaultBranch": "main",
      "isPrivate": false,
      "language": "TypeScript",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Repositories returned successfully |
| `401` | Authentication required |
| `502` | GitHub API error or token expired |

---

### Get repository info

* `GET /api/github/repos/<owner>/<repo>` : Returns detailed information about a repository.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": 123456789,
    "name": "my-repo",
    "fullName": "owner/my-repo",
    "owner": "owner",
    "description": "Repository description",
    "url": "https://api.github.com/repos/owner/my-repo",
    "htmlUrl": "https://github.com/owner/my-repo",
    "defaultBranch": "main",
    "isPrivate": false,
    "language": "TypeScript",
    "updatedAt": "2025-01-15T10:00:00.000Z",
    "createdAt": "2024-06-01T08:00:00.000Z",
    "pushedAt": "2025-01-15T09:30:00.000Z",
    "size": 1024,
    "stargazersCount": 42,
    "forksCount": 5,
    "openIssuesCount": 3,
    "topics": ["nextjs", "typescript", "react"]
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Repository info returned successfully |
| `401` | Authentication required |
| `404` | Repository not found |
| `502` | GitHub API error |

---

### List repository branches

* `GET /api/github/repos/<owner>/<repo>/branches` : Returns all branches of a repository.

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "name": "main",
      "commit": "abc123def456",
      "protected": true
    },
    {
      "name": "develop",
      "commit": "def456abc123",
      "protected": false
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Branches returned successfully |
| `401` | Authentication required |
| `404` | Repository not found |
| `502` | GitHub API error |

---

### Get repository tree

* `GET /api/github/repos/<owner>/<repo>/tree` : Returns the file tree of a repository.

*Query Parameters*

| Name | Type | Default | Description |
|------|------|---------|-------------|
| branch | string | main | Branch to get tree from |

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "path": "src",
      "type": "directory",
      "sha": "abc123"
    },
    {
      "path": "src/index.ts",
      "type": "file",
      "sha": "def456",
      "size": 1024
    },
    {
      "path": "src/components/Button.tsx",
      "type": "file",
      "sha": "ghi789",
      "size": 512
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Tree returned successfully |
| `401` | Authentication required |
| `404` | Repository or branch not found |
| `502` | GitHub API error |

---

### Get file content

* `GET /api/github/repos/<owner>/<repo>/file` : Returns the content of a specific file.

*Query Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| path | string | Yes | File path in the repository |
| branch | string | Yes | Branch name |

*Expected Success Response (200)*

```json
{
  "data": {
    "path": "src/index.ts",
    "content": "import { Hono } from 'hono'\n...",
    "encoding": "utf-8",
    "sha": "abc123def456",
    "size": 1024
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | File content returned successfully |
| `400` | Missing path or branch parameter |
| `401` | Authentication required |
| `404` | File or repository not found |
| `502` | GitHub API error |

---

### Search code

* `GET /api/github/repos/<owner>/<repo>/search` : Searches for code in the repository.

*Query Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| q | string | Yes | Search query |

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "path": "src/components/Button.tsx",
      "repository": "owner/repo",
      "sha": "abc123",
      "url": "https://github.com/owner/repo/blob/main/src/components/Button.tsx",
      "score": 15.5,
      "textMatches": [
        {
          "fragment": "export function Button({ variant })",
          "matches": [
            { "text": "Button", "indices": [16, 22] }
          ]
        }
      ]
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Search results returned successfully |
| `400` | Missing search query |
| `401` | Authentication required |
| `502` | GitHub API error |

---

### Verify repository access

* `GET /api/github/verify` : Verifies if a repository URL is accessible.

*Query Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | GitHub repository URL |

*Expected Success Response (200)*

```json
{
  "data": {
    "hasAccess": true,
    "parsed": {
      "owner": "owner",
      "repo": "repo-name"
    }
  }
}
```

*Response (No Access)*

```json
{
  "data": {
    "hasAccess": false,
    "parsed": {
      "owner": "owner",
      "repo": "private-repo"
    }
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Verification result returned |
| `400` | Missing URL parameter |
| `401` | Authentication required |
