import { watch, type FSWatcher } from "fs";
import { Session } from "../session";
import { Provider } from "../provider/provider";
import { Identifier } from "../id/id";
export interface BugfinderWatcherOptions {
  path: string;
  debounceMs?: number;
  severity?: "low" | "medium" | "high" | "critical";
  excludePatterns?: string[];
  autofix?: boolean;
  onAnalysisStart?: (filename: string) => void;
  onAnalysisComplete?: (filename: string, result: any) => void;
  onError?: (error: Error) => void;
}

export class BugfinderWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private options: Required<BugfinderWatcherOptions>;

  constructor(options: BugfinderWatcherOptions) {
    this.options = {
      debounceMs: 5000,
      severity: "medium",
      excludePatterns: ["node_modules", ".git", "dist", "build"],
      autofix: false,
      onAnalysisStart: () => {},
      onAnalysisComplete: () => {},
      onError: () => {},
      ...options,
    };
  }

  start(): void {
    if (this.watcher) {
      throw new Error("Watcher is already running");
    }

    this.watcher = watch(
      this.options.path,
      { recursive: true },
      (_, filename) => {
        if (!filename) return;

        // Skip excluded patterns
        const shouldExclude = this.options.excludePatterns.some((pattern) =>
          filename.includes(pattern),
        );
        if (shouldExclude) return;

        // Skip non-code files
        const codeExtensions = [
          ".ts",
          ".js",
          ".tsx",
          ".jsx",
          ".py",
          ".rs",
          ".go",
          ".java",
          ".cpp",
          ".c",
          ".h",
        ];
        const hasCodeExtension = codeExtensions.some((ext) =>
          filename.endsWith(ext),
        );
        if (!hasCodeExtension) return;

        this.debounceAnalysis(filename);
      },
    );
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private debounceAnalysis(filename: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        this.options.onAnalysisStart(filename);
        const result = await this.runBugfinderAnalysis(filename);
        this.options.onAnalysisComplete(filename, result);
      } catch (error) {
        this.options.onError(error as Error);
      }
    }, this.options.debounceMs);
  }

  private async runBugfinderAnalysis(changedFile: string): Promise<any> {
    const session = await Session.create();
    const { providerID, modelID } = await Provider.defaultModel();

    const prompt = `File changed: ${changedFile}

Analyze the codebase for bugs, security issues, and code quality problems related to this file change.

Focus on:
- Code quality issues and potential bugs
- Security vulnerabilities
- Production readiness issues
- Performance problems
- Safety violations

Minimum severity level: ${this.options.severity}
${this.options.autofix ? "Attempt to automatically fix issues where possible." : ""}

Use moidvk tools for comprehensive analysis. Provide specific file locations and line numbers for all issues found.`;

    const messageID = Identifier.ascending("message");
    const result = await Session.chat({
      sessionID: session.id,
      messageID,
      providerID,
      modelID,
      mode: "default",
      system:
        "You are an expert debugging agent focused on systematic bug identification, root cause analysis, and providing actionable solutions. Use moidvk tools for comprehensive code analysis, security scanning, and quality checks. Always provide specific file locations and line numbers for issues found.",
      tools: {
        bash: true,
        read: true,
        write: this.options.autofix,
        edit: this.options.autofix,
        grep: true,
        glob: true,
        todowrite: false,
        todoread: false,
        task: false,
        moidvk_check_code_practices: true,
        moidvk_scan_security_vulnerabilities: true,
        moidvk_check_production_readiness: true,
        moidvk_multi_language_auto_fixer: this.options.autofix,
        moidvk_check_safety_rules: true,
        moidvk_js_performance_analyzer: true,
        moidvk_python_performance_analyzer: true,
        moidvk_rust_performance_analyzer: true,
      },
      parts: [
        {
          id: Identifier.ascending("part"),
          type: "text",
          text: prompt,
        },
      ],
    });

    return result;
  }
}
