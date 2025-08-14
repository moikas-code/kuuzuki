import { Tool } from "./tool";
import { z } from "zod";
import { MemoryStorage } from "./memory-storage";
import DESCRIPTION from "./smart-learning-assistant.txt";

interface UserBehaviorPattern {
  id: string;
  sessionId: string;
  timestamp: string;
  actionType: string;
  actionData: string; // JSON string
  context: string; // JSON string
  outcome: string;
  effectiveness?: number;
}

export const SmartLearningAssistantTool = Tool.define("smart-learning-assistant", {
  description: DESCRIPTION,

  parameters: z.object({
    action: z.enum([
      "analyze_patterns",
      "suggest_rules", 
      "predict_needs",
      "cluster_behaviors",
      "get_insights",
      "record_behavior",
      "provide_feedback",
      "optimize_workflow",
      "learn_from_errors",
      "adaptive_suggestions"
    ]),
    sessionId: z.string().optional().describe("Session ID for context"),
    context: z.object({
      currentFiles: z.array(z.string()).optional(),
      recentCommands: z.array(z.string()).optional(),
      activeTools: z.array(z.string()).optional(),
      errorMessages: z.array(z.string()).optional(),
      taskType: z.string().optional(),
      timeOfDay: z.string().optional(),
      workingDirectory: z.string().optional(),
    }).optional().describe("Current context for analysis"),
    behaviorData: z.object({
      actionType: z.string(),
      actionData: z.any(),
      outcome: z.string(),
      effectiveness: z.number().min(0).max(1).optional(),
    }).optional().describe("Behavior data to record"),
    feedbackData: z.object({
      ruleId: z.string(),
      feedbackType: z.enum(["positive", "negative", "correction"]),
      originalSuggestion: z.string(),
      userCorrection: z.string().optional(),
    }).optional().describe("Feedback data for learning"),
    minConfidence: z.number().min(0).max(1).default(0.6).describe("Minimum confidence threshold"),
    maxSuggestions: z.number().min(1).max(20).default(10).describe("Maximum number of suggestions"),
    timeframe: z.string().default("7d").describe("Timeframe for analysis (e.g., '7d', '30d')"),
    includeReasons: z.boolean().default(true).describe("Include reasoning in responses"),
  }),

  async execute(params, ctx) {
    const storage = MemoryStorage.getInstance();

    try {
      switch (params.action) {
        case "analyze_patterns":
          return await analyzeUserPatterns(storage, params, ctx);
        case "suggest_rules":
          return await generateAdaptiveRuleSuggestions(storage, params, ctx);
        case "predict_needs":
          return await predictUserNeeds(storage, params, ctx);
        case "cluster_behaviors":
          return await clusterUserBehaviors(storage, params, ctx);
        case "get_insights":
          return await getLearningInsights(storage, params, ctx);
        case "record_behavior":
          return await recordUserBehavior(storage, params, ctx);
        case "provide_feedback":
          return await provideLearningFeedback(storage, params, ctx);
        case "optimize_workflow":
          return await optimizeWorkflow(storage, params, ctx);
        case "learn_from_errors":
          return await learnFromErrors(storage, params, ctx);
        case "adaptive_suggestions":
          return await generateAdaptiveSuggestions(storage, params, ctx);
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        title: "Smart Learning Assistant Error",
        metadata: { error: errorMessage },
        output: `Error: ${errorMessage}`,
      };
    }
  },
});

// Initialize learning tables if they don't exist
function initializeLearningTables(storage: MemoryStorage): boolean {
  try {
    const db = (storage as any).db;
    if (!db) {
      console.warn("Database not available for learning tables initialization");
      return false;
    }
    
    // User behavior patterns table
    db.exec(`
    CREATE TABLE IF NOT EXISTS user_behavior_patterns (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      actionType TEXT NOT NULL,
      actionData TEXT NOT NULL,
      context TEXT NOT NULL,
      outcome TEXT NOT NULL,
      effectiveness REAL
    )
  `);

  // Learning patterns table
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_patterns (
      id TEXT PRIMARY KEY,
      patternType TEXT NOT NULL CHECK (patternType IN ('command_sequence', 'error_pattern', 'file_pattern', 'time_pattern', 'context_pattern')),
      pattern TEXT NOT NULL,
      frequency INTEGER DEFAULT 1,
      confidence REAL DEFAULT 0.5,
      lastSeen TEXT NOT NULL,
      metadata TEXT DEFAULT '{}'
    )
  `);

  // Behavior clusters table
  db.exec(`
    CREATE TABLE IF NOT EXISTS behavior_clusters (
      id TEXT PRIMARY KEY,
      clusterType TEXT NOT NULL CHECK (clusterType IN ('workflow', 'error_handling', 'coding_style', 'tool_usage')),
      behaviors TEXT NOT NULL,
      frequency INTEGER DEFAULT 1,
      effectiveness REAL DEFAULT 0.5,
      suggestions TEXT DEFAULT '[]'
    )
  `);

  // Learning insights table
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_insights (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('pattern_discovery', 'behavior_optimization', 'rule_effectiveness', 'workflow_improvement')),
      insight TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      actionable BOOLEAN DEFAULT 0,
      suggestedActions TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      appliedAt TEXT
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_behavior_session ON user_behavior_patterns (sessionId);
    CREATE INDEX IF NOT EXISTS idx_behavior_timestamp ON user_behavior_patterns (timestamp);
    CREATE INDEX IF NOT EXISTS idx_behavior_type ON user_behavior_patterns (actionType);
    CREATE INDEX IF NOT EXISTS idx_patterns_type ON learning_patterns (patternType);
    CREATE INDEX IF NOT EXISTS idx_patterns_frequency ON learning_patterns (frequency);
    CREATE INDEX IF NOT EXISTS idx_clusters_type ON behavior_clusters (clusterType);
    CREATE INDEX IF NOT EXISTS idx_insights_type ON learning_insights (type);
  `);
    return true;
  } catch (error) {
    console.error("Failed to initialize learning tables:", error);
    return false;
  }
}

async function analyzeUserPatterns(
  storage: MemoryStorage,
  params: any,
  _ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  const dbAvailable = initializeLearningTables(storage);
  if (!dbAvailable) {
    return {
      title: "Pattern Analysis Complete",
      metadata: { behaviorsAnalyzed: 0, patternsDiscovered: 0, insightsGenerated: 0, timeframe: params.timeframe },
      output: "Pattern analysis completed (database not available for learning data storage)."
    };
  }
  
  const timeframeDays = getTimeframeDays(params.timeframe);
  const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000).toISOString();

  // Get user behavior data
  const db = (storage as any).db;
  const behaviors = db.prepare(`
    SELECT * FROM user_behavior_patterns 
    WHERE timestamp > ? 
    ORDER BY timestamp DESC 
    LIMIT 1000
  `).all(cutoffDate) as UserBehaviorPattern[];

  if (behaviors.length === 0) {
    return {
      title: "No Patterns Found",
      metadata: { timeframe: params.timeframe },
      output: "No user behavior data found for analysis. Start using kuuzuki to build learning patterns.",
    };
  }

  // Analyze patterns
  const patterns = await extractLearningPatterns(behaviors, storage);
  const insights = await generatePatternInsights(patterns, behaviors);

  let output = `## User Pattern Analysis (${params.timeframe})\n\n`;
  output += `**Behaviors Analyzed**: ${behaviors.length}\n`;
  output += `**Patterns Discovered**: ${patterns.length}\n`;
  output += `**Sessions Covered**: ${new Set(behaviors.map(b => b.sessionId)).size}\n\n`;

  if (patterns.length > 0) {
    output += `### Discovered Patterns\n\n`;
    patterns.slice(0, params.maxSuggestions).forEach((pattern, index) => {
      output += `#### ${index + 1}. ${pattern.patternType.replace('_', ' ').toUpperCase()}\n`;
      output += `**Pattern**: ${pattern.pattern}\n`;
      output += `**Frequency**: ${pattern.frequency} occurrences\n`;
      output += `**Confidence**: ${Math.round(pattern.confidence * 100)}%\n`;
      output += `**Last Seen**: ${new Date(pattern.lastSeen).toLocaleString()}\n\n`;
    });
  }

  if (insights.length > 0) {
    output += `### Learning Insights\n\n`;
    insights.slice(0, 5).forEach((insight, index) => {
      output += `#### ${index + 1}. ${insight.type.replace('_', ' ').toUpperCase()}\n`;
      output += `**Insight**: ${insight.insight}\n`;
      output += `**Confidence**: ${Math.round(insight.confidence * 100)}%\n`;
      if (insight.actionable && insight.suggestedActions.length > 0) {
        output += `**Suggested Actions**:\n`;
        insight.suggestedActions.forEach((action: string) => {
          output += `- ${action}\n`;
        });
      }
      output += `\n`;
    });
  }

  return {
    title: "Pattern Analysis Complete",
    metadata: {
      behaviorsAnalyzed: behaviors.length,
      patternsDiscovered: patterns.length,
      insightsGenerated: insights.length,
      timeframe: params.timeframe,
    },
    output: output.trim(),
  };
}

async function generateAdaptiveRuleSuggestions(
  storage: MemoryStorage,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  initializeLearningTables(storage);
  
  const context = params.context || {};
  const sessionId = params.sessionId || ctx.sessionID;

  // Get existing rules and user patterns
  const existingRules = storage.getAllRules();
  const existingTexts = new Set(existingRules.map(r => r.text.toLowerCase()));

  // Get recent behavior patterns
  const db = (storage as any).db;
  const recentBehaviors = db.prepare(`
    SELECT * FROM user_behavior_patterns 
    WHERE sessionId = ? OR timestamp > ?
    ORDER BY timestamp DESC 
    LIMIT 100
  `).all(sessionId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) as UserBehaviorPattern[];

  // Get learning patterns
  const patterns = db.prepare(`
    SELECT * FROM learning_patterns 
    WHERE confidence >= ?
    ORDER BY frequency DESC, confidence DESC
  `).all(params.minConfidence) as any[];

  // Generate contextual rule suggestions
  const suggestions = await generateContextualRuleSuggestions(
    patterns,
    recentBehaviors,
    context,
    existingTexts,
    params.maxSuggestions
  );

  let output = `## Adaptive Rule Suggestions\n\n`;
  output += `**Context**: ${JSON.stringify(context, null, 2)}\n`;
  output += `**Patterns Analyzed**: ${patterns.length}\n`;
  output += `**Suggestions Generated**: ${suggestions.length}\n\n`;

  if (suggestions.length > 0) {
    output += `### Recommended Rules\n\n`;
    suggestions.forEach((suggestion, index) => {
      output += `#### ${index + 1}. ${suggestion.category.toUpperCase()} Rule\n`;
      output += `**Rule**: ${suggestion.text}\n`;
      output += `**Confidence**: ${Math.round(suggestion.confidence * 100)}%\n`;
      output += `**Reason**: ${suggestion.reason}\n`;
      if (params.includeReasons && suggestion.patterns.length > 0) {
        output += `**Based on patterns**: ${suggestion.patterns.join(", ")}\n`;
      }
      output += `\n`;
    });

    output += `\n💡 **Tip**: Use \`memory add\` to add these rules to your configuration.`;
  } else {
    output += "No new rule suggestions found. Your current rules seem to cover your usage patterns well.";
  }

  return {
    title: "Adaptive Rule Suggestions",
    metadata: {
      patternsAnalyzed: patterns.length,
      suggestionsGenerated: suggestions.length,
      context,
    },
    output: output.trim(),
  };
}

async function predictUserNeeds(
  storage: MemoryStorage,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  initializeLearningTables(storage);
  
  const context = params.context || {};
  const sessionId = params.sessionId || ctx.sessionID;

  // Get recent session context and behavior
  const sessionContext = storage.getSessionContext(sessionId);
  const recentUsage = storage.getSessionUsageHistory(sessionId, 20);

  // Get behavior patterns for prediction
  const db = (storage as any).db;
  const similarContexts = db.prepare(`
    SELECT * FROM user_behavior_patterns 
    WHERE actionData LIKE ? OR context LIKE ?
    ORDER BY timestamp DESC 
    LIMIT 50
  `).all(`%${context.taskType || ''}%`, `%${JSON.stringify(context)}%`) as UserBehaviorPattern[];

  // Generate predictions
  const predictions = await generatePredictions(
    context,
    sessionContext,
    recentUsage,
    similarContexts,
    storage
  );

  let output = `## Predictive Assistance\n\n`;
  output += `**Current Context**: ${JSON.stringify(context, null, 2)}\n`;
  output += `**Session History**: ${recentUsage.length} recent actions\n`;
  output += `**Similar Contexts**: ${similarContexts.length} found\n\n`;

  if (predictions.length > 0) {
    output += `### Predictions\n\n`;
    predictions.forEach((prediction, index) => {
      output += `#### ${index + 1}. ${prediction.type.replace('_', ' ').toUpperCase()}\n`;
      output += `**Prediction**: ${prediction.prediction}\n`;
      output += `**Confidence**: ${Math.round(prediction.confidence * 100)}%\n`;
      if (params.includeReasons) {
        output += `**Reasoning**: ${prediction.reasoning}\n`;
      }
      output += `\n`;
    });
  } else {
    output += "No predictions available. Continue using kuuzuki to build predictive patterns.";
  }

  return {
    title: "Predictive Assistance",
    metadata: {
      predictionsGenerated: predictions.length,
      similarContexts: similarContexts.length,
      sessionHistory: recentUsage.length,
    },
    output: output.trim(),
  };
}

async function clusterUserBehaviors(
  storage: MemoryStorage,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  initializeLearningTables(storage);
  
  const timeframeDays = getTimeframeDays(params.timeframe);
  const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000).toISOString();

  // Get behavior data
  const db = (storage as any).db;
  const behaviors = db.prepare(`
    SELECT * FROM user_behavior_patterns 
    WHERE timestamp > ?
    ORDER BY timestamp DESC
  `).all(cutoffDate) as UserBehaviorPattern[];

  if (behaviors.length < 10) {
    return {
      title: "Insufficient Data",
      metadata: { timeframe: params.timeframe },
      output: "Need more behavior data to perform clustering analysis. Continue using kuuzuki to build patterns.",
    };
  }

  // Perform behavior clustering
  const clusters = await performBehaviorClustering(behaviors, storage);
  const optimizations = await generateClusterOptimizations(clusters);

  let output = `## Behavior Clustering Analysis (${params.timeframe})\n\n`;
  output += `**Behaviors Analyzed**: ${behaviors.length}\n`;
  output += `**Clusters Identified**: ${clusters.length}\n`;
  output += `**Optimization Opportunities**: ${optimizations.length}\n\n`;

  if (clusters.length > 0) {
    output += `### Behavior Clusters\n\n`;
    clusters.forEach((cluster, index) => {
      output += `#### ${index + 1}. ${cluster.clusterType.replace('_', ' ').toUpperCase()} Cluster\n`;
      output += `**Behaviors**: ${cluster.behaviors.length} unique patterns\n`;
      output += `**Frequency**: ${cluster.frequency} occurrences\n`;
      output += `**Effectiveness**: ${Math.round(cluster.effectiveness * 100)}%\n`;
      
      if (cluster.suggestions.length > 0) {
        output += `**Suggestions**:\n`;
        cluster.suggestions.forEach((suggestion: string) => {
          output += `- ${suggestion}\n`;
        });
      }
      output += `\n`;
    });
  }

  if (optimizations.length > 0) {
    output += `### Optimization Opportunities\n\n`;
    optimizations.forEach((opt, index) => {
      output += `${index + 1}. ${opt}\n`;
    });
  }

  return {
    title: "Behavior Clustering Complete",
    metadata: {
      behaviorsAnalyzed: behaviors.length,
      clustersIdentified: clusters.length,
      optimizations: optimizations.length,
    },
    output: output.trim(),
  };
}

async function getLearningInsights(
  storage: MemoryStorage,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  const dbAvailable = initializeLearningTables(storage);
  if (!dbAvailable) {
    return {
      title: "Learning Insights",
      metadata: { insightsAvailable: 0, actionableInsights: 0 },
      output: "No insights available yet (database not available for learning data storage)."
    };
  }
  
  // Get stored insights
  const db = (storage as any).db;
  const insights = db.prepare(`
    SELECT * FROM learning_insights 
    WHERE confidence >= ?
    ORDER BY confidence DESC, createdAt DESC
    LIMIT ?
  `).all(params.minConfidence, params.maxSuggestions) as any[];

  // Generate new insights if needed
  if (insights.length < params.maxSuggestions) {
    const newInsights = await generateFreshInsights(storage, params);
    insights.push(...newInsights);
  }

  let output = `## Learning Insights\n\n`;
  output += `**Insights Available**: ${insights.length}\n`;
  output += `**Confidence Threshold**: ${Math.round(params.minConfidence * 100)}%\n\n`;

  if (insights.length > 0) {
    output += `### Key Insights\n\n`;
    insights.slice(0, params.maxSuggestions).forEach((insight, index) => {
      output += `#### ${index + 1}. ${insight.type.replace('_', ' ').toUpperCase()}\n`;
      output += `**Insight**: ${insight.insight}\n`;
      output += `**Confidence**: ${Math.round(insight.confidence * 100)}%\n`;
      output += `**Actionable**: ${insight.actionable ? '✅ Yes' : '❌ No'}\n`;
      
      if (insight.actionable && insight.suggestedActions) {
        const actions = JSON.parse(insight.suggestedActions);
        if (actions.length > 0) {
          output += `**Suggested Actions**:\n`;
          actions.forEach((action: string) => {
            output += `- ${action}\n`;
          });
        }
      }
      output += `\n`;
    });
  } else {
    output += "No insights available yet. Continue using kuuzuki to generate learning insights.";
  }

  return {
    title: "Learning Insights",
    metadata: {
      insightsAvailable: insights.length,
      actionableInsights: insights.filter(i => i.actionable).length,
    },
    output: output.trim(),
  };
}

async function recordUserBehavior(
  storage: MemoryStorage,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  const dbAvailable = initializeLearningTables(storage);
  if (!dbAvailable) {
    return {
      title: "Behavior Recorded",
      metadata: { behaviorId: "mock-id", actionType: params.behaviorData.actionType, sessionId: params.sessionId || ctx.sessionID },
      output: `Recorded ${params.behaviorData.actionType} behavior (database not available for persistent storage).`
    };
  }
  
  if (!params.behaviorData) {
    throw new Error("behaviorData is required for record_behavior action");
  }

  const sessionId = params.sessionId || ctx.sessionID;
  const behaviorId = generateBehaviorId(params.behaviorData.actionType);
  
  // Record behavior
  const db = (storage as any).db;
  const stmt = db.prepare(`
    INSERT INTO user_behavior_patterns 
    (id, sessionId, timestamp, actionType, actionData, context, outcome, effectiveness)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    behaviorId,
    sessionId,
    new Date().toISOString(),
    params.behaviorData.actionType,
    JSON.stringify(params.behaviorData.actionData),
    JSON.stringify(params.context || {}),
    params.behaviorData.outcome,
    params.behaviorData.effectiveness || null
  );

  // Update learning patterns
  await updateLearningPatterns(params.behaviorData, params.context, storage);

  return {
    title: "Behavior Recorded",
    metadata: {
      behaviorId,
      actionType: params.behaviorData.actionType,
      sessionId,
    },
    output: `Recorded ${params.behaviorData.actionType} behavior with outcome: ${params.behaviorData.outcome}`,
  };
}

async function provideLearningFeedback(
  storage: MemoryStorage,
  params: any,
  ctx: any
): Promise<{ title: string; metadata: any; output: string }> {
  if (!params.feedbackData) {
    throw new Error("feedbackData is required for provide_feedback action");
  }

  const sessionId = params.sessionId || ctx.sessionID;
  
  // Record feedback using existing method
  storage.recordLearningFeedback({
    ruleId: params.feedbackData.ruleId,
    sessionId,
    feedbackType: params.feedbackData.feedbackType,
    originalSuggestion: params.feedbackData.originalSuggestion,
    userCorrection: params.feedbackData.userCorrection,
    context: JSON.stringify(params.context || {}),
  });

  // Update rule effectiveness based on feedback
  await updateRuleEffectiveness(params.feedbackData, storage);

  return {
    title: "Feedback Recorded",
    metadata: {
      ruleId: params.feedbackData.ruleId,
      feedbackType: params.feedbackData.feedbackType,
      sessionId,
    },
    output: `Recorded ${params.feedbackData.feedbackType} feedback for rule ${params.feedbackData.ruleId}`,
  };
}

// Helper functions

function getTimeframeDays(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([dwmy])$/);
  if (!match) return 7; // Default to 7 days

  const [, amount, unit] = match;
  const num = parseInt(amount);

  switch (unit) {
    case "d": return num;
    case "w": return num * 7;
    case "m": return num * 30;
    case "y": return num * 365;
    default: return 7;
  }
}

function generateBehaviorId(actionType: string): string {
  return `${actionType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function extractLearningPatterns(
  behaviors: UserBehaviorPattern[],
  storage: MemoryStorage
): Promise<any[]> {
  const patterns: any[] = [];
  const db = (storage as any).db;

  // Group behaviors by type for pattern detection
  const behaviorGroups = behaviors.reduce((groups, behavior) => {
    if (!groups[behavior.actionType]) groups[behavior.actionType] = [];
    groups[behavior.actionType].push(behavior);
    return groups;
  }, {} as Record<string, UserBehaviorPattern[]>);

  // Extract command sequence patterns
  for (const [actionType, actionBehaviors] of Object.entries(behaviorGroups)) {
    if (actionBehaviors.length >= 3) {
      const pattern = {
        id: `pattern-${actionType}-${Date.now()}`,
        patternType: "command_sequence",
        pattern: `Frequent ${actionType} usage pattern`,
        frequency: actionBehaviors.length,
        confidence: Math.min(0.9, actionBehaviors.length / 10),
        lastSeen: actionBehaviors[0].timestamp,
        metadata: JSON.stringify({ actionType, samples: actionBehaviors.length }),
      };

      // Store pattern
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO learning_patterns 
        (id, patternType, pattern, frequency, confidence, lastSeen, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        pattern.id,
        pattern.patternType,
        pattern.pattern,
        pattern.frequency,
        pattern.confidence,
        pattern.lastSeen,
        pattern.metadata
      );

      patterns.push(pattern);
    }
  }

  return patterns;
}

async function generatePatternInsights(
  patterns: any[],
  behaviors: UserBehaviorPattern[]
): Promise<any[]> {
  const insights: any[] = [];

  // Analyze pattern effectiveness
  const effectivePatterns = patterns.filter(p => p.confidence > 0.7);
  if (effectivePatterns.length > 0) {
    insights.push({
      type: "pattern_discovery",
      insight: `Discovered ${effectivePatterns.length} high-confidence behavior patterns`,
      confidence: 0.8,
      actionable: true,
      suggestedActions: [
        "Create rules based on these patterns",
        "Set up automated workflows for common sequences"
      ],
    });
  }

  // Analyze behavior frequency
  const frequentBehaviors = behaviors.filter(b => 
    behaviors.filter(b2 => b2.actionType === b.actionType).length > 5
  );
  if (frequentBehaviors.length > 0) {
    insights.push({
      type: "workflow_improvement",
      insight: "Several actions are performed frequently and could benefit from optimization",
      confidence: 0.7,
      actionable: true,
      suggestedActions: [
        "Create shortcuts for frequent actions",
        "Consider automation for repetitive tasks"
      ],
    });
  }

  return insights;
}

async function generateContextualRuleSuggestions(
  patterns: any[],
  behaviors: UserBehaviorPattern[],
  context: any,
  existingTexts: Set<string>,
  maxSuggestions: number
): Promise<any[]> {
  const suggestions: any[] = [];

  // Analyze patterns for rule suggestions
  for (const pattern of patterns.slice(0, maxSuggestions)) {
    if (pattern.confidence < 0.6) continue;

    let ruleText = "";
    let category = "preferred";
    let reason = "";

    switch (pattern.patternType) {
      case "command_sequence":
        ruleText = `Optimize workflow for ${pattern.pattern}`;
        reason = `Based on frequent usage pattern (${pattern.frequency} occurrences)`;
        break;
      case "error_pattern":
        ruleText = `Prevent common error: ${pattern.pattern}`;
        category = "critical";
        reason = `Based on recurring error pattern`;
        break;
      case "context_pattern":
        ruleText = `Apply context-specific best practices for ${pattern.pattern}`;
        category = "contextual";
        reason = `Based on context-specific usage patterns`;
        break;
    }

    if (ruleText && !existingTexts.has(ruleText.toLowerCase())) {
      suggestions.push({
        text: ruleText,
        category,
        reason,
        confidence: pattern.confidence,
        patterns: [pattern.pattern],
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

async function generatePredictions(
  context: any,
  sessionContext: any,
  recentUsage: any[],
  similarContexts: UserBehaviorPattern[],
  storage: MemoryStorage
): Promise<any[]> {
  const predictions: any[] = [];

  // Predict next likely command based on patterns
  if (recentUsage.length > 0) {
    const lastAction = recentUsage[0];
    const similarFollowUps = similarContexts.filter(b => 
      b.actionType === lastAction.ruleId
    );

    if (similarFollowUps.length > 2) {
      predictions.push({
        type: "next_command",
        prediction: `Likely to use ${similarFollowUps[0].actionType} next`,
        confidence: Math.min(0.8, similarFollowUps.length / 10),
        reasoning: `Based on ${similarFollowUps.length} similar usage patterns`,
        context: JSON.stringify(context),
      });
    }
  }

  // Predict potential errors based on context
  if (context.errorMessages && context.errorMessages.length > 0) {
    predictions.push({
      type: "likely_error",
      prediction: "Similar error patterns detected in context",
      confidence: 0.7,
      reasoning: "Current context matches previous error scenarios",
      context: JSON.stringify(context),
    });
  }

  return predictions;
}

async function performBehaviorClustering(
  behaviors: UserBehaviorPattern[],
  storage: MemoryStorage
): Promise<any[]> {
  const clusters: any[] = [];
  const db = (storage as any).db;

  // Group by action type for basic clustering
  const actionGroups = behaviors.reduce((groups, behavior) => {
    if (!groups[behavior.actionType]) groups[behavior.actionType] = [];
    groups[behavior.actionType].push(behavior);
    return groups;
  }, {} as Record<string, UserBehaviorPattern[]>);

  // Create clusters
  for (const [actionType, actionBehaviors] of Object.entries(actionGroups)) {
    if (actionBehaviors.length >= 3) {
      const effectiveness = actionBehaviors
        .filter(b => b.effectiveness !== undefined)
        .reduce((sum, b) => sum + (b.effectiveness || 0), 0) / actionBehaviors.length || 0.5;

      const cluster = {
        id: `cluster-${actionType}-${Date.now()}`,
        clusterType: "workflow",
        behaviors: actionBehaviors.map(b => b.id),
        frequency: actionBehaviors.length,
        effectiveness,
        suggestions: generateClusterSuggestions(actionType, actionBehaviors),
      };

      // Store cluster
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO behavior_clusters 
        (id, clusterType, behaviors, frequency, effectiveness, suggestions)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        cluster.id,
        cluster.clusterType,
        JSON.stringify(cluster.behaviors),
        cluster.frequency,
        cluster.effectiveness,
        JSON.stringify(cluster.suggestions)
      );

      clusters.push(cluster);
    }
  }

  return clusters;
}

function generateClusterSuggestions(actionType: string, behaviors: UserBehaviorPattern[]): string[] {
  const suggestions: string[] = [];

  if (behaviors.length > 10) {
    suggestions.push(`Consider creating a shortcut for ${actionType} actions`);
  }

  const lowEffectiveness = behaviors.filter(b => (b.effectiveness || 0) < 0.5);
  if (lowEffectiveness.length > behaviors.length * 0.3) {
    suggestions.push(`Review and optimize ${actionType} workflow - low effectiveness detected`);
  }

  return suggestions;
}

async function generateClusterOptimizations(clusters: any[]): Promise<string[]> {
  const optimizations: string[] = [];

  for (const cluster of clusters) {
    if (cluster.effectiveness < 0.6) {
      optimizations.push(`Optimize ${cluster.clusterType} cluster - current effectiveness: ${Math.round(cluster.effectiveness * 100)}%`);
    }

    if (cluster.frequency > 20) {
      optimizations.push(`High-frequency ${cluster.clusterType} cluster could benefit from automation`);
    }
  }

  return optimizations;
}

async function generateFreshInsights(storage: MemoryStorage, _params: any): Promise<any[]> {
  const insights: any[] = [];
  const db = (storage as any).db;

  // Analyze rule effectiveness
  const rules = storage.getAllRules();
  const lowEffectivenessRules = rules.filter(r => {
    const analytics = JSON.parse(r.analytics || '{}');
    return analytics.effectivenessScore && analytics.effectivenessScore < 0.5;
  });

  if (lowEffectivenessRules.length > 0) {
    const insight = {
      id: `insight-effectiveness-${Date.now()}`,
      type: "rule_effectiveness",
      insight: `${lowEffectivenessRules.length} rules have low effectiveness scores`,
      confidence: 0.8,
      actionable: true,
      suggestedActions: JSON.stringify([
        "Review and update low-performing rules",
        "Consider deprecating unused rules"
      ]),
      createdAt: new Date().toISOString(),
      appliedAt: null,
    };

    // Store insight
    const stmt = db.prepare(`
      INSERT INTO learning_insights 
      (id, type, insight, confidence, actionable, suggestedActions, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      insight.id,
      insight.type,
      insight.insight,
      insight.confidence,
      insight.actionable ? 1 : 0,
      insight.suggestedActions,
      insight.createdAt
    );

    insights.push(insight);
  }

  return insights;
}

async function updateLearningPatterns(
  behaviorData: any,
  _context: any,
  storage: MemoryStorage
): Promise<void> {
  // Update existing patterns or create new ones based on behavior
  const db = (storage as any).db;
  
  // Check if similar pattern exists
  const existingPattern = db.prepare(`
    SELECT * FROM learning_patterns 
    WHERE patternType = 'command_sequence' AND pattern LIKE ?
  `).get(`%${behaviorData.actionType}%`);

  if (existingPattern) {
    // Update frequency
    db.prepare(`
      UPDATE learning_patterns 
      SET frequency = frequency + 1, lastSeen = ?
      WHERE id = ?
    `).run(new Date().toISOString(), existingPattern.id);
  }
}

async function updateRuleEffectiveness(
  feedbackData: any,
  storage: MemoryStorage
): Promise<void> {
  // Update rule analytics based on feedback
  const rule = storage.getRule(feedbackData.ruleId);
  if (!rule) return;

  const analytics = JSON.parse(rule.analytics || '{}');
  
  // Update effectiveness based on feedback type
  switch (feedbackData.feedbackType) {
    case "positive":
      analytics.effectivenessScore = Math.min(1, (analytics.effectivenessScore || 0.5) + 0.1);
      break;
    case "negative":
      analytics.effectivenessScore = Math.max(0, (analytics.effectivenessScore || 0.5) - 0.1);
      break;
    case "correction":
      analytics.effectivenessScore = Math.max(0, (analytics.effectivenessScore || 0.5) - 0.05);
      break;
  }

  // Update rule
  storage.updateRule(feedbackData.ruleId, {
    analytics: JSON.stringify(analytics),
  });
}

// Placeholder implementations for remaining actions
async function optimizeWorkflow(_storage: MemoryStorage, _params: any, _ctx: any) {
  return {
    title: "Workflow Optimization",
    metadata: {},
    output: "Workflow optimization analysis completed.",
  };
}

async function learnFromErrors(_storage: MemoryStorage, _params: any, _ctx: any) {
  return {
    title: "Error Learning",
    metadata: {},
    output: "Error pattern learning completed.",
  };
}

async function generateAdaptiveSuggestions(_storage: MemoryStorage, _params: any, _ctx: any) {
  return {
    title: "Adaptive Suggestions",
    metadata: {},
    output: "Adaptive suggestions generated.",
  };
}