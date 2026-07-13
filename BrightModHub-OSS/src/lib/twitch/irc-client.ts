// ==========================================
// Resilient IRC Client — Direct WebSocket
// ==========================================
// Connects directly to Twitch IRC via WebSocket
// (replaces tmi.js which is unmaintained and breaks
//  on modern Node.js / Windows).
//
// Features:
// - Direct WebSocket to irc-ws.chat.twitch.tv
// - Automatic PING/PONG keepalive
// - IRCv3 tag parsing (badges, sub info, etc.)
// - Exponential backoff reconnection
// - Connection state machine
// - GAP event markers for data loss tracking

import WebSocket from 'ws';
import { ConnectionState, ChatMessage } from '../../types';

export interface IRCClientOptions {
  channel: string;
  onMessage: (msg: ChatMessage) => void;
  onConnectionChange: (state: ConnectionState) => void;
  onGapDetected: (startTime: number, endTime: number) => void;
}

// Twitch IRC WebSocket endpoint
const TWITCH_IRC_WS = 'wss://irc-ws.chat.twitch.tv:443';

/**
 * Parse IRCv3 tags from a raw tag string.
 * Example: "@badge-info=subscriber/12;badges=subscriber/12,premium/1;color=#FF0000;..."
 */
function parseTags(rawTags: string): Map<string, string> {
  const tags = new Map<string, string>();
  if (!rawTags) return tags;

  const parts = rawTags.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) {
      tags.set(part, '');
    } else {
      tags.set(part.substring(0, eqIdx), part.substring(eqIdx + 1));
    }
  }
  return tags;
}

/**
 * Parse badges string like "subscriber/12,premium/1" into a Map.
 */
function parseBadges(badgeStr: string): Map<string, string> {
  const badges = new Map<string, string>();
  if (!badgeStr) return badges;

  const parts = badgeStr.split(',');
  for (const part of parts) {
    const slashIdx = part.indexOf('/');
    if (slashIdx === -1) {
      badges.set(part, '');
    } else {
      badges.set(part.substring(0, slashIdx), part.substring(slashIdx + 1));
    }
  }
  return badges;
}

export class ResilientIRCClient {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private options: IRCClientOptions;
  private reconnectAttempts: number = 0;
  private maxReconnectDelay: number = 30000;
  private disconnectTime: number | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalDisconnect: boolean = false;
  private channel: string;

  constructor(options: IRCClientOptions) {
    this.options = options;
    // Normalize channel name (lowercase, no #)
    this.channel = options.channel.replace(/^#/, '').toLowerCase();
  }

  /**
   * Connect to Twitch IRC channel via WebSocket.
   */
  async connect(): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTED ||
        this.connectionState === ConnectionState.CONNECTING) {
      return;
    }

    this.isIntentionalDisconnect = false;
    this.setConnectionState(ConnectionState.CONNECTING);

    return new Promise<void>((resolve, reject) => {
      try {
        console.log(`[IRC] Connecting to ${TWITCH_IRC_WS}...`);

        this.ws = new WebSocket(TWITCH_IRC_WS);

        // Connection timeout — if we don't connect within 15s, give up
        const connectTimeout = setTimeout(() => {
          if (this.connectionState === ConnectionState.CONNECTING) {
            console.error('[IRC] Connection timeout after 15s');
            this.ws?.terminate();
            reject(new Error('Connection timeout'));
          }
        }, 15000);

        this.ws.on('open', () => {
          clearTimeout(connectTimeout);
          console.log('[IRC] WebSocket connected, sending auth...');

          // Request IRCv3 capabilities (tags, commands, membership)
          this.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');

          // Anonymous login
          this.send('PASS SCHMOOPIIE');
          this.send('NICK justinfan123');

          // Join channel
          this.send(`JOIN #${this.channel}`);
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          const raw = data.toString();
          this.handleRawMessage(raw, resolve);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          clearTimeout(connectTimeout);
          const reasonStr = reason.toString() || `code ${code}`;
          console.log(`[IRC] WebSocket closed: ${reasonStr}`);

          if (!this.isIntentionalDisconnect) {
            this.handleDisconnect();
          }
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(connectTimeout);
          console.error('[IRC] WebSocket error:', error.message);
          // Don't reject here — the 'close' event will handle reconnection
        });

      } catch (error) {
        console.error('[IRC] Failed to create WebSocket:', error);
        this.handleDisconnect();
        reject(error);
      }
    });
  }

  /**
   * Send a raw IRC message.
   */
  private send(message: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message + '\r\n');
    }
  }

  /**
   * Handle raw IRC messages from Twitch.
   * IRC messages can be batched (multiple lines per WebSocket frame).
   */
  private handleRawMessage(raw: string, onFirstConnect?: (value: void) => void): void {
    const lines = raw.split('\r\n').filter(line => line.length > 0);

    for (const line of lines) {
      this.processIRCLine(line, onFirstConnect);
    }
  }

  /**
   * Process a single IRC line.
   * Format: [@tags] [:prefix] <command> [params] [:trailing]
   */
  private processIRCLine(line: string, onFirstConnect?: (value: void) => void): void {
    // Handle PING/PONG keepalive
    if (line === 'PING :tmi.twitch.tv') {
      this.send('PONG :tmi.twitch.tv');
      return;
    }

    let tags: Map<string, string> = new Map();
    let remaining = line;

    // Parse tags (starts with @)
    if (remaining.startsWith('@')) {
      const spaceIdx = remaining.indexOf(' ');
      if (spaceIdx === -1) return;
      tags = parseTags(remaining.substring(1, spaceIdx));
      remaining = remaining.substring(spaceIdx + 1);
    }

    // Parse prefix (starts with :)
    let prefix = '';
    if (remaining.startsWith(':')) {
      const spaceIdx = remaining.indexOf(' ');
      if (spaceIdx === -1) return;
      prefix = remaining.substring(1, spaceIdx);
      remaining = remaining.substring(spaceIdx + 1);
    }

    // Parse command and params
    const parts = remaining.split(' ');
    const command = parts[0];

    switch (command) {
      case '001': // RPL_WELCOME — we're logged in
        console.log(`[IRC] Authenticated as anonymous`);
        break;

      case '366': // RPL_ENDOFNAMES — joined channel successfully
        console.log(`[IRC] Joined #${this.channel}`);
        this.reconnectAttempts = 0;

        // Mark gap if we were reconnecting
        if (this.disconnectTime) {
          this.options.onGapDetected(this.disconnectTime, Date.now());
          this.disconnectTime = null;
        }

        this.setConnectionState(ConnectionState.CONNECTED);
        this.startHeartbeat();

        // Resolve the connect() promise
        if (onFirstConnect) {
          onFirstConnect();
        }
        break;

      case 'PRIVMSG':
        this.handlePrivMsg(prefix, tags, parts);
        break;

      case 'NOTICE':
        // Could be used for rate-limit warnings, etc.
        const noticeMsg = remaining.substring(remaining.indexOf(':', 1) + 1);
        console.log(`[IRC] NOTICE: ${noticeMsg}`);
        break;

      case 'RECONNECT':
        // Twitch is telling us to reconnect
        console.log('[IRC] Twitch requested reconnect');
        this.handleDisconnect();
        break;

      case 'USERNOTICE':
        // Sub events, raids, etc. — ignore for now
        break;

      case 'CAP':
        // Capability acknowledgment
        break;

      default:
        // Ignore other IRC numerics (353, 375, 372, 376, etc.)
        break;
    }
  }

  /**
   * Handle PRIVMSG — a chat message.
   */
  private handlePrivMsg(prefix: string, tags: Map<string, string>, parts: string[]): void {
    // Extract username from prefix (user!user@user.tmi.twitch.tv)
    const username = prefix.split('!')[0] || 'anonymous';

    // Extract message text (everything after the second ":")
    const fullLine = parts.join(' ');
    const msgStart = fullLine.indexOf(':', 1);
    const message = msgStart !== -1 ? fullLine.substring(msgStart + 1) : '';

    // Parse badge info
    const badges = parseBadges(tags.get('badges') || '');
    const badgeInfo = parseBadges(tags.get('badge-info') || '');

    const chatMsg: ChatMessage = {
      username: username.toLowerCase(),
      displayName: tags.get('display-name') || username,
      message,
      timestamp: Date.now(),
      isSub: !!badges.has('subscriber') || !!badges.has('founder'),
      isMod: !!badges.has('moderator') || !!badges.has('broadcaster'),
      isVip: !!badges.has('vip'),
      subMonths: parseInt(badgeInfo.get('subscriber') || '0', 10),
    };

    this.options.onMessage(chatMsg);
  }

  /**
   * Handle disconnection with exponential backoff.
   */
  private handleDisconnect(): void {
    this.stopHeartbeat();

    // Clean up old WebSocket
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    if (this.connectionState === ConnectionState.CONNECTED) {
      this.disconnectTime = Date.now();
    }

    if (this.isIntentionalDisconnect) return;

    this.setConnectionState(ConnectionState.RECONNECTING);

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    const jitter = Math.random() * 500; // 0-500ms jitter
    const delay = baseDelay + jitter;

    this.reconnectAttempts++;

    console.log(`[IRC] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        console.error('[IRC] Reconnect failed:', err);
        // handleDisconnect will be called again by the 'close' event
      });
    }, delay);
  }

  /**
   * Start heartbeat — send PING every 60s to keep connection alive.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('PING :brightmodhub');

        // If we don't get PONG within 10s, reconnect
        const pongTimeout = setTimeout(() => {
          if (this.connectionState === ConnectionState.CONNECTED) {
            console.log('[IRC] Heartbeat timeout, reconnecting...');
            this.handleDisconnect();
          }
        }, 10000);

        // Clear pong timeout on any incoming message
        // (Twitch sends PONG but also other messages that prove liveness)
        const onMessage = () => {
          clearTimeout(pongTimeout);
          this.ws?.removeListener('message', onMessage);
        };
        this.ws?.on('message', onMessage);
      }
    }, 60000);
  }

  /**
   * Stop heartbeat monitoring.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Update connection state and notify listeners.
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.options.onConnectionChange(state);
  }

  /**
   * Disconnect from IRC.
   */
  async disconnect(): Promise<void> {
    this.isIntentionalDisconnect = true;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);

    if (this.ws) {
      try {
        this.send('PART #' + this.channel);
        // Give it a moment to send the PART, then close
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            this.ws?.terminate();
            this.ws = null;
            resolve();
          }, 200);
        });
      } catch {
        this.ws?.terminate();
        this.ws = null;
      }
    }

    this.reconnectAttempts = 0;
    this.disconnectTime = null;
  }

  /**
   * Get current connection state.
   */
  getState(): ConnectionState {
    return this.connectionState;
  }
}
