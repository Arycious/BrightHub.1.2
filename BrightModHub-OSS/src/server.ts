// ==========================================
// BrightModHub — Custom Server
// ==========================================
// Bootstraps Next.js standalone HTTP server + WebSocket server + IRC client
// as a single process. This is required because:
// 1. IRC connection must be persistent (not per-request)
// 2. WebSocket server needs its own port
// 3. Detection engine is stateful (in-memory buffers)

import path from 'path';
import fs from 'fs';

// Load .env from the project root (works both from repo root and from dist/)
let envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve(__dirname, '..', '.env');
}
if (fs.existsSync(envPath)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: envPath });
}

import { getDetectionEngine } from './lib/detection/engine';
import { BatchedWSServer } from './lib/ws-server';
import { ResilientIRCClient } from './lib/twitch/irc-client';
import {
  setActiveChannel,
  getCurrentChannel,
  initSchemaForActiveChannel,
  startSession,
  endSession,
  insertEvent,
} from './lib/db';
import { getActiveChannelConfig, migrateLegacyDatabase } from './lib/channel-manager';
import { ConnectionState } from './types';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const wsPort = parseInt(process.env.WS_PORT || '3001', 10);

// Global state
let ircClient: ResilientIRCClient | null = null;
let currentSessionId: number | null = null;

async function main() {
  // Ensure cwd is the dist directory so Next.js standalone resolves paths
  if (process.cwd() !== __dirname) {
    process.chdir(__dirname);
  }

  // Initialize default channel database so API routes work before monitoring starts
  const defaultChannel = process.env.DEFAULT_CHANNEL || 'brightmodhub';
  console.log(`[DB] Initializing default channel database: ${defaultChannel}`);
  migrateLegacyDatabase(defaultChannel);
  setActiveChannel(defaultChannel);
  initSchemaForActiveChannel();
  console.log('[DB] Database ready.');

  // Initialize Detection Engine with default channel config
  const defaultConfig = getActiveChannelConfig(defaultChannel);
  let engine = getDetectionEngine(defaultConfig);

  // Initialize WebSocket Server
  const wsServer = new BatchedWSServer(250);
  wsServer.start(wsPort);

  // Pipe detection results to WebSocket
  engine.setOnDimensionUpdate((update) => {
    wsServer.addDimensionUpdate(update);
  });

  // Store references globally for API routes
  (global as Record<string, unknown>).__brightmod = {
    engine,
    wsServer,
    getIRCClient: () => ircClient,
    startMonitoring: async (channel: string) => {
      if (ircClient) {
        await ircClient.disconnect();
      }

      // Switch to the channel database and load its config
      const targetChannel = channel.toLowerCase().replace(/^#/, '');
      console.log(`[Channel] Switching to channel: ${targetChannel}`);
      setActiveChannel(targetChannel);
      initSchemaForActiveChannel();
      const channelConfig = getActiveChannelConfig(targetChannel);
      engine = getDetectionEngine(channelConfig);
      engine.setOnDimensionUpdate((update) => {
        wsServer.addDimensionUpdate(update);
      });

      currentSessionId = startSession(targetChannel);

      ircClient = new ResilientIRCClient({
        channel,
        onMessage: (msg) => {
          engine.processMessage(msg);

          // Broadcast every chat message to the frontend
          wsServer.broadcast({
            type: 'chat_message',
            data: msg,
          });
        },
        onConnectionChange: (state) => {
          console.log(`[IRC] State: ${state}`);
          engine.setConnectionState(state);
          wsServer.sendConnectionStatus(state);
        },
        onGapDetected: (startTime, endTime) => {
          console.log(`[IRC] GAP detected: ${endTime - startTime}ms`);
          wsServer.sendGapEvent(startTime, endTime);
          insertEvent({
            username: '_system',
            detectorType: 'gap',
            scoreDelta: 0,
            details: JSON.stringify({ startTime, endTime, durationMs: endTime - startTime }),
          });
        },
      });

      await ircClient.connect();
    },
    stopMonitoring: async () => {
      if (ircClient) {
        await ircClient.disconnect();
        ircClient = null;
      }
      if (currentSessionId) {
        const stats = engine.getStats();
        endSession(currentSessionId, stats.trackedUsers, stats.flagsRaised);
        currentSessionId = null;
      }
      engine.reset();
      // Reset active channel back to default for API routes
      setActiveChannel(defaultChannel);
      initSchemaForActiveChannel();
    },
    getCurrentChannel: () => getCurrentChannel(),
    getChannelConfig: () => getActiveChannelConfig(getCurrentChannel()),
    toggleSpamMode: () => {
      const newState = engine.toggleSpamMode();
      wsServer.sendPhaseChange(newState);
      return newState;
    },
    getEngine: () => engine,
    reloadEngine: (channel: string) => {
      const targetChannel = channel.toLowerCase().replace(/^#/, '');
      if (targetChannel !== getCurrentChannel()) {
        console.log(`[Engine] Ignoring reload for inactive channel ${targetChannel}`);
        return;
      }
      const channelConfig = getActiveChannelConfig(targetChannel);
      engine = getDetectionEngine(channelConfig);
      engine.setOnDimensionUpdate((update) => {
        wsServer.addDimensionUpdate(update);
      });
      console.log(`[Engine] Reloaded config for #${targetChannel}`);
    },
  };

  if (dev) {
    // Development: use the standard Next.js server so HMR etc. work
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const next = require('next');
    const { createServer } = require('http');
    const { parse } = require('url');

    const app = next({ dev, port, dir: path.join(__dirname, '..') });
    const handle = app.getRequestHandler();
    await app.prepare();

    const server = createServer(async (req: any, res: any) => {
      try {
        const parsedUrl = parse(req.url || '', true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[Server] Error:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    server.listen(port, () => {
      printBanner(hostname, port, wsPort);
    });
  } else {
    // Production: use Next.js standalone start-server
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = process.env.NODE_ENV || 'production';

    const requiredFilesPath = path.join(__dirname, '.next', 'required-server-files.json');
    if (!fs.existsSync(requiredFilesPath)) {
      throw new Error(
        `Missing ${requiredFilesPath}. Did you run “next build” with output: 'standalone'?`
      );
    }

    const requiredFiles = JSON.parse(fs.readFileSync(requiredFilesPath, 'utf-8'));
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(requiredFiles.config);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { startServer } = require('next/dist/server/lib/start-server');

    await startServer({
      dir: __dirname,
      isDev: false,
      config: requiredFiles.config,
      hostname,
      port,
      allowRetry: false,
    });

    printBanner(hostname, port, wsPort);
  }
}

function printBanner(host: string, httpPort: number, socketPort: number) {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║        🔍 BrightModHub v1.0               ║');
  console.log('  ║        Twitch Bot Detection Dashboard      ║');
  console.log(`  ║        Dashboard: http://${host}:${httpPort}    ║`);
  console.log(`  ║        WebSocket: ws://${host}:${socketPort}     ║`);
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
