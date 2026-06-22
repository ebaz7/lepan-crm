import { execSync } from 'child_process';

try {
    const gitLog = execSync('git log --oneline -n 10', { encoding: 'utf8' });
    console.log('=== GIT LOG ===');
    console.log(gitLog);

    const gitStatus = execSync('git status', { encoding: 'utf8' });
    console.log('=== GIT STATUS ===');
    console.log(gitStatus);
} catch (error: any) {
    console.error('Error executing git:', error.message);
}
