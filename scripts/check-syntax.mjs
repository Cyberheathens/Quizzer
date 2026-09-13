import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const extensions = new Set(['.js', '.cjs', '.mjs']);
const files = ['server.js'];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(path);
    } else if (extensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
}

collect('api');
collect('scripts');
files.sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Syntax checked ${files.length} server and script files.`);
