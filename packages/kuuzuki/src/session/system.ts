import { App } from "../app/app"
import { Ripgrep } from "../file/ripgrep"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { Config } from "../config/config"
import { parseAgentrc, agentrcToPrompt } from "../config/agentrc"
import path from "path"
import os from "os"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_ANTHROPIC_SPOOF from "./prompt/anthropic_spoof.txt"
import PROMPT_SUMMARIZE from "./prompt/summarize.txt"
import PROMPT_TITLE from "./prompt/title.txt"

export namespace SystemPrompt {
  export function header(providerID: string) {
    if (providerID.includes("anthropic")) return [PROMPT_ANTHROPIC_SPOOF.trim()]
    return []
  }
  export function provider(modelID: string) {
    if (modelID.includes("gpt-") || modelID.includes("o1") || modelID.includes("o3")) return [PROMPT_BEAST]
    if (modelID.includes("gemini-")) return [PROMPT_GEMINI]
    return [PROMPT_ANTHROPIC]
  }

  export async function environment() {
    const app = App.info()
    return [
      [
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${app.path.cwd}`,
        `  Is directory a git repo: ${app.git ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        `</env>`,
        `<project>`,
        `  ${
          app.git
            ? await Ripgrep.tree({
                cwd: app.path.cwd,
                limit: 200,
              })
            : ""
        }`,
        `</project>`,
      ].join("\n"),
    ]
  }

  const CUSTOM_FILES = [
    ".agentrc",
    "AGENTS.md", // legacy support
    "CLAUDE.md",
    "CONTEXT.md", // deprecated
  ]

  export async function custom() {
    const { cwd, root } = App.info().path
    const config = await Config.get()
    const found = []

    // Process custom files with special handling for .agentrc
    for (const item of CUSTOM_FILES) {
      const matches = await Filesystem.findUp(item, cwd, root)
      for (const match of matches) {
        if (item === ".agentrc") {
          // Parse .agentrc and convert to prompt format
          try {
            const content = await Bun.file(match).text()
            const agentrcConfig = parseAgentrc(content)
            found.push(agentrcToPrompt(agentrcConfig))
          } catch (error) {
            // If parsing fails, treat as regular text file
            found.push(Bun.file(match).text())
          }
        } else {
          found.push(Bun.file(match).text())
        }
      }
    }

    // Check global locations
    found.push(
      (async () => {
        try {
          const globalAgentrc = path.join(Global.Path.config, ".agentrc")
          const content = await Bun.file(globalAgentrc).text()
          const agentrcConfig = parseAgentrc(content)
          return agentrcToPrompt(agentrcConfig)
        } catch {
          // Fallback to legacy AGENTS.md
          return Bun.file(path.join(Global.Path.config, "AGENTS.md"))
            .text()
            .catch(() => "")
        }
      })(),
    )

    found.push(
      Bun.file(path.join(os.homedir(), ".claude", "CLAUDE.md"))
        .text()
        .catch(() => ""),
    )

    if (config.instructions) {
      for (const instruction of config.instructions) {
        try {
          const matches = await Filesystem.globUp(instruction, cwd, root)
          found.push(...matches.map((x) => Bun.file(x).text()))
        } catch {
          continue // Skip invalid glob patterns
        }
      }
    }

    return Promise.all(found).then((result) => result.filter(Boolean))
  }

  export function summarize(providerID: string) {
    switch (providerID) {
      case "anthropic":
        return [PROMPT_ANTHROPIC_SPOOF.trim(), PROMPT_SUMMARIZE]
      default:
        return [PROMPT_SUMMARIZE]
    }
  }

  export function title(providerID: string) {
    switch (providerID) {
      case "anthropic":
        return [PROMPT_ANTHROPIC_SPOOF.trim(), PROMPT_TITLE]
      default:
        return [PROMPT_TITLE]
    }
  }
}
