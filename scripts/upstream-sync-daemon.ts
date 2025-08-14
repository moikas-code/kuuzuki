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
  pathMappings: Record<string, string>; // upstream path -> local path
  excludePatterns: string[];
  includePatterns: string[];
  useWorktree: boolean; // Run daemon in isolated worktree
  worktreePath: string; // Path to daemon worktree
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

interface ProcessedCommit {
  commit: string;
  processedAt: string;
  status: "skipped" | "auto-merged" | "review-created" | "manual-required" | "failed" | "already-implemented";
  reason: string;
  branch?: string; // For review branches
}

interface CommitTracker {
  lastProcessedCommit?: string;
  processedCommits: Record<string, ProcessedCommit>;
}

const CONFIG_FILE = ".upstream-sync-config.json";
const PID_FILE = ".upstream-sync.pid";
const LOG_FILE = ".upstream-sync.log";
const TRACKER_FILE = ".upstream-sync-tracker.json";

const DEFAULT_CONFIG: DaemonConfig = {
  upstreamRemote: "upstream",
  upstreamBranch: "dev", 
  localBranch: "master",
  pollInterval: 30, // 30 minutes
  autoMergeThreshold: 0.8,
  dryRun: false,
  notifyOnChanges: true,
  maxChangesPerRun: 5,
  useWorktree: true,
  worktreePath: "../kuuzuki-daemon",
  pathMappings: {
    "packages/opencode/": "packages/kuuzuki/",
    "packages/opencode-": "packages/kuuzuki-"
  },
  excludePatterns: [
    "*.md",
    "docs/**",
    "*.lock",
    "package-lock.json",
    ".github/workflows/**",
    "README*",
    "CHANGELOG*",
    "LICENSE*",
    "version.txt",
    "VERSION"
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
  private tracker: CommitTracker;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.config = this.loadConfig();
    this.tracker = this.loadTracker();
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

  private async setupWorktree(): Promise<void> {
    if (!this.config.useWorktree) {
      return;
    }

    const worktreePath = this.config.worktreePath;
    
    // Check if worktree already exists
    try {
      const worktrees = execSync(`git worktree list`, { encoding: "utf8" });
      if (worktrees.includes(worktreePath)) {
        this.log(`✅ Worktree already exists: ${worktreePath}`);
        return;
      }
    } catch (error) {
      this.log(`⚠️  Error checking worktrees: ${error}`);
    }

    // Clean up any existing directory and worktree registration
    try {
      execSync(`git worktree prune`, { stdio: "pipe" });
      execSync(`rm -rf ${worktreePath}`, { stdio: "pipe" });
    } catch {
      // Directory might not exist, that's fine
    }

    try {
      // Create a dedicated daemon branch if it doesn't exist
      const daemonBranch = `daemon-${this.config.localBranch}`;
      
      try {
        // Try to create the daemon branch from the local branch
        execSync(`git branch ${daemonBranch} ${this.config.localBranch}`, { stdio: "pipe" });
        this.log(`✅ Created daemon branch: ${daemonBranch}`);
      } catch {
        // Branch might already exist, that's fine
        this.log(`📝 Using existing daemon branch: ${daemonBranch}`);
      }
      
      // Create worktree with the daemon branch
      execSync(`git worktree add ${worktreePath} ${daemonBranch}`, { stdio: "pipe" });
      this.log(`✅ Created daemon worktree: ${worktreePath}`);
    } catch (error) {
      this.log(`❌ Failed to create worktree: ${error}`);
      throw error;
    }
  }

  private cleanupWorktree(): void {
    if (!this.config.useWorktree) {
      return;
    }

    try {
      const worktreePath = this.config.worktreePath;
      execSync(`git worktree remove ${worktreePath} --force`, { stdio: "pipe" });
      this.log(`🧹 Cleaned up daemon worktree: ${worktreePath}`);
    } catch (error) {
      this.log(`⚠️  Error cleaning up worktree: ${error}`);
    }
  }

  private getWorkingDirectory(): string {
    return this.config.useWorktree ? this.config.worktreePath : process.cwd();
  }

  private execInWorktree(command: string, options: any = {}): Buffer | string {
    const cwd = this.getWorkingDirectory();
    return execSync(command, { ...options, cwd });
  }

  private loadTracker(): CommitTracker {
    if (existsSync(TRACKER_FILE)) {
      try {
        const trackerData = readFileSync(TRACKER_FILE, "utf8");
        return JSON.parse(trackerData);
      } catch (error) {
        this.log(`Error loading tracker: ${error}. Starting fresh.`);
      }
    }
    return { processedCommits: {} };
  }

  private saveTracker(): void {
    writeFileSync(TRACKER_FILE, JSON.stringify(this.tracker, null, 2));
  }

  private markCommitProcessed(commit: string, status: ProcessedCommit["status"], reason: string, branch?: string): void {
    this.tracker.processedCommits[commit] = {
      commit,
      processedAt: new Date().toISOString(),
      status,
      reason,
      branch
    };
    this.tracker.lastProcessedCommit = commit;
    this.saveTracker();
  }

  private isCommitProcessed(commit: string): boolean {
    return commit in this.tracker.processedCommits;
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
      this.execInWorktree(`git fetch ${this.config.upstreamRemote}`, { stdio: "pipe" });
    } catch (error) {
      throw new Error(`Failed to fetch upstream: ${error}`);
    }
  }

  private async getNewCommits(): Promise<UpstreamChange[]> {
    try {
      const logOutput = this.execInWorktree(
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
        const details = this.execInWorktree(
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

      // Use kuuzuki to analyze the change with Claude Sonnet 4
      const kuuzukiProcess = spawn("bun", ["packages/kuuzuki/src/index.ts", "run", "--model", "anthropic/claude-sonnet-4-20250514"], {
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
    
    // Check for problematic commit types that should be skipped
    const skipPatterns = [
      /^release:/i,
      /^version:/i,
      /^v\d+\.\d+\.\d+/i,
      /^bump version/i,
      /^prepare release/i,
      /^update version/i,
      /^changelog/i,
      /^merge pull request/i,
      /^merge branch/i,
      /^revert/i
    ];

    const shouldSkip = skipPatterns.some(pattern => pattern.test(change.message));
    
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
    const relevantFiles = change.files.filter(file => 
      this.config.includePatterns.some(pattern => 
        this.matchesPattern(file, pattern)
      )
    );

    const excludedFiles = change.files.filter(file =>
      this.config.excludePatterns.some(pattern =>
        this.matchesPattern(file, pattern)
      )
    );

    const isRelevant = relevantFiles.length > 0;
    const hasExcluded = excludedFiles.length > 0;
    const excludedRatio = excludedFiles.length / change.files.length;

    let recommendation: "auto-merge" | "review" | "manual" | "skip" = "review";
    let confidence = 0.6;

    // Skip problematic commit types first
    if (shouldSkip) {
      recommendation = "skip";
      confidence = 0.95;
      this.log(`🚫 Skipping problematic commit type: ${change.message}`);
    }
    // Skip commits that are mostly excluded files (>80% excluded)
    else if (excludedRatio > 0.8) {
      recommendation = "skip";
      confidence = 0.9;
      this.log(`🚫 Skipping commit with mostly excluded files: ${excludedFiles.length}/${change.files.length} files excluded`);
    }
    // Skip commits that mostly affect files that don't exist in our fork (even with path translation)
    else if (!isRelevant && change.files.length > 0) {
      // Check if files exist in our fork (with path translation)
      let existingFiles = 0;
      for (const file of change.files) {
        const translatedPath = this.translatePath(file);
        try {
          execSync(`git show ${this.config.localBranch}:${translatedPath}`, { stdio: "pipe" });
          existingFiles++;
        } catch {
          // File doesn't exist even with translation
        }
      }
      
      if (existingFiles === 0) {
        recommendation = "skip";
        confidence = 0.9;
        this.log(`🚫 Skipping - no files exist in our fork (even with path translation): ${change.files.join(", ")}`);
      }
    }
    // Special handling for bug fixes - they're usually important
    else if (type === "bugfix") {
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
    this.log(`   Relevant: ${relevantFiles.length}/${change.files.length}, Excluded: ${excludedFiles.length}/${change.files.length} (${Math.round(excludedRatio * 100)}%)`);

    return analysis;
  }

  private matchesPattern(file: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\./g, "\\.")  // Escape dots first
        .replace(/\*\*/g, ".*") // Replace ** with .* (any characters)
        .replace(/\*/g, "[^/]*") // Replace * with [^/]* (any characters except /)
    );
    return regex.test(file);
  }

  private async isChangeAlreadyImplemented(change: UpstreamChange): Promise<boolean> {
    try {
      // Method 1: Check if commit exists in local branch (direct cherry-pick)
      try {
        execSync(`git merge-base --is-ancestor ${change.commit} ${this.config.localBranch}`, { stdio: "pipe" });
        this.log(`🔍 Commit ${change.commit.substring(0, 8)} already exists in ${this.config.localBranch}`);
        return true;
      } catch {
        // Commit doesn't exist directly, continue with content checks
      }

      // Method 2: Check if the commit message already exists (manual implementation)
      const logOutput = execSync(
        `git log --oneline --grep="${change.message.replace(/"/g, '\\"')}" ${this.config.localBranch}`,
        { encoding: "utf8" }
      );
      if (logOutput.trim()) {
        this.log(`🔍 Similar commit message found in ${this.config.localBranch}: ${change.message}`);
        return true;
      }

      // Method 3: Check if the file changes are already present (content-based with path translation)
      if (change.files.length > 0 && change.files.length <= 5) { // Only check for small changes
        let allChangesPresent = true;
        
        for (const file of change.files) {
          try {
            // Get the file content from the upstream commit
            const upstreamContent = execSync(
              `git show ${change.commit}:${file}`,
              { encoding: "utf8" }
            );
            
            // Use translated path for our local file
            const translatedPath = this.translatePath(file);
            
            // Get the current file content using translated path
            const currentContent = execSync(
              `git show ${this.config.localBranch}:${translatedPath}`,
              { encoding: "utf8" }
            );
            
            // If contents are identical, this change is already present
            if (upstreamContent !== currentContent) {
              allChangesPresent = false;
              break;
            }
          } catch (error) {
            // File doesn't exist or can't be compared, assume not implemented
            this.log(`⚠️  Could not compare ${file}: ${error}`);
            allChangesPresent = false;
            break;
          }
        }
        
        if (allChangesPresent) {
          this.log(`🔍 File contents already match upstream for ${change.commit.substring(0, 8)}`);
          return true;
        }
      }

      // Method 4: Check for similar recent commits by author and timeframe
      const authorCommits = execSync(
        `git log --oneline --author="${change.author}" --since="1 week ago" ${this.config.localBranch}`,
        { encoding: "utf8" }
      );
      
      if (authorCommits.includes(change.message.substring(0, 20))) {
        this.log(`🔍 Similar recent commit by ${change.author} found`);
        return true;
      }

      // Method 5: Check if specific code changes are already present (diff-based)
      if (change.files.length > 0 && change.files.length <= 3) { // Only for small changes
        try {
          const diff = execSync(`git show ${change.commit} --format=format:`, { encoding: "utf8" });
          
          // Extract added lines (lines starting with +)
          const addedLines = diff.split('\n')
            .filter(line => line.startsWith('+') && !line.startsWith('+++'))
            .map(line => line.substring(1).trim())
            .filter(line => line.length > 5); // Ignore very short lines
          
          if (addedLines.length > 0) {
            let foundChanges = 0;
            
            for (const file of change.files) {
              const translatedPath = this.translatePath(file);
              try {
                const currentContent = execSync(
                  `git show ${this.config.localBranch}:${translatedPath}`,
                  { encoding: "utf8" }
                );
                
                // Check if the added lines are present in our file
                for (const addedLine of addedLines) {
                  if (currentContent.includes(addedLine)) {
                    foundChanges++;
                  }
                }
              } catch {
                // File doesn't exist, skip
              }
            }
            
            // If we found most of the added lines, consider it implemented
            // Use a lower threshold (70%) for better detection of already-implemented changes
            if (foundChanges >= addedLines.length * 0.7) {
              this.log(`🔍 Specific changes already present in translated files (${foundChanges}/${addedLines.length} lines found)`);
              return true;
            }
          }
        } catch (diffError) {
          this.log(`⚠️  Error analyzing diff for implementation check: ${diffError}`);
        }
      }

      return false;
    } catch (error) {
      this.log(`⚠️  Error checking if change is implemented: ${error}`);
      return false; // If we can't check, assume it's not implemented
    }
  }

  private async hasLikelyConflicts(change: UpstreamChange): Promise<boolean> {
    try {
      // Check if files exist in our fork structure
      let missingFiles = 0;
      let existingFiles = 0;
      
      for (const file of change.files) {
        try {
          // Check if file exists in our current branch
          execSync(`git show ${this.config.localBranch}:${file}`, { stdio: "pipe" });
          existingFiles++;
          
          // Check if file has been modified recently in our branch
          const recentChanges = execSync(
            `git log -10 --oneline --name-only ${this.config.localBranch} -- ${file}`,
            { encoding: "utf8" }
          );
          
          if (recentChanges.trim()) {
            this.log(`⚠️  File ${file} has recent changes in ${this.config.localBranch}`);
            return true;
          }
        } catch {
          // File doesn't exist in our branch
          missingFiles++;
          this.log(`📁 File ${file} doesn't exist in our fork`);
        }
      }
      
      // If most files don't exist in our fork, this commit is probably not applicable
      if (missingFiles > existingFiles) {
        this.log(`⚠️  ${missingFiles}/${change.files.length} files don't exist in our fork - likely not applicable`);
        return true;
      }

      // Check for package.json version conflicts (common in release commits)
      if (change.files.includes("package.json")) {
        try {
          const upstreamPackage = execSync(`git show ${change.commit}:package.json`, { encoding: "utf8" });
          const localPackage = execSync(`git show ${this.config.localBranch}:package.json`, { encoding: "utf8" });
          
          const upstreamVersion = JSON.parse(upstreamPackage).version;
          const localVersion = JSON.parse(localPackage).version;
          
          if (upstreamVersion !== localVersion) {
            this.log(`⚠️  Version conflict: upstream ${upstreamVersion} vs local ${localVersion}`);
            return true;
          }
        } catch {
          // Can't parse package.json, assume potential conflict
          return true;
        }
      }

      return false;
    } catch (error) {
      this.log(`⚠️  Error checking for conflicts: ${error}`);
      return true; // If we can't check, assume there might be conflicts
    }
  }

  private translatePath(upstreamPath: string): string {
    for (const [from, to] of Object.entries(this.config.pathMappings)) {
      if (upstreamPath.startsWith(from)) {
        return upstreamPath.replace(from, to);
      }
    }
    return upstreamPath;
  }

  private async manuallyApplyChanges(change: UpstreamChange): Promise<boolean> {
    try {
      const fs = await import("fs");
      
      for (const file of change.files) {
        const translatedPath = this.translatePath(file);
        
        // Skip if file doesn't exist in our fork
        if (!fs.existsSync(translatedPath)) {
          this.log(`⚠️  File doesn't exist in our fork: ${translatedPath}`);
          continue;
        }
        
        // Get the diff for this specific file
        const fileDiff = this.execInWorktree(
          `git show ${change.commit} -- ${file}`,
          { encoding: "utf8" }
        ) as string;
        
        // Extract added and removed lines
        const diffLines = fileDiff.split('\n');
        const addedLines: string[] = [];
        const removedLines: string[] = [];
        
        for (const line of diffLines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            addedLines.push(line.substring(1));
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            removedLines.push(line.substring(1));
          }
        }
        
        // Read current file content
        const currentContent = fs.readFileSync(translatedPath, 'utf8');
        let modifiedContent = currentContent;
        
        // Apply simple line replacements for small changes
        if (addedLines.length <= 5 && removedLines.length <= 5) {
          for (let i = 0; i < Math.min(addedLines.length, removedLines.length); i++) {
            const oldLine = removedLines[i].trim();
            const newLine = addedLines[i];
            
            if (oldLine && modifiedContent.includes(oldLine)) {
              modifiedContent = modifiedContent.replace(oldLine, newLine);
              this.log(`🔄 Replaced line in ${translatedPath}: "${oldLine}" → "${newLine}"`);
            }
          }
          
          // Handle pure additions
          if (addedLines.length > removedLines.length) {
            const additionalLines = addedLines.slice(removedLines.length);
            // Try to add at the end of the file or after similar context
            modifiedContent += '\n' + additionalLines.join('\n');
            this.log(`➕ Added ${additionalLines.length} lines to ${translatedPath}`);
          }
        }
        
        // Write back if content changed
        if (modifiedContent !== currentContent) {
          fs.writeFileSync(translatedPath, modifiedContent);
          this.log(`✅ Manually applied changes to ${translatedPath}`);
        }
      }
      
      return true;
    } catch (error) {
      this.log(`❌ Manual application failed: ${error}`);
      return false;
    }
  }

  private async smartCherryPick(change: UpstreamChange): Promise<boolean> {
    try {
      // First, try regular cherry-pick
      try {
        execSync(`git cherry-pick ${change.commit}`, { stdio: "pipe" });
        this.log(`✅ Regular cherry-pick succeeded for ${change.commit.substring(0, 8)}`);
        return true;
      } catch (cherryPickError) {
        this.log(`🔄 Regular cherry-pick failed, trying path translation...`);
        
        // Clean up the failed cherry-pick state
        try {
          execSync(`git cherry-pick --abort`, { stdio: "pipe" });
          this.log(`🧹 Cleaned up failed cherry-pick state`);
        } catch (abortError) {
          // If abort fails, the cherry-pick might not have been in progress
          this.log(`⚠️  Cherry-pick abort failed (might not be in progress): ${abortError}`);
        }
      }

      // If regular cherry-pick fails, try manual application with path translation
      const diff = execSync(`git show ${change.commit}`, { encoding: "utf8" });
      
      // Check if this looks like a path mismatch issue
      const hasPathMismatch = change.files.some(file => 
        Object.keys(this.config.pathMappings).some(upstreamPath => 
          file.startsWith(upstreamPath)
        )
      );

      if (!hasPathMismatch) {
        // Not a path issue, let the error bubble up
        throw new Error("Cherry-pick failed and no path translation needed");
      }

      this.log(`🔧 Applying changes with path translation...`);
      
      // Get the patch and translate paths in it
      const patch = execSync(`git show ${change.commit} --format=format:`, { encoding: "utf8" });
      
      // Translate paths in the patch
      let translatedPatch = patch;
      for (const [upstreamPath, localPath] of Object.entries(this.config.pathMappings)) {
        const regex = new RegExp(upstreamPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        translatedPatch = translatedPatch.replace(regex, localPath);
      }
      
      // Apply the translated patch
      const fs = await import("fs");
      const tempPatchFile = `/tmp/translated-patch-${Date.now()}.patch`;
      fs.writeFileSync(tempPatchFile, translatedPatch);
      
      let patchApplied = false;
      
      try {
        // Try 1: Standard patch application
        this.execInWorktree(`git apply ${tempPatchFile}`, { stdio: "pipe" });
        this.log(`✅ Applied patch with standard git apply`);
        patchApplied = true;
      } catch (standardError) {
        this.log(`⚠️  Standard patch failed: ${standardError}`);
        
        try {
          // Try 2: 3-way merge patch application
          this.execInWorktree(`git apply --3way ${tempPatchFile}`, { stdio: "pipe" });
          this.log(`✅ Applied patch with 3-way merge`);
          patchApplied = true;
        } catch (threewayError) {
          this.log(`⚠️  3-way patch failed: ${threewayError}`);
          
          // Check if 3-way merge created conflicts that we can resolve
          try {
            const status = this.execInWorktree(`git status --porcelain`, { encoding: "utf8" }) as string;
            const conflictedFiles = status.split('\n').filter(line => line.startsWith('UU ') || line.startsWith('U '));
            
            if (conflictedFiles.length > 0 && conflictedFiles.length <= 3) {
              this.log(`🔧 Found ${conflictedFiles.length} conflicted files, attempting resolution...`);
              
              // For review branches, we can leave conflicts for manual resolution
              // Just stage the non-conflicted files and create a commit
              const cleanFiles = status.split('\n').filter(line => 
                (line.startsWith('M ') || line.startsWith('A ')) && !line.startsWith('U')
              );
              
              if (cleanFiles.length > 0) {
                this.log(`✅ Applied ${cleanFiles.length} files cleanly, ${conflictedFiles.length} need manual resolution`);
                patchApplied = true; // We'll handle conflicts in the review branch
              }
            }
          } catch (statusError) {
            this.log(`⚠️  Could not check git status: ${statusError}`);
          }
          
          if (!patchApplied) {
            try {
              // Try 3: Ignore whitespace and context
              this.execInWorktree(`git apply --ignore-whitespace --ignore-space-change ${tempPatchFile}`, { stdio: "pipe" });
              this.log(`✅ Applied patch ignoring whitespace`);
              patchApplied = true;
            } catch (whitespaceError) {
              this.log(`⚠️  Whitespace-tolerant patch failed: ${whitespaceError}`);
              
              // Try 4: Manual application for small changes
              if (change.files.length <= 2 && (change.additions + change.deletions) <= 20) {
                this.log(`🔧 Attempting manual application for small change...`);
                patchApplied = await this.manuallyApplyChanges(change);
              }
            }
          }
        }
      }
      
      // Clean up temp file
      fs.unlinkSync(tempPatchFile);
      
      if (!patchApplied) {
        throw new Error(`Failed to apply translated patch after trying multiple strategies`);
      }
      
      // Stage all changed files
      for (const file of change.files) {
        const translatedPath = this.translatePath(file);
        if (translatedPath !== file) {
          this.log(`📁 Translated: ${file} → ${translatedPath}`);
          try {
            this.execInWorktree(`git add ${translatedPath}`, { stdio: "pipe" });
          } catch (addError) {
            this.log(`⚠️  Failed to stage ${translatedPath}: ${addError}`);
          }
        }
      }
      
      // Check if we have any staged changes
      const status = execSync(`git status --porcelain`, { encoding: "utf8" });
      if (!status.trim()) {
        this.log(`❌ No changes to commit after path translation`);
        return false;
      }
      
      // Create a commit with the translated changes
      const commitMessage = `${change.message}\n\n(cherry picked from commit ${change.commit} with path translation)`;
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: "pipe" });
      
      this.log(`✅ Successfully applied with path translation`);
      return true;
      
    } catch (error) {
      this.log(`❌ Smart cherry-pick failed: ${error}`);
      return false;
    }
  }

  private async integrateChange(change: UpstreamChange): Promise<boolean> {
    if (!change.analysis) return false;

    // Check if this change is already implemented
    if (await this.isChangeAlreadyImplemented(change)) {
      this.log(`✅ Already implemented ${change.commit.substring(0, 8)}: ${change.message}`);
      this.markCommitProcessed(change.commit, "already-implemented", "Change already exists in codebase");
      return true;
    }

    const { recommendation, confidence } = change.analysis;

    if (recommendation === "skip") {
      this.log(`⏭️  Skipping ${change.commit.substring(0, 8)}: ${change.message}`);
      this.markCommitProcessed(change.commit, "skipped", change.analysis.summary);
      return true;
    }

    if (recommendation === "manual") {
      this.log(`⚠️  Manual review required for ${change.commit.substring(0, 8)}: ${change.message}`);
      this.markCommitProcessed(change.commit, "manual-required", "Requires manual intervention");
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

      // Pre-check for potential conflicts
      if (await this.hasLikelyConflicts(change)) {
        this.log(`⚠️  Potential conflicts detected for ${change.commit.substring(0, 8)}, creating review branch instead`);
        return await this.createReviewBranch(change);
      }

      // Create integration branch
      const branchName = `auto-integration-${change.commit.substring(0, 8)}`;
      execSync(`git checkout -b ${branchName}`, { stdio: "pipe" });

      try {
        // Try smart cherry-pick with path translation
        const success = await this.smartCherryPick(change);
        if (!success) {
          throw new Error("Smart cherry-pick failed");
        }

        // Run basic tests if available
        const testsPassed = await this.runTests();

        if (testsPassed) {
          // Merge to main branch
          execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });
          execSync(`git merge ${branchName}`, { stdio: "pipe" });
          execSync(`git branch -d ${branchName}`, { stdio: "pipe" });

          this.log(`✅ Successfully integrated ${change.commit.substring(0, 8)}`);
          this.markCommitProcessed(change.commit, "auto-merged", "Successfully auto-integrated");
          return true;
        } else {
          // Cleanup failed integration
          execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });
          execSync(`git branch -D ${branchName}`, { stdio: "pipe" });
          this.log(`❌ Integration failed tests for ${change.commit.substring(0, 8)}`);
          this.markCommitProcessed(change.commit, "failed", "Integration failed tests");
          return false;
        }
      } catch (cherryPickError) {
        // Cleanup failed cherry-pick
        try {
          // Only abort if there's an active cherry-pick
          const status = execSync(`git status`, { encoding: "utf8" });
          if (status.includes("cherry-pick")) {
            execSync(`git cherry-pick --abort`, { stdio: "pipe" });
          }
        } catch (abortError) {
          // Cherry-pick abort failed or not needed, continue cleanup
        }
        
        try {
          execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });
          execSync(`git branch -D ${branchName}`, { stdio: "pipe" });
        } catch (cleanupError) {
          this.log(`⚠️  Cleanup warning: ${cleanupError}`);
        }
        
        this.log(`❌ Cherry-pick failed for ${change.commit.substring(0, 8)}: ${cherryPickError}`);
        this.markCommitProcessed(change.commit, "failed", `Cherry-pick failed: ${cherryPickError}`);
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

      // Check if branch already exists and delete it
      try {
        execSync(`git branch -D ${branchName}`, { stdio: "pipe" });
        this.log(`🧹 Deleted existing branch: ${branchName}`);
      } catch {
        // Branch doesn't exist, which is fine
      }

      execSync(`git checkout -b ${branchName}`, { stdio: "pipe" });
      
      try {
        // Use smart cherry-pick for review branches too
        const success = await this.smartCherryPick(change);
        if (!success) {
          throw new Error("Smart cherry-pick failed for review branch");
        }
        
        execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });

        this.log(`✅ Review branch created: ${branchName}`);
        this.log(`   To review: git checkout ${branchName}`);
        this.log(`   To integrate: git checkout ${this.config.localBranch} && git merge ${branchName}`);
        
        return true;
      } catch (cherryPickError) {
        // Cleanup failed cherry-pick for review branch
        try {
          const status = execSync(`git status`, { encoding: "utf8" });
          if (status.includes("cherry-pick")) {
            execSync(`git cherry-pick --abort`, { stdio: "pipe" });
          }
        } catch (abortError) {
          // Continue cleanup
        }
        
        try {
          execSync(`git checkout ${this.config.localBranch}`, { stdio: "pipe" });
          execSync(`git branch -D ${branchName}`, { stdio: "pipe" });
        } catch (cleanupError) {
          this.log(`⚠️  Review branch cleanup warning: ${cleanupError}`);
        }
        
        this.log(`❌ Cherry-pick failed for review branch ${branchName}: ${cherryPickError}`);
        this.markCommitProcessed(change.commit, "failed", `Review branch creation failed: ${cherryPickError}`);
        return false;
      }
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
        // Skip already processed commits
        if (this.isCommitProcessed(commit.commit)) {
          const processed = this.tracker.processedCommits[commit.commit];
          this.log(`⏭️  Skipping already processed commit ${commit.commit.substring(0, 8)}: ${processed.status} (${processed.reason})`);
          skipped++;
          continue;
        }

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

    // Setup worktree if enabled
    if (this.config.useWorktree) {
      try {
        await this.setupWorktree();
      } catch (error) {
        console.log("❌ Worktree setup failed");
        return;
      }
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
    this.log(`   Worktree: ${this.config.useWorktree ? this.config.worktreePath : 'disabled'}`);

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

    // Cleanup worktree if enabled
    if (this.config.useWorktree) {
      this.cleanupWorktree();
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
      console.log(`📊 Tracker: ${TRACKER_FILE}`);
    } else {
      console.log("❌ Daemon is not running");
    }

    // Show tracking statistics
    if (existsSync(TRACKER_FILE)) {
      const tracker = this.loadTracker();
      const commits = Object.values(tracker.processedCommits);
      
      console.log(`\n📈 Commit Processing Statistics:`);
      console.log(`   Total processed: ${commits.length}`);
      console.log(`   Last processed: ${tracker.lastProcessedCommit?.substring(0, 8) || 'none'}`);
      
      const statusCounts = commits.reduce((acc, commit) => {
        acc[commit.status] = (acc[commit.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        const emoji = {
          'skipped': '⏭️',
          'auto-merged': '✅',
          'review-created': '👀',
          'manual-required': '⚠️',
          'failed': '❌',
          'already-implemented': '🔄'
        }[status] || '📝';
        console.log(`   ${emoji} ${status}: ${count}`);
      });

      // Show recent commits
      const recent = commits
        .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
        .slice(0, 5);
      
      if (recent.length > 0) {
        console.log(`\n🕒 Recent commits:`);
        recent.forEach(commit => {
          const emoji = {
            'skipped': '⏭️',
            'auto-merged': '✅',
            'review-created': '👀',
            'manual-required': '⚠️',
            'failed': '❌',
            'already-implemented': '🔄'
          }[commit.status] || '📝';
          const date = new Date(commit.processedAt).toLocaleString();
          console.log(`   ${emoji} ${commit.commit.substring(0, 8)} (${commit.status}) - ${date}`);
          if (commit.branch) {
            console.log(`      Branch: ${commit.branch}`);
          }
        });
      }
    } else {
      console.log(`\n📈 No tracking data found`);
    }
  }

  public configure(options: Partial<DaemonConfig>): void {
    this.config = { ...this.config, ...options };
    this.saveConfig();
    console.log("✅ Configuration updated");
    console.log(JSON.stringify(this.config, null, 2));
  }

  public cleanup(): void {
    // Remove failed commits from tracker so they can be retried
    const failedCommits = Object.entries(this.tracker.processedCommits)
      .filter(([_, commit]) => commit.status === "failed")
      .map(([id, _]) => id);
    
    if (failedCommits.length === 0) {
      console.log("✅ No failed commits to clean up");
      return;
    }

    failedCommits.forEach(commitId => {
      delete this.tracker.processedCommits[commitId];
    });

    this.saveTracker();
    console.log(`✅ Cleaned up ${failedCommits.length} failed commits:`);
    failedCommits.forEach(id => console.log(`   - ${id.substring(0, 8)}`));
    console.log("These commits will be retried on next sync cycle");
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
    case "cleanup":
      daemon.cleanup();
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
  cleanup                  Reset failed commits for retry

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