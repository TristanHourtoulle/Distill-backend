# Meetings

This documentation outlines the **meetings endpoints** that handle meeting management and LLM-based task extraction.
Each endpoint requires authentication.

---

## GET

### List all meetings

* `GET /api/meetings` : Returns all meetings for the authenticated user.

*Query Parameters*

| Name | Type | Default | Description |
|------|------|---------|-------------|
| projectId | string | - | Filter by project UUID |
| status | string | - | Filter by status: pending, processing, completed, error |
| limit | number | 50 | Max results per page (1-100) |
| offset | number | 0 | Pagination offset |

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "projectId": "project-uuid",
      "title": "Sprint Planning - Week 3",
      "rawContent": "Meeting notes content...",
      "parsedSummary": "Structured summary...",
      "referenceBranch": "develop",
      "source": "paste",
      "metadata": { "participants": ["John", "Jane"] },
      "status": "completed",
      "meetingDate": "2025-01-15T14:00:00.000Z",
      "createdAt": "2025-01-15T15:00:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Meetings returned successfully |
| `401` | Authentication required |

---

### Get a specific meeting

* `GET /api/meetings/<meetingId>` : Returns a specific meeting with its tasks.

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "project-uuid",
    "title": "Sprint Planning - Week 3",
    "rawContent": "Meeting notes content...",
    "parsedSummary": "Structured summary...",
    "referenceBranch": "develop",
    "source": "paste",
    "metadata": { "participants": ["John", "Jane"] },
    "status": "completed",
    "meetingDate": "2025-01-15T14:00:00.000Z",
    "createdAt": "2025-01-15T15:00:00.000Z",
    "tasks": [
      {
        "id": "task-uuid",
        "title": "Implement user authentication",
        "description": "Add OAuth login with GitHub",
        "type": "feature",
        "complexity": "moderate",
        "status": "pending"
      }
    ]
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Meeting returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Meeting not found |

---

### Get meeting tasks

* `GET /api/meetings/<meetingId>/tasks` : Returns all tasks extracted from a meeting.

*Expected Success Response (200)*

```json
{
  "data": [
    {
      "id": "task-uuid",
      "title": "Implement user authentication",
      "description": "Add OAuth login with GitHub",
      "type": "feature",
      "complexity": "moderate",
      "status": "pending",
      "priority": 1
    },
    {
      "id": "task-uuid-2",
      "title": "Fix pagination bug",
      "description": "Users report pagination not working on page 3",
      "type": "bugfix",
      "complexity": "simple",
      "status": "pending",
      "priority": 2
    }
  ]
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Tasks returned successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Meeting not found |

---

## POST

### Create a meeting

* `POST /api/meetings` : Creates a new meeting from meeting notes.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| projectId | string | Yes | Project UUID |
| title | string | Yes | Meeting title (1-200 chars) |
| rawContent | string | Yes | Meeting notes content (10-100000 chars) |
| referenceBranch | string | Yes | Branch to reference for analysis |
| source | string | No | Source: upload, paste, webhook (default: paste) |
| metadata | object | No | Additional metadata (participants, etc.) |
| meetingDate | string | No | ISO 8601 date of the meeting |

*Example Request*

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Sprint Planning - Week 3",
  "rawContent": "## Sprint Planning Notes\n\nDiscussed:\n- User auth feature\n- Bug fixes for pagination\n...",
  "referenceBranch": "develop",
  "source": "paste",
  "metadata": {
    "participants": ["John", "Jane", "Bob"]
  },
  "meetingDate": "2025-01-15T14:00:00.000Z"
}
```

*Expected Success Response (201)*

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "project-uuid",
    "title": "Sprint Planning - Week 3",
    "rawContent": "## Sprint Planning Notes\n...",
    "referenceBranch": "develop",
    "source": "paste",
    "status": "pending",
    "createdAt": "2025-01-15T15:00:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `201` | Meeting created successfully |
| `400` | Invalid input (validation error) |
| `401` | Authentication required |
| `403` | No access to project |
| `404` | Project not found |

---

### Parse meeting with LLM

* `POST /api/meetings/<meetingId>/parse` : Uses Claude LLM to extract tasks from meeting content.

*Expected Success Response (200)*

```json
{
  "data": {
    "summary": "Sprint planning focused on authentication and bug fixes",
    "tasksCount": 5,
    "metadata": {
      "participants": ["John", "Jane"],
      "topics": ["auth", "bugs", "performance"]
    },
    "tokensUsed": 1234
  },
  "message": "Successfully extracted 5 tasks"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Parsing completed successfully |
| `400` | Meeting already parsed (use reparse) |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Meeting not found |
| `502` | Claude API error |

---

### Re-parse meeting

* `POST /api/meetings/<meetingId>/reparse` : Re-parses meeting content (deletes existing tasks).

*Expected Success Response (200)*

```json
{
  "data": {
    "summary": "Updated sprint planning summary",
    "tasksCount": 6,
    "metadata": {
      "participants": ["John", "Jane", "Bob"]
    },
    "tokensUsed": 1456
  },
  "message": "Re-parsed meeting, extracted 6 tasks"
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Re-parsing completed successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Meeting not found |
| `502` | Claude API error |

---

## PATCH

### Update a meeting

* `PATCH /api/meetings/<meetingId>` : Updates meeting information.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| title | string | No | Meeting title (1-200 chars) |
| rawContent | string | No | Meeting content (10-100000 chars) |
| referenceBranch | string | No | Reference branch |
| metadata | object | No | Metadata |
| meetingDate | string | No | ISO 8601 date |
| status | string | No | Status: pending, processing, completed, error |

*Expected Success Response (200)*

```json
{
  "data": {
    "id": "meeting-uuid",
    "title": "Updated Meeting Title",
    "status": "completed",
    "updatedAt": "2025-01-18T12:00:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Meeting updated successfully |
| `400` | Invalid input |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Meeting not found |

---

## DELETE

### Delete a meeting

* `DELETE /api/meetings/<meetingId>` : Deletes a meeting and all its tasks.

*Expected Success Response (204)*

No content returned.

*Response Codes*

| Code | Description |
|------|-------------|
| `204` | Meeting deleted successfully |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Meeting not found |
