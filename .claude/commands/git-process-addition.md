--
description: Automate git add and commit for modified/untracked files, grouped by type of change.
--

## Command Name

`git-auto-commit`

## Description

This command automates the following workflow:

1. Ensure the project builds successfully (e.g. `pnpm build` for Next.js).
2. List all modified/untracked files that have not yet been pushed to the remote repository.
3. Group files by type of change (`feat`, `fix`, `hotfix`, `refactor`, etc.).
4. Run `git add` and `git commit` for each group, following conventional commit messages.
5. ⚠️ **Never run `git push`**. Pushing remains a manual step.

## Detailed Instructions

1. **Check the build:**

   ```bash
   pnpm build
   ```

   • If the build fails → stop the process, display the error, and do not commit anything.

2. List files to commit:

   ```bash
   git status --porcelain
   ```

3. Analyze changes and group by type:
   • New feature → feat: description
   • Bug fix → fix: description
   • Urgent bug fix → hotfix: description
   • Code improvement without functional change → refactor: description
   • Other types if needed (style, chore, docs, test, …).

4. Create commits:
   For each detected type:

```bash
git add <list_of_files>
git commit -m "feat: clear description"
```

Example:

```bash
git add src/components/Button.tsx src/pages/index.tsx
git commit -m "feat: add new reusable Button component and update homepage"
```

5. Never push automatically.
   • Pushing to the remote must always be handled manually.

Example Flow

```bash
pnpm build
# ✅ build success

git add src/pages/dashboard.tsx
git commit -m "feat: add dashboard page"

git add src/components/Navbar.tsx
git commit -m "fix: correct navbar responsive behavior"
```

## Critical Rules

⚠️ **NEVER mention AI or Claude Code in commits:**
- Do NOT add "Generated with Claude Code" or similar
- Do NOT add "Co-Authored-By: Claude" or any AI co-author
- Commits must appear as if written by a human developer
- No emojis like 🤖 that suggest AI involvement

## Notes

• Always check compilation before committing.
• Always follow conventional commit standards (type: description).
• One commit per type of detected modification.
• Never push automatically.
• Never mention AI, Claude, or any automated tool in commit messages.
