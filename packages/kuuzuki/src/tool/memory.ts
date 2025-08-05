import { safeJsonParse, safeJsonParseWithFallback } from "../util/json-utils";
import { z } from "zod";
import * as path from "path";
import { Tool } from "./tool";
import { App } from "../app/app";
import { Permission } from "../permission";
import { MemoryStorage } from "./memory-storage";
import DESCRIPTION from "./memory.txt";

// Schema definitions for memory tool
const RuleAnalyticsSchema = z.object({
  timesApplied: z.number().default(0),
  timesIgnored: z.number().default(0),
  effectivenessScore: z.number().default(0),
  lastEffectiveUse: z.string().optional(),
  userFeedback: z
    .array(
      z.object({
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        timestamp: z.string(),
      }),
    )
    .default([]),
});

const DocumentationLinkSchema = z.object({
  filePath: z.string(),
  section: z.string().optional(),
  lastRead: z.string().optional(),
  contentHash: z.string().optional(),
  autoRead: z.boolean().default(false),
});

const RuleSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: z.enum(["critical", "preferred", "contextual", "deprecated"]),
  filePath: z.string().optional(),
  reason: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  lastUsed: z.string().optional(),
  usageCount: z.number().default(0),
  analytics: RuleAnalyticsSchema.default({
    timesApplied: 0,
    timesIgnored: 0,
    effectivenessScore: 0,
    userFeedback: [],
  }),
  documentationLinks: z.array(DocumentationLinkSchema).default([]),
  tags: z.array(z.string()).default([]),
});

const RuleMetadataSchema = z.object({
  version: z.string().default("1.0.0"),
  lastModified: z.string(),
  totalRules: z.number(),
  sessionRules: z
    .array(
      z.object({
        ruleId: z.string(),
        learnedAt: z.string(),
        context: z.string().optional(),
      }),
    )
    .default([]),
});

const AgentRcRulesSchema = z.object({
  critical: z.array(RuleSchema).default([]),
  preferred: z.array(RuleSchema).default([]),
  contextual: z.array(RuleSchema).default([]),
  deprecated: z.array(RuleSchema).default([]),
});

type Rule = z.infer<typeof RuleSchema>;
type RuleMetadata = z.infer<typeof RuleMetadataSchema>;
type AgentRcRules = z.infer<typeof AgentRcRulesSchema>;

// Context analysis interfaces
interface ContextAnalysis {
  currentTool?: string;
  fileTypes: string[];
  errorPatterns: string[];
  commandHistory: string[];
  sessionContext: string;
  workingDirectory: string;
  recentFiles: string[];
}

interface RuleConflict {
  type: "contradiction" | "overlap" | "redundancy";
  rules: Rule[];
  severity: "low" | "medium" | "high";
  suggestion: string;
  autoResolvable: boolean;
}

interface AgentRc {
  rules?: string[] | AgentRcRules;
  ruleMetadata?: RuleMetadata;
  [key: string]: any;
}

interface AnalyticsData {
  effectivenessScore?: number;
  timesApplied?: number;
  timesIgnored?: number;
  userFeedback?: any[];
  [key: string]: any;
}

interface ContextData {
  currentTool?: string;
  errorPatterns?: string[];
  lastSearch?: string;
  [key: string]: any;
}

interface ImportData {
  rules?: any[];
  sessions?: any[];
  [key: string]: any;
}

export const MemoryTool = Tool.define("memory", {
  description: DESCRIPTION,

  parameters: z.object({
    action: z.enum([
      "add",
      "update",
      "remove",
      "list",
      "link",
      "migrate",
      "suggest",
      "analytics",
      "read-docs",
      "conflicts",
      "feedback",
      "search",
      "usage-history",
      "session-context",
      "cleanup",
      "export-db",
      "import-db",
    ]),
    rule: z
      .string()
      .optional()
      .describe("Rule text for add/update, or rule ID for update/remove"),
    ruleId: z
      .string()
      .optional()
      .describe("Specific rule ID for update/remove operations"),
    category: z
      .enum(["critical", "preferred", "contextual", "deprecated"])
      .optional(),
    filePath: z
      .string()
      .optional()
      .describe("Path to documentation file for contextual rules"),
    reason: z
      .string()
      .optional()
      .describe("Explanation for why this rule is being added/changed"),
    newText: z.string().optional().describe("New text for update operations"),
    context: z
      .string()
      .optional()
      .describe("Context for rule suggestions or analysis"),
    rating: z
      .number()
      .min(1)
      .max(5)
      .optional()
      .describe("User rating for rule effectiveness (1-5)"),
    comment: z.string().optional().describe("User feedback comment"),
    timeframe: z
      .string()
      .optional()
      .describe("Timeframe for analytics (e.g., '7d', '30d', 'all')"),
    compact: z
      .boolean()
      .optional()
      .default(true)
      .describe("Use compact output format to reduce context usage"),
  }),

  async execute(params, ctx) {
    const app = App.info();
    const agentrcPath = path.join(app.path.root, ".agentrc");

    try {
      // Read current .agentrc
      const agentrc = await readAgentRc(agentrcPath);

      switch (params.action) {
        case "add":
          return await addRule(agentrcPath, agentrc, params, ctx);
        case "update":
          return await updateRule(agentrcPath, agentrc, params, ctx);
        case "remove":
          return await removeRule(agentrcPath, agentrc, params, ctx);
        case "list":
          return await listRules(agentrc, params);
        case "link":
          return await linkRule(agentrcPath, agentrc, params, ctx);
        case "migrate":
          return await migrateRules(agentrcPath, agentrc, ctx);
        case "suggest":
          return await suggestRules(agentrc, params, ctx);
        case "analytics":
          return await showAnalytics(agentrc, params);
        case "read-docs":
          return await readDocumentation(agentrc, params);
        case "conflicts":
          return await detectConflicts(agentrc, params);
        case "feedback":
          return await recordFeedback(agentrcPath, agentrc, params, ctx);
        case "search":
          return await searchRules(params, ctx);
        case "usage-history":
          return await getUsageHistory(params, ctx);
        case "session-context":
          return await manageSessionContext(params, ctx);
        case "cleanup":
          return await cleanupData(params);
        case "export-db":
          return await exportDatabase(ctx);
        case "import-db":
          return await importDatabase(params);
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        title: "Memory Tool Error",
        metadata: { error: errorMessage },
        output: `Error: ${errorMessage}`,
      };
    }
  },
});

async function readAgentRc(agentrcPath: string): Promise<AgentRc> {
  const file = Bun.file(agentrcPath);
  if (!(await file.exists())) {
    // Create a default .agentrc file with proper structure
    const defaultAgentRc: AgentRc = {
      rules: {
        critical: [],
        preferred: [],
        contextual: [],
        deprecated: [],
      },
      ruleMetadata: {
        version: "2.0.0",
        lastModified: new Date().toISOString(),
        totalRules: 0,
        sessionRules: [],
      },
    };

    await Bun.write(agentrcPath, JSON.stringify(defaultAgentRc, null, 2));
    return defaultAgentRc;
  }

  const content = await file.text();
  const agentrc = safeJsonParse<AgentRc>(content, "agentrc file");

  // Ensure the agentrc has the proper structure
  if (!agentrc.rules) {
    agentrc.rules = {
      critical: [],
      preferred: [],
      contextual: [],
      deprecated: [],
    };
  }

  if (!agentrc.ruleMetadata) {
    agentrc.ruleMetadata = {
      version: "2.0.0",
      lastModified: new Date().toISOString(),
      totalRules: 0,
      sessionRules: [],
    };
  }

  return agentrc;
}

async function writeAgentRc(
  agentrcPath: string,
  agentrc: AgentRc,
  ctx: Tool.Context,
): Promise<void> {
  await Permission.ask({
    type: "edit",
    sessionID: ctx.sessionID,
    messageID: ctx.messageID,
    callID: ctx.toolCallID,
    title: "Update .agentrc rules",
    metadata: { filePath: agentrcPath },
  });

  await Bun.write(agentrcPath, JSON.stringify(agentrc, null, 2));
}

function generateRuleId(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50) +
    "-" +
    Date.now().toString(36)
  );
}

function ensureStructuredRules(agentrc: AgentRc): AgentRcRules {
  if (!agentrc.rules) {
    return { critical: [], preferred: [], contextual: [], deprecated: [] };
  }

  if (Array.isArray(agentrc.rules)) {
    // Legacy string array format - needs migration
    return { critical: [], preferred: [], contextual: [], deprecated: [] };
  }

  // Handle structured rules that may be missing required fields
  const rules = agentrc.rules as any;
  const result: AgentRcRules = {
    critical: [],
    preferred: [],
    contextual: [],
    deprecated: [],
  };

  // Process each category
  for (const [category, categoryRules] of Object.entries(rules)) {
    if (!Array.isArray(categoryRules)) continue;

    const processedRules = categoryRules.map((rule: any) => {
      // Create a normalized rule with all required fields
      const normalizedRule = {
        id: rule.id || generateRuleId(rule.text || "unknown"),
        text: rule.text || "",
        category: rule.category || category,
        filePath: rule.filePath,
        reason: rule.reason,
        createdAt: rule.createdAt || new Date().toISOString(),
        lastUsed: rule.lastUsed,
        usageCount: rule.usageCount || 0,
        analytics: rule.analytics || {
          timesApplied: 0,
          timesIgnored: 0,
          effectivenessScore: 0,
          userFeedback: [],
        },
        documentationLinks: rule.documentationLinks || [],
        tags: rule.tags || [],
      };

      // Use Zod parsing with defaults to ensure schema compliance
      try {
        return RuleSchema.parse(normalizedRule);
      } catch (error) {
        // If validation still fails, create a minimal valid rule
        return RuleSchema.parse({
          id: generateRuleId(rule.text || "unknown"),
          text: rule.text || "Unknown rule",
          category: category as any,
          createdAt: new Date().toISOString(),
          usageCount: 0,
        });
      }
    });

    if (category in result) {
      (result as any)[category] = processedRules;
    }
  }

  return result;
}

async function addRule(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.rule || !params.category) {
    throw new Error("Both 'rule' and 'category' are required for add action");
  }

  const rules = ensureStructuredRules(agentrc);
  const ruleId = generateRuleId(params.rule);

  // Check for duplicate rules
  const allRules = [
    ...rules.critical,
    ...rules.preferred,
    ...rules.contextual,
    ...rules.deprecated,
  ];
  const duplicate = allRules.find(
    (r) => r.text.toLowerCase() === params.rule.toLowerCase(),
  );
  if (duplicate) {
    return {
      title: "Duplicate Rule",
      metadata: { duplicate: duplicate.id },
      output: `Rule already exists with ID: ${duplicate.id} in category: ${duplicate.category}`,
    };
  }

  const newRule: Rule = {
    id: ruleId,
    text: params.rule,
    category: params.category,
    filePath: params.filePath,
    reason: params.reason,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    analytics: {
      timesApplied: 0,
      timesIgnored: 0,
      effectivenessScore: 0,
      userFeedback: [],
    },
    documentationLinks: params.filePath
      ? [
          {
            filePath: params.filePath,
            autoRead: false,
          },
        ]
      : [],
    tags: [],
  };

  rules[params.category as keyof AgentRcRules].push(newRule);

  // Update metadata
  const metadata: RuleMetadata = {
    version: "1.0.0",
    lastModified: new Date().toISOString(),
    totalRules: allRules.length + 1,
    sessionRules: agentrc.ruleMetadata?.sessionRules || [],
  };

  metadata.sessionRules.push({
    ruleId,
    learnedAt: new Date().toISOString(),
    context: params.reason,
  });

  agentrc.rules = rules;
  agentrc.ruleMetadata = metadata;

  await writeAgentRc(agentrcPath, agentrc, ctx);

  // Also store in SQLite database
  try {
    const storage = MemoryStorage.getInstance();
    storage.addRule({
      id: ruleId,
      text: params.rule,
      category: params.category,
      filePath: params.filePath,
      reason: params.reason,
      analytics: JSON.stringify(newRule.analytics),
      documentationLinks: JSON.stringify(newRule.documentationLinks),
      tags: JSON.stringify(newRule.tags),
    });
  } catch (error) {
    // SQLite storage is optional, don't fail if it's not available
    console.warn("Failed to store rule in SQLite:", error);
  }

  return {
    title: "Rule Added",
    metadata: { ruleId, category: params.category },
    output: `Added ${params.category} rule: "${params.rule}" (ID: ${ruleId})`,
  };
}

async function updateRule(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const targetId = params.ruleId || params.rule;
  if (!targetId || !params.newText) {
    throw new Error(
      "Both 'ruleId' and 'newText' are required for update action",
    );
  }

  const rules = ensureStructuredRules(agentrc);
  let foundRule: Rule | null = null;
  let foundCategory: string | null = null;

  // Find the rule across all categories
  for (const [category, categoryRules] of Object.entries(rules)) {
    const rule = categoryRules.find(
      (r) => r.id === targetId || r.text === targetId,
    );
    if (rule) {
      foundRule = rule;
      foundCategory = category;
      break;
    }
  }

  if (!foundRule || !foundCategory) {
    throw new Error(`Rule not found: ${targetId}`);
  }

  foundRule.text = params.newText;
  foundRule.lastUsed = new Date().toISOString();
  if (params.reason) foundRule.reason = params.reason;
  if (params.filePath) foundRule.filePath = params.filePath;

  // Update metadata
  if (agentrc.ruleMetadata) {
    agentrc.ruleMetadata.lastModified = new Date().toISOString();
  }

  await writeAgentRc(agentrcPath, agentrc, ctx);

  return {
    title: "Rule Updated",
    metadata: { ruleId: foundRule.id, category: foundCategory },
    output: `Updated rule ${foundRule.id}: "${params.newText}"`,
  };
}

async function removeRule(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const targetId = params.ruleId || params.rule;
  if (!targetId) {
    throw new Error("'ruleId' or 'rule' is required for remove action");
  }

  const rules = ensureStructuredRules(agentrc);
  let removed = false;
  let removedRule: Rule | null = null;
  let removedCategory: string | null = null;

  // Find and remove the rule
  for (const [category, categoryRules] of Object.entries(rules)) {
    const index = categoryRules.findIndex(
      (r) => r.id === targetId || r.text === targetId,
    );
    if (index !== -1) {
      removedRule = categoryRules[index];
      removedCategory = category;
      categoryRules.splice(index, 1);
      removed = true;
      break;
    }
  }

  if (!removed || !removedRule) {
    throw new Error(`Rule not found: ${targetId}`);
  }

  // Update metadata
  if (agentrc.ruleMetadata) {
    agentrc.ruleMetadata.lastModified = new Date().toISOString();
    agentrc.ruleMetadata.totalRules -= 1;
  }

  await writeAgentRc(agentrcPath, agentrc, ctx);

  return {
    title: "Rule Removed",
    metadata: { ruleId: removedRule.id, category: removedCategory },
    output: `Removed ${removedCategory} rule: "${removedRule.text}" (ID: ${removedRule.id})`,
  };
}

async function listRules(
  agentrc: AgentRc,
  params: any,
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc);
  const targetCategory = params.category;
  const compact = params.compact !== false; // Default to compact mode

  let output = "";
  let totalCount = 0;

  const categoriesToShow = targetCategory
    ? [targetCategory]
    : ["critical", "preferred", "contextual", "deprecated"];

  for (const category of categoriesToShow) {
    const categoryRules = rules[category as keyof AgentRcRules] || [];
    if (categoryRules.length === 0) continue;

    output += `\n## ${category.toUpperCase()} RULES (${categoryRules.length})\n`;

    for (const rule of categoryRules) {
      if (compact) {
        // Compact format: [category] rule-id: "text" (usage info)
        const usageInfo =
          rule.usageCount > 0 ? ` (${rule.usageCount} uses)` : "";
        const docInfo = rule.filePath ? " 📄" : "";
        output += `[${category}] ${rule.id}: "${rule.text}"${usageInfo}${docInfo}\n`;
      } else {
        // Verbose format (original)
        output += `\n**${rule.id}**\n`;
        output += `Text: ${rule.text}\n`;
        if (rule.filePath) output += `Documentation: ${rule.filePath}\n`;
        if (rule.reason) output += `Reason: ${rule.reason}\n`;
        output += `Created: ${rule.createdAt}\n`;
        if (rule.lastUsed) output += `Last used: ${rule.lastUsed}\n`;
        output += `Usage count: ${rule.usageCount}\n`;
      }
    }

    totalCount += categoryRules.length;
  }

  if (totalCount === 0) {
    output = targetCategory
      ? `No rules found in category: ${targetCategory}`
      : "No rules found in .agentrc";
  }

  return {
    title: targetCategory ? `${targetCategory} Rules` : "All Rules",
    metadata: {
      totalCount,
      category: targetCategory,
      compact,
      ruleMetadata: agentrc.ruleMetadata,
    },
    output: output.trim(),
  };
}

async function linkRule(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.rule || !params.filePath) {
    throw new Error("Both 'rule' and 'filePath' are required for link action");
  }

  // Check if file exists
  const app = App.info();
  const fullPath = path.isAbsolute(params.filePath)
    ? params.filePath
    : path.join(app.path.root, params.filePath);

  const file = Bun.file(fullPath);
  if (!(await file.exists())) {
    throw new Error(`Documentation file not found: ${params.filePath}`);
  }

  const rules = ensureStructuredRules(agentrc);

  // If rule exists, update it with file path
  let foundRule: Rule | null = null;
  for (const categoryRules of Object.values(rules)) {
    const rule = categoryRules.find(
      (r) => r.id === params.rule || r.text === params.rule,
    );
    if (rule) {
      foundRule = rule;
      break;
    }
  }

  if (foundRule) {
    foundRule.filePath = params.filePath;
    foundRule.lastUsed = new Date().toISOString();

    await writeAgentRc(agentrcPath, agentrc, ctx);

    return {
      title: "Rule Linked",
      metadata: { ruleId: foundRule.id, filePath: params.filePath },
      output: `Linked rule "${foundRule.text}" to documentation: ${params.filePath}`,
    };
  } else {
    // Create new contextual rule with file link
    const ruleId = generateRuleId(params.rule);
    const newRule: Rule = {
      id: ruleId,
      text: params.rule,
      category: "contextual",
      filePath: params.filePath,
      reason: "Linked to documentation",
      createdAt: new Date().toISOString(),
      usageCount: 0,
      analytics: {
        timesApplied: 0,
        timesIgnored: 0,
        effectivenessScore: 0,
        userFeedback: [],
      },
      documentationLinks: [
        {
          filePath: params.filePath,
          autoRead: false,
        },
      ],
      tags: [],
    };

    rules.contextual.push(newRule);
    agentrc.rules = rules;

    await writeAgentRc(agentrcPath, agentrc, ctx);

    return {
      title: "Rule Created and Linked",
      metadata: { ruleId, filePath: params.filePath },
      output: `Created contextual rule "${params.rule}" linked to: ${params.filePath}`,
    };
  }
}

async function migrateRules(
  agentrcPath: string,
  agentrc: AgentRc,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  let migrationCount = 0;
  let fixedCount = 0;

  // Handle legacy string array format
  if (Array.isArray(agentrc.rules)) {
    const oldRules = agentrc.rules as string[];
    const newRules: AgentRcRules = {
      critical: [],
      preferred: [],
      contextual: [],
      deprecated: [],
    };

    // Migrate old string rules to preferred category by default
    for (const ruleText of oldRules) {
      const ruleId = generateRuleId(ruleText);
      const rule: Rule = {
        id: ruleId,
        text: ruleText,
        category: "preferred",
        reason: "Migrated from legacy format",
        createdAt: new Date().toISOString(),
        usageCount: 0,
        analytics: {
          timesApplied: 0,
          timesIgnored: 0,
          effectivenessScore: 0,
          userFeedback: [],
        },
        documentationLinks: [],
        tags: [],
      };
      newRules.preferred.push(rule);
      migrationCount++;
    }

    agentrc.rules = newRules;
  }
  // Handle structured rules that may be missing required fields
  else if (agentrc.rules && typeof agentrc.rules === "object") {
    const rules = agentrc.rules as any;
    const fixedRules: AgentRcRules = {
      critical: [],
      preferred: [],
      contextual: [],
      deprecated: [],
    };

    // Fix each category
    for (const [category, categoryRules] of Object.entries(rules)) {
      if (!Array.isArray(categoryRules)) continue;

      const processedRules = categoryRules.map((rule: any) => {
        let needsFix = false;

        // Check if rule needs fixing
        if (
          !rule.createdAt ||
          !rule.category ||
          rule.usageCount === undefined ||
          !rule.analytics
        ) {
          needsFix = true;
        }

        if (needsFix) {
          fixedCount++;
          return RuleSchema.parse({
            id: rule.id || generateRuleId(rule.text || "unknown"),
            text: rule.text || "",
            category: rule.category || category,
            filePath: rule.filePath,
            reason: rule.reason,
            createdAt: rule.createdAt || new Date().toISOString(),
            lastUsed: rule.lastUsed,
            usageCount: rule.usageCount || 0,
            analytics: rule.analytics || {
              timesApplied: 0,
              timesIgnored: 0,
              effectivenessScore: 0,
              userFeedback: [],
            },
            documentationLinks: rule.documentationLinks || [],
            tags: rule.tags || [],
          });
        }

        return rule;
      });

      if (category in fixedRules) {
        (fixedRules as any)[category] = processedRules;
      }
    }

    agentrc.rules = fixedRules;
  }

  // Update metadata
  const metadata: RuleMetadata = {
    version: "2.0.0",
    lastModified: new Date().toISOString(),
    totalRules: migrationCount + fixedCount,
    sessionRules: agentrc.ruleMetadata?.sessionRules || [],
  };

  agentrc.ruleMetadata = metadata;

  if (migrationCount === 0 && fixedCount === 0) {
    return {
      title: "Migration Not Needed",
      metadata: {},
      output: "Rules are already in proper structured format",
    };
  }

  await writeAgentRc(agentrcPath, agentrc, ctx);

  let output = "";
  if (migrationCount > 0) {
    output += `Successfully migrated ${migrationCount} rules from legacy string format to structured format. `;
  }
  if (fixedCount > 0) {
    output += `Fixed ${fixedCount} rules by adding missing required fields. `;
  }
  output += "All rules now conform to the standard schema.";

  return {
    title: "Rules Migrated",
    metadata: { migratedCount: migrationCount, fixedCount },
    output: output.trim(),
  };
}

// Context Analysis and Rule Suggestion Functions
async function analyzeContext(ctx: Tool.Context): Promise<ContextAnalysis> {
  const app = App.info();

  // Extract context information from the current session
  const context: ContextAnalysis = {
    currentTool: undefined, // Tool name not available in current context
    fileTypes: [],
    errorPatterns: [],
    commandHistory: [],
    sessionContext: ctx.sessionID,
    workingDirectory: app.path.root,
    recentFiles: [],
  };

  // Try to detect file types in current directory
  try {
    const files = (await Bun.file(app.path.root).exists())
      ? (await import("fs")).readdirSync(app.path.root)
      : [];

    context.fileTypes = [
      ...new Set(
        files
          .filter((f) => f.includes("."))
          .map((f) => f.split(".").pop()!)
          .filter((ext) => ext.length <= 4),
      ),
    ];

    context.recentFiles = files.slice(0, 10);
  } catch (error) {
    // Ignore file system errors
  }

  return context;
}

async function suggestRules(
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc);
  const context = await analyzeContext(ctx);

  // Get all rules and rank by relevance
  const allRules = [...rules.critical, ...rules.preferred, ...rules.contextual];
  const suggestions = await rankRulesByRelevance(
    allRules,
    context,
    params.context,
  );

  if (suggestions.length === 0) {
    return {
      title: "No Suggestions",
      metadata: { context },
      output:
        "No relevant rules found for current context. Consider adding rules for this scenario.",
    };
  }

  let output = `## Suggested Rules for Current Context\n\n`;
  output += `**Context**: ${context.currentTool || "General"}\n`;
  output += `**File Types**: ${context.fileTypes.join(", ") || "None detected"}\n`;
  output += `**Working Directory**: ${context.workingDirectory}\n\n`;

  suggestions.slice(0, 5).forEach((rule, index) => {
    output += `### ${index + 1}. ${rule.category.toUpperCase()} - ${rule.id}\n`;
    output += `**Rule**: ${rule.text}\n`;
    if (rule.reason) output += `**Reason**: ${rule.reason}\n`;
    if (rule.analytics?.effectivenessScore) {
      output += `**Effectiveness**: ${Math.round(rule.analytics.effectivenessScore * 100)}%\n`;
    }
    output += `**Usage Count**: ${rule.usageCount}\n\n`;
  });

  return {
    title: "Rule Suggestions",
    metadata: {
      context,
      suggestionCount: suggestions.length,
      topSuggestions: suggestions.slice(0, 5).map((r) => r.id),
    },
    output: output.trim(),
  };
}

async function rankRulesByRelevance(
  rules: Rule[],
  context: ContextAnalysis,
  userContext?: string,
): Promise<Rule[]> {
  return rules
    .map((rule) => ({
      rule,
      score: calculateRelevanceScore(rule, context, userContext),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.rule);
}

function calculateRelevanceScore(
  rule: Rule,
  context: ContextAnalysis,
  userContext?: string,
): number {
  let score = 0;

  // Base score by category
  const categoryScores = {
    critical: 10,
    preferred: 7,
    contextual: 5,
    deprecated: 1,
  };
  score += categoryScores[rule.category];

  // Boost for recent usage
  if (rule.lastUsed) {
    const daysSinceUsed =
      (Date.now() - new Date(rule.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 5 - daysSinceUsed);
  }

  // Boost for effectiveness
  if (rule.analytics?.effectivenessScore) {
    score += rule.analytics.effectivenessScore * 5;
  }

  // Context matching
  if (userContext) {
    const ruleText = rule.text.toLowerCase();
    const contextWords = userContext.toLowerCase().split(/\s+/);
    const matches = contextWords.filter((word) =>
      ruleText.includes(word),
    ).length;
    score += matches * 2;
  }

  // File type relevance
  if (context.fileTypes.length > 0) {
    const ruleText = rule.text.toLowerCase();
    const fileTypeMatches = context.fileTypes.filter((type) =>
      ruleText.includes(type.toLowerCase()),
    ).length;
    score += fileTypeMatches * 3;
  }

  // Tool context relevance
  if (
    context.currentTool &&
    rule.text.toLowerCase().includes(context.currentTool.toLowerCase())
  ) {
    score += 5;
  }

  return score;
}

interface AnalyticsResult {
  totalRules: number;
  usedRules: number;
  recentlyUsed: number;
  categoryStats: Record<string, number>;
  topUsed: Array<{ id: string; text: string; usageCount: number }>;
  leastUsed: Array<{ id: string; text: string; createdAt: string }>;
}

async function showAnalytics(
  agentrc: AgentRc,
  params: { timeframe?: string; compact?: boolean },
): Promise<{ title: string; metadata: any; output: string }> {
  const timeframe = params.timeframe || "30d";
  const timeframeDays = getTimeframeDays(timeframe);

  // Try to get analytics from SQLite first, fall back to .agentrc
  let analytics: AnalyticsResult;
  try {
    const storage = MemoryStorage.getInstance();
    analytics = storage.getRuleAnalytics(timeframeDays);
  } catch (error) {
    // Fall back to .agentrc analytics
    const rules = ensureStructuredRules(agentrc);
    const allRules = [
      ...rules.critical,
      ...rules.preferred,
      ...rules.contextual,
      ...rules.deprecated,
    ];

    if (allRules.length === 0) {
      return {
        title: "No Analytics",
        metadata: {},
        output: "No rules found to analyze.",
      };
    }

    const cutoffDate = getTimeframeCutoff(timeframe);
    const totalRules = allRules.length;
    const usedRules = allRules.filter((r) => r.usageCount > 0).length;
    const recentlyUsed = allRules.filter(
      (r) => r.lastUsed && new Date(r.lastUsed) > cutoffDate,
    ).length;

    const categoryStats = {
      critical: rules.critical.length,
      preferred: rules.preferred.length,
      contextual: rules.contextual.length,
      deprecated: rules.deprecated.length,
    };

    const topUsed = allRules
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
      .map((rule) => ({
        id: rule.id,
        text: rule.text,
        usageCount: rule.usageCount,
      }));

    const leastUsed = allRules
      .filter((r) => r.usageCount === 0)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .slice(0, 5)
      .map((rule) => ({
        id: rule.id,
        text: rule.text,
        createdAt: rule.createdAt,
      }));

    analytics = {
      totalRules,
      usedRules,
      recentlyUsed,
      categoryStats,
      topUsed,
      leastUsed,
    };
  }

  const compact = params.compact !== false; // Default to compact mode

  let output = `## Rule Analytics (${timeframe})\n\n`;
  output += `**Total Rules**: ${analytics.totalRules}\n`;
  output += `**Used Rules**: ${analytics.usedRules} (${Math.round((analytics.usedRules / analytics.totalRules) * 100)}%)\n`;
  output += `**Recently Used**: ${analytics.recentlyUsed}\n\n`;

  if (compact) {
    // Compact category distribution
    output += `### Categories: `;
    const categoryEntries = Object.entries(analytics.categoryStats);
    output +=
      categoryEntries
        .map(([category, count]) => `${category}(${count})`)
        .join(", ") + "\n\n";

    // Compact top used rules
    if (analytics.topUsed.length > 0) {
      output += `### Top Used: `;
      output +=
        analytics.topUsed
          .slice(0, 3)
          .map(
            (rule: { id: string; usageCount: number }) =>
              `${rule.id}(${rule.usageCount})`,
          )
          .join(", ") + "\n";
    }
  } else {
    // Verbose format (original)
    output += `### Category Distribution\n`;
    Object.entries(analytics.categoryStats).forEach(([category, count]) => {
      const percentage = Math.round(
        ((count as number) / analytics.totalRules) * 100,
      );
      output += `- **${category}**: ${count} (${percentage}%)\n`;
    });

    if (analytics.topUsed.length > 0) {
      output += `\n### Most Used Rules\n`;
      analytics.topUsed.forEach(
        (
          rule: { id: string; text: string; usageCount: number },
          index: number,
        ) => {
          output += `${index + 1}. **${rule.id}** - ${rule.usageCount} uses\n`;
          output += `   "${rule.text}"\n`;
        },
      );
    }

    if (analytics.leastUsed.length > 0) {
      output += `\n### Unused Rules (Consider Review)\n`;
      analytics.leastUsed.forEach(
        (
          rule: { id: string; text: string; createdAt: string },
          index: number,
        ) => {
          const age = Math.round(
            (Date.now() - new Date(rule.createdAt).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          output += `${index + 1}. **${rule.id}** - Created ${age} days ago\n`;
          output += `   "${rule.text}"\n`;
        },
      );
    }
  }

  return {
    title: "Rule Analytics",
    metadata: {
      totalRules: analytics.totalRules,
      usedRules: analytics.usedRules,
      recentlyUsed: analytics.recentlyUsed,
      categoryStats: analytics.categoryStats,
      timeframe,
    },
    output: output.trim(),
  };
}

function getTimeframeCutoff(timeframe: string): Date {
  const now = new Date();
  const match = timeframe.match(/^(\d+)([dwmy])$/);

  if (!match) return new Date(0); // All time

  const [, amount, unit] = match;
  const num = parseInt(amount);

  switch (unit) {
    case "d":
      return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
    case "w":
      return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
    case "m":
      return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
    case "y":
      return new Date(now.getTime() - num * 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0);
  }
}

function getTimeframeDays(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([dwmy])$/);

  if (!match) return 365; // Default to 1 year

  const [, amount, unit] = match;
  const num = parseInt(amount);

  switch (unit) {
    case "d":
      return num;
    case "w":
      return num * 7;
    case "m":
      return num * 30;
    case "y":
      return num * 365;
    default:
      return 365;
  }
}

async function readDocumentation(
  agentrc: AgentRc,
  _params: any,
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc);
  const allRules = [
    ...rules.critical,
    ...rules.preferred,
    ...rules.contextual,
    ...rules.deprecated,
  ];

  // Find rules with documentation links
  const rulesWithDocs = allRules.filter(
    (r) =>
      r.filePath || (r.documentationLinks && r.documentationLinks.length > 0),
  );

  if (rulesWithDocs.length === 0) {
    return {
      title: "No Documentation",
      metadata: {},
      output: "No rules have linked documentation files.",
    };
  }

  let output = `## Rule Documentation\n\n`;
  let readCount = 0;

  for (const rule of rulesWithDocs.slice(0, 5)) {
    output += `### ${rule.id} - ${rule.category.toUpperCase()}\n`;
    output += `**Rule**: ${rule.text}\n\n`;

    // Read primary file path
    if (rule.filePath) {
      const content = await readDocumentationFile(rule.filePath);
      if (content) {
        output += `**Documentation (${rule.filePath}):**\n`;
        output += `\`\`\`\n${content.substring(0, 500)}${content.length > 500 ? "..." : ""}\n\`\`\`\n\n`;
        readCount++;
      }
    }

    // Read additional documentation links
    if (rule.documentationLinks) {
      for (const link of rule.documentationLinks.slice(0, 2)) {
        const content = await readDocumentationFile(link.filePath);
        if (content) {
          output += `**Additional Documentation (${link.filePath}):**\n`;
          output += `\`\`\`\n${content.substring(0, 300)}${content.length > 300 ? "..." : ""}\n\`\`\`\n\n`;
          readCount++;
        }
      }
    }
  }

  return {
    title: "Documentation Read",
    metadata: {
      rulesWithDocs: rulesWithDocs.length,
      filesRead: readCount,
    },
    output: output.trim(),
  };
}

async function readDocumentationFile(filePath: string): Promise<string | null> {
  try {
    const app = App.info();
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(app.path.root, filePath);
    const file = Bun.file(fullPath);

    if (await file.exists()) {
      return await file.text();
    }
  } catch (error) {
    // Ignore read errors
  }
  return null;
}

async function detectConflicts(
  agentrc: AgentRc,
  _params: any,
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc);
  const allRules = [
    ...rules.critical,
    ...rules.preferred,
    ...rules.contextual,
    ...rules.deprecated,
  ];

  if (allRules.length < 2) {
    return {
      title: "No Conflicts",
      metadata: {},
      output: "Need at least 2 rules to detect conflicts.",
    };
  }

  const conflicts = await findRuleConflicts(allRules);

  if (conflicts.length === 0) {
    return {
      title: "No Conflicts Detected",
      metadata: { totalRules: allRules.length },
      output: "No rule conflicts detected. All rules appear to be compatible.",
    };
  }

  let output = `## Rule Conflicts Detected\n\n`;
  output += `Found ${conflicts.length} potential conflicts:\n\n`;

  conflicts.forEach((conflict, index) => {
    output += `### ${index + 1}. ${conflict.type.toUpperCase()} (${conflict.severity} severity)\n`;
    output += `**Affected Rules**:\n`;
    conflict.rules.forEach((rule) => {
      output += `- **${rule.id}** (${rule.category}): "${rule.text}"\n`;
    });
    output += `**Issue**: ${conflict.suggestion}\n`;
    if (conflict.autoResolvable) {
      output += `**Status**: Auto-resolvable\n`;
    }
    output += `\n`;
  });

  return {
    title: "Rule Conflicts",
    metadata: {
      conflictCount: conflicts.length,
      severityBreakdown: conflicts.reduce(
        (acc, c) => {
          acc[c.severity] = (acc[c.severity] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
    output: output.trim(),
  };
}

async function findRuleConflicts(rules: Rule[]): Promise<RuleConflict[]> {
  const conflicts: RuleConflict[] = [];

  // Check for contradictions and overlaps
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const rule1 = rules[i];
      const rule2 = rules[j];

      // Check for direct contradictions
      if (areRulesContradictory(rule1, rule2)) {
        conflicts.push({
          type: "contradiction",
          rules: [rule1, rule2],
          severity: "high",
          suggestion: `These rules contradict each other and may cause confusion.`,
          autoResolvable: false,
        });
      }

      // Check for significant overlap
      else if (areRulesOverlapping(rule1, rule2)) {
        conflicts.push({
          type: "overlap",
          rules: [rule1, rule2],
          severity: "medium",
          suggestion: `These rules cover similar ground and could be consolidated.`,
          autoResolvable: true,
        });
      }
    }
  }

  // Check for redundant rules (exact duplicates)
  const textMap = new Map<string, Rule[]>();
  rules.forEach((rule) => {
    const normalizedText = rule.text.toLowerCase().trim();
    if (!textMap.has(normalizedText)) {
      textMap.set(normalizedText, []);
    }
    textMap.get(normalizedText)!.push(rule);
  });

  textMap.forEach((duplicates) => {
    if (duplicates.length > 1) {
      conflicts.push({
        type: "redundancy",
        rules: duplicates,
        severity: "low",
        suggestion: `These rules have identical text and should be merged.`,
        autoResolvable: true,
      });
    }
  });

  return conflicts;
}

function areRulesContradictory(rule1: Rule, rule2: Rule): boolean {
  const text1 = rule1.text.toLowerCase();
  const text2 = rule2.text.toLowerCase();

  // Simple contradiction detection patterns
  const contradictionPatterns = [
    ["always", "never"],
    ["must", "must not"],
    ["should", "should not"],
    ["do", "don't"],
    ["use", "avoid"],
    ["prefer", "avoid"],
  ];

  for (const [positive, negative] of contradictionPatterns) {
    if (
      (text1.includes(positive) && text2.includes(negative)) ||
      (text1.includes(negative) && text2.includes(positive))
    ) {
      // Check if they're talking about the same thing
      const words1 = text1.split(/\s+/).filter((w) => w.length > 3);
      const words2 = text2.split(/\s+/).filter((w) => w.length > 3);
      const commonWords = words1.filter((w) => words2.includes(w));

      if (commonWords.length >= 2) {
        return true;
      }
    }
  }

  return false;
}

function areRulesOverlapping(rule1: Rule, rule2: Rule): boolean {
  const text1 = rule1.text.toLowerCase();
  const text2 = rule2.text.toLowerCase();

  // Calculate word overlap
  const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 3));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  const overlapRatio = intersection.size / union.size;

  // Consider rules overlapping if they share > 60% of significant words
  return overlapRatio > 0.6 && intersection.size >= 3;
}

async function recordFeedback(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.ruleId || !params.rating) {
    throw new Error(
      "Both 'ruleId' and 'rating' are required for feedback action",
    );
  }

  const rules = ensureStructuredRules(agentrc);
  let foundRule: Rule | null = null;

  // Find the rule across all categories
  for (const categoryRules of Object.values(rules)) {
    const rule = categoryRules.find((r) => r.id === params.ruleId);
    if (rule) {
      foundRule = rule;
      break;
    }
  }

  if (!foundRule) {
    throw new Error(`Rule not found: ${params.ruleId}`);
  }

  // Initialize analytics if not present
  if (!foundRule.analytics) {
    foundRule.analytics = {
      timesApplied: 0,
      timesIgnored: 0,
      effectivenessScore: 0,
      userFeedback: [],
    };
  }

  // Add feedback
  foundRule.analytics.userFeedback.push({
    rating: params.rating,
    comment: params.comment,
    timestamp: new Date().toISOString(),
  });

  // Update effectiveness score based on all feedback
  const allRatings = foundRule.analytics.userFeedback.map((f) => f.rating);
  foundRule.analytics.effectivenessScore =
    allRatings.reduce((a, b) => a + b, 0) / allRatings.length / 5;

  // Update usage tracking
  foundRule.lastUsed = new Date().toISOString();
  foundRule.usageCount += 1;

  await writeAgentRc(agentrcPath, agentrc, ctx);

  return {
    title: "Feedback Recorded",
    metadata: {
      ruleId: params.ruleId,
      rating: params.rating,
      newEffectivenessScore: foundRule.analytics.effectivenessScore,
    },
    output: `Recorded ${params.rating}-star rating for rule "${foundRule.text}". ${params.comment ? `Comment: "${params.comment}"` : ""} New effectiveness score: ${Math.round(foundRule.analytics.effectivenessScore * 100)}%`,
  };
}

// New SQLite-powered functions
async function searchRules(
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.context) {
    throw new Error("'context' parameter is required for search action");
  }

  const storage = MemoryStorage.getInstance();
  const results = storage.searchRules(params.context);

  if (results.length === 0) {
    return {
      title: "No Search Results",
      metadata: { query: params.context },
      output: `No rules found matching: "${params.context}"`,
    };
  }

  let output = `## Search Results for "${params.context}"\n\n`;
  output += `Found ${results.length} matching rules:\n\n`;

  results.slice(0, 10).forEach((record, index) => {
    const analytics = safeJsonParseWithFallback<AnalyticsData>(
      record.analytics || "{}",
      {},
      "rule analytics",
    );
    output += `### ${index + 1}. ${record.category.toUpperCase()} - ${record.id}\n`;
    output += `**Rule**: ${record.text}\n`;
    if (record.reason) output += `**Reason**: ${record.reason}\n`;
    output += `**Usage Count**: ${record.usageCount}\n`;
    if (analytics.effectivenessScore) {
      output += `**Effectiveness**: ${Math.round(analytics.effectivenessScore * 100)}%\n`;
    }
    output += `**Created**: ${new Date(record.createdAt).toLocaleDateString()}\n\n`;
  });

  // Record search context for future suggestions
  storage.updateSessionContext({
    sessionId: ctx.sessionID,
    workingDirectory: App.info().path.root,
    fileTypes: "[]",
    recentFiles: "[]",
    lastActivity: new Date().toISOString(),
    contextData: JSON.stringify({ lastSearch: params.context }),
  });

  return {
    title: "Search Results",
    metadata: {
      query: params.context,
      resultCount: results.length,
      topResults: results.slice(0, 5).map((r) => r.id),
    },
    output: output.trim(),
  };
}

async function getUsageHistory(
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const storage = MemoryStorage.getInstance();

  if (params.ruleId) {
    // Get usage history for specific rule
    const history = storage.getRuleUsageHistory(params.ruleId, 20);
    const rule = storage.getRule(params.ruleId);

    if (!rule) {
      throw new Error(`Rule not found: ${params.ruleId}`);
    }

    let output = `## Usage History for Rule: ${rule.id}\n\n`;
    output += `**Rule**: ${rule.text}\n`;
    output += `**Category**: ${rule.category}\n`;
    output += `**Total Usage**: ${rule.usageCount}\n\n`;

    if (history.length === 0) {
      output += "No usage history found.";
    } else {
      output += `### Recent Usage (${history.length} entries)\n\n`;
      history.forEach((usage, index) => {
        output += `${index + 1}. **${new Date(usage.timestamp).toLocaleString()}**\n`;
        output += `   Session: ${usage.sessionId}\n`;
        if (usage.context) output += `   Context: ${usage.context}\n`;
        if (usage.effectiveness)
          output += `   Effectiveness: ${Math.round(usage.effectiveness * 100)}%\n`;
        output += `\n`;
      });
    }

    return {
      title: "Rule Usage History",
      metadata: { ruleId: params.ruleId, historyCount: history.length },
      output: output.trim(),
    };
  } else {
    // Get usage history for current session
    const history = storage.getSessionUsageHistory(ctx.sessionID, 20);

    let output = `## Session Usage History\n\n`;
    output += `**Session**: ${ctx.sessionID}\n`;
    output += `**Recent Activity**: ${history.length} rule applications\n\n`;

    if (history.length === 0) {
      output += "No rules have been used in this session yet.";
    } else {
      history.forEach((usage, index) => {
        output += `${index + 1}. **${new Date(usage.timestamp).toLocaleString()}**\n`;
        output += `   Rule: ${usage.ruleId}\n`;
        if ((usage as any).ruleText)
          output += `   Text: ${(usage as any).ruleText}\n`;
        if ((usage as any).category)
          output += `   Category: ${(usage as any).category}\n`;
        if (usage.context) output += `   Context: ${usage.context}\n`;
        output += `\n`;
      });
    }

    return {
      title: "Session Usage History",
      metadata: { sessionId: ctx.sessionID, historyCount: history.length },
      output: output.trim(),
    };
  }
}

interface SessionContextParams {
  context?: string;
}

async function manageSessionContext(
  params: SessionContextParams,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const storage = MemoryStorage.getInstance();

  // Update current session context
  const context = await analyzeContext(ctx);
  storage.updateSessionContext({
    sessionId: ctx.sessionID,
    workingDirectory: context.workingDirectory,
    fileTypes: JSON.stringify(context.fileTypes),
    recentFiles: JSON.stringify(context.recentFiles),
    lastActivity: new Date().toISOString(),
    contextData: JSON.stringify({
      errorPatterns: context.errorPatterns,
      commandHistory: context.commandHistory,
      currentTool: context.currentTool,
    }),
  });

  if (params.context === "list") {
    // List recent sessions
    const recentSessions = storage.getRecentSessions(10);

    let output = `## Recent Sessions\n\n`;
    output += `Found ${recentSessions.length} recent sessions:\n\n`;

    recentSessions.forEach((session, index) => {
      const fileTypes = safeJsonParseWithFallback(
        session.fileTypes || "[]",
        [],
        "session file types",
      );
      const contextData = safeJsonParseWithFallback<ContextData>(
        session.contextData || "{}",
        {},
        "session context data",
      );

      output += `### ${index + 1}. Session ${session.sessionId.substring(0, 8)}...\n`;
      output += `**Directory**: ${session.workingDirectory}\n`;
      output += `**Last Activity**: ${new Date(session.lastActivity).toLocaleString()}\n`;
      if (fileTypes.length > 0)
        output += `**File Types**: ${fileTypes.join(", ")}\n`;
      if (contextData.currentTool)
        output += `**Last Tool**: ${contextData.currentTool}\n`;
      output += `\n`;
    });

    return {
      title: "Session Contexts",
      metadata: { sessionCount: recentSessions.length },
      output: output.trim(),
    };
  } else {
    // Show current session context
    const currentSession = storage.getSessionContext(ctx.sessionID);

    let output = `## Current Session Context\n\n`;
    output += `**Session ID**: ${ctx.sessionID}\n`;
    output += `**Working Directory**: ${context.workingDirectory}\n`;
    output += `**File Types**: ${context.fileTypes.join(", ") || "None detected"}\n`;
    output += `**Recent Files**: ${context.recentFiles.slice(0, 5).join(", ") || "None"}\n`;

    if (currentSession) {
      const contextData = safeJsonParseWithFallback<ContextData>(
        currentSession.contextData || "{}",
        {},
        "current session context data",
      );
      output += `**Last Activity**: ${new Date(currentSession.lastActivity).toLocaleString()}\n`;
      if (contextData.currentTool)
        output += `**Current Tool**: ${contextData.currentTool}\n`;
      if (contextData.errorPatterns?.length > 0) {
        output += `**Error Patterns**: ${contextData.errorPatterns.join(", ")}\n`;
      }
    }

    return {
      title: "Current Session Context",
      metadata: { sessionId: ctx.sessionID, context },
      output: output.trim(),
    };
  }
}

interface CleanupParams {
  timeframe?: string;
}

async function cleanupData(
  params: CleanupParams,
): Promise<{ title: string; metadata: any; output: string }> {
  const storage = MemoryStorage.getInstance();

  const usageCleanupDays =
    parseInt(params.timeframe?.replace("d", "") || "90") || 90;
  const sessionCleanupDays =
    parseInt(params.timeframe?.replace("d", "") || "30") || 30;

  const usageDeleted = storage.cleanupOldUsageData(usageCleanupDays);
  const sessionsDeleted = storage.cleanupOldSessions(sessionCleanupDays);

  // Vacuum database to reclaim space
  storage.vacuum();

  let output = `## Database Cleanup Complete\n\n`;
  output += `**Usage Data Cleaned**: ${usageDeleted} old entries (older than ${usageCleanupDays} days)\n`;
  output += `**Sessions Cleaned**: ${sessionsDeleted} old sessions (older than ${sessionCleanupDays} days)\n`;
  output += `**Database Optimized**: VACUUM completed\n`;

  return {
    title: "Database Cleanup",
    metadata: {
      usageDeleted,
      sessionsDeleted,
      usageCleanupDays,
      sessionCleanupDays,
    },
    output: output.trim(),
  };
}

async function exportDatabase(
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const storage = MemoryStorage.getInstance();
  const app = App.info();

  // Get all data from database
  const rules = storage.getRulesByCategory();
  const analytics = storage.getRuleAnalytics(365); // Full year
  const recentSessions = storage.getRecentSessions(100);

  const exportData = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    rules: rules.map((rule) => ({
      ...rule,
      analytics: safeJsonParseWithFallback(
        rule.analytics || "{}",
        {},
        "rule analytics",
      ),
      documentationLinks: safeJsonParseWithFallback(
        rule.documentationLinks || "[]",
        [],
        "rule documentation links",
      ),
      tags: safeJsonParseWithFallback(rule.tags || "[]", [], "rule tags"),
    })),
    analytics,
    sessions: recentSessions.map((session) => ({
      ...session,
      fileTypes: safeJsonParseWithFallback(
        session.fileTypes || "[]",
        [],
        "session file types",
      ),
      recentFiles: safeJsonParseWithFallback(
        session.recentFiles || "[]",
        [],
        "session recent files",
      ),
      contextData: safeJsonParseWithFallback(
        session.contextData || "{}",
        {},
        "session context data",
      ),
    })),
  };

  const exportPath = path.join(
    app.path.root,
    ".kuuzuki",
    `memory-export-${Date.now()}.json`,
  );
  await Bun.write(exportPath, JSON.stringify(exportData, null, 2));

  let output = `## Database Export Complete\n\n`;
  output += `**Export File**: ${exportPath}\n`;
  output += `**Rules Exported**: ${exportData.rules.length}\n`;
  output += `**Sessions Exported**: ${exportData.sessions.length}\n`;
  const fileSize = await Bun.file(exportPath).size;
  output += `**Export Size**: ${Math.round(fileSize / 1024)} KB\n`;

  return {
    title: "Database Export",
    metadata: {
      exportPath,
      rulesCount: exportData.rules.length,
      sessionsCount: exportData.sessions.length,
    },
    output: output.trim(),
  };
}

interface ImportParams {
  filePath?: string;
}

async function importDatabase(
  params: ImportParams,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.filePath) {
    throw new Error("'filePath' parameter is required for import-db action");
  }

  const app = App.info();
  const importPath = path.isAbsolute(params.filePath)
    ? params.filePath
    : path.join(app.path.root, params.filePath);

  const file = Bun.file(importPath);
  if (!(await file.exists())) {
    throw new Error(`Import file not found: ${params.filePath}`);
  }

  const importData = safeJsonParse<ImportData>(
    await file.text(),
    "import file",
  );
  const storage = MemoryStorage.getInstance();

  let importedRules = 0;
  let skippedRules = 0;

  // Import rules
  for (const rule of importData.rules || []) {
    try {
      storage.addRule({
        id: rule.id,
        text: rule.text,
        category: rule.category,
        filePath: rule.filePath,
        reason: rule.reason,
        lastUsed: rule.lastUsed,
        analytics: JSON.stringify(rule.analytics || {}),
        documentationLinks: JSON.stringify(rule.documentationLinks || []),
        tags: JSON.stringify(rule.tags || []),
      });
      importedRules++;
    } catch (error) {
      // Skip duplicates or invalid rules
      skippedRules++;
    }
  }

  // Import sessions
  let importedSessions = 0;
  for (const session of importData.sessions || []) {
    try {
      storage.updateSessionContext({
        sessionId: session.sessionId,
        workingDirectory: session.workingDirectory,
        fileTypes: JSON.stringify(session.fileTypes || []),
        recentFiles: JSON.stringify(session.recentFiles || []),
        lastActivity: session.lastActivity,
        contextData: JSON.stringify(session.contextData || {}),
      });
      importedSessions++;
    } catch (error) {
      // Skip invalid sessions
    }
  }

  let output = `## Database Import Complete\n\n`;
  output += `**Import File**: ${params.filePath}\n`;
  output += `**Rules Imported**: ${importedRules}\n`;
  output += `**Rules Skipped**: ${skippedRules} (duplicates or invalid)\n`;
  output += `**Sessions Imported**: ${importedSessions}\n`;

  return {
    title: "Database Import",
    metadata: {
      importPath: params.filePath,
      importedRules,
      skippedRules,
      importedSessions,
    },
    output: output.trim(),
  };
}
