#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RelayClient } from "./client.js";
import { startRelay } from "./relay.js";
import { registerAllTools } from "./tools.js";

async function main() {
  const server = new McpServer({
    name: "mcp-drawdb",
    version: "0.3.0",
  });

  const externalUrl = process.env.RELAY_URL;
  let relayUrl: string;

  if (externalUrl) {
    relayUrl = externalUrl;
    console.error(`[bridge] using external relay: ${relayUrl}`);
  } else {
    const handle = await startRelay();
    relayUrl = handle.url;
    console.error(`[bridge] embedded relay started on ${relayUrl}`);
  }

  const client = new RelayClient(relayUrl);

  function shutdown() {
    client.close();
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

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
