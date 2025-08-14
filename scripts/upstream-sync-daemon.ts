#!/usr/bin/env bun

/**
 * Upstream Sync Daemon - Development Tool
 * 
 * A standalone daemon that monitors upstream changes and automatically
 * integrates them using kuuzuki as an AI assistant. Runs independently
 * and only affects your local development environment.
 * 
 * Usage:
 *   bun scripts/upstream-sync-daemon.ts start
 *   bun scripts/upstream-sync-daemon.ts stop
 *   bun scripts/upstream-sync-daemon.ts status
 */

import { spawn, execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

interface DaemonConfig {
  upstreamRemote: string;
  upstreamBranch: string;
  localBranch: string;
  pollInterval: number; // minutes
  autoMergeThreshold: number; // 0-1 confidence score
  dryRun: boolean;
  notifyOnChanges: boolean;
  maxChangesPerRun: number;
  excludePatterns: string[];
  includePatterns: string[];
}

interface UpstreamChange {
  commit: string;
  author: string;
  date: string;
  message: string;
  files: string[];
  additions: number;
  deletions: number;
  analysis?: {
    type: "feature" | "bugfix" | "refactor" | "docs" | "test" | "chore";
    risk: "low" | "medium" | "high" | "critical";
    recommendation: "auto-merge" | "review" | "manual" | "skip";
    confidence: number;
    summary: string;
    conflicts: string[];
  };
}

const CONFIG_FILE = ".upstream-sync-config.json";
const PID_FILE = ".upstream-sync.pid";
const LOG_FILE = ".upstream-sync.log";

const DEFAULT_CONFIG: DaemonConfig = {
  upstreamRemote: "upstream",
  upstreamBranch: "dev", 
  localBranch: "master",
  pollInterval: 30, // 30 minutes
  autoMergeThreshold: 0.8,
  dryRun: false,
  notifyOnChanges: true,
  maxChangesPerRun: 5,
  excludePatterns: [
    "*.md",
    "docs/**",
    "*.lock",
    "package-lock.json",
    ".github/**"
  ],
  includePatterns: [
    "packages/kuuzuki/**/*.ts",
    "packages/kuuzuki/**/*.js",
    "packages/tui/**/*.go",
    "packages/tui/**/*.ts", 
    "packages/tui/**/*.js",
    "packages/function/**/*.ts",
    "packages/function/**/*.js",
    "packages/web/**/*.ts",
    "packages/web/**/*.js",
    "packages/web/**/*.astro",
    "cmd/**/*.go",
    "internal/**/*.go",
    "*.go",
    "go.mod",
    "go.sum",
    "package.json",
    "tsconfig.json",
    "*.sh",
    "*.fish",
    "*.bash",
    "*.zsh"
  ]
};

class UpstreamSyncDaemon {
  private config: DaemonConfig;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): DaemonConfig {
    if (existsSync(CONFIG_FILE)) {
      try {
        const configData = readFileSync(CONFIG_FILE, "utf8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
      } catch (error) {
        this.log(`Error loading config: ${error}. Using defaults.`);
      }
    }
    return DEFAULT_CONFIG;
  }

  private saveConfig(): void {
    writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    
    try {
      const fs = require("fs");
      fs.appendFileSync(LOG_FILE, logEntry);
    } catch (error) {
      // Ignore log file errors
    }
  }

  private async checkGitSetup(): Promise<boolean> {
    try {
      // Check if upstream remote exists
      const remotes = execSync("git remote -v", { encoding: "utf8" });
      if (!remotes.includes(this.config.upstreamRemote)) {
        this.log(`❌ Remote '${this.config.upstreamRemote}' not found`);
        return false;
      }

      // Check if we can fetch from upstream
      execSync(`git ls-remote ${this.config.upstreamRemote}`, { stdio: "pipe" });
      this.log(`✅ Git setup validated`);
      return true;
    } catch (error) {
      this.log(`❌ Git setup error: ${error}`);
      return false;
    }
  }

  private async fetchUpstream(): Promise<void> {
    try {
      this.log(`🔄 Fetching from ${this.config.upstreamRemote}...`);
      execSync(`git fetch ${this.config.upstreamRemote}`, { stdio: "pipe" });
    } catch (error) {
      throw new Error(`Failed to fetch upstream: ${error}`);
    }
  }

  private async getNewCommits(): Promise<UpstreamChange[]> {
    try {
      const logOutput = execSync(
        `git log --oneline --no-merges ${this.config.localBranch}..${this.config.upstreamRemote}/${this.config.upstreamBranch}`,
        { encoding: "utf8" }
      );

      if (!logOutput.trim()) return [];

      const commits: UpstreamChange[] = [];
      const lines = logOutput.trim().split('\n').slice(0, this.config.maxChangesPerRun);

      for (const line of lines) {
        const [commit, ...messageParts] = line.split(' ');
        const message = messageParts.join(' ');

        // Get detailed commit info
        const details = execSync(
          `git show --stat --format="%an|%ad|%s" ${commit}`,
          { encoding: "utf8" }
        );

        const [authorLine, ...statLines] = details.split('\n');
        const [author, date, subject] = authorLine.split('|');

        // Parse file changes
        const files: string[] = [];
        let additions = 0;
        let deletions = 0;

        for (const statLine of statLines) {
          if (statLine.includes('|')) {
            const fileName = statLine.split('|')[0].trim();
            if (fileName && !fileName.includes('file') && !fileName.includes('changed')) {
              files.push(fileName);
            }
          }

          const addMatch = statLine.match(/(\d+) insertion/);
          const delMatch = statLine.match(/(\d+) deletion/);
          if (addMatch) additions += parseInt(addMatch[1]);
          if (delMatch) deletions += parseInt(delMatch[1]);
        }

        commits.push({
          commit,
          author,
          date,
          message: subject,
          files,
          additions,
          deletions,
        });
      }

      return commits;
    } catch (error) {
      this.log(`Error getting commits: ${error}`);
      return [];
    }
  }

  private async analyzeChangeWithKuuzuki(change: UpstreamChange): Promise<UpstreamChange> {
    try {
      this.log(`🤖 Analyzing commit ${change.commit.substring(0, 8)} with kuuzuki...`);
      
      // Create analysis prompt for kuuzuki
      const analysisPrompt = `
Analyze this upstream commit for integration into our fork:

**Commit**: ${change.commit}
**Author**: ${change.author}
**Message**: ${change.message}
**Files Changed**: ${change.files.join(", ")}
**Changes**: +${change.additions} -${change.deletions}

Please analyze:
1. What type of change is this? (feature/bugfix/refactor/docs/test/chore)
2. What's the risk level? (low/medium/high/critical)
3. Should we auto-merge, review, handle manually, or skip?
4. Confidence level (0-1)
5. Brief summary of the change
6. Any potential conflicts with our fork

Respond in JSON format:
{
  "type": "feature|bugfix|refactor|docs|test|chore",
  "risk": "low|medium|high|critical", 
  "recommendation": "auto-merge|review|manual|skip",
  "confidence": 0.85,
  "summary": "Brief description",
  "conflicts": ["potential conflict areas"]
}
      `.trim();

      // Use kuuzuki to analyze the change
      const kuuzukiProcess = spawn("bun", ["packages/kuuzuki/src/index.ts", "run"], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd()
      });

      return new Promise((resolve, reject) => {
        let output = "";
        let error = "";

        kuuzukiProcess.stdout?.on("data", (data) => {
          output += data.toString();
        });

        kuuzukiProcess.stderr?.on("data", (data) => {
          error += data.toString();
        });

        kuuzukiProcess.on("close", (code) => {
          if (code === 0) {
            try {
              // Extract JSON from kuuzuki output
              const jsonMatch = output.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                resolve({
                  ...change,
                  analysis
                });
              } else {
                // Fallback analysis
                resolve({
                  ...change,
                  analysis: this.createFallbackAnalysis(change)
                });
              }
            } catch (parseError) {
              this.log(`Analysis parsing error: ${parseError}`);
              resolve({
                ...change,
                analysis: this.createFallbackAnalysis(change)
              });
            }
          } else {
            this.log(`Kuuzuki analysis failed: ${error}`);
            resolve({
              ...change,
              analysis: this.createFallbackAnalysis(change)
            });
          }
        });

        // Send the analysis prompt to kuuzuki
        kuuzukiProcess.stdin?.write(analysisPrompt);
        kuuzukiProcess.stdin?.end();

        // Timeout after 30 seconds
        setTimeout(() => {
          kuuzukiProcess.kill();
          resolve({
            ...change,
            analysis: this.createFallbackAnalysis(change)
          });
        }, 30000);
      });

    } catch (error) {
      this.log(`Error analyzing with kuuzuki: ${error}`);
      return {
        ...change,
        analysis: this.createFallbackAnalysis(change)
      };
    }
  }

  private createFallbackAnalysis(change: UpstreamChange): UpstreamChange["analysis"] {
    // Simple heuristic analysis
    const message = change.message.toLowerCase();
    
    let type: "feature" | "bugfix" | "refactor" | "docs" | "test" | "chore" = "chore";
    if (message.includes("feat") || message.includes("add")) type = "feature";
    else if (message.includes("fix") || message.includes("bug")) type = "bugfix";
    else if (message.includes("refactor")) type = "refactor";
    else if (message.includes("doc") || message.includes("readme")) type = "docs";
    else if (message.includes("test")) type = "test";

    let risk: "low" | "medium" | "high" | "critical" = "low";
    if (change.files.length > 10 || change.additions + change.deletions > 500) risk = "critical";
    else if (change.files.length > 5 || change.additions + change.deletions > 100) risk = "high";
    else if (change.files.length > 2 || change.additions + change.deletions > 20) risk = "medium";

    // Check if files match our include/exclude patterns
    const isRelevant = change.files.some(file => 
      this.config.includePatterns.some(pattern => 
        this.matchesPattern(file, pattern)
      )
    );

    const hasExcluded = change.files.some(file =>
      this.config.excludePatterns.some(pattern =>
        this.matchesPattern(file, pattern)
      )
    );

    let recommendation: "auto-merge" | "review" | "manual" | "skip" = "review";
    let confidence = 0.6;

    // Special handling for bug fixes - they're usually important
    if (type === "bugfix") {
      if (risk === "low") {
        recommendation = "auto-merge";
        confidence = 0.85;
      } else if (risk === "medium") {
        recommendation = "review";
        confidence = 0.75;
      } else {
        recommendation = "manual";
        confidence = 0.9;
      }
    }
    // Skip only if explicitly excluded AND not a bug fix
    else if (hasExcluded && type !== "bugfix") {
      recommendation = "skip";
      confidence = 0.9;
    }
    // Skip if not relevant AND not a bug fix
    else if (!isRelevant && type !== "bugfix") {
      recommendation = "skip";
      confidence = 0.8;
    }
    // Auto-merge low-risk relevant changes
    else if (risk === "low" && isRelevant) {
      recommendation = "auto-merge";
      confidence = 0.8;
    }
    // Manual review for critical changes
    else if (risk === "critical") {
      recommendation = "manual";
      confidence = 0.9;
    }

    const analysis = {
      type,
      risk,
      recommendation,
      confidence,
      summary: `${type} affecting ${change.files.length} files`,
      conflicts: []
    };

    // Log the decision reasoning
    this.log(`📊 Analysis for ${change.commit.substring(0, 8)}: ${type}/${risk} → ${recommendation} (${Math.round(confidence * 100)}%)`);
    this.log(`   Files: ${change.files.join(", ")}`);
    this.log(`   Relevant: ${isRelevant}, Excluded: ${hasExcluded}`);

    return analysis;
  }

  private matchesPattern(file: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")
        .replace(/\./g, "\\.")
    );
    return regex.test(file);
  }

  private async integrateChange(change: UpstreamChange): Promise<boolean> {
    if (!change.analysis) return false;

    const { recommendation, confidence } = change.analysis;

    if (recommendation === "skip") {
      this.log(`⏭️  Skipping ${change.commit.substring(0, 8)}: ${change.message}`);
      return true;
    }

    if (recommendation === "manual") {
      this.log(`⚠️  Manual review required for ${change.commit.substring(0, 8)}: ${change.message}`);
      return false;
    }

    if (recommendation === "auto-merge" && confidence >= this.config.autoMergeThreshold) {
      return await this.performIntegration(change);
    }

    if (recommendation === "review") {
      this.log(`👀 Review recommended for ${change.commit.substring(0, 8)}: ${change.message}`);
      if (this.config.dryRun) {
        this.log(`🔍 [DRY RUN] Would create review branch for manual inspection`);
        return true;
      }
      return await this.createReviewBranch(change);
    }

    return false;
  }

  private async performIntegration(change: UpstreamChange): Promise<boolean> {
    try {
      this.log(`🔄 Auto-integrating ${change.commit.substring(0, 8)}: ${change.message}`);

      if (this.config.dryRun) {
        this.log(`🔍 [DRY RUN] Would cherry-pick ${change.commit}`);
        return true;
      }

      // Create integration branch
      const branchName = `auto-integration-${change.commit.substring(0, 8)}`;
      execSync(`git checkout -b ${branchName}`, { stdio: "pipe" });

      try {
        // Cherry-pick the commit
        execSync(`git cherry-pick ${change.commit}`, { stdio: "pipe" });

        // Run basic tests if available
        const testsPassed = await this.runTests();

        if (testsPassed) {
          // Merge to main branch
          execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });
          execSync(`git merge ${branchName}`, { stdio: "pipe" });
          execSync(`git branch -d ${branchName}`, { stdio: "pipe" });

          this.log(`✅ Successfully integrated ${change.commit.substring(0, 8)}`);
          return true;
        } else {
          // Cleanup failed integration
          execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });
          execSync(`git branch -D ${branchName}`, { stdio: "pipe" });
          this.log(`❌ Integration failed tests for ${change.commit.substring(0, 8)}`);
          return false;
        }
      } catch (cherryPickError) {
        // Cleanup failed cherry-pick
        execSync(`git cherry-pick --abort`, { stdio: "pipe" });
        execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });
        execSync(`git branch -D ${branchName}`, { stdio: "pipe" });
        this.log(`❌ Cherry-pick failed for ${change.commit.substring(0, 8)}: ${cherryPickError}`);
        return false;
      }
    } catch (error) {
      this.log(`❌ Integration error for ${change.commit.substring(0, 8)}: ${error}`);
      return false;
    }
  }

  private async createReviewBranch(change: UpstreamChange): Promise<boolean> {
    try {
      const branchName = `review-${change.commit.substring(0, 8)}`;
      this.log(`🌿 Creating review branch: ${branchName}`);

      if (this.config.dryRun) {
        this.log(`🔍 [DRY RUN] Would create branch ${branchName}`);
        return true;
      }

      execSync(`git checkout -b ${branchName}`, { stdio: "pipe" });
      execSync(`git cherry-pick ${change.commit}`, { stdio: "pipe" });
      execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });

      this.log(`✅ Review branch created: ${branchName}`);
      this.log(`   To review: git checkout ${branchName}`);
      this.log(`   To integrate: git checkout ${this.config.localBranch} && git merge ${branchName}`);
      
      return true;
    } catch (error) {
      this.log(`❌ Failed to create review branch: ${error}`);
      return false;
    }
  }

  private async runTests(): Promise<boolean> {
    try {
      // Check if there are test commands available
      const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
      if (packageJson.scripts?.test) {
        this.log(`🧪 Running tests...`);
        execSync("bun test", { stdio: "pipe", timeout: 60000 });
        this.log(`✅ Tests passed`);
        return true;
      }
    } catch (error) {
      this.log(`❌ Tests failed: ${error}`);
      return false;
    }
    return true; // No tests available, assume OK
  }

  private async syncCycle(): Promise<void> {
    try {
      this.log(`🔄 Starting sync cycle...`);

      await this.fetchUpstream();
      const newCommits = await this.getNewCommits();

      if (newCommits.length === 0) {
        this.log(`✅ No new commits found`);
        return;
      }

      this.log(`📦 Found ${newCommits.length} new commits`);

      let integrated = 0;
      let skipped = 0;
      let failed = 0;

      for (const commit of newCommits) {
        const analyzedCommit = await this.analyzeChangeWithKuuzuki(commit);
        const success = await this.integrateChange(analyzedCommit);

        if (success) {
          if (analyzedCommit.analysis?.recommendation === "skip") {
            skipped++;
          } else {
            integrated++;
          }
        } else {
          failed++;
        }
      }

      this.log(`📊 Sync complete: ${integrated} integrated, ${skipped} skipped, ${failed} failed`);

      if (this.config.notifyOnChanges && (integrated > 0 || failed > 0)) {
        this.sendNotification(`Upstream sync: ${integrated} integrated, ${failed} failed`);
      }

    } catch (error) {
      this.log(`❌ Sync cycle error: ${error}`);
    }
  }

  private sendNotification(message: string): void {
    // Simple desktop notification (you could extend this)
    try {
      execSync(`notify-send "Kuuzuki Upstream Sync" "${message}"`, { stdio: "pipe" });
    } catch (error) {
      // Notification failed, just log
      this.log(`📢 ${message}`);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("❌ Daemon is already running");
      return;
    }

    // Validate git setup
    if (!(await this.checkGitSetup())) {
      console.log("❌ Git setup validation failed");
      return;
    }

    this.isRunning = true;
    writeFileSync(PID_FILE, process.pid.toString());

    this.log(`🚀 Upstream sync daemon started`);
    this.log(`   Remote: ${this.config.upstreamRemote}/${this.config.upstreamBranch}`);
    this.log(`   Local: ${this.config.localBranch}`);
    this.log(`   Interval: ${this.config.pollInterval} minutes`);
    this.log(`   Dry run: ${this.config.dryRun}`);

    // Initial sync
    await this.syncCycle();

    // Set up periodic sync
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.syncCycle();
      }
    }, this.config.pollInterval * 60 * 1000);

    // Handle graceful shutdown
    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
  }

  public stop(): void {
    if (!this.isRunning) {
      console.log("❌ Daemon is not running");
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }

    this.log(`🛑 Upstream sync daemon stopped`);
    process.exit(0);
  }

  public status(): void {
    if (existsSync(PID_FILE)) {
      const pid = readFileSync(PID_FILE, "utf8");
      console.log(`✅ Daemon is running (PID: ${pid})`);
      console.log(`📁 Config: ${CONFIG_FILE}`);
      console.log(`📝 Log: ${LOG_FILE}`);
    } else {
      console.log("❌ Daemon is not running");
    }
  }

  public configure(options: Partial<DaemonConfig>): void {
    this.config = { ...this.config, ...options };
    this.saveConfig();
    console.log("✅ Configuration updated");
    console.log(JSON.stringify(this.config, null, 2));
  }
}

// CLI Interface
async function main() {
  const daemon = new UpstreamSyncDaemon();
  const command = process.argv[2];

  switch (command) {
    case "start":
      await daemon.start();
      break;
    case "stop":
      daemon.stop();
      break;
    case "status":
      daemon.status();
      break;
    case "config":
      const configOptions = JSON.parse(process.argv[3] || "{}");
      daemon.configure(configOptions);
      break;
    default:
      console.log(`
🤖 Kuuzuki Upstream Sync Daemon

Usage:
  bun scripts/upstream-sync-daemon.ts <command>

Commands:
  start                    Start the daemon
  stop                     Stop the daemon  
  status                   Check daemon status
  config <json>            Update configuration

Examples:
  bun scripts/upstream-sync-daemon.ts start
  bun scripts/upstream-sync-daemon.ts config '{"pollInterval": 15, "dryRun": true}'
  bun scripts/upstream-sync-daemon.ts stop

The daemon will:
- Monitor upstream/${this.config?.upstreamBranch || 'dev'} for new commits
- Use kuuzuki AI to analyze each change
- Automatically integrate safe changes
- Create review branches for complex changes
- Skip irrelevant changes (docs, etc.)
- Notify you of important updates

Configuration is stored in .upstream-sync-config.json
Logs are written to .upstream-sync.log
      `);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}