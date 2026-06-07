# mcp-drawdb

[中文文档](./README_zh.md)

MCP server for [drawdb](https://github.com/drawdb-io/drawdb) — lets AI assistants (Claude Code, Cursor, etc.) directly read and modify database diagrams in your browser.

## How It Works

```
Claude Code  ──stdio──►  npx mcp-drawdb  ──ws──►  Relay (embedded)  ◄──ws──  Browser (drawdb)
```

- **npx mcp-drawdb** starts a WebSocket relay server internally (auto port 3001→3002→...), then connects as a client
- **drawdb** in the browser connects to the relay, exposes diagram state to tools
- The relay routes messages between Claude Code and the browser

No separate relay process needed — everything runs inside the MCP bridge.

## Quick Start

### 1. Configure Claude Code

Add to your `claude_desktop_config.json` or `.claude/settings.json`:

```json
{
  "mcpServers": {
    "drawdb": {
      "command": "npx",
      "args": ["mcp-drawdb"]
    }
  }
}
```

### 2. Open drawdb.icen.ai

Open [drawdb.icen.ai](https://drawdb.icen.ai) in your browser. You'll see a green **MCP** dot in the header when connected.

> **Gray dot?** The relay port may not be 3001. Click the MCP dot to change the WebSocket URL. The relay auto-detects ports 3001–3011, so check which port it printed on startup.

### 3. Done

Claude Code can now read and modify your diagrams. Try:

```
"List all tables in the diagram"
"Add a users table with id, email, name"
"Create a relationship from users.id to posts.user_id"
"Export SQL for MySQL"
```

## Tools (14)

| Tool | Description |
|------|-------------|
| `ping` | Test connection to the browser |
| `list_tables` | List all tables with fields |
| `get_diagram` | Full diagram overview: tables, fields, layout (x/y/w/h), relationships, database type |
| `add_table` | Add a table with fields, color, comment |
| `update_table` | Rename table, add/drop/alter fields with full property control |
| `delete_table` | Delete a table (cascades to relationships) |
| `add_relationship` | Add FK with cardinality (`1:1`, `1:n`, `n:1`, `n:m`) and constraint rules |
| `delete_relationship` | Delete a relationship |
| `set_layout` | Reposition tables on canvas |
| `set_database` | Switch database type (mysql, postgresql, sqlite, mariadb, transactsql, oraclesql, generic) |
| `get_issues` | Validate diagram: duplicate names, missing PKs, type mismatches, etc. |
| `export_sql` | Generate DDL SQL for the target database |
| `clear_diagram` | Remove all tables and relationships |
| `undo` | View last action on the undo stack |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RELAY_URL` | *(embedded)* | Connect to an external relay instead of starting one |
| `PORT` | `3001` | Starting port for the relay (auto-increments if occupied) |
| `HOST` | `0.0.0.0` | Relay listen address |
| `CORS_ORIGIN` | `*` | CORS origin for the relay HTTP endpoint |

## Field Properties

When using `add_table`, `update_table`, each field supports:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Column name |
| `type` | string | SQL type (INT, VARCHAR, TEXT, DATETIME, ENUM, ...) |
| `primary` | boolean | Primary key |
| `unique` | boolean | Unique constraint |
| `nullable` | boolean | Allow NULL (false = NOT NULL) |
| `increment` | boolean | Auto increment |
| `unsigned` | boolean | Unsigned (numeric types) |
| `default_value` | string | Default value |
| `check` | string | CHECK constraint expression |
| `comment` | string | Column comment |
| `size` | string | Type size/precision (e.g. "255" for VARCHAR(255)) |
| `values` | string[] | Allowed values for ENUM/SET |

## FAQ

**HTTPS and `ws://localhost`?** All major browsers exempt localhost from mixed content checks. `ws://localhost` works from `https://drawdb.icen.ai` without `wss://`.

**Port 3001 is occupied?** The relay auto-detects ports 3001–3011. If it picks 3002, click the MCP indicator in drawdb.icen.ai header to update the URL.

## Standalone Relay

For advanced setups (Docker, shared server), you can run the relay separately:

```bash
npx mcp-drawdb-relay
```

Then configure the bridge with `RELAY_URL`:

```json
{
  "mcpServers": {
    "drawdb": {
      "command": "npx",
      "args": ["mcp-drawdb"],
      "env": {
        "RELAY_URL": "ws://your-server:3001"
      }
    }
  }
}
```

## Requirements

- Node.js >= 18
- drawdb with MCP integration (browser-side WebSocket client)
- A running browser tab with drawdb open

## License

MIT
