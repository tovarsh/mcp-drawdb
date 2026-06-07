import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RelayClient } from "./client.js";
import { fieldSchema, alterFieldSchema } from "./types.js";

// --- Helpers ---

function errResult(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

function okResult(content: any[] | undefined, fallback: string) {
  return { content: content || [{ type: "text" as const, text: fallback }] };
}

// --- Factory ---

interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, any>;
  fallback: string;
  timeoutMs?: number;
}

function registerRelayTool(server: McpServer, client: RelayClient, def: ToolDef) {
  server.tool(def.name, def.description, def.schema, async (args) => {
    try {
      const resp = await client.call(def.name, args ?? {}, def.timeoutMs);
      return okResult(resp.content, def.fallback);
    } catch (err: any) {
      return errResult(err.message);
    }
  });
}

// --- All tools ---

export function registerAllTools(server: McpServer, client: RelayClient): void {
  const tools: ToolDef[] = [
    {
      name: "ping",
      description: "Test connection to the drawdb browser session",
      schema: {},
      fallback: "pong",
      timeoutMs: 5000,
    },
    {
      name: "list_tables",
      description: "List all tables in the current drawdb diagram",
      schema: {},
      fallback: "No tables found",
    },
    {
      name: "get_diagram",
      description: "Get full overview of the diagram: tables with fields, layout (x/y/width/height), relationships, database type",
      schema: {},
      fallback: "No diagram data",
    },
    {
      name: "add_table",
      description: "Add a new table to the diagram",
      schema: {
        name: z.string().describe("Table name"),
        fields: z.array(fieldSchema).describe("Table fields/columns"),
        color: z.string().optional().describe("Table color hex code"),
        comment: z.string().optional().describe("Table comment"),
      },
      fallback: "Done",
    },
    {
      name: "delete_table",
      description: "Delete a table from the diagram. Cascades to remove all relationships involving this table.",
      schema: {
        name: z.string().describe("Table name to delete"),
        index: z.number().optional().describe("Table index (use if multiple tables share the same name). 0-based."),
      },
      fallback: "Done",
    },
    {
      name: "update_table",
      description: "Update a table: rename, change comment/color, add/drop/alter fields with full property control (unique, unsigned, check, increment, etc.)",
      schema: {
        name: z.string().describe("Table name to update"),
        index: z.number().optional().describe("Table index (use if multiple tables share the same name). 0-based."),
        new_name: z.string().optional().describe("New table name"),
        comment: z.string().optional().describe("Table comment"),
        color: z.string().optional().describe("Table color hex code"),
        add_fields: z.array(fieldSchema).optional().describe("Fields to add"),
        drop_fields: z.array(z.string()).optional().describe("Field names to drop"),
        alter_fields: z.array(alterFieldSchema).optional().describe("Fields to alter"),
      },
      fallback: "Done",
    },
    {
      name: "add_relationship",
      description: "Add a relationship (foreign key) between two tables with optional cardinality and constraint rules",
      schema: {
        from_table: z.string().describe("Source table name"),
        to_table: z.string().describe("Target table name"),
        from_field: z.string().describe("Source field name"),
        to_field: z.string().describe("Target field name"),
        card: z.enum(["1:1", "1:n", "n:1", "n:m"]).optional().describe("Cardinality"),
        update_rule: z.enum(["No action", "Restrict", "Cascade", "Set null", "Set default"]).optional().describe("On update rule"),
        delete_rule: z.enum(["No action", "Restrict", "Cascade", "Set null", "Set default"]).optional().describe("On delete rule"),
        name: z.string().optional().describe("Custom relationship/FK name"),
      },
      fallback: "Done",
    },
    {
      name: "delete_relationship",
      description: "Delete a relationship between two tables",
      schema: {
        from_table: z.string().describe("Source table name"),
        from_field: z.string().describe("Source field name"),
        to_table: z.string().describe("Target table name"),
        to_field: z.string().describe("Target field name"),
      },
      fallback: "Done",
    },
    {
      name: "set_layout",
      description: "Set positions of tables on the canvas. Pass an array of {table_name, x, y} to reposition tables. For duplicate table names, pass entries in order.",
      schema: {
        positions: z.array(z.object({
          table_name: z.string().describe("Table name to move"),
          x: z.number().describe("New x position on canvas"),
          y: z.number().describe("New y position on canvas"),
        })).describe("Array of table positions to set"),
      },
      fallback: "Layout updated",
    },
    {
      name: "get_issues",
      description: "Get validation issues/problems in the current diagram. Checks for: duplicate names, missing primary keys, empty fields, type mismatches, circular dependencies, and more. Call this after making changes to verify the diagram is valid.",
      schema: {},
      fallback: "No issues",
    },
    {
      name: "export_sql",
      description: "Generate DDL SQL for the target database. Returns CREATE TABLE statements with columns, constraints, and foreign keys. Note: requires database to be set to a specific type (not 'generic').",
      schema: {},
      fallback: "No SQL generated",
    },
    {
      name: "set_database",
      description: "Set the target database type. This affects available field types, SQL generation, and validation. Options: mysql, postgresql, sqlite, mariadb, transactsql, oraclesql, generic.",
      schema: {
        database: z.enum(["mysql", "postgresql", "transactsql", "sqlite", "mariadb", "oraclesql", "generic"]).describe("Database type"),
      },
      fallback: "Done",
    },
    {
      name: "clear_diagram",
      description: "Clear all tables and relationships from the diagram. Use with caution.",
      schema: {},
      fallback: "Diagram cleared",
    },
    {
      name: "undo",
      description: "View the last action on the undo stack. Returns a description of what would be undone. Note: full undo requires UI interaction.",
      schema: {},
      fallback: "Nothing to undo",
    },
  ];

  for (const def of tools) {
    registerRelayTool(server, client, def);
  }
}
