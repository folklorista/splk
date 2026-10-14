// Production build of the frontend: changelog sync, (demo) member import, build info,
// ng build, then build info as <meta> tags in index.html.
// Usage: node scripts/build.mjs [--demo] [--members <tsv>] [--branch <name>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = path.join(rootDir, 'frontend');
export const distDir = path.join(frontendDir, 'dist', 'frontend', 'browser');

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : undefined;
};
const demo = args.includes('--demo');

function run(command, commandArgs, cwd = rootDir) {
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Failed: ${command} ${commandArgs.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

run('node', ['scripts/sync-public.mjs']);
if (demo) {
  run('node', ['scripts/import-members.mjs', ...(option('--members') ? [option('--members')] : [])]);
}
const branch = option('--branch');
run('node', ['scripts/build-info.mjs', ...(branch ? ['--branch', branch] : [])]);
run('npx', ['ng', 'build', '--configuration', demo ? 'production,demo' : 'production'], frontendDir);

// Build info into <head> – visible in the page source without running the app
const info = JSON.parse(fs.readFileSync(path.join(distDir, 'build-info.json'), 'utf8'));
const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const meta = [
  ['app-version', info.tag ?? ''],
  ['app-revision', `${info.branch}@${info.commit}${info.dirty ? '+dirty' : ''}`],
  ['app-built-at', info.builtAt],
]
  .map(([name, content]) => `  <meta name="${name}" content="${escape(content)}">`)
  .join('\n');
const indexPath = path.join(distDir, 'index.html');
fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replace('</head>', `${meta}\n</head>`));

// index.html changed after ng build – the service worker manifest holds its hash, regenerate it
run('npx', ['ngsw-config', path.relative(frontendDir, distDir), 'ngsw-config.json', '/'], frontendDir);

console.log(`\nBuilt ${demo ? 'DEMO (real members) ' : ''}into ${path.relative(rootDir, distDir)}`);
