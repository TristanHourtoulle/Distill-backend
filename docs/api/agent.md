# Agent

This documentation outlines the **agent endpoints** that handle LLM-powered task analysis.
Each endpoint requires authentication.

---

## GET

### Get analysis details

* `GET /api/agent/analysis/<id>` : Returns detailed analysis results.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "taskId": "task-uuid",
    "status": "completed",
    "summary": "This task requires implementing OAuth authentication with GitHub",
    "filesToCreate": [
      {
        "path": "src/auth/github.ts",
        "purpose": "GitHub OAuth handler",
        "estimatedLines": 80
      }
    ],
    "filesToModify": [
      {
        "path": "src/middleware/auth.ts",
        "changes": "Add GitHub token validation",
        "complexity": "moderate"
      }
    ],
    "implementationSteps": [
      {
        "order": 1,
        "description": "Create GitHub OAuth configuration",
        "estimatedEffort": "low"
      }
    ],
    "risks": [
      {
        "description": "Token expiration handling",
        "severity": "medium",
        "mitigation": "Implement refresh token flow"
      }
    ],
    "tokensIn": 1500,
    "tokensOut": 800,
    "startedAt": "2025-01-15T10:00:00.000Z",
    "completedAt": "2025-01-15T10:02:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Analysis returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Analysis not found |

---

### Get latest analysis for a task

* `GET /api/agent/task/<taskId>/analysis` : Returns the most recent analysis for a task.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "analysis-uuid",
    "taskId": "task-uuid",
    "status": "completed",
    "summary": "Analysis summary...",
    "filesToCreate": [],
    "filesToModify": [],
    "implementationSteps": [],
    "risks": [],
    "startedAt": "2025-01-15T10:00:00.000Z",
    "completedAt": "2025-01-15T10:02:00.000Z"
  }
}
```

*Response (No Analysis)*

```json
{
  "data": null,
  "message": "No analysis found for this task"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Analysis returned (or null if none) |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |

---

### List all analyses for a task

* `GET /api/agent/task/<taskId>/analyses` : Returns all analyses for a specific task.

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "analysis-uuid-1",
      "status": "completed",
      "summary": "First analysis...",
      "startedAt": "2025-01-15T10:00:00.000Z",
      "completedAt": "2025-01-15T10:02:00.000Z"
    },
    {
      "id": "analysis-uuid-2",
      "status": "completed",
      "summary": "Re-analysis after updates...",
      "startedAt": "2025-01-16T14:00:00.000Z",
      "completedAt": "2025-01-16T14:03:00.000Z"
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Analyses returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |

---

### Get project analysis statistics

* `GET /api/agent/project/<projectId>/stats` : Returns analysis statistics for a project.

*Expected Success Response (200)*

```json
{
  "data": {
    "totalAnalyses": 42,
    "completedAnalyses": 40,
    "failedAnalyses": 2,
    "averageTokensIn": 1200,
    "averageTokensOut": 650,
    "totalTokensUsed": 77700,
    "averageDurationMs": 45000
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

### Start task analysis

* `POST /api/agent/analyze/<taskId>` : Triggers LLM analysis for a task.

*Expected Success Response (200)*

```json
{
  "data": {
    "analysisId": "550e8400-e29b-41d4-a716-446655440000",
    "summary": "This task requires implementing OAuth authentication with GitHub provider for user login",
    "filesToCreate": 2,
    "filesToModify": 3,
    "implementationSteps": 5,
    "risks": 2,
    "stats": {
      "tokensIn": 1500,
      "tokensOut": 800,
      "durationMs": 45000
    }
  },
  "message": "Analysis completed successfully"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Analysis completed successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Task not found |
| `502` | Claude API error |
