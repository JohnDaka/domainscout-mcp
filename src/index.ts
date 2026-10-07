#!/usr/bin/env node
import { loadConfig } from './config/config.js';
import { VERSION } from './config/version.js';
import { ARGV_FIRST_USER_ARG, CliCommand, CliFlag, ExitCode } from './constants.js';
import { CLI_USAGE, CliLine } from './messages/index.js';

/** Runs with the arguments after the command and returns the exit code. */
type Command = (args: string[]) => Promise<number>;

/** What each first argument runs. The server and the CLI load only when they are needed. */
const COMMANDS: ReadonlyMap<string, Command> = new Map<string, Command>()
  .set(CliCommand.Serve, serve)
  .set(CliCommand.Check, check)
  .set(CliFlag.Version, printVersion)
  .set(CliFlag.VersionShort, printVersion)
  .set(CliFlag.Help, printHelp)
  .set(CliFlag.HelpShort, printHelp);

const [command = CliCommand.Serve, ...args] = process.argv.slice(ARGV_FIRST_USER_ARG);
const run = COMMANDS.get(command) ?? (() => unknownCommand(command));
process.exitCode = await run(args);

/** Serves MCP over stdio until the client disconnects. */
async function serve(): Promise<number> {
  const { startServer } = await import('./server/server.js');
  await startServer(loadConfig());
  return ExitCode.Ok;
}

async function check(commandArgs: string[]): Promise<number> {
  const { runCli } = await import('./cli/cli.js');
  return runCli(commandArgs, loadConfig());
}

async function printVersion(): Promise<number> {
  console.log(VERSION);
  return ExitCode.Ok;
}

async function printHelp(): Promise<number> {
  console.log(CLI_USAGE);
  return ExitCode.Ok;
}

async function unknownCommand(name: string): Promise<number> {
  console.error(CliLine.unknownCommand(name));
  return ExitCode.Usage;
}
