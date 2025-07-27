// Quick test to see if bash works
const { spawn } = require('child_process');

console.log('Testing bash...');
const bash = spawn('/bin/bash', ['-i'], {
  stdio: 'pipe',
  env: process.env
});

bash.stdout.on('data', (data) => {
  console.log('stdout:', data.toString());
});

bash.stderr.on('data', (data) => {
  console.log('stderr:', data.toString());
});

bash.on('exit', (code) => {
  console.log('bash exited with code:', code);
});

bash.on('error', (err) => {
  console.log('bash error:', err);
});

// Send a test command
setTimeout(() => {
  bash.stdin.write('echo "Hello from bash"\n');
  setTimeout(() => {
    bash.stdin.write('exit\n');
  }, 1000);
}, 100);