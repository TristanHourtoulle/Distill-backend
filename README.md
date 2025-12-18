# 🧪 Distill — Backend API

> **From meetings to code, distilled.**

API REST de Distill, le service qui transforme les résumés de réunions en tâches de développement contextualisées via un agent LLM.

![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Hono](https://img.shields.io/badge/Hono-4-E36002?style=flat-square)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)

---

## 🏗️ Architecture

Ce repo contient le **backend** de Distill. Le frontend est dans un repo séparé.

```
┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │
│  Distill-web    │◄───────►│  Distill-api    │
│  (autre repo)   │  REST   │  (ce repo)      │
│                 │         │                 │
│  Next.js        │         │  Hono           │
│  React          │         │  Prisma         │
│                 │         │  PostgreSQL     │
│                 │         │  Claude API     │
│                 │         │  GitHub API     │
└─────────────────┘         └─────────────────┘
```

---

## ✨ Fonctionnalités

- **🔐 Authentification** — GitHub OAuth via BetterAuth
- **🔗 GitHub API** — Connexion repos, lecture branches, exploration code
- **📝 Parsing réunions** — Extraction de tâches via Claude
- **🤖 Agent d'analyse** — Exploration du code et génération de plans d'implémentation
- **📤 Export** — Création d'issues GitHub
- **🗄️ Persistance** — PostgreSQL via Prisma

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [MVP Specifications](./docs/guideline/MVP%20Specifications%20Claude.md) | Plan de développement complet |
| [Schéma BDD](./docs/guideline/Schéma%20de%20base%20de%20données.mermaid) | Architecture de données |

---

## 🛠️ Stack technique

| Catégorie | Technologie |
|-----------|-------------|
| Runtime | Node.js 20+ |
| Framework | Hono |
| Langage | TypeScript 5 |
| ORM | Prisma |
| Base de données | PostgreSQL |
| Auth | BetterAuth |
| Validation | Zod |
| LLM | Claude API (Anthropic) |
| GitHub | Octokit |

---

## 🚀 Installation

### Prérequis

- Node.js 20+
- pnpm (recommandé)
- PostgreSQL 15+
- GitHub OAuth App
- Clé API Claude (Anthropic)

### 1. Cloner le repo

```bash
git clone https://github.com/[username]/Distill-api.git
cd Distill-api
```

### 2. Installer les dépendances

```bash
pnpm install
```

### 3. Configuration environnement

```bash
cp .env.example .env
```

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/distill"

# BetterAuth
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:4000"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Encryption (pour tokens GitHub)
ENCRYPTION_KEY="your-32-character-key"

# Claude API
ANTHROPIC_API_KEY="sk-ant-xxxxx"

# Frontend URL (CORS)
FRONTEND_URL="http://localhost:3000"
```

### 4. Initialiser la base de données

```bash
pnpm prisma migrate dev
```

### 5. Lancer le serveur

```bash
pnpm dev
```

L'API est accessible sur [http://localhost:4000](http://localhost:4000)

---

## 📁 Structure du projet

```
src/
├── index.ts                    # Point d'entrée, configuration Hono
├── routes/
│   ├── auth.routes.ts          # Routes BetterAuth
│   ├── projects.routes.ts      # CRUD projets
│   ├── meetings.routes.ts      # CRUD réunions
│   ├── tasks.routes.ts         # CRUD tâches
│   ├── agent.routes.ts         # Lancement analyses
│   └── github.routes.ts        # Proxy GitHub API
├── services/
│   ├── github.service.ts       # Client GitHub (Octokit)
│   ├── indexer.service.ts      # Indexation des repos
│   ├── parser.service.ts       # Extraction tâches (LLM)
│   ├── agent.service.ts        # Agent d'analyse (LLM + tools)
│   └── export.service.ts       # Export vers GitHub Issues
├── lib/
│   ├── db.ts                   # Client Prisma
│   ├── auth.ts                 # Configuration BetterAuth
│   ├── claude.ts               # Client Claude API
│   ├── encryption.ts           # Chiffrement tokens
│   └── errors.ts               # Classes d'erreurs custom
├── middlewares/
│   ├── auth.middleware.ts      # Vérification session
│   ├── error.middleware.ts     # Gestion erreurs globale
│   └── cors.middleware.ts      # Configuration CORS
├── schemas/                    # Zod schemas
│   ├── project.schema.ts
│   ├── meeting.schema.ts
│   └── task.schema.ts
├── types/                      # Types TypeScript
│   ├── github.types.ts
│   ├── agent.types.ts
│   └── api.types.ts
└── agent/                      # Logique de l'agent LLM
    ├── tools/
    │   ├── list-directory.ts
    │   ├── read-file.ts
    │   ├── search-code.ts
    │   └── get-imports.ts
    ├── orchestrator.ts         # Boucle agent
    └── prompts.ts              # Prompts système
```

---

## 🔌 API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/*` | Routes BetterAuth (OAuth GitHub) |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | Liste des projets |
| POST | `/api/projects` | Créer un projet |
| GET | `/api/projects/:id` | Détails d'un projet |
| PATCH | `/api/projects/:id` | Modifier un projet |
| DELETE | `/api/projects/:id` | Supprimer un projet |
| POST | `/api/projects/:id/index` | Lancer l'indexation |
| GET | `/api/projects/:id/status` | Status de l'indexation |

### Meetings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/meetings` | Liste des réunions |
| POST | `/api/projects/:id/meetings` | Créer une réunion |
| GET | `/api/meetings/:id` | Détails d'une réunion |
| DELETE | `/api/meetings/:id` | Supprimer une réunion |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/meetings/:id/tasks` | Liste des tâches |
| GET | `/api/tasks/:id` | Détails d'une tâche |
| POST | `/api/tasks/:id/analyze` | Lancer l'analyse agent |
| GET | `/api/tasks/:id/analysis` | Résultat de l'analyse |
| POST | `/api/tasks/:id/export` | Exporter vers GitHub |

### GitHub (proxy)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/github/repos` | Liste repos de l'utilisateur |
| GET | `/api/github/repos/:owner/:repo/branches` | Liste des branches |

---

## 🤖 Agent LLM

L'agent utilise Claude avec des "tools" pour explorer le code :

| Tool | Description |
|------|-------------|
| `list_directory` | Lister le contenu d'un dossier |
| `read_file` | Lire le contenu d'un fichier |
| `search_code` | Rechercher dans le code |
| `get_imports` | Analyser les imports d'un fichier |

L'agent explore le code de manière autonome sur la branche spécifiée et génère un plan d'implémentation détaillé.

---

## 📜 Scripts disponibles

```bash
# Développement
pnpm dev              # Lancer en dev (watch mode)
pnpm build            # Build TypeScript
pnpm start            # Lancer en production
pnpm lint             # Linter ESLint
pnpm type-check       # Vérification TypeScript

# Base de données
pnpm prisma migrate dev    # Appliquer les migrations
pnpm prisma studio         # Interface admin BDD
pnpm prisma generate       # Regénérer le client

# Tests
pnpm test             # Tests unitaires
pnpm test:integration # Tests d'intégration
```

---

## 🔗 Repos liés

| Repo | Description |
|------|-------------|
| [Distill-website](https://github.com/[username]/Distill-website) | Frontend Next.js |

---

## 📄 Licence

Propriétaire — Tous droits réservés.

---

<p align="center">
  <strong>Distill API</strong> — The brain behind the magic
</p>
