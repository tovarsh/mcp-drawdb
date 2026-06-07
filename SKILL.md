---
name: mcp-drawdb
version: 0.3.0
description: MCP server for drawdb — AI-powered database diagram editing via browser WebSocket relay
---

# mcp-drawdb

MCP server that connects AI assistants to [drawdb](https://github.com/drawdb-io/drawdb) database diagrams running in the browser. Read, create, modify, and validate database schemas through natural language.

## Usage

Add to your MCP client configuration:

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

Make sure drawdb.icen.ai is open in your browser. A green "MCP" indicator in the header confirms the connection.

## Tools

### Diagram Overview

- **get_diagram** — Full diagram state: all tables with fields and layout coordinates, relationships with cardinality/constraints, database type
- **list_tables** — Quick listing of all table names with field summaries
- **ping** — Test connection to the browser

### Schema Editing

- **add_table** — Create a table with typed fields, color, comment. Fields support: primary key, unique, not null, auto increment, unsigned, default value, check constraint, size, enum values, comments
- **update_table** — Rename table, change color/comment, add/drop/alter individual fields with full property control. Supports index-based targeting for duplicate table names
- **delete_table** — Remove a table and cascade-delete all its relationships
- **add_relationship** — Create a foreign key between two tables with cardinality (1:1, 1:n, n:1, n:m) and ON UPDATE/DELETE rules
- **delete_relationship** — Remove a specific relationship

### Layout & Validation

- **set_layout** — Reposition tables on the canvas by specifying x/y coordinates
- **set_database** — Switch the target database: mysql, postgresql, sqlite, mariadb, transactsql, oraclesql, generic
- **get_issues** — Validate the diagram for problems: duplicate names, missing primary keys, empty fields, type mismatches, circular dependencies
- **export_sql** — Generate DDL SQL (CREATE TABLE + constraints) for the current database type
- **clear_diagram** — Remove all tables and relationships
- **undo** — View the last action on the undo stack

## Typical Workflow

1. Open drawdb.icen.ai in browser, set database type with `set_database`
2. Create tables with `add_table` — specify fields with types and constraints
3. Link tables with `add_relationship`
4. Validate with `get_issues`, fix any problems
5. Generate SQL with `export_sql`

## Architecture

```
Claude Code ──stdio──► npx mcp-drawdb ──ws──► Embedded Relay ◄──ws── Browser (drawdb)
```

The bridge starts a WebSocket relay internally on an auto-detected port (3001→3002→...). The drawdb.icen.ai browser tab connects to this relay, enabling bidirectional communication. No external dependencies required.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `RELAY_URL` | embedded | Use an external relay server instead of the embedded one |
| `PORT` | 3001 | Starting port for the relay (auto-increments if occupied) |

## Requirements

- Node.js >= 18
- drawdb with MCP browser integration (WebSocket client in header)
- Browser tab with drawdb.icen.ai open
