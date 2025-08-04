import { Database } from "bun:sqlite";

/**
 * Database migration system for SQLite memory storage
 * Handles schema versioning and automatic migrations
 */
export class DatabaseMigrator {
  private db: Database;
  private currentVersion = 2; // Increment when adding new migrations

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Initialize version tracking and run any pending migrations
   */
  async migrate(): Promise<void> {
    this.ensureVersionTable();
    const currentDbVersion = this.getDatabaseVersion();

    if (currentDbVersion < this.currentVersion) {
      console.log(
        `Migrating database from version ${currentDbVersion} to ${this.currentVersion}`,
      );
      await this.runMigrations(currentDbVersion);
      this.setDatabaseVersion(this.currentVersion);
      console.log("Database migration completed successfully");
    }
  }

  /**
   * Create the version tracking table if it doesn't exist
   */
  private ensureVersionTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Insert initial version if table is empty
    const versionExists = this.db
      .prepare("SELECT COUNT(*) as count FROM schema_version")
      .get() as { count: number };
    if (versionExists.count === 0) {
      this.db
        .prepare(
          `
        INSERT INTO schema_version (id, version, updated_at) 
        VALUES (1, 1, ?)
      `,
        )
        .run(new Date().toISOString());
    }
  }

  /**
   * Get current database version
   */
  private getDatabaseVersion(): number {
    const result = this.db
      .prepare("SELECT version FROM schema_version WHERE id = 1")
      .get() as { version: number } | null;
    return result?.version || 1;
  }

  /**
   * Set database version
   */
  private setDatabaseVersion(version: number): void {
    this.db
      .prepare(
        `
      UPDATE schema_version 
      SET version = ?, updated_at = ? 
      WHERE id = 1
    `,
      )
      .run(version, new Date().toISOString());
  }

  /**
   * Run all migrations from the current version to the latest
   */
  private async runMigrations(fromVersion: number): Promise<void> {
    const migrations = this.getMigrations();

    for (
      let version = fromVersion + 1;
      version <= this.currentVersion;
      version++
    ) {
      const migration = migrations[version];
      if (migration) {
        console.log(
          `Running migration to version ${version}: ${migration.description}`,
        );
        try {
          await migration.up(this.db);
          console.log(`Migration to version ${version} completed`);
        } catch (error) {
          console.error(`Migration to version ${version} failed:`, error);
          throw new Error(`Migration failed at version ${version}: ${error}`);
        }
      }
    }
  }

  /**
   * Define all available migrations
   */
  private getMigrations(): Record<number, Migration> {
    return {
      2: {
        description: "Add full-text search support and performance indexes",
        up: async (db: Database) => {
          // Add full-text search virtual table
          db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS rules_fts USING fts5(
              id UNINDEXED,
              text,
              reason,
              tags,
              content='rules',
              content_rowid='rowid'
            )
          `);

          // Populate FTS table with existing data
          db.exec(`
            INSERT INTO rules_fts(id, text, reason, tags)
            SELECT id, text, reason, tags FROM rules
          `);

          // Add triggers to keep FTS table in sync
          db.exec(`
            CREATE TRIGGER IF NOT EXISTS rules_fts_insert AFTER INSERT ON rules BEGIN
              INSERT INTO rules_fts(id, text, reason, tags) 
              VALUES (new.id, new.text, new.reason, new.tags);
            END
          `);

          db.exec(`
            CREATE TRIGGER IF NOT EXISTS rules_fts_delete AFTER DELETE ON rules BEGIN
              DELETE FROM rules_fts WHERE id = old.id;
            END
          `);

          db.exec(`
            CREATE TRIGGER IF NOT EXISTS rules_fts_update AFTER UPDATE ON rules BEGIN
              DELETE FROM rules_fts WHERE id = old.id;
              INSERT INTO rules_fts(id, text, reason, tags) 
              VALUES (new.id, new.text, new.reason, new.tags);
            END
          `);

          // Add composite indexes for better query performance
          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_rules_category_usage ON rules (category, usageCount DESC);
            CREATE INDEX IF NOT EXISTS idx_rules_created_usage ON rules (createdAt, usageCount);
            CREATE INDEX IF NOT EXISTS idx_usage_session_timestamp ON rule_usage (sessionId, timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_sessions_activity ON session_contexts (lastActivity DESC);
          `);

          // Add effectiveness tracking columns
          db.exec(`
            ALTER TABLE rules ADD COLUMN effectiveness_score REAL DEFAULT 0.0;
            ALTER TABLE rules ADD COLUMN last_effectiveness_update TEXT;
          `);
        },
        down: async (db: Database) => {
          // Rollback migration (for future use)
          db.exec("DROP TABLE IF EXISTS rules_fts");
          db.exec("DROP TRIGGER IF EXISTS rules_fts_insert");
          db.exec("DROP TRIGGER IF EXISTS rules_fts_delete");
          db.exec("DROP TRIGGER IF EXISTS rules_fts_update");
          db.exec("DROP INDEX IF EXISTS idx_rules_category_usage");
          db.exec("DROP INDEX IF EXISTS idx_rules_created_usage");
          db.exec("DROP INDEX IF EXISTS idx_usage_session_timestamp");
          db.exec("DROP INDEX IF EXISTS idx_sessions_activity");
        },
      },
      // Future migrations go here...
      // 3: { description: "Add rule relationships", up: async (db) => { ... } }
    };
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): { version: number; updated_at: string } {
    const result = this.db
      .prepare(
        `
      SELECT version, updated_at 
      FROM schema_version 
      WHERE id = 1
    `,
      )
      .get() as { version: number; updated_at: string };

    return result;
  }

  /**
   * Check if database needs migration
   */
  needsMigration(): boolean {
    return this.getDatabaseVersion() < this.currentVersion;
  }

  /**
   * Get available migration versions
   */
  getAvailableMigrations(): number[] {
    return Object.keys(this.getMigrations())
      .map(Number)
      .sort((a, b) => a - b);
  }
}

interface Migration {
  description: string;
  up: (db: Database) => Promise<void>;
  down?: (db: Database) => Promise<void>;
}
