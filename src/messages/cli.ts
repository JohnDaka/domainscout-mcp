import { CliCommand, CliFlag, COMMAND_NAME, SERVER_NAME } from '../constants.js';

/** The CLI's help text. */
export const CLI_USAGE = `\
Usage:
  ${COMMAND_NAME} [${CliCommand.Serve}]                 run as an MCP server (stdio)
  ${COMMAND_NAME} ${CliCommand.Check} <names...>        check from the command line
      ${CliFlag.Tlds} com,net,ai                   TLDs for names without one
      ${CliFlag.Json}                              print JSON instead of text
      ${CliFlag.NoConfirm}                        skip registrar API confirmation

Examples:
  ${COMMAND_NAME} ${CliCommand.Check} acme
  ${COMMAND_NAME} ${CliCommand.Check} acme coolapp.io ${CliFlag.Tlds} com,dev`;

/** Lines the CLI and the server print. */
export const CliLine = {
  /** An option the CLI does not know. */
  unknownOption: (option: string): string => `Unknown option: ${option}`,
  /** A command the CLI does not know. */
  unknownCommand: (command: string): string =>
    `Unknown command: ${command}. Run with ${CliFlag.Help}.`,
  /** A configuration warning on the terminal. */
  warning: (text: string): string => `warning: ${text}`,
  /** "[12/500] acme.com: taken" */
  progress: (done: number, total: number, name: string, status: string): string =>
    `[${done}/${total}] ${name}: ${status}`,
  /** A server log line on stderr: "[domainscout] …" */
  log: (text: string): string => `[${SERVER_NAME}] ${text}`,
  /** The server's start-up line. */
  ready: (version: string, defaultTlds: string): string =>
    `v${version} ready, default TLDs: ${defaultTlds}`,
} as const;
