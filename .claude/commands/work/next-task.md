# Next Task

Analyse l'état actuel du projet et exécute la prochaine tâche du MVP.

## Instructions

### Étape 0 : Vérifier la branche Git

**AVANT TOUTE CHOSE**, vérifie la branche actuelle :

```bash
git branch --show-current
```

**Règles obligatoires :**

1. **JAMAIS coder sur `main` ou `master`** — Ces branches sont protégées
2. **JAMAIS coder sur `prod` ou `production`** — Environnement de production
3. **JAMAIS coder sur `staging`** — Environnement de pré-production

**Si tu es sur une branche interdite :**
```
⛔ STOP — Tu es sur la branche `main` !

Je ne peux pas coder directement sur cette branche.

Action requise :
1. Crée une nouvelle branche pour la tâche : git checkout -b feature/[nom-tâche]
2. Relance /next-task

Suggestion de nom de branche basé sur la prochaine tâche :
→ git checkout -b feature/1.3-betterauth-setup
```

**Vérifier que la branche correspond à la tâche :**

Si la branche actuelle est par exemple `feature/2.1-github-client` mais que la prochaine tâche est `1.3 - Auth BetterAuth`, signale l'incohérence :

```
⚠️ Incohérence branche/tâche détectée

Branche actuelle : feature/2.1-github-client
Prochaine tâche  : 1.3 — Auth BetterAuth

Options :
1. Changer de branche : git checkout -b feature/1.3-betterauth-setup
2. Continuer sur cette branche (si c'est volontaire)

Que veux-tu faire ?
```

**Convention de nommage des branches :**
```
feature/[numéro-tâche]-[description-courte]

Exemples :
- feature/1.3-betterauth-setup
- feature/2.1-github-client
- feature/4.3-agent-orchestrator
- fix/2.2-project-validation
- refactor/3.1-meeting-service
```

---

### Étape 1 : Lire la documentation

Lis attentivement ces fichiers dans l'ordre :
1. `CLAUDE.md` — Les règles du projet à respecter absolument
2. `docs/guideline/MVP Specifications Claude.md` — Le plan de développement complet
3. `docs/guideline/Schéma de base de données.mermaid` — L'architecture des données
4. `PROGRESS.md` — L'état actuel d'avancement (si existe)

### Étape 2 : Analyser l'état du projet

Vérifie ce qui est déjà implémenté en analysant :

**Phase 1 — Fondations :**
- [ ] `package.json` existe avec les bonnes dépendances (hono, prisma, zod, typescript)
- [ ] `tsconfig.json` configuré en strict mode
- [ ] Structure de dossiers créée (`src/routes`, `src/services`, `src/lib`, etc.)
- [ ] `prisma/schema.prisma` avec tous les modèles du schéma BDD
- [ ] `src/index.ts` point d'entrée Hono fonctionnel
- [ ] `src/lib/db.ts` client Prisma configuré

**Phase 1.3 — Auth :**
- [ ] `src/lib/auth.ts` BetterAuth configuré
- [ ] `src/routes/auth.routes.ts` routes montées
- [ ] `src/lib/encryption.ts` chiffrement des tokens
- [ ] Tables BetterAuth dans le schema Prisma

**Phase 2 — GitHub & Indexation :**
- [ ] `src/services/github.service.ts` avec listRepos, listBranches, getTree, getFileContent
- [ ] `src/routes/github.routes.ts` proxy endpoints
- [ ] `src/routes/projects.routes.ts` CRUD complet
- [ ] `src/services/project.service.ts` logique métier
- [ ] `src/services/indexer.service.ts` indexation repos

**Phase 3 — Meetings & Tasks :**
- [ ] `src/routes/meetings.routes.ts` CRUD
- [ ] `src/services/meeting.service.ts`
- [ ] `src/services/parser.service.ts` extraction tâches via LLM
- [ ] `src/routes/tasks.routes.ts`

**Phase 4 — Agent :**
- [ ] `src/agent/tools/*.ts` les 4 outils (list_directory, read_file, search_code, get_imports)
- [ ] `src/agent/orchestrator.ts` boucle agent
- [ ] `src/agent/prompts.ts` prompts système
- [ ] `src/lib/claude.ts` client Anthropic
- [ ] `src/routes/agent.routes.ts` endpoints analyse

**Phase 5 — Export :**
- [ ] `src/services/export.service.ts` création issues GitHub

### Étape 3 : Identifier la prochaine tâche

En fonction de ton analyse, identifie LA PROCHAINE tâche non complétée dans l'ordre du MVP.

L'ordre de priorité est :
1. Phase 1 (Fondations) doit être 100% complète avant Phase 2
2. Phase 1.3 (Auth) doit être complète avant les routes protégées
3. Phase 2 (GitHub) doit être complète avant Phase 3
4. Etc.

### Étape 4 : Exécuter la tâche

Une fois la tâche identifiée :

1. **Annonce** ce que tu vas faire :
   ```
   📋 Prochaine tâche : [Nom de la tâche]
   📁 Fichiers concernés : [liste]
   📝 Description : [résumé]
   ```

2. **Implémente** la tâche en respectant :
   - Les conventions de CLAUDE.md
   - Les spécifications de MVP Specifications
   - Les patterns déjà en place dans le projet

3. **Teste** si possible :
   - Vérifie que TypeScript compile (`pnpm type-check`)
   - Vérifie que le linter passe (`pnpm lint`)

4. **Mets à jour** `PROGRESS.md` avec :
   - La tâche complétée
   - La date
   - Les fichiers créés/modifiés

### Étape 5 : Résumé

Termine par un résumé :
```
✅ Tâche complétée : [Nom]
📁 Fichiers créés : [liste]
📁 Fichiers modifiés : [liste]

🔜 Prochaine tâche suggérée : [Nom de la suivante]
```

## Règles importantes

- **JAMAIS sur main/master/prod/staging** — toujours sur une feature branch
- **Vérifier la branche** — elle doit correspondre à la tâche
- **Une seule tâche par exécution** — ne fais pas plusieurs tâches à la fois
- **Respecte l'ordre** — ne saute pas d'étapes
- **Qualité > Vitesse** — mieux vaut une tâche bien faite que plusieurs bâclées
- **Teste toujours** — vérifie que ça compile avant de dire que c'est fait
