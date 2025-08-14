import { describe, test, expect } from "bun:test";
import { SystemPrompt } from "../src/session/system";
import { ToolRegistry } from "../src/tool/registry";
import { getModelConfig, isToolCompatible, getToolStrategy } from "../src/session/model-config";

describe("Model-specific prompts and configurations", () => {
  describe("SystemPrompt.provider", () => {
    test("should return GPT-5 copilot prompt for gpt-5 models", () => {
      const prompts = SystemPrompt.provider("gpt-5-turbo");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("GPT-5 Copilot mode");
    });

    test("should return O1 prompt for o1 models", () => {
      const prompts = SystemPrompt.provider("o1-preview");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("O1 Reasoning Model");
    });

    test("should return Qwen prompt for qwen models", () => {
      const prompts = SystemPrompt.provider("qwen-turbo");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("Qwen Model Optimization");
    });

    test("should return Claude prompt for claude models", () => {
      const prompts = SystemPrompt.provider("claude-3-sonnet");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("Claude Model Optimization");
    });

    test("should return Gemini prompt for gemini models", () => {
      const prompts = SystemPrompt.provider("gemini-pro");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("kuuzuki, an interactive CLI agent");
    });

    test("should return Beast prompt for other GPT models", () => {
      const prompts = SystemPrompt.provider("gpt-4-turbo");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("autonomous agent");
    });

    test("should return Anthropic prompt as default", () => {
      const prompts = SystemPrompt.provider("unknown-model");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("kuuzuki");
    });
  });

  describe("ToolRegistry.enabled", () => {
    test("should disable patch tool for Claude models", () => {
      const enabled = ToolRegistry.enabled("anthropic", "claude-3-sonnet");
      expect(enabled.patch).toBe(false);
    });

    test("should disable multiple tools for Qwen models", () => {
      const enabled = ToolRegistry.enabled("alibaba", "qwen-turbo");
      expect(enabled.patch).toBe(false);
      expect(enabled.todowrite).toBe(false);
      expect(enabled.todoread).toBe(false);
      expect(enabled.task).toBe(false);
    });

    test("should disable patch tool for Gemini models", () => {
      const enabled = ToolRegistry.enabled("google", "gemini-pro");
      expect(enabled.patch).toBe(false);
    });

    test("should enable all tools for GPT-5 models", () => {
      const enabled = ToolRegistry.enabled("openai", "gpt-5-turbo");
      expect(Object.keys(enabled)).toHaveLength(0); // No restrictions
    });

    test("should disable patch for Anthropic provider", () => {
      const enabled = ToolRegistry.enabled("anthropic", "claude-3-opus");
      expect(enabled.patch).toBe(false);
    });

    test("should disable patch and task for Google provider", () => {
      const enabled = ToolRegistry.enabled("google", "gemini-1.5-pro");
      expect(enabled.patch).toBe(false);
      expect(enabled.task).toBe(false);
    });
  });

  describe("Model configuration system", () => {
    test("should get configuration for GPT-5 models", () => {
      const config = getModelConfig("gpt-5-turbo");
      expect(config).toBeTruthy();
      expect(config?.promptOptimizations.toolStrategy).toBe("parallel");
      expect(config?.performance.batchSize).toBe(5);
    });

    test("should get configuration for O1 models", () => {
      const config = getModelConfig("o1-preview");
      expect(config).toBeTruthy();
      expect(config?.promptOptimizations.toolStrategy).toBe("sequential");
      expect(config?.performance.batchSize).toBe(2);
    });

    test("should get configuration for Qwen models", () => {
      const config = getModelConfig("qwen-turbo");
      expect(config).toBeTruthy();
      expect(config?.promptOptimizations.toolStrategy).toBe("sequential");
      expect(config?.toolCompatibility.avoided).toContain("patch");
    });

    test("should return null for unknown models", () => {
      const config = getModelConfig("unknown-model-xyz");
      expect(config).toBeNull();
    });
  });

  describe("Tool compatibility checking", () => {
    test("should mark patch as incompatible with Claude models", () => {
      const compatible = isToolCompatible("patch", "claude-3-sonnet", "anthropic");
      expect(compatible).toBe(false);
    });

    test("should mark todowrite as incompatible with Qwen models", () => {
      const compatible = isToolCompatible("todowrite", "qwen-turbo", "alibaba");
      expect(compatible).toBe(false);
    });

    test("should mark bash as compatible with all models", () => {
      const claudeCompatible = isToolCompatible("bash", "claude-3-sonnet", "anthropic");
      const qwenCompatible = isToolCompatible("bash", "qwen-turbo", "alibaba");
      const gptCompatible = isToolCompatible("bash", "gpt-4", "openai");
      
      expect(claudeCompatible).toBe(true);
      expect(qwenCompatible).toBe(true);
      expect(gptCompatible).toBe(true);
    });

    test("should mark edit as compatible with Claude models", () => {
      const compatible = isToolCompatible("edit", "claude-3-sonnet", "anthropic");
      expect(compatible).toBe(true);
    });
  });

  describe("Tool strategy selection", () => {
    test("should return parallel strategy for GPT-5 models", () => {
      const strategy = getToolStrategy("gpt-5-turbo", "openai");
      expect(strategy).toBe("parallel");
    });

    test("should return sequential strategy for O1 models", () => {
      const strategy = getToolStrategy("o1-preview", "openai");
      expect(strategy).toBe("sequential");
    });

    test("should return sequential strategy for Qwen models", () => {
      const strategy = getToolStrategy("qwen-turbo", "alibaba");
      expect(strategy).toBe("sequential");
    });

    test("should return parallel as default strategy", () => {
      const strategy = getToolStrategy("unknown-model", "unknown-provider");
      expect(strategy).toBe("parallel");
    });
  });

  describe("Tool filtering integration", () => {
    test("should filter tools based on model compatibility using enabled function", () => {
      // Test with Qwen model that should have restricted tools
      const qwenEnabled = ToolRegistry.enabled("alibaba", "qwen-turbo");
      
      expect(qwenEnabled.patch).toBe(false);
      expect(qwenEnabled.todowrite).toBe(false);
      expect(qwenEnabled.todoread).toBe(false);
      expect(qwenEnabled.task).toBe(false);
    });

    test("should include all tools for GPT-5 models using enabled function", () => {
      const gpt5Enabled = ToolRegistry.enabled("openai", "gpt-5-turbo");
      
      // GPT-5 should have no restrictions (empty object)
      expect(Object.keys(gpt5Enabled)).toHaveLength(0);
    });

    test("should filter patch tool for Claude models using enabled function", () => {
      const claudeEnabled = ToolRegistry.enabled("anthropic", "claude-3-sonnet");
      
      expect(claudeEnabled.patch).toBe(false);
    });
  });
});