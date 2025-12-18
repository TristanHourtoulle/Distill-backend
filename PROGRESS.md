# 📊 Distill API — Progress Tracker

> Ce fichier track l'avancement du développement. Mis à jour automatiquement par Claude Code.

## État actuel

**Phase en cours :** Phase 2 — GitHub & Indexation
**Dernière mise à jour :** 18 Dec 2025
**Prochaine tâche :** Tâche 2.5 — Routes GitHub proxy

---

## Phase 1 — Fondations

| Tâche                                      | Status | Date        | Notes                              |
| ------------------------------------------ | ------ | ----------- | ---------------------------------- |
| 1.1 — Init projet (package.json, tsconfig) | ✅     | 18 Dec 2024 | Hono, Prisma, Zod, TypeScript      |
| 1.2 — Schema Prisma                        | ✅     | 18 Dec 2024 | Tous les modèles créés             |
| 1.3 — Auth BetterAuth                      | ✅     | 18 Dec 2024 | GitHub OAuth configured            |
| 1.4 — Middlewares de base                  | ✅     | 18 Dec 2024 | error + auth middlewares           |

### Fichiers créés

- `package.json` ✅
- `tsconfig.json` ✅
- `prisma/schema.prisma` ✅ (updated with BetterAuth tables)
- `src/index.ts` ✅
- `src/lib/db.ts` ✅
- `src/lib/errors.ts` ✅
- `src/lib/auth.ts` ✅ (BetterAuth configuration)
- `src/lib/encryption.ts` ✅ (AES-256-GCM token encryption)
- `src/middlewares/error.middleware.ts` ✅
- `src/routes/auth.routes.ts` ✅ (auth routes handler)

### Phase 2 files

- `src/services/github.service.ts` ✅ (GitHub API wrapper)
- `src/services/project.service.ts` ✅ (Project business logic)
- `src/services/indexation.service.ts` ✅ (File indexation + stack detection)
- `src/services/job-queue.service.ts` ✅ (Background job queue + worker)
- `src/types/github.types.ts` ✅ (Types + error classes)
- `src/types/indexation.types.ts` ✅ (Indexation types)
- `src/types/job.types.ts` ✅ (Job queue types)
- `src/schemas/project.schema.ts` ✅ (Zod validation)
- `src/routes/projects.routes.ts` ✅ (CRUD + rules + indexation endpoints)
- `src/routes/jobs.routes.ts` ✅ (Job management endpoints)
- `src/middlewares/auth.middleware.ts` ✅ (Session validation)

### Dossiers créés (vides)

- `src/agent/tools/`

---

## Phase 2 — GitHub & Indexation

| Tâche                           | Status | Date        | Notes                              |
| ------------------------------- | ------ | ----------- | ---------------------------------- |
| 2.1 — Client GitHub API         | ✅     | 18 Dec 2025 | GitHubService + types              |
| 2.2 — Routes projects CRUD      | ✅     | 18 Dec 2025 | Full CRUD + rules                  |
| 2.3 — Service indexation        | ✅     | 18 Dec 2025 | File analysis + stack detection    |
| 2.4 — Background job indexation | ✅     | 18 Dec 2025 | Job queue + progress tracking      |
| 2.5 — Routes GitHub proxy       | ⏳     | -           | -                                  |

---

## Phase 3 — Meetings & Parsing

| Tâche                       | Status | Date | Notes                       |
| --------------------------- | ------ | ---- | --------------------------- |
| 3.1 — Routes meetings CRUD  | ⏳     | -    | -                           |
| 3.2 — Service parsing (LLM) | ⏳     | -    | Requiert: @anthropic-ai/sdk |
| 3.3 — Estimation complexité | ⏳     | -    | -                           |
| 3.4 — Routes tasks          | ⏳     | -    | -                           |

---

## Phase 4 — Agent d'analyse

| Tâche                                | Status | Date | Notes |
| ------------------------------------ | ------ | ---- | ----- |
| 4.1 — Tools agent                    | ⏳     | -    | -     |
| 4.2 — Config Claude function calling | ⏳     | -    | -     |
| 4.3 — Orchestrator (boucle agent)    | ⏳     | -    | -     |
| 4.4 — Prompts système                | ⏳     | -    | -     |
| 4.5 — Parsing résultats              | ⏳     | -    | -     |
| 4.6 — Routes agent                   | ⏳     | -    | -     |

---

## Phase 5 — Export

| Tâche                              | Status | Date | Notes |
| ---------------------------------- | ------ | ---- | ----- |
| 5.1 — Service export GitHub Issues | ⏳     | -    | -     |
| 5.2 — Routes export                | ⏳     | -    | -     |

---

## Dépendances manquantes

| Package             | Pour             | Status         |
| ------------------- | ---------------- | -------------- |
| `better-auth`       | Authentification | ✅ Installé    |
| `octokit`           | GitHub API       | ✅ Installé    |
| `@anthropic-ai/sdk` | Claude API       | ⏳ À installer |

---

## Légende

- ✅ Complété
- ⏳ En attente
- 🚧 En cours / Partiel
- ❌ Bloqué

---

## Historique des sessions

| Date        | Tâches complétées                              | Notes                        |
| ----------- | ---------------------------------------------- | ---------------------------- |
| 18 Dec 2025 | Init projet, Prisma schema, structure dossiers | Setup initial                |
| 18 Dec 2025 | Auth BetterAuth, encryption, auth routes       | GitHub OAuth authentication  |
| 18 Dec 2025 | GitHubService, types, error classes            | GitHub API client            |
| 18 Dec 2025 | Projects CRUD, schemas, auth middleware        | Full project management      |
| 18 Dec 2025 | IndexationService, types, stack detection      | Code indexation service      |
| 18 Dec 2025 | JobQueueService, job routes, progress tracking | Background job system        |
