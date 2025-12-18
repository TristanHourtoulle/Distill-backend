# Export

This documentation outlines the **export endpoints** that handle task export to external platforms.
Each endpoint requires authentication.

---

## GET

### Get export details

* `GET /api/export/<exportId>` : Returns details of a specific export.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "taskId": "task-uuid",
    "integrationId": "integration-uuid",
    "status": "success",
    "externalId": "42",
    "externalUrl": "https://github.com/owner/repo/issues/42",
    "exportedAt": "2025-01-15T10:00:00.000Z",
    "error": null
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Export returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Export not found |

---

### Get export history for a task

* `GET /api/export/task/<taskId>` : Returns all exports for a specific task.

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "export-uuid-1",
      "status": "success",
      "externalId": "42",
      "externalUrl": "https://github.com/owner/repo/issues/42",
      "exportedAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": "export-uuid-2",
      "status": "failed",
      "error": "Repository not accessible",
      "exportedAt": "2025-01-14T09:00:00.000Z"
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Exports returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |

---

### Get project export statistics

* `GET /api/export/project/<projectId>/stats` : Returns export statistics for a project.

*Expected Success Response (200)*

```json
{
  "data": {
    "total": 25,
    "successful": 23,
    "failed": 2,
    "byPlatform": {
      "github_issues": 25
    }
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Statistics returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

## POST

### Export task to GitHub Issues

* `POST /api/export/github/<taskId>` : Exports a task as a GitHub Issue.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| labels | string[] | No | Labels to apply to the issue |
| assignees | string[] | No | GitHub usernames to assign |
| milestone | number | No | Milestone number to associate |

*Example Request*

```json
{
  "labels": ["feature", "priority-high"],
  "assignees": ["john-doe"],
  "milestone": 3
}
```

*Expected Success Response (200)*

```json
{
  "data": {
    "exportId": "550e8400-e29b-41d4-a716-446655440000",
    "issueNumber": 42,
    "issueUrl": "https://github.com/owner/repo/issues/42",
    "status": "success"
  },
  "message": "Task exported to GitHub Issues successfully"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Export successful |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |
| `502` | GitHub API error |

---

### Bulk export to GitHub Issues

* `POST /api/export/github/bulk` : Exports multiple tasks to GitHub Issues.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| taskIds | string[] | Yes | Array of task UUIDs (1-50) |
| options | object | No | Export options for all tasks |
| options.labels | string[] | No | Labels to apply |
| options.assignees | string[] | No | Assignees for all issues |
| options.milestone | number | No | Milestone number |

*Example Request*

```json
{
  "taskIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "options": {
    "labels": ["sprint-3"]
  }
}
```

*Expected Success Response (200)*

```json
{
  "data": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "results": [
      {
        "taskId": "550e8400-e29b-41d4-a716-446655440000",
        "success": true,
        "issueUrl": "https://github.com/owner/repo/issues/42"
      },
      {
        "taskId": "660e8400-e29b-41d4-a716-446655440001",
        "success": true,
        "issueUrl": "https://github.com/owner/repo/issues/43"
      }
    ]
  },
  "message": "Exported 2/2 tasks successfully"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Bulk export completed (check results for individual status) |
| `400` | Invalid input (taskIds validation) |
| `401` | Authentication required |

---

### Setup GitHub integration

* `POST /api/export/setup/github` : Configures GitHub Issues integration for the user.

*Expected Success Response (200)*

```json
{
  "data": {
    "integrationId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "message": "GitHub Issues integration configured successfully"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Integration configured successfully |
| `401` | Authentication required |
| `502` | GitHub connection error |
