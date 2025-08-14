#!/usr/bin/env bun

/**
 * Debug tool to analyze a specific upstream commit
 * Helps understand why commits are failing to integrate
 */

import { execSync } from "child_process";

function analyzeCommit(commitHash: string) {
  try {
    console.log(`🔍 Analyzing commit: ${commitHash}\n`);
    
    // Get commit details
    const details = execSync(
      `git show --stat --format="%an|%ad|%s" ${commitHash}`,
      { encoding: "utf8" }
    );
    
    const [authorLine, ...statLines] = details.split('\n');
    const [author, date, subject] = authorLine.split('|');
    
    console.log(`📝 **Message**: ${subject}`);
    console.log(`👤 **Author**: ${author}`);
    console.log(`📅 **Date**: ${date}\n`);
    
    // Parse files
    const files: string[] = [];
    for (const statLine of statLines) {
      if (statLine.includes('|')) {
        const fileName = statLine.split('|')[0].trim();
        if (fileName && !fileName.includes('file') && !fileName.includes('changed')) {
          files.push(fileName);
        }
      }
    }
    
    console.log(`📁 **Files changed** (${files.length}):`);
    
    // Path mappings for kuuzuki fork
    const pathMappings = {
      "packages/opencode/": "packages/kuuzuki/",
      "packages/opencode-": "packages/kuuzuki-"
    };
    
    function translatePath(upstreamPath: string): string {
      for (const [from, to] of Object.entries(pathMappings)) {
        if (upstreamPath.startsWith(from)) {
          return upstreamPath.replace(from, to);
        }
      }
      return upstreamPath;
    }
    
    // Check which files exist in our fork
    let existingFiles = 0;
    let missingFiles = 0;
    let translatedFiles = 0;
    
    for (const file of files) {
      const translatedPath = translatePath(file);
      
      // Check original path
      try {
        execSync(`git show master:${file}`, { stdio: "pipe" });
        console.log(`  ✅ ${file} (exists in our fork)`);
        existingFiles++;
        continue;
      } catch {
        // Original doesn't exist, try translated
      }
      
      // Check translated path
      if (translatedPath !== file) {
        try {
          execSync(`git show master:${translatedPath}`, { stdio: "pipe" });
          console.log(`  🔄 ${file} → ${translatedPath} (exists with translation)`);
          translatedFiles++;
          existingFiles++;
          continue;
        } catch {
          // Neither exists
        }
      }
      
      console.log(`  ❌ ${file} (missing from our fork)`);
      if (translatedPath !== file) {
        console.log(`     (${translatedPath} also missing)`);
      }
      missingFiles++;
    }
    
    console.log(`\n📊 **Summary**:`);
    console.log(`  - Existing files: ${existingFiles}`);
    console.log(`  - Translated files: ${translatedFiles}`);
    console.log(`  - Missing files: ${missingFiles}`);
    console.log(`  - Applicability: ${existingFiles > missingFiles ? "✅ Likely applicable" : "❌ Likely not applicable"}`);
    if (translatedFiles > 0) {
      console.log(`  - Path translation: ✅ ${translatedFiles} files can be translated`);
    }
    
    // Show the actual diff for small changes
    if (files.length <= 3) {
      console.log(`\n🔍 **Diff preview**:`);
      try {
        const diff = execSync(`git show ${commitHash}`, { encoding: "utf8" });
        console.log(diff.substring(0, 1000) + (diff.length > 1000 ? "\n... (truncated)" : ""));
      } catch (error) {
        console.log(`Error showing diff: ${error}`);
      }
    }
    
    // Check if it's a problematic commit type
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
    
    const shouldSkip = skipPatterns.some(pattern => pattern.test(subject));
    if (shouldSkip) {
      console.log(`\n🚫 **Recommendation**: Skip (problematic commit type)`);
    } else if (existingFiles === 0) {
      console.log(`\n🚫 **Recommendation**: Skip (no applicable files)`);
    } else if (missingFiles > existingFiles) {
      console.log(`\n⚠️  **Recommendation**: Manual review (mixed applicability)`);
    } else {
      console.log(`\n✅ **Recommendation**: Should be integrable`);
    }
    
  } catch (error) {
    console.error(`❌ Error analyzing commit: ${error}`);
  }
}

function main() {
  const commitHash = process.argv[2];
  
  if (!commitHash) {
    console.log(`
🔍 Commit Debug Tool

Usage:
  bun scripts/debug-commit.ts <commit-hash>

Examples:
  bun scripts/debug-commit.ts 4dea0209
  bun scripts/debug-commit.ts e789abec

This tool helps understand why commits fail to integrate by:
- Showing which files the commit modifies
- Checking if those files exist in our fork
- Analyzing commit type and applicability
- Providing integration recommendations
    `);
    return;
  }
  
  analyzeCommit(commitHash);
}

if (import.meta.main) {
  main();
}