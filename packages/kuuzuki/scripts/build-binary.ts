#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "path";
import { mkdir, rm } from "fs/promises";

const platforms = [
  { os: "linux", arch: "x64", target: "bun-linux-x64" },
  { os: "linux", arch: "arm64", target: "bun-linux-arm64" },
  { os: "darwin", arch: "x64", target: "bun-darwin-x64" },
  { os: "darwin", arch: "arm64", target: "bun-darwin-arm64" },
  { os: "windows", arch: "x64", target: "bun-windows-x64" },
];

async function buildBinary(platform: (typeof platforms)[0]) {
  const outDir = join("dist", "binaries", `${platform.os}-${platform.arch}`);
  const outFile = join(
    outDir,
    platform.os === "windows" ? "kuuzuki.exe" : "kuuzuki",
  );

  console.log(`Building for ${platform.os}-${platform.arch}...`);

  // Create output directory
  await mkdir(outDir, { recursive: true });

  try {
    // Get version from environment variable (for CI) or package.json
    const pkg = await Bun.file("package.json").json();
    const version = process.env.VERSION || pkg.version || "0.0.0";

    // Build the standalone binary with version
    await $`bun build --compile --target=${platform.target} --outfile=${outFile} --define KUUZUKI_VERSION="'${version}'" ./src/index.ts`;

    // Fix permissions for the binary (Bun sometimes creates files with no permissions)
    await $`chmod 755 ${outFile}`;

    console.log(`✓ Built ${outFile} (v${version})`);
    return true;
  } catch (error) {
    console.error(
      `✗ Failed to build for ${platform.os}-${platform.arch}:`,
      error,
    );
    return false;
  }
}

async function main() {
  console.log("🔨 Building Kuuzuki binaries...");

  // Clean dist directory
  await rm("dist/binaries", { recursive: true, force: true });

  // Check for specific platform flag
  const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
  if (platformArg) {
    const platformName = platformArg.split("=")[1];
    const [os, arch] = platformName.split("-");

    const platform = platforms.find((p) => p.os === os && p.arch === arch);
    if (platform) {
      console.log(`Building for specific platform: ${platformName}`);
      const success = await buildBinary(platform);
      console.log(
        success
          ? `✅ Built ${platformName} binary`
          : `❌ Failed to build ${platformName} binary`,
      );
      return;
    } else {
      console.error(`❌ Unknown platform: ${platformName}`);
      console.log(
        "Available platforms:",
        platforms.map((p) => `${p.os}-${p.arch}`).join(", "),
      );
      process.exit(1);
    }
  }

  // Build for current platform only in development
  if (process.argv.includes("--current-platform")) {
    const currentPlatform =
      process.platform === "darwin"
        ? "darwin"
        : process.platform === "win32"
          ? "windows"
          : "linux";
    const currentArch = process.arch === "arm64" ? "arm64" : "x64";

    const platform = platforms.find(
      (p) => p.os === currentPlatform && p.arch === currentArch,
    );
    if (platform) {
      await buildBinary(platform);
    }
    return;
  }

  // Build for all platforms
  const results = await Promise.all(platforms.map(buildBinary));

  const succeeded = results.filter((r) => r).length;
  console.log(`\n✅ Built ${succeeded}/${platforms.length} binaries`);
}

main().catch(console.error);
