import { Database } from "bun:sqlite";
import * as path from "path";
import { App } from "../app/app";
import { QueryCache } from "./query-cache";
import { DatabaseMigrator } from "./database-migrator";

// Database schema interfaces
export interface RuleRecord {
  id: string;
  text: string;
  category: "critical" | "preferred" | "contextual" | "deprecated";
  filePath?: string;
  reason?: string;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  analytics: string; // JSON string
  documentationLinks: string; // JSON string
  tags: string; // JSON string
}

export interface SessionContext {
  sessionId: string;
  workingDirectory: string;
  fileTypes: string; // JSON array
  recentFiles: string; // JSON array
  lastActivity: string;
  contextData: string; // JSON object
}

export interface RuleUsage {
  id: number;
  ruleId: string;
  sessionId: string;
  timestamp: string;
  context: string;
  effectiveness?: number;
}

// Smart AI Tools interfaces
export interface CodePattern {
  id: string;
  patternType: "function" | "class" | "import" | "variable" | "structure";
  pattern: string; // The actual pattern (e.g., function signature, import statement)
  filePath: string;
  language: string;
  frequency: number;
  lastSeen: string;
  confidence: number; // 0-1 confidence score
  metadata: string; // JSON string with additional pattern data
}

export interface PatternRule {
  id: string;
  patternId: string;
  ruleId: string;
  confidence: number;
  createdAt: string;
  validatedBy?: string; // User who validated this pattern-rule connection
}

export interface LearningFeedback {
  id: number;
  ruleId: string;
  sessionId: string;
  feedbackType: "positive" | "negative" | "correction";
  originalSuggestion: string;
  userCorrection?: string;
  timestamp: string;
  context: string; // JSON string with context data
}

export interface RuleOptimization {
  id: string;
  ruleId: string;
  optimizationType: "consolidate" | "split" | "deprecate" | "enhance";
  suggestion: string;
  confidence: number;
  createdAt: string;
  appliedAt?: string;
  status: "pending" | "applied" | "rejected";
}

export class MemoryStorage {
  protected db: Database;
  private static instance: MemoryStorage | null = null;
  private cache: QueryCache;
  private migrator: DatabaseMigrator;

  protected constructor(customDbPath?: string) {
    let dbPath: string;

    if (customDbPath) {
      dbPath = customDbPath;
    } else {
      try {
        const app = App.info();
        dbPath = path.join(app.path.root, ".kuuzuki", "memory.db");
      } catch (error) {
        // Fallback for testing or when App context is not available
        dbPath = path.join(process.cwd(), ".kuuzuki", "memory.db");
      }
    }

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!require("fs").existsSync(dbDir)) {
      require("fs").mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.cache = new QueryCache(200, 300000); // 200 entries, 5 min TTL
    this.migrator = new DatabaseMigrator(this.db);
    this.initializeSchema();
    this.runMigrations();
  }

  public static getInstance(customDbPath?: string): MemoryStorage {
    if (!MemoryStorage.instance) {
      MemoryStorage.instance = new MemoryStorage(customDbPath);
    }
    return MemoryStorage.instance;
  }

  /**
   * Create a new instance for testing (bypasses singleton)
   */
  public static createTestInstance(dbPath: string): MemoryStorage {
    return new MemoryStorage(dbPath);
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    try {
      await this.migrator.migrate();
    } catch (error) {
      console.warn("Database migration failed:", error);
    }
  }

  private initializeSchema(): void {
    // Enable foreign keys
    this.db.exec("PRAGMA foreign_keys = ON");

    // Create rules table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('critical', 'preferred', 'contextual', 'deprecated')),
        filePath TEXT,
        reason TEXT,
        createdAt TEXT NOT NULL,
        lastUsed TEXT,
        usageCount INTEGER DEFAULT 0,
        analytics TEXT DEFAULT '{}',
        documentationLinks TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]'
      )
    `);

    // Create session contexts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_contexts (
        sessionId TEXT PRIMARY KEY,
        workingDirectory TEXT NOT NULL,
        fileTypes TEXT DEFAULT '[]',
        recentFiles TEXT DEFAULT '[]',
        lastActivity TEXT NOT NULL,
        contextData TEXT DEFAULT '{}'
      )
    `);

    // Create rule usage tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rule_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ruleId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        context TEXT,
        effectiveness REAL,
        FOREIGN KEY (ruleId) REFERENCES rules (id) ON DELETE CASCADE
      )
    `);

    // Create Smart AI Tools tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_patterns (
        id TEXT PRIMARY KEY,
        patternType TEXT NOT NULL CHECK (patternType IN ('function', 'class', 'import', 'variable', 'structure')),
        pattern TEXT NOT NULL,
        filePath TEXT NOT NULL,
        language TEXT NOT NULL,
        frequency INTEGER DEFAULT 1,
        lastSeen TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        metadata TEXT DEFAULT '{}'
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pattern_rules (
        id TEXT PRIMARY KEY,
        patternId TEXT NOT NULL,
        ruleId TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        createdAt TEXT NOT NULL,
        validatedBy TEXT,
        FOREIGN KEY (patternId) REFERENCES code_patterns (id) ON DELETE CASCADE,
        FOREIGN KEY (ruleId) REFERENCES rules (id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ruleId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        feedbackType TEXT NOT NULL CHECK (feedbackType IN ('positive', 'negative', 'correction')),
        originalSuggestion TEXT NOT NULL,
        userCorrection TEXT,
        timestamp TEXT NOT NULL,
        context TEXT DEFAULT '{}',
        FOREIGN KEY (ruleId) REFERENCES rules (id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rule_optimizations (
        id TEXT PRIMARY KEY,
        ruleId TEXT NOT NULL,
        optimizationType TEXT NOT NULL CHECK (optimizationType IN ('consolidate', 'split', 'deprecate', 'enhance')),
        suggestion TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        createdAt TEXT NOT NULL,
        appliedAt TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected')),
        FOREIGN KEY (ruleId) REFERENCES rules (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_rules_category ON rules (category);
      CREATE INDEX IF NOT EXISTS idx_rules_lastUsed ON rules (lastUsed);
      CREATE INDEX IF NOT EXISTS idx_rules_usageCount ON rules (usageCount);
      CREATE INDEX IF NOT EXISTS idx_usage_ruleId ON rule_usage (ruleId);
      CREATE INDEX IF NOT EXISTS idx_usage_sessionId ON rule_usage (sessionId);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON rule_usage (timestamp);
      
      -- Smart AI Tools indexes
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON code_patterns (patternType);
      CREATE INDEX IF NOT EXISTS idx_patterns_language ON code_patterns (language);
      CREATE INDEX IF NOT EXISTS idx_patterns_frequency ON code_patterns (frequency);
      CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON code_patterns (confidence);
      CREATE INDEX IF NOT EXISTS idx_pattern_rules_pattern ON pattern_rules (patternId);
      CREATE INDEX IF NOT EXISTS idx_pattern_rules_rule ON pattern_rules (ruleId);
      CREATE INDEX IF NOT EXISTS idx_feedback_rule ON learning_feedback (ruleId);
      CREATE INDEX IF NOT EXISTS idx_feedback_session ON learning_feedback (sessionId);
      CREATE INDEX IF NOT EXISTS idx_feedback_type ON learning_feedback (feedbackType);
      CREATE INDEX IF NOT EXISTS idx_optimizations_rule ON rule_optimizations (ruleId);
      CREATE INDEX IF NOT EXISTS idx_optimizations_status ON rule_optimizations (status);
    `);
  }

  // Rule management methods
  public addRule(rule: Omit<RuleRecord, "createdAt" | "usageCount">): void {
    const stmt = this.db.prepare(`
      INSERT INTO rules (id, text, category, filePath, reason, createdAt, usageCount, analytics, documentationLinks, tags)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `);

    stmt.run(
      rule.id,
      rule.text,
      rule.category,
      rule.filePath || null,
      rule.reason || null,
      new Date().toISOString(),
      rule.analytics,
      rule.documentationLinks,
      rule.tags,
    );
  }

  public updateRule(id: string, updates: Partial<RuleRecord>): boolean {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return false;

    values.push(id);
    const stmt = this.db.prepare(
      `UPDATE rules SET ${fields.join(", ")} WHERE id = ?`,
    );
    const result = stmt.run(...values);

    return result.changes > 0;
  }

  public removeRule(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM rules WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public getRule(id: string): RuleRecord | null {
    const stmt = this.db.prepare("SELECT * FROM rules WHERE id = ?");
    return stmt.get(id) as RuleRecord | null;
  }

  public getRulesByCategory(
    category?: string,
    limit?: number,
    offset?: number,
  ): RuleRecord[] {
    const cacheKey = QueryCache.generateKey("rules_by_category", {
      category,
      limit,
      offset,
    });
    const cached = this.cache.get<RuleRecord[]>(cacheKey);

    if (cached) {
      return cached;
    }

    let query: string;
    let params: any[];

    if (category) {
      query =
        "SELECT * FROM rules WHERE category = ? ORDER BY usageCount DESC, lastUsed DESC";
      params = [category];
    } else {
      query =
        "SELECT * FROM rules ORDER BY category, usageCount DESC, lastUsed DESC";
      params = [];
    }

    if (limit) {
      query += " LIMIT ?";
      params.push(limit);

      if (offset) {
        query += " OFFSET ?";
        params.push(offset);
      }
    }

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as RuleRecord[];

    this.cache.set(cacheKey, results);
    return results;
  }

  public searchRules(query: string): RuleRecord[] {
    const cacheKey = QueryCache.generateKey("search", { query });
    const cached = this.cache.get<RuleRecord[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const stmt = this.db.prepare(`
      SELECT * FROM rules 
      WHERE text LIKE ? OR reason LIKE ? OR tags LIKE ?
      ORDER BY usageCount DESC, lastUsed DESC
    `);
    const searchTerm = `%${query}%`;
    const results = stmt.all(
      searchTerm,
      searchTerm,
      searchTerm,
    ) as RuleRecord[];

    this.cache.set(cacheKey, results);
    return results;
  }

  public getMostUsedRules(limit: number = 10): RuleRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM rules 
      WHERE usageCount > 0 
      ORDER BY usageCount DESC, lastUsed DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as RuleRecord[];
  }

  public getUnusedRules(olderThanDays: number = 30): RuleRecord[] {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM rules 
      WHERE usageCount = 0 AND createdAt < ?
      ORDER BY createdAt ASC
    `);
    return stmt.all(cutoffDate) as RuleRecord[];
  }

  public getAllRules(): RuleRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM rules 
      ORDER BY category, usageCount DESC, lastUsed DESC
    `);
    return stmt.all() as RuleRecord[];
  }

  // Public method for context history operations
  public storeContextHistory(timestamp: string, context: any, activatedRules: string[], analysis: any): void {
    // First ensure the context_history table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        context_data TEXT NOT NULL,
        activated_rules TEXT NOT NULL,
        analysis_data TEXT,
        effectiveness REAL DEFAULT 0.5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const stmt = this.db.prepare(`
      INSERT INTO context_history (timestamp, context_data, activated_rules, analysis_data)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(
      timestamp,
      JSON.stringify(context),
      JSON.stringify(activatedRules),
      JSON.stringify(analysis)
    );
  }

  public getContextHistory(limit: number = 20): Array<{
    timestamp: string;
    context: any;
    activatedRules: string[];
    effectiveness: number;
  }> {
    // First ensure the context_history table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        context_data TEXT NOT NULL,
        activated_rules TEXT NOT NULL,
        analysis_data TEXT,
        effectiveness REAL DEFAULT 0.5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const stmt = this.db.prepare(`
      SELECT timestamp, context_data, activated_rules, effectiveness
      FROM context_history 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      timestamp: string;
      context_data: string;
      activated_rules: string;
      effectiveness: number;
    }>;

    return rows.map((row) => ({
      timestamp: row.timestamp,
      context: JSON.parse(row.context_data),
      activatedRules: JSON.parse(row.activated_rules),
      effectiveness: row.effectiveness || 0.5
    }));
  }

  // Session context methods
  public updateSessionContext(context: SessionContext): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_contexts 
      (sessionId, workingDirectory, fileTypes, recentFiles, lastActivity, contextData)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      context.sessionId,
      context.workingDirectory,
      context.fileTypes,
      context.recentFiles,
      context.lastActivity,
      context.contextData,
    );
  }

  public getSessionContext(sessionId: string): SessionContext | null {
    const stmt = this.db.prepare(
      "SELECT * FROM session_contexts WHERE sessionId = ?",
    );
    return stmt.get(sessionId) as SessionContext | null;
  }

  public getRecentSessions(limit: number = 10): SessionContext[] {
    const stmt = this.db.prepare(`
      SELECT * FROM session_contexts 
      ORDER BY lastActivity DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as SessionContext[];
  }

  // Rule usage tracking methods
  public recordRuleUsage(
    ruleId: string,
    sessionId: string,
    context?: string,
    effectiveness?: number,
  ): void {
    // Record usage
    const usageStmt = this.db.prepare(`
      INSERT INTO rule_usage (ruleId, sessionId, timestamp, context, effectiveness)
      VALUES (?, ?, ?, ?, ?)
    `);

    usageStmt.run(
      ruleId,
      sessionId,
      new Date().toISOString(),
      context || null,
      effectiveness || null,
    );

    // Update rule usage count and last used
    const updateStmt = this.db.prepare(`
      UPDATE rules 
      SET usageCount = usageCount + 1, lastUsed = ?
      WHERE id = ?
    `);

    updateStmt.run(new Date().toISOString(), ruleId);
  }

  public getRuleUsageHistory(ruleId: string, limit: number = 50): RuleUsage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM rule_usage 
      WHERE ruleId = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(ruleId, limit) as RuleUsage[];
  }

  public getSessionUsageHistory(
    sessionId: string,
    limit: number = 50,
  ): RuleUsage[] {
    const stmt = this.db.prepare(`
      SELECT ru.*, r.text as ruleText, r.category 
      FROM rule_usage ru
      JOIN rules r ON ru.ruleId = r.id
      WHERE ru.sessionId = ? 
      ORDER BY ru.timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(sessionId, limit) as RuleUsage[];
  }

  // Analytics methods
  public getRuleAnalytics(timeframeDays: number = 30): {
    totalRules: number;
    usedRules: number;
    recentlyUsed: number;
    categoryStats: Record<string, number>;
    topUsed: Array<{ id: string; text: string; usageCount: number }>;
    leastUsed: Array<{ id: string; text: string; createdAt: string }>;
  } {
    const cutoffDate = new Date(
      Date.now() - timeframeDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Total rules
    const totalRules = this.db
      .prepare("SELECT COUNT(*) as count FROM rules")
      .get() as { count: number };

    // Used rules
    const usedRules = this.db
      .prepare("SELECT COUNT(*) as count FROM rules WHERE usageCount > 0")
      .get() as { count: number };

    // Recently used
    const recentlyUsed = this.db
      .prepare("SELECT COUNT(*) as count FROM rules WHERE lastUsed > ?")
      .get(cutoffDate) as { count: number };

    // Category stats
    const categoryStats = this.db
      .prepare(
        `
      SELECT category, COUNT(*) as count 
      FROM rules 
      GROUP BY category
    `,
      )
      .all() as Array<{ category: string; count: number }>;

    // Top used
    const topUsed = this.db
      .prepare(
        `
      SELECT id, text, usageCount 
      FROM rules 
      WHERE usageCount > 0 
      ORDER BY usageCount DESC 
      LIMIT 5
    `,
      )
      .all() as Array<{ id: string; text: string; usageCount: number }>;

    // Least used
    const leastUsed = this.db
      .prepare(
        `
      SELECT id, text, createdAt 
      FROM rules 
      WHERE usageCount = 0 
      ORDER BY createdAt ASC 
      LIMIT 5
    `,
      )
      .all() as Array<{ id: string; text: string; createdAt: string }>;

    return {
      totalRules: totalRules.count,
      usedRules: usedRules.count,
      recentlyUsed: recentlyUsed.count,
      categoryStats: categoryStats.reduce(
        (acc, { category, count }) => {
          acc[category] = count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      topUsed,
      leastUsed,
    };
  }

  // Cleanup methods
  public cleanupOldUsageData(olderThanDays: number = 90): number {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const stmt = this.db.prepare("DELETE FROM rule_usage WHERE timestamp < ?");
    const result = stmt.run(cutoffDate);
    return result.changes;
  }

  public cleanupOldSessions(olderThanDays: number = 30): number {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const stmt = this.db.prepare(
      "DELETE FROM session_contexts WHERE lastActivity < ?",
    );
    const result = stmt.run(cutoffDate);
    return result.changes;
  }

  // Database maintenance
  public vacuum(): void {
    this.db.exec("VACUUM");
  }

  public close(): void {
    this.db.close();
  }

  // Smart AI Tools methods
  
  // Code Pattern Management
  public addCodePattern(pattern: Omit<CodePattern, "frequency" | "lastSeen">): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO code_patterns 
      (id, patternType, pattern, filePath, language, frequency, lastSeen, confidence, metadata)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);

    stmt.run(
      pattern.id,
      pattern.patternType,
      pattern.pattern,
      pattern.filePath,
      pattern.language,
      new Date().toISOString(),
      pattern.confidence,
      pattern.metadata,
    );
  }

  public updatePatternFrequency(patternId: string): void {
    const stmt = this.db.prepare(`
      UPDATE code_patterns 
      SET frequency = frequency + 1, lastSeen = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), patternId);
  }

  public getCodePatterns(
    language?: string,
    patternType?: string,
    minConfidence?: number,
  ): CodePattern[] {
    let query = "SELECT * FROM code_patterns WHERE 1=1";
    const params: any[] = [];

    if (language) {
      query += " AND language = ?";
      params.push(language);
    }

    if (patternType) {
      query += " AND patternType = ?";
      params.push(patternType);
    }

    if (minConfidence !== undefined) {
      query += " AND confidence >= ?";
      params.push(minConfidence);
    }

    query += " ORDER BY frequency DESC, confidence DESC";

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as CodePattern[];
  }

  public getPatternsByFile(filePath: string): CodePattern[] {
    const stmt = this.db.prepare(
      "SELECT * FROM code_patterns WHERE filePath = ? ORDER BY frequency DESC",
    );
    return stmt.all(filePath) as CodePattern[];
  }

  // Pattern-Rule Associations
  public linkPatternToRule(
    patternId: string,
    ruleId: string,
    confidence: number,
    validatedBy?: string,
  ): void {
    const id = `${patternId}-${ruleId}`;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pattern_rules 
      (id, patternId, ruleId, confidence, createdAt, validatedBy)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      patternId,
      ruleId,
      confidence,
      new Date().toISOString(),
      validatedBy || null,
    );
  }

  public getPatternRules(patternId: string): PatternRule[] {
    const stmt = this.db.prepare(
      "SELECT * FROM pattern_rules WHERE patternId = ? ORDER BY confidence DESC",
    );
    return stmt.all(patternId) as PatternRule[];
  }

  public getRulePatterns(ruleId: string): PatternRule[] {
    const stmt = this.db.prepare(
      "SELECT * FROM pattern_rules WHERE ruleId = ? ORDER BY confidence DESC",
    );
    return stmt.all(ruleId) as PatternRule[];
  }

  // Learning Feedback
  public recordLearningFeedback(feedback: Omit<LearningFeedback, "id" | "timestamp">): void {
    const stmt = this.db.prepare(`
      INSERT INTO learning_feedback 
      (ruleId, sessionId, feedbackType, originalSuggestion, userCorrection, timestamp, context)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      feedback.ruleId,
      feedback.sessionId,
      feedback.feedbackType,
      feedback.originalSuggestion,
      feedback.userCorrection || null,
      new Date().toISOString(),
      feedback.context,
    );
  }

  public getLearningFeedback(
    ruleId?: string,
    sessionId?: string,
    limit: number = 50,
  ): LearningFeedback[] {
    let query = "SELECT * FROM learning_feedback WHERE 1=1";
    const params: any[] = [];

    if (ruleId) {
      query += " AND ruleId = ?";
      params.push(ruleId);
    }

    if (sessionId) {
      query += " AND sessionId = ?";
      params.push(sessionId);
    }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as LearningFeedback[];
  }

  // Rule Optimizations
  public addRuleOptimization(optimization: Omit<RuleOptimization, "createdAt" | "status">): void {
    const stmt = this.db.prepare(`
      INSERT INTO rule_optimizations 
      (id, ruleId, optimizationType, suggestion, confidence, createdAt, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);

    stmt.run(
      optimization.id,
      optimization.ruleId,
      optimization.optimizationType,
      optimization.suggestion,
      optimization.confidence,
      new Date().toISOString(),
    );
  }

  public getRuleOptimizations(
    ruleId?: string,
    status?: string,
    limit: number = 50,
  ): RuleOptimization[] {
    let query = "SELECT * FROM rule_optimizations WHERE 1=1";
    const params: any[] = [];

    if (ruleId) {
      query += " AND ruleId = ?";
      params.push(ruleId);
    }

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY confidence DESC, createdAt DESC LIMIT ?";
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as RuleOptimization[];
  }

  public updateOptimizationStatus(
    optimizationId: string,
    status: "applied" | "rejected",
  ): boolean {
    const stmt = this.db.prepare(`
      UPDATE rule_optimizations 
      SET status = ?, appliedAt = ?
      WHERE id = ?
    `);
    const result = stmt.run(
      status,
      status === "applied" ? new Date().toISOString() : null,
      optimizationId,
    );
    return result.changes > 0;
  }

  // Smart Analytics
  public getPatternAnalytics(): {
    totalPatterns: number;
    patternsByLanguage: Record<string, number>;
    patternsByType: Record<string, number>;
    topPatterns: Array<{ id: string; pattern: string; frequency: number }>;
  } {
    const totalPatterns = this.db
      .prepare("SELECT COUNT(*) as count FROM code_patterns")
      .get() as { count: number };

    const patternsByLanguage = this.db
      .prepare("SELECT language, COUNT(*) as count FROM code_patterns GROUP BY language")
      .all() as Array<{ language: string; count: number }>;

    const patternsByType = this.db
      .prepare("SELECT patternType, COUNT(*) as count FROM code_patterns GROUP BY patternType")
      .all() as Array<{ patternType: string; count: number }>;

    const topPatterns = this.db
      .prepare(`
        SELECT id, pattern, frequency 
        FROM code_patterns 
        ORDER BY frequency DESC 
        LIMIT 10
      `)
      .all() as Array<{ id: string; pattern: string; frequency: number }>;

    return {
      totalPatterns: totalPatterns.count,
      patternsByLanguage: patternsByLanguage.reduce(
        (acc, { language, count }) => {
          acc[language] = count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      patternsByType: patternsByType.reduce(
        (acc, { patternType, count }) => {
          acc[patternType] = count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      topPatterns,
    };
  }

  public getLearningAnalytics(): {
    totalFeedback: number;
    feedbackByType: Record<string, number>;
    improvementRate: number;
    topCorrectedRules: Array<{ ruleId: string; corrections: number }>;
  } {
    const totalFeedback = this.db
      .prepare("SELECT COUNT(*) as count FROM learning_feedback")
      .get() as { count: number };

    const feedbackByType = this.db
      .prepare("SELECT feedbackType, COUNT(*) as count FROM learning_feedback GROUP BY feedbackType")
      .all() as Array<{ feedbackType: string; count: number }>;

    const positiveCount = feedbackByType.find(f => f.feedbackType === 'positive')?.count || 0;
    const improvementRate = totalFeedback.count > 0 ? positiveCount / totalFeedback.count : 0;

    const topCorrectedRules = this.db
      .prepare(`
        SELECT ruleId, COUNT(*) as corrections 
        FROM learning_feedback 
        WHERE feedbackType = 'correction'
        GROUP BY ruleId 
        ORDER BY corrections DESC 
        LIMIT 5
      `)
      .all() as Array<{ ruleId: string; corrections: number }>;

    return {
      totalFeedback: totalFeedback.count,
      feedbackByType: feedbackByType.reduce(
        (acc, { feedbackType, count }) => {
          acc[feedbackType] = count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      improvementRate,
      topCorrectedRules,
    };
  }

  // Migration from .agentrc
  public migrateFromAgentRc(rules: any): number {
    let migratedCount = 0;

    const transaction = this.db.transaction(() => {
      for (const [category, categoryRules] of Object.entries(rules)) {
        if (!Array.isArray(categoryRules)) continue;

        for (const rule of categoryRules as any[]) {
          try {
            this.addRule({
              id: rule.id,
              text: rule.text,
              category: rule.category || category,
              filePath: rule.filePath,
              reason: rule.reason,
              lastUsed: rule.lastUsed,
              analytics: JSON.stringify(rule.analytics || {}),
              documentationLinks: JSON.stringify(rule.documentationLinks || []),
              tags: JSON.stringify(rule.tags || []),
            });
            migratedCount++;
          } catch (error) {
            // Skip duplicates or invalid rules
            console.warn(`Failed to migrate rule ${rule.id}:`, error);
          }
        }
      }
    });

    transaction();
    return migratedCount;
  }
}
