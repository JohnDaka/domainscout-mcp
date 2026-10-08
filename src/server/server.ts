import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { Config } from '../config/config.js';
import { VERSION } from '../config/version.js';
import {
  MCP_PROGRESS_METHOD,
  McpContentType,
  TextSeparator,
  TOOL_CHECK_DOMAINS,
} from '../constants.js';
import type { ScoutServices } from '../core/services.js';
import type { DomainAnswer, DomainResult, ProgressListener, Report } from '../core/types.js';
import {
  AFFILIATE_DISCLOSURE,
  CliLine,
  progressText,
  toolInstructions,
} from '../messages/index.js';
import { hasAffiliateLinks, rejectionText, summarize } from '../report/summary.js';
import { TextReport } from '../report/text-report.js';
import { DomainScout } from '../scout/domain-scout.js';
import { RESULTS_UI_TOOL_META, registerResultsUi } from './results-ui.js';
import { checkDomainsTool } from './schemas.js';
import { serverInfo } from './server-info.js';
import { listToolsWithPlainSchemas } from './tool-list.js';

/** What a tool handler gets besides its arguments: the cancel signal, progress token and notifications. */
type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/** The MCP server with its one tool, check_domains. */
export function createServer(config: Config, services: Partial<ScoutServices> = {}): McpServer {
  const scout = new DomainScout(config, services);
  const defaultTlds = config.defaultTlds.join(TextSeparator.List);
  const server = new McpServer(serverInfo(), { instructions: toolInstructions(defaultTlds) });
  const tool = { ...checkDomainsTool(defaultTlds), _meta: RESULTS_UI_TOOL_META };
  registerResultsUi(server);
  server.registerTool(TOOL_CHECK_DOMAINS, tool, async (input, extra) => {
    const { domains, tlds, confirm, details = false } = input;
    const options = { signal: extra.signal, onProgress: progressReporter(extra) };
    const outcome = await scout.check({ domains, tlds, confirm }, options);
    if (!outcome.ok) return errorResult(rejectionText(outcome.message, outcome.invalid));
    return reportResult(outcome.report, details);
  });
  listToolsWithPlainSchemas(server, [{ name: TOOL_CHECK_DOMAINS, ...tool }]);
  return server;
}

/** Serves MCP over stdio (or the given transport). Logs go to stderr: stdout belongs to the protocol. */
export async function startServer(
  config: Config,
  transport: Transport = new StdioServerTransport(),
): Promise<void> {
  for (const warning of config.warnings) console.error(CliLine.log(warning));
  await createServer(config).connect(transport);
  const defaultTlds = config.defaultTlds.join(TextSeparator.List);
  console.error(CliLine.log(CliLine.ready(VERSION, defaultTlds)));
}

/** The report as text for the model, and as structured content that matches the output schema. */
function reportResult(report: Report, details: boolean): CallToolResult {
  return {
    content: [{ type: McpContentType.Text, text: new TextReport(report).render() }],
    structuredContent: {
      summary: summarize(report),
      tlds: report.tlds,
      results: report.results.map((result) => (details ? result : withoutEvidence(result))),
      invalid: report.invalid,
      warnings: report.warnings,
      ...(hasAffiliateLinks(report) && { disclosure: AFFILIATE_DISCLOSURE }),
    },
  };
}

/** A rejected call. Output validation does not apply to errors. */
function errorResult(text: string): CallToolResult {
  return { isError: true, content: [{ type: McpContentType.Text, text }] };
}

/** Evidence is long; it is included only when the caller asks for details. */
function withoutEvidence({ evidence: _evidence, ...answer }: DomainResult): DomainAnswer {
  return answer;
}

/** One progress notification per checked domain, when the client asked for progress. */
function progressReporter(extra: ToolExtra): ProgressListener | undefined {
  const progressToken = extra._meta?.progressToken;
  if (progressToken === undefined) return undefined;
  return ({ done, total, result }) => {
    const message = progressText(result.display, result.status);
    extra
      .sendNotification({
        method: MCP_PROGRESS_METHOD,
        params: { progressToken, progress: done, total, message },
      })
      .catch(ignoreProgressFailure);
  };
}

/** Progress is best effort: a client that went away must not fail the check. */
function ignoreProgressFailure(): void {}
