import { Tool } from "./tool.js"
import { z } from "zod"
import { MemoryStorage } from "./memory-storage.js"

const ContextAwareRuleActivatorInput = z.object({
  action: z.enum([
    "analyze_context",
    "prioritize_rules", 
    "get_active_rules",
    "update_context",
    "get_context_history"
  ]),
  context: z.object({
    currentFiles: z.array(z.string()).optional(),
    recentCommands: z.array(z.string()).optional(),
    activeTools: z.array(z.string()).optional(),
    projectType: z.string().optional(),
    taskType: z.enum(["coding", "debugging", "testing", "documentation", "refactoring"]).optional(),
    errorMessages: z.array(z.string()).optional(),
    timeOfDay: z.string().optional()
  }).optional(),
  ruleIds: z.array(z.string()).optional(),
  maxRules: z.number().min(1).max(50).default(10).optional(),
  minConfidence: z.number().min(0).max(1).default(0.5).optional(),
  includeReasons: z.boolean().default(true).optional()
})

interface ContextAnalysis {
  projectType: string
  taskType: string
  complexity: number
  urgency: number
  riskLevel: number
  patterns: string[]
  keywords: string[]
}

interface RulePriority {
  ruleId: string
  priority: number
  confidence: number
  reasons: string[]
  contextMatch: number
}

interface ContextHistory {
  timestamp: string
  context: any
  activatedRules: string[]
  effectiveness: number
}

export const ContextAwareRuleActivator = Tool.define("context_aware_rule_activator", {
  description: "Dynamically prioritizes and activates rules based on current development context, task type, and historical effectiveness",
  parameters: ContextAwareRuleActivatorInput,
  async execute(input, ctx) {
    const storage = MemoryStorage.getInstance()
    
    let result: any
    
    switch (input.action) {
      case "analyze_context":
        result = await analyzeContext(input.context || {}, storage)
        break
        
      case "prioritize_rules":
        result = await prioritizeRules(input.context || {}, input.maxRules || 10, input.minConfidence || 0.5, storage)
        break
        
      case "get_active_rules":
        result = await getActiveRules(input.context || {}, input.includeReasons || true, storage)
        break
        
      case "update_context":
        result = await updateContext(input.context || {}, storage)
        break
        
      case "get_context_history":
        result = await getContextHistory(storage)
        break
        
      default:
        throw new Error(`Unknown action: ${input.action}`)
    }

    return {
      title: `Context Aware Rule Activator - ${input.action}`,
      metadata: { action: input.action, result },
      output: JSON.stringify(result, null, 2)
    }
  }
})

async function analyzeContext(context: any, storage: MemoryStorage): Promise<ContextAnalysis> {
  const analysis: ContextAnalysis = {
    projectType: "unknown",
    taskType: "coding",
    complexity: 0.5,
    urgency: 0.5,
    riskLevel: 0.3,
    patterns: [],
    keywords: []
  }

  // Analyze file types to determine project type
  if (context.currentFiles) {
    const fileExtensions = context.currentFiles
      .map((file: string) => file.split('.').pop()?.toLowerCase())
      .filter(Boolean)
    
    const extensionCounts = fileExtensions.reduce((acc: any, ext: string) => {
      acc[ext] = (acc[ext] || 0) + 1
      return acc
    }, {})

    // Determine project type based on file extensions
    if (extensionCounts.ts || extensionCounts.js) {
      analysis.projectType = extensionCounts.tsx || extensionCounts.jsx ? "react" : "typescript"
    } else if (extensionCounts.py) {
      analysis.projectType = "python"
    } else if (extensionCounts.go) {
      analysis.projectType = "go"
    } else if (extensionCounts.rs) {
      analysis.projectType = "rust"
    }

    // Extract patterns from file names
    analysis.patterns = context.currentFiles
      .map((file: string) => {
        const basename = file.split('/').pop() || ''
        if (basename.includes('test')) return 'testing'
        if (basename.includes('spec')) return 'testing'
        if (basename.includes('config')) return 'configuration'
        if (basename.includes('util')) return 'utilities'
        if (basename.includes('component')) return 'components'
        return null
      })
      .filter(Boolean)
  }

  // Analyze recent commands for task type (prioritize explicit context)
  if (context.taskType) {
    analysis.taskType = context.taskType
  } else if (context.recentCommands) {
    const commands = context.recentCommands.join(' ').toLowerCase()
    
    if (commands.includes('test') || commands.includes('jest') || commands.includes('vitest')) {
      analysis.taskType = "testing"
      analysis.complexity += 0.2
    } else if (commands.includes('debug') || commands.includes('console.log')) {
      analysis.taskType = "debugging"
      analysis.urgency += 0.3
    } else if (commands.includes('doc') || commands.includes('readme')) {
      analysis.taskType = "documentation"
      analysis.complexity -= 0.1
    } else if (commands.includes('refactor') || commands.includes('rename')) {
      analysis.taskType = "refactoring"
      analysis.riskLevel += 0.2
    }

    // Extract keywords from commands
    analysis.keywords = commands
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10)
  } else {
    analysis.keywords = []
  }

  // Analyze error messages for urgency and risk
  if (context.errorMessages && context.errorMessages.length > 0) {
    analysis.urgency += 0.4
    analysis.riskLevel += 0.3
    
    const errorText = context.errorMessages.join(' ').toLowerCase()
    if (errorText.includes('security') || errorText.includes('vulnerability')) {
      analysis.riskLevel += 0.3
    }
    if (errorText.includes('critical') || errorText.includes('fatal')) {
      analysis.urgency += 0.3
    }
  }

  // Normalize values
  analysis.complexity = Math.min(1, Math.max(0, analysis.complexity))
  analysis.urgency = Math.min(1, Math.max(0, analysis.urgency))
  analysis.riskLevel = Math.min(1, Math.max(0, analysis.riskLevel))

  return analysis
}

async function prioritizeRules(
  context: any, 
  maxRules: number, 
  minConfidence: number, 
  storage: MemoryStorage
): Promise<RulePriority[]> {
  const analysis = await analyzeContext(context, storage)
  
  // Get all rules from memory
  const rules = await storage.getAllRules()
  const priorities: RulePriority[] = []

  for (const rule of rules) {
    const priority = calculateRulePriority(rule, analysis, context)
    
    if (priority.confidence >= minConfidence) {
      priorities.push(priority)
    }
  }

  // Sort by priority (descending) and return top rules
  return priorities
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxRules)
}

function calculateRulePriority(rule: any, analysis: ContextAnalysis, context: any): RulePriority {
  let priority = 0
  let confidence = 0
  const reasons: string[] = []
  let contextMatch = 0

  // Base priority from rule category
  const categoryWeights = {
    critical: 1.0,
    preferred: 0.7,
    contextual: 0.8,
    deprecated: 0.1
  }
  
  const categoryWeight = categoryWeights[rule.category as keyof typeof categoryWeights] || 0.5
  priority += categoryWeight * 0.4
  confidence += 0.3

  // Project type matching
  if (rule.text.toLowerCase().includes(analysis.projectType.toLowerCase())) {
    priority += 0.3
    contextMatch += 0.3
    reasons.push(`Matches project type: ${analysis.projectType}`)
  }

  // Task type matching
  if (rule.text.toLowerCase().includes(analysis.taskType)) {
    priority += 0.2
    contextMatch += 0.2
    reasons.push(`Relevant for ${analysis.taskType} tasks`)
  }

  // Pattern matching
  for (const pattern of analysis.patterns) {
    if (rule.text.toLowerCase().includes(pattern)) {
      priority += 0.15
      contextMatch += 0.1
      reasons.push(`Matches pattern: ${pattern}`)
    }
  }

  // Keyword matching
  for (const keyword of analysis.keywords) {
    if (rule.text.toLowerCase().includes(keyword)) {
      priority += 0.1
      contextMatch += 0.05
      reasons.push(`Contains keyword: ${keyword}`)
    }
  }

  // Urgency and risk adjustments
  if (rule.category === 'critical' && analysis.urgency > 0.7) {
    priority += 0.2
    reasons.push("Critical rule with high urgency context")
  }

  if (rule.text.toLowerCase().includes('security') && analysis.riskLevel > 0.6) {
    priority += 0.25
    reasons.push("Security rule with high risk context")
  }

  // Historical effectiveness (if available)
  if (rule.analytics?.effectivenessScore) {
    const effectiveness = rule.analytics.effectivenessScore / 5 // Normalize to 0-1
    priority += effectiveness * 0.2
    confidence += effectiveness * 0.3
    reasons.push(`Historical effectiveness: ${rule.analytics.effectivenessScore}/5`)
  }

  // Usage frequency boost
  if (rule.usageCount && rule.usageCount > 5) {
    priority += Math.min(0.1, rule.usageCount / 100)
    reasons.push(`Frequently used rule (${rule.usageCount} times)`)
  }

  // File context matching
  if (context.currentFiles) {
    for (const file of context.currentFiles) {
      if (rule.documentationLinks?.some((link: string) => file.includes(link))) {
        priority += 0.15
        contextMatch += 0.15
        reasons.push(`Linked to current file: ${file}`)
      }
    }
  }

  // Complexity adjustments
  if (analysis.complexity > 0.7 && rule.category === 'critical') {
    priority += 0.1
    reasons.push("Critical rule for complex context")
  }

  // Calculate final confidence based on context match and reasons
  confidence += contextMatch * 0.4
  confidence += Math.min(0.3, reasons.length * 0.05)
  confidence = Math.min(1, Math.max(0, confidence))

  return {
    ruleId: rule.id,
    priority: Math.min(1, Math.max(0, priority)),
    confidence,
    reasons,
    contextMatch
  }
}

async function getActiveRules(
  context: any, 
  includeReasons: boolean, 
  storage: MemoryStorage
): Promise<any> {
  const priorities = await prioritizeRules(context, 10, 0.5, storage)
  const rules = await storage.getAllRules()
  
  const activeRules = priorities.map(priority => {
    const rule = rules.find(r => r.id === priority.ruleId)
    return {
      ...rule,
      priority: priority.priority,
      confidence: priority.confidence,
      contextMatch: priority.contextMatch,
      ...(includeReasons && { activationReasons: priority.reasons })
    }
  })

  return {
    totalRules: activeRules.length,
    averageConfidence: priorities.reduce((sum, p) => sum + p.confidence, 0) / priorities.length,
    context: await analyzeContext(context, storage),
    activeRules
  }
}

async function updateContext(context: any, storage: MemoryStorage): Promise<any> {
  const timestamp = new Date().toISOString()
  const analysis = await analyzeContext(context, storage)
  const activatedRules = await prioritizeRules(context, 5, 0.6, storage)
  
  // Store context history in database using public method
  storage.storeContextHistory(
    timestamp,
    context,
    activatedRules.map(r => r.ruleId),
    analysis
  )

  return {
    timestamp,
    contextUpdated: true,
    analysis,
    activatedRulesCount: activatedRules.length
  }
}

async function getContextHistory(storage: MemoryStorage): Promise<ContextHistory[]> {
  return storage.getContextHistory(20)
}