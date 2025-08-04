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

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_rules_category ON rules (category);
      CREATE INDEX IF NOT EXISTS idx_rules_lastUsed ON rules (lastUsed);
      CREATE INDEX IF NOT EXISTS idx_rules_usageCount ON rules (usageCount);
      CREATE INDEX IF NOT EXISTS idx_usage_ruleId ON rule_usage (ruleId);
      CREATE INDEX IF NOT EXISTS idx_usage_sessionId ON rule_usage (sessionId);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON rule_usage (timestamp);
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
