import { App } from "../app/app";
import { Config } from "../config/config";
import z from "zod";
import { Provider } from "../provider/provider";

export namespace Mode {
  export const Info = z
    .object({
      name: z.string(),
      temperature: z.number().optional(),
      model: z
        .object({
          modelID: z.string(),
          providerID: z.string(),
        })
        .optional(),
      prompt: z.string().optional(),
      tools: z.record(z.boolean()),
    })
    .openapi({
      ref: "Mode",
    });
  export type Info = z.infer<typeof Info>;
  const state = App.state("mode", async () => {
    const cfg = await Config.get();
    const model = cfg.model ? Provider.parseModel(cfg.model) : undefined;
    const result: Record<string, Info> = {
      build: {
        model,
        name: "build",
        tools: {},
      },
      plan: {
        name: "plan",
        model,
        tools: {
          write: false,
          edit: false,
          patch: false,
        },
      },
      chat: {
        name: "chat",
        model,
        tools: {
          write: false,
          edit: false,
          patch: false,
          bash: false,
          todowrite: false,
        },
      },
      bugfinder: {
        name: "bugfinder",
        model,
        tools: {
          read: true,
          grep: true,
          bash: true,
          todowrite: true,
          todoread: true,
          write: true,
          edit: true,
          patch: true,
          task: true,
          moidvk_check_code_practices: true,
          moidvk_scan_security_vulnerabilities: true,
          moidvk_check_production_readiness: true,
          moidvk_multi_language_auto_fixer: true,
          moidvk_check_safety_rules: true,
          moidvk_js_performance_analyzer: true,
          moidvk_python_performance_analyzer: true,
          moidvk_rust_performance_analyzer: true,
          moidvk_go_performance_analyzer: true,
        },
      },
    };
    for (const [key, value] of Object.entries(cfg.mode ?? {})) {
      // Type assertion to ensure value conforms to expected mode config structure
      const modeValue = value as {
        disable?: boolean;
        model?: string;
        prompt?: string;
        temperature?: number;
        tools?: Record<string, boolean>;
      };

      if (modeValue.disable) continue;
      let item = result[key];
      if (!item)
        item = result[key] = {
          name: key,
          tools: {},
        };
      item.name = key;
      if (modeValue.model) item.model = Provider.parseModel(modeValue.model);
      if (modeValue.prompt) item.prompt = modeValue.prompt;
      if (modeValue.temperature) item.temperature = modeValue.temperature;
      if (modeValue.tools)
        item.tools = {
          ...modeValue.tools,
          ...item.tools,
        };
    }

    return result;
  });

  export async function get(mode: string) {
    return state().then((x) => x[mode]);
  }

  export async function list() {
    return state().then((x) => Object.values(x));
  }
}
