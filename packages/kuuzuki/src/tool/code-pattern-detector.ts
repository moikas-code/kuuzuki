import { Tool } from "./tool";
import { z } from "zod";
import { MemoryStorage } from "./memory-storage";
import { App } from "../app/app";
import * as path from "path";
import * as fs from "fs";
import DESCRIPTION from "./code-pattern-detector.txt";

interface DetectedPattern {
  id: string;
  type: "function" | "class" | "import" | "variable" | "structure";
  pattern: string;
  filePath: string;
  language: string;
  confidence: number;
  metadata: {
    lineNumber?: number;
    complexity?: number;
    dependencies?: string[];
    parameters?: string[];
    returnType?: string;
    visibility?: string;
  };
}

interface PatternAnalysis {
  totalPatterns: number;
  patternsByType: Record<string, number>;
  patternsByLanguage: Record<string, number>;
  complexityDistribution: Record<string, number>;
  recommendations: string[];
}

export const CodePatternDetectorTool = Tool.define("code-pattern-detector", {
  description: DESCRIPTION,

  parameters: z.object({
    action: z.enum([
      "detect-patterns",
      "analyze-complexity",
      "find-duplicates",
      "suggest-refactoring",
      "export-patterns"
    ]),
    filePaths: z.array(z.string()).optional().describe("Specific files to analyze"),
    languages: z.array(z.string()).optional().describe("Programming languages to focus on"),
    patternTypes: z.array(z.enum(["function", "class", "import", "variable", "structure"])).optional(),
    minComplexity: z.number().min(1).max(10).default(1).describe("Minimum complexity threshold"),
    includeMetadata: z.boolean().default(true).describe("Include detailed pattern metadata"),
    outputFormat: z.enum(["summary", "detailed", "json"]).default("summary"),
  }),

  async execute(params, _ctx) {
    const storage = MemoryStorage.getInstance();
    const app = App.info();

    try {
      switch (params.action) {
        case "detect-patterns":
          return await detectPatterns(storage, app, params);
        case "analyze-complexity":
          return await analyzeComplexity(storage, params);
        case "find-duplicates":
          return await findDuplicates(storage, params);
        case "suggest-refactoring":
          return await suggestRefactoring(storage, params);
        case "export-patterns":
          return await exportPatterns(storage, params);
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        title: "Code Pattern Detector Error",
        metadata: { error: errorMessage },
        output: `Error: ${errorMessage}`,
      };
    }
  },
});

async function detectPatterns(
  storage: MemoryStorage,
  app: any,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const filePaths = params.filePaths || await discoverSourceFiles(app.path.root, params.languages);
  const detectedPatterns: DetectedPattern[] = [];

  for (const filePath of filePaths.slice(0, 50)) { // Limit for performance
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const language = detectLanguage(filePath);
      
      if (params.languages && !params.languages.includes(language)) continue;

      const patterns = await analyzeFilePatterns(content, filePath, language, params);
      detectedPatterns.push(...patterns);
    } catch (error) {
      console.warn(`Failed to analyze ${filePath}:`, error);
    }
  }

  // Store patterns in database
  let storedCount = 0;
  for (const pattern of detectedPatterns) {
    try {
      storage.addCodePattern({
        id: pattern.id,
        patternType: pattern.type,
        pattern: pattern.pattern,
        filePath: pattern.filePath,
        language: pattern.language,
        confidence: pattern.confidence,
        metadata: JSON.stringify(pattern.metadata),
      });
      storedCount++;
    } catch (error) {
      // Pattern might already exist, update frequency
      storage.updatePatternFrequency(pattern.id);
    }
  }

  const analysis = analyzePatterns(detectedPatterns);

  let output = `## Code Pattern Detection Complete\n\n`;
  output += `**Files Analyzed**: ${filePaths.length}\n`;
  output += `**Patterns Detected**: ${detectedPatterns.length}\n`;
  output += `**Patterns Stored**: ${storedCount}\n\n`;

  if (params.outputFormat === "detailed" || params.outputFormat === "summary") {
    output += `### Pattern Distribution\n\n`;
    Object.entries(analysis.patternsByType).forEach(([type, count]) => {
      output += `- **${type}**: ${count}\n`;
    });

    output += `\n### Language Distribution\n\n`;
    Object.entries(analysis.patternsByLanguage).forEach(([lang, count]) => {
      output += `- **${lang}**: ${count}\n`;
    });

    if (analysis.recommendations.length > 0) {
      output += `\n### Recommendations\n\n`;
      analysis.recommendations.forEach((rec, index) => {
        output += `${index + 1}. ${rec}\n`;
      });
    }

    if (params.outputFormat === "detailed") {
      output += `\n### Sample Patterns\n\n`;
      detectedPatterns.slice(0, 5).forEach((pattern, index) => {
        output += `#### ${index + 1}. ${pattern.type.toUpperCase()} - ${pattern.language}\n`;
        output += `**File**: ${path.relative(app.path.root, pattern.filePath)}\n`;
        output += `**Pattern**: \`${pattern.pattern.substring(0, 100)}${pattern.pattern.length > 100 ? '...' : ''}\`\n`;
        output += `**Confidence**: ${Math.round(pattern.confidence * 100)}%\n`;
        if (pattern.metadata.complexity) {
          output += `**Complexity**: ${pattern.metadata.complexity}/10\n`;
        }
        output += `\n`;
      });
    }
  }

  return {
    title: "Pattern Detection Results",
    metadata: {
      filesAnalyzed: filePaths.length,
      patternsDetected: detectedPatterns.length,
      patternsStored: storedCount,
      analysis,
    },
    output: output.trim(),
  };
}

async function analyzeComplexity(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const patterns = storage.getCodePatterns(
    params.languages?.[0],
    params.patternTypes?.[0],
    0.5
  );

  const complexityAnalysis = patterns.map(pattern => {
    const metadata = JSON.parse(pattern.metadata || '{}');
    return {
      id: pattern.id,
      pattern: pattern.pattern,
      complexity: metadata.complexity || calculateComplexity(pattern.pattern),
      filePath: pattern.filePath,
      language: pattern.language,
    };
  }).filter(p => p.complexity >= params.minComplexity);

  // Sort by complexity
  complexityAnalysis.sort((a, b) => b.complexity - a.complexity);

  let output = `## Complexity Analysis\n\n`;
  output += `**Patterns Analyzed**: ${patterns.length}\n`;
  output += `**High Complexity Patterns**: ${complexityAnalysis.length}\n`;
  output += `**Average Complexity**: ${Math.round(complexityAnalysis.reduce((sum, p) => sum + p.complexity, 0) / complexityAnalysis.length * 100) / 100}\n\n`;

  if (complexityAnalysis.length > 0) {
    output += `### Most Complex Patterns\n\n`;
    complexityAnalysis.slice(0, 10).forEach((item, index) => {
      output += `#### ${index + 1}. Complexity: ${item.complexity}/10\n`;
      output += `**File**: ${path.basename(item.filePath)}\n`;
      output += `**Language**: ${item.language}\n`;
      output += `**Pattern**: \`${item.pattern.substring(0, 80)}${item.pattern.length > 80 ? '...' : ''}\`\n\n`;
    });

    // Provide refactoring suggestions for high complexity patterns
    const highComplexity = complexityAnalysis.filter(p => p.complexity >= 7);
    if (highComplexity.length > 0) {
      output += `### Refactoring Suggestions\n\n`;
      output += `Found ${highComplexity.length} patterns with complexity ≥ 7 that may benefit from refactoring:\n\n`;
      highComplexity.slice(0, 5).forEach((item, index) => {
        output += `${index + 1}. **${path.basename(item.filePath)}** - Consider breaking down this ${item.language} pattern\n`;
      });
    }
  }

  return {
    title: "Complexity Analysis",
    metadata: {
      totalPatterns: patterns.length,
      highComplexityCount: complexityAnalysis.length,
      averageComplexity: complexityAnalysis.reduce((sum, p) => sum + p.complexity, 0) / complexityAnalysis.length,
    },
    output: output.trim(),
  };
}

async function findDuplicates(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const patterns = storage.getCodePatterns(
    params.languages?.[0],
    params.patternTypes?.[0]
  );

  // Group similar patterns
  const duplicateGroups = findSimilarPatterns(patterns);
  const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);

  let output = `## Duplicate Pattern Analysis\n\n`;
  output += `**Total Patterns**: ${patterns.length}\n`;
  output += `**Duplicate Groups**: ${duplicateGroups.length}\n`;
  output += `**Duplicate Patterns**: ${duplicateCount}\n`;
  output += `**Duplication Rate**: ${Math.round((duplicateCount / patterns.length) * 100)}%\n\n`;

  if (duplicateGroups.length > 0) {
    output += `### Duplicate Pattern Groups\n\n`;
    duplicateGroups.slice(0, 5).forEach((group, index) => {
      output += `#### Group ${index + 1} (${group.length} patterns)\n`;
      output += `**Representative Pattern**: \`${group[0].pattern.substring(0, 60)}...\`\n`;
      output += `**Files**:\n`;
      group.forEach(pattern => {
        output += `- ${path.basename(pattern.filePath)} (${pattern.language})\n`;
      });
      output += `\n`;
    });

    output += `### Refactoring Opportunities\n\n`;
    output += `Consider extracting common patterns into reusable components or utilities:\n\n`;
    duplicateGroups.slice(0, 3).forEach((group, index) => {
      output += `${index + 1}. Extract pattern found in ${group.length} files into a shared utility\n`;
    });
  }

  return {
    title: "Duplicate Pattern Analysis",
    metadata: {
      totalPatterns: patterns.length,
      duplicateGroups: duplicateGroups.length,
      duplicateCount,
      duplicationRate: (duplicateCount / patterns.length) * 100,
    },
    output: output.trim(),
  };
}

async function suggestRefactoring(
  storage: MemoryStorage,
  _params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const patterns = storage.getCodePatterns();
  const suggestions: string[] = [];

  // Analyze patterns for refactoring opportunities
  const complexPatterns = patterns.filter(p => {
    const metadata = JSON.parse(p.metadata || '{}');
    return (metadata.complexity || calculateComplexity(p.pattern)) >= 6;
  });

  const duplicateGroups = findSimilarPatterns(patterns);
  const longFunctions = patterns.filter(p => 
    p.patternType === 'function' && p.pattern.length > 200
  );

  if (complexPatterns.length > 0) {
    suggestions.push(`Break down ${complexPatterns.length} complex patterns into smaller, more manageable pieces`);
  }

  if (duplicateGroups.length > 0) {
    suggestions.push(`Extract ${duplicateGroups.length} duplicate pattern groups into reusable utilities`);
  }

  if (longFunctions.length > 0) {
    suggestions.push(`Refactor ${longFunctions.length} long functions to improve readability`);
  }

  // Language-specific suggestions
  const tsPatterns = patterns.filter(p => p.language === 'typescript');
  const jsPatterns = patterns.filter(p => p.language === 'javascript');
  
  if (tsPatterns.length > 0 && jsPatterns.length > 0) {
    suggestions.push(`Consider migrating ${jsPatterns.length} JavaScript patterns to TypeScript for better type safety`);
  }

  let output = `## Refactoring Suggestions\n\n`;
  output += `**Patterns Analyzed**: ${patterns.length}\n`;
  output += `**Refactoring Opportunities**: ${suggestions.length}\n\n`;

  if (suggestions.length > 0) {
    output += `### Recommendations\n\n`;
    suggestions.forEach((suggestion, index) => {
      output += `${index + 1}. ${suggestion}\n`;
    });

    output += `\n### Priority Areas\n\n`;
    if (complexPatterns.length > 0) {
      output += `#### High Complexity Patterns (${complexPatterns.length})\n`;
      complexPatterns.slice(0, 3).forEach(pattern => {
        output += `- ${path.basename(pattern.filePath)} - ${pattern.patternType}\n`;
      });
      output += `\n`;
    }

    if (duplicateGroups.length > 0) {
      output += `#### Duplicate Patterns (${duplicateGroups.length} groups)\n`;
      duplicateGroups.slice(0, 3).forEach((group, index) => {
        output += `- Group ${index + 1}: ${group.length} similar patterns\n`;
      });
    }
  } else {
    output += `No major refactoring opportunities detected. Your codebase appears to be well-structured!`;
  }

  return {
    title: "Refactoring Suggestions",
    metadata: {
      patternsAnalyzed: patterns.length,
      suggestions: suggestions.length,
      complexPatterns: complexPatterns.length,
      duplicateGroups: duplicateGroups.length,
    },
    output: output.trim(),
  };
}

async function exportPatterns(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const patterns = storage.getCodePatterns(
    params.languages?.[0],
    params.patternTypes?.[0]
  );

  const exportData = {
    timestamp: new Date().toISOString(),
    totalPatterns: patterns.length,
    patterns: patterns.map(pattern => ({
      id: pattern.id,
      type: pattern.patternType,
      pattern: pattern.pattern,
      filePath: pattern.filePath,
      language: pattern.language,
      frequency: pattern.frequency,
      confidence: pattern.confidence,
      metadata: JSON.parse(pattern.metadata || '{}'),
    })),
    analytics: storage.getPatternAnalytics(),
  };

  const app = App.info();
  const exportPath = path.join(app.path.root, '.kuuzuki', `patterns-export-${Date.now()}.json`);
  
  // Ensure directory exists
  const exportDir = path.dirname(exportPath);
  if (!await fs.promises.access(exportDir).then(() => true).catch(() => false)) {
    await fs.promises.mkdir(exportDir, { recursive: true });
  }

  await fs.promises.writeFile(exportPath, JSON.stringify(exportData, null, 2));

  let output = `## Pattern Export Complete\n\n`;
  output += `**Export File**: ${exportPath}\n`;
  output += `**Patterns Exported**: ${patterns.length}\n`;
  output += `**File Size**: ${Math.round((await fs.promises.stat(exportPath)).size / 1024)} KB\n\n`;

  if (params.outputFormat === "json") {
    output += `### Export Data Preview\n\n`;
    output += `\`\`\`json\n${JSON.stringify(exportData, null, 2).substring(0, 500)}...\n\`\`\``;
  }

  return {
    title: "Pattern Export",
    metadata: {
      exportPath,
      patternsExported: patterns.length,
      exportSize: (await fs.promises.stat(exportPath)).size,
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

async function analyzeFilePatterns(
  content: string,
  filePath: string,
  language: string,
  params: any
): Promise<DetectedPattern[]> {
  const patterns: DetectedPattern[] = [];
  const lines = content.split('\n');

  // Detect functions with enhanced analysis
  const functions = detectFunctions(lines, language);
  patterns.push(...functions.map(func => ({
    id: `func-${generatePatternId(func.pattern)}`,
    type: "function" as const,
    pattern: func.pattern,
    filePath,
    language,
    confidence: func.confidence,
    metadata: {
      lineNumber: func.lineNumber,
      complexity: func.complexity,
      parameters: func.parameters,
      returnType: func.returnType,
    },
  })));

  // Detect classes
  const classes = detectClasses(lines, language);
  patterns.push(...classes.map(cls => ({
    id: `class-${generatePatternId(cls.pattern)}`,
    type: "class" as const,
    pattern: cls.pattern,
    filePath,
    language,
    confidence: cls.confidence,
    metadata: {
      lineNumber: cls.lineNumber,
      complexity: cls.complexity,
      visibility: cls.visibility,
    },
  })));

  // Detect imports with dependency analysis
  const imports = detectImports(lines, language);
  patterns.push(...imports.map(imp => ({
    id: `import-${generatePatternId(imp.pattern)}`,
    type: "import" as const,
    pattern: imp.pattern,
    filePath,
    language,
    confidence: imp.confidence,
    metadata: {
      lineNumber: imp.lineNumber,
      dependencies: imp.dependencies,
    },
  })));

  // Filter by pattern types if specified
  return params.patternTypes ? 
    patterns.filter(p => params.patternTypes.includes(p.type)) :
    patterns;
}

function detectFunctions(lines: string[], language: string): any[] {
  const functions: any[] = [];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    let match: RegExpMatchArray | null = null;
    
    if (language === "typescript" || language === "javascript") {
      // Function declarations
      match = trimmed.match(/^(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)(\s*:\s*([^{]+))?\s*\{?/);
      if (match) {
        functions.push({
          pattern: trimmed,
          lineNumber: index + 1,
          confidence: 0.9,
          complexity: calculateFunctionComplexity(trimmed),
          parameters: match[4] ? match[4].split(',').map(p => p.trim()) : [],
          returnType: match[6] || undefined,
        });
      }
      
      // Arrow functions
      match = trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(\([^)]*\)|[^=]+)\s*=>/);
      if (match) {
        functions.push({
          pattern: trimmed,
          lineNumber: index + 1,
          confidence: 0.8,
          complexity: calculateFunctionComplexity(trimmed),
          parameters: match[4].startsWith('(') ? 
            match[4].slice(1, -1).split(',').map(p => p.trim()) : [match[4]],
        });
      }
    } else if (language === "python") {
      match = trimmed.match(/^def\s+(\w+)\s*\(([^)]*)\)(\s*->\s*([^:]+))?\s*:/);
      if (match) {
        functions.push({
          pattern: trimmed,
          lineNumber: index + 1,
          confidence: 0.9,
          complexity: calculateFunctionComplexity(trimmed),
          parameters: match[2] ? match[2].split(',').map(p => p.trim()) : [],
          returnType: match[4] || undefined,
        });
      }
    }
  });

  return functions;
}

function detectClasses(lines: string[], language: string): any[] {
  const classes: any[] = [];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    let match: RegExpMatchArray | null = null;
    
    if (language === "typescript" || language === "javascript") {
      match = trimmed.match(/^(export\s+)?(abstract\s+)?class\s+(\w+)(\s+extends\s+\w+)?(\s+implements\s+[\w,\s]+)?\s*\{?/);
      if (match) {
        classes.push({
          pattern: trimmed,
          lineNumber: index + 1,
          confidence: 0.9,
          complexity: calculateClassComplexity(trimmed),
          visibility: match[1] ? 'public' : 'private',
        });
      }
    } else if (language === "python") {
      match = trimmed.match(/^class\s+(\w+)(\([^)]*\))?\s*:/);
      if (match) {
        classes.push({
          pattern: trimmed,
          lineNumber: index + 1,
          confidence: 0.9,
          complexity: calculateClassComplexity(trimmed),
        });
      }
    }
  });

  return classes;
}

function detectImports(lines: string[], language: string): any[] {
  const imports: any[] = [];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    let dependencies: string[] = [];
    
    if (language === "typescript" || language === "javascript") {
      if (trimmed.startsWith("import ") && trimmed.includes("from ")) {
        const match = trimmed.match(/from\s+['"]([^'"]+)['"]/);
        if (match) {
          dependencies = [match[1]];
        }
        imports.push({
          pattern: trimmed,
          lineNumber: index + 1,
          confidence: 0.8,
          dependencies,
        });
      }
    } else if (language === "python") {
      if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
        const match = trimmed.match(/(?:from\s+(\w+)|import\s+(\w+))/);
        if (match) {
          dependencies = [match[1] || match[2]];
        }
        imports.push({
          pattern: trimmed,
          lineNumber: index + 1,
          confidence: 0.8,
          dependencies,
        });
      }
    }
  });

  return imports;
}

function calculateComplexity(pattern: string): number {
  let complexity = 1;
  
  // Count control flow statements
  const controlFlow = (pattern.match(/\b(if|else|for|while|switch|case|try|catch)\b/g) || []).length;
  complexity += controlFlow;
  
  // Count nested structures
  const nesting = (pattern.match(/[{(]/g) || []).length;
  complexity += Math.floor(nesting / 2);
  
  // Count operators
  const operators = (pattern.match(/[+\-*/%=<>!&|]/g) || []).length;
  complexity += Math.floor(operators / 5);
  
  return Math.min(complexity, 10);
}

function calculateFunctionComplexity(pattern: string): number {
  let complexity = calculateComplexity(pattern);
  
  // Additional complexity for function-specific patterns
  if (pattern.includes("async")) complexity += 1;
  if (pattern.includes("=>")) complexity += 0.5;
  
  return Math.min(complexity, 10);
}

function calculateClassComplexity(pattern: string): number {
  let complexity = calculateComplexity(pattern);
  
  // Additional complexity for class-specific patterns
  if (pattern.includes("extends")) complexity += 1;
  if (pattern.includes("implements")) complexity += 1;
  if (pattern.includes("abstract")) complexity += 1;
  
  return Math.min(complexity, 10);
}

function findSimilarPatterns(patterns: any[]): any[][] {
  const groups: any[][] = [];
  const processed = new Set<string>();
  
  for (const pattern of patterns) {
    if (processed.has(pattern.id)) continue;
    
    const similar = patterns.filter(p => 
      p.id !== pattern.id && 
      !processed.has(p.id) &&
      calculateSimilarity(pattern.pattern, p.pattern) > 0.8
    );
    
    if (similar.length > 0) {
      const group = [pattern, ...similar];
      groups.push(group);
      group.forEach(p => processed.add(p.id));
    }
  }
  
  return groups.filter(group => group.length > 1);
}

function calculateSimilarity(pattern1: string, pattern2: string): number {
  const words1 = new Set(pattern1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const words2 = new Set(pattern2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

function analyzePatterns(patterns: DetectedPattern[]): PatternAnalysis {
  const patternsByType = patterns.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const patternsByLanguage = patterns.reduce((acc, p) => {
    acc[p.language] = (acc[p.language] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const complexityDistribution = patterns.reduce((acc, p) => {
    const complexity = p.metadata.complexity || 1;
    const bucket = complexity <= 3 ? 'low' : complexity <= 6 ? 'medium' : 'high';
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recommendations: string[] = [];
  
  if (patternsByType.function > patternsByType.class * 3) {
    recommendations.push("Consider organizing functions into classes for better structure");
  }
  
  if (complexityDistribution.high > patterns.length * 0.2) {
    recommendations.push("High complexity patterns detected - consider refactoring");
  }

  return {
    totalPatterns: patterns.length,
    patternsByType,
    patternsByLanguage,
    complexityDistribution,
    recommendations,
  };
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