#!/usr/bin/env node

const { execSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const errors = [];
const warnings = [];

console.log('🔍 Validating npm package for kuuzuki...\n');

// 1. Check package.json validity
console.log('📦 Checking package.json...');
try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
  
  // Check version format
  if (!/^\d+\.\d+\.\d+(-\w+(\.\d+)?)?$/.test(packageJson.version)) {
    errors.push(`Invalid version format: ${packageJson.version}`);
  }
  
  // Check required fields
  const requiredFields = ['name', 'version', 'description', 'bin', 'files'];
  requiredFields.forEach(field => {
    if (!packageJson[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Check bin script exists
  if (packageJson.bin && packageJson.bin.kuuzuki) {
    const binPath = join(__dirname, '..', packageJson.bin.kuuzuki);
    if (!existsSync(binPath)) {
      errors.push(`Bin script not found: ${packageJson.bin.kuuzuki}`);
    } else {
      // Check if it's executable
      try {
        execSync(`node -c "${binPath}"`, { stdio: 'pipe' });
        console.log('  ✅ Bin script is valid Node.js');
      } catch (e) {
        errors.push(`Bin script has syntax errors: ${e.message}`);
      }
    }
  }
  
  // Check for catalog: dependencies
  const checkDeps = (deps, type) => {
    if (!deps) return;
    Object.entries(deps).forEach(([name, version]) => {
      if (version === 'catalog:' || version.includes('catalog:')) {
        errors.push(`${type} has catalog reference: ${name}@${version}`);
      }
    });
  };
  
  checkDeps(packageJson.dependencies, 'dependencies');
  checkDeps(packageJson.devDependencies, 'devDependencies');
  checkDeps(packageJson.peerDependencies, 'peerDependencies');
  
  // Check type field
  if (packageJson.type === 'module') {
    warnings.push('Package uses "type": "module" - ensure all scripts are ESM compatible');
  }
  
  console.log('  ✅ package.json structure is valid');
} catch (e) {
  errors.push(`Failed to parse package.json: ${e.message}`);
}

// 2. Check all scripts are CommonJS
console.log('\n📜 Checking scripts...');
const scriptsDir = join(__dirname, '../scripts');
const scripts = ['postinstall.js', 'prepublish.js', 'fix-catalog-deps.js'];

scripts.forEach(script => {
  const scriptPath = join(scriptsDir, script);
  if (existsSync(scriptPath)) {
    try {
      execSync(`node -c "${scriptPath}"`, { stdio: 'pipe' });
      console.log(`  ✅ ${script} is valid`);
    } catch (e) {
      errors.push(`${script} has syntax errors: ${e.message}`);
    }
    
    // Check for ESM syntax
    const content = readFileSync(scriptPath, 'utf8');
    if (content.includes('import ') || content.includes('export ')) {
      errors.push(`${script} contains ESM syntax but package is CommonJS`);
    }
  }
});

// 3. Test bin script execution
console.log('\n🚀 Testing bin script...');
try {
  const output = execSync('node bin/kuuzuki.js --help 2>&1', { 
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('  ✅ Bin script executes without crash');
} catch (e) {
  // Check if it's our expected error message
  const output = e.stdout || e.stderr || e.message;
  if (output.includes('v0.1.x currently supports TUI mode only')) {
    console.log('  ✅ Bin script shows expected help message');
  } else {
    errors.push(`Bin script crashes: ${e.message.split('\n')[0]}`);
  }
}

// 4. Check GitHub workflow
console.log('\n🔧 Checking GitHub workflow...');
const workflowPath = join(__dirname, '../../../.github/workflows/publish-npm.yml');
if (existsSync(workflowPath)) {
  const workflow = readFileSync(workflowPath, 'utf8');
  
  // Check for common issues
  if (workflow.includes('mkdir -p bin') && workflow.includes('cat > bin/kuuzuki.js')) {
    warnings.push('Workflow creates bin/kuuzuki.js - ensure it doesn\'t conflict with existing file');
  }
  
  if (!workflow.includes('NODE_AUTH_TOKEN')) {
    errors.push('Workflow missing NODE_AUTH_TOKEN for npm publish');
  }
  
  console.log('  ✅ GitHub workflow checked');
}

// 5. Run npm pack dry run
console.log('\n📦 Testing npm pack...');
try {
  const output = execSync('npm pack --dry-run . 2>&1', { 
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  // Look for kuuzuki package section only
  const kuuzukiSection = output.split('📦').find(section => section.includes('kuuzuki@'));
  
  if (!kuuzukiSection || !kuuzukiSection.includes('bin/kuuzuki.js')) {
    errors.push('Package does not include bin/kuuzuki.js');
  }
  
  if (kuuzukiSection && !kuuzukiSection.includes('scripts/')) {
    warnings.push('Package may not include scripts/ directory');
  }
  
  if (kuuzukiSection && kuuzukiSection.includes(' src/')) {
    warnings.push('Package includes src/ directory - consider if this is intended');
  }
  
  console.log('  ✅ npm pack successful');
} catch (e) {
  errors.push(`npm pack failed: ${e.message}`);
}

// 6. Check for required binaries (at least one platform)
console.log('\n🔨 Checking binaries...');
const binariesDir = join(__dirname, '../binaries');
if (!existsSync(binariesDir)) {
  warnings.push('No binaries directory - will be created during publish');
} else {
  const platforms = ['linux', 'macos', 'windows'];
  const hasAnyBinary = platforms.some(platform => 
    existsSync(join(binariesDir, `kuuzuki-tui-${platform}`))
  );
  
  if (!hasAnyBinary) {
    warnings.push('No platform binaries found - ensure prepublish builds them');
  } else {
    console.log('  ✅ Some binaries present');
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(60));

if (errors.length > 0) {
  console.log('\n❌ ERRORS (must fix before publishing):');
  errors.forEach(err => console.log(`  - ${err}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (consider fixing):');
  warnings.forEach(warn => console.log(`  - ${warn}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ All checks passed! Package is ready to publish.');
}

// Exit with error code if there are errors
process.exit(errors.length > 0 ? 1 : 0);