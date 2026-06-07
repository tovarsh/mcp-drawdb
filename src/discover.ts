import http from "http";
import fs from "fs";
import os from "os";
import path from "path";

const DIR = path.join(os.homedir(), ".mcp-drawdb");
const PORT_FILE = path.join(DIR, "relay.json");
const DEFAULT_PORT = 23432;
const PROBE_TIMEOUT = 1500;

interface PortFileData {
  port: number;
  pid: number;
  ts: number;
}

/** HTTP probe: is a drawdb relay listening on this port? */
function probeRelay(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${port}/`,
      { timeout: PROBE_TIMEOUT },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve(data.ok === true);
          } catch {
            resolve(false);
          }
        });
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

/** Check if a PID is still alive. */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Try to find an already-running relay. Returns ws:// URL or null. */
export async function discoverRelay(): Promise<string | null> {
  // 1. Try port file
  try {
    const raw = fs.readFileSync(PORT_FILE, "utf-8");
    const data: PortFileData = JSON.parse(raw);
    if (data.port && data.pid) {
      if (isPidAlive(data.pid) && await probeRelay(data.port)) {
        return `ws://localhost:${data.port}`;
      }
      // Stale — clean up
      fs.unlink(PORT_FILE, () => {});
    }
  } catch {
    // File missing or unreadable — continue
  }

  // 2. Probe default port
  if (await probeRelay(DEFAULT_PORT)) {
    return `ws://localhost:${DEFAULT_PORT}`;
  }

  return null;
}

/** Write relay info to port file (best-effort). */
export function writePortFile(port: number): void {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(
      PORT_FILE,
      JSON.stringify({ port, pid: process.pid, ts: Date.now() }),
    );
  } catch (err: any) {
    console.error("[discover] failed to write port file:", err.message);
  }
}

/** Remove port file (ignore errors). */
export function removePortFile(): void {
  try { fs.unlinkSync(PORT_FILE); } catch {}
}
