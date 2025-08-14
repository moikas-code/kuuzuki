import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { SmartRuleGeneratorTool } from "../src/tool/smart-rule-generator";
import { CodePatternDetectorTool } from "../src/tool/code-pattern-detector";
import { SmartDocumentationLinkerTool } from "../src/tool/smart-documentation-linker";
import { ContextAwareRuleActivator } from "../src/tool/context-aware-rule-activator";
import { SmartLearningAssistantTool } from "../src/tool/smart-learning-assistant";
import { IntelligentRuleOptimizerTool } from "../src/tool/intelligent-rule-optimizer";
import { MemoryStorage } from "../src/tool/memory-storage";
import { App } from "../src/app/app";
import { Permission } from "../src/permission";
import * as fs from "fs/promises";
import * as path from "path";

describe("Smart AI Tools Test Suite", () => {
  const testDir = "/tmp/test-kuuzuki-smart-ai-tools";
  let storage: MemoryStorage;
  
  const mockContext = {
    sessionID: "test-session",
    messageID: "test-message", 
    toolCallID: "test-tool-call",
    abort: new AbortController().signal,
    metadata: () => {},
  };

  const originalAsk = Permission.ask;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test source files for pattern detection
    await createTestSourceFiles();
    
    // Change to test directory
    process.chdir(testDir);
    
    // Create test instance of storage
    storage = MemoryStorage.createTestInstance(path.join(testDir, "test-memory.db"));
    
    // Mock permissions
    Permission.ask = mock(async () => Promise.resolve());
    
    // Mock App.info() to return test directory
    App.info = mock(() => ({
      hostname: "test-host",
      git: true,
      path: { 
        config: testDir,
        data: testDir,
        root: testDir, 
        cwd: testDir,
        state: testDir,
      },
      time: { initialized: Date.now() },
    }));
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    
    // Restore original functions
    Permission.ask = originalAsk;
    
    // Close storage
    storage?.close();
  });

  async function createTestSourceFiles(): Promise<void> {
    const srcDir = path.join(testDir, "src");
    await fs.mkdir(srcDir, { recursive: true });
    
    // TypeScript file with patterns
    await fs.writeFile(path.join(srcDir, "example.ts"), `
import { Tool } from "./tool";
import { z } from "zod";

export const ExampleTool = Tool.define("example", {
  description: "Example tool for testing",
  parameters: z.object({
    action: z.string(),
    data: z.any().optional(),
  }),
  
  async execute(params, ctx) {
    const result = await processData(params.data);
    return { title: "Example", output: result };
  }
});

function processData(data: any): string {
  if (!data) return "No data";
  return JSON.stringify(data);
}

const config = {
  timeout: 5000,
  retries: 3,
};
`);

    // JavaScript file with patterns
    await fs.writeFile(path.join(srcDir, "utils.js"), `
const fs = require('fs');
const path = require('path');

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}

const helper = (data) => {
  return data.map(item => item.value);
};

module.exports = { readFile, helper };
`);

    // Documentation file
    await fs.writeFile(path.join(testDir, "README.md"), `
# Test Project

This is a test project for Smart AI Tools.

## Patterns

- Use TypeScript for type safety
- Prefer const over let
- Always handle errors gracefully
`);
  }

  describe("SmartRuleGenerator", () => {
    test("should initialize correctly", async () => {
      const tool = await SmartRuleGeneratorTool.init();
      
      expect(SmartRuleGeneratorTool.id).toBe("smart-rule-generator");
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
    });

    test("should analyze codebase and detect patterns", async () => {
      const tool = await SmartRuleGeneratorTool.init();
      const result = await tool.execute({
        action: "analyze-codebase",
        languages: ["typescript", "javascript"],
        minConfidence: 0.6,
        maxSuggestions: 5,
      }, mockContext);

      expect(result.title).toBe("Codebase Analysis");
      expect(result.metadata.filesAnalyzed).toBeGreaterThan(0);
      expect(result.metadata.patternsDetected).toBeGreaterThan(0);
      expect(result.output).toContain("Files Analyzed");
      expect(result.output).toContain("Patterns Detected");
    });

    test("should generate rules from patterns", async () => {
      const tool = await SmartRuleGeneratorTool.init();
      
      // First analyze to create patterns
      await tool.execute({
        action: "analyze-codebase",
        languages: ["typescript"],
        minConfidence: 0.5,
        maxSuggestions: 5,
      }, mockContext);

      const result = await tool.execute({
        action: "generate-from-patterns",
        minConfidence: 0.5,
        maxSuggestions: 3,
      }, mockContext);

      expect(result.title).toBe("Pattern-Based Rule Generation");
      expect(result.metadata.patternsAnalyzed).toBeGreaterThanOrEqual(0);
      expect(result.output).toContain("Rule Generation from Patterns");
    });

    test("should handle errors gracefully", async () => {
      const tool = await SmartRuleGeneratorTool.init();
      const result = await tool.execute({
        action: "unknown-action" as any,
        minConfidence: 0.5,
        maxSuggestions: 5,
      }, mockContext);

      expect(result.title).toBe("Smart Rule Generator Error");
      expect(result.metadata.error).toContain("Unknown action");
    });
  });

  describe("CodePatternDetector", () => {
    test("should initialize correctly", async () => {
      const tool = await CodePatternDetectorTool.init();
      
      expect(CodePatternDetectorTool.id).toBe("code-pattern-detector");
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
    });

    test("should detect patterns in source files", async () => {
      const tool = await CodePatternDetectorTool.init();
      const result = await tool.execute({
        action: "detect-patterns",
        languages: ["typescript", "javascript"],
        includeMetadata: true,
        outputFormat: "detailed",
        minComplexity: 0.3,
      }, mockContext);

      expect(result.title).toBe("Pattern Detection Results");
      expect(result.metadata.filesAnalyzed).toBeGreaterThan(0);
      expect(result.metadata.patternsDetected).toBeGreaterThan(0);
      expect(result.output).toContain("Pattern Detection Complete");
      expect(result.output).toContain("Pattern Distribution");
    });

    test("should analyze complexity of patterns", async () => {
      const tool = await CodePatternDetectorTool.init();
      
      // First detect patterns
      await tool.execute({
        action: "detect-patterns",
        languages: ["typescript"],
        minComplexity: 0.3,
        includeMetadata: true,
        outputFormat: "summary",
      }, mockContext);

      const result = await tool.execute({
        action: "analyze-complexity",
        minComplexity: 1,
        includeMetadata: true,
        outputFormat: "summary",
      }, mockContext);

      expect(result.title).toBe("Complexity Analysis");
      expect(result.metadata.totalPatterns).toBeGreaterThanOrEqual(0);
      expect(result.output).toContain("Complexity Analysis");
    });
  });

  describe("SmartDocumentationLinker", () => {
    test("should initialize correctly", async () => {
      const tool = await SmartDocumentationLinkerTool.init();
      
      expect(SmartDocumentationLinkerTool.id).toBe("smart-documentation-linker");
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
    });

    test("should scan documentation files", async () => {
      const tool = await SmartDocumentationLinkerTool.init();
      const result = await tool.execute({
        action: "scan-documentation",
        minRelevance: 0.5,
        autoLink: false,
        includeCodeComments: true,
      }, mockContext);

      expect(result.title).toBe("Documentation Scan");
      expect(result.metadata.filesScanned).toBeGreaterThan(0);
      expect(result.output).toContain("Documentation Scan Complete");
    });
  });

  describe("ContextAwareRuleActivator", () => {
    test("should initialize correctly", async () => {
      const tool = await ContextAwareRuleActivator.init();
      
      expect(ContextAwareRuleActivator.id).toBe("context_aware_rule_activator");
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
    });

    test("should analyze context correctly", async () => {
      const tool = await ContextAwareRuleActivator.init();
      const context = {
        currentFiles: ["src/example.ts", "src/utils.js"],
        recentCommands: ["npm test", "git commit"],
        activeTools: ["edit", "read"],
        taskType: "coding" as const,
        errorMessages: ["Type error in example.ts"],
      };

      const result = await tool.execute({
        action: "analyze_context",
        context,
      }, mockContext);

      expect(result.title).toContain("analyze_context");
      expect(result.metadata.result).toBeDefined();
      
      const analysis = result.metadata.result;
      expect(analysis.projectType).toBeDefined();
      expect(analysis.taskType).toBe("coding");
      expect(analysis.complexity).toBeGreaterThanOrEqual(0);
      expect(analysis.urgency).toBeGreaterThan(0.5); // Should be higher due to error messages
      expect(analysis.patterns).toBeInstanceOf(Array);
    });
  });

  describe("SmartLearningAssistant", () => {
    test("should initialize correctly", async () => {
      const tool = await SmartLearningAssistantTool.init();
      
      expect(SmartLearningAssistantTool.id).toBe("smart-learning-assistant");
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
    });

    test("should record user behavior", async () => {
      const tool = await SmartLearningAssistantTool.init();
      const behaviorData = {
        actionType: "tool_usage",
        actionData: { tool: "edit", file: "src/example.ts" },
        outcome: "success",
        effectiveness: 0.8,
      };

      const result = await tool.execute({
        action: "record_behavior",
        sessionId: "test-session",
        behaviorData,
        context: { taskType: "coding" },
        timeframe: "7d",
        minConfidence: 0.6,
        maxSuggestions: 10,
        includeReasons: true,
      }, mockContext);

      expect(result.title).toBe("Behavior Recorded");
      expect(result.metadata.behaviorId).toBeDefined();
      expect(result.metadata.actionType).toBe("tool_usage");
      expect(result.output).toContain("Recorded tool_usage behavior");
    });

    test("should analyze user patterns", async () => {
      const tool = await SmartLearningAssistantTool.init();
      
      // Record some behaviors first
      const behaviors = [
        { actionType: "edit_file", actionData: { file: "test.ts" }, outcome: "success" },
        { actionType: "run_test", actionData: { command: "npm test" }, outcome: "success" },
        { actionType: "edit_file", actionData: { file: "test2.ts" }, outcome: "success" },
      ];

      for (const behavior of behaviors) {
        await tool.execute({
          action: "record_behavior",
          behaviorData: behavior,
          timeframe: "7d",
          minConfidence: 0.6,
          maxSuggestions: 10,
          includeReasons: true,
        }, mockContext);
      }

      const result = await tool.execute({
        action: "analyze_patterns",
        timeframe: "7d",
        maxSuggestions: 5,
        minConfidence: 0.6,
        includeReasons: true,
      }, mockContext);

      expect(result.title).toBe("Pattern Analysis Complete");
      expect(result.metadata.behaviorsAnalyzed).toBeGreaterThanOrEqual(0);
      expect(result.output).toContain("Pattern analysis completed");
    });
  });

  describe("IntelligentRuleOptimizer", () => {
    test("should initialize correctly", async () => {
      const tool = await IntelligentRuleOptimizerTool.init();
      
      expect(IntelligentRuleOptimizerTool.id).toBe("intelligent-rule-optimizer");
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
    });

    test("should analyze rule performance", async () => {
      const tool = await IntelligentRuleOptimizerTool.init();
      
      // Add test rules with different performance characteristics
      storage.addRule({
        id: "high-perf-rule",
        text: "Use TypeScript for type safety",
        category: "preferred" as const,
        analytics: '{"effectivenessScore": 0.9}',
        documentationLinks: "[]",
        tags: "[]",
      });

      storage.addRule({
        id: "low-perf-rule",
        text: "Unused rule with low effectiveness",
        category: "deprecated" as const,
        analytics: '{"effectivenessScore": 0.1}',
        documentationLinks: "[]",
        tags: "[]",
      });

      // Record some usage
      storage.recordRuleUsage("high-perf-rule", "test-session", "test context", 0.9);

      const result = await tool.execute({
        action: "analyze_performance",
        timeframeDays: 30,
        includeReasons: true,
        minConfidence: 0.5,
        maxSuggestions: 10,
        autoApply: false,
      }, mockContext);

      expect(result.title).toBe("Rule Performance Analysis");
      expect(result.metadata.rulesAnalyzed).toBeGreaterThan(0);
      expect(result.metadata.averageEffectiveness).toBeGreaterThanOrEqual(0);
      expect(result.output).toContain("Rule Performance Analysis");
      expect(result.output).toContain("Performance Summary");
    });

    test("should optimize rules and generate suggestions", async () => {
      const tool = await IntelligentRuleOptimizerTool.init();
      
      // Add rules that can be optimized
      storage.addRule({
        id: "similar-rule-1",
        text: "Always use const for immutable variables",
        category: "preferred" as const,
        analytics: "{}",
        documentationLinks: "[]",
        tags: "[]",
      });

      storage.addRule({
        id: "similar-rule-2", 
        text: "Use const for variables that don't change",
        category: "preferred" as const,
        analytics: "{}",
        documentationLinks: "[]",
        tags: "[]",
      });

      const result = await tool.execute({
        action: "optimize_rules",
        optimizationTypes: ["consolidate", "deprecate", "enhance"],
        minConfidence: 0.5,
        maxSuggestions: 10,
        includeReasons: true,
        autoApply: false,
        timeframeDays: 30,
      }, mockContext);

      expect(result.title).toBe("Rule Optimization Suggestions");
      expect(result.metadata.totalSuggestions).toBeGreaterThanOrEqual(0);
      expect(result.output).toContain("Rule Optimization Suggestions");
    });
  });

  describe("MemoryStorage Enhanced Features", () => {
    test("should store and retrieve code patterns", async () => {
      const pattern = {
        id: "test-pattern-1",
        patternType: "function" as const,
        pattern: "async function test() {}",
        filePath: "/test/file.ts",
        language: "typescript",
        confidence: 0.8,
        metadata: JSON.stringify({ complexity: 3 }),
      };

      storage.addCodePattern(pattern);
      
      const patterns = storage.getCodePatterns("typescript", "function", 0.5);
      expect(patterns.length).toBeGreaterThan(0);
      
      const retrievedPattern = patterns.find(p => p.id === "test-pattern-1");
      expect(retrievedPattern).toBeDefined();
      expect(retrievedPattern?.patternType).toBe("function");
      expect(retrievedPattern?.language).toBe("typescript");
    });

    test("should link patterns to rules", async () => {
      // Add pattern and rule
      storage.addCodePattern({
        id: "link-pattern",
        patternType: "function",
        pattern: "function test() {}",
        filePath: "/test.js",
        language: "javascript",
        confidence: 0.7,
        metadata: "{}",
      });

      storage.addRule({
        id: "link-rule",
        text: "Use descriptive function names",
        category: "preferred" as const,
        analytics: "{}",
        documentationLinks: "[]",
        tags: "[]",
      });

      storage.linkPatternToRule("link-pattern", "link-rule", 0.8, "test-user");
      
      const patternRules = storage.getPatternRules("link-pattern");
      expect(patternRules.length).toBe(1);
      expect(patternRules[0].ruleId).toBe("link-rule");
      expect(patternRules[0].confidence).toBe(0.8);
    });

    test("should record and retrieve learning feedback", async () => {
      storage.addRule({
        id: "feedback-test-rule",
        text: "Test rule for feedback",
        category: "preferred" as const,
        analytics: "{}",
        documentationLinks: "[]",
        tags: "[]",
      });

      storage.recordLearningFeedback({
        ruleId: "feedback-test-rule",
        sessionId: "test-session",
        feedbackType: "positive",
        originalSuggestion: "Original suggestion",
        userCorrection: "User correction",
        context: JSON.stringify({ test: true }),
      });

      const feedback = storage.getLearningFeedback("feedback-test-rule");
      expect(feedback.length).toBe(1);
      expect(feedback[0].feedbackType).toBe("positive");
      expect(feedback[0].ruleId).toBe("feedback-test-rule");
    });

    test("should provide analytics for patterns and learning", async () => {
      // Add some test data
      storage.addCodePattern({
        id: "analytics-pattern-1",
        patternType: "function",
        pattern: "test pattern",
        filePath: "/test.ts",
        language: "typescript",
        confidence: 0.8,
        metadata: "{}",
      });

      storage.addCodePattern({
        id: "analytics-pattern-2",
        patternType: "import",
        pattern: "import test",
        filePath: "/test.js",
        language: "javascript",
        confidence: 0.7,
        metadata: "{}",
      });

      const patternAnalytics = storage.getPatternAnalytics();
      expect(patternAnalytics.totalPatterns).toBeGreaterThanOrEqual(2);
      expect(patternAnalytics.patternsByLanguage).toHaveProperty("typescript");
      expect(patternAnalytics.patternsByLanguage).toHaveProperty("javascript");
      expect(patternAnalytics.patternsByType).toHaveProperty("function");
      expect(patternAnalytics.patternsByType).toHaveProperty("import");

      const learningAnalytics = storage.getLearningAnalytics();
      expect(learningAnalytics).toHaveProperty("totalFeedback");
      expect(learningAnalytics).toHaveProperty("feedbackByType");
      expect(learningAnalytics).toHaveProperty("improvementRate");
    });
  });

  describe("Integration Tests", () => {
    test("should integrate SmartRuleGenerator with CodePatternDetector", async () => {
      const patternTool = await CodePatternDetectorTool.init();
      const ruleTool = await SmartRuleGeneratorTool.init();
      
      // First detect patterns
      const patternResult = await patternTool.execute({
        action: "detect-patterns",
        languages: ["typescript"],
        minComplexity: 0.3,
        includeMetadata: true,
        outputFormat: "summary",
      }, mockContext);

      expect(patternResult.metadata.patternsDetected).toBeGreaterThan(0);

      // Then generate rules from patterns
      const ruleResult = await ruleTool.execute({
        action: "generate-from-patterns",
        minConfidence: 0.5,
        maxSuggestions: 5,
      }, mockContext);

      expect(ruleResult.metadata.patternsAnalyzed).toBeGreaterThanOrEqual(0);
    });

    test("should handle complex workflow with multiple tools", async () => {
      const patternTool = await CodePatternDetectorTool.init();
      const ruleTool = await SmartRuleGeneratorTool.init();
      const contextTool = await ContextAwareRuleActivator.init();
      const learningTool = await SmartLearningAssistantTool.init();
      const optimizerTool = await IntelligentRuleOptimizerTool.init();

      // 1. Detect patterns in codebase
      const patternResult = await patternTool.execute({
        action: "detect-patterns",
        languages: ["typescript", "javascript"],
        outputFormat: "summary",
        minComplexity: 0.3,
        includeMetadata: true,
      }, mockContext);

      // 2. Generate rules from patterns
      const ruleGenResult = await ruleTool.execute({
        action: "generate-from-patterns",
        minConfidence: 0.6,
        maxSuggestions: 3,
      }, mockContext);

      // 3. Analyze context and activate rules
      const contextResult = await contextTool.execute({
        action: "prioritize_rules",
        context: {
          currentFiles: ["src/example.ts"],
          taskType: "coding",
        },
        maxRules: 5,
      }, mockContext);

      // 4. Record learning behavior
      await learningTool.execute({
        action: "record_behavior",
        behaviorData: {
          actionType: "workflow_completion",
          actionData: { steps: 5 },
          outcome: "success",
          effectiveness: 0.9,
        },
        timeframe: "7d",
        minConfidence: 0.6,
        maxSuggestions: 10,
        includeReasons: true,
      }, mockContext);

      // 5. Optimize rules based on usage
      const optimizeResult = await optimizerTool.execute({
        action: "analyze_performance",
        timeframeDays: 1,
        minConfidence: 0.5,
        maxSuggestions: 10,
        includeReasons: true,
        autoApply: false,
      }, mockContext);

      // Verify all steps completed successfully
      expect(patternResult.title).toBe("Pattern Detection Results");
      expect(ruleGenResult.title).toBe("Pattern-Based Rule Generation");
      expect(contextResult.title).toContain("prioritize_rules");
      expect(optimizeResult.title).toBe("Rule Performance Analysis");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle invalid parameters gracefully", async () => {
      const tool = await SmartRuleGeneratorTool.init();
      const result = await tool.execute({
        action: "invalid-action" as any,
        minConfidence: 0.5,
        maxSuggestions: 5,
      }, mockContext);

      expect(result.title).toBe("Smart Rule Generator Error");
      expect(result.metadata.error).toContain("Unknown action");
    });

    test("should handle missing files and directories", async () => {
      const tool = await CodePatternDetectorTool.init();
      const result = await tool.execute({
        action: "detect-patterns",
        filePaths: ["/non/existent/path"],
        minComplexity: 0.3,
        includeMetadata: true,
        outputFormat: "summary",
      }, mockContext);

      expect(result.metadata.filesAnalyzed).toBe(0);
      expect(result.metadata.patternsDetected).toBe(0);
    });

    test("should handle database errors gracefully", async () => {
      // Close the database to simulate error
      storage.close();

      const tool = await SmartLearningAssistantTool.init();
      const result = await tool.execute({
        action: "record_behavior",
        behaviorData: {
          actionType: "test",
          actionData: {},
          outcome: "test",
        },
        timeframe: "7d",
        minConfidence: 0.6,
        maxSuggestions: 10,
        includeReasons: true,
      }, mockContext);

      // Should handle the error without crashing
      expect(result).toBeDefined();
    });

    test("should handle concurrent operations", async () => {
      const ruleTool = await SmartRuleGeneratorTool.init();
      const patternTool = await CodePatternDetectorTool.init();
      const learningTool = await SmartLearningAssistantTool.init();
      
      // Run multiple operations concurrently
      const promises = [
        ruleTool.execute({ 
          action: "analyze-codebase", 
          minConfidence: 0.5, 
          maxSuggestions: 5 
        }, mockContext),
        patternTool.execute({ 
          action: "detect-patterns", 
          minComplexity: 0.3, 
          includeMetadata: true, 
          outputFormat: "summary" 
        }, mockContext),
        learningTool.execute({ 
          action: "get_insights", 
          timeframe: "7d", 
          minConfidence: 0.6, 
          maxSuggestions: 10, 
          includeReasons: true 
        }, mockContext),
      ];

      const results = await Promise.all(promises);
      
      // All should complete without errors
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.title).toBeDefined();
      });
    });
  });

  describe("Performance Tests", () => {
    test("should handle large datasets efficiently", async () => {
      // Create many test files
      const largeTestDir = path.join(testDir, "large-dataset");
      await fs.mkdir(largeTestDir, { recursive: true });
      
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(path.join(largeTestDir, `file${i}.ts`), `
          export function test${i}() {
            const value${i} = ${i};
            return value${i} * 2;
          }
          
          export class Test${i} {
            private data = ${i};
            
            public getData() {
              return this.data;
            }
          }
        `);
      }

      const startTime = Date.now();
      
      const tool = await CodePatternDetectorTool.init();
      const result = await tool.execute({
        action: "detect-patterns",
        filePaths: [largeTestDir],
        languages: ["typescript"],
        minComplexity: 0.3,
        includeMetadata: true,
        outputFormat: "summary",
      }, mockContext);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
      expect(result.metadata.filesAnalyzed).toBe(20);
      expect(result.metadata.patternsDetected).toBeGreaterThan(0);
    });

    test("should handle memory efficiently with many patterns", async () => {
      // Add many patterns to test memory usage
      for (let i = 0; i < 100; i++) {
        storage.addCodePattern({
          id: `memory-test-${i}`,
          patternType: "function",
          pattern: `function test${i}() { return ${i}; }`,
          filePath: `/test${i}.ts`,
          language: "typescript",
          confidence: Math.random(),
          metadata: JSON.stringify({ index: i }),
        });
      }

      const startTime = Date.now();
      const patterns = storage.getCodePatterns("typescript");
      const endTime = Date.now();

      expect(patterns.length).toBeGreaterThanOrEqual(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });
  });
});