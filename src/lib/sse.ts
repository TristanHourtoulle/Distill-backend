/**
 * Server-Sent Events (SSE) Utilities
 * Helpers for streaming events to the client
 */

import type { StreamEvent } from '../types/streaming.types.js'

/**
 * SSE Writer - wraps a WritableStreamDefaultWriter for SSE
 */
export class SSEWriter {
  private writer: WritableStreamDefaultWriter<Uint8Array>
  private encoder: TextEncoder
  private closed: boolean = false

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.writer = writer
    this.encoder = new TextEncoder()
  }

  /**
   * Send an event to the client
   */
  async sendEvent(event: StreamEvent): Promise<void> {
    if (this.closed) return

    try {
      const eventType = event.type
      const data = JSON.stringify(event)
      const message = `event: ${eventType}\ndata: ${data}\n\n`
      await this.writer.write(this.encoder.encode(message))
    } catch (error) {
      // Client disconnected
      this.closed = true
    }
  }

  /**
   * Send a comment (keep-alive)
   */
  async sendComment(comment: string): Promise<void> {
    if (this.closed) return

    try {
      const message = `: ${comment}\n\n`
      await this.writer.write(this.encoder.encode(message))
    } catch (error) {
      this.closed = true
    }
  }

  /**
   * Close the stream
   */
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true

    try {
      await this.writer.close()
    } catch {
      // Already closed
    }
  }

  /**
   * Check if the stream is closed
   */
  isClosed(): boolean {
    return this.closed
  }
}

/**
 * Create an SSE response with proper headers
 */
export function createSSEResponse(
  handler: (writer: SSEWriter) => Promise<void>
): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = new SSEWriter(writable.getWriter())

  // Start the handler in the background
  handler(writer).catch((error) => {
    console.error('SSE handler error:', error)
    writer.close()
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}

/**
 * Create a keep-alive interval for SSE connections
 * Returns a cleanup function
 */
export function createKeepAlive(
  writer: SSEWriter,
  intervalMs: number = 15000
): () => void {
  const interval = setInterval(async () => {
    if (writer.isClosed()) {
      clearInterval(interval)
      return
    }
    await writer.sendComment('keep-alive')
  }, intervalMs)

  return () => clearInterval(interval)
}
