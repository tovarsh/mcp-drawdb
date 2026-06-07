#!/usr/bin/env node

import { WebSocketServer, WebSocket } from "ws";
import { createServer, type Server } from "http";
import { fileURLToPath } from "url";
import { Msg } from "./types.js";

export interface RelayHandle {
  port: number;
  url: string;
  close: () => void;
}

interface Peer {
  ws: WebSocket;
  sessionId: string;
  lastActive: number;
}

export function startRelay(options?: {
  startPort?: number;
  host?: string;
  corsOrigin?: string;
}): Promise<RelayHandle> {
  const START_PORT = options?.startPort ?? parseInt(process.env.PORT || "3001", 10);
  const MAX_PORT = START_PORT + 10;
  const HOST = options?.host ?? process.env.HOST ?? "0.0.0.0";
  const CORS_ORIGIN = options?.corsOrigin ?? process.env.CORS_ORIGIN ?? "*";

  const browsers = new Map<string, Peer>();
  let npxClient: { ws: WebSocket } | null = null;
  const pendingRequests = new Map<string, WebSocket>();
  let actualPort = START_PORT;

  function getActiveBrowser(): Peer | undefined {
    let latest: Peer | undefined;
    for (const b of browsers.values()) {
      if (!latest || b.lastActive > latest.lastActive) latest = b;
    }
    return latest;
  }

  function send(ws: WebSocket, msg: object) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  const server: Server = createServer((_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      port: actualPort,
      url: `ws://localhost:${actualPort}`,
      browsers: browsers.size,
      npxConnected: npxClient !== null,
    }));
  });

  const wss = new WebSocketServer({ server });

  // --- Message handler map ---

  const handlers: Record<string, (msg: any, ws: WebSocket) => void> = {
    [Msg.BROWSER_REGISTER](msg, ws) {
      const sessionId = crypto.randomUUID().slice(0, 6);
      const peer: Peer = { ws, sessionId, lastActive: Date.now() };
      browsers.set(sessionId, peer);
      send(ws, { type: Msg.BROWSER_REGISTERED, sessionId });
      if (npxClient) {
        send(npxClient.ws, { type: Msg.CLIENT_CONNECTED });
      }
      console.error(`[relay] browser registered: ${sessionId}`);
    },

    [Msg.BROWSER_TOOL_RESULT](msg) {
      const npxWs = pendingRequests.get(msg.requestId);
      if (npxWs) {
        pendingRequests.delete(msg.requestId);
        send(npxWs, {
          type: Msg.CLIENT_TOOL_RESULT,
          requestId: msg.requestId,
          content: msg.content,
          isError: msg.isError,
        });
      }
    },

    [Msg.BROWSER_PONG]() {
      // heartbeat response
    },

    [Msg.CLIENT_CONNECT](_msg, ws) {
      npxClient = { ws };
      send(ws, { type: Msg.CLIENT_CONNECTED });
      console.error("[relay] npx client connected");
    },

    [Msg.CLIENT_TOOL_CALL](msg) {
      const browser = getActiveBrowser();
      if (!browser) {
        const ws = npxClient?.ws;
        if (ws) send(ws, {
          type: Msg.CLIENT_ERROR,
          requestId: msg.requestId,
          message: "No browser connected",
        });
        return;
      }
      const npxWs = npxClient?.ws;
      if (!npxWs) return;
      browser.lastActive = Date.now();
      pendingRequests.set(msg.requestId, npxWs);
      send(browser.ws, {
        type: Msg.BROWSER_TOOL_CALL,
        requestId: msg.requestId,
        name: msg.name,
        arguments: msg.arguments,
      });
    },

    [Msg.CLIENT_PING](_msg, ws) {
      send(ws, { type: "client:pong" });
    },
  };

  // --- Connection handling ---

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const handler = handlers[msg.type];
      if (handler) handler(msg, ws);
    });

    ws.on("close", () => {
      for (const [id, peer] of browsers) {
        if (peer.ws === ws) {
          browsers.delete(id);
          console.error(`[relay] browser disconnected: ${id}`);
          for (const [requestId, npxWs] of pendingRequests) {
            pendingRequests.delete(requestId);
            send(npxWs, {
              type: Msg.CLIENT_ERROR,
              requestId,
              message: "Browser disconnected",
            });
          }
          return;
        }
      }
      if (npxClient?.ws === ws) {
        npxClient = null;
        for (const [requestId, npxWs] of pendingRequests) {
          if (npxWs === ws) pendingRequests.delete(requestId);
        }
        console.error("[relay] npx client disconnected");
      }
    });
  });

  // --- Port auto-detection ---

  return new Promise<RelayHandle>((resolve, reject) => {
    function tryListen(port: number) {
      if (port > MAX_PORT) {
        reject(new Error(`No available port in range ${START_PORT}-${MAX_PORT}`));
        return;
      }
      actualPort = port;
      server.listen(port, HOST);
    }

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[relay] port ${actualPort} in use, trying ${actualPort + 1}...`);
        tryListen(actualPort + 1);
      } else {
        reject(err);
      }
    });

    server.on("listening", () => {
      const url = `ws://localhost:${actualPort}`;
      console.error(`[relay] listening on ${url}`);
      resolve({
        port: actualPort,
        url,
        close: () => {
          wss.close();
          server.close();
        },
      });
    });

    tryListen(START_PORT);
  });
}

// --- Standalone mode: run directly with `npx mcp-drawdb-relay` ---
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  startRelay().catch((err) => {
    console.error("[relay] fatal:", err);
    process.exit(1);
  });
}
