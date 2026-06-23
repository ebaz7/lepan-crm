const { execSync } = require('child_process');
try {
  console.log('=== GIT LOG ===');
  const log = execSync('git log --oneline -n 25 components/TradeModule.tsx').toString();
  console.log(log);
} catch (err) {
  console.error('Git log error:', err.message);
}
