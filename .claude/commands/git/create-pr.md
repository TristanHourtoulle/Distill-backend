# Create Pull Request

Create a professional Pull Request from the current branch to the target branch.

## Arguments

- `$ARGUMENTS` - Target branch for the PR (e.g., `staging`, `main`, `develop`)

## Instructions

You are creating a Pull Request. Follow these rules strictly:

### Critical Rules

1. **NEVER mention AI, Claude, Claude Code, or any AI-related terms** in:
   - PR title
   - PR description
   - Any commits
   - Co-authored-by lines

2. **NEVER auto-merge or approve the PR** - only create it

3. **Use professional, human-written style** - the PR should look like it was written by a developer

### Process

1. **Analyze the current branch:**
   ```bash
   git branch --show-current
   git log --oneline <target-branch>..HEAD
   git diff <target-branch>...HEAD --stat
   ```

2. **Understand the changes:**
   - Count files changed
   - Identify main areas affected
   - Categorize changes (feat, fix, refactor, docs, etc.)
   - List key improvements and bug fixes

3. **Generate PR content following this template:**

   **Title format:** `<type>: <concise description>`
   - Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `perf`, `test`
   - Use imperative mood ("Add feature" not "Added feature")
   - Keep under 72 characters

   **Body template:**
   ```markdown
   ## Summary

   [2-3 sentences explaining what this PR does and why]

   ## Type of Change

   - [ ] Feature
   - [ ] Bug Fix
   - [ ] Refactoring
   - [ ] Documentation
   - [ ] Performance
   - [ ] Other

   ## Changes Overview

   ### [Category 1]
   - Change 1
   - Change 2

   ### [Category 2]
   - Change 3
   - Change 4

   ## Technical Details

   **Files Changed:** ~X files
   **Main Areas:**
   - `path/to/area1/`: Description
   - `path/to/area2/`: Description

   ## Testing

   - [ ] Tested locally
   - [ ] No regression in existing features

   ## Breaking Changes

   [None / List any breaking changes]

   ## Deployment Notes

   [Any special deployment instructions or "No special steps required"]
   ```

4. **Create the PR:**
   ```bash
   gh pr create --base <target-branch> --title "<title>" --body "$(cat <<'EOF'
   <body content>
   EOF
   )"
   ```

5. **Report the PR URL** to the user

### Quality Guidelines

- **Be concise**: Don't over-explain, focus on the "what" and "why"
- **Be specific**: Use actual file paths and component names
- **Be honest**: Only check boxes for things actually done
- **Group related changes**: Organize by feature or area, not by file
- **Highlight important changes**: Bug fixes, breaking changes, new features first

### Example Output

After creating the PR, respond with:

```
Pull Request created successfully!

**PR #XX**: <URL>

- **Title**: <title>
- **Base**: <target-branch>
- **Source**: <current-branch>
- **Status**: Ready for review

You can review and merge when ready.
```

## Target Branch

The target branch for this PR is: `$ARGUMENTS`

If no target branch is provided, ask the user which branch they want to target.
