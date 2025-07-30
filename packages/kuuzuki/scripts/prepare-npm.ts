#!/usr/bin/env bun

/**
 * Prepare source files for npm publishing
 * Handles Bun-specific features that don't work in npm packages
 */

import { readFile, writeFile, copyFile } from "fs/promises";
import { join } from "path";

const SRC_DIR = join(import.meta.dir, "..", "src");

async function replaceMacroImport() {
  console.log("Fixing macro imports for npm compatibility...");
  
  const modelsPath = join(SRC_DIR, "provider", "models.ts");
  const content = await readFile(modelsPath, "utf-8");
  
  // Replace the macro import with hardcoded data
  const newContent = content.replace(
    'import { data } from "./models-macro" with { type: "macro" }',
    `// Macro replaced for npm compatibility
const data = async () => ({
  models: [
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      release_date: "2024-10-22",
      attachment: true,
      reasoning: true,
      temperature: true,
      tool_call: true,
      cost: { input: 3, output: 15 }
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      release_date: "2024-10-22",
      attachment: false,
      reasoning: false,
      temperature: true,
      tool_call: true,
      cost: { input: 1, output: 5 }
    },
    {
      id: "claude-3-opus-20240229",
      name: "Claude 3 Opus",
      release_date: "2024-02-29",
      attachment: true,
      reasoning: false,
      temperature: true,
      tool_call: true,
      cost: { input: 15, output: 75 }
    },
    {
      id: "claude-3-sonnet-20240229",
      name: "Claude 3 Sonnet",
      release_date: "2024-02-29",
      attachment: false,
      reasoning: false,
      temperature: true,
      tool_call: true,
      cost: { input: 3, output: 15 }
    },
    {
      id: "claude-3-haiku-20240307",
      name: "Claude 3 Haiku",
      release_date: "2024-03-07",
      attachment: false,
      reasoning: false,
      temperature: true,
      tool_call: true,
      cost: { input: 0.25, output: 1.25 }
    }
  ]
})`
  );
  
  // Backup original
  await copyFile(modelsPath, modelsPath + ".bak");
  
  // Write updated file
  await writeFile(modelsPath, newContent);
  console.log("✓ Fixed models.ts macro import");
}

async function main() {
  console.log("Preparing Kuuzuki for npm publishing...\n");
  
  try {
    await replaceMacroImport();
    
    console.log("\n✅ Preparation complete!");
    console.log("\nNote: Original files backed up with .bak extension");
  } catch (error) {
    console.error("❌ Preparation failed:", error);
    process.exit(1);
  }
}

main();