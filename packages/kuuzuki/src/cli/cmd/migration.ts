import { cmd } from "./cmd";
import { AuthMigration } from "../../auth/migration";
import { Log } from "../../util/log";
import chalk from "chalk";

const log = Log.create({ service: "migration-cmd" });

export const MigrationCommand = cmd({
  command: "migrate",
  describe: "Migrate authentication data to unified system",
  builder: (yargs) =>
    yargs
      .command(MigrateAuthCommand)
      .command(MigrateStatusCommand)
      .command(MigrateRollbackCommand)
      .demandCommand(),
  async handler() {},
});

export const MigrateAuthCommand = cmd({
  command: "auth",
  describe: "Migrate authentication credentials to unified system",
  builder: (yargs) =>
    yargs.option("force", {
      type: "boolean",
      describe: "Force migration even if not needed",
      default: false,
    }),
  async handler(args) {
    console.log(chalk.blue("🔄 Checking for authentication migration..."));
    
    try {
      const needsMigration = await AuthMigration.needsMigration();
      
      if (!needsMigration && !args.force) {
        console.log(chalk.green("✅ No migration needed"));
        console.log(chalk.gray("All credentials are already in unified format"));
        return;
      }
      
      if (args.force) {
        console.log(chalk.yellow("⚠️  Forcing migration (--force flag used)"));
      }
      
      console.log(chalk.blue("🔄 Starting authentication migration..."));
      
      const result = await AuthMigration.migrate();
      
      if (result.success) {
        console.log(chalk.green("✅ Migration completed successfully!"));
        console.log();
        console.log(chalk.white("Migration Summary:"));
        
        if (result.migratedCredentials.length > 0) {
          console.log(chalk.green(`✓ Migrated ${result.migratedCredentials.length} credentials:`));
          for (const credential of result.migratedCredentials) {
            console.log(chalk.gray(`  - ${credential}`));
          }
        }
        
        if (result.backupPath) {
          console.log(chalk.gray(`📁 Backup created: ${result.backupPath}`));
        }
        
        console.log();
        console.log(chalk.green("🎉 Your credentials are now unified and persistent!"));
        console.log(chalk.gray("You won't need to re-authenticate after npm installs"));
        
      } else {
        console.log(chalk.red("❌ Migration completed with errors"));
        console.log();
        
        if (result.migratedCredentials.length > 0) {
          console.log(chalk.yellow(`⚠️  Partially migrated ${result.migratedCredentials.length} credentials:`));
          for (const credential of result.migratedCredentials) {
            console.log(chalk.gray(`  - ${credential}`));
          }
          console.log();
        }
        
        if (result.errors.length > 0) {
          console.log(chalk.red("Errors encountered:"));
          for (const error of result.errors) {
            console.log(chalk.red(`  - ${error}`));
          }
          console.log();
        }
        
        if (result.backupPath) {
          console.log(chalk.blue(`📁 Backup available for rollback: ${result.backupPath}`));
          console.log(chalk.gray(`Use: kuuzuki migrate rollback --backup "${result.backupPath}"`));
        }
      }
      
    } catch (error) {
      console.log(chalk.red("❌ Migration failed"));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
      log.error("Migration command failed", { error });
    }
  },
});

export const MigrateStatusCommand = cmd({
  command: "status",
  describe: "Check migration status and credential locations",
  async handler() {
    console.log(chalk.blue("🔍 Checking authentication status..."));
    
    try {
      const needsMigration = await AuthMigration.needsMigration();
      
      console.log();
      console.log(chalk.white("Authentication Status:"));
      
      if (needsMigration) {
        console.log(chalk.yellow("⚠️  Migration needed"));
        console.log(chalk.gray("Legacy credentials detected that should be migrated"));
        console.log();
        console.log(chalk.cyan("Next steps:"));
        console.log(chalk.gray("1. Run: kuuzuki migrate auth"));
        console.log(chalk.gray("2. Verify: kuuzuki auth list"));
      } else {
        console.log(chalk.green("✅ Migration complete"));
        console.log(chalk.gray("All credentials are in unified format"));
      }
      
      // Validate current migration state
      const isValid = await AuthMigration.validateMigration();
      console.log();
      console.log(chalk.white("Validation Status:"));
      
      if (isValid) {
        console.log(chalk.green("✅ All credentials accessible"));
      } else {
        console.log(chalk.red("❌ Some credentials may be inaccessible"));
        console.log(chalk.gray("Consider running migration again"));
      }
      
    } catch (error) {
      console.log(chalk.red("❌ Status check failed"));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
      log.error("Migration status check failed", { error });
    }
  },
});

export const MigrateRollbackCommand = cmd({
  command: "rollback",
  describe: "Rollback migration using backup",
  builder: (yargs) =>
    yargs.option("backup", {
      type: "string",
      describe: "Path to backup directory",
      demandOption: true,
    }),
  async handler(args) {
    console.log(chalk.yellow("⚠️  Rolling back authentication migration..."));
    console.log(chalk.gray(`Using backup: ${args.backup}`));
    
    try {
      const success = await AuthMigration.rollback(args.backup);
      
      if (success) {
        console.log(chalk.green("✅ Rollback completed successfully"));
        console.log(chalk.gray("Authentication system restored to previous state"));
        console.log();
        console.log(chalk.yellow("Note: You may need to re-authenticate after rollback"));
      } else {
        console.log(chalk.red("❌ Rollback failed"));
        console.log(chalk.gray("Check backup path and try again"));
      }
      
    } catch (error) {
      console.log(chalk.red("❌ Rollback failed"));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
      log.error("Migration rollback failed", { error });
    }
  },
});