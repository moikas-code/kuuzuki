import { z } from "zod"
import * as path from "path"
import { Tool } from "./tool"
import { App } from "../app/app"
import { Permission } from "../permission"

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
})

const DocumentationLinkSchema = z.object({
  filePath: z.string(),
  section: z.string().optional(),
  lastRead: z.string().optional(),
  contentHash: z.string().optional(),
  autoRead: z.boolean().default(false),
})

const RuleSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: z.enum(["critical", "preferred", "contextual", "deprecated"]),
  filePath: z.string().optional(),
  reason: z.string().optional(),
  createdAt: z.string(),
  lastUsed: z.string().optional(),
  usageCount: z.number().default(0),
  analytics: RuleAnalyticsSchema.optional(),
  documentationLinks: z.array(DocumentationLinkSchema).default([]),
  tags: z.array(z.string()).default([]),
})

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
})

const AgentRcRulesSchema = z.object({
  critical: z.array(RuleSchema).default([]),
  preferred: z.array(RuleSchema).default([]),
  contextual: z.array(RuleSchema).default([]),
  deprecated: z.array(RuleSchema).default([]),
})

type Rule = z.infer<typeof RuleSchema>
type RuleMetadata = z.infer<typeof RuleMetadataSchema>
type AgentRcRules = z.infer<typeof AgentRcRulesSchema>

// Context analysis interfaces
interface ContextAnalysis {
  currentTool?: string
  fileTypes: string[]
  errorPatterns: string[]
  commandHistory: string[]
  sessionContext: string
  workingDirectory: string
  recentFiles: string[]
}

interface RuleConflict {
  type: "contradiction" | "overlap" | "redundancy"
  rules: Rule[]
  severity: "low" | "medium" | "high"
  suggestion: string
  autoResolvable: boolean
}

interface AgentRc {
  rules?: string[] | AgentRcRules
  ruleMetadata?: RuleMetadata
  [key: string]: any
}

export const MemoryTool = Tool.define("memory", {
  description: `Manage .agentrc rules and project memory. This tool allows you to add, update, remove, and organize rules that guide AI agent behavior.

Actions:
- add: Add a new rule to the specified category
- update: Update an existing rule by ID
- remove: Remove a rule by ID
- list: List all rules or rules in a specific category
- link: Link a rule to a documentation file for detailed guidance
- migrate: Migrate old string-based rules to new structured format
- suggest: Get contextually relevant rules for current situation
- analytics: Show usage statistics and effectiveness metrics
- read-docs: Auto-read documentation linked to rules
- conflicts: Detect and display rule conflicts
- feedback: Record user feedback on rule effectiveness

Categories:
- critical: Must-follow rules that prevent errors or ensure quality
- preferred: Best practices and style preferences
- contextual: Rules that reference documentation files for complex patterns
- deprecated: Rules that are no longer relevant but kept for reference`,

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
    ]),
    rule: z.string().optional().describe("Rule text for add/update, or rule ID for update/remove"),
    ruleId: z.string().optional().describe("Specific rule ID for update/remove operations"),
    category: z.enum(["critical", "preferred", "contextual", "deprecated"]).optional(),
    filePath: z.string().optional().describe("Path to documentation file for contextual rules"),
    reason: z.string().optional().describe("Explanation for why this rule is being added/changed"),
    newText: z.string().optional().describe("New text for update operations"),
    context: z.string().optional().describe("Context for rule suggestions or analysis"),
    rating: z.number().min(1).max(5).optional().describe("User rating for rule effectiveness (1-5)"),
    comment: z.string().optional().describe("User feedback comment"),
    timeframe: z.string().optional().describe("Timeframe for analytics (e.g., '7d', '30d', 'all')"),
  }),

  async execute(params, ctx) {
    const app = App.info()
    const agentrcPath = path.join(app.path.root, ".agentrc")

    try {
      // Read current .agentrc
      const agentrc = await readAgentRc(agentrcPath)

      switch (params.action) {
        case "add":
          return await addRule(agentrcPath, agentrc, params, ctx)
        case "update":
          return await updateRule(agentrcPath, agentrc, params, ctx)
        case "remove":
          return await removeRule(agentrcPath, agentrc, params, ctx)
        case "list":
          return await listRules(agentrc, params)
        case "link":
          return await linkRule(agentrcPath, agentrc, params, ctx)
        case "migrate":
          return await migrateRules(agentrcPath, agentrc, ctx)
        case "suggest":
          return await suggestRules(agentrc, params, ctx)
        case "analytics":
          return await showAnalytics(agentrc, params)
        case "read-docs":
          return await readDocumentation(agentrc, params)
        case "conflicts":
          return await detectConflicts(agentrc, params)
        case "feedback":
          return await recordFeedback(agentrcPath, agentrc, params, ctx)
        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        title: "Memory Tool Error",
        metadata: { error: errorMessage },
        output: `Error: ${errorMessage}`,
      }
    }
  },
})

async function readAgentRc(agentrcPath: string): Promise<AgentRc> {
  const file = Bun.file(agentrcPath)
  if (!(await file.exists())) {
    throw new Error(".agentrc file not found. Please create one first.")
  }

  const content = await file.text()
  return JSON.parse(content)
}

async function writeAgentRc(agentrcPath: string, agentrc: AgentRc, sessionID: string): Promise<void> {
  await Permission.ask({
    id: "memory-write",
    sessionID,
    title: "Update .agentrc rules",
    metadata: { filePath: agentrcPath },
  })

  await Bun.write(agentrcPath, JSON.stringify(agentrc, null, 2))
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
  )
}

function ensureStructuredRules(agentrc: AgentRc): AgentRcRules {
  if (!agentrc.rules) {
    return { critical: [], preferred: [], contextual: [], deprecated: [] }
  }

  if (Array.isArray(agentrc.rules)) {
    // Legacy string array format - needs migration
    return { critical: [], preferred: [], contextual: [], deprecated: [] }
  }

  return AgentRcRulesSchema.parse(agentrc.rules)
}

async function addRule(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.rule || !params.category) {
    throw new Error("Both 'rule' and 'category' are required for add action")
  }

  const rules = ensureStructuredRules(agentrc)
  const ruleId = generateRuleId(params.rule)

  // Check for duplicate rules
  const allRules = [...rules.critical, ...rules.preferred, ...rules.contextual, ...rules.deprecated]
  const duplicate = allRules.find((r) => r.text.toLowerCase() === params.rule.toLowerCase())
  if (duplicate) {
    return {
      title: "Duplicate Rule",
      metadata: { duplicate: duplicate.id },
      output: `Rule already exists with ID: ${duplicate.id} in category: ${duplicate.category}`,
    }
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
  }

  rules[params.category as keyof AgentRcRules].push(newRule)

  // Update metadata
  const metadata: RuleMetadata = {
    version: "1.0.0",
    lastModified: new Date().toISOString(),
    totalRules: allRules.length + 1,
    sessionRules: agentrc.ruleMetadata?.sessionRules || [],
  }

  metadata.sessionRules.push({
    ruleId,
    learnedAt: new Date().toISOString(),
    context: params.reason,
  })

  agentrc.rules = rules
  agentrc.ruleMetadata = metadata

  await writeAgentRc(agentrcPath, agentrc, ctx.sessionID)

  return {
    title: "Rule Added",
    metadata: { ruleId, category: params.category },
    output: `Added ${params.category} rule: "${params.rule}" (ID: ${ruleId})`,
  }
}

async function updateRule(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const targetId = params.ruleId || params.rule
  if (!targetId || !params.newText) {
    throw new Error("Both 'ruleId' and 'newText' are required for update action")
  }

  const rules = ensureStructuredRules(agentrc)
  let foundRule: Rule | null = null
  let foundCategory: string | null = null

  // Find the rule across all categories
  for (const [category, categoryRules] of Object.entries(rules)) {
    const rule = categoryRules.find((r) => r.id === targetId || r.text === targetId)
    if (rule) {
      foundRule = rule
      foundCategory = category
      break
    }
  }

  if (!foundRule || !foundCategory) {
    throw new Error(`Rule not found: ${targetId}`)
  }

  foundRule.text = params.newText
  foundRule.lastUsed = new Date().toISOString()
  if (params.reason) foundRule.reason = params.reason
  if (params.filePath) foundRule.filePath = params.filePath

  // Update metadata
  if (agentrc.ruleMetadata) {
    agentrc.ruleMetadata.lastModified = new Date().toISOString()
  }

  await writeAgentRc(agentrcPath, agentrc, ctx.sessionID)

  return {
    title: "Rule Updated",
    metadata: { ruleId: foundRule.id, category: foundCategory },
    output: `Updated rule ${foundRule.id}: "${params.newText}"`,
  }
}

async function removeRule(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const targetId = params.ruleId || params.rule
  if (!targetId) {
    throw new Error("'ruleId' or 'rule' is required for remove action")
  }

  const rules = ensureStructuredRules(agentrc)
  let removed = false
  let removedRule: Rule | null = null
  let removedCategory: string | null = null

  // Find and remove the rule
  for (const [category, categoryRules] of Object.entries(rules)) {
    const index = categoryRules.findIndex((r) => r.id === targetId || r.text === targetId)
    if (index !== -1) {
      removedRule = categoryRules[index]
      removedCategory = category
      categoryRules.splice(index, 1)
      removed = true
      break
    }
  }

  if (!removed || !removedRule) {
    throw new Error(`Rule not found: ${targetId}`)
  }

  // Update metadata
  if (agentrc.ruleMetadata) {
    agentrc.ruleMetadata.lastModified = new Date().toISOString()
    agentrc.ruleMetadata.totalRules -= 1
  }

  await writeAgentRc(agentrcPath, agentrc, ctx.sessionID)

  return {
    title: "Rule Removed",
    metadata: { ruleId: removedRule.id, category: removedCategory },
    output: `Removed ${removedCategory} rule: "${removedRule.text}" (ID: ${removedRule.id})`,
  }
}

async function listRules(agentrc: AgentRc, params: any): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc)
  const targetCategory = params.category

  let output = ""
  let totalCount = 0

  const categoriesToShow = targetCategory ? [targetCategory] : ["critical", "preferred", "contextual", "deprecated"]

  for (const category of categoriesToShow) {
    const categoryRules = rules[category as keyof AgentRcRules] || []
    if (categoryRules.length === 0) continue

    output += `\n## ${category.toUpperCase()} RULES (${categoryRules.length})\n`

    for (const rule of categoryRules) {
      output += `\n**${rule.id}**\n`
      output += `Text: ${rule.text}\n`
      if (rule.filePath) output += `Documentation: ${rule.filePath}\n`
      if (rule.reason) output += `Reason: ${rule.reason}\n`
      output += `Created: ${rule.createdAt}\n`
      if (rule.lastUsed) output += `Last used: ${rule.lastUsed}\n`
      output += `Usage count: ${rule.usageCount}\n`
    }

    totalCount += categoryRules.length
  }

  if (totalCount === 0) {
    output = targetCategory ? `No rules found in category: ${targetCategory}` : "No rules found in .agentrc"
  }

  return {
    title: targetCategory ? `${targetCategory} Rules` : "All Rules",
    metadata: {
      totalCount,
      category: targetCategory,
      ruleMetadata: agentrc.ruleMetadata,
    },
    output: output.trim(),
  }
}

async function linkRule(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.rule || !params.filePath) {
    throw new Error("Both 'rule' and 'filePath' are required for link action")
  }

  // Check if file exists
  const app = App.info()
  const fullPath = path.isAbsolute(params.filePath) ? params.filePath : path.join(app.path.root, params.filePath)

  const file = Bun.file(fullPath)
  if (!(await file.exists())) {
    throw new Error(`Documentation file not found: ${params.filePath}`)
  }

  const rules = ensureStructuredRules(agentrc)

  // If rule exists, update it with file path
  let foundRule: Rule | null = null
  for (const categoryRules of Object.values(rules)) {
    const rule = categoryRules.find((r) => r.id === params.rule || r.text === params.rule)
    if (rule) {
      foundRule = rule
      break
    }
  }

  if (foundRule) {
    foundRule.filePath = params.filePath
    foundRule.lastUsed = new Date().toISOString()

    await writeAgentRc(agentrcPath, agentrc, ctx.sessionID)

    return {
      title: "Rule Linked",
      metadata: { ruleId: foundRule.id, filePath: params.filePath },
      output: `Linked rule "${foundRule.text}" to documentation: ${params.filePath}`,
    }
  } else {
    // Create new contextual rule with file link
    const ruleId = generateRuleId(params.rule)
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
    }

    rules.contextual.push(newRule)
    agentrc.rules = rules

    await writeAgentRc(agentrcPath, agentrc, ctx.sessionID)

    return {
      title: "Rule Created and Linked",
      metadata: { ruleId, filePath: params.filePath },
      output: `Created contextual rule "${params.rule}" linked to: ${params.filePath}`,
    }
  }
}

async function migrateRules(
  agentrcPath: string,
  agentrc: AgentRc,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!Array.isArray(agentrc.rules)) {
    return {
      title: "Migration Not Needed",
      metadata: {},
      output: "Rules are already in structured format",
    }
  }

  const oldRules = agentrc.rules as string[]
  const newRules: AgentRcRules = {
    critical: [],
    preferred: [],
    contextual: [],
    deprecated: [],
  }

  // Migrate old string rules to preferred category by default
  for (const ruleText of oldRules) {
    const ruleId = generateRuleId(ruleText)
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
    }
    newRules.preferred.push(rule)
  }

  const metadata: RuleMetadata = {
    version: "1.0.0",
    lastModified: new Date().toISOString(),
    totalRules: oldRules.length,
    sessionRules: [],
  }

  agentrc.rules = newRules
  agentrc.ruleMetadata = metadata

  await writeAgentRc(agentrcPath, agentrc, ctx.sessionID)

  return {
    title: "Rules Migrated",
    metadata: { migratedCount: oldRules.length },
    output: `Successfully migrated ${oldRules.length} rules from legacy string format to structured format. All rules were placed in 'preferred' category.`,
  }
}

// Context Analysis and Rule Suggestion Functions
async function analyzeContext(ctx: Tool.Context): Promise<ContextAnalysis> {
  const app = App.info()

  // Extract context information from the current session
  const context: ContextAnalysis = {
    currentTool: undefined, // Tool name not available in current context
    fileTypes: [],
    errorPatterns: [],
    commandHistory: [],
    sessionContext: ctx.sessionID,
    workingDirectory: app.path.root,
    recentFiles: [],
  }

  // Try to detect file types in current directory
  try {
    const files = (await Bun.file(app.path.root).exists()) ? (await import("fs")).readdirSync(app.path.root) : []

    context.fileTypes = [
      ...new Set(
        files
          .filter((f) => f.includes("."))
          .map((f) => f.split(".").pop()!)
          .filter((ext) => ext.length <= 4),
      ),
    ]

    context.recentFiles = files.slice(0, 10)
  } catch (error) {
    // Ignore file system errors
  }

  return context
}

async function suggestRules(
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc)
  const context = await analyzeContext(ctx)

  // Get all rules and rank by relevance
  const allRules = [...rules.critical, ...rules.preferred, ...rules.contextual]
  const suggestions = await rankRulesByRelevance(allRules, context, params.context)

  if (suggestions.length === 0) {
    return {
      title: "No Suggestions",
      metadata: { context },
      output: "No relevant rules found for current context. Consider adding rules for this scenario.",
    }
  }

  let output = `## Suggested Rules for Current Context\n\n`
  output += `**Context**: ${context.currentTool || "General"}\n`
  output += `**File Types**: ${context.fileTypes.join(", ") || "None detected"}\n`
  output += `**Working Directory**: ${context.workingDirectory}\n\n`

  suggestions.slice(0, 5).forEach((rule, index) => {
    output += `### ${index + 1}. ${rule.category.toUpperCase()} - ${rule.id}\n`
    output += `**Rule**: ${rule.text}\n`
    if (rule.reason) output += `**Reason**: ${rule.reason}\n`
    if (rule.analytics?.effectivenessScore) {
      output += `**Effectiveness**: ${Math.round(rule.analytics.effectivenessScore * 100)}%\n`
    }
    output += `**Usage Count**: ${rule.usageCount}\n\n`
  })

  return {
    title: "Rule Suggestions",
    metadata: {
      context,
      suggestionCount: suggestions.length,
      topSuggestions: suggestions.slice(0, 5).map((r) => r.id),
    },
    output: output.trim(),
  }
}

async function rankRulesByRelevance(rules: Rule[], context: ContextAnalysis, userContext?: string): Promise<Rule[]> {
  return rules
    .map((rule) => ({
      rule,
      score: calculateRelevanceScore(rule, context, userContext),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.rule)
}

function calculateRelevanceScore(rule: Rule, context: ContextAnalysis, userContext?: string): number {
  let score = 0

  // Base score by category
  const categoryScores = { critical: 10, preferred: 7, contextual: 5, deprecated: 1 }
  score += categoryScores[rule.category]

  // Boost for recent usage
  if (rule.lastUsed) {
    const daysSinceUsed = (Date.now() - new Date(rule.lastUsed).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 5 - daysSinceUsed)
  }

  // Boost for effectiveness
  if (rule.analytics?.effectivenessScore) {
    score += rule.analytics.effectivenessScore * 5
  }

  // Context matching
  if (userContext) {
    const ruleText = rule.text.toLowerCase()
    const contextWords = userContext.toLowerCase().split(/\s+/)
    const matches = contextWords.filter((word) => ruleText.includes(word)).length
    score += matches * 2
  }

  // File type relevance
  if (context.fileTypes.length > 0) {
    const ruleText = rule.text.toLowerCase()
    const fileTypeMatches = context.fileTypes.filter((type) => ruleText.includes(type.toLowerCase())).length
    score += fileTypeMatches * 3
  }

  // Tool context relevance
  if (context.currentTool && rule.text.toLowerCase().includes(context.currentTool.toLowerCase())) {
    score += 5
  }

  return score
}

async function showAnalytics(agentrc: AgentRc, params: any): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc)
  const allRules = [...rules.critical, ...rules.preferred, ...rules.contextual, ...rules.deprecated]

  if (allRules.length === 0) {
    return {
      title: "No Analytics",
      metadata: {},
      output: "No rules found to analyze.",
    }
  }

  const timeframe = params.timeframe || "30d"
  const cutoffDate = getTimeframeCutoff(timeframe)

  // Calculate analytics
  const totalRules = allRules.length
  const usedRules = allRules.filter((r) => r.usageCount > 0).length
  const recentlyUsed = allRules.filter((r) => r.lastUsed && new Date(r.lastUsed) > cutoffDate).length

  const categoryStats = {
    critical: rules.critical.length,
    preferred: rules.preferred.length,
    contextual: rules.contextual.length,
    deprecated: rules.deprecated.length,
  }

  const topUsed = allRules.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5)

  const leastUsed = allRules
    .filter((r) => r.usageCount === 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 5)

  let output = `## Rule Analytics (${timeframe})\n\n`
  output += `**Total Rules**: ${totalRules}\n`
  output += `**Used Rules**: ${usedRules} (${Math.round((usedRules / totalRules) * 100)}%)\n`
  output += `**Recently Used**: ${recentlyUsed}\n\n`

  output += `### Category Distribution\n`
  Object.entries(categoryStats).forEach(([category, count]) => {
    const percentage = Math.round((count / totalRules) * 100)
    output += `- **${category}**: ${count} (${percentage}%)\n`
  })

  if (topUsed.length > 0) {
    output += `\n### Most Used Rules\n`
    topUsed.forEach((rule, index) => {
      output += `${index + 1}. **${rule.id}** - ${rule.usageCount} uses\n`
      output += `   "${rule.text}"\n`
    })
  }

  if (leastUsed.length > 0) {
    output += `\n### Unused Rules (Consider Review)\n`
    leastUsed.forEach((rule, index) => {
      const age = Math.round((Date.now() - new Date(rule.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      output += `${index + 1}. **${rule.id}** - Created ${age} days ago\n`
      output += `   "${rule.text}"\n`
    })
  }

  return {
    title: "Rule Analytics",
    metadata: {
      totalRules,
      usedRules,
      recentlyUsed,
      categoryStats,
      timeframe,
    },
    output: output.trim(),
  }
}

function getTimeframeCutoff(timeframe: string): Date {
  const now = new Date()
  const match = timeframe.match(/^(\d+)([dwmy])$/)

  if (!match) return new Date(0) // All time

  const [, amount, unit] = match
  const num = parseInt(amount)

  switch (unit) {
    case "d":
      return new Date(now.getTime() - num * 24 * 60 * 60 * 1000)
    case "w":
      return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000)
    case "m":
      return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000)
    case "y":
      return new Date(now.getTime() - num * 365 * 24 * 60 * 60 * 1000)
    default:
      return new Date(0)
  }
}

async function readDocumentation(
  agentrc: AgentRc,
  _params: any,
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc)
  const allRules = [...rules.critical, ...rules.preferred, ...rules.contextual, ...rules.deprecated]

  // Find rules with documentation links
  const rulesWithDocs = allRules.filter((r) => r.filePath || (r.documentationLinks && r.documentationLinks.length > 0))

  if (rulesWithDocs.length === 0) {
    return {
      title: "No Documentation",
      metadata: {},
      output: "No rules have linked documentation files.",
    }
  }

  let output = `## Rule Documentation\n\n`
  let readCount = 0

  for (const rule of rulesWithDocs.slice(0, 5)) {
    output += `### ${rule.id} - ${rule.category.toUpperCase()}\n`
    output += `**Rule**: ${rule.text}\n\n`

    // Read primary file path
    if (rule.filePath) {
      const content = await readDocumentationFile(rule.filePath)
      if (content) {
        output += `**Documentation (${rule.filePath}):**\n`
        output += `\`\`\`\n${content.substring(0, 500)}${content.length > 500 ? "..." : ""}\n\`\`\`\n\n`
        readCount++
      }
    }

    // Read additional documentation links
    if (rule.documentationLinks) {
      for (const link of rule.documentationLinks.slice(0, 2)) {
        const content = await readDocumentationFile(link.filePath)
        if (content) {
          output += `**Additional Documentation (${link.filePath}):**\n`
          output += `\`\`\`\n${content.substring(0, 300)}${content.length > 300 ? "..." : ""}\n\`\`\`\n\n`
          readCount++
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
  }
}

async function readDocumentationFile(filePath: string): Promise<string | null> {
  try {
    const app = App.info()
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(app.path.root, filePath)
    const file = Bun.file(fullPath)

    if (await file.exists()) {
      return await file.text()
    }
  } catch (error) {
    // Ignore read errors
  }
  return null
}

async function detectConflicts(
  agentrc: AgentRc,
  _params: any,
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = ensureStructuredRules(agentrc)
  const allRules = [...rules.critical, ...rules.preferred, ...rules.contextual, ...rules.deprecated]

  if (allRules.length < 2) {
    return {
      title: "No Conflicts",
      metadata: {},
      output: "Need at least 2 rules to detect conflicts.",
    }
  }

  const conflicts = await findRuleConflicts(allRules)

  if (conflicts.length === 0) {
    return {
      title: "No Conflicts Detected",
      metadata: { totalRules: allRules.length },
      output: "No rule conflicts detected. All rules appear to be compatible.",
    }
  }

  let output = `## Rule Conflicts Detected\n\n`
  output += `Found ${conflicts.length} potential conflicts:\n\n`

  conflicts.forEach((conflict, index) => {
    output += `### ${index + 1}. ${conflict.type.toUpperCase()} (${conflict.severity} severity)\n`
    output += `**Affected Rules**:\n`
    conflict.rules.forEach((rule) => {
      output += `- **${rule.id}** (${rule.category}): "${rule.text}"\n`
    })
    output += `**Issue**: ${conflict.suggestion}\n`
    if (conflict.autoResolvable) {
      output += `**Status**: Auto-resolvable\n`
    }
    output += `\n`
  })

  return {
    title: "Rule Conflicts",
    metadata: {
      conflictCount: conflicts.length,
      severityBreakdown: conflicts.reduce(
        (acc, c) => {
          acc[c.severity] = (acc[c.severity] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
    },
    output: output.trim(),
  }
}

async function findRuleConflicts(rules: Rule[]): Promise<RuleConflict[]> {
  const conflicts: RuleConflict[] = []

  // Check for contradictions and overlaps
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const rule1 = rules[i]
      const rule2 = rules[j]

      // Check for direct contradictions
      if (areRulesContradictory(rule1, rule2)) {
        conflicts.push({
          type: "contradiction",
          rules: [rule1, rule2],
          severity: "high",
          suggestion: `These rules contradict each other and may cause confusion.`,
          autoResolvable: false,
        })
      }

      // Check for significant overlap
      else if (areRulesOverlapping(rule1, rule2)) {
        conflicts.push({
          type: "overlap",
          rules: [rule1, rule2],
          severity: "medium",
          suggestion: `These rules cover similar ground and could be consolidated.`,
          autoResolvable: true,
        })
      }
    }
  }

  // Check for redundant rules (exact duplicates)
  const textMap = new Map<string, Rule[]>()
  rules.forEach((rule) => {
    const normalizedText = rule.text.toLowerCase().trim()
    if (!textMap.has(normalizedText)) {
      textMap.set(normalizedText, [])
    }
    textMap.get(normalizedText)!.push(rule)
  })

  textMap.forEach((duplicates) => {
    if (duplicates.length > 1) {
      conflicts.push({
        type: "redundancy",
        rules: duplicates,
        severity: "low",
        suggestion: `These rules have identical text and should be merged.`,
        autoResolvable: true,
      })
    }
  })

  return conflicts
}

function areRulesContradictory(rule1: Rule, rule2: Rule): boolean {
  const text1 = rule1.text.toLowerCase()
  const text2 = rule2.text.toLowerCase()

  // Simple contradiction detection patterns
  const contradictionPatterns = [
    ["always", "never"],
    ["must", "must not"],
    ["should", "should not"],
    ["do", "don't"],
    ["use", "avoid"],
    ["prefer", "avoid"],
  ]

  for (const [positive, negative] of contradictionPatterns) {
    if (
      (text1.includes(positive) && text2.includes(negative)) ||
      (text1.includes(negative) && text2.includes(positive))
    ) {
      // Check if they're talking about the same thing
      const words1 = text1.split(/\s+/).filter((w) => w.length > 3)
      const words2 = text2.split(/\s+/).filter((w) => w.length > 3)
      const commonWords = words1.filter((w) => words2.includes(w))

      if (commonWords.length >= 2) {
        return true
      }
    }
  }

  return false
}

function areRulesOverlapping(rule1: Rule, rule2: Rule): boolean {
  const text1 = rule1.text.toLowerCase()
  const text2 = rule2.text.toLowerCase()

  // Calculate word overlap
  const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 3))
  const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 3))

  const intersection = new Set([...words1].filter((w) => words2.has(w)))
  const union = new Set([...words1, ...words2])

  const overlapRatio = intersection.size / union.size

  // Consider rules overlapping if they share > 60% of significant words
  return overlapRatio > 0.6 && intersection.size >= 3
}

async function recordFeedback(
  agentrcPath: string,
  agentrc: AgentRc,
  params: any,
  ctx: Tool.Context,
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.ruleId || !params.rating) {
    throw new Error("Both 'ruleId' and 'rating' are required for feedback action")
  }

  const rules = ensureStructuredRules(agentrc)
  let foundRule: Rule | null = null

  // Find the rule across all categories
  for (const categoryRules of Object.values(rules)) {
    const rule = categoryRules.find((r) => r.id === params.ruleId)
    if (rule) {
      foundRule = rule
      break
    }
  }

  if (!foundRule) {
    throw new Error(`Rule not found: ${params.ruleId}`)
  }

  // Initialize analytics if not present
  if (!foundRule.analytics) {
    foundRule.analytics = {
      timesApplied: 0,
      timesIgnored: 0,
      effectivenessScore: 0,
      userFeedback: [],
    }
  }

  // Add feedback
  foundRule.analytics.userFeedback.push({
    rating: params.rating,
    comment: params.comment,
    timestamp: new Date().toISOString(),
  })

  // Update effectiveness score based on all feedback
  const allRatings = foundRule.analytics.userFeedback.map((f) => f.rating)
  foundRule.analytics.effectivenessScore = allRatings.reduce((a, b) => a + b, 0) / allRatings.length / 5

  // Update usage tracking
  foundRule.lastUsed = new Date().toISOString()
  foundRule.usageCount += 1

  await writeAgentRc(agentrcPath, agentrc, ctx.sessionID)

  return {
    title: "Feedback Recorded",
    metadata: {
      ruleId: params.ruleId,
      rating: params.rating,
      newEffectivenessScore: foundRule.analytics.effectivenessScore,
    },
    output: `Recorded ${params.rating}-star rating for rule "${foundRule.text}". ${params.comment ? `Comment: "${params.comment}"` : ""} New effectiveness score: ${Math.round(foundRule.analytics.effectivenessScore * 100)}%`,
  }
}
