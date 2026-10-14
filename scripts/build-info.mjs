// Collects what is being built (release tag + dance, or branch@commit with a dirty flag)
// into frontend/public/build-info.json – the app shows it as the version label and
// scripts/build.mjs puts it into <meta> tags of the built index.html.
// Usage: node scripts/build-info.mjs [--branch <name>]  (branch override for detached checkouts)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(rootDir, 'frontend', 'public', 'build-info.json');
const changelogPath = path.join(rootDir, 'public', 'changelog.json');

const git = (...args) => execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();

export function collectBuildInfo({ branch } = {}) {
  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
  const releaseTag = git('tag', '--points-at', 'HEAD')
    .split('\n')
    .find((tag) => /^v\d{4}\.\d{1,2}\.\d+-/.test(tag)) ?? null;
  const version = releaseTag?.match(/^(v\d{4}\.\d{1,2}\.\d+)-/)[1] ?? null;
  const changelog = fs.existsSync(changelogPath) ? JSON.parse(fs.readFileSync(changelogPath, 'utf8')) : [];
  const release = version ? changelog.find((entry) => entry.version === version) : undefined;

  return {
    version,
    tag: releaseTag,
    dance: release?.dance ?? null,
    branch: branch ?? git('rev-parse', '--abbrev-ref', 'HEAD'),
    commit,
    dirty,
    builtAt: new Date().toISOString(),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const branchIndex = process.argv.indexOf('--branch');
  const info = collectBuildInfo({ branch: branchIndex !== -1 ? process.argv[branchIndex + 1] : undefined });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(info, null, 2) + '\n');
  console.log(`Build info: ${info.tag ?? `${info.branch}@${info.commit}${info.dirty ? ' (uncommitted changes)' : ''}`}`);
}
