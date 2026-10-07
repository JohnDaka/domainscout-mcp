import { CLI_OPTION_PREFIX, CLI_VALUE_SEPARATOR, CliFlag } from '../constants.js';
import { CliLine } from '../messages/index.js';

/** What the command line asks for. */
export interface CliOptions {
  domains: string[];
  /** TLDs for names given without one, as typed: "com,net". */
  tlds?: string[];
  /** Print JSON instead of text. */
  json: boolean;
  /** Confirm free domains with registrar APIs. */
  confirm: boolean;
  /** Print the usage and stop. */
  help: boolean;
}

/** What an option does; `value` takes the option's value (--tlds com, or --tlds=com). */
type OptionHandler = (options: CliOptions, value: () => string) => void;

/** Every option and what it does. */
const OPTIONS: ReadonlyMap<string, OptionHandler> = new Map<string, OptionHandler>()
  .set(CliFlag.Json, (options) => {
    options.json = true;
  })
  .set(CliFlag.NoConfirm, (options) => {
    options.confirm = false;
  })
  .set(CliFlag.Help, (options) => {
    options.help = true;
  })
  .set(CliFlag.HelpShort, (options) => {
    options.help = true;
  })
  .set(CliFlag.Tlds, (options, value) => {
    options.tlds = [value()];
  })
  .set(CliFlag.TldsShort, (options, value) => {
    options.tlds = [value()];
  });

/** Reads the arguments after the command. Throws for an unknown option. */
export function parseCliArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = { domains: [], json: false, confirm: true, help: false };
  const pending = [...args];
  for (let arg = pending.shift(); arg !== undefined; arg = pending.shift()) {
    applyArg(options, arg, pending);
  }
  return options;
}

/** An option, or else a name to check. An option's value comes after "=" or as the next argument. */
function applyArg(options: CliOptions, arg: string, pending: string[]): void {
  const [flag, inlineValue] = splitOption(arg);
  const handler = OPTIONS.get(flag);
  if (handler) handler(options, () => inlineValue ?? pending.shift() ?? '');
  else if (arg.startsWith(CLI_OPTION_PREFIX)) throw new Error(CliLine.unknownOption(arg));
  else options.domains.push(arg);
}

/** "--tlds=com,net" -> ["--tlds", "com,net"]; anything else -> [arg, undefined]. */
function splitOption(arg: string): [string, string | undefined] {
  const separator = arg.indexOf(CLI_VALUE_SEPARATOR);
  if (!arg.startsWith(CLI_OPTION_PREFIX) || separator < 0) return [arg, undefined];
  return [arg.slice(0, separator), arg.slice(separator + CLI_VALUE_SEPARATOR.length)];
}
