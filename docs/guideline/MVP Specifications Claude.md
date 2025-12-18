# 📋 Meeting Task Agent — Spécifications MVP

## Table des matières

1. [Résumé du projet](#résumé-du-projet)
2. [Documents liés](#documents-liés)
3. [Stack technique](#stack-technique)
4. [Phase 1 — Fondations](#phase-1--fondations)
5. [Phase 2 — Connexion GitHub & Indexation](#phase-2--connexion-github--indexation)
6. [Phase 3 — Import & Parsing des réunions](#phase-3--import--parsing-des-réunions)
7. [Phase 4 — Agent d'analyse](#phase-4--agent-danalyse)
8. [Phase 5 — Dashboard & Interface](#phase-5--dashboard--interface)
9. [Phase 6 — Export des tâches](#phase-6--export-des-tâches)
10. [Phase 7 — Finalisation MVP](#phase-7--finalisation-mvp)

---

## Résumé du projet

### Vision

Meeting Task Agent est un outil qui transforme automatiquement les résumés de réunions en tâches de développement actionnables et contextualisées. Contrairement aux outils classiques de gestion de tâches, celui-ci comprend le code du projet et génère des plans d'implémentation précis : quels fichiers créer, lesquels modifier, comment s'intégrer aux patterns existants.

### Problème résolu

Après une réunion client, un développeur freelance doit :
1. Relire le résumé pour en extraire les tâches
2. Analyser son code pour comprendre l'impact
3. Rédiger des issues détaillées

Ce processus prend 30-60 minutes par réunion. Meeting Task Agent automatise ces étapes et produit des tâches prêtes à être exécutées.

### Fonctionnement global

```
Résumé de réunion
       │
       ▼
┌──────────────────┐
│  Extraction LLM  │ ──▶ Liste de tâches brutes
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ Pré-estimation   │ ──▶ Complexité (simple/modéré/critique)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Agent analyse   │ ──▶ Plan d'implémentation détaillé
│  le code réel    │     (fichiers, lignes, étapes)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Export          │ ──▶ GitHub Issue / Notion / Jira
└──────────────────┘
```

### Utilisateur cible

Développeurs freelances et petites équipes qui :
- Ont des réunions clients régulières
- Gèrent leurs projets sur GitHub
- Veulent gagner du temps sur la création de tâches

### Périmètre MVP

**Inclus :**
- Authentification GitHub OAuth
- Connexion d'un repo (lecture seule)
- Configuration de règles projet
- Import de résumés (upload/paste)
- Extraction automatique des tâches
- Agent d'analyse avec exploration du code
- Export vers GitHub Issues

**Exclu du MVP :**
- Webhook automatique depuis outils de transcription
- Intégrations Notion/Jira/Linear (prévu v1.1)
- Multi-repos par projet
- Collaboration multi-utilisateurs
- Historique des analyses

---

## Documents liés

| Document | Description | Chemin |
|----------|-------------|--------|
| Parcours utilisateur | Diagramme Mermaid du flow complet | `./user-journey.mermaid` |
| Schéma base de données | ERD Mermaid avec toutes les tables | `./database-schema.mermaid` |

---

## Stack technique

### Frontend
- **Framework** : Next.js 14+ (App Router)
- **Langage** : TypeScript
- **Styling** : Tailwind CSS
- **État** : Zustand
- **Formulaires** : React Hook Form + Zod
- **Requêtes** : TanStack Query
- **Icônes** : Heroicons (@heroicons/react)
- **Composants** : Custom (pas de librairie UI externe)

> ⚠️ **Note importante** : Nous créons nos propres composants UI from scratch. Pas de shadcn/ui, Radix, ou autre librairie de composants. Cela garantit un contrôle total sur le design et évite les dépendances inutiles.

### Backend
- **Runtime** : Node.js (via Next.js API Routes)
- **ORM** : Prisma
- **Base de données** : PostgreSQL
- **Auth** : NextAuth.js (GitHub provider)
- **LLM** : Claude API (Anthropic)
- **File storage** : Local filesystem ou S3 (pour les résumés uploadés)

### Externes
- **GitHub API** : REST API v3
- **Rate limiting** : Upstash Redis (optionnel MVP)

---

## Phase 1 — Fondations

### Description

Mise en place de l'infrastructure de base : projet Next.js, base de données, authentification GitHub. À la fin de cette phase, un utilisateur peut se connecter via GitHub et voir un dashboard vide.

### Durée estimée : 2-3 jours

---

### Tâche 1.1 — Initialisation du projet

**Description** : Créer le projet Next.js avec la configuration de base.

**Input** : Aucun

**Output** :
- Projet Next.js fonctionnel
- Structure de dossiers établie
- ESLint + Prettier configurés
- Tailwind CSS opérationnel

**Structure de dossiers attendue** :
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── callback/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── projects/
│   ├── api/
│   │   ├── auth/
│   │   ├── projects/
│   │   ├── meetings/
│   │   └── agent/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/           # Composants génériques
│   └── features/     # Composants métier
├── lib/
│   ├── db.ts         # Client Prisma
│   ├── auth.ts       # Config NextAuth
│   ├── github.ts     # Client GitHub API
│   ├── llm.ts        # Client Claude API
│   └── utils.ts
├── hooks/
├── stores/           # Zustand stores
├── types/
└── schemas/          # Zod schemas
```

**Comment tester** :
- `npm run dev` démarre sans erreur
- `npm run build` compile sans erreur
- `npm run lint` passe sans erreur

**Cas limites à gérer** : Aucun à ce stade.

---

### Tâche 1.2 — Configuration base de données

**Description** : Mettre en place PostgreSQL avec Prisma, créer le schéma initial.

**Input** :
- Schéma de données (voir `database-schema.mermaid`)
- URL de connexion PostgreSQL

**Output** :
- Fichier `prisma/schema.prisma` complet
- Migrations initiales générées
- Client Prisma typé disponible

**Schéma Prisma à implémenter** :

```prisma
// Modèles à créer dans l'ordre :
// 1. User
// 2. Project
// 3. ProjectRule
// 4. ProjectIndex
// 5. Meeting
// 6. Task
// 7. TaskAnalysis
// 8. AgentLog
// 9. Integration
// 10. TaskExport
```

**Comment tester** :
- `npx prisma migrate dev` s'exécute sans erreur
- `npx prisma studio` affiche toutes les tables
- Le client Prisma génère les types TypeScript corrects

**Cas limites à gérer** :
- S'assurer que les champs `json` acceptent `null` pour les données optionnelles
- Les tokens GitHub doivent être marqués pour chiffrement (implémenté phase suivante)
- Les énumérations doivent avoir une valeur par défaut

---

### Tâche 1.3 — Authentification GitHub OAuth

**Description** : Implémenter le flow OAuth GitHub via NextAuth.js.

**Input** :
- GitHub OAuth App credentials (Client ID + Secret)
- Scopes nécessaires : `read:user`, `user:email`, `repo` (lecture)

**Output** :
- Page de login fonctionnelle
- Callback OAuth géré
- Session utilisateur persistée
- Token GitHub stocké en base (chiffré)

**Flow détaillé** :

```
1. User clique "Se connecter avec GitHub"
2. Redirection vers GitHub OAuth
3. User autorise l'application
4. GitHub redirige vers /api/auth/callback/github
5. NextAuth récupère le token + infos user
6. Création/mise à jour User en base
7. Token GitHub chiffré et stocké
8. Session créée, redirect vers /dashboard
```

**Comment tester** :
1. Accéder à `/login` → bouton GitHub visible
2. Cliquer → redirection GitHub
3. Autoriser → retour sur `/dashboard`
4. Vérifier en base : User créé avec `github_access_token` non null
5. Refresh page → session maintenue
6. Déconnexion → session détruite

**Cas limites à gérer** :
- User refuse l'autorisation → afficher message d'erreur clair
- Token GitHub expiré/révoqué → détecter et demander reconnexion
- User existe déjà (même email) → mettre à jour au lieu de créer
- Chiffrement du token : utiliser `crypto` avec clé dans env var

**Variables d'environnement requises** :
```env
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=xxx  # Pour chiffrer les tokens
```

---

### Tâche 1.4 — Layout dashboard de base

**Description** : Créer le layout authentifié avec navigation minimale.

**Input** :
- Session utilisateur
- Design system minimal (couleurs, typographie)

**Output** :
- Layout avec sidebar
- Header avec avatar + déconnexion
- Page dashboard vide avec message "Aucun projet"
- Redirection automatique si non connecté

**Composants à créer** :
- `DashboardLayout` : wrapper avec sidebar
- `Sidebar` : navigation (Projets, Réunions)
- `Header` : user info + logout
- `EmptyState` : composant réutilisable pour états vides

**Comment tester** :
1. Accéder à `/dashboard` sans session → redirect `/login`
2. Accéder connecté → layout affiché
3. Cliquer déconnexion → redirect `/login`
4. Navigation responsive sur mobile

**Cas limites à gérer** :
- Loading state pendant vérification session
- Erreur de session → déconnexion propre

---

## Phase 2 — Connexion GitHub & Indexation

### Description

Permettre à l'utilisateur de connecter un repo GitHub et indexer sa structure. À la fin de cette phase, l'utilisateur peut ajouter un projet, voir sa structure, et configurer des règles.

### Durée estimée : 4-5 jours

---

### Tâche 2.1 — Client GitHub API

**Description** : Créer un wrapper autour de l'API GitHub pour les opérations nécessaires.

**Input** :
- Token GitHub de l'utilisateur
- Owner + repo name

**Output** :
- Module `lib/github.ts` avec les fonctions suivantes :
  - `listUserRepos()` : lister les repos accessibles
  - `getRepoInfo(owner, repo)` : métadonnées du repo
  - `listBranches(owner, repo)` : lister toutes les branches
  - `getTree(owner, repo, branch)` : arborescence complète d'une branche
  - `getFileContent(owner, repo, path, branch)` : contenu d'un fichier sur une branche
  - `searchCode(owner, repo, query)` : recherche dans le code

**Signatures des fonctions** :

```typescript
interface GitHubClient {
  listUserRepos(): Promise<RepoSummary[]>
  getRepoInfo(owner: string, repo: string): Promise<RepoInfo>
  listBranches(owner: string, repo: string): Promise<Branch[]>
  getTree(owner: string, repo: string, branch: string): Promise<TreeNode[]>
  getFileContent(owner: string, repo: string, path: string, branch: string): Promise<FileContent>
  searchCode(owner: string, repo: string, query: string): Promise<SearchResult[]>
}

interface Branch {
  name: string
  commit: string // SHA du dernier commit
  protected: boolean
}
```

**Comment tester** :
1. Test unitaire avec mock : chaque fonction retourne le bon format
2. Test d'intégration avec vrai repo : récupérer l'arborescence d'un repo public
3. Vérifier la gestion du rate limiting (header `X-RateLimit-Remaining`)
4. **`listBranches()` retourne toutes les branches avec leur SHA**
5. **`getTree()` avec branche spécifique retourne la bonne version du code**
6. **`getFileContent()` avec branche spécifique retourne le bon contenu**

**Cas limites à gérer** :
- Token expiré/invalide → throw error spécifique `GitHubAuthError`
- Repo privé sans accès → throw `GitHubAccessError`
- Fichier trop gros (>1MB) → l'API retourne un lien blob, gérer ce cas
- Rate limit atteint → throw `GitHubRateLimitError` avec retry-after
- Fichiers binaires → détecter et ignorer (images, fonts, etc.)
- Encoding non-UTF8 → décoder proprement ou ignorer

---

### Tâche 2.2 — Formulaire ajout de projet

**Description** : Interface pour sélectionner et ajouter un repo comme projet, avec configuration de la branche préférée.

**Input** :
- Liste des repos de l'utilisateur (via GitHub API)
- Informations saisies : nom personnalisé, description, branche préférée

**Output** :
- Page `/projects/new`
- Sélecteur de repo avec recherche
- **Sélecteur de branche préférée** (chargé après sélection du repo)
- Formulaire de configuration initiale
- Projet créé en base avec status `pending`

**Flow utilisateur** :

```
1. User clique "Nouveau projet"
2. Chargement de ses repos GitHub
3. User sélectionne un repo (avec recherche/filtre)
4. Chargement des branches du repo sélectionné
5. User sélectionne la branche préférée (défaut: branche par défaut du repo)
6. User donne un nom + description (optionnel)
7. Validation → création Project en base
8. Redirect vers page projet (indexation en cours sur la branche préférée)
```

**Validation Zod** :

```typescript
const createProjectSchema = z.object({
  githubRepoUrl: z.string().url(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  preferredBranch: z.string().min(1), // branche préférée pour les analyses
})
```

**Comment tester** :
1. Charger la page → liste des repos affichée
2. Sélectionner un repo → URL automatiquement remplie + branches chargées
3. **Branches affichées → dropdown avec toutes les branches**
4. **Branche par défaut du repo pré-sélectionnée**
5. Soumettre sans nom → erreur de validation
6. Soumettre valide → projet créé, redirect vers `/projects/[id]`
7. Ajouter le même repo 2 fois → erreur "Projet déjà existant"

**Cas limites à gérer** :
- User a 0 repos → message explicatif
- User a 500+ repos → pagination ou recherche obligatoire
- Repo déjà ajouté → empêcher la duplication
- Perte de connexion pendant chargement repos → retry button
- **Repo avec 1 seule branche → sélecteur disabled, branche unique**
- **Repo avec 100+ branches → recherche/filtre dans le dropdown**

---

### Tâche 2.3 — Service d'indexation

**Description** : Créer le service qui analyse un repo sur une branche spécifique et génère la "carte projet".

**Input** :
- Project ID
- Token GitHub
- Branche à indexer (preferred_branch du projet)

**Output** :
- Table `ProjectIndex` remplie pour chaque fichier pertinent
- Champ `structure_summary` du Project mis à jour
- Champ `detected_stack` rempli
- Status projet → `ready`

**Logique d'indexation** :

```
1. Récupérer l'arborescence complète (getTree avec la branche préférée)
2. Filtrer les fichiers pertinents :
   - Inclure : .ts, .tsx, .js, .jsx, .json (config)
   - Exclure : node_modules, .git, dist, build, .next
   - Exclure : fichiers > 100KB
3. Pour chaque fichier pertinent :
   a. Récupérer le contenu (sur la branche préférée)
   b. Extraire les exports (regex ou AST simple)
   c. Extraire les imports
   d. Déterminer le type (component, hook, api, util, config)
   e. Créer entrée ProjectIndex
4. Détecter la stack :
   - Lire package.json (sur la branche préférée)
   - Identifier : next, react, vue, tailwind, prisma, etc.
5. Générer le résumé structure (pour le contexte LLM)
6. Mettre à jour Project.status = 'ready'
```

> **Note** : L'indexation se fait toujours sur la `preferred_branch` du projet. Si l'utilisateur veut analyser une autre branche pour une réunion spécifique, l'agent utilisera la `reference_branch` de la Meeting, mais la carte projet reste basée sur la branche préférée.

**Format du `structure_summary`** (JSON stocké) :

```json
{
  "total_files": 127,
  "by_type": {
    "component": 45,
    "hook": 12,
    "api": 18,
    "util": 22,
    "config": 8,
    "other": 22
  },
  "key_directories": [
    {"path": "src/components", "description": "React components"},
    {"path": "src/app/api", "description": "API routes"}
  ],
  "main_exports": [
    {"name": "Button", "path": "src/components/ui/Button.tsx", "type": "component"},
    {"name": "useAuth", "path": "src/hooks/useAuth.ts", "type": "hook"}
  ],
  "patterns_detected": [
    "App Router (Next.js 13+)",
    "Zustand for state management",
    "Tailwind CSS"
  ]
}
```

**Comment tester** :
1. Lancer l'indexation sur un repo connu (ex: un de tes projets)
2. Vérifier en base : `ProjectIndex` contient les bons fichiers
3. Vérifier : `detected_stack` contient les bonnes technos
4. Vérifier : `structure_summary` est cohérent
5. Performance : un repo de 200 fichiers doit s'indexer en < 2 minutes

**Cas limites à gérer** :
- Repo vide → status `error` + message
- Repo sans package.json → stack = `unknown`
- Fichier avec syntax error → logger warning, continuer
- GitHub rate limit pendant indexation → pause + retry
- Indexation interrompue → pouvoir reprendre ou réinitialiser

---

### Tâche 2.4 — Background job pour indexation

**Description** : L'indexation doit tourner en arrière-plan, pas bloquer l'UI.

**Input** :
- Project ID à indexer

**Output** :
- Système de job queue fonctionnel
- Endpoint pour déclencher l'indexation
- Endpoint pour vérifier le status
- WebSocket ou polling pour updates UI

**Options d'implémentation** :

| Option | Complexité | Recommandation MVP |
|--------|------------|-------------------|
| API Route longue + polling | Simple | ✅ Recommandé |
| Inngest | Moyenne | Bon si déjà connu |
| BullMQ + Redis | Complexe | Overkill MVP |

**Implémentation recommandée (polling)** :

```
POST /api/projects/[id]/index
  → Démarre l'indexation en background
  → Retourne immédiatement { status: 'started' }

GET /api/projects/[id]/status
  → Retourne { status: 'indexing', progress: 45 } ou { status: 'ready' }
```

**Comment tester** :
1. Déclencher indexation → réponse immédiate
2. Polling status → voir progression
3. Indexation terminée → status `ready`
4. UI affiche le loader puis rafraîchit

**Cas limites à gérer** :
- Deux indexations simultanées sur même projet → bloquer la 2ème
- Indexation qui crash → status `error` + message
- User ferme la page → indexation continue quand même

---

### Tâche 2.5 — Page projet & configuration règles

**Description** : Interface pour voir un projet, configurer ses règles et gérer la branche préférée.

**Input** :
- Project avec son index
- Règles existantes
- Liste des branches disponibles

**Output** :
- Page `/projects/[id]` avec :
  - Infos générales (nom, repo, stack détectée)
  - **Sélecteur de branche préférée** avec option de ré-indexation
  - Arborescence visuelle simplifiée
  - Liste des règles configurables
  - Formulaire ajout/édition règle

**Types de règles** :

```typescript
type RuleType = 'must_do' | 'must_not_do' | 'convention' | 'pattern'

// Exemples :
// must_do: "Toujours utiliser les Server Components par défaut"
// must_not_do: "Ne jamais utiliser Redux"
// convention: "Les hooks commencent par use et sont dans /hooks"
// pattern: "Les API routes retournent { success, data, error }"
```

**Gestion des branches** :

```
1. Afficher la branche préférée actuelle
2. Dropdown pour changer de branche
3. Si changement → proposer de ré-indexer
4. Ré-indexation optionnelle (la carte projet peut être obsolète sinon)
5. Afficher la date de dernière indexation
```

**Comment tester** :
1. Accéder à un projet indexé → infos affichées
2. Ajouter une règle → sauvegardée en base
3. Modifier une règle → mise à jour
4. Supprimer une règle → suppression
5. Règles vides → message "Aucune règle configurée"
6. **Changer de branche préférée → proposition de ré-indexation**
7. **Ré-indexer → nouvelle carte projet générée**

**Cas limites à gérer** :
- Projet en cours d'indexation → afficher loader + disable actions
- Projet en erreur → afficher message + bouton réessayer
- **Branche supprimée sur GitHub** → erreur + forcer choix nouvelle branche
- **Changement de branche sans ré-indexation** → warning que la carte projet peut être obsolète

---

## Phase 3 — Import & Parsing des réunions

### Description

Permettre l'import de résumés de réunions et leur transformation en liste de tâches. À la fin de cette phase, l'utilisateur peut uploader un résumé et voir les tâches extraites.

### Durée estimée : 3-4 jours

---

### Tâche 3.1 — Interface d'import de réunion

**Description** : Page pour importer un nouveau résumé de réunion avec sélection de la branche de référence.

**Input** :
- Project ID
- Contenu du résumé (fichier ou texte)
- Branche de référence (optionnel, défaut = preferred_branch du projet)

**Output** :
- Page `/projects/[id]/meetings/new`
- Upload de fichier (.txt, .md, .pdf)
- Zone de texte pour copier/coller
- **Sélecteur de branche** (dropdown avec les branches du repo)
- Champs métadonnées (titre, date réunion)

**Formats acceptés** :
- `.txt` : lecture directe
- `.md` : lecture directe
- `.pdf` : extraction texte (lib: `pdf-parse`)

**Validation** :

```typescript
const createMeetingSchema = z.object({
  title: z.string().min(2).max(200),
  content: z.string().min(50).max(50000), // ~10k mots max
  referenceBranch: z.string().min(1), // branche obligatoire
  meetingDate: z.date().optional(),
})
```

**Flow de sélection de branche** :

```
1. User arrive sur le formulaire
2. Chargement des branches disponibles via GitHub API
3. Pré-sélection de la branche préférée du projet (preferred_branch)
4. User peut changer pour une autre branche (develop, staging, feature/xxx)
5. La branche sélectionnée est stockée dans Meeting.reference_branch
6. L'agent utilisera cette branche pour explorer le code
```

**Comment tester** :
1. Upload fichier .txt → contenu extrait
2. Upload fichier .md → contenu extrait
3. Upload fichier .pdf → contenu extrait
4. Coller du texte → fonctionne
5. Fichier trop gros (>50KB) → erreur
6. **Changer de branche → branche correctement enregistrée**
7. **Branche par défaut → preferred_branch du projet pré-sélectionnée**

**Cas limites à gérer** :
- PDF scanné (image) → erreur "PDF non textuel"
- Fichier vide → erreur de validation
- Encoding bizarre → normaliser en UTF-8
- Fichier avec extension incorrecte → vérifier MIME type
- **Branche supprimée entre-temps** → erreur + refresh liste
- **Repo avec 100+ branches** → recherche/filtre dans le dropdown

---

### Tâche 3.2 — Service d'extraction de tâches

**Description** : Utiliser un LLM pour extraire les tâches du résumé.

**Input** :
- Contenu du résumé de réunion
- Contexte projet (stack, structure)

**Output** :
- Liste de tâches structurées
- Meeting.status → `completed`

**Prompt d'extraction** :

```
Tu es un assistant qui analyse des résumés de réunions pour en extraire des tâches de développement.

## Contexte projet
Stack : {detected_stack}
Structure : {structure_summary}

## Résumé de réunion
{meeting_content}

## Ta mission
Extraire toutes les tâches de développement mentionnées, qu'elles soient explicites ou implicites.

## Format de sortie (JSON)
{
  "tasks": [
    {
      "title": "Titre court et actionnable",
      "description": "Description détaillée de ce qui doit être fait",
      "type": "feature|bugfix|modification|documentation|refactor",
      "keywords": ["mot-clé", "pour", "recherche"]
    }
  ]
}

## Règles
- Une tâche = une action de développement distincte
- Ne pas inclure les tâches non-techniques (réunions, emails, etc.)
- Être précis sur le "quoi" mais pas sur le "comment" (l'analyse viendra après)
- Si aucune tâche technique détectée, retourner un tableau vide
```

**Comment tester** :
1. Résumé avec 3 features claires → 3 tâches extraites
2. Résumé avec feature + bug → types corrects
3. Résumé sans tâche technique → tableau vide
4. Résumé ambigu → tâches au mieux

**Tests avec résumés types** :

```
// Résumé 1 - Clair
"Le client veut ajouter un système de notifications par email 
quand une commande est passée. Il faudra aussi corriger le bug 
sur la page panier où le total ne se met pas à jour."

→ Attendu : 2 tâches (feature notifications, bugfix panier)

// Résumé 2 - Implicite  
"On a discuté de l'authentification. Pour l'instant c'est 
email/password mais ils voudraient du Google aussi."

→ Attendu : 1 tâche (feature OAuth Google)

// Résumé 3 - Non technique
"Prochaine réunion mardi. Le client enverra les maquettes."

→ Attendu : 0 tâches
```

**Cas limites à gérer** :
- Résumé dans une autre langue → détecter et adapter le prompt
- Résumé très long → découper en chunks si > 4000 mots
- LLM retourne un format invalide → retry avec prompt plus strict
- Rate limit API Claude → retry avec backoff

---

### Tâche 3.3 — Pré-estimation de complexité

**Description** : Avant l'analyse complète, estimer rapidement la complexité de chaque tâche.

**Input** :
- Tâche avec titre/description
- Structure projet (summary)

**Output** :
- `task.complexity` : simple | moderate | critical
- `task.impacted_files_preview` : estimation des fichiers touchés
- `task.estimated_files_count` : nombre estimé

**Logique d'estimation** (sans lire le code) :

```typescript
// Heuristiques basées sur les keywords et la structure
function estimateComplexity(task: Task, projectSummary: StructureSummary): Complexity {
  const keywords = task.keywords.join(' ').toLowerCase()
  
  // Indicateurs de complexité haute
  const criticalIndicators = [
    'authentification', 'paiement', 'base de données', 
    'migration', 'refactor global', 'architecture'
  ]
  
  // Indicateurs de simplicité
  const simpleIndicators = [
    'bouton', 'texte', 'style', 'couleur', 
    'typo', 'wording', 'affichage'
  ]
  
  // ... logique de scoring
}
```

**Comment tester** :
1. Tâche "Changer le texte du bouton" → simple
2. Tâche "Ajouter un composant de carte" → moderate
3. Tâche "Refondre le système d'auth" → critical
4. Vérifier que les estimations sont cohérentes sur 20 tâches types

**Cas limites à gérer** :
- Tâche très vague → moderate par défaut
- Tâche avec keywords contradictoires → prendre le plus haut

---

### Tâche 3.4 — Page liste des réunions & tâches

**Description** : Interface pour voir les réunions passées et leurs tâches.

**Input** :
- Project ID

**Output** :
- Page `/projects/[id]/meetings`
- Liste des réunions avec date et nombre de tâches
- Vue détaillée d'une réunion avec ses tâches
- Badges de complexité sur les tâches
- Filtres par type et complexité

**Comment tester** :
1. Aucune réunion → message vide
2. Plusieurs réunions → liste chronologique
3. Cliquer sur une réunion → voir les tâches
4. Filtrer par "feature" → seules les features visibles
5. Filtrer par "critical" → seules les critiques visibles

**Cas limites à gérer** :
- Réunion en cours de traitement → loader
- Réunion en erreur → message + retry

---

## Phase 4 — Agent d'analyse

### Description

Le cœur du système : l'agent qui explore le code et génère des plans d'implémentation. À la fin de cette phase, l'utilisateur peut lancer une analyse sur une tâche et obtenir un plan détaillé.

### Durée estimée : 6-8 jours

---

### Tâche 4.1 — Définition des outils (tools) de l'agent

**Description** : Créer les fonctions que l'agent peut appeler pour explorer le code sur une branche spécifique.

**Input** :
- Project ID (pour accès GitHub)
- Branche de référence (Meeting.reference_branch)
- Paramètres spécifiques à chaque outil

**Output** :
- Module `lib/agent/tools.ts` avec toutes les fonctions

> **Important** : Tous les outils de l'agent travaillent sur la `reference_branch` définie dans la Meeting. Cela permet d'analyser du code sur `develop`, `staging`, ou une feature branch spécifique.

**Liste des outils** :

```typescript
// Context passé à tous les outils
interface AgentContext {
  projectId: string
  owner: string
  repo: string
  branch: string // Meeting.reference_branch
  githubToken: string
}

// 1. Lister un dossier
interface ListDirectoryInput {
  path: string // ex: "src/components"
}
interface ListDirectoryOutput {
  branch: string // confirme la branche utilisée
  items: Array<{
    name: string
    type: 'file' | 'directory'
    path: string
  }>
}

// 2. Lire un fichier
interface ReadFileInput {
  path: string
  maxLines?: number // limite pour gros fichiers
}
interface ReadFileOutput {
  branch: string
  content: string
  lineCount: number
  truncated: boolean
}

// 3. Chercher dans le code
interface SearchCodeInput {
  query: string
  filePattern?: string // ex: "*.tsx"
}
interface SearchCodeOutput {
  branch: string
  matches: Array<{
    path: string
    line: number
    content: string
    context: string // lignes avant/après
  }>
}

// 4. Obtenir les imports d'un fichier
interface GetImportsInput {
  path: string
}
interface GetImportsOutput {
  branch: string
  imports: Array<{
    source: string
    specifiers: string[]
  }>
  importedBy: string[] // fichiers qui importent celui-ci
}

// 5. Obtenir la signature d'une fonction/composant
interface GetSignatureInput {
  path: string
  name: string // nom de l'export
}
interface GetSignatureOutput {
  branch: string
  signature: string
  params: Array<{ name: string, type: string }>
  returnType: string
  docComment?: string
}
```

**Comment tester** :
1. `listDirectory("src")` → retourne les dossiers/fichiers
2. `readFile("package.json")` → contenu JSON
3. `searchCode("useState")` → trouve les occurrences
4. `getImports("src/app/page.tsx")` → liste des imports
5. Fichier inexistant → erreur propre

**Cas limites à gérer** :
- Chemin inexistant → `{ error: "File not found" }`
- Fichier binaire → `{ error: "Binary file" }`
- Fichier > 500 lignes → tronquer + `truncated: true`
- Recherche sans résultat → `{ matches: [] }`
- Caractères spéciaux dans la recherche → échapper

---

### Tâche 4.2 — Configuration Claude function calling

**Description** : Configurer l'appel Claude avec les tools définis.

**Input** :
- Liste des tools au format Claude
- Prompt système
- Message utilisateur (la tâche à analyser)

**Output** :
- Module `lib/agent/claude.ts`
- Fonction `runAgentLoop()` qui gère la boucle

**Format des tools pour Claude** :

```typescript
const tools = [
  {
    name: "list_directory",
    description: "Liste le contenu d'un dossier du projet. Utilise cet outil pour comprendre la structure du projet.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Chemin relatif depuis la racine du projet, ex: 'src/components'"
        }
      },
      required: ["path"]
    }
  },
  // ... autres tools
]
```

**Comment tester** :
1. Appel simple avec une tâche → Claude utilise les tools
2. Vérifier que Claude ne hallucine pas de chemins
3. Vérifier le respect du format de sortie

**Cas limites à gérer** :
- Claude n'utilise aucun tool → forcer au moins une exploration
- Claude appelle un tool invalide → ignorer et continuer
- Paramètres invalides → retourner erreur au lieu de crasher

---

### Tâche 4.3 — Boucle d'orchestration de l'agent

**Description** : Gérer la boucle complète : prompt → tool call → résultat → prompt → ... → réponse finale.

**Input** :
- Task à analyser
- Project avec ses règles et son index
- Configuration (max iterations, max tokens)

**Output** :
- TaskAnalysis complète
- AgentLogs de chaque étape

**Algorithme** :

```
function runAgent(task, project, config) {
  context = buildInitialContext(task, project)
  messages = [{ role: 'user', content: context }]
  
  for (i = 0; i < config.maxIterations; i++) {
    response = callClaude(messages, tools)
    
    if (response.stop_reason === 'end_turn') {
      // Claude a terminé son analyse
      return parseAnalysisResult(response.content)
    }
    
    if (response.stop_reason === 'tool_use') {
      // Claude veut utiliser un outil
      toolResults = []
      for (toolCall of response.tool_calls) {
        result = executeTool(toolCall.name, toolCall.input)
        logAgentStep(toolCall, result)
        toolResults.push({ id: toolCall.id, result })
      }
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
    }
  }
  
  // Max iterations atteintes
  return { error: 'Max iterations reached', partial: extractPartialResult() }
}
```

**Paramètres de configuration** :

```typescript
interface AgentConfig {
  maxIterations: number      // 20 pour MVP
  maxTokensPerCall: number   // 4096
  maxTotalTokens: number     // 50000
  toolTimeout: number        // 10000ms
}
```

**Comment tester** :
1. Tâche simple → résolution en < 5 iterations
2. Tâche complexe → plus d'iterations mais résolution
3. Limite atteinte → retour propre avec résultat partiel
4. Vérifier les logs à chaque étape

**Cas limites à gérer** :
- Tool qui timeout → log l'erreur, continuer
- Claude répète la même action → détecter et forcer stop
- Contexte dépasse la limite → résumer les anciens résultats
- Erreur réseau → retry avec backoff (3 tentatives)

---

### Tâche 4.4 — Prompt système de l'agent

**Description** : Rédiger le prompt qui guide l'agent dans son analyse.

**Input** :
- Contexte projet (stack, structure, règles)
- Tâche à analyser

**Output** :
- Prompt système optimisé
- Template de contexte

**Structure du prompt** :

```markdown
Tu es un agent d'analyse de code expert. Tu dois analyser une tâche de développement et produire un plan d'implémentation détaillé.

## Contexte du projet

### Stack technique
{detected_stack}

### Structure du projet
{structure_summary}

### Branche de référence
Tu analyses le code sur la branche `{reference_branch}`.
Toutes tes recommandations doivent être basées sur l'état actuel de cette branche.

### Règles à respecter OBLIGATOIREMENT
{project_rules}

## Outils disponibles

Tu peux explorer le code avec ces outils (tous opèrent sur la branche `{reference_branch}`) :
- list_directory(path) : voir le contenu d'un dossier
- read_file(path) : lire le contenu d'un fichier
- search_code(query) : chercher dans tout le code
- get_imports(path) : voir les dépendances d'un fichier

## Tâche à analyser

Titre : {task_title}
Description : {task_description}
Type : {task_type}

## Ta mission

1. EXPLORE le code pour comprendre :
   - Comment des fonctionnalités similaires sont implémentées
   - Quels patterns sont utilisés
   - Quelles dépendances existent

2. IDENTIFIE précisément :
   - Les fichiers à créer (avec leur chemin complet)
   - Les fichiers à modifier (avec les lignes/sections concernées)
   - Les dépendances entre les changements

3. PRODUIS un plan d'implémentation avec :
   - Des étapes ordonnées et détaillées
   - Du pseudo-code ou des exemples quand utile
   - Les risques potentiels

## Format de sortie attendu

Quand tu as suffisamment exploré, retourne un JSON :

{
  "reference_branch": "{reference_branch}",
  "files_to_create": [
    {
      "path": "src/components/Example/Example.tsx",
      "description": "Composant principal",
      "template": "// Structure suggérée\\nexport function Example() {...}"
    }
  ],
  "files_to_modify": [
    {
      "path": "src/app/layout.tsx",
      "changes": [
        {
          "location": "ligne 15-20, après le dernier import",
          "description": "Ajouter l'import du nouveau provider",
          "before": "import { ThemeProvider } from...",
          "after": "import { ThemeProvider } from...\\nimport { ExampleProvider } from..."
        }
      ]
    }
  ],
  "implementation_steps": [
    {
      "order": 1,
      "title": "Créer le composant de base",
      "description": "Détails...",
      "files_involved": ["src/components/Example/Example.tsx"]
    }
  ],
  "risks": [
    {
      "description": "Impact potentiel sur les performances si...",
      "mitigation": "S'assurer de mémoïser avec useMemo"
    }
  ],
  "dependencies": ["Aucune dépendance npm à ajouter"]
}

## Règles importantes

- JAMAIS inventer un chemin de fichier, toujours vérifier avec list_directory
- TOUJOURS regarder le code existant avant de proposer un pattern
- RESPECTER les règles du projet même si tu ferais différemment
- Être PRÉCIS sur les numéros de ligne et les emplacements
- Si tu ne trouves pas d'info après 3 tentatives, passer au suivant
- Te rappeler que tu travailles sur la branche `{reference_branch}`, pas forcément main
```

**Comment tester** :
1. Tester le prompt avec différentes tâches
2. Vérifier que l'agent explore avant de conclure
3. Vérifier que les règles sont respectées
4. Vérifier la qualité du JSON de sortie

**Itérations attendues** :
Ce prompt sera affiné au fil des tests. Prévoir 2-3 itérations.

---

### Tâche 4.5 — Parsing et stockage du résultat

**Description** : Parser le JSON de l'agent et le stocker en base.

**Input** :
- Réponse JSON de l'agent
- Task ID

**Output** :
- TaskAnalysis créée en base
- Task.status → `analyzed`

**Validation du JSON** :

```typescript
const analysisResultSchema = z.object({
  files_to_create: z.array(z.object({
    path: z.string(),
    description: z.string(),
    template: z.string().optional()
  })),
  files_to_modify: z.array(z.object({
    path: z.string(),
    changes: z.array(z.object({
      location: z.string(),
      description: z.string(),
      before: z.string().optional(),
      after: z.string().optional()
    }))
  })),
  implementation_steps: z.array(z.object({
    order: z.number(),
    title: z.string(),
    description: z.string(),
    files_involved: z.array(z.string())
  })),
  risks: z.array(z.object({
    description: z.string(),
    mitigation: z.string().optional()
  })).optional(),
  dependencies: z.array(z.string()).optional()
})
```

**Comment tester** :
1. JSON valide → TaskAnalysis créée
2. JSON invalide → TaskAnalysis avec status `failed` + error
3. JSON partiel (max iterations) → stocker ce qu'on a

**Cas limites à gérer** :
- JSON malformé → log + retry prompt "reformate en JSON valide"
- Champs manquants → utiliser valeurs par défaut
- JSON trop gros pour la colonne → tronquer les templates

---

### Tâche 4.6 — Interface de lancement et résultat d'analyse

**Description** : UI pour lancer une analyse et voir le résultat.

**Input** :
- Task ID

**Output** :
- Bouton "Analyser" sur chaque tâche
- Vue en temps réel de la progression (logs)
- Affichage formaté du résultat

**Composants** :

```
TaskCard
├── Header (titre, type, complexité)
├── Description
├── Actions
│   ├── [Analyser] → lance l'agent
│   └── [Exporter] → (désactivé si non analysé)
└── AnalysisResult (si analysé)
    ├── FilesToCreate (liste expandable)
    ├── FilesToModify (liste expandable avec diff preview)
    ├── Steps (timeline)
    └── Risks (warnings)
```

**Comment tester** :
1. Cliquer Analyser → loader + logs en temps réel
2. Analyse terminée → résultat affiché
3. Re-cliquer Analyser → demande confirmation (écrase)
4. Résultat avec beaucoup de fichiers → accordéons fonctionnels

**Cas limites à gérer** :
- Analyse très longue (>2min) → timeout avec message
- Analyse qui échoue → message d'erreur + retry
- User quitte la page → analyse continue, résultat visible au retour

---

## Phase 5 — Dashboard & Interface

### Description

Finaliser l'interface utilisateur pour une expérience fluide. Optimisations UX, états de chargement, gestion d'erreurs.

### Durée estimée : 3-4 jours

---

### Tâche 5.1 — Dashboard récapitulatif

**Description** : Page d'accueil avec vue d'ensemble des projets et tâches.

**Input** :
- Tous les projets de l'utilisateur
- Tâches récentes

**Output** :
- Page `/dashboard` avec :
  - Cards projets (nom, status, nb tâches pending)
  - Liste des tâches récentes (toutes projets confondus)
  - Actions rapides

**Comment tester** :
1. 0 projets → CTA "Ajouter un projet"
2. Plusieurs projets → cards triées par activité
3. Clic sur projet → navigation vers projet

---

### Tâche 5.2 — États de chargement et squelettes

**Description** : Ajouter des loading states cohérents partout.

**Input** :
- Toutes les pages/composants avec data fetching

**Output** :
- Skeleton loaders pour chaque type de contenu
- Transitions fluides

**Composants skeleton à créer** :
- `ProjectCardSkeleton`
- `TaskCardSkeleton`
- `AnalysisResultSkeleton`
- `TreeViewSkeleton`

**Comment tester** :
1. Throttle réseau à "Slow 3G" → skeletons visibles
2. Pas de flash de contenu vide
3. Skeletons ont les bonnes dimensions

---

### Tâche 5.3 — Gestion d'erreurs globale

**Description** : Error boundaries et messages d'erreur utilisateur.

**Input** :
- Tous les points d'erreur possibles

**Output** :
- Error boundary React au niveau layout
- Toast pour erreurs non-bloquantes
- Pages d'erreur pour erreurs critiques
- Retry automatique pour erreurs réseau

**Comment tester** :
1. Erreur API → toast affiché
2. Erreur critique → page erreur avec retry
3. Réseau coupé → message + retry auto quand reconnecté

---

### Tâche 5.4 — Responsive et mobile

**Description** : Adapter l'interface pour mobile/tablet.

**Input** :
- Design desktop actuel

**Output** :
- Sidebar collapsible sur mobile
- Cards empilées
- Modales full-screen sur petit écran

**Breakpoints** :
- Mobile : < 640px
- Tablet : 640px - 1024px
- Desktop : > 1024px

**Comment tester** :
1. Resize navigateur → layout s'adapte
2. Test sur iPhone/Android réel
3. Touch targets > 44px

---

## Phase 6 — Export des tâches

### Description

Permettre l'export des tâches analysées vers GitHub Issues. Les autres intégrations (Notion, Jira) seront ajoutées post-MVP.

### Durée estimée : 2-3 jours

---

### Tâche 6.1 — Génération du contenu d'issue

**Description** : Transformer une TaskAnalysis en contenu Markdown pour GitHub.

**Input** :
- TaskAnalysis complète

**Output** :
- Markdown formaté prêt pour GitHub Issue

**Template Markdown** :

```markdown
## Description

{task_description}

## Plan d'implémentation

### Fichiers à créer

{files_to_create.map(f => `- \`${f.path}\` : ${f.description}`)}

### Fichiers à modifier

{files_to_modify.map(f => `
#### \`${f.path}\`
${f.changes.map(c => `- ${c.location} : ${c.description}`)}
`)}

### Étapes

{implementation_steps.map(s => `${s.order}. **${s.title}**\n   ${s.description}`)}

## Risques identifiés

{risks.map(r => `- ⚠️ ${r.description}`)}

---
*Généré par Meeting Task Agent*
```

**Comment tester** :
1. Générer le markdown → preview correct
2. Coller dans GitHub → rendu correct
3. Cas avec beaucoup de fichiers → reste lisible

---

### Tâche 6.2 — Création d'issue GitHub via API

**Description** : Appeler l'API GitHub pour créer l'issue.

**Input** :
- Project (pour repo info + token)
- Contenu Markdown généré
- Labels optionnels

**Output** :
- Issue créée sur GitHub
- TaskExport créée en base avec l'URL

**Endpoint GitHub** :
```
POST /repos/{owner}/{repo}/issues
{
  "title": "{task_title}",
  "body": "{markdown_content}",
  "labels": ["from-meeting-agent", "{task_type}"]
}
```

**Comment tester** :
1. Créer une issue → apparaît sur GitHub
2. Vérifier le formatage sur GitHub
3. Lien retourné → cliquable et correct

**Cas limites à gérer** :
- Token expiré → erreur + demander reconnexion
- Repo archivé → erreur claire
- Issue déjà exportée → warning + demander confirmation
- Labels inexistants → les créer ou ignorer

---

### Tâche 6.3 — Interface d'export

**Description** : UI pour exporter une tâche analysée.

**Input** :
- Task avec son analyse

**Output** :
- Bouton "Exporter vers GitHub"
- Modal de prévisualisation
- Confirmation avec lien vers l'issue créée

**Flow** :
1. Clic "Exporter" → modal s'ouvre
2. Preview du markdown → user peut éditer
3. Clic "Créer l'issue" → loading
4. Succès → lien vers l'issue + fermer modal
5. L'issue est marquée comme exportée (badge)

**Comment tester** :
1. Export réussi → issue visible sur GitHub
2. Modifier le markdown avant export → modifications prises en compte
3. Exporter 2 fois → 2 issues créées (avec warning)
4. Annuler → rien créé

---

## Phase 7 — Finalisation MVP

### Description

Tests, documentation, déploiement. Préparer le produit pour les premiers utilisateurs.

### Durée estimée : 2-3 jours

---

### Tâche 7.1 — Tests end-to-end

**Description** : Écrire des tests E2E pour les parcours critiques.

**Parcours à tester** :
1. Inscription → ajout projet → indexation
2. Import réunion → extraction tâches
3. Analyse d'une tâche → résultat cohérent
4. Export vers GitHub → issue créée

**Stack recommandée** : Playwright

**Comment valider** :
- Tous les tests passent en CI
- Temps total < 5 minutes

---

### Tâche 7.2 — Documentation utilisateur

**Description** : Créer une documentation minimale pour les premiers users.

**Contenu** :
- Guide de démarrage rapide
- FAQ
- Limites connues

**Format** : Pages dans l'app ou Notion public

---

### Tâche 7.3 — Déploiement production

**Description** : Déployer sur Vercel + configurer la prod.

**Checklist** :
- [ ] Variables d'environnement production
- [ ] Base de données production (Neon, Supabase, ou Railway)
- [ ] Domaine personnalisé
- [ ] GitHub OAuth App production (callback URL)
- [ ] Monitoring basique (Vercel Analytics)
- [ ] Rate limiting API

**Comment valider** :
- App accessible sur le domaine
- Inscription fonctionne
- Pas d'erreurs dans les logs

---

### Tâche 7.4 — Beta privée

**Description** : Inviter 5-10 utilisateurs beta.

**Actions** :
- Créer un système d'invitation (ou whitelist email)
- Préparer un formulaire de feedback
- Canal de support (email ou Discord)

---

## Récapitulatif des phases

| Phase | Description | Durée | Jours cumulés |
|-------|-------------|-------|---------------|
| 1 | Fondations | 2-3j | 3 |
| 2 | GitHub & Indexation | 4-5j | 8 |
| 3 | Import & Parsing | 3-4j | 12 |
| 4 | Agent d'analyse | 6-8j | 20 |
| 5 | Dashboard & UI | 3-4j | 24 |
| 6 | Export | 2-3j | 27 |
| 7 | Finalisation | 2-3j | 30 |

**Total estimé : 4-5 semaines** pour un développeur à temps plein.

---

## Prochaines étapes post-MVP

1. **Intégrations supplémentaires** : Notion, Jira, Linear
2. **Webhook** : connexion directe avec outils de transcription
3. **Multi-repo** : gérer plusieurs repos par projet
4. **Historique** : comparer les analyses dans le temps
5. **Collaboration** : partage de projets entre utilisateurs
