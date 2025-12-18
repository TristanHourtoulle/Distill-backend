# Authentication

This documentation outlines the **authentication endpoints** powered by BetterAuth with GitHub OAuth.
All authentication is handled automatically by BetterAuth.

## Overview

Authentication uses GitHub OAuth. Users sign in with their GitHub account and receive a session token stored in cookies.

---

## GET

### Get current session

* `GET /api/auth/session` : Returns the current user's session information.

*Expected Success Response (200)*

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "image": "https://avatars.githubusercontent.com/u/123456"
  },
  "session": {
    "id": "session-uuid",
    "expiresAt": "2025-01-18T12:00:00.000Z"
  }
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Session found and returned |
| `404` | No active session |

---

## POST

### Sign in with GitHub

* `POST /api/auth/sign-in/social` : Initiates GitHub OAuth sign-in flow.

*JSON Body Parameters*

| Name | Type | Required | Description |
|------|------|----------|-------------|
| provider | string | Yes | Must be `"github"` |
| callbackURL | string | Yes | URL to redirect after authentication |

*Example Request*

```json
{
  "provider": "github",
  "callbackURL": "http://localhost:3000/dashboard"
}
```

*Expected Success Response (200)*

```json
{
  "url": "https://github.com/login/oauth/authorize?client_id=...&redirect_uri=..."
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Returns OAuth URL for redirection |
| `400` | Invalid provider or callback URL |

---

### Sign out

* `POST /api/auth/sign-out` : Signs out the current user and invalidates the session.

*Expected Success Response (200)*

```json
{
  "success": true
}
```

*Response Codes*

| Code | Description |
|------|-------------|
| `200` | Successfully signed out |
| `401` | No active session to sign out |

---

## OAuth Callback

### Handle GitHub callback

* `GET /api/auth/callback/github` : Handles GitHub OAuth callback (called automatically by GitHub).

*Query Parameters*

| Name | Type | Description |
|------|------|-------------|
| code | string | Authorization code from GitHub |
| state | string | State parameter for CSRF protection |

*Response Codes*

| Code | Description |
|------|-------------|
| `302` | Redirects to callback URL on success |
| `400` | Invalid code or state |
| `502` | GitHub API error |
