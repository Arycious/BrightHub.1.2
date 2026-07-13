// ==========================================
// WebSocket Hook — Real-time Updates
// ==========================================
// Handles WebSocket connection to the backend
// with proper cleanup for React StrictMode.

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { WSMessage, DimensionUpdate, ChatMessage, ConnectionState } from '@/types';

function getWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3001';

  // Development: connect directly to the Node WebSocket server
  if (window.location.hostname === 'localhost' && window.location.port === '3000') {
    return 'ws://localhost:3001';
  }

  // Production / nginx / ngrok: use /ws path on same host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function useRealtimeUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);

  const processDimensionUpdate = useStore((s) => s.processDimensionUpdate);
  const processChatMessage = useStore((s) => s.processChatMessage);
  const setConnectionState = useStore((s) => s.setConnectionState);
  const setSpamMode = useStore((s) => s.setSpamMode);
  const addGapEvent = useStore((s) => s.addGapEvent);
  const setWsConnected = useStore((s) => s.setWsConnected);

  const connect = useCallback(() => {
    // Don't connect if unmounted (StrictMode cleanup)
    if (!isMountedRef.current) return;

    // Don't open a second connection
    if (wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
         wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        console.log('[WS Client] Connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'dimension_update':
              processDimensionUpdate(msg.data as DimensionUpdate[]);
              break;

            // Legacy fallback — can be removed once backend only sends dimension_update
            case 'batch_update':
              processDimensionUpdate(msg.data as DimensionUpdate[]);
              break;

            case 'chat_message':
              processChatMessage(msg.data as ChatMessage);
              break;

            case 'connection_status':
              setConnectionState((msg.data as { state: ConnectionState }).state);
              break;

            case 'phase_changed':
              setSpamMode((msg.data as { spamMode: boolean }).spamMode);
              break;

            case 'gap_event':
              addGapEvent(msg.data as { startTime: number; endTime: number; durationMs: number });
              break;
          }
        } catch (error) {
          console.error('[WS Client] Parse error:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WS Client] Disconnected');
        setWsConnected(false);

        // Only clear ref if this is still the active WebSocket
        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        // Only reconnect if still mounted
        if (isMountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS Client] Error:', error);
      };
    } catch (error) {
      console.error('[WS Client] Connection error:', error);
      if (isMountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    }
  }, [processDimensionUpdate, processChatMessage, setConnectionState, setSpamMode, addGapEvent, setWsConnected]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;

      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close active WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
