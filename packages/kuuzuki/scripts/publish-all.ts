#!/usr/bin/env bun

/**
 * Publish all Kuuzuki packages to npm
 * This handles the multi-package structure like Kuuzuki
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";
import { readFile, writeFile, readdir } from "fs/promises";

const DIST_DIR = join(import.meta.dir, "..", "dist", "npm");
const DRY_RUN = process.argv.includes("--dry-run");

interface PackageJson {
  name: string;
  version: string;
  [key: string]: any;
}

async function readPackageJson(path: string): Promise<PackageJson> {
  const content = await readFile(join(path, "package.json"), "utf-8");
  return JSON.parse(content);
}

async function checkNpmVersion(packageName: string, version: string): Promise<boolean> {
  try {
    const result = await $`npm view ${packageName}@${version} version`.quiet();
    return result.stdout.toString().trim() === version;
  } catch {
    return false;
  }
}

async function publishPackage(packageDir: string, packageName: string) {
  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Publishing ${packageName}...`);
  
  const args = DRY_RUN 
    ? ["publish", "--dry-run", "--access", "public"]
    : ["publish", "--access", "public"];
  
  try {
    const result = await $`cd ${packageDir} && npm ${args}`.quiet();
    console.log(`✓ ${packageName} published successfully`);
  } catch (error: any) {
    const stderr = error.stderr?.toString() || "";
    const stdout = error.stdout?.toString() || "";
    
    // In dry-run mode, npm returns exit code 1 but it's not an error
    if (DRY_RUN && (stderr.includes("dry-run") || stdout.includes("dry-run") || stderr.includes("You cannot publish over the previously published versions"))) {
      console.log(`✓ ${packageName} dry run completed`);
      return;
    }
    
    if (stderr.includes("You cannot publish over the previously published versions")) {
      console.log(`⚠️  ${packageName} already published at this version`);
    } else {
      console.error(`✗ Failed to publish ${packageName}`);
      console.error(stderr);
      throw new Error(`Failed to publish ${packageName}`);
    }
  }
}

async function main() {
  console.log("Publishing Kuuzuki packages to npm");
  console.log(DRY_RUN ? "🏃 DRY RUN MODE - No packages will be published" : "📦 Publishing packages...");
  
  // Check if dist directory exists
  if (!existsSync(DIST_DIR)) {
    console.error("No dist/npm directory found. Run build-distribution.ts first.");
    process.exit(1);
  }
  
  // Get main package version
  const mainPackagePath = join(DIST_DIR, "kuuzuki");
  const mainPackage = await readPackageJson(mainPackagePath);
  const version = mainPackage.version;
  
  console.log(`\nVersion: ${version}`);
  
  // Find all platform packages
  const platformPackages: string[] = [];
  const entries = await readdir(DIST_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.name.startsWith("kuuzuki-") && entry.isDirectory()) {
      platformPackages.push(entry.name);
    }
  }
  
  console.log(`\nFound packages:`);
  console.log(`- kuuzuki (main)`);
  platformPackages.forEach(pkg => console.log(`- ${pkg}`));
  
  // Check if packages are already published
  if (!DRY_RUN) {
    console.log("\nChecking npm registry...");
    
    const mainExists = await checkNpmVersion("kuuzuki", version);
    if (mainExists) {
      console.error(`kuuzuki@${version} already exists on npm`);
      console.log("Increment version in package.json and rebuild");
      process.exit(1);
    }
  }
  
  // Publish platform packages first
  console.log("\n📦 Publishing platform packages...");
  
  for (const platformPkg of platformPackages) {
    const packageDir = join(DIST_DIR, platformPkg);
    
    // Update version to match main package
    const pkgJsonPath = join(packageDir, "package.json");
    const pkgJson = await readPackageJson(packageDir);
    pkgJson.version = version;
    await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
    
    await publishPackage(packageDir, platformPkg);
  }
  
  // Wait a moment for npm to process
  if (!DRY_RUN) {
    console.log("\nWaiting for npm to process platform packages...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Publish main package
  console.log("\n📦 Publishing main package...");
  await publishPackage(mainPackagePath, "kuuzuki");
  
  console.log("\n✅ All packages published successfully!");
  
  if (!DRY_RUN) {
    console.log("\nInstall with:");
    console.log(`  npm install -g kuuzuki@${version}`);
    console.log("\nOr latest:");
    console.log("  npm install -g kuuzuki");
  }
}

main().catch(error => {
  console.error("\n❌ Publishing failed:", error);
  process.exit(1);
});