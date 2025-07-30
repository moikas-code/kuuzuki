#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the root package.json to get catalog versions
const rootPackageJsonPath = path.join(__dirname, '../../../package.json');
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const catalog = rootPackageJson.catalog || {};

// Read the kuuzuki package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Function to replace catalog: references with actual versions
function replaceCatalogRefs(deps) {
  if (!deps) return deps;
  
  const fixed = {};
  for (const [name, version] of Object.entries(deps)) {
    if (version === 'catalog:' && catalog[name]) {
      fixed[name] = catalog[name];
      console.log(`Fixed ${name}: catalog: → ${catalog[name]}`);
    } else {
      fixed[name] = version;
    }
  }
  return fixed;
}

// Fix dependencies
if (packageJson.dependencies) {
  packageJson.dependencies = replaceCatalogRefs(packageJson.dependencies);
}

// Fix devDependencies
if (packageJson.devDependencies) {
  packageJson.devDependencies = replaceCatalogRefs(packageJson.devDependencies);
}

// Fix peerDependencies
if (packageJson.peerDependencies) {
  packageJson.peerDependencies = replaceCatalogRefs(packageJson.peerDependencies);
}

// Write the updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Fixed catalog dependencies in package.json');