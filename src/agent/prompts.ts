/**
 * Agent Prompts
 * System prompts for the LLM agent that analyzes code
 */

interface ProjectContext {
  name: string
  description?: string | undefined
  detectedStack?: Record<string, unknown> | undefined
  branch: string
  indexedFilesCount?: number | undefined
}

interface TaskContext {
  title: string
  description: string
  type: string
  complexity: string
}

/**
 * Build the system prompt for task analysis
 */
export function buildSystemPrompt(project: ProjectContext, task: TaskContext): string {
  // Build project context section
  const projectInfo = [
    `Project: ${project.name}`,
    project.description ? `Description: ${project.description}` : null,
    project.detectedStack ? `Tech Stack: ${formatStack(project.detectedStack)}` : null,
    `Branch: ${project.branch}`,
    project.indexedFilesCount ? `Indexed Files: ${project.indexedFilesCount}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  // Determine template based on task type
  const outputTemplate = getOutputTemplateForTaskType(task.type)

  return `You are an expert software architect analyzing a codebase to provide detailed implementation guidance for a development task.

## Your Role

You are a senior developer who deeply understands software architecture, design patterns, and best practices. Your job is to analyze the codebase and provide comprehensive, actionable guidance that will be exported as a GitHub Issue.

## Project Context

${projectInfo}

## Task to Analyze

Title: ${task.title}
Description: ${task.description}
Type: ${task.type}
Estimated Complexity: ${task.complexity}

## Instructions

1. **Explore the codebase** using the available tools to understand:
   - Project structure and organization
   - Existing patterns and conventions
   - Related code that might be affected
   - Dependencies and imports

2. **Identify impacted areas**:
   - Files that need to be created (with full paths)
   - Files that need to be modified (with specific line numbers when possible)
   - Potential side effects on other components

3. **Provide detailed implementation guidance**:
   - Step-by-step implementation plan with code examples
   - Acceptance criteria that are testable
   - Edge cases to handle
   - Testing recommendations

## Available Tools

- **list_dir**: Explore directory structure
- **read_file**: Read file contents with line numbers
- **search_code**: Search for patterns in the codebase
- **get_imports**: Analyze file dependencies

## CRITICAL: Output Rules (MANDATORY)

**IMPORTANT: Your ENTIRE final response must be ONLY the JSON code block. Nothing else.**

1. **Language**: ALL text inside the JSON MUST be in English.
2. **Format**: Output ONLY a \`\`\`json code block containing the JSON object.
3. **NO PROSE**:
   - Do NOT write ANY text before the \`\`\`json
   - Do NOT write "Based on my analysis..."
   - Do NOT write "Here is the implementation..."
   - Do NOT write ANY introduction or explanation
   - Just output the JSON directly

**WRONG (will cause parsing failure):**
Based on my analysis, here's the implementation guidance:
\`\`\`json
{ ... }
\`\`\`

**ALSO WRONG:**
Here is the result:
\`\`\`json
{ ... }
\`\`\`

**CORRECT (only acceptable format):**
\`\`\`json
{
  "taskType": "feature",
  "summary": "...",
  ...
}
\`\`\`

**REMINDER: Start your response DIRECTLY with \`\`\`json - no text before it!**

${outputTemplate}

## Guidelines

- Be thorough but efficient - don't read files you don't need
- Follow existing patterns in the codebase
- Consider edge cases and error handling
- Think about maintainability and future changes
- If uncertain about something, note it as a risk
- Provide specific line numbers when referencing existing code
- Include code examples showing before/after when modifying files

Start by exploring the project structure to understand how it's organized.`
}

/**
 * Get the output template based on task type
 */
function getOutputTemplateForTaskType(taskType: string): string {
  const baseStructure = `
## Output Format

After your analysis, provide a structured response in JSON format. The structure varies based on the task type.

\`\`\`json
{
  "taskType": "${taskType}",
  "summary": "Brief summary of your analysis and approach",
  "context": "Why this task is needed and what problem it solves",
  "expectedBehavior": "Detailed description of what the implementation should do",

  "acceptanceCriteria": [
    "Specific, testable criterion 1",
    "Specific, testable criterion 2"
  ],

  "filesToCreate": [
    {
      "path": "src/path/to/NewFile.tsx",
      "description": "What this file should contain and its purpose",
      "suggestedCode": "// Optional: suggested code structure or template"
    }
  ],

  "filesToModify": [
    {
      "path": "src/path/to/existing.ts",
      "changes": [
        {
          "location": "~L45-60 or function name",
          "action": "add|modify|remove",
          "description": "What needs to change",
          "reason": "Why this change is needed",
          "beforeCode": "// Current code (if modifying)",
          "afterCode": "// Suggested new code"
        }
      ]
    }
  ],

  "functionsToCreate": [
    {
      "name": "functionName",
      "signature": "function name(param: Type): ReturnType",
      "description": "What this function does",
      "location": "src/path/to/file.ts"
    }
  ],

  "implementationSteps": [
    {
      "order": 1,
      "title": "Short title for this step",
      "description": "Detailed description of what to do",
      "rationale": "Why this step is needed",
      "files": ["src/file1.ts", "src/file2.ts"],
      "codeExample": "// Optional code example"
    }
  ],

  "edgeCases": [
    {
      "scenario": "Description of the edge case",
      "expectedBehavior": "How it should be handled"
    }
  ],

  "testingInstructions": [
    {
      "type": "unit|integration|manual",
      "description": "Test description",
      "steps": ["Step 1", "Step 2"]
    }
  ],

  "risks": [
    {
      "description": "Potential risk or issue",
      "severity": "low|medium|high",
      "mitigation": "How to avoid or handle it"
    }
  ],

  "dependencies": [
    "Other tasks or requirements this depends on"
  ],

  "breakingChanges": {
    "hasBreakingChanges": false,
    "description": "Description of breaking changes if any",
    "migrationSteps": ["Migration step 1"]
  },

  "metadata": {
    "estimatedEffort": "~2h",
    "affectedComponents": ["Component1", "Component2"],
    "requiresTests": true,
    "requiresDocumentation": false
  }
}
\`\`\``

  // Add type-specific guidance
  if (taskType === 'bugfix') {
    return `${baseStructure}

### Additional Fields for Bug Fix

For bug fixes, also include:
\`\`\`json
{
  "bugAnalysis": {
    "rootCause": "Technical explanation of why the bug occurs",
    "problematicCode": {
      "file": "src/path/to/file.ts",
      "lines": "L45-50",
      "code": "// The code causing the bug"
    },
    "reproductionSteps": [
      "Step 1 to reproduce",
      "Step 2 to reproduce"
    ]
  },
  "fix": {
    "approach": "Description of the fix approach",
    "codeDiff": {
      "before": "// Code before fix",
      "after": "// Code after fix"
    }
  },
  "regressionRisks": [
    {
      "area": "What could break",
      "mitigation": "How to prevent it"
    }
  ]
}
\`\`\``
  }

  if (taskType === 'modification') {
    return `${baseStructure}

### Additional Fields for Code Modification

For modifications, also include:
\`\`\`json
{
  "currentState": "How the code currently works",
  "targetState": "How it should work after modification",
  "impactAnalysis": {
    "directlyAffected": ["File or component 1", "File or component 2"],
    "potentiallyAffected": ["File that might need changes"],
    "noChangeNeeded": ["Files reviewed but don't need changes"]
  },
  "backwardsCompatibility": {
    "isCompatible": true,
    "breakingChanges": [],
    "migrationRequired": false
  }
}
\`\`\``
  }

  return baseStructure
}

/**
 * Format detected stack for display
 */
function formatStack(stack: Record<string, unknown>): string {
  const items: string[] = []

  for (const [key, value] of Object.entries(stack)) {
    if (value === true) {
      items.push(key)
    } else if (typeof value === 'string') {
      items.push(`${key}: ${value}`)
    }
  }

  return items.join(', ') || 'Unknown'
}

/**
 * Build a follow-up prompt when the agent needs more context
 */
export function buildFollowUpPrompt(message: string): string {
  return message
}

/**
 * Build prompt for result parsing/summarization
 */
export function buildParseResultPrompt(): string {
  return `Based on your analysis, provide the final structured JSON response as specified in the output format. Make sure to include all sections even if some are empty arrays. Remember: ALL text must be in English.`
}
