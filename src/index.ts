#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RelayClient } from "./client.js";
import { startRelay } from "./relay.js";
import { registerAllTools } from "./tools.js";
import { discoverRelay, writePortFile, removePortFile } from "./discover.js";

async function main() {
  const server = new McpServer({
    name: "mcp-drawdb",
    version: "0.3.2",
    description: "Interact with drawdb database diagrams in the browser. Open https://drawdb.icen.ai/editor before using.",
  });

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
