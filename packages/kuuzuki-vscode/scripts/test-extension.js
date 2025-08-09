#!/usr/bin/env node

/**
 * Test script for kuuzuki VS Code extension
 * Validates package.json and builds extension
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const packagePath = path.join(__dirname, '..', 'package.json')
const distPath = path.join(__dirname, '..', 'dist')

console.log('🧪 Testing Kuuzuki VS Code Extension...\n')

// Test 1: Validate package.json
console.log('1️⃣ Validating package.json...')
try {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  
  const requiredFields = ['name', 'version', 'publisher', 'engines', 'main', 'contributes']
  const missingFields = requiredFields.filter(field => !pkg[field])
  
  if (missingFields.length > 0) {
    console.error(`❌ Missing required fields: ${missingFields.join(', ')}`)
    process.exit(1)
  }
  
  if (pkg.publisher !== 'kuuzuki') {
    console.error(`❌ Publisher should be 'kuuzuki', got '${pkg.publisher}'`)
    process.exit(1)
  }
  
  if (!pkg.engines.vscode) {
    console.error('❌ Missing vscode engine requirement')
    process.exit(1)
  }
  
  console.log(`✅ Package.json valid (v${pkg.version})`)
} catch (error) {
  console.error('❌ Invalid package.json:', error.message)
  process.exit(1)
}

// Test 2: Check icon exists
console.log('\n2️⃣ Checking icon...')
const iconPath = path.join(__dirname, '..', 'images', 'icon.png')
if (!fs.existsSync(iconPath)) {
  console.error('❌ Icon not found at images/icon.png')
  process.exit(1)
}
console.log('✅ Icon found')

// Test 3: Check source files
console.log('\n3️⃣ Checking source files...')
const srcPath = path.join(__dirname, '..', 'src', 'extension.ts')
if (!fs.existsSync(srcPath)) {
  console.error('❌ Main source file not found at src/extension.ts')
  process.exit(1)
}
console.log('✅ Source files found')

// Test 4: Build extension
console.log('\n4️⃣ Building extension...')
try {
  execSync('npm run build', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe'
  })
  
  const distFile = path.join(distPath, 'extension.js')
  if (!fs.existsSync(distFile)) {
    console.error('❌ Build output not found')
    process.exit(1)
  }
  
  console.log('✅ Extension built successfully')
} catch (error) {
  console.error('❌ Build failed:', error.message)
  process.exit(1)
}

// Test 5: Package extension (dry run)
console.log('\n5️⃣ Testing package creation...')
try {
  execSync('npx vsce package --out test.vsix', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe'
  })
  
  const vsixPath = path.join(__dirname, '..', 'test.vsix')
  if (fs.existsSync(vsixPath)) {
    fs.unlinkSync(vsixPath) // Clean up test file
    console.log('✅ Extension packages successfully')
  } else {
    console.error('❌ Package creation failed')
    process.exit(1)
  }
} catch (error) {
  console.error('❌ Package test failed:', error.message)
  console.log('💡 Make sure vsce is installed: npm install -g @vscode/vsce')
  process.exit(1)
}

console.log('\n🎉 All tests passed! Extension is ready for publishing.')
console.log('\n📦 To publish:')
console.log('   git tag kuuzuki-vscode-v0.1.0')
console.log('   git push origin kuuzuki-vscode-v0.1.0')