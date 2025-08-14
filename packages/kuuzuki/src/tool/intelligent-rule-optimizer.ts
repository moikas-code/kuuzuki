import { Tool } from "./tool";
import { z } from "zod";
import { MemoryStorage } from "./memory-storage";
import { safeJsonParseWithFallback } from "../util/json-utils";
import DESCRIPTION from "./intelligent-rule-optimizer.txt";

// Schema definitions for optimization tool
const OptimizationAnalysisSchema = z.object({
  ruleId: z.string(),
  currentEffectiveness: z.number().min(0).max(1),
  usageFrequency: z.number().min(0),
  conflictScore: z.number().min(0).max(1),
  redundancyScore: z.number().min(0).max(1),
  improvementPotential: z.number().min(0).max(1),
  recommendations: z.array(z.string()),
});

const OptimizationSuggestionSchema = z.object({
  id: z.string(),
  type: z.enum(["consolidate", "split", "deprecate", "enhance", "categorize"]),
  targetRuleIds: z.array(z.string()),
  suggestion: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  impact: z.enum(["low", "medium", "high"]),
  autoApplicable: z.boolean(),
  estimatedImprovement: z.number().min(0).max(1),
});

const ConflictResolutionSchema = z.object({
  conflictId: z.string(),
  type: z.enum(["contradiction", "overlap", "redundancy", "category_mismatch"]),
  affectedRules: z.array(z.string()),
  severity: z.enum(["low", "medium", "high", "critical"]),
  resolution: z.string(),
  confidence: z.number().min(0).max(1),
  autoResolvable: z.boolean(),
});

const CategoryOptimizationSchema = z.object({
  ruleId: z.string(),
  currentCategory: z.enum(["critical", "preferred", "contextual", "deprecated"]),
  suggestedCategory: z.enum(["critical", "preferred", "contextual", "deprecated"]),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  usagePatterns: z.array(z.string()),
});

type OptimizationAnalysis = z.infer<typeof OptimizationAnalysisSchema>;
type OptimizationSuggestion = z.infer<typeof OptimizationSuggestionSchema>;
type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;
type CategoryOptimization = z.infer<typeof CategoryOptimizationSchema>;

export const IntelligentRuleOptimizerTool = Tool.define("intelligent-rule-optimizer", {
  description: DESCRIPTION,

  parameters: z.object({
    action: z.enum([
      "analyze_performance",
      "optimize_rules", 
      "resolve_conflicts",
      "suggest_categories",
      "batch_optimize",
      "apply_optimizations",
      "get_optimization_report"
    ]),
    ruleIds: z.array(z.string()).optional().describe("Specific rule IDs to analyze"),
    categories: z.array(z.enum(["critical", "preferred", "contextual", "deprecated"])).optional().describe("Rule categories to focus on"),
    minConfidence: z.number().min(0).max(1).default(0.7).describe("Minimum confidence threshold for suggestions"),
    maxSuggestions: z.number().min(1).max(50).default(20).describe("Maximum number of optimization suggestions"),
    includeReasons: z.boolean().default(true).describe("Include detailed reasoning in output"),
    autoApply: z.boolean().default(false).describe("Automatically apply high-confidence optimizations"),
    timeframeDays: z.number().min(1).max(365).default(30).describe("Timeframe for performance analysis"),
    optimizationTypes: z.array(z.enum(["consolidate", "split", "deprecate", "enhance", "categorize"])).optional().describe("Types of optimizations to consider"),
  }),

  async execute(params, ctx) {
    const storage = MemoryStorage.getInstance();

    try {
      switch (params.action) {
        case "analyze_performance":
          return await analyzeRulePerformance(storage, params);
        case "optimize_rules":
          return await optimizeRules(storage, params);
        case "resolve_conflicts":
          return await resolveConflicts(storage, params);
        case "suggest_categories":
          return await suggestCategories(storage, params);
        case "batch_optimize":
          return await batchOptimize(storage, params);
        case "apply_optimizations":
          return await applyOptimizations(storage, params, ctx);
        case "get_optimization_report":
          return await getOptimizationReport(storage, params);
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        title: "Intelligent Rule Optimizer Error",
        metadata: { error: errorMessage },
        output: `Error: ${errorMessage}`,
      };
    }
  },
});

async function analyzeRulePerformance(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = params.ruleIds 
    ? params.ruleIds.map((id: string) => storage.getRule(id)).filter(Boolean)
    : storage.getRulesByCategory();

  if (rules.length === 0) {
    return {
      title: "No Rules to Analyze",
      metadata: {},
      output: "No rules found for performance analysis.",
    };
  }

  const analyses: OptimizationAnalysis[] = [];
  const cutoffDate = new Date(Date.now() - params.timeframeDays * 24 * 60 * 60 * 1000);

  for (const rule of rules) {
    const analytics = safeJsonParseWithFallback(rule.analytics || "{}", {}, "rule analytics");
    const usageHistory = storage.getRuleUsageHistory(rule.id, 100);
    const recentUsage = usageHistory.filter(usage => new Date(usage.timestamp) > cutoffDate);

    // Calculate effectiveness metrics
    const currentEffectiveness = (analytics as any).effectivenessScore || 0;
    const usageFrequency = recentUsage.length;
    const conflictScore = await calculateConflictScore(rule, storage);
    const redundancyScore = await calculateRedundancyScore(rule, storage);
    const improvementPotential = calculateImprovementPotential(rule, analytics, usageHistory);

    const recommendations = generatePerformanceRecommendations(
      rule,
      currentEffectiveness,
      usageFrequency,
      conflictScore,
      redundancyScore,
      improvementPotential
    );

    analyses.push({
      ruleId: rule.id,
      currentEffectiveness,
      usageFrequency,
      conflictScore,
      redundancyScore,
      improvementPotential,
      recommendations,
    });
  }

  // Sort by improvement potential
  analyses.sort((a, b) => b.improvementPotential - a.improvementPotential);

  let output = `## Rule Performance Analysis\n\n`;
  output += `**Analysis Period**: ${params.timeframeDays} days\n`;
  output += `**Rules Analyzed**: ${analyses.length}\n`;
  output += `**Average Effectiveness**: ${Math.round(analyses.reduce((sum, a) => sum + a.currentEffectiveness, 0) / analyses.length * 100)}%\n\n`;

  // Show top improvement opportunities
  const topOpportunities = analyses.filter(a => a.improvementPotential > 0.3).slice(0, 10);
  if (topOpportunities.length > 0) {
    output += `### Top Improvement Opportunities\n\n`;
    topOpportunities.forEach((analysis, index) => {
      const rule = rules.find(r => r.id === analysis.ruleId);
      output += `#### ${index + 1}. ${rule?.text || analysis.ruleId}\n`;
      output += `- **Current Effectiveness**: ${Math.round(analysis.currentEffectiveness * 100)}%\n`;
      output += `- **Usage Frequency**: ${analysis.usageFrequency} times\n`;
      output += `- **Improvement Potential**: ${Math.round(analysis.improvementPotential * 100)}%\n`;
      if (params.includeReasons && analysis.recommendations.length > 0) {
        output += `- **Recommendations**: ${analysis.recommendations.join(", ")}\n`;
      }
      output += `\n`;
    });
  }

  // Performance summary
  const lowPerformers = analyses.filter(a => a.currentEffectiveness < 0.3).length;
  const highConflict = analyses.filter(a => a.conflictScore > 0.5).length;
  const highRedundancy = analyses.filter(a => a.redundancyScore > 0.5).length;

  output += `### Performance Summary\n`;
  output += `- **Low Performers**: ${lowPerformers} rules (< 30% effectiveness)\n`;
  output += `- **High Conflict**: ${highConflict} rules (potential conflicts)\n`;
  output += `- **High Redundancy**: ${highRedundancy} rules (potential duplicates)\n`;

  return {
    title: "Rule Performance Analysis",
    metadata: {
      rulesAnalyzed: analyses.length,
      averageEffectiveness: analyses.reduce((sum, a) => sum + a.currentEffectiveness, 0) / analyses.length,
      improvementOpportunities: topOpportunities.length,
      lowPerformers,
      highConflict,
      highRedundancy,
    },
    output: output.trim(),
  };
}

async function optimizeRules(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = params.ruleIds 
    ? params.ruleIds.map((id: string) => storage.getRule(id)).filter(Boolean)
    : storage.getRulesByCategory();

  const suggestions: OptimizationSuggestion[] = [];
  const optimizationTypes = params.optimizationTypes || ["consolidate", "split", "deprecate", "enhance", "categorize"];

  // Generate consolidation suggestions
  if (optimizationTypes.includes("consolidate")) {
    const consolidationSuggestions = await generateConsolidationSuggestions(rules, storage);
    suggestions.push(...consolidationSuggestions);
  }

  // Generate split suggestions
  if (optimizationTypes.includes("split")) {
    const splitSuggestions = await generateSplitSuggestions(rules, storage);
    suggestions.push(...splitSuggestions);
  }

  // Generate deprecation suggestions
  if (optimizationTypes.includes("deprecate")) {
    const deprecationSuggestions = await generateDeprecationSuggestions(rules, storage);
    suggestions.push(...deprecationSuggestions);
  }

  // Generate enhancement suggestions
  if (optimizationTypes.includes("enhance")) {
    const enhancementSuggestions = await generateEnhancementSuggestions(rules, storage);
    suggestions.push(...enhancementSuggestions);
  }

  // Generate categorization suggestions
  if (optimizationTypes.includes("categorize")) {
    const categorizationSuggestions = await generateCategorizationSuggestions(rules, storage);
    suggestions.push(...categorizationSuggestions);
  }

  // Filter by confidence and limit results
  const filteredSuggestions = suggestions
    .filter(s => s.confidence >= params.minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, params.maxSuggestions);

  let output = `## Rule Optimization Suggestions\n\n`;
  output += `**Total Suggestions**: ${filteredSuggestions.length}\n`;
  output += `**Confidence Threshold**: ${Math.round(params.minConfidence * 100)}%\n`;
  output += `**Optimization Types**: ${optimizationTypes.join(", ")}\n\n`;

  if (filteredSuggestions.length === 0) {
    output += "No optimization suggestions found above the confidence threshold.";
  } else {
    // Group by type
    const groupedSuggestions = filteredSuggestions.reduce((groups, suggestion) => {
      if (!groups[suggestion.type]) groups[suggestion.type] = [];
      groups[suggestion.type].push(suggestion);
      return groups;
    }, {} as Record<string, OptimizationSuggestion[]>);

    for (const [type, typeSuggestions] of Object.entries(groupedSuggestions)) {
      output += `### ${type.toUpperCase()} Optimizations (${typeSuggestions.length})\n\n`;
      
      typeSuggestions.forEach((suggestion, index) => {
        output += `#### ${index + 1}. ${suggestion.suggestion}\n`;
        output += `- **Confidence**: ${Math.round(suggestion.confidence * 100)}%\n`;
        output += `- **Impact**: ${suggestion.impact}\n`;
        output += `- **Auto-applicable**: ${suggestion.autoApplicable ? "Yes" : "No"}\n`;
        output += `- **Estimated Improvement**: ${Math.round(suggestion.estimatedImprovement * 100)}%\n`;
        if (params.includeReasons) {
          output += `- **Reasoning**: ${suggestion.reasoning}\n`;
        }
        output += `- **Affected Rules**: ${suggestion.targetRuleIds.join(", ")}\n\n`;
      });
    }

    // Auto-apply high confidence suggestions if requested
    if (params.autoApply) {
      const autoApplicable = filteredSuggestions.filter(s => s.autoApplicable && s.confidence > 0.9);
      if (autoApplicable.length > 0) {
        output += `\n### Auto-Applied Optimizations (${autoApplicable.length})\n\n`;
        for (const suggestion of autoApplicable) {
          // Store optimization for later application
        storage.addRuleOptimization({
          id: suggestion.id,
          ruleId: suggestion.targetRuleIds[0],
          optimizationType: suggestion.type as "consolidate" | "split" | "deprecate" | "enhance",
          suggestion: suggestion.suggestion,
          confidence: suggestion.confidence,
        });          output += `- ${suggestion.suggestion} (${Math.round(suggestion.confidence * 100)}% confidence)\n`;
        }
      }
    }
  }

  return {
    title: "Rule Optimization Suggestions",
    metadata: {
      totalSuggestions: filteredSuggestions.length,
      suggestionsByType: Object.fromEntries(
        Object.entries(filteredSuggestions.reduce((acc, s) => {
          acc[s.type] = (acc[s.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>))
      ),
      averageConfidence: filteredSuggestions.reduce((sum, s) => sum + s.confidence, 0) / filteredSuggestions.length,
      autoApplied: params.autoApply ? filteredSuggestions.filter(s => s.autoApplicable && s.confidence > 0.9).length : 0,
    },
    output: output.trim(),
  };
}

async function resolveConflicts(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = params.ruleIds 
    ? params.ruleIds.map((id: string) => storage.getRule(id)).filter(Boolean)
    : storage.getRulesByCategory();

  const conflicts: ConflictResolution[] = [];

  // Detect contradictions
  const contradictions = await detectContradictions(rules);
  conflicts.push(...contradictions);

  // Detect overlaps
  const overlaps = await detectOverlaps(rules);
  conflicts.push(...overlaps);

  // Detect redundancies
  const redundancies = await detectRedundancies(rules);
  conflicts.push(...redundancies);

  // Detect category mismatches
  const categoryMismatches = await detectCategoryMismatches(rules, storage);
  conflicts.push(...categoryMismatches);

  // Filter by confidence and sort by severity
  const filteredConflicts = conflicts
    .filter(c => c.confidence >= params.minConfidence)
    .sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

  let output = `## Conflict Resolution Analysis\n\n`;
  output += `**Conflicts Detected**: ${filteredConflicts.length}\n`;
  output += `**Auto-resolvable**: ${filteredConflicts.filter(c => c.autoResolvable).length}\n\n`;

  if (filteredConflicts.length === 0) {
    output += "No conflicts detected above the confidence threshold.";
  } else {
    // Group by severity
    const groupedConflicts = filteredConflicts.reduce((groups, conflict) => {
      if (!groups[conflict.severity]) groups[conflict.severity] = [];
      groups[conflict.severity].push(conflict);
      return groups;
    }, {} as Record<string, ConflictResolution[]>);

    for (const [severity, severityConflicts] of Object.entries(groupedConflicts)) {
      output += `### ${severity.toUpperCase()} Severity Conflicts (${severityConflicts.length})\n\n`;
      
      severityConflicts.forEach((conflict, index) => {
        output += `#### ${index + 1}. ${conflict.type.replace("_", " ").toUpperCase()}\n`;
        output += `- **Affected Rules**: ${conflict.affectedRules.join(", ")}\n`;
        output += `- **Confidence**: ${Math.round(conflict.confidence * 100)}%\n`;
        output += `- **Auto-resolvable**: ${conflict.autoResolvable ? "Yes" : "No"}\n`;
        output += `- **Resolution**: ${conflict.resolution}\n\n`;
      });
    }

    // Auto-resolve if requested
    if (params.autoApply) {
      const autoResolvable = filteredConflicts.filter(c => c.autoResolvable && c.confidence > 0.8);
      if (autoResolvable.length > 0) {
        output += `\n### Auto-Resolved Conflicts (${autoResolvable.length})\n\n`;
        for (const conflict of autoResolvable) {
          output += `- ${conflict.resolution} (${Math.round(conflict.confidence * 100)}% confidence)\n`;
          // Apply resolution logic here
        }
      }
    }
  }

  return {
    title: "Conflict Resolution",
    metadata: {
      totalConflicts: filteredConflicts.length,
      conflictsBySeverity: Object.fromEntries(
        Object.entries(filteredConflicts.reduce((acc, c) => {
          acc[c.severity] = (acc[c.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>))
      ),
      autoResolvable: filteredConflicts.filter(c => c.autoResolvable).length,
    },
    output: output.trim(),
  };
}

async function suggestCategories(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const rules = params.ruleIds 
    ? params.ruleIds.map((id: string) => storage.getRule(id)).filter(Boolean)
    : storage.getRulesByCategory();

  const suggestions: CategoryOptimization[] = [];

  for (const rule of rules) {
    const analytics = safeJsonParseWithFallback(rule.analytics || "{}", {}, "rule analytics");
    const usageHistory = storage.getRuleUsageHistory(rule.id, 50);
    
    const suggestedCategory = await analyzeCategoryFit(rule, analytics, usageHistory, storage);
    
    if (suggestedCategory && suggestedCategory !== rule.category) {
      const usagePatterns = extractUsagePatterns(usageHistory);
      const reasoning = generateCategoryReasoning(rule, suggestedCategory, analytics, usagePatterns);
      const confidence = calculateCategoryConfidence(rule, suggestedCategory, analytics, usageHistory);

      if (confidence >= params.minConfidence) {
        suggestions.push({
          ruleId: rule.id,
          currentCategory: rule.category,
          suggestedCategory,
          reasoning,
          confidence,
          usagePatterns,
        });
      }
    }
  }

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  let output = `## Category Optimization Suggestions\n\n`;
  output += `**Rules Analyzed**: ${rules.length}\n`;
  output += `**Category Changes Suggested**: ${suggestions.length}\n\n`;

  if (suggestions.length === 0) {
    output += "No category changes suggested above the confidence threshold.";
  } else {
    suggestions.forEach((suggestion, index) => {
      const rule = rules.find(r => r.id === suggestion.ruleId);
      output += `### ${index + 1}. ${rule?.text || suggestion.ruleId}\n`;
      output += `- **Current Category**: ${suggestion.currentCategory}\n`;
      output += `- **Suggested Category**: ${suggestion.suggestedCategory}\n`;
      output += `- **Confidence**: ${Math.round(suggestion.confidence * 100)}%\n`;
      if (params.includeReasons) {
        output += `- **Reasoning**: ${suggestion.reasoning}\n`;
      }
      if (suggestion.usagePatterns.length > 0) {
        output += `- **Usage Patterns**: ${suggestion.usagePatterns.join(", ")}\n`;
      }
      output += `\n`;
    });
  }

  return {
    title: "Category Optimization",
    metadata: {
      rulesAnalyzed: rules.length,
      suggestionsGenerated: suggestions.length,
      averageConfidence: suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length,
      categoryChanges: suggestions.reduce((acc, s) => {
        const key = `${s.currentCategory} → ${s.suggestedCategory}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
    output: output.trim(),
  };
}

async function batchOptimize(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  let output = `## Batch Optimization Report\n\n`;
  const results: any = {};

  // Run performance analysis
  const performanceResult = await analyzeRulePerformance(storage, params);
  results.performance = performanceResult.metadata;
  output += `### Performance Analysis\n${performanceResult.output}\n\n`;

  // Run optimization suggestions
  const optimizationResult = await optimizeRules(storage, params);
  results.optimization = optimizationResult.metadata;
  output += `### Optimization Suggestions\n${optimizationResult.output}\n\n`;

  // Run conflict resolution
  const conflictResult = await resolveConflicts(storage, params);
  results.conflicts = conflictResult.metadata;
  output += `### Conflict Resolution\n${conflictResult.output}\n\n`;

  // Run category suggestions
  const categoryResult = await suggestCategories(storage, params);
  results.categories = categoryResult.metadata;
  output += `### Category Optimization\n${categoryResult.output}\n\n`;

  // Generate summary
  output += `## Batch Optimization Summary\n\n`;
  output += `- **Rules Analyzed**: ${results.performance.rulesAnalyzed}\n`;
  output += `- **Optimization Suggestions**: ${results.optimization.totalSuggestions}\n`;
  output += `- **Conflicts Detected**: ${results.conflicts.totalConflicts}\n`;
  output += `- **Category Changes**: ${results.categories.suggestionsGenerated}\n`;
  output += `- **Overall Health Score**: ${calculateOverallHealthScore(results)}%\n`;

  return {
    title: "Batch Optimization",
    metadata: {
      ...results,
      overallHealthScore: calculateOverallHealthScore(results),
    },
    output: output.trim(),
  };
}

async function applyOptimizations(
  storage: MemoryStorage,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  const pendingOptimizations = storage.getRuleOptimizations(undefined, "pending");
  const applicableOptimizations = pendingOptimizations.filter(opt => 
    opt.confidence >= params.minConfidence
  );

  let appliedCount = 0;
  let failedCount = 0;
  const appliedOptimizations: string[] = [];

  for (const optimization of applicableOptimizations) {
    try {
      // Apply the optimization based on type
      const success = await applyOptimization(optimization, storage, ctx);
      if (success) {
        storage.updateOptimizationStatus(optimization.id, "applied");
        appliedCount++;
        appliedOptimizations.push(optimization.id);
      } else {
        failedCount++;
      }
    } catch (error) {
      console.warn(`Failed to apply optimization ${optimization.id}:`, error);
      failedCount++;
    }
  }

  let output = `## Optimization Application Results\n\n`;
  output += `**Pending Optimizations**: ${pendingOptimizations.length}\n`;
  output += `**Applied Successfully**: ${appliedCount}\n`;
  output += `**Failed to Apply**: ${failedCount}\n`;
  output += `**Success Rate**: ${Math.round((appliedCount / (appliedCount + failedCount)) * 100)}%\n\n`;

  if (appliedCount > 0) {
    output += `### Applied Optimizations\n\n`;
    appliedOptimizations.forEach((id, index) => {
      const optimization = pendingOptimizations.find(opt => opt.id === id);
      if (optimization) {
        output += `${index + 1}. ${optimization.suggestion} (${Math.round(optimization.confidence * 100)}% confidence)\n`;
      }
    });
  }

  return {
    title: "Optimization Application",
    metadata: {
      pendingOptimizations: pendingOptimizations.length,
      appliedCount,
      failedCount,
      successRate: (appliedCount / (appliedCount + failedCount)) * 100,
    },
    output: output.trim(),
  };
}

async function getOptimizationReport(
  storage: MemoryStorage,
  params: any
): Promise<{ title: string; metadata: any; output: string }> {
  const allOptimizations = storage.getRuleOptimizations();
  const appliedOptimizations = allOptimizations.filter(opt => opt.status === "applied");
  const pendingOptimizations = allOptimizations.filter(opt => opt.status === "pending");
  const rejectedOptimizations = allOptimizations.filter(opt => opt.status === "rejected");

  let output = `## Optimization Report\n\n`;
  output += `**Total Optimizations**: ${allOptimizations.length}\n`;
  output += `**Applied**: ${appliedOptimizations.length}\n`;
  output += `**Pending**: ${pendingOptimizations.length}\n`;
  output += `**Rejected**: ${rejectedOptimizations.length}\n\n`;

  // Show optimization types breakdown
  const typeBreakdown = allOptimizations.reduce((acc, opt) => {
    acc[opt.optimizationType] = (acc[opt.optimizationType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  output += `### Optimization Types\n`;
  Object.entries(typeBreakdown).forEach(([type, count]) => {
    output += `- **${type}**: ${count}\n`;
  });

  // Show recent optimizations
  const recentOptimizations = allOptimizations
    .filter(opt => opt.appliedAt)
    .sort((a, b) => new Date(b.appliedAt!).getTime() - new Date(a.appliedAt!).getTime())
    .slice(0, 10);

  if (recentOptimizations.length > 0) {
    output += `\n### Recent Applied Optimizations\n\n`;
    recentOptimizations.forEach((opt, index) => {
      output += `${index + 1}. ${opt.suggestion} (${new Date(opt.appliedAt!).toLocaleDateString()})\n`;
    });
  }

  return {
    title: "Optimization Report",
    metadata: {
      totalOptimizations: allOptimizations.length,
      appliedOptimizations: appliedOptimizations.length,
      pendingOptimizations: pendingOptimizations.length,
      rejectedOptimizations: rejectedOptimizations.length,
      typeBreakdown,
    },
    output: output.trim(),
  };
}

// Helper functions

async function calculateConflictScore(rule: any, storage: MemoryStorage): Promise<number> {
  const allRules = storage.getRulesByCategory();
  let conflictScore = 0;
  let conflictCount = 0;

  for (const otherRule of allRules) {
    if (otherRule.id === rule.id) continue;

    // Check for text similarity (potential overlap)
    const similarity = calculateTextSimilarity(rule.text, otherRule.text);
    if (similarity > 0.7) {
      conflictScore += similarity;
      conflictCount++;
    }

    // Check for contradictory keywords
    if (hasContradictoryKeywords(rule.text, otherRule.text)) {
      conflictScore += 0.8;
      conflictCount++;
    }
  }

  return conflictCount > 0 ? conflictScore / conflictCount : 0;
}

async function calculateRedundancyScore(rule: any, storage: MemoryStorage): Promise<number> {
  const allRules = storage.getRulesByCategory();
  let redundancyScore = 0;
  let redundantCount = 0;

  for (const otherRule of allRules) {
    if (otherRule.id === rule.id) continue;

    const similarity = calculateTextSimilarity(rule.text, otherRule.text);
    if (similarity > 0.8) {
      redundancyScore += similarity;
      redundantCount++;
    }
  }

  return redundantCount > 0 ? redundancyScore / redundantCount : 0;
}

function calculateImprovementPotential(rule: any, analytics: any, usageHistory: any[]): number {
  let potential = 0;

  // Low effectiveness indicates improvement potential
  const effectiveness = analytics.effectivenessScore || 0;
  if (effectiveness < 0.5) {
    potential += (0.5 - effectiveness) * 2;
  }

  // Low usage with old creation date indicates potential for deprecation
  const daysSinceCreation = (Date.now() - new Date(rule.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (rule.usageCount < 5 && daysSinceCreation > 30) {
    potential += 0.3;
  }

  // Negative feedback indicates improvement potential
  const negativeFeedback = analytics.userFeedback?.filter((f: any) => f.rating < 3).length || 0;
  if (negativeFeedback > 0) {
    potential += Math.min(0.4, negativeFeedback * 0.1);
  }

  return Math.min(1, potential);
}

function generatePerformanceRecommendations(
  rule: any,
  effectiveness: number,
  usageFrequency: number,
  conflictScore: number,
  redundancyScore: number,
  improvementPotential: number
): string[] {
  const recommendations: string[] = [];

  if (effectiveness < 0.3) {
    recommendations.push("Consider revising or deprecating due to low effectiveness");
  }

  if (usageFrequency === 0) {
    recommendations.push("Rule is unused - consider deprecation or better documentation");
  }

  if (conflictScore > 0.5) {
    recommendations.push("High conflict score - review for contradictions with other rules");
  }

  if (redundancyScore > 0.5) {
    recommendations.push("High redundancy - consider consolidating with similar rules");
  }

  if (improvementPotential > 0.7) {
    recommendations.push("High improvement potential - prioritize for optimization");
  }

  return recommendations;
}

async function generateConsolidationSuggestions(rules: any[], storage: MemoryStorage): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < rules.length; i++) {
    if (processed.has(rules[i].id)) continue;

    const similarRules = [];
    for (let j = i + 1; j < rules.length; j++) {
      if (processed.has(rules[j].id)) continue;

      const similarity = calculateTextSimilarity(rules[i].text, rules[j].text);
      if (similarity > 0.7) {
        similarRules.push(rules[j]);
        processed.add(rules[j].id);
      }
    }

    if (similarRules.length > 0) {
      const targetRuleIds = [rules[i].id, ...similarRules.map(r => r.id)];
      const confidence = Math.min(0.9, 0.5 + (similarRules.length * 0.1));
      
      suggestions.push({
        id: `consolidate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "consolidate",
        targetRuleIds,
        suggestion: `Consolidate ${targetRuleIds.length} similar rules into one comprehensive rule`,
        reasoning: `Found ${similarRules.length} rules with high similarity to "${rules[i].text}"`,
        confidence,
        impact: similarRules.length > 2 ? "high" : "medium",
        autoApplicable: confidence > 0.8,
        estimatedImprovement: Math.min(0.8, similarRules.length * 0.2),
      });

      processed.add(rules[i].id);
    }
  }

  return suggestions;
}

async function generateSplitSuggestions(rules: any[], storage: MemoryStorage): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = [];

  for (const rule of rules) {
    // Check if rule text is very long or contains multiple concepts
    const wordCount = rule.text.split(/\s+/).length;
    const hasMultipleConcepts = rule.text.includes(" and ") || rule.text.includes(", ");

    if (wordCount > 20 && hasMultipleConcepts) {
      suggestions.push({
        id: `split-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "split",
        targetRuleIds: [rule.id],
        suggestion: `Split complex rule into multiple focused rules`,
        reasoning: `Rule contains ${wordCount} words and multiple concepts`,
        confidence: wordCount > 30 ? 0.8 : 0.6,
        impact: "medium",
        autoApplicable: false, // Requires human judgment
        estimatedImprovement: 0.4,
      });
    }
  }

  return suggestions;
}

async function generateDeprecationSuggestions(rules: any[], storage: MemoryStorage): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = [];

  for (const rule of rules) {
    const analytics = safeJsonParseWithFallback(rule.analytics || "{}", {}, "rule analytics");
    const daysSinceCreation = (Date.now() - new Date(rule.createdAt).getTime()) / (1000 * 60 * 60 * 24);

    // Suggest deprecation for old, unused rules with low effectiveness
    if (daysSinceCreation > 90 && rule.usageCount < 3 && ((analytics as any).effectivenessScore || 0) < 0.3) {
      suggestions.push({
        id: `deprecate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "deprecate",
        targetRuleIds: [rule.id],
        suggestion: `Deprecate unused rule with low effectiveness`,
        reasoning: `Rule is ${Math.round(daysSinceCreation)} days old, used ${rule.usageCount} times, effectiveness ${Math.round(((analytics as any).effectivenessScore || 0) * 100)}%`,
        confidence: 0.7,
        impact: "low",
        autoApplicable: true,
        estimatedImprovement: 0.2,
      });
    }
  }

  return suggestions;
}

async function generateEnhancementSuggestions(rules: any[], storage: MemoryStorage): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = [];

  for (const rule of rules) {
    const analytics = safeJsonParseWithFallback(rule.analytics || "{}", {}, "rule analytics");

    // Suggest enhancement for frequently used rules with room for improvement
    if (rule.usageCount > 10 && ((analytics as any).effectivenessScore || 0) < 0.7) {
      suggestions.push({
        id: `enhance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "enhance",
        targetRuleIds: [rule.id],
        suggestion: `Enhance frequently used rule to improve effectiveness`,
        reasoning: `Rule used ${rule.usageCount} times but effectiveness only ${Math.round(((analytics as any).effectivenessScore || 0) * 100)}%`,
        confidence: 0.6,
        impact: "high",
        autoApplicable: false,
        estimatedImprovement: 0.6,
      });
    }

    // Suggest adding documentation for rules without it
    if (rule.usageCount > 5 && !rule.filePath && (!rule.documentationLinks || rule.documentationLinks.length === 0)) {
      suggestions.push({
        id: `document-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "enhance",
        targetRuleIds: [rule.id],
        suggestion: `Add documentation for frequently used rule`,
        reasoning: `Rule used ${rule.usageCount} times but lacks documentation`,
        confidence: 0.8,
        impact: "medium",
        autoApplicable: false,
        estimatedImprovement: 0.3,
      });
    }
  }

  return suggestions;
}

async function generateCategorizationSuggestions(rules: any[], storage: MemoryStorage): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = [];

  for (const rule of rules) {
    const analytics = safeJsonParseWithFallback(rule.analytics || "{}", {}, "rule analytics");
    const usageHistory = storage.getRuleUsageHistory(rule.id, 50);
    
    const suggestedCategory = await analyzeCategoryFit(rule, analytics, usageHistory, storage);
    
    if (suggestedCategory && suggestedCategory !== rule.category) {
      const confidence = calculateCategoryConfidence(rule, suggestedCategory, analytics, usageHistory);
      
      if (confidence > 0.6) {
        suggestions.push({
          id: `categorize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "categorize",
          targetRuleIds: [rule.id],
          suggestion: `Recategorize rule from ${rule.category} to ${suggestedCategory}`,
          reasoning: generateCategoryReasoning(rule, suggestedCategory, analytics, extractUsagePatterns(usageHistory)),
          confidence,
          impact: "medium",
          autoApplicable: confidence > 0.8,
          estimatedImprovement: 0.3,
        });
      }
    }
  }

  return suggestions;
}

async function detectContradictions(rules: any[]): Promise<ConflictResolution[]> {
  const conflicts: ConflictResolution[] = [];
  
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      if (hasContradictoryKeywords(rules[i].text, rules[j].text)) {
        conflicts.push({
          conflictId: `contradiction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "contradiction",
          affectedRules: [rules[i].id, rules[j].id],
          severity: "high",
          resolution: `Resolve contradiction between "${rules[i].text}" and "${rules[j].text}"`,
          confidence: 0.8,
          autoResolvable: false,
        });
      }
    }
  }

  return conflicts;
}

async function detectOverlaps(rules: any[]): Promise<ConflictResolution[]> {
  const conflicts: ConflictResolution[] = [];
  
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const similarity = calculateTextSimilarity(rules[i].text, rules[j].text);
      if (similarity > 0.6 && similarity < 0.9) {
        conflicts.push({
          conflictId: `overlap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "overlap",
          affectedRules: [rules[i].id, rules[j].id],
          severity: "medium",
          resolution: `Consider consolidating overlapping rules`,
          confidence: similarity,
          autoResolvable: similarity > 0.8,
        });
      }
    }
  }

  return conflicts;
}

async function detectRedundancies(rules: any[]): Promise<ConflictResolution[]> {
  const conflicts: ConflictResolution[] = [];
  
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const similarity = calculateTextSimilarity(rules[i].text, rules[j].text);
      if (similarity > 0.9) {
        conflicts.push({
          conflictId: `redundancy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "redundancy",
          affectedRules: [rules[i].id, rules[j].id],
          severity: "low",
          resolution: `Remove duplicate rule`,
          confidence: similarity,
          autoResolvable: true,
        });
      }
    }
  }

  return conflicts;
}

async function detectCategoryMismatches(rules: any[], storage: MemoryStorage): Promise<ConflictResolution[]> {
  const conflicts: ConflictResolution[] = [];
  
  for (const rule of rules) {
    const analytics = safeJsonParseWithFallback(rule.analytics || "{}", {}, "rule analytics");
    const usageHistory = storage.getRuleUsageHistory(rule.id, 50);
    
    const suggestedCategory = await analyzeCategoryFit(rule, analytics, usageHistory, storage);
    
    if (suggestedCategory && suggestedCategory !== rule.category) {
      const confidence = calculateCategoryConfidence(rule, suggestedCategory, analytics, usageHistory);
      
      if (confidence > 0.7) {
        conflicts.push({
          conflictId: `category-mismatch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "category_mismatch",
          affectedRules: [rule.id],
          severity: "medium",
          resolution: `Recategorize from ${rule.category} to ${suggestedCategory}`,
          confidence,
          autoResolvable: confidence > 0.8,
        });
      }
    }
  }

  return conflicts;
}

async function analyzeCategoryFit(rule: any, analytics: any, usageHistory: any[], storage: MemoryStorage): Promise<"critical" | "preferred" | "contextual" | "deprecated" | null> {
  const effectiveness = (analytics as any).effectivenessScore || 0;
  const usageCount = rule.usageCount || 0;
  const text = rule.text.toLowerCase();

  // Critical indicators
  if (text.includes("must") || text.includes("never") || text.includes("always") || 
      text.includes("critical") || text.includes("security") || text.includes("error")) {
    return "critical";
  }

  // Contextual indicators
  if (rule.filePath || text.includes("when") || text.includes("if") || text.includes("context")) {
    return "contextual";
  }

  // Deprecated indicators
  if (effectiveness < 0.2 && usageCount < 2) {
    return "deprecated";
  }

  // Default to preferred
  return "preferred";
}

function calculateCategoryConfidence(rule: any, suggestedCategory: string, analytics: any, usageHistory: any[]): number {
  let confidence = 0.5;

  const text = rule.text.toLowerCase();
  const effectiveness = (analytics as any).effectivenessScore || 0;
  const usageCount = rule.usageCount || 0;

  // Strong indicators boost confidence
  if (suggestedCategory === "critical") {
    if (text.includes("must") || text.includes("critical") || text.includes("security")) {
      confidence += 0.3;
    }
  } else if (suggestedCategory === "deprecated") {
    if (effectiveness < 0.2 && usageCount < 2) {
      confidence += 0.4;
    }
  } else if (suggestedCategory === "contextual") {
    if (rule.filePath || text.includes("when") || text.includes("context")) {
      confidence += 0.3;
    }
  }

  return Math.min(1, confidence);
}

function generateCategoryReasoning(rule: any, suggestedCategory: string, analytics: any, usagePatterns: string[]): string {
  const effectiveness = (analytics as any).effectivenessScore || 0;
  const usageCount = rule.usageCount || 0;

  switch (suggestedCategory) {
    case "critical":
      return `Rule contains critical keywords and should be enforced strictly`;
    case "deprecated":
      return `Low effectiveness (${Math.round(effectiveness * 100)}%) and minimal usage (${usageCount} times)`;
    case "contextual":
      return `Rule appears to be context-specific based on content and usage patterns`;
    case "preferred":
      return `Rule represents a best practice but is not critical`;
    default:
      return `Category change recommended based on usage analysis`;
  }
}

function extractUsagePatterns(usageHistory: any[]): string[] {
  const patterns: string[] = [];
  
  if (usageHistory.length === 0) {
    patterns.push("unused");
    return patterns;
  }

  // Analyze usage frequency
  const recentUsage = usageHistory.filter(usage => 
    new Date(usage.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );

  if (recentUsage.length > 10) {
    patterns.push("frequently-used");
  } else if (recentUsage.length > 3) {
    patterns.push("moderately-used");
  } else {
    patterns.push("rarely-used");
  }

  // Analyze effectiveness patterns
  const effectiveUsage = usageHistory.filter(usage => (usage.effectiveness || 0) > 0.7);
  if (effectiveUsage.length > usageHistory.length * 0.8) {
    patterns.push("highly-effective");
  } else if (effectiveUsage.length < usageHistory.length * 0.3) {
    patterns.push("low-effectiveness");
  }

  return patterns;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function hasContradictoryKeywords(text1: string, text2: string): boolean {
  const contradictions = [
    ["always", "never"],
    ["must", "must not"],
    ["should", "should not"],
    ["do", "don't"],
    ["use", "avoid"],
    ["prefer", "avoid"],
    ["enable", "disable"],
    ["allow", "forbid"],
  ];

  const lower1 = text1.toLowerCase();
  const lower2 = text2.toLowerCase();

  return contradictions.some(([positive, negative]) =>
    (lower1.includes(positive) && lower2.includes(negative)) ||
    (lower1.includes(negative) && lower2.includes(positive))
  );
}

async function applyOptimization(optimization: any, storage: MemoryStorage, ctx: any): Promise<boolean> {
  try {
    switch (optimization.optimizationType) {
      case "deprecate":
        // Move rule to deprecated category
        const rule = storage.getRule(optimization.ruleId);
        if (rule) {
          storage.updateRule(optimization.ruleId, { category: "deprecated" });
          return true;
        }
        break;
      
      case "consolidate":
        // This would require more complex logic to merge rules
        // For now, just mark as applied
        return true;
      
      case "enhance":
        // This would require human intervention
        return false;
      
      default:
        return false;
    }
  } catch (error) {
    console.warn(`Failed to apply optimization:`, error);
    return false;
  }
  
  return false;
}

function calculateOverallHealthScore(results: any): number {
  const performance = results.performance || {};
  const optimization = results.optimization || {};
  const conflicts = results.conflicts || {};

  let score = 70; // Base score

  // Performance factors
  const avgEffectiveness = performance.averageEffectiveness || 0;
  score += (avgEffectiveness * 20);

  // Conflict factors
  const conflictRatio = conflicts.totalConflicts / (performance.rulesAnalyzed || 1);
  score -= (conflictRatio * 30);

  // Optimization factors
  const optimizationRatio = optimization.totalSuggestions / (performance.rulesAnalyzed || 1);
  score -= (optimizationRatio * 10);

  return Math.max(0, Math.min(100, Math.round(score)));
}