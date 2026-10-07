import type { Config } from '../config/config.js';
import { ANSI_CLEAR_LINE, ExitCode, JSON_INDENT, TextSeparator } from '../constants.js';
import { errorMessage } from '../core/errors.js';
import type { ScoutServices } from '../core/services.js';
import type { CheckOutcome, CheckProgress, InvalidEntry, Report } from '../core/types.js';
import { CLI_USAGE, CliLine } from '../messages/index.js';
import { rejectionText, summarize } from '../report/summary.js';
import { TextReport } from '../report/text-report.js';
import { DomainScout } from '../scout/domain-scout.js';
import { type CliOptions, parseCliArgs } from './cli-args.js';

/** `domainscout-mcp check ...`: the same check as the MCP tool, for the terminal and for debugging. */
export async function runCli(
  args: readonly string[],
  config: Config,
  services: Partial<ScoutServices> = {},
): Promise<number> {
  let options: CliOptions;
  try {
    options = parseCliArgs(args);
  } catch (error) {
    return usageError(errorMessage(error));
  }
  if (options.help) return printUsage();
  if (options.domains.length === 0) return usageError();

  for (const warning of config.warnings) console.error(CliLine.warning(warning));
  const outcome = await check(options, config, services);
  if (!outcome.ok) return printRejection(outcome.message, outcome.invalid);
  console.log(options.json ? jsonReport(outcome.report) : new TextReport(outcome.report).render());
  return ExitCode.Ok;
}

/** The usage text, for --help and for running without a command's arguments. */
function printUsage(): number {
  console.log(CLI_USAGE);
  return ExitCode.Ok;
}

/** Runs the check, with a progress line on an interactive terminal. */
async function check(
  options: CliOptions,
  config: Config,
  services: Partial<ScoutServices>,
): Promise<CheckOutcome> {
  const showProgress = process.stderr.isTTY === true;
  const request = { domains: options.domains, tlds: options.tlds, confirm: options.confirm };
  const onProgress = showProgress ? printProgress : undefined;
  const outcome = await new DomainScout(config, services).check(request, { onProgress });
  if (showProgress) process.stderr.write(ANSI_CLEAR_LINE);
  return outcome;
}

/** "[12/500] acme.com: taken", rewritten in place. */
function printProgress({ done, total, result }: CheckProgress): void {
  const line = CliLine.progress(done, total, result.display, result.status);
  process.stderr.write(`${ANSI_CLEAR_LINE}${line}`);
}

/** The report with its summary, as JSON. */
function jsonReport(report: Report): string {
  return JSON.stringify({ summary: summarize(report), ...report }, null, JSON_INDENT);
}

/** What was wrong (when there is something to say), then the usage. */
function usageError(problem?: string): number {
  console.error(problem ? `${problem}${TextSeparator.Section}${CLI_USAGE}` : CLI_USAGE);
  return ExitCode.Usage;
}

function printRejection(message: string, invalid: readonly InvalidEntry[]): number {
  console.error(rejectionText(message, invalid));
  return ExitCode.Failed;
}
