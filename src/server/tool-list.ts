import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type ZodRawShape, z } from 'zod';

/** The key that names a JSON Schema's dialect. */
const DIALECT_KEY = '$schema';
/** What a schema describes: the arguments a tool takes, or the result it gives. */
const SchemaIo = {
  Input: 'input',
  Output: 'output',
} as const;
/** The tool runs as a plain call, never as an MCP task: as the SDK lists it. */
const EXECUTION: Tool['execution'] = { taskSupport: 'forbidden' };

/** What a tool is registered with: its texts, hints and Zod shapes. */
export interface ListedTool {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShape;
  outputSchema: ZodRawShape;
  annotations: Tool['annotations'];
}

/**
 * A shape as JSON Schema with no "$schema" key. The SDK marks every schema draft-07, and clients
 * that follow MCP's default, 2020-12, refuse a tool whose schema names another dialect. Ours mean
 * the same in both, so without the key every client reads them in its own default.
 */
function plainJsonSchema(shape: ZodRawShape, io: (typeof SchemaIo)[keyof typeof SchemaIo]) {
  const { [DIALECT_KEY]: _dialect, ...schema } = z.toJSONSchema(z.object(shape), { io });
  return schema as Tool['inputSchema'];
}

/** A tool as tools/list describes it. */
function toolDefinition(tool: ListedTool): Tool {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: plainJsonSchema(tool.inputSchema, SchemaIo.Input),
    outputSchema: plainJsonSchema(tool.outputSchema, SchemaIo.Output),
    annotations: tool.annotations,
    execution: EXECUTION,
  };
}

/**
 * Answers tools/list in place of the SDK's handler, with schemas every client accepts. Calls still
 * go through the SDK, which checks the arguments and the result against the same Zod shapes.
 */
export function listToolsWithPlainSchemas(server: McpServer, tools: readonly ListedTool[]): void {
  const definitions = tools.map(toolDefinition);
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: definitions }));
}
