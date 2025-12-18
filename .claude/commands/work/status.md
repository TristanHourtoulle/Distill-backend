# Project Status

Affiche l'état actuel du projet sans exécuter de tâche.

## Instructions

### Étape 0 : Vérifier la branche Git

```bash
git branch --show-current
```

Affiche la branche actuelle et vérifie si elle est appropriée.

### Étape 1 : Lire le progress

Lis le fichier `PROGRESS.md` pour voir l'état déclaré.

### Étape 2 : Vérifier la réalité

Analyse les fichiers existants pour vérifier que l'état déclaré correspond à la réalité :

```
src/
├── index.ts          → Point d'entrée existe ?
├── routes/           → Quelles routes existent ?
├── services/         → Quels services existent ?
├── lib/              → db.ts, auth.ts, claude.ts existent ?
├── middlewares/      → Quels middlewares ?
├── agent/            → Tools et orchestrator ?
└── schemas/          → Quels schemas Zod ?
```

### Étape 3 : Générer le rapport

Affiche un rapport structuré :

```
📊 DISTILL API — STATUS REPORT
══════════════════════════════

🌿 Branche actuelle : [nom-branche]
   └─ ✅ OK / ⛔ ATTENTION: branche protégée !

🏗️  Phase actuelle : [Phase X]
📅 Dernière update : [Date]

✅ Complété :
   - [Liste des tâches complétées]

🚧 En cours :
   - [Tâche actuelle si applicable]

⏳ À faire (prochaines) :
   - [3 prochaines tâches]

📁 Structure actuelle :
   src/
   ├── [fichiers existants]
   └── ...

⚠️  Problèmes détectés :
   - [Si incohérence entre PROGRESS.md et fichiers réels]
   - [Si branche ne correspond pas à la tâche en cours]

🔜 Prochaine action suggérée :
   [Suggestion contextuelle]
```

### Étape 4 : Corriger si nécessaire

Si tu détectes des incohérences entre `PROGRESS.md` et l'état réel du projet :
1. Signale-les clairement
2. Propose de mettre à jour `PROGRESS.md`
3. Ne modifie PAS automatiquement sans confirmation

## Notes

Cette commande est en **lecture seule** — elle ne modifie rien, elle analyse seulement.
