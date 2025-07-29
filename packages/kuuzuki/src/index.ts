import "zod-openapi/extend"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
import { SchemaCommand } from "./cli/cmd/schema"
import { Log } from "./util/log"
import { AuthCommand } from "./cli/cmd/auth"
import { BillingCommand } from "./cli/cmd/billing"
import { ApiKeyCommand } from "./cli/cmd/apikey"
import { AgentCommand } from "./cli/cmd/agent"
import { UpgradeCommand } from "./cli/cmd/upgrade"
import { ModelsCommand } from "./cli/cmd/models"
import { UI } from "./cli/ui"
import { Installation } from "./installation"
import { NamedError } from "./util/error"
import { FormatError } from "./cli/error"
import { ServeCommand } from "./cli/cmd/serve"
import { TuiCommand } from "./cli/cmd/tui"
import { DebugCommand } from "./cli/cmd/debug"
import { StatsCommand } from "./cli/cmd/stats"
import { McpCommand } from "./cli/cmd/mcp"
import { GithubCommand } from "./cli/cmd/github"
import {
  GitPermissionsStatusCommand,
  GitPermissionsAllowCommand,
  GitPermissionsDenyCommand,
  GitPermissionsResetCommand,
  GitPermissionsConfigureCommand,
} from "./cli/cmd/git-permissions"
import { HybridCommand } from "./cli/cmd/hybrid"
import { Trace } from "./trace"

Trace.init()

const cancel = new AbortController()

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
  })
})

const cli = yargs(hideBin(process.argv))
  .scriptName("kuuzuki")
  .help("help", "show help")
  .version("version", "show version number", Installation.VERSION)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .middleware(async (opts) => {
    await Log.init({
      print: process.argv.includes("--print-logs"),
      dev: Installation.isDev(),
      level: (() => {
        if (opts.logLevel) return opts.logLevel as Log.Level
        if (Installation.isDev()) return "DEBUG"
        return "INFO"
      })(),
    })

    Log.Default.info("kuuzuki", {
      version: Installation.VERSION,
      args: process.argv.slice(2),
    })
  })
  .usage("\n" + UI.logo())
  .command(McpCommand)
  .command(TuiCommand)
  .command(RunCommand)
  .command(GenerateCommand)
  .command(SchemaCommand)
  .command(DebugCommand)
  .command(AuthCommand)
  .command(BillingCommand)
  .command(ApiKeyCommand)
  .command(AgentCommand)
  .command(UpgradeCommand)
  .command(ServeCommand)
  .command(ModelsCommand)
  .command(StatsCommand)
  .command(GithubCommand)
  .command(GitPermissionsStatusCommand)
  .command(GitPermissionsAllowCommand)
  .command(GitPermissionsDenyCommand)
  .command(GitPermissionsResetCommand)
  .command(GitPermissionsConfigureCommand)
  .command(HybridCommand)
  .fail((msg) => {
    if (msg.startsWith("Unknown argument") || msg.startsWith("Not enough non-option arguments")) {
      cli.showHelp("log")
    }
  })
  .strict()

try {
  // If no command is provided, default to TUI
  const args = process.argv.slice(2)
  if (args.length === 0 || (args.length === 1 && args[0].startsWith("-"))) {
    await cli.parse(["tui", ...args])
  } else {
    await cli.parse()
  }
} catch (e) {
  let data: Record<string, any> = {}
  if (e instanceof NamedError) {
    const obj = e.toObject()
    Object.assign(data, {
      ...obj.data,
    })
  }

  if (e instanceof Error) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      cause: e.cause?.toString(),
    })
  }

  if (e instanceof ResolveMessage) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      code: e.code,
      specifier: e.specifier,
      referrer: e.referrer,
      position: e.position,
      importKind: e.importKind,
    })
  }
  Log.Default.error("fatal", data)
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) UI.error("Unexpected error, check log file at " + Log.file() + " for more details")
  process.exitCode = 1
}

cancel.abort()
