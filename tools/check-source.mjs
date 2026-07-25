import { readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const sourceDirectories = ['assets/js', 'server', 'tests', 'tools'];
const sourceFiles = [];

function collect(directory) {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const relativePath = join(directory, entry.name);
    if (entry.isDirectory()) collect(relativePath);
    else if (['.js', '.mjs'].includes(extname(entry.name)) && entry.name !== 'check-source.mjs') {
      sourceFiles.push(relativePath);
    }
  }
}

sourceDirectories.forEach(collect);
for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax check passed: ${sourceFiles.length} files`);

