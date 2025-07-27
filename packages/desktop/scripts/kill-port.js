#!/usr/bin/env node

const { execSync } = require('child_process');

const port = process.argv[2] || 5174;

console.log(`Killing processes on port ${port}...`);

try {
  // Find process using the port
  const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
  
  if (pid) {
    // Kill the process
    execSync(`kill -9 ${pid.split('\n').join(' ')}`);
    console.log(`✅ Killed process(es) on port ${port}`);
  } else {
    console.log(`✅ No process found on port ${port}`);
  }
} catch (error) {
  // lsof returns error if no process found
  console.log(`✅ Port ${port} is free`);
}