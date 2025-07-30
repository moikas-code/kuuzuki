#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');

// Read package.json
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

// Read root package.json to get catalog versions
const rootPackageJsonPath = join(__dirname, '..', '..', '..', 'package.json');
const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf-8'));

// Get catalog versions
const catalogVersions = rootPackageJson.catalog || {};

// Function to replace catalog: references
function replaceCatalogRefs(deps) {
  if (!deps) return deps;
  
  const newDeps = {};
  for (const [name, version] of Object.entries(deps)) {
    if (version === 'catalog:' && catalogVersions[name]) {
      console.log(`Replacing ${name}: "catalog:" with "${catalogVersions[name]}"`);
      newDeps[name] = catalogVersions[name];
    } else {
      newDeps[name] = version;
    }
  }
  return newDeps;
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

// Write back
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('✅ Fixed catalog dependencies');