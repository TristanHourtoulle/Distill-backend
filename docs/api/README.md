# Distill API Documentation

> Complete API reference for the Distill backend service.

## Base URL

```
http://localhost:4000/api
```

## Authentication

All endpoints (except `/health` and `/`) require authentication via BetterAuth session cookies or Bearer token.

## API Sections

| Section | Base Path | Description |
|---------|-----------|-------------|
| [Auth](./auth.md) | `/api/auth` | Authentication (GitHub OAuth) |
| [Projects](./projects.md) | `/api/projects` | Project management & indexation |
| [Jobs](./jobs.md) | `/api/jobs` | Background job tracking |
| [GitHub](./github.md) | `/api/github` | GitHub API proxy |
| [Meetings](./meetings.md) | `/api/meetings` | Meeting management & LLM parsing |
| [Tasks](./tasks.md) | `/api/tasks` | Task management & complexity estimation |
| [Agent](./agent.md) | `/api/agent` | LLM agent analysis |
| [Export](./export.md) | `/api/export` | Export to GitHub Issues |

## Common Response Formats

### Success Response

```json
{
  "data": { ... }
}
```

### Success Response with Pagination

```json
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Common HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | OK - Request succeeded |
| `201` | Created - Resource created successfully |
| `204` | No Content - Resource deleted successfully |
| `400` | Bad Request - Invalid input or validation error |
| `401` | Unauthorized - Authentication required |
| `403` | Forbidden - Access denied |
| `404` | Not Found - Resource not found |
| `500` | Internal Server Error - Unexpected error |
| `502` | Bad Gateway - External service error (GitHub, Claude) |
