# Tasks

This documentation outlines the **tasks endpoints** that handle task management, complexity estimation, and bulk operations.
Each endpoint requires authentication.

---

## GET

### List all tasks

* `GET /api/tasks` : Returns all tasks for the authenticated user.

*Query Parameters*

| Name | Type | Default | Description |
|------|------|---------|-------------|
| projectId | string | - | Filter by project UUID |
| meetingId | string | - | Filter by meeting UUID |
| status | string | - | Filter: pending, analyzing, analyzed, exported, archived |
| complexity | string | - | Filter: simple, moderate, critical |
| type | string | - | Filter: feature, bugfix, modification, documentation, refactor |
| limit | number | 50 | Max results per page (1-100) |
| offset | number | 0 | Pagination offset |

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "meetingId": "meeting-uuid",
      "projectId": "project-uuid",
      "title": "Implement user authentication",
      "description": "Add OAuth login with GitHub provider",
      "type": "feature",
      "complexity": "moderate",
      "status": "analyzed",
      "impactedFilesPreview": ["src/auth/", "src/middleware/"],
      "estimatedFilesCount": 8,
      "priority": 1,
      "createdAt": "2025-01-15T15:00:00.000Z",
      "updatedAt": "2025-01-15T16:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Tasks returned successfully |
| `401` | Authentication required |

---

### Get a specific task

* `GET /api/tasks/<taskId>` : Returns a specific task with its analyses and exports.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "meetingId": "meeting-uuid",
    "projectId": "project-uuid",
    "title": "Implement user authentication",
    "description": "Add OAuth login with GitHub provider",
    "type": "feature",
    "complexity": "moderate",
    "status": "analyzed",
    "impactedFilesPreview": ["src/auth/", "src/middleware/"],
    "estimatedFilesCount": 8,
    "priority": 1,
    "createdAt": "2025-01-15T15:00:00.000Z",
    "updatedAt": "2025-01-15T16:00:00.000Z",
    "analyses": [
      {
        "id": "analysis-uuid",
        "status": "completed",
        "startedAt": "2025-01-15T15:30:00.000Z",
        "completedAt": "2025-01-15T15:32:00.000Z"
      }
    ],
    "exports": [
      {
        "id": "export-uuid",
        "status": "success",
        "externalUrl": "https://github.com/owner/repo/issues/42"
      }
    ]
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Task returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |

---

### Get project task statistics

* `GET /api/tasks/stats/<projectId>` : Returns task statistics for a project.

*Expected Success Response (200)*

```json
{
  "data": {
    "total": 42,
    "byStatus": {
      "pending": 15,
      "analyzing": 2,
      "analyzed": 20,
      "exported": 5,
      "archived": 0
    },
    "byType": {
      "feature": 25,
      "bugfix": 10,
      "modification": 5,
      "documentation": 1,
      "refactor": 1
    },
    "byComplexity": {
      "simple": 15,
      "moderate": 20,
      "critical": 7
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

### Get complexity distribution

* `GET /api/tasks/complexity/<projectId>` : Returns complexity distribution for a project.

*Expected Success Response (200)*

```json
{
  "data": {
    "distribution": {
      "simple": 15,
      "moderate": 20,
      "critical": 7
    },
    "averageScore": 2.3,
    "totalTasks": 42
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Complexity stats returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Project not found |

---

## POST

### Bulk update task status

* `POST /api/tasks/bulk/status` : Updates status of multiple tasks at once.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| taskIds | string[] | Yes | Array of task UUIDs (1-50) |
| status | string | Yes | New status: pending, analyzing, analyzed, exported, archived |

*Example Request*

```json
{
  "taskIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "status": "archived"
}
```

*Expected Success Response (200)*

```json
{
  "data": {
    "updated": 2
  },
  "message": "Updated 2 tasks"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Tasks updated successfully |
| `400` | Invalid input |
| `401` | Authentication required |
| `403` | Access denied to one or more tasks |

---

### Estimate task complexity

* `POST /api/tasks/<taskId>/estimate` : Uses factor-based scoring to estimate task complexity.

*Expected Success Response (200)*

```json
{
  "data": {
    "complexity": "moderate",
    "score": 2.5,
    "factors": {
      "scopeFactor": 0.8,
      "typeFactor": 1.0,
      "descriptionLength": 0.6,
      "keywordBonus": 0.1
    },
    "reasoning": "Task involves multiple files and moderate scope"
  },
  "message": "Task estimated as moderate"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Estimation completed successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |

---

## PATCH

### Update a task

* `PATCH /api/tasks/<taskId>` : Updates task information.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| title | string | No | Task title (1-200 chars) |
| description | string | No | Task description (1-5000 chars) |
| type | string | No | Type: feature, bugfix, modification, documentation, refactor |
| complexity | string | No | Complexity: simple, moderate, critical |
| status | string | No | Status: pending, analyzing, analyzed, exported, archived |
| priority | number | No | Priority (0+) |
| estimatedFilesCount | number | No | Estimated files count |
| impactedFilesPreview | string[] | No | Preview of impacted files |

*Example Request*

```json
{
  "title": "Updated task title",
  "complexity": "critical",
  "priority": 1
}
```

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "task-uuid",
    "title": "Updated task title",
    "complexity": "critical",
    "priority": 1,
    "updatedAt": "2025-01-18T12:00:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Task updated successfully |
| `400` | Invalid input |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |

---

## DELETE

### Delete a task

* `DELETE /api/tasks/<taskId>` : Deletes a task and its analyses.

*Expected Success Response (204)*

No content returned.

*Response Codes*

| Code | Description |
|------|-------------|
| `204` | Task deleted successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |
