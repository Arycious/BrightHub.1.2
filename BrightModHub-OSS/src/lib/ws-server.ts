// ==========================================
// Batched WebSocket Server
// ==========================================
// Handles real-time communication with the dashboard.
// Batches dimension updates every 250ms to prevent browser overload.

import { WebSocketServer, WebSocket } from 'ws';
import { DimensionUpdate, WSMessage, ConnectionState } from '../types';

export class BatchedWSServer {
  private wss: WebSocketServer | null = null;
  private updateBuffer: Map<string, DimensionUpdate> = new Map();
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private batchIntervalMs: number;
  private maxBufferSize: number = 500;

  constructor(batchIntervalMs: number = 250) {
    this.batchIntervalMs = batchIntervalMs;
  }

  /**
   * Start the WebSocket server on the given port.
   */
  start(port: number = 3001): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log(`[WS] Client connected (total: ${this.wss?.clients.size})`);

      ws.on('close', () => {
        console.log(`[WS] Client disconnected (total: ${this.wss?.clients.size})`);
      });

      ws.on('error', (error) => {
        console.error('[WS] Client error:', error);
      });
    });

    this.flushInterval = setInterval(() => this.flush(), this.batchIntervalMs);

    console.log(`[WS] Server started on port ${port}`);
  }

  /**
   * Add a dimension update to the buffer.
   * Only keeps the latest update per user (deduplication).
   */
  addDimensionUpdate(update: DimensionUpdate): void {
    if (this.updateBuffer.size >= this.maxBufferSize) {
      const firstKey = this.updateBuffer.keys().next().value;
      if (firstKey) this.updateBuffer.delete(firstKey);
    }

    this.updateBuffer.set(update.username, update);
  }

  /**
   * Flush buffered updates to all connected clients.
   */
  private flush(): void {
    if (this.updateBuffer.size === 0) return;
    if (!this.wss || this.wss.clients.size === 0) {
      this.updateBuffer.clear();
      return;
    }

    const batch = Array.from(this.updateBuffer.values());
    this.updateBuffer.clear();

    const message: WSMessage = {
      type: 'dimension_update',
      data: batch,
    };

    this.broadcast(message);
  }

  /**
   * Broadcast a message to all connected clients.
   */
  broadcast(message: WSMessage): void {
    if (!this.wss) return;

    const payload = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (error) {
          console.error('[WS] Send error:', error);
        }
      }
    });
  }

  /**
   * Send connection state change to all clients.
   */
  sendConnectionStatus(state: ConnectionState): void {
    this.broadcast({
      type: 'connection_status',
      data: { state },
    });
  }

  /**
   * Send phase change notification to all clients.
   */
  sendPhaseChange(spamMode: boolean): void {
    this.broadcast({
      type: 'phase_changed',
      data: { spamMode },
    });
  }

  /**
   * Send gap event notification.
   */
  sendGapEvent(startTime: number, endTime: number): void {
    this.broadcast({
      type: 'gap_event',
      data: {
        startTime,
        endTime,
        durationMs: endTime - startTime,
      },
    });
  }

  /**
   * Get the number of connected clients.
   */
  get clientCount(): number {
    return this.wss?.clients.size ?? 0;
  }

  /**
   * Stop the WebSocket server.
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}
