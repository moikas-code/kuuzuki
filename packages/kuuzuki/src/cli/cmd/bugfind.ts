import type { Argv } from "yargs";
import { Bus } from "../../bus";
import { Provider } from "../../provider/provider";
import { Session } from "../../session";
import { UI } from "../ui";
import { cmd } from "./cmd";
import { bootstrap } from "../bootstrap";
import { MessageV2 } from "../../session/message-v2";
import { Identifier } from "../../id/id";
import { watch } from "fs";
const TOOL: Record<string, [string, string]> = {
  moidvk_check_code_practices: ["CodeCheck", UI.Style.TEXT_INFO_BOLD],
  moidvk_scan_security_vulnerabilities: ["Security", UI.Style.TEXT_DANGER_BOLD],
  moidvk_check_production_readiness: ["Production", UI.Style.TEXT_WARNING_BOLD],
  moidvk_multi_language_auto_fixer: ["AutoFix", UI.Style.TEXT_SUCCESS_BOLD],
  bash: ["Bash", UI.Style.TEXT_DANGER_BOLD],
  read: ["Read", UI.Style.TEXT_HIGHLIGHT_BOLD],
  grep: ["Grep", UI.Style.TEXT_INFO_BOLD],
  glob: ["Glob", UI.Style.TEXT_INFO_BOLD],
};

export const BugfindCommand = cmd({
  command: "bugfind [path]",
  describe: "Run bugfinder agent for systematic bug detection and analysis",
  builder: (yargs: Argv) => {
    return yargs
      .positional("path", {
        describe: "path to analyze",
        type: "string",
        default: ".",
      })
      .option("frequency", {
        alias: ["f"],
        describe: "run every N seconds (0 = run once)",
        type: "number",
        default: 0,
      })
      .option("severity", {
        describe: "minimum severity level to report",
        type: "string",
        choices: ["low", "medium", "high", "critical"],
        default: "medium",
      })
      .option("watch", {
        alias: ["w"],
        describe: "watch for file changes and re-run automatically",
        type: "boolean",
        default: false,
      })
      .option("debounce", {
        alias: ["d"],
        describe: "debounce time in milliseconds for file watching",
        type: "number",
        default: 5000,
      })
      .option("exclude", {
        alias: ["e"],
        describe: "patterns to exclude from analysis",
        type: "array",
        default: ["node_modules", ".git", "dist", "build"],
      })
      .option("autofix", {
        alias: ["a"],
        describe: "attempt to automatically fix issues",
        type: "boolean",
        default: false,
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("debug", {
        type: "boolean",
        describe: "Enable debug logging",
        default: false,
      });
  },
  handler: async (args) => {
    if (args.debug) {
      process.env.KUUZUKI_DEBUG = "true";
    }

    await bootstrap({ cwd: process.cwd() }, async () => {
      UI.empty();
      UI.println(UI.logo());
      UI.empty();
      UI.println(UI.Style.TEXT_INFO_BOLD + "🔍 Bugfinder Agent");
      UI.println(UI.Style.TEXT_NORMAL + `   Path: ${args.path}`);
      UI.println(UI.Style.TEXT_NORMAL + `   Severity: ${args.severity}`);
      if (args.frequency > 0) {
        UI.println(
          UI.Style.TEXT_NORMAL + `   Frequency: every ${args.frequency}s`,
        );
      }
      if (args.watch) {
        UI.println(
          UI.Style.TEXT_NORMAL +
            `   Watch mode: enabled (debounce: ${args.debounce}ms)`,
        );
      }
      UI.empty();

      const runBugfinder = async () => {
        const session = await Session.create();
        const { providerID, modelID } = args.model
          ? Provider.parseModel(args.model)
          : await Provider.defaultModel();

        UI.println(
          UI.Style.TEXT_NORMAL_BOLD + "@ ",
          UI.Style.TEXT_NORMAL + `${providerID}/${modelID}`,
        );
        UI.empty();

        function printEvent(color: string, type: string, title: string) {
          UI.println(
            color + `|`,
            UI.Style.TEXT_NORMAL +
              UI.Style.TEXT_DIM +
              ` ${type.padEnd(12, " ")}`,
            "",
            UI.Style.TEXT_NORMAL + title,
          );
        }

        let text = "";
        const unsub = Bus.subscribe(
          MessageV2.Event.PartUpdated,
          async (evt) => {
            if (evt.properties.part.sessionID !== session.id) return;
            const part = evt.properties.part;

            if (part.type === "tool" && part.state.status === "completed") {
              const [tool, color] = TOOL[part.tool] ?? [
                part.tool,
                UI.Style.TEXT_INFO_BOLD,
              ];
              const title = part.state.title || "Analysis complete";
              printEvent(color, tool, title);
            }

            if (part.type === "text") {
              text = part.text;
              if (part.time?.end) {
                UI.empty();
                UI.println(UI.markdown(text));
                UI.empty();
                text = "";
              }
            }
          },
        );

        Bus.subscribe(Session.Event.Error, async (evt) => {
          const { sessionID, error } = evt.properties;
          if (sessionID !== session.id || !error) return;
          let err = String(error.name);
          if ("data" in error && error.data && "message" in error.data) {
            err = error.data.message;
          }
          UI.error(err);
        });

        const prompt = `Analyze the codebase at path "${args.path}" for bugs, security issues, and code quality problems. 
        
Focus on:
- Code quality issues and potential bugs
- Security vulnerabilities in dependencies and code
- Production readiness issues
- Performance problems
- Safety violations

Minimum severity level: ${args.severity}
${args.autofix ? "Attempt to automatically fix issues where possible." : ""}

Use moidvk tools for comprehensive analysis. Provide specific file locations and line numbers for all issues found.`;

        const messageID = Identifier.ascending("message");
        await Session.chat({
          sessionID: session.id,
          messageID,
          providerID,
          modelID,
          mode: "bugfinder",
          system:
            "You are an expert debugging agent focused on systematic bug identification, root cause analysis, and providing actionable solutions. Use moidvk tools for comprehensive code analysis, security scanning, and quality checks. Always provide specific file locations and line numbers for issues found.",
          tools: {
            bash: true,
            read: true,
            write: args.autofix,
            edit: args.autofix,
            grep: true,
            glob: true,
            todowrite: false,
            todoread: false,
            task: false,
            moidvk_check_code_practices: true,
            moidvk_scan_security_vulnerabilities: true,
            moidvk_check_production_readiness: true,
            moidvk_multi_language_auto_fixer: args.autofix,
            moidvk_check_safety_rules: true,
            moidvk_js_performance_analyzer: true,
            moidvk_python_performance_analyzer: true,
            moidvk_rust_performance_analyzer: true,
          },
          parts: [
            {
              id: Identifier.ascending("part"),
              type: "text",
              text: prompt,
            },
          ],
        });

        unsub();
        UI.empty();
        UI.println(
          UI.Style.TEXT_SUCCESS_BOLD + "✓ Bugfinder analysis complete",
        );
        UI.empty();
      };

      // Run once initially
      await runBugfinder();

      // Set up frequency-based execution
      if (args.frequency > 0) {
        UI.println(
          UI.Style.TEXT_INFO_BOLD +
            `⏰ Running every ${args.frequency} seconds...`,
        );
        setInterval(runBugfinder, args.frequency * 1000);
      }

      // Set up file watching
      if (args.watch) {
        UI.println(UI.Style.TEXT_INFO_BOLD + `👀 Watching for file changes...`);
        let debounceTimer: NodeJS.Timeout | null = null;

        const watcher = watch(args.path, { recursive: true }, (_, filename) => {
          if (!filename) return;

          // Skip excluded patterns
          const shouldExclude = args.exclude.some((pattern: string) =>
            filename.includes(pattern),
          );
          if (shouldExclude) return;

          // Skip non-code files
          const codeExtensions = [
            ".ts",
            ".js",
            ".tsx",
            ".jsx",
            ".py",
            ".rs",
            ".go",
            ".java",
            ".cpp",
            ".c",
            ".h",
          ];
          const hasCodeExtension = codeExtensions.some((ext) =>
            filename.endsWith(ext),
          );
          if (!hasCodeExtension) return;

          if (debounceTimer) clearTimeout(debounceTimer);

          debounceTimer = setTimeout(async () => {
            UI.println(
              UI.Style.TEXT_WARNING_BOLD + `📝 File changed: ${filename}`,
            );
            UI.println(
              UI.Style.TEXT_INFO_BOLD + "🔄 Re-running bugfinder analysis...",
            );
            UI.empty();
            await runBugfinder();
          }, args.debounce);
        });

        // Keep the process alive for watching
        process.on("SIGINT", () => {
          watcher.close();
          process.exit(0);
        });
      }

      // If not watching or using frequency, exit after first run
      if (!args.watch && args.frequency === 0) {
        return;
      }
    });
  },
});
