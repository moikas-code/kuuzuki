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
import PROMPT_GPT5_COPILOT from "./prompt/gpt5-copilot.txt"
import PROMPT_QWEN from "./prompt/qwen.txt"
import PROMPT_CLAUDE from "./prompt/claude.txt"
import PROMPT_O1 from "./prompt/o1.txt"
import PROMPT_SUMMARIZE from "./prompt/summarize.txt"
import PROMPT_TITLE from "./prompt/title.txt"

export namespace SystemPrompt {
  export function header(providerID: string) {
    if (providerID.includes("anthropic")) return [PROMPT_ANTHROPIC_SPOOF.trim()]
    return []
  }

  export function getModelCapabilities(modelID: string) {
    const model = modelID.toLowerCase()
    
    return {
      reasoning: model.includes("o1") || model.includes("o3") || model.includes("reasoning"),
      multimodal: model.includes("gpt-4") || model.includes("claude") || model.includes("gemini"),
      coding: true, // All models support coding
      autonomous: model.includes("gpt-") || model.includes("claude"),
      efficiency: model.includes("gpt-5") || model.includes("copilot"),
      multilingual: model.includes("qwen") || model.includes("gemini"),
      safety: model.includes("claude") || model.includes("gemini")
    }
  }
  export function provider(modelID: string) {
    const model = modelID.toLowerCase()
    
    // GPT-5 and Copilot models - Advanced reasoning and efficiency
    if (model.includes("gpt-5") || model.includes("copilot") || model.includes("gpt-4o-copilot")) {
      return [PROMPT_GPT5_COPILOT]
    }
    
    // O1 reasoning models - Deep analytical thinking
    if (model.includes("o1") || model.includes("o3") || model.includes("reasoning")) {
      return [PROMPT_O1]
    }
    
    // GPT-4 models - Beast mode for complex tasks
    if (model.includes("gpt-4") && !model.includes("copilot")) {
      return [PROMPT_BEAST]
    }
    
    // Other GPT models - Standard beast mode
    if (model.includes("gpt-")) {
      return [PROMPT_BEAST]
    }
    
    // Gemini models - Google's optimization
    if (model.includes("gemini") || model.includes("bard")) {
      return [PROMPT_GEMINI]
    }
    
    // Qwen models - Alibaba's optimization
    if (model.includes("qwen") || model.includes("qwen2")) {
      return [PROMPT_QWEN]
    }
    
    // Claude models - Anthropic's optimization
    if (model.includes("claude") || model.includes("sonnet") || model.includes("haiku") || model.includes("opus")) {
      return [PROMPT_CLAUDE]
    }
    
    // Default to Anthropic prompt for other models
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
