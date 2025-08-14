import { Tool } from "./tool";
import { z } from "zod";
import { MemoryStorage } from "./memory-storage";
import { App } from "../app/app";
import * as path from "path";
import * as fs from "fs";
import DESCRIPTION from "./smart-rule-generator.txt";

interface GeneratedRule {
  text: string;
  category: "critical" | "preferred" | "contextual";
  reason: string;
  confidence: number;
  patterns: string[];
}

export const SmartRuleGeneratorTool = Tool.define("smart-rule-generator", {
  description: DESCRIPTION,

  parameters: z.object({
    action: z.enum([
      "analyze-codebase",
      "generate-from-patterns", 
      "validate-suggestions",
      "apply-suggestions"
    ]),
    filePaths: z.array(z.string()).optional().describe("Specific file paths to analyze"),
    languages: z.array(z.string()).optional().describe("Programming languages to focus on"),
    minConfidence: z.number().min(0).max(1).default(0.6).describe("Minimum confidence threshold for suggestions"),
    maxSuggestions: z.number().min(1).max(20).default(10).describe("Maximum number of rule suggestions to generate"),
    categories: z.array(z.enum(["critical", "preferred", "contextual"])).optional().describe("Rule categories to generate"),
  }),

  async execute(params, ctx) {
    const storage = MemoryStorage.getInstance();
    const app = App.info();

    try {
      switch (params.action) {
        case "analyze-codebase":
          return await analyzeCodebase(storage, app, params);
        case "generate-from-patterns":
          return await generateFromPatterns(storage, params);
        case "validate-suggestions":
          return await validateSuggestions(storage, params);
        case "apply-suggestions":
          return await applySuggestions(storage, params, ctx);
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        title: "Smart Rule Generator Error",
        metadata: { error: errorMessage },
        output: `Error: ${errorMessage}`,
      };
    }
  },
});

async function analyzeCodebase(
  storage: MemoryStorage,
  app: any,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const filePaths = params.filePaths || await discoverSourceFiles(app.path.root, params.languages);
  const patterns = await extractCodePatterns(filePaths, params.languages);
  
  // Store patterns in database
  for (const pattern of patterns) {
    try {
      storage.addCodePattern(pattern);
    } catch (error) {
      // Pattern might already exist, update frequency instead
      storage.updatePatternFrequency(pattern.id);
    }
  }

  const suggestions = await generateRuleSuggestions(patterns, params);
  
  let output = `## Codebase Analysis Complete\n\n`;
  output += `**Files Analyzed**: ${filePaths.length}\n`;
  output += `**Patterns Detected**: ${patterns.length}\n`;
  output += `**Rule Suggestions**: ${suggestions.length}\n\n`;

  if (suggestions.length > 0) {
    output += `### Generated Rule Suggestions\n\n`;
    suggestions.slice(0, params.maxSuggestions).forEach((suggestion, index) => {
      output += `#### ${index + 1}. ${suggestion.category.toUpperCase()} Rule (${Math.round(suggestion.confidence * 100)}% confidence)\n`;
      output += `**Rule**: ${suggestion.text}\n`;
      output += `**Reason**: ${suggestion.reason}\n`;
      output += `**Based on patterns**: ${suggestion.patterns.join(", ")}\n\n`;
    });
  }

  return {
    title: "Codebase Analysis",
    metadata: {
      filesAnalyzed: filePaths.length,
      patternsDetected: patterns.length,
      suggestionsGenerated: suggestions.length,
      languages: params.languages,
    },
    output: output.trim(),
  };
}

async function generateFromPatterns(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const patterns = storage.getCodePatterns(
    params.languages?.[0],
    undefined,
    params.minConfidence
  );

  if (patterns.length === 0) {
    return {
      title: "No Patterns Found",
      metadata: {},
      output: "No code patterns found in database. Run 'analyze-codebase' first.",
    };
  }

  const suggestions = await generateRuleSuggestions(patterns, params);

  let output = `## Rule Generation from Patterns\n\n`;
  output += `**Patterns Analyzed**: ${patterns.length}\n`;
  output += `**Rule Suggestions**: ${suggestions.length}\n\n`;

  if (suggestions.length > 0) {
    output += `### Generated Rules\n\n`;
    suggestions.slice(0, params.maxSuggestions).forEach((suggestion, index) => {
      output += `#### ${index + 1}. ${suggestion.text}\n`;
      output += `- **Category**: ${suggestion.category}\n`;
      output += `- **Confidence**: ${Math.round(suggestion.confidence * 100)}%\n`;
      output += `- **Reason**: ${suggestion.reason}\n`;
      output += `- **Patterns**: ${suggestion.patterns.join(", ")}\n\n`;
    });
  }

  return {
    title: "Pattern-Based Rule Generation",
    metadata: {
      patternsAnalyzed: patterns.length,
      suggestionsGenerated: suggestions.length,
    },
    output: output.trim(),
  };
}

async function validateSuggestions(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  // Get existing rules to avoid duplicates
  const existingRules = storage.getRulesByCategory();
  const existingTexts = new Set(existingRules.map(r => r.text.toLowerCase()));

  const patterns = storage.getCodePatterns(undefined, undefined, params.minConfidence);
  const suggestions = await generateRuleSuggestions(patterns, params);

  // Filter out duplicates and low-confidence suggestions
  const validSuggestions = suggestions.filter(suggestion => 
    suggestion.confidence >= params.minConfidence &&
    !existingTexts.has(suggestion.text.toLowerCase())
  );

  let output = `## Rule Suggestion Validation\n\n`;
  output += `**Total Suggestions**: ${suggestions.length}\n`;
  output += `**Valid Suggestions**: ${validSuggestions.length}\n`;
  output += `**Filtered Out**: ${suggestions.length - validSuggestions.length} (duplicates or low confidence)\n\n`;

  if (validSuggestions.length > 0) {
    output += `### Valid Rule Suggestions\n\n`;
    validSuggestions.slice(0, params.maxSuggestions).forEach((suggestion, index) => {
      output += `#### ${index + 1}. ${suggestion.text}\n`;
      output += `- **Category**: ${suggestion.category}\n`;
      output += `- **Confidence**: ${Math.round(suggestion.confidence * 100)}%\n`;
      output += `- **Status**: ✅ Valid (no conflicts)\n\n`;
    });
  }

  return {
    title: "Suggestion Validation",
    metadata: {
      totalSuggestions: suggestions.length,
      validSuggestions: validSuggestions.length,
      filteredOut: suggestions.length - validSuggestions.length,
    },
    output: output.trim(),
  };
}

async function applySuggestions(
  storage: MemoryStorage,
  params: any,
  _ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  // This would integrate with the Memory tool to actually add the rules
  // For now, we'll simulate the process
  
  const patterns = storage.getCodePatterns(undefined, undefined, params.minConfidence);
  const suggestions = await generateRuleSuggestions(patterns, params);
  const existingRules = storage.getRulesByCategory();
  const existingTexts = new Set(existingRules.map(r => r.text.toLowerCase()));

  const validSuggestions = suggestions.filter(suggestion => 
    suggestion.confidence >= params.minConfidence &&
    !existingTexts.has(suggestion.text.toLowerCase())
  ).slice(0, params.maxSuggestions);

  let appliedCount = 0;
  const appliedRules: string[] = [];

  // In a real implementation, this would call the Memory tool to add rules
  for (const suggestion of validSuggestions) {
    try {
      // Generate rule ID
      const ruleId = generateRuleId(suggestion.text);
      
      // Store rule in database
      storage.addRule({
        id: ruleId,
        text: suggestion.text,
        category: suggestion.category,
        reason: `Auto-generated: ${suggestion.reason}`,
        analytics: JSON.stringify({
          timesApplied: 0,
          timesIgnored: 0,
          effectivenessScore: suggestion.confidence,
          userFeedback: [],
          autoGenerated: true,
          generatedFrom: suggestion.patterns,
        }),
        documentationLinks: "[]",
        tags: JSON.stringify(["auto-generated", "pattern-based"]),
      });

      appliedCount++;
      appliedRules.push(ruleId);
    } catch (error) {
      console.warn(`Failed to apply suggestion: ${suggestion.text}`, error);
    }
  }

  let output = `## Rule Suggestions Applied\n\n`;
  output += `**Suggestions Processed**: ${validSuggestions.length}\n`;
  output += `**Rules Applied**: ${appliedCount}\n`;
  output += `**Success Rate**: ${Math.round((appliedCount / validSuggestions.length) * 100)}%\n\n`;

  if (appliedCount > 0) {
    output += `### Applied Rules\n\n`;
    appliedRules.forEach((ruleId, index) => {
      const suggestion = validSuggestions[index];
      output += `${index + 1}. **${ruleId}** (${suggestion.category})\n`;
      output += `   "${suggestion.text}"\n`;
      output += `   Confidence: ${Math.round(suggestion.confidence * 100)}%\n\n`;
    });

    output += `\n💡 **Tip**: Use \`memory list\` to see all your rules, including the newly generated ones.`;
  }

  return {
    title: "Suggestions Applied",
    metadata: {
      suggestionsProcessed: validSuggestions.length,
      rulesApplied: appliedCount,
      appliedRuleIds: appliedRules,
    },
    output: output.trim(),
  };
}

// Helper functions

async function discoverSourceFiles(rootPath: string, languages?: string[]): Promise<string[]> {
  const extensions = languages ? 
    languages.flatMap(lang => getFileExtensions(lang)) :
    [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".cpp", ".c", ".h"];

  const files: string[] = [];
  
  try {
    await walkDirectory(rootPath, (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (extensions.includes(ext)) {
        // Skip common build/dependency directories
        if (!filePath.includes("node_modules") && 
            !filePath.includes("dist") && 
            !filePath.includes("build") && 
            !filePath.includes(".git")) {
          files.push(filePath);
        }
      }
    });
  } catch (error) {
    console.warn(`Failed to discover files in ${rootPath}:`, error);
  }

  return files;
}

async function walkDirectory(dir: string, callback: (filePath: string) => void): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

function getFileExtensions(language: string): string[] {
  const extensions: Record<string, string[]> = {
    typescript: [".ts", ".tsx"],
    javascript: [".js", ".jsx"],
    python: [".py"],
    go: [".go"],
    rust: [".rs"],
    java: [".java"],
    cpp: [".cpp", ".c", ".h"],
  };

  return extensions[language.toLowerCase()] || [`.${language}`];
}

async function extractCodePatterns(filePaths: string[], languages?: string[]): Promise<any[]> {
  const patterns: any[] = [];

  for (const filePath of filePaths.slice(0, 100)) { // Limit for performance
    try {
      const content = await Bun.file(filePath).text();
      const language = detectLanguage(filePath);
      
      if (languages && !languages.includes(language)) continue;

      // Extract basic patterns
      const filePatterns = await extractPatternsFromFile(content, filePath, language);
      patterns.push(...filePatterns);
    } catch (error) {
      console.warn(`Failed to analyze file ${filePath}:`, error);
    }
  }

  return patterns;
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript", 
    ".jsx": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "cpp",
    ".h": "cpp",
  };

  return languageMap[ext] || "unknown";
}

async function extractPatternsFromFile(content: string, filePath: string, language: string): Promise<any[]> {
  const patterns: any[] = [];
  const lines = content.split('\n');

  // Extract import patterns
  const importPatterns = extractImportPatterns(lines, language);
  patterns.push(...importPatterns.map(pattern => ({
    id: `import-${generatePatternId(pattern)}`,
    patternType: "import" as const,
    pattern,
    filePath,
    language,
    confidence: 0.8,
    metadata: JSON.stringify({ type: "import" }),
  })));

  // Extract function patterns
  const functionPatterns = extractFunctionPatterns(lines, language);
  patterns.push(...functionPatterns.map(pattern => ({
    id: `function-${generatePatternId(pattern)}`,
    patternType: "function" as const,
    pattern,
    filePath,
    language,
    confidence: 0.7,
    metadata: JSON.stringify({ type: "function" }),
  })));

  // Extract variable patterns
  const variablePatterns = extractVariablePatterns(lines, language);
  patterns.push(...variablePatterns.map(pattern => ({
    id: `variable-${generatePatternId(pattern)}`,
    patternType: "variable" as const,
    pattern,
    filePath,
    language,
    confidence: 0.6,
    metadata: JSON.stringify({ type: "variable" }),
  })));

  return patterns;
}

function extractImportPatterns(lines: string[], language: string): string[] {
  const patterns: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (language === "typescript" || language === "javascript") {
      if (trimmed.startsWith("import ") && trimmed.includes("from ")) {
        patterns.push(trimmed);
      }
    } else if (language === "python") {
      if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
        patterns.push(trimmed);
      }
    } else if (language === "go") {
      if (trimmed.startsWith("import ")) {
        patterns.push(trimmed);
      }
    }
  }

  return patterns;
}

function extractFunctionPatterns(lines: string[], language: string): string[] {
  const patterns: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (language === "typescript" || language === "javascript") {
      if (trimmed.includes("function ") || trimmed.includes("=> ") || trimmed.match(/^\w+\s*\(/)) {
        patterns.push(trimmed);
      }
    } else if (language === "python") {
      if (trimmed.startsWith("def ")) {
        patterns.push(trimmed);
      }
    } else if (language === "go") {
      if (trimmed.startsWith("func ")) {
        patterns.push(trimmed);
      }
    }
  }

  return patterns;
}

function extractVariablePatterns(lines: string[], language: string): string[] {
  const patterns: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (language === "typescript" || language === "javascript") {
      if (trimmed.startsWith("const ") || trimmed.startsWith("let ") || trimmed.startsWith("var ")) {
        patterns.push(trimmed);
      }
    } else if (language === "python") {
      if (trimmed.match(/^\w+\s*=/)) {
        patterns.push(trimmed);
      }
    } else if (language === "go") {
      if (trimmed.includes(":=") || trimmed.startsWith("var ")) {
        patterns.push(trimmed);
      }
    }
  }

  return patterns;
}

async function generateRuleSuggestions(patterns: any[], params: any): Promise<GeneratedRule[]> {
  const suggestions: GeneratedRule[] = [];
  const patternGroups = groupPatternsByType(patterns);

  // Generate import-based rules
  if (patternGroups.import && patternGroups.import.length > 0) {
    const importSuggestions = generateImportRules(patternGroups.import);
    suggestions.push(...importSuggestions);
  }

  // Generate function-based rules
  if (patternGroups.function && patternGroups.function.length > 0) {
    const functionSuggestions = generateFunctionRules(patternGroups.function);
    suggestions.push(...functionSuggestions);
  }

  // Generate variable-based rules
  if (patternGroups.variable && patternGroups.variable.length > 0) {
    const variableSuggestions = generateVariableRules(patternGroups.variable);
    suggestions.push(...variableSuggestions);
  }

  // Filter by categories if specified
  const filteredSuggestions = params.categories ? 
    suggestions.filter(s => params.categories.includes(s.category)) :
    suggestions;

  // Sort by confidence and return top suggestions
  return filteredSuggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, params.maxSuggestions || 10);
}

function groupPatternsByType(patterns: any[]): Record<string, any[]> {
  return patterns.reduce((groups, pattern) => {
    const type = pattern.patternType;
    if (!groups[type]) groups[type] = [];
    groups[type].push(pattern);
    return groups;
  }, {} as Record<string, any[]>);
}

function generateImportRules(importPatterns: any[]): GeneratedRule[] {
  const suggestions: GeneratedRule[] = [];
  
  // Analyze import styles
  const relativeImports = importPatterns.filter(p => p.pattern.includes("./") || p.pattern.includes("../"));
  const namedImports = importPatterns.filter(p => p.pattern.includes("{ ") && p.pattern.includes(" }"));
  
  if (relativeImports.length > importPatterns.length * 0.7) {
    suggestions.push({
      text: "Use relative imports for local modules, named imports preferred",
      category: "preferred",
      reason: "Detected consistent use of relative imports in codebase",
      confidence: 0.8,
      patterns: relativeImports.slice(0, 3).map(p => p.pattern),
    });
  }

  if (namedImports.length > importPatterns.length * 0.6) {
    suggestions.push({
      text: "Prefer named imports over default imports for better tree-shaking",
      category: "preferred", 
      reason: "Majority of imports use named import syntax",
      confidence: 0.7,
      patterns: namedImports.slice(0, 3).map(p => p.pattern),
    });
  }

  return suggestions;
}

function generateFunctionRules(functionPatterns: any[]): GeneratedRule[] {
  const suggestions: GeneratedRule[] = [];
  
  // Analyze function naming patterns
  const camelCaseFunctions = functionPatterns.filter(p => 
    p.pattern.match(/[a-z][A-Z]/) // Contains camelCase
  );
  
  const arrowFunctions = functionPatterns.filter(p => p.pattern.includes("=>"));
  
  if (camelCaseFunctions.length > functionPatterns.length * 0.8) {
    suggestions.push({
      text: "Use camelCase for function names",
      category: "preferred",
      reason: "Detected consistent camelCase naming in function definitions",
      confidence: 0.8,
      patterns: camelCaseFunctions.slice(0, 3).map(p => p.pattern),
    });
  }

  if (arrowFunctions.length > functionPatterns.length * 0.6) {
    suggestions.push({
      text: "Prefer arrow functions for short function expressions",
      category: "preferred",
      reason: "Arrow functions are commonly used in this codebase",
      confidence: 0.7,
      patterns: arrowFunctions.slice(0, 3).map(p => p.pattern),
    });
  }

  return suggestions;
}

function generateVariableRules(variablePatterns: any[]): GeneratedRule[] {
  const suggestions: GeneratedRule[] = [];
  
  // Analyze variable declaration patterns
  const constDeclarations = variablePatterns.filter(p => p.pattern.startsWith("const "));
  const letDeclarations = variablePatterns.filter(p => p.pattern.startsWith("let "));
  
  if (constDeclarations.length > letDeclarations.length * 2) {
    suggestions.push({
      text: "Prefer const over let for variables that don't change",
      category: "preferred",
      reason: "Codebase shows strong preference for const declarations",
      confidence: 0.8,
      patterns: constDeclarations.slice(0, 3).map(p => p.pattern),
    });
  }

  return suggestions;
}

function generatePatternId(pattern: string): string {
  return pattern
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 30) + 
    "-" + 
    Date.now().toString(36);
}

function generateRuleId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50) +
    "-" +
    Date.now().toString(36);
}