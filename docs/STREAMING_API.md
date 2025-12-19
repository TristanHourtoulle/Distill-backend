# Streaming Analysis API

Real-time streaming of AI analysis progress using Server-Sent Events (SSE).

## Endpoint

```
GET /agent/analyze/:taskId/stream
```

### Headers
```
Authorization: Bearer <token>
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeToolResults` | boolean | `true` | Include tool execution results |
| `includeThinking` | boolean | `false` | Include AI thinking content |

## Event Types

### `phase`
Indicates the current analysis phase.

```typescript
interface PhaseEvent {
  type: 'phase'
  timestamp: number
  phase: 'initializing' | 'loading' | 'exploring' | 'analyzing' | 'tool_execution' | 'synthesizing' | 'parsing' | 'saving' | 'complete' | 'error'
  message: string
  analysisId?: string
}
```

**Phase descriptions:**
- `initializing` - Starting the analysis
- `loading` - Loading task and project data from database
- `exploring` - AI is exploring the codebase structure
- `analyzing` - AI is analyzing code and reasoning
- `tool_execution` - Executing a specific tool (list_dir, read_file, etc.)
- `synthesizing` - AI has finished exploring and is preparing its final response
- `parsing` - Processing the AI's response into structured data
- `saving` - Saving results to database
- `complete` - Analysis finished successfully
- `error` - An error occurred

### `tool_call`
Emitted when the AI calls a tool to explore the codebase.

```typescript
interface ToolCallEvent {
  type: 'tool_call'
  timestamp: number
  tool: 'list_dir' | 'read_file' | 'search_code' | 'get_imports'
  input: Record<string, unknown>
  description: string  // Human-readable description
  analysisId?: string
}
```

### `tool_result`
Result of a tool execution.

```typescript
interface ToolResultEvent {
  type: 'tool_result'
  timestamp: number
  tool: string
  success: boolean
  summary: string  // e.g., "Found 15 files and 3 directories"
  durationMs: number
  analysisId?: string
}
```

### `thinking`
AI's reasoning content (only if `includeThinking=true`).

```typescript
interface ThinkingEvent {
  type: 'thinking'
  timestamp: number
  content: string
  isPartial: boolean
  analysisId?: string
}
```

### `progress`
Progress statistics update.

```typescript
interface ProgressEvent {
  type: 'progress'
  timestamp: number
  iteration: number
  toolCalls: number
  tokensUsed: { input: number; output: number }
  durationMs: number
  analysisId?: string
}
```

### `file_discovered`
When a file to create/modify is identified.

```typescript
interface FileDiscoveredEvent {
  type: 'file_discovered'
  timestamp: number
  action: 'create' | 'modify'
  path: string
  description?: string
  analysisId?: string
}
```

### `result`
Final analysis result.

```typescript
interface ResultEvent {
  type: 'result'
  timestamp: number
  analysisId: string
  summary: string
  stats: {
    iterations: number
    toolCalls: number
    tokensUsed: { input: number; output: number }
    durationMs: number
    filesToCreate: number
    filesToModify: number
  }
}
```

### `error`
Error event.

```typescript
interface ErrorEvent {
  type: 'error'
  timestamp: number
  code: string
  message: string
  recoverable: boolean
}
```

## Frontend Integration

### React Hook Example

```typescript
// hooks/useAnalysisStream.ts
import { useState, useCallback, useRef } from 'react'

type StreamEvent =
  | PhaseEvent
  | ToolCallEvent
  | ToolResultEvent
  | ThinkingEvent
  | ProgressEvent
  | FileDiscoveredEvent
  | ResultEvent
  | ErrorEvent

interface UseAnalysisStreamOptions {
  includeToolResults?: boolean
  includeThinking?: boolean
  onEvent?: (event: StreamEvent) => void
}

interface AnalysisState {
  phase: string
  message: string
  progress: {
    iteration: number
    toolCalls: number
    tokensUsed: { input: number; output: number }
    durationMs: number
  }
  toolHistory: Array<{
    tool: string
    description: string
    result?: string
    success?: boolean
    durationMs?: number
  }>
  filesDiscovered: Array<{
    action: 'create' | 'modify'
    path: string
    description?: string
  }>
  result: ResultEvent | null
  error: ErrorEvent | null
  isLoading: boolean
}

export function useAnalysisStream(options: UseAnalysisStreamOptions = {}) {
  const [state, setState] = useState<AnalysisState>({
    phase: 'idle',
    message: '',
    progress: { iteration: 0, toolCalls: 0, tokensUsed: { input: 0, output: 0 }, durationMs: 0 },
    toolHistory: [],
    filesDiscovered: [],
    result: null,
    error: null,
    isLoading: false,
  })

  const eventSourceRef = useRef<EventSource | null>(null)

  const startAnalysis = useCallback((taskId: string, token: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, result: null }))

    const params = new URLSearchParams()
    if (options.includeToolResults === false) params.set('includeToolResults', 'false')
    if (options.includeThinking) params.set('includeThinking', 'true')

    const url = `/api/agent/analyze/${taskId}/stream?${params}`

    // Create EventSource with auth (using fetch for custom headers)
    const eventSource = new EventSource(url, {
      // Note: EventSource doesn't support custom headers natively
      // You may need to use a library like eventsource or pass token in query
    })

    // Handle each event type
    eventSource.addEventListener('phase', (e) => {
      const event: PhaseEvent = JSON.parse(e.data)
      setState(prev => ({ ...prev, phase: event.phase, message: event.message }))
      options.onEvent?.(event)
    })

    eventSource.addEventListener('tool_call', (e) => {
      const event: ToolCallEvent = JSON.parse(e.data)
      setState(prev => ({
        ...prev,
        toolHistory: [
          ...prev.toolHistory,
          { tool: event.tool, description: event.description }
        ]
      }))
      options.onEvent?.(event)
    })

    eventSource.addEventListener('tool_result', (e) => {
      const event: ToolResultEvent = JSON.parse(e.data)
      setState(prev => ({
        ...prev,
        toolHistory: prev.toolHistory.map((t, i) =>
          i === prev.toolHistory.length - 1
            ? { ...t, result: event.summary, success: event.success, durationMs: event.durationMs }
            : t
        )
      }))
      options.onEvent?.(event)
    })

    eventSource.addEventListener('progress', (e) => {
      const event: ProgressEvent = JSON.parse(e.data)
      setState(prev => ({
        ...prev,
        progress: {
          iteration: event.iteration,
          toolCalls: event.toolCalls,
          tokensUsed: event.tokensUsed,
          durationMs: event.durationMs,
        }
      }))
      options.onEvent?.(event)
    })

    eventSource.addEventListener('file_discovered', (e) => {
      const event: FileDiscoveredEvent = JSON.parse(e.data)
      setState(prev => ({
        ...prev,
        filesDiscovered: [
          ...prev.filesDiscovered,
          { action: event.action, path: event.path, description: event.description }
        ]
      }))
      options.onEvent?.(event)
    })

    eventSource.addEventListener('result', (e) => {
      const event: ResultEvent = JSON.parse(e.data)
      setState(prev => ({ ...prev, result: event, isLoading: false, phase: 'complete' }))
      options.onEvent?.(event)
      eventSource.close()
    })

    eventSource.addEventListener('error', (e) => {
      if (e.data) {
        const event: ErrorEvent = JSON.parse(e.data)
        setState(prev => ({ ...prev, error: event, isLoading: false }))
        options.onEvent?.(event)
      }
      eventSource.close()
    })

    eventSource.onerror = () => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: { type: 'error', timestamp: Date.now(), code: 'CONNECTION_ERROR', message: 'Connection lost', recoverable: true }
      }))
      eventSource.close()
    }

    eventSourceRef.current = eventSource
  }, [options])

  const stopAnalysis = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  return {
    ...state,
    startAnalysis,
    stopAnalysis,
  }
}
```

### React Component Example

```tsx
// components/AnalysisProgress.tsx
import { useAnalysisStream } from '../hooks/useAnalysisStream'

interface AnalysisProgressProps {
  taskId: string
  onComplete?: (result: ResultEvent) => void
}

export function AnalysisProgress({ taskId, onComplete }: AnalysisProgressProps) {
  const {
    phase,
    message,
    progress,
    toolHistory,
    filesDiscovered,
    result,
    error,
    isLoading,
    startAnalysis,
  } = useAnalysisStream({
    includeToolResults: true,
    onEvent: (event) => {
      if (event.type === 'result') {
        onComplete?.(event)
      }
    },
  })

  return (
    <div className="analysis-progress">
      {/* Phase indicator */}
      <div className="phase-indicator">
        <PhaseIcon phase={phase} />
        <span>{message}</span>
      </div>

      {/* Progress stats */}
      <div className="stats">
        <span>Iteration: {progress.iteration}</span>
        <span>Tools: {progress.toolCalls}</span>
        <span>Tokens: {progress.tokensUsed.input + progress.tokensUsed.output}</span>
        <span>Time: {(progress.durationMs / 1000).toFixed(1)}s</span>
      </div>

      {/* Tool history - like Claude's thinking */}
      <div className="tool-history">
        {toolHistory.map((tool, i) => (
          <div key={i} className={`tool-item ${tool.success === false ? 'error' : ''}`}>
            <ToolIcon name={tool.tool} />
            <span>{tool.description}</span>
            {tool.result && <span className="result">{tool.result}</span>}
          </div>
        ))}
      </div>

      {/* Files discovered */}
      {filesDiscovered.length > 0 && (
        <div className="files-discovered">
          <h4>Files to {filesDiscovered[0]?.action}</h4>
          {filesDiscovered.map((file, i) => (
            <div key={i} className={`file-item ${file.action}`}>
              <FileIcon action={file.action} />
              <code>{file.path}</code>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="error">
          <span>{error.message}</span>
        </div>
      )}

      {/* Start button */}
      {!isLoading && !result && (
        <button onClick={() => startAnalysis(taskId, 'your-token')}>
          Start Analysis
        </button>
      )}
    </div>
  )
}
```

### Using Fetch with Custom Headers

Since EventSource doesn't support custom headers, use this approach:

```typescript
async function streamAnalysis(
  taskId: string,
  token: string,
  onEvent: (event: StreamEvent) => void
) {
  const response = await fetch(`/api/agent/analyze/${taskId}/stream`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Parse SSE format
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    let eventType = ''
    let eventData = ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7)
      } else if (line.startsWith('data: ')) {
        eventData = line.slice(6)
      } else if (line === '' && eventType && eventData) {
        // Complete event
        const event = JSON.parse(eventData) as StreamEvent
        onEvent(event)
        eventType = ''
        eventData = ''
      }
    }
  }
}
```

## Error Handling

The stream will emit an `error` event for:
- Task not found (404)
- Access denied (403)
- Task already analyzing (400)
- Agent errors (500)

The connection will close after:
- `result` event (success)
- `error` event (failure)
- Client disconnect

## Keep-Alive

The server sends comment-only keep-alive messages every 15 seconds:
```
: keep-alive
```

Clients should handle these to detect connection issues.
