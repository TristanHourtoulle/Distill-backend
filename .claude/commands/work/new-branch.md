# New Branch

Crée une nouvelle branche Git avec le bon nommage pour une tâche spécifique.

## Utilisation

```
/new-branch [numéro de tâche ou description]
```

Exemples :
- `/new-branch 1.3` → Crée `feature/1.3-betterauth-setup`
- `/new-branch 2.1` → Crée `feature/2.1-github-client`
- `/new-branch fix validation projet` → Crée `fix/validation-projet`

## Instructions

### Étape 1 : Analyser l'argument

Argument reçu : $ARGUMENTS

**Si c'est un numéro de tâche (ex: 1.3, 2.1, 4.3) :**
1. Lis `docs/guideline/MVP Specifications Claude.md`
2. Trouve le titre de la tâche correspondante
3. Génère un nom de branche descriptif

**Si c'est une description libre :**
1. Détermine le type (feature, fix, refactor)
2. Convertis en kebab-case

### Étape 2 : Vérifier l'état Git

```bash
# Vérifier s'il y a des changements non commités
git status --porcelain
```

**Si des changements existent :**
```
⚠️ Tu as des changements non commités !

Fichiers modifiés :
- [liste]

Options :
1. Commit d'abord : git add . && git commit -m "message"
2. Stash : git stash
3. Annuler : git checkout .

Que veux-tu faire ?
```

### Étape 3 : Créer la branche

```bash
# S'assurer d'être à jour sur main
git checkout main
git pull origin main

# Créer et basculer sur la nouvelle branche
git checkout -b [nom-branche]
```

### Étape 4 : Confirmer

```
✅ Branche créée avec succès !

🌿 Nouvelle branche : feature/1.3-betterauth-setup
📋 Tâche associée  : 1.3 — Authentification BetterAuth

Tu peux maintenant lancer /next-task pour commencer le développement.
```

## Convention de nommage

| Type | Format | Exemple |
|------|--------|---------|
| Nouvelle fonctionnalité | `feature/[tâche]-[description]` | `feature/1.3-betterauth-setup` |
| Correction de bug | `fix/[description]` | `fix/project-validation` |
| Refactoring | `refactor/[description]` | `refactor/github-service` |
| Documentation | `docs/[description]` | `docs/api-endpoints` |
| Tests | `test/[description]` | `test/agent-tools` |

## Règles

- Toujours en **kebab-case** (minuscules, tirets)
- Pas d'espaces, pas de caractères spéciaux
- Court mais descriptif (max ~50 caractères)
- Préfixer avec le numéro de tâche si applicable
