// Builds the frontend and uploads it over SFTP (moje.vonica.cz).
// Usage: node scripts/deploy.mjs [--source working|commit|tag] [--demo] [--yes]
//   working – current working copy incl. uncommitted changes (default)
//   commit  – last commit of the current branch, built in a clean temporary worktree
//   tag     – latest release tag on master, built in a clean temporary worktree
//   --demo  – real (masked) members from dev/local/clenove.tsv; requires Basic Auth
//   --yes   – skip the confirmation prompt
//   --dry-run – build and print the summary, upload nothing
// Configuration: .env in the repository root (see .env.example).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import SftpClient from 'ssh2-sftp-client';
import { apr1 } from './lib/apr1.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : undefined;
};
const source = option('--source') ?? 'working';
const demo = args.includes('--demo');
const assumeYes = args.includes('--yes');
const dryRun = args.includes('--dry-run');

// Uploaded last, so clients never get an index.html pointing to chunks that are not there yet
const UPLOAD_LAST = ['ngsw.json', 'index.html'];
// Never deleted as "left over from an older version"
const KEEP_REMOTE = ['.htaccess', '.htpasswd'];

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: rootDir, encoding: 'utf8' }).trim();

function loadConfig() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) fail('Missing .env – copy .env.example and fill it in.');
  process.loadEnvFile(envPath);
  const env = process.env;
  for (const key of ['SFTP_HOST', 'SFTP_USER', 'SFTP_PASSWORD', 'SITE_URL']) {
    if (!env[key]) fail(`Missing ${key} in .env`);
  }
  const auth = env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD
    ? { user: env.BASIC_AUTH_USER, password: env.BASIC_AUTH_PASSWORD }
    : null;
  if (auth && !env.SITE_ROOT_PATH) fail('Basic Auth needs SITE_ROOT_PATH (absolute web root path on the server) in .env');
  if (demo && !auth) fail('Demo build contains real member names – refusing to deploy it without Basic Auth.');
  return {
    sftp: { host: env.SFTP_HOST, port: Number(env.SFTP_PORT || 22), username: env.SFTP_USER, password: env.SFTP_PASSWORD },
    remoteDir: env.SFTP_REMOTE_DIR || '/',
    siteUrl: env.SITE_URL.replace(/\/$/, ''),
    siteRootPath: env.SITE_ROOT_PATH,
    auth,
  };
}

function run(command, commandArgs, cwd) {
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(' ')} failed`);
}

// Builds in the working copy, or in a clean temporary worktree at the given ref
function build() {
  const buildArgs = demo ? ['--demo'] : [];
  if (source === 'working') {
    run('node', ['scripts/build.mjs', ...buildArgs], rootDir);
    return { buildRoot: rootDir, cleanup: () => {} };
  }

  let ref;
  let branch;
  if (source === 'commit') {
    ref = 'HEAD';
    branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  } else if (source === 'tag') {
    ref = git('describe', '--tags', '--abbrev=0', '--match', 'v*-*', 'master');
    branch = 'master';
  } else {
    fail(`Unknown --source ${source} (working|commit|tag)`);
  }

  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'splk-deploy-'));
  run('git', ['worktree', 'add', '--detach', worktree, ref], rootDir);
  const cleanup = () => run('git', ['worktree', 'remove', '--force', worktree], rootDir);
  try {
    fs.symlinkSync(path.join(rootDir, 'frontend', 'node_modules'), path.join(worktree, 'frontend', 'node_modules'));
    if (demo) buildArgs.push('--members', path.join(rootDir, 'dev', 'local', 'clenove.tsv'));
    run('node', ['scripts/build.mjs', ...buildArgs, '--branch', branch], worktree);
  } catch (error) {
    cleanup();
    throw error;
  }
  return { buildRoot: worktree, cleanup };
}

function listLocalFiles(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listLocalFiles(path.join(dir, entry.name), relative) : [relative];
  });
}

async function listRemote(sftp, dir, prefix = '') {
  const result = { files: [], dirs: [] };
  for (const entry of await sftp.list(dir)) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.type === 'd') {
      const nested = await listRemote(sftp, path.posix.join(dir, entry.name), relative);
      result.dirs.push(relative, ...nested.dirs);
      result.files.push(...nested.files);
    } else {
      result.files.push(relative);
    }
  }
  return result;
}

function htaccessWithAuth(appHtaccess, config) {
  if (!config.auth) return appHtaccess;
  return [
    '# Basic Auth – generated by scripts/deploy.mjs, the whole site is for ensemble members only',
    'AuthType Basic',
    'AuthName "SPLK"',
    `AuthUserFile ${path.posix.join(config.siteRootPath, '.htpasswd')}`,
    'Require valid-user',
    '',
    appHtaccess,
  ].join('\n');
}

async function upload(config, distDir) {
  const sftp = new SftpClient();
  await sftp.connect(config.sftp);
  const remote = (relative) => path.posix.join(config.remoteDir, relative);
  try {
    // 1) Protection first – real names must never be reachable, not even for a moment
    if (config.auth) {
      await sftp.put(Buffer.from(`${config.auth.user}:${apr1(config.auth.password)}\n`), remote('.htpasswd'));
    }
    const appHtaccess = fs.readFileSync(path.join(distDir, '.htaccess'), 'utf8');
    await sftp.put(Buffer.from(htaccessWithAuth(appHtaccess, config)), remote('.htaccess'));
    console.log(config.auth ? '✔ Basic Auth (.htpasswd, .htaccess)' : '✔ .htaccess (no Basic Auth)');

    // 2) Application files, index.html and ngsw.json last
    const files = listLocalFiles(distDir).filter((file) => file !== '.htaccess');
    files.sort((a, b) => UPLOAD_LAST.indexOf(a) - UPLOAD_LAST.indexOf(b));
    for (const file of files) {
      const target = remote(file);
      const dir = path.posix.dirname(target);
      if (!(await sftp.exists(dir))) await sftp.mkdir(dir, true);
      await sftp.put(path.join(distDir, file), target);
    }
    console.log(`✔ Uploaded ${files.length} files`);

    // 3) Remove what is left over from older builds
    const localFiles = new Set(files);
    const localDirs = new Set(files.map((file) => path.posix.dirname(file)).filter((dir) => dir !== '.'));
    const { files: remoteFiles, dirs: remoteDirs } = await listRemote(sftp, config.remoteDir);
    const staleFiles = remoteFiles.filter((file) => !localFiles.has(file) && !KEEP_REMOTE.includes(file));
    for (const file of staleFiles) await sftp.delete(remote(file));
    const staleDirs = remoteDirs.filter((dir) => !localDirs.has(dir)).sort((a, b) => b.length - a.length);
    for (const dir of staleDirs) await sftp.rmdir(remote(dir), true);
    console.log(`✔ Removed ${staleFiles.length} stale files, ${staleDirs.length} stale directories`);
  } finally {
    await sftp.end();
  }
}

async function verify(config, expectedRevision) {
  const withAuth = config.auth
    ? { Authorization: `Basic ${Buffer.from(`${config.auth.user}:${config.auth.password}`).toString('base64')}` }
    : {};
  if (config.auth) {
    const anonymous = await fetch(`${config.siteUrl}/`);
    if (anonymous.status !== 401) throw new Error(`Site answers ${anonymous.status} without password – expected 401!`);
    console.log('✔ Without password: 401');
  }
  const response = await fetch(`${config.siteUrl}/`, { headers: withAuth });
  const html = await response.text();
  if (!response.ok || !html.includes(`content="${expectedRevision}"`)) {
    throw new Error(`Deployed index.html does not report revision ${expectedRevision} (HTTP ${response.status})`);
  }
  console.log(`✔ ${config.siteUrl} serves ${expectedRevision}`);
}

const config = loadConfig();
if (source === 'working' && git('status', '--porcelain') !== '') {
  console.warn('\n⚠️  WARNING: deploying the working copy WITH UNCOMMITTED CHANGES – the build will be marked as dirty.\n');
}

const { buildRoot, cleanup } = build();
try {
  const distDir = path.join(buildRoot, 'frontend', 'dist', 'frontend', 'browser');
  const info = JSON.parse(fs.readFileSync(path.join(distDir, 'build-info.json'), 'utf8'));
  const revision = `${info.branch}@${info.commit}${info.dirty ? '+dirty' : ''}`;

  console.log('\n──────── Deploy summary ────────');
  console.log(`Source:     ${source}`);
  console.log(`Version:    ${info.tag ?? '(no release tag)'}${info.dance ? ` – ${info.dance.codename}` : ''}`);
  console.log(`Revision:   ${revision}`);
  console.log(`Members:    ${demo ? 'REAL (demo build, masked surnames)' : 'fictional'}`);
  console.log(`Target:     ${config.sftp.username}@${config.sftp.host}:${config.remoteDir} → ${config.siteUrl}`);
  console.log(`Basic Auth: ${config.auth ? `yes (user ${config.auth.user})` : 'NO – site will be public'}`);
  console.log('────────────────────────────────\n');

  if (dryRun) {
    console.log('Dry run – nothing uploaded.');
  } else if (!assumeYes) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await prompt.question('Deploy? [y/N] ');
    prompt.close();
    if (answer.trim().toLowerCase() !== 'y') throw new Error('Cancelled.');
  }

  if (!dryRun) {
    await upload(config, distDir);
    await verify(config, revision);
    console.log('\n✨ Deployed.');
  }
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
