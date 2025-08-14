import { Tool } from "./tool";
import { z } from "zod";
import { MemoryStorage } from "./memory-storage";
import { App } from "../app/app";
import * as path from "path";
import * as fs from "fs";
import DESCRIPTION from "./smart-documentation-linker.txt";

interface DocumentationMatch {
  filePath: string;
  section?: string;
  relevanceScore: number;
  matchType: "keyword" | "semantic" | "pattern" | "context";
  excerpt: string;
  lineNumber?: number;
}

interface LinkingSuggestion {
  ruleId: string;
  ruleText: string;
  documentationMatches: DocumentationMatch[];
  confidence: number;
  autoLinkable: boolean;
}

export const SmartDocumentationLinkerTool = Tool.define("smart-documentation-linker", {
  description: DESCRIPTION,

  parameters: z.object({
    action: z.enum([
      "scan-documentation",
      "link-rules",
      "suggest-links",
      "validate-links",
      "auto-link",
      "update-links"
    ]),
    ruleIds: z.array(z.string()).optional().describe("Specific rule IDs to process"),
    docPaths: z.array(z.string()).optional().describe("Documentation directories to scan"),
    minRelevance: z.number().min(0).max(1).default(0.6).describe("Minimum relevance score for suggestions"),
    autoLink: z.boolean().default(false).describe("Automatically create links for high-confidence matches"),
    includeCodeComments: z.boolean().default(true).describe("Include code comments in documentation scan"),
    linkTypes: z.array(z.enum(["keyword", "semantic", "pattern", "context"])).optional(),
  }),

  async execute(params, ctx) {
    const storage = MemoryStorage.getInstance();
    const app = App.info();

    try {
      switch (params.action) {
        case "scan-documentation":
          return await scanDocumentation(storage, app, params);
        case "link-rules":
          return await linkRules(storage, app, params, ctx);
        case "suggest-links":
          return await suggestLinks(storage, app, params);
        case "validate-links":
          return await validateLinks(storage, app, params);
        case "auto-link":
          return await autoLink(storage, app, params, ctx);
        case "update-links":
          return await updateLinks(storage, app, params);
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        title: "Smart Documentation Linker Error",
        metadata: { error: errorMessage },
        output: `Error: ${errorMessage}`,
      };
    }
  },
});

async function scanDocumentation(
  _storage: MemoryStorage,
  app: any,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const docPaths = params.docPaths || await discoverDocumentationFiles(app.path.root);
  const documentationIndex = await buildDocumentationIndex(docPaths, params);

  // Store documentation index for future use
  const indexPath = path.join(app.path.root, '.kuuzuki', 'documentation-index.json');
  await ensureDirectoryExists(path.dirname(indexPath));
  await fs.promises.writeFile(indexPath, JSON.stringify(documentationIndex, null, 2));

  let output = `## Documentation Scan Complete\n\n`;
  output += `**Files Scanned**: ${docPaths.length}\n`;
  output += `**Sections Indexed**: ${documentationIndex.sections.length}\n`;
  output += `**Keywords Extracted**: ${documentationIndex.keywords.length}\n`;
  output += `**Code Examples Found**: ${documentationIndex.codeExamples.length}\n\n`;

  output += `### Documentation Structure\n\n`;
  const filesByType = groupFilesByType(docPaths);
  Object.entries(filesByType).forEach(([type, files]) => {
    output += `- **${type}**: ${files.length} files\n`;
  });

  output += `\n### Top Keywords\n\n`;
  documentationIndex.keywords
    .sort((a: any, b: any) => b.frequency - a.frequency)
    .slice(0, 10)
    .forEach((keyword: any, index: number) => {
      output += `${index + 1}. **${keyword.term}** (${keyword.frequency} occurrences)\n`;
    });

  return {
    title: "Documentation Scan",
    metadata: {
      filesScanned: docPaths.length,
      sectionsIndexed: documentationIndex.sections.length,
      keywordsExtracted: documentationIndex.keywords.length,
      indexPath,
    },
    output: output.trim(),
  };
}

async function linkRules(
  storage: MemoryStorage,
  app: any,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = params.ruleIds ? 
    params.ruleIds.map((id: string) => storage.getRule(id)).filter(Boolean) :
    storage.getRulesByCategory();

  const documentationIndex = await loadDocumentationIndex(app.path.root);
  const linkingSuggestions: LinkingSuggestion[] = [];

  for (const rule of rules) {
    const matches = await findDocumentationMatches(rule, documentationIndex, params);
    if (matches.length > 0) {
      linkingSuggestions.push({
        ruleId: rule.id,
        ruleText: rule.text,
        documentationMatches: matches,
        confidence: calculateLinkingConfidence(matches),
        autoLinkable: matches.some(m => m.relevanceScore >= 0.8),
      });
    }
  }

  // Apply automatic links if requested
  let linkedCount = 0;
  if (params.autoLink) {
    for (const suggestion of linkingSuggestions) {
      if (suggestion.autoLinkable && suggestion.confidence >= 0.7) {
        const bestMatch = suggestion.documentationMatches[0];
        await linkRuleToDocumentation(storage, suggestion.ruleId, bestMatch, ctx);
        linkedCount++;
      }
    }
  }

  let output = `## Rule-Documentation Linking\n\n`;
  output += `**Rules Processed**: ${rules.length}\n`;
  output += `**Linking Suggestions**: ${linkingSuggestions.length}\n`;
  output += `**Auto-Linked**: ${linkedCount}\n\n`;

  if (linkingSuggestions.length > 0) {
    output += `### Linking Suggestions\n\n`;
    linkingSuggestions.slice(0, 10).forEach((suggestion, index) => {
      output += `#### ${index + 1}. Rule: ${suggestion.ruleId}\n`;
      output += `**Text**: "${suggestion.ruleText}"\n`;
      output += `**Confidence**: ${Math.round(suggestion.confidence * 100)}%\n`;
      output += `**Best Match**: ${suggestion.documentationMatches[0].filePath}\n`;
      output += `**Relevance**: ${Math.round(suggestion.documentationMatches[0].relevanceScore * 100)}%\n`;
      if (suggestion.autoLinkable) {
        output += `**Status**: ✅ Auto-linkable\n`;
      }
      output += `\n`;
    });
  }

  return {
    title: "Rule Linking Results",
    metadata: {
      rulesProcessed: rules.length,
      suggestionsGenerated: linkingSuggestions.length,
      autoLinked: linkedCount,
    },
    output: output.trim(),
  };
}

async function suggestLinks(
  storage: MemoryStorage,
  app: any,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = storage.getRulesByCategory();
  const unlinkedRules = rules.filter(rule => !rule.filePath && 
    (!rule.documentationLinks || JSON.parse(rule.documentationLinks).length === 0));

  const documentationIndex = await loadDocumentationIndex(app.path.root);
  const suggestions: LinkingSuggestion[] = [];

  for (const rule of unlinkedRules.slice(0, 20)) { // Limit for performance
    const matches = await findDocumentationMatches(rule, documentationIndex, params);
    if (matches.length > 0) {
      suggestions.push({
        ruleId: rule.id,
        ruleText: rule.text,
        documentationMatches: matches.slice(0, 3), // Top 3 matches
        confidence: calculateLinkingConfidence(matches),
        autoLinkable: matches[0]?.relevanceScore >= 0.8,
      });
    }
  }

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  let output = `## Documentation Linking Suggestions\n\n`;
  output += `**Unlinked Rules**: ${unlinkedRules.length}\n`;
  output += `**Rules with Suggestions**: ${suggestions.length}\n`;
  output += `**High-Confidence Matches**: ${suggestions.filter(s => s.confidence >= 0.8).length}\n\n`;

  if (suggestions.length > 0) {
    output += `### Top Suggestions\n\n`;
    suggestions.slice(0, 5).forEach((suggestion, index) => {
      output += `#### ${index + 1}. ${suggestion.ruleId}\n`;
      output += `**Rule**: "${suggestion.ruleText}"\n`;
      output += `**Confidence**: ${Math.round(suggestion.confidence * 100)}%\n\n`;
      
      output += `**Documentation Matches**:\n`;
      suggestion.documentationMatches.forEach((match, matchIndex) => {
        output += `${matchIndex + 1}. **${path.basename(match.filePath)}** (${Math.round(match.relevanceScore * 100)}%)\n`;
        output += `   ${match.excerpt.substring(0, 100)}...\n`;
      });
      output += `\n`;
    });

    output += `### Quick Actions\n\n`;
    output += `To auto-link high-confidence matches:\n`;
    output += `\`smart-documentation-linker({ action: "auto-link", minRelevance: 0.8 })\`\n`;
  }

  return {
    title: "Linking Suggestions",
    metadata: {
      unlinkedRules: unlinkedRules.length,
      suggestionsGenerated: suggestions.length,
      highConfidenceMatches: suggestions.filter(s => s.confidence >= 0.8).length,
    },
    output: output.trim(),
  };
}

async function validateLinks(
  storage: MemoryStorage,
  app: any,
  _params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = storage.getRulesByCategory();
  const linkedRules = rules.filter(rule => 
    rule.filePath || (rule.documentationLinks && JSON.parse(rule.documentationLinks).length > 0));

  const validationResults = [];
  let brokenLinks = 0;
  let validLinks = 0;

  for (const rule of linkedRules) {
    const links = [];
    
    // Check primary file path
    if (rule.filePath) {
      links.push({ path: rule.filePath, type: 'primary' });
    }

    // Check documentation links
    if (rule.documentationLinks) {
      const docLinks = JSON.parse(rule.documentationLinks);
      docLinks.forEach((link: any) => {
        links.push({ path: link.filePath, type: 'documentation', section: link.section });
      });
    }

    for (const link of links) {
      const fullPath = path.isAbsolute(link.path) ? link.path : path.join(app.path.root, link.path);
      const exists = await fs.promises.access(fullPath).then(() => true).catch(() => false);
      
      if (exists) {
        validLinks++;
      } else {
        brokenLinks++;
        validationResults.push({
          ruleId: rule.id,
          ruleText: rule.text,
          brokenLink: link.path,
          linkType: link.type,
        });
      }
    }
  }

  let output = `## Link Validation Results\n\n`;
  output += `**Linked Rules**: ${linkedRules.length}\n`;
  output += `**Valid Links**: ${validLinks}\n`;
  output += `**Broken Links**: ${brokenLinks}\n`;
  output += `**Success Rate**: ${Math.round((validLinks / (validLinks + brokenLinks)) * 100)}%\n\n`;

  if (brokenLinks > 0) {
    output += `### Broken Links\n\n`;
    validationResults.forEach((result, index) => {
      output += `${index + 1}. **${result.ruleId}** (${result.linkType})\n`;
      output += `   Rule: "${result.ruleText}"\n`;
      output += `   Broken Link: ${result.brokenLink}\n\n`;
    });

    output += `### Recommendations\n\n`;
    output += `- Update broken file paths to correct locations\n`;
    output += `- Remove links to deleted documentation\n`;
    output += `- Run \`smart-documentation-linker({ action: "update-links" })\` to fix automatically\n`;
  }

  return {
    title: "Link Validation",
    metadata: {
      linkedRules: linkedRules.length,
      validLinks,
      brokenLinks,
      successRate: (validLinks / (validLinks + brokenLinks)) * 100,
    },
    output: output.trim(),
  };
}

async function autoLink(
  storage: MemoryStorage,
  app: any,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = storage.getRulesByCategory();
  const unlinkedRules = rules.filter(rule => !rule.filePath);
  const documentationIndex = await loadDocumentationIndex(app.path.root);

  let linkedCount = 0;
  const linkedRules = [];

  for (const rule of unlinkedRules) {
    const matches = await findDocumentationMatches(rule, documentationIndex, params);
    const bestMatch = matches[0];

    if (bestMatch && bestMatch.relevanceScore >= params.minRelevance) {
      await linkRuleToDocumentation(storage, rule.id, bestMatch, ctx);
      linkedCount++;
      linkedRules.push({
        ruleId: rule.id,
        ruleText: rule.text,
        linkedTo: bestMatch.filePath,
        relevance: bestMatch.relevanceScore,
      });
    }
  }

  let output = `## Auto-Linking Complete\n\n`;
  output += `**Unlinked Rules**: ${unlinkedRules.length}\n`;
  output += `**Successfully Linked**: ${linkedCount}\n`;
  output += `**Success Rate**: ${Math.round((linkedCount / unlinkedRules.length) * 100)}%\n\n`;

  if (linkedCount > 0) {
    output += `### Newly Linked Rules\n\n`;
    linkedRules.forEach((link, index) => {
      output += `${index + 1}. **${link.ruleId}**\n`;
      output += `   Rule: "${link.ruleText}"\n`;
      output += `   Linked to: ${path.basename(link.linkedTo)}\n`;
      output += `   Relevance: ${Math.round(link.relevance * 100)}%\n\n`;
    });
  }

  return {
    title: "Auto-Linking Results",
    metadata: {
      unlinkedRules: unlinkedRules.length,
      successfullyLinked: linkedCount,
      successRate: (linkedCount / unlinkedRules.length) * 100,
    },
    output: output.trim(),
  };
}

async function updateLinks(
  storage: MemoryStorage,
  app: any,
  _params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = storage.getRulesByCategory();
  const linkedRules = rules.filter(rule => rule.filePath);
  
  let updatedCount = 0;
  let removedCount = 0;

  for (const rule of linkedRules) {
    const fullPath = path.isAbsolute(rule.filePath!) ? 
      rule.filePath! : 
      path.join(app.path.root, rule.filePath!);
    
    const exists = await fs.promises.access(fullPath).then(() => true).catch(() => false);
    
    if (!exists) {
      // Try to find the file in a new location
      const fileName = path.basename(rule.filePath!);
      const newPath = await findFileInProject(app.path.root, fileName);
      
      if (newPath) {
        // Update the rule with new path
        storage.updateRule(rule.id, { filePath: path.relative(app.path.root, newPath) });
        updatedCount++;
      } else {
        // Remove broken link
        storage.updateRule(rule.id, { filePath: null });
        removedCount++;
      }
    }
  }

  let output = `## Link Update Complete\n\n`;
  output += `**Linked Rules Checked**: ${linkedRules.length}\n`;
  output += `**Links Updated**: ${updatedCount}\n`;
  output += `**Broken Links Removed**: ${removedCount}\n\n`;

  if (updatedCount > 0 || removedCount > 0) {
    output += `### Changes Made\n\n`;
    if (updatedCount > 0) {
      output += `- Updated ${updatedCount} rules with corrected file paths\n`;
    }
    if (removedCount > 0) {
      output += `- Removed ${removedCount} broken links to deleted files\n`;
    }
  }

  return {
    title: "Link Updates",
    metadata: {
      rulesChecked: linkedRules.length,
      linksUpdated: updatedCount,
      brokenLinksRemoved: removedCount,
    },
    output: output.trim(),
  };
}

// Helper functions

async function discoverDocumentationFiles(rootPath: string): Promise<string[]> {
  const docFiles: string[] = [];
  const docExtensions = ['.md', '.txt', '.rst', '.adoc'];
  const docDirs = ['docs', 'documentation', 'doc', '.'];

  for (const dir of docDirs) {
    const dirPath = path.join(rootPath, dir);
    try {
      await walkDirectory(dirPath, (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (docExtensions.includes(ext)) {
          docFiles.push(filePath);
        }
      });
    } catch (error) {
      // Directory doesn't exist, skip
    }
  }

  return docFiles;
}

async function walkDirectory(dir: string, callback: (filePath: string) => void): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

async function buildDocumentationIndex(docPaths: string[], _params: any): Promise<any> {
  const index = {
    sections: [] as any[],
    keywords: [] as any[],
    codeExamples: [] as any[],
    lastUpdated: new Date().toISOString(),
  };

  const keywordFreq = new Map<string, number>();

  for (const filePath of docPaths) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const sections = extractSections(content, filePath);
      const keywords = extractKeywords(content);
      const codeExamples = extractCodeExamples(content, filePath);

      index.sections.push(...sections);
      index.codeExamples.push(...codeExamples);

      // Count keyword frequencies
      keywords.forEach(keyword => {
        keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
      });
    } catch (error) {
      console.warn(`Failed to index ${filePath}:`, error);
    }
  }

  // Convert keyword frequencies to array
  index.keywords = Array.from(keywordFreq.entries()).map(([term, frequency]) => ({
    term,
    frequency,
  }));

  return index;
}

function extractSections(content: string, filePath: string): any[] {
  const sections = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      const startLine = i + 1;
      
      // Find section content
      let endLine = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^#{1,6}\s+/)) {
          endLine = j;
          break;
        }
      }
      
      const sectionContent = lines.slice(i + 1, endLine).join('\n').trim();
      
      sections.push({
        filePath,
        title,
        level,
        startLine,
        endLine,
        content: sectionContent,
      });
    }
  }
  
  return sections;
}

function extractKeywords(content: string): string[] {
  // Extract meaningful keywords from content
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !isStopWord(word));
  
  return [...new Set(words)];
}

function extractCodeExamples(content: string, filePath: string): any[] {
  const codeBlocks = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push({
      filePath,
      language: match[1] || 'text',
      code: match[2].trim(),
      startIndex: match.index,
    });
  }
  
  return codeBlocks;
}

function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'can', 'may', 'might', 'must', 'shall', 'from', 'into', 'onto', 'upon',
  ]);
  
  return stopWords.has(word);
}

async function loadDocumentationIndex(rootPath: string): Promise<any> {
  const indexPath = path.join(rootPath, '.kuuzuki', 'documentation-index.json');
  
  try {
    const content = await fs.promises.readFile(indexPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Return empty index if file doesn't exist
    return {
      sections: [],
      keywords: [],
      codeExamples: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function findDocumentationMatches(
  rule: any,
  documentationIndex: any,
  params: any
): Promise<DocumentationMatch[]> {
  const matches: DocumentationMatch[] = [];
  const ruleWords = rule.text.toLowerCase().split(/\s+/);
  
  // Search in sections
  for (const section of documentationIndex.sections) {
    const sectionWords = section.content.toLowerCase().split(/\s+/);
    const relevance = calculateTextRelevance(ruleWords, sectionWords);
    
    if (relevance >= params.minRelevance) {
      matches.push({
        filePath: section.filePath,
        section: section.title,
        relevanceScore: relevance,
        matchType: "semantic",
        excerpt: section.content.substring(0, 200),
        lineNumber: section.startLine,
      });
    }
  }
  
  // Search in code examples
  for (const example of documentationIndex.codeExamples) {
    const codeWords = example.code.toLowerCase().split(/\s+/);
    const relevance = calculateTextRelevance(ruleWords, codeWords);
    
    if (relevance >= params.minRelevance) {
      matches.push({
        filePath: example.filePath,
        relevanceScore: relevance,
        matchType: "pattern",
        excerpt: example.code.substring(0, 200),
      });
    }
  }
  
  // Sort by relevance
  matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return matches.slice(0, 5); // Top 5 matches
}

function calculateTextRelevance(words1: string[], words2: string[]): number {
  const set1 = new Set(words1.filter(w => w.length > 3));
  const set2 = new Set(words2.filter(w => w.length > 3));
  
  const intersection = new Set([...set1].filter(w => set2.has(w)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

function calculateLinkingConfidence(matches: DocumentationMatch[]): number {
  if (matches.length === 0) return 0;
  
  const avgRelevance = matches.reduce((sum, m) => sum + m.relevanceScore, 0) / matches.length;
  const bestMatch = matches[0].relevanceScore;
  
  return (avgRelevance + bestMatch) / 2;
}

async function linkRuleToDocumentation(
  storage: MemoryStorage,
  ruleId: string,
  match: DocumentationMatch,
  _ctx: any
): Promise<void> {
  const rule = storage.getRule(ruleId);
  if (!rule) return;
  
  // Update rule with documentation link
  const existingLinks = JSON.parse(rule.documentationLinks || '[]');
  const newLink = {
    filePath: match.filePath,
    section: match.section,
    lastRead: new Date().toISOString(),
    autoLinked: true,
    relevanceScore: match.relevanceScore,
  };
  
  existingLinks.push(newLink);
  
  storage.updateRule(ruleId, {
    documentationLinks: JSON.stringify(existingLinks),
    lastUsed: new Date().toISOString(),
  });
}

function groupFilesByType(filePaths: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  
  filePaths.forEach(filePath => {
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.md' ? 'Markdown' : 
                 ext === '.txt' ? 'Text' :
                 ext === '.rst' ? 'reStructuredText' :
                 ext === '.adoc' ? 'AsciiDoc' : 'Other';
    
    if (!groups[type]) groups[type] = [];
    groups[type].push(filePath);
  });
  
  return groups;
}

async function findFileInProject(rootPath: string, fileName: string): Promise<string | null> {
  let foundPath: string | null = null;
  
  await walkDirectory(rootPath, (filePath) => {
    if (path.basename(filePath) === fileName && !foundPath) {
      foundPath = filePath;
    }
  });
  
  return foundPath;
}

async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}