#!/usr/bin/env bun

/**
 * Build script for creating Kuuzuki distribution
 * Similar to OpenCode's approach: TypeScript server + Go TUI
 */

import { $ } from "bun";
import { mkdir, rm, copyFile, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const ROOT_DIR = join(import.meta.dir, "..", "..", "..");
const KUUZUKI_DIR = join(ROOT_DIR, "packages", "kuuzuki");
const TUI_DIR = join(ROOT_DIR, "packages", "tui");
const DIST_DIR = join(KUUZUKI_DIR, "dist");

const PLATFORMS = [
  { 
    name: "linux-x64", 
    npmName: "kuuzuki-linux-x64",
    tuiTarget: { GOOS: "linux", GOARCH: "amd64" }
  },
  { 
    name: "linux-arm64",
    npmName: "kuuzuki-linux-arm64", 
    tuiTarget: { GOOS: "linux", GOARCH: "arm64" }
  },
  { 
    name: "darwin-x64",
    npmName: "kuuzuki-darwin-x64",
    tuiTarget: { GOOS: "darwin", GOARCH: "amd64" }
  },
  { 
    name: "darwin-arm64",
    npmName: "kuuzuki-darwin-arm64",
    tuiTarget: { GOOS: "darwin", GOARCH: "arm64" }
  },
  { 
    name: "windows-x64",
    npmName: "kuuzuki-windows-x64",
    tuiTarget: { GOOS: "windows", GOARCH: "amd64" }
  }
];

async function buildGoTui(platform: typeof PLATFORMS[0], outputDir: string) {
  console.log(`Building Go TUI for ${platform.name}...`);
  
  const tuiBinaryName = `kuuzuki-tui${platform.tuiTarget.GOOS === "windows" ? ".exe" : ""}`;
  const outputPath = join(outputDir, tuiBinaryName);
  
  const env = {
    ...process.env,
    ...platform.tuiTarget,
    CGO_ENABLED: "0"
  };
  
  const result = await $`cd ${TUI_DIR} && go build -ldflags="-s -w" -o ${outputPath} ./cmd/kuuzuki`.env(env).quiet();
  
  if (result.exitCode === 0) {
    console.log(`✓ Built Go TUI for ${platform.name}`);
    return true;
  } else {
    console.error(`✗ Failed to build Go TUI for ${platform.name}`);
    console.error(result.stderr.toString());
    return false;
  }
}

async function createPlatformPackage(platform: typeof PLATFORMS[0]) {
  const packageDir = join(DIST_DIR, "npm", platform.npmName);
  const binDir = join(packageDir, "bin");
  
  console.log(`\nCreating package: ${platform.npmName}`);
  
  // Create directories
  await mkdir(binDir, { recursive: true });
  
  // Build Go TUI for this platform
  if (!await buildGoTui(platform, binDir)) {
    throw new Error(`Failed to build TUI for ${platform.name}`);
  }
  
  // Create package.json
  const packageJson = {
    name: platform.npmName,
    version: "0.1.6",
    description: `Kuuzuki binaries for ${platform.name}`,
    license: "MIT",
    repository: {
      type: "git",
      url: "https://github.com/moikas-code/kuuzuki.git"
    },
    files: ["bin"],
    os: [platform.tuiTarget.GOOS === "darwin" ? "darwin" : platform.tuiTarget.GOOS],
    cpu: [platform.tuiTarget.GOARCH === "amd64" ? "x64" : platform.tuiTarget.GOARCH]
  };
  
  await writeFile(
    join(packageDir, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  
  console.log(`✓ Created ${platform.npmName} package`);
}

async function createMainPackage() {
  const mainPackageDir = join(DIST_DIR, "npm", "kuuzuki");
  const binDir = join(mainPackageDir, "bin");
  
  console.log("\nCreating main kuuzuki package...");
  
  // Create directories
  await mkdir(binDir, { recursive: true });
  await mkdir(join(mainPackageDir, "src"), { recursive: true });
  
  // Copy TypeScript source files
  await $`cp -r ${join(KUUZUKI_DIR, "src")}/* ${join(mainPackageDir, "src")}/`;
  
  // Create the launcher script (cross-platform)
  const launcherScript = `#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const { join, dirname, resolve } = require('path');
const { existsSync, realpathSync } = require('fs');
const os = require('os');

// Resolve the real path of this script (handles npm link, symlinks, etc)
const scriptPath = realpathSync(__filename);
const scriptDir = dirname(scriptPath);

// Check if bun is available
const hasBun = (() => {
  try {
    const result = spawnSync(process.platform === 'win32' ? 'bun.exe' : 'bun', ['--version'], { 
      stdio: 'pipe',
      shell: false
    });
    return result.status === 0;
  } catch {
    return false;
  }
})();

if (!hasBun) {
  console.error('Bun runtime is required to run kuuzuki');
  console.error('Install it from: https://bun.sh');
  process.exit(1);
}

// Map platform/arch
const platform = process.platform === 'darwin' ? 'darwin' : 
                process.platform === 'win32' ? 'windows' : 'linux';
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const platformPackage = \`kuuzuki-\${platform}-\${arch}\`;

// Check if this is a TUI command
const args = process.argv.slice(2);
const isTui = args.length === 0 || args[0] === 'tui';

if (isTui) {
  // Find TUI binary
  const tuiBinary = \`kuuzuki-tui\${platform === 'windows' ? '.exe' : ''}\`;
  
  // Search paths - check multiple locations
  const searchPaths = [
    // In same package structure
    join(scriptDir, '..', '..', platformPackage, 'bin', tuiBinary),
    // In node_modules next to main package
    join(scriptDir, '..', 'node_modules', platformPackage, 'bin', tuiBinary),
    // In global node_modules
    join(scriptDir, '..', '..', '..', platformPackage, 'bin', tuiBinary),
    // Local node_modules
    join(process.cwd(), 'node_modules', platformPackage, 'bin', tuiBinary),
    join(process.cwd(), 'node_modules', 'kuuzuki', 'node_modules', platformPackage, 'bin', tuiBinary),
  ];
  
  // Also check common global paths
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(os.homedir(), 'AppData', 'Roaming');
    searchPaths.push(join(appData, 'npm', 'node_modules', platformPackage, 'bin', tuiBinary));
  } else {
    searchPaths.push(join('/usr/local/lib/node_modules', platformPackage, 'bin', tuiBinary));
    searchPaths.push(join(os.homedir(), '.npm-global/lib/node_modules', platformPackage, 'bin', tuiBinary));
  }
  
  const tuiPath = searchPaths.find(p => existsSync(p));
  
  if (!tuiPath) {
    console.error(\`Could not find TUI binary. Make sure \${platformPackage} is installed.\`);
    console.error('Searched in:');
    searchPaths.forEach(p => console.error('  - ' + p));
    process.exit(1);
  }
  
  // Run TUI
  const child = spawn(tuiPath, args.slice(1), {
    stdio: 'inherit',
    env: process.env,
    shell: false
  });
  
  child.on('error', (err) => {
    console.error('Failed to start TUI:', err.message);
    process.exit(1);
  });
  
  child.on('exit', code => process.exit(code || 0));
  
  // Handle signals properly on all platforms
  if (process.platform !== 'win32') {
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
  } else {
    process.on('SIGINT', () => child.kill());
    process.on('SIGTERM', () => child.kill());
  }
} else {
  // Run TypeScript CLI with bun
  const indexPath = join(scriptDir, '..', 'src', 'index.ts');
  
  if (!existsSync(indexPath)) {
    console.error('Could not find index.ts at:', indexPath);
    process.exit(1);
  }
  
  const bunCmd = process.platform === 'win32' ? 'bun.exe' : 'bun';
  const child = spawn(bunCmd, ['run', indexPath, ...args], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
    shell: false
  });
  
  child.on('error', (err) => {
    console.error('Failed to start kuuzuki:', err.message);
    process.exit(1);
  });
  
  child.on('exit', code => process.exit(code || 0));
  
  // Handle signals properly on all platforms
  if (process.platform !== 'win32') {
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
  } else {
    process.on('SIGINT', () => child.kill());
    process.on('SIGTERM', () => child.kill());
  }
}
`;
  
  await writeFile(join(binDir, "kuuzuki"), launcherScript);
  await $`chmod +x ${join(binDir, "kuuzuki")}`;
  
  // Create Windows batch file
  const batchScript = `@echo off
node "%~dp0\\kuuzuki" %*
`;
  await writeFile(join(binDir, "kuuzuki.cmd"), batchScript);
  
  // Create package.json
  const mainPackageJson = {
    name: "kuuzuki",
    version: "0.1.6",
    description: "AI-powered terminal assistant",
    keywords: ["ai", "terminal", "cli", "assistant", "claude"],
    homepage: "https://github.com/moikas-code/kuuzuki",
    repository: {
      type: "git",
      url: "https://github.com/moikas-code/kuuzuki.git"
    },
    bugs: {
      url: "https://github.com/moikas-code/kuuzuki/issues"
    },
    author: "Kuuzuki Team",
    license: "MIT",
    bin: {
      kuuzuki: "./bin/kuuzuki"
    },
    engines: {
      node: ">=18.0.0"
    },
    files: ["bin", "src"],
    optionalDependencies: PLATFORMS.reduce((deps, p) => {
      deps[p.npmName] = "^0.1.6";
      return deps;
    }, {} as Record<string, string>),
    dependencies: JSON.parse(await readFile(join(KUUZUKI_DIR, "package.json"), "utf-8")).dependencies
  };
  
  await writeFile(
    join(mainPackageDir, "package.json"),
    JSON.stringify(mainPackageJson, null, 2)
  );
  
  console.log("✓ Created main kuuzuki package");
}

async function main() {
  console.log("Building Kuuzuki distribution packages...\n");
  
  // Clean dist directory
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(join(DIST_DIR, "npm"), { recursive: true });
  
  // Prepare source files for npm
  console.log("Preparing source files for npm...");
  await $`bun run ${join(import.meta.dir, "prepare-npm.ts")}`.quiet();
  
  // Determine current platform
  const os = process.platform === "darwin" ? "darwin" : 
           process.platform === "win32" ? "windows" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const currentPlatform = PLATFORMS.find(p => p.name === `${os}-${arch}`);
  
  if (!currentPlatform) {
    console.error("Current platform not supported");
    process.exit(1);
  }
  
  // Build platform package for current platform
  await createPlatformPackage(currentPlatform);
  
  // Create main package
  await createMainPackage();
  
  console.log("\n✅ Distribution packages created!");
  console.log("\nPackages in dist/npm/:");
  console.log(`- kuuzuki (main package)`);
  console.log(`- ${currentPlatform.npmName} (platform binaries)`);
  
  console.log("\nTo test locally:");
  console.log("1. cd dist/npm/kuuzuki");
  console.log("2. npm link");
  console.log("3. kuuzuki --version");
  
  console.log("\nTo publish:");
  console.log("1. Build on all target platforms");
  console.log("2. Publish each platform package");
  console.log("3. Publish main package");
}

main().catch(console.error);