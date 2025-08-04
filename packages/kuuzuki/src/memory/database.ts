import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import { randomUUID } from "crypto";

export interface ProjectInfo {
  id: number;
  name: string;
  type: string;
  created_at: string;
  last_active: string;
}

export interface RuleUsage {
  id: number;
  rule_id: string;
  action: "applied" | "suggested" | "ignored" | "created";
  context?: string;
  timestamp: string;
  session_id: string;
}

export interface Session {
  id: string;
  started_at: string;
  ended_at?: string;
  tools_used?: string;
  rules_applied: number;
  commands_run: number;
}

export interface UsageStat {
  id: number;
  stat_type: string;
  stat_data: string;
  timestamp: string;
}

export class ProjectDatabase {
  private db: Database.Database;
  private dbPath: string;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.dbPath = path.join(projectPath, ".kuuzuki", "memory.db");
    this.ensureDirectory();
    this.db = new Database(this.dbPath);
    this.initializeSchema();
    this.initializeProjectInfo();
  }

  private ensureDirectory(): void {
    const kuuzukiDir = path.join(this.projectPath, ".kuuzuki");
    if (!fs.existsSync(kuuzukiDir)) {
      fs.mkdirSync(kuuzukiDir, { recursive: true });
    }
  }

  private initializeSchema(): void {
    // Enable foreign keys
    this.db.pragma("foreign_keys = ON");

    // Project metadata
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_info (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rule usage tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rule_usage (
        id INTEGER PRIMARY KEY,
        rule_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('applied', 'suggested', 'ignored', 'created')),
        context TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT NOT NULL
      )
    `);

    // Session tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        tools_used TEXT,
        rules_applied INTEGER DEFAULT 0,
        commands_run INTEGER DEFAULT 0
      )
    `);

    // Basic usage statistics
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_stats (
        id INTEGER PRIMARY KEY,
        stat_type TEXT NOT NULL,
        stat_data TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_rule_usage_rule_id ON rule_usage(rule_id);
      CREATE INDEX IF NOT EXISTS idx_rule_usage_timestamp ON rule_usage(timestamp);
      CREATE INDEX IF NOT EXISTS idx_rule_usage_session ON rule_usage(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_usage_stats_type ON usage_stats(stat_type);
      CREATE INDEX IF NOT EXISTS idx_usage_stats_timestamp ON usage_stats(timestamp);
    `);
  }

  private initializeProjectInfo(): void {
    const existingProject = this.db
      .prepare("SELECT * FROM project_info LIMIT 1")
      .get() as ProjectInfo | undefined;

    if (!existingProject) {
      const projectName = path.basename(this.projectPath);
      const projectType = this.detectProjectType();

      this.db
        .prepare(
          `
        INSERT INTO project_info (name, type)
        VALUES (?, ?)
      `,
        )
        .run(projectName, projectType);
    } else {
      // Update last_active timestamp
      this.db
        .prepare(
          `
        UPDATE project_info 
        SET last_active = CURRENT_TIMESTAMP 
        WHERE id = ?
      `,
        )
        .run(existingProject.id);
    }
  }

  private detectProjectType(): string {
    const packageJsonPath = path.join(this.projectPath, "package.json");
    const goModPath = path.join(this.projectPath, "go.mod");
    const cargoTomlPath = path.join(this.projectPath, "Cargo.toml");
    const requirementsPath = path.join(this.projectPath, "requirements.txt");
    const pyprojectPath = path.join(this.projectPath, "pyproject.toml");

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );
        if (
          packageJson.dependencies?.typescript ||
          packageJson.devDependencies?.typescript
        ) {
          return "typescript";
        }
        return "javascript";
      } catch {
        return "javascript";
      }
    }

    if (fs.existsSync(goModPath)) return "go";
    if (fs.existsSync(cargoTomlPath)) return "rust";
    if (fs.existsSync(requirementsPath) || fs.existsSync(pyprojectPath))
      return "python";

    return "unknown";
  }

  // Rule usage tracking methods
  recordRuleUsage(
    ruleId: string,
    action: RuleUsage["action"],
    context?: string,
    sessionId?: string,
  ): void {
    const session = sessionId || this.getCurrentSessionId();

    this.db
      .prepare(
        `
      INSERT INTO rule_usage (rule_id, action, context, session_id)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(ruleId, action, context, session);
  }

  getRuleUsageStats(timeframe: string = "30d"): RuleUsage[] {
    const timeframeClause = this.getTimeframeClause(timeframe);

    return this.db
      .prepare(
        `
      SELECT * FROM rule_usage 
      WHERE timestamp >= ${timeframeClause}
      ORDER BY timestamp DESC
    `,
      )
      .all() as RuleUsage[];
  }

  getRuleUsageSummary(timeframe: string = "30d"): any[] {
    const timeframeClause = this.getTimeframeClause(timeframe);

    return this.db
      .prepare(
        `
      SELECT 
        rule_id,
        action,
        COUNT(*) as count,
        MAX(timestamp) as last_used
      FROM rule_usage 
      WHERE timestamp >= ${timeframeClause}
      GROUP BY rule_id, action
      ORDER BY count DESC
    `,
      )
      .all();
  }

  // Session management methods
  startSession(): string {
    const sessionId = randomUUID();

    this.db
      .prepare(
        `
      INSERT INTO sessions (id)
      VALUES (?)
    `,
      )
      .run(sessionId);

    return sessionId;
  }

  endSession(sessionId: string): void {
    // Update rules_applied count
    const rulesApplied = this.db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM rule_usage 
      WHERE session_id = ? AND action = 'applied'
    `,
      )
      .get(sessionId) as { count: number };

    this.db
      .prepare(
        `
      UPDATE sessions 
      SET ended_at = CURRENT_TIMESTAMP,
          rules_applied = ?
      WHERE id = ?
    `,
      )
      .run(rulesApplied.count, sessionId);
  }

  updateSessionToolsUsed(sessionId: string, tools: string[]): void {
    this.db
      .prepare(
        `
      UPDATE sessions 
      SET tools_used = ?
      WHERE id = ?
    `,
      )
      .run(JSON.stringify(tools), sessionId);
  }

  incrementSessionCommands(sessionId: string): void {
    this.db
      .prepare(
        `
      UPDATE sessions 
      SET commands_run = commands_run + 1
      WHERE id = ?
    `,
      )
      .run(sessionId);
  }

  getRecentSessions(limit: number = 10): Session[] {
    return this.db
      .prepare(
        `
      SELECT * FROM sessions 
      ORDER BY started_at DESC 
      LIMIT ?
    `,
      )
      .all(limit) as Session[];
  }

  getCurrentSessionId(): string {
    const session = this.db
      .prepare(
        `
      SELECT id FROM sessions 
      WHERE ended_at IS NULL 
      ORDER BY started_at DESC 
      LIMIT 1
    `,
      )
      .get() as { id: string } | undefined;

    if (session) {
      return session.id;
    }

    // Create new session if none exists
    return this.startSession();
  }

  // Usage statistics methods
  recordUsageStat(statType: string, data: any): void {
    this.db
      .prepare(
        `
      INSERT INTO usage_stats (stat_type, stat_data)
      VALUES (?, ?)
    `,
      )
      .run(statType, JSON.stringify(data));
  }

  getUsageStats(statType?: string, timeframe: string = "30d"): UsageStat[] {
    const timeframeClause = this.getTimeframeClause(timeframe);

    if (statType) {
      return this.db
        .prepare(
          `
        SELECT * FROM usage_stats 
        WHERE stat_type = ? AND timestamp >= ${timeframeClause}
        ORDER BY timestamp DESC
      `,
        )
        .all(statType) as UsageStat[];
    }

    return this.db
      .prepare(
        `
      SELECT * FROM usage_stats 
      WHERE timestamp >= ${timeframeClause}
      ORDER BY timestamp DESC
    `,
      )
      .all() as UsageStat[];
  }

  // Database statistics and export methods
  getDatabaseStats(): any {
    const stats = {
      projectInfo: this.db
        .prepare("SELECT * FROM project_info LIMIT 1")
        .get() as ProjectInfo,
      totalRuleUsage: this.db
        .prepare("SELECT COUNT(*) as count FROM rule_usage")
        .get() as { count: number },
      totalSessions: this.db
        .prepare("SELECT COUNT(*) as count FROM sessions")
        .get() as { count: number },
      totalUsageStats: this.db
        .prepare("SELECT COUNT(*) as count FROM usage_stats")
        .get() as { count: number },
      activeSessions: this.db
        .prepare(
          "SELECT COUNT(*) as count FROM sessions WHERE ended_at IS NULL",
        )
        .get() as { count: number },
      recentActivity: this.db
        .prepare(
          `
        SELECT DATE(timestamp) as date, COUNT(*) as count 
        FROM rule_usage 
        WHERE timestamp >= datetime('now', '-7 days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `,
        )
        .all(),
      topRules: this.db
        .prepare(
          `
        SELECT rule_id, COUNT(*) as usage_count
        FROM rule_usage 
        WHERE timestamp >= datetime('now', '-30 days')
        GROUP BY rule_id
        ORDER BY usage_count DESC
        LIMIT 10
      `,
        )
        .all(),
      dbSize: this.getDatabaseSize(),
    };

    return stats;
  }

  exportAllData(): any {
    return {
      projectInfo: this.db.prepare("SELECT * FROM project_info").all(),
      ruleUsage: this.db
        .prepare("SELECT * FROM rule_usage ORDER BY timestamp DESC")
        .all(),
      sessions: this.db
        .prepare("SELECT * FROM sessions ORDER BY started_at DESC")
        .all(),
      usageStats: this.db
        .prepare("SELECT * FROM usage_stats ORDER BY timestamp DESC")
        .all(),
      exportedAt: new Date().toISOString(),
      totalRecords: this.db
        .prepare(
          `
        SELECT 
          (SELECT COUNT(*) FROM rule_usage) +
          (SELECT COUNT(*) FROM sessions) +
          (SELECT COUNT(*) FROM usage_stats) as total
      `,
        )
        .get() as { total: number },
    };
  }

  private getDatabaseSize(): number {
    try {
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private getTimeframeClause(timeframe: string): string {
    const match = timeframe.match(/^(\d+)([dwmy])$/);
    if (!match) return "datetime('now', '-30 days')";

    const [, amount, unit] = match;
    const unitMap = {
      d: "days",
      w: "days",
      m: "days",
      y: "days",
    };

    let days = parseInt(amount);
    if (unit === "w") days *= 7;
    if (unit === "m") days *= 30;
    if (unit === "y") days *= 365;

    return `datetime('now', '-${days} days')`;
  }

  // Cleanup and maintenance
  close(): void {
    this.db.close();
  }

  vacuum(): void {
    this.db.exec("VACUUM");
  }

  // Backup functionality
  backup(backupPath: string): void {
    this.db.backup(backupPath);
  }
}
