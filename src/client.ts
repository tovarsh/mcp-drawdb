import WebSocket from "ws";
import { Msg, type RelayResponse } from "./types.js";

interface PendingEntry {
  resolve: (msg: RelayResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingEntry>();
  private connected = false;
  private shouldReconnect = true;
  private relayUrl: string;

  constructor(url: string) {
    this.relayUrl = url;
  }

  /** Gracefully shut down — stops auto-reconnect and rejects all pending calls. */
  close(): void {
    this.shouldReconnect = false;
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.resolve({ content: [{ type: "text", text: "Client shutting down" }], isError: true });
    }
    this.pending.clear();
    if (this.ws) {
      this.ws.removeAllListeners("close");
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.relayUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Connection timeout"));
      }, 5000);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.connected = true;
        ws.send(JSON.stringify({ type: Msg.CLIENT_CONNECT }));
        console.error(`[bridge] connected to relay: ${this.relayUrl}`);
        resolve();
      });

      ws.on("message", (raw) => {
        let msg: any;
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        if (msg.requestId && this.pending.has(msg.requestId)) {
          const entry = this.pending.get(msg.requestId)!;
          clearTimeout(entry.timer);
          this.pending.delete(msg.requestId);
          entry.resolve(msg);
        }
      });

      ws.on("close", () => {
        this.connected = false;
        if (!this.shouldReconnect) return;
        console.error("[bridge] disconnected from relay, reconnecting in 3s...");
        setTimeout(() => {
          if (this.shouldReconnect) this.connect().catch(() => {});
        }, 3000);
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        console.error("[bridge] ws error:", err.message);
        reject(err);
      });
    });
  }

  async call(name: string, args: Record<string, unknown>, timeoutMs = 30000): Promise<RelayResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to relay");
    }

    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timeout after ${timeoutMs}ms for tool "${name}"`));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, timer });
      this.ws!.send(JSON.stringify({
        type: Msg.CLIENT_TOOL_CALL,
        requestId,
        name,
        arguments: args,
      }));
    });
  }

  get isConnected() { return this.connected; }
}
