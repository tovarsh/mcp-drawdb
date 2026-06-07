#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RelayClient } from "./client.js";
import { startRelay } from "./relay.js";
import { registerAllTools } from "./tools.js";
import { discoverRelay, writePortFile, removePortFile } from "./discover.js";

const PORT_START = 23432;
const PORT_END = 23442;

async function main() {
  // --- Resolve relay URL first ---
  const externalUrl = process.env.RELAY_URL;
  let relayUrl: string;
  let ownsRelay = false;

  if (externalUrl) {
    relayUrl = externalUrl;
    console.error(`[bridge] using external relay: ${relayUrl}`);
  } else {
    const existingUrl = await discoverRelay();
    if (existingUrl) {
      relayUrl = existingUrl;
      console.error(`[bridge] reusing existing relay at ${relayUrl}`);
    } else {
      const handle = await startRelay();
      relayUrl = handle.url;
      ownsRelay = true;
      writePortFile(handle.port);
      console.error(`[bridge] embedded relay started on ${relayUrl}`);
    }
  }

  const port = parseInt(relayUrl.replace(/.*:(\d+)\/?/, "$1"), 10);

  // --- Create MCP server with dynamic instructions ---
  const server = new McpServer({
    name: "mcp-drawdb",
    version: "0.3.2",
  }, {
    instructions: [
      "Interact with drawdb database diagrams in the browser.",
      "The browser at https://drawdb.icen.ai/editor must be open and connected to the relay for tools to work.",
      `Relay server is running at ${relayUrl}. The browser auto-scans ports ${PORT_START}-${PORT_END} to find the relay.`,
      "If a tool returns 'No browser connected', ask the user to open or refresh https://drawdb.icen.ai/editor.",
    ].join("\n"),
  });

  // --- Connect to relay ---
  const client = new RelayClient(relayUrl);

  function shutdown() {
    client.close();
    if (ownsRelay) removePortFile();
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  if (ownsRelay) process.on("exit", removePortFile);

  try {
    await client.connect();
  } catch {
    console.error("[bridge] initial relay connection failed, will retry on tool calls");
  }

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[bridge] mcp-drawdb ready");
}

main().catch((err) => {
  console.error("[bridge] fatal:", err);
  process.exit(1);
});
