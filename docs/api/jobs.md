# Jobs

This documentation outlines the **jobs endpoints** that handle background job tracking and management.
Each endpoint requires authentication.

---

## GET

### List all jobs

* `GET /api/jobs` : Returns all jobs for the authenticated user.

*Query Parameters*

| Name | Type | Description |
|------|------|-------------|
| type | string | Filter by type: indexation, analysis, export |
| status | string | Filter by status: pending, running, completed, failed, cancelled |

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "indexation",
      "status": "completed",
      "progress": {
        "phase": "completed",
        "current": 100,
        "total": 100,
        "message": "Indexation complete"
      },
      "error": null,
      "attempts": 1,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "startedAt": "2025-01-15T10:01:00.000Z",
      "completedAt": "2025-01-15T10:05:00.000Z"
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Jobs returned successfully |
| `401` | Authentication required |

---

### Get job statistics

* `GET /api/jobs/stats` : Returns job statistics for the authenticated user.

*Expected Success Response (200)*

```json
{
  "data": {
    "total": 25,
    "byStatus": {
      "pending": 2,
      "running": 1,
      "completed": 20,
      "failed": 2,
      "cancelled": 0
    },
    "byType": {
      "indexation": 15,
      "analysis": 8,
      "export": 2
    }
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Statistics returned successfully |
| `401` | Authentication required |

---

### Get a specific job

* `GET /api/jobs/<jobId>` : Returns details of a specific job.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "indexation",
    "status": "running",
    "priority": "normal",
    "progress": {
      "phase": "indexing",
      "current": 50,
      "total": 100,
      "message": "Processing src/components..."
    },
    "result": null,
    "error": null,
    "attempts": 1,
    "maxAttempts": 3,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "startedAt": "2025-01-15T10:01:00.000Z",
    "completedAt": null
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Job returned successfully |
| `401` | Authentication required |
| `404` | Job not found |

---

## DELETE

### Cancel a job

* `DELETE /api/jobs/<jobId>` : Cancels a pending job.

*Expected Success Response (200)*

```json
{
  "message": "Job cancelled"
}
```

*Error Response (400) - Job cannot be cancelled*

```json
{
  "error": "Cannot cancel this job (already running or completed)"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Job cancelled successfully |
| `400` | Job cannot be cancelled (already running/completed) |
| `401` | Authentication required |
| `404` | Job not found |
