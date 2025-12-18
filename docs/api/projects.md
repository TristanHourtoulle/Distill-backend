# Projects

This documentation outlines the **projects endpoints** that handle project management, indexation, and rules.
Each endpoint requires authentication.

---

## GET

### List all projects

* `GET /api/projects` : Returns all projects for the authenticated user.

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user-uuid",
      "githubRepoUrl": "https://github.com/owner/repo",
      "githubOwner": "owner",
      "githubRepoName": "repo",
      "defaultBranch": "main",
      "preferredBranch": "develop",
      "name": "My Project",
      "description": "Project description",
      "detectedStack": { "framework": "nextjs", "language": "typescript" },
      "status": "ready",
      "lastIndexedAt": "2025-01-15T10:30:00.000Z",
      "createdAt": "2025-01-10T08:00:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Projects returned successfully |
| `401` | Authentication required |

---

### Get a specific project

* `GET /api/projects/<projectId>` : Returns a specific project and its details.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-uuid",
    "githubRepoUrl": "https://github.com/owner/repo",
    "githubOwner": "owner",
    "githubRepoName": "repo",
    "defaultBranch": "main",
    "preferredBranch": "develop",
    "name": "My Project",
    "description": "Project description",
    "detectedStack": { "framework": "nextjs", "language": "typescript" },
    "structureSummary": { "totalFiles": 150, "srcFiles": 80 },
    "status": "ready",
    "lastIndexedAt": "2025-01-15T10:30:00.000Z",
    "createdAt": "2025-01-10T08:00:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Project returned successfully |
| `401` | Authentication required |
| `403` | Access denied (not owner) |
| `404` | Project not found |

---

### Get project branches

* `GET /api/projects/<projectId>/branches` : Lists available branches for the project.

*Expected Success Response (200)*

```json
{
  "data": [
    { "name": "main", "commit": "abc123", "protected": true },
    { "name": "develop", "commit": "def456", "protected": false },
    { "name": "feature/new-feature", "commit": "ghi789", "protected": false }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Branches returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |
| `502` | GitHub API error |

---

### Get indexation job status

* `GET /api/projects/<projectId>/job` : Returns the current indexation job status.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "job-uuid",
    "type": "indexation",
    "status": "running",
    "progress": {
      "phase": "indexing",
      "current": 50,
      "total": 100,
      "message": "Processing files..."
    },
    "createdAt": "2025-01-15T10:00:00.000Z",
    "startedAt": "2025-01-15T10:01:00.000Z"
  }
}
```

*Response (No Job)*

```json
{
  "data": null,
  "message": "No indexation job found"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Job status returned (or null if no job) |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

### Get indexation status

* `GET /api/projects/<projectId>/status` : Returns detailed indexation status.

*Expected Success Response (200)*

```json
{
  "data": {
    "status": "ready",
    "indexedFilesCount": 150,
    "lastIndexedAt": "2025-01-15T10:30:00.000Z",
    "detectedStack": {
      "framework": "nextjs",
      "language": "typescript",
      "styling": "tailwind"
    }
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Status returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

### Get indexed files

* `GET /api/projects/<projectId>/files` : Returns indexed files with pagination.

*Query Parameters*

| Name | Type | Default | Description |
|------|------|---------|-------------|
| fileType | string | - | Filter by type (component, hook, api, util, config, other) |
| limit | number | 100 | Max results per page |
| offset | number | 0 | Pagination offset |

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "file-uuid",
      "filePath": "src/components/Button.tsx",
      "fileType": "component",
      "exports": ["Button", "ButtonProps"],
      "imports": ["react", "@/lib/utils"],
      "summary": "Reusable button component with variants",
      "lineCount": 45
    }
  ],
  "meta": {
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Files returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

### Get project rules

* `GET /api/projects/<projectId>/rules` : Returns all rules for a project.

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "rule-uuid",
      "projectId": "project-uuid",
      "type": "must_do",
      "content": "Always use TypeScript strict mode",
      "priority": 1,
      "isActive": true,
      "createdAt": "2025-01-10T08:00:00.000Z"
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Rules returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

## POST

### Create a project

* `POST /api/projects` : Creates a new project from a GitHub repository.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| githubRepoUrl | string | Yes | GitHub repository URL |
| name | string | Yes | Project name (2-100 chars) |
| description | string | No | Project description (max 500 chars) |
| preferredBranch | string | Yes | Branch to analyze |

*Example Request*

```json
{
  "githubRepoUrl": "https://github.com/owner/repo",
  "name": "My Project",
  "description": "Project description",
  "preferredBranch": "main"
}
```

*Expected Success Response (201)*

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-uuid",
    "githubRepoUrl": "https://github.com/owner/repo",
    "githubOwner": "owner",
    "githubRepoName": "repo",
    "defaultBranch": "main",
    "preferredBranch": "main",
    "name": "My Project",
    "description": "Project description",
    "status": "pending",
    "createdAt": "2025-01-18T12:00:00.000Z",
    "updatedAt": "2025-01-18T12:00:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `201` | Project created successfully |
| `400` | Invalid input (validation error) |
| `401` | Authentication required |
| `403` | No access to repository |
| `502` | GitHub API error |

---

### Trigger indexation

* `POST /api/projects/<projectId>/index` : Triggers re-indexation of the project.

*Query Parameters*

| Name | Type | Default | Description |
|------|------|---------|-------------|
| priority | string | normal | Job priority (low, normal, high) |

*Expected Success Response (200)*

```json
{
  "data": {
    "jobId": "job-uuid",
    "status": "pending"
  },
  "message": "Indexation job queued"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Job queued successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

### Create a rule

* `POST /api/projects/<projectId>/rules` : Creates a new rule for the project.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| type | string | Yes | Rule type: must_do, must_not_do, convention, pattern |
| content | string | Yes | Rule content (1-1000 chars) |
| priority | number | No | Priority (default: 0) |

*Example Request*

```json
{
  "type": "must_do",
  "content": "Always use TypeScript strict mode",
  "priority": 1
}
```

*Expected Success Response (201)*

```json
{
  "data": {
    "id": "rule-uuid",
    "projectId": "project-uuid",
    "type": "must_do",
    "content": "Always use TypeScript strict mode",
    "priority": 1,
    "isActive": true,
    "createdAt": "2025-01-18T12:00:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `201` | Rule created successfully |
| `400` | Invalid input |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

## PATCH

### Update a project

* `PATCH /api/projects/<projectId>` : Updates project information.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | No | Project name (2-100 chars) |
| description | string | No | Project description (max 500 chars) |
| preferredBranch | string | No | Preferred branch for analysis |

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "project-uuid",
    "name": "Updated Project Name",
    "description": "Updated description",
    "preferredBranch": "develop",
    "updatedAt": "2025-01-18T12:00:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Project updated successfully |
| `400` | Invalid input |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

### Update a rule

* `PATCH /api/projects/<projectId>/rules/<ruleId>` : Updates a project rule.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| content | string | No | Rule content |
| priority | number | No | Priority |
| isActive | boolean | No | Enable/disable rule |

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "rule-uuid",
    "content": "Updated rule content",
    "priority": 2,
    "isActive": true
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Rule updated successfully |
| `400` | Invalid input |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Rule or project not found |

---

## DELETE

### Delete a project

* `DELETE /api/projects/<projectId>` : Deletes a project and all related data.

*Expected Success Response (204)*

No content returned.

*Response Codes*

| Code | Description |
|------|-------------|
| `204` | Project deleted successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

### Delete a rule

* `DELETE /api/projects/<projectId>/rules/<ruleId>` : Deletes a project rule.

*Expected Success Response (204)*

No content returned.

*Response Codes*

| Code | Description |
|------|-------------|
| `204` | Rule deleted successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Rule or project not found |
