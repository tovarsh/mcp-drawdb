// --- Protocol message type constants ---

export const Msg = {
  // Browser → Relay
  BROWSER_REGISTER: "browser:register",
  BROWSER_TOOL_RESULT: "browser:tool_result",
  BROWSER_PONG: "browser:pong",

  // npx → Relay
  CLIENT_CONNECT: "client:connect",
  CLIENT_TOOL_CALL: "client:tool_call",
  CLIENT_PING: "client:ping",

  // Relay → Browser
  BROWSER_REGISTERED: "browser:registered",
  BROWSER_TOOL_CALL: "browser:tool_call",

  // Relay → npx
  CLIENT_CONNECTED: "client:connected",
  CLIENT_TOOL_RESULT: "client:tool_result",
  CLIENT_ERROR: "client:error",
} as const;

// --- Protocol interfaces ---

export interface RelayMessage {
  type: string;
  [key: string]: unknown;
}

// Browser → Relay
export interface BrowserRegister extends RelayMessage {
  type: typeof Msg.BROWSER_REGISTER;
}

export interface BrowserToolResult extends RelayMessage {
  type: typeof Msg.BROWSER_TOOL_RESULT;
  requestId: string;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

// npx → Relay
export interface ClientConnect extends RelayMessage {
  type: typeof Msg.CLIENT_CONNECT;
}

export interface ClientToolCall extends RelayMessage {
  type: typeof Msg.CLIENT_TOOL_CALL;
  requestId: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Relay → Browser
export interface BrowserRegistered extends RelayMessage {
  type: typeof Msg.BROWSER_REGISTERED;
  sessionId: string;
}

export interface BrowserToolCall extends RelayMessage {
  type: typeof Msg.BROWSER_TOOL_CALL;
  requestId: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Relay → npx
export interface ClientConnected extends RelayMessage {
  type: typeof Msg.CLIENT_CONNECTED;
}

export interface ClientToolResult extends RelayMessage {
  type: typeof Msg.CLIENT_TOOL_RESULT;
  requestId: string;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface ClientError extends RelayMessage {
  type: typeof Msg.CLIENT_ERROR;
  requestId: string;
  message: string;
}

// --- Relay response (what client.call() returns) ---

export interface RelayResponse {
  content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

// --- Zod schemas for MCP tool definitions ---

import { z } from "zod";

export const fieldSchema = z.object({
  name: z.string(),
  type: z.string().describe("SQL data type, e.g. INT, VARCHAR(255)"),
  primary: z.boolean().optional(),
  unique: z.boolean().optional(),
  unsigned: z.boolean().optional(),
  nullable: z.boolean().optional(),
  increment: z.boolean().optional(),
  default_value: z.string().optional(),
  check: z.string().optional().describe("CHECK constraint expression"),
  comment: z.string().optional(),
  size: z.string().optional().describe("Type size/precision, e.g. '255' for VARCHAR(255)"),
  values: z.array(z.string()).optional().describe("Allowed values for ENUM/SET types"),
});

export const alterFieldSchema = z.object({
  name: z.string().describe("Existing field name"),
  new_name: z.string().optional(),
  type: z.string().optional(),
  primary: z.boolean().optional(),
  unique: z.boolean().optional(),
  unsigned: z.boolean().optional(),
  nullable: z.boolean().optional(),
  increment: z.boolean().optional(),
  default_value: z.string().optional(),
  check: z.string().optional(),
  comment: z.string().optional(),
  size: z.string().optional(),
});
