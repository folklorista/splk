// Builds the frontend and uploads it over SFTP to an explicitly chosen target domain.
// --target api|krojarka is handled by scripts/deploy-app.mjs (see its header for the options).
// Usage: node scripts/deploy.mjs --target <demo|moje> [--source working|commit|tag | --ref <tag|branch|commit>] [--demo] [--yes]
//   --target – required, there is no default target: demo (demo.vonica.cz) or moje (moje.vonica.cz)
//   working – current working copy incl. uncommitted changes (default)
//   commit  – last commit of the current branch, built in a clean temporary worktree
//   tag     – latest release tag (v*) on master, built in a clean temporary worktree
//   --ref   – the given tag (or unique tag prefix), branch or commit, built in a clean temporary worktree
//   --demo  – real (masked) members from dev/local/clenove.tsv; requires Basic Auth
//   --yes   – skip the confirmation prompt
//   --dry-run – build and print the summary incl. the upload plan, upload nothing
//   --status  – only print which version the target serves now
//   --allow-foreign-content – the target web root has files but no build-info.json (not deployed by this
//                             script, e.g. the hosting placeholder page); replace them anyway
// Configuration: .env in the repository root (see .env.example), variables <PREFIX>_* of the chosen target.
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
const refArg = option('--ref');
const source = refArg ? 'ref' : option('--source') ?? 'working';
const demo = args.includes('--demo');
const assumeYes = args.includes('--yes');
const dryRun = args.includes('--dry-run');
const statusOnly = args.includes('--status');
const allowForeignContent = args.includes('--allow-foreign-content');
const targetName = option('--target');

if (targetName === 'api' || targetName === 'krojarka') {
  await import('./deploy-app.mjs');
  process.exit();
}

// Deploy targets of this app. The domain is fixed here, so a wrong *_SITE_URL in .env cannot redirect a deploy.
const TARGETS = {
  demo: { prefix: 'DEMO', domain: 'demo.vonica.cz' },
  moje: { prefix: 'MOJE', domain: 'moje.vonica.cz' },
};
// Hosting accounts of other domains – the target must not share an SFTP account with any of them
const OTHER_ACCOUNT_PREFIXES = ['VONICA', 'API', 'KROJARKA'];

// Uploaded last, so clients never get an index.html pointing to chunks that are not there yet
const UPLOAD_LAST = ['ngsw.json', 'index.html'];
// Never deleted as "left over from an older version"
const KEEP_REMOTE = ['.htaccess', '.htpasswd'];
// Content-hashed build output (chunk-ABCD1234.js) – same name means same content, no need to upload again
const HASHED_FILE = /-[A-Z0-9]{8}\.(js|css)$/;

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: rootDir, encoding: 'utf8' }).trim();
const gitOk = (...gitArgs) => spawnSync('git', gitArgs, { cwd: rootDir, stdio: 'ignore' }).status === 0;

// Resolves --ref to a commit and the branch name reported in the build info
function resolveRef(ref) {
  if (gitOk('show-ref', '--verify', '--quiet', `refs/heads/${ref}`)) return { ref, branch: ref };
  let tag = gitOk('show-ref', '--verify', '--quiet', `refs/tags/${ref}`) ? ref : undefined;
  if (!tag) {
    const candidates = git('tag', '--list', `${ref}*`).split('\n').filter(Boolean);
    if (candidates.length > 1) fail(`--ref ${ref} matches several tags: ${candidates.join(', ')}`);
    tag = candidates[0];
  }
  const resolved = tag ?? ref;
  if (!gitOk('rev-parse', '--verify', '--quiet', `${resolved}^{commit}`)) fail(`Unknown --ref ${ref} (no such tag, branch or commit)`);
  const branch = gitOk('merge-base', '--is-ancestor', resolved, 'master')
    ? 'master'
    : git('branch', '--contains', resolved, '--format=%(refname:short)').split('\n').filter(Boolean)[0] ?? 'detached';
  return { ref: resolved, branch };
}

function loadConfig() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) fail('Missing .env – copy .env.example and fill it in.');
  if (!targetName) fail(`Missing --target (${Object.keys(TARGETS).join('|')}|api|krojarka) – there is no default target.`);
  const target = TARGETS[targetName];
  if (!target) fail(`Unknown --target ${targetName} (${Object.keys(TARGETS).join('|')}|api|krojarka)`);
  process.loadEnvFile(envPath);
  const env = process.env;
  const name = (key) => `${target.prefix}_${key}`;
  const value = (key) => env[name(key)];

  const required = ['SFTP_HOST', 'SFTP_PORT', 'SFTP_USER', 'SFTP_PASSWORD', 'SFTP_REMOTE_DIR', 'SITE_URL'];
  const missing = required.filter((key) => !value(key)).map(name);
  if (missing.length) fail(`Missing in .env: ${missing.join(', ')}`);

  let siteUrl;
  try {
    siteUrl = new URL(value('SITE_URL'));
  } catch {
    fail(`${name('SITE_URL')} is not a valid URL`);
  }
  if (siteUrl.protocol !== 'https:' || siteUrl.host !== target.domain) {
    fail(`${name('SITE_URL')} must be https://${target.domain} for --target ${targetName}`);
  }
  const otherPrefixes = [...Object.values(TARGETS).map((other) => other.prefix), ...OTHER_ACCOUNT_PREFIXES]
    .filter((prefix) => prefix !== target.prefix);
  const sharedWith = otherPrefixes.filter((prefix) => env[`${prefix}_SFTP_USER`] === value('SFTP_USER'));
  if (sharedWith.length) {
    fail(`${name('SFTP_USER')} is the same account as ${sharedWith.map((prefix) => `${prefix}_SFTP_USER`).join(', ')} – refusing to deploy`);
  }

  const authUser = value('BASIC_AUTH_USER');
  const authPassword = value('BASIC_AUTH_PASSWORD');
  if (Boolean(authUser) !== Boolean(authPassword)) fail(`Set both ${name('BASIC_AUTH_USER')} and ${name('BASIC_AUTH_PASSWORD')}, or neither`);
  const auth = authUser ? { user: authUser, password: authPassword } : null;
  if (auth && !value('SITE_ROOT_PATH')) fail(`Basic Auth needs ${name('SITE_ROOT_PATH')} (absolute web root path on the server) in .env`);
  if (auth && !value('SITE_ROOT_PATH').replace(/\/$/, '').endsWith(`/${target.domain.split('.')[0]}`)) {
    fail(`${name('SITE_ROOT_PATH')} does not look like the web root of ${target.domain}`);
  }
  if (demo && !auth) fail(`Demo build contains real member names – refusing to deploy it without Basic Auth (${name('BASIC_AUTH_USER')}, ${name('BASIC_AUTH_PASSWORD')}).`);
  return {
    target: targetName,
    sftp: { host: value('SFTP_HOST'), port: Number(value('SFTP_PORT')), username: value('SFTP_USER'), password: value('SFTP_PASSWORD') },
    remoteDir: value('SFTP_REMOTE_DIR'),
    siteUrl: siteUrl.origin,
    siteRootPath: value('SITE_ROOT_PATH'),
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
    ref = git('describe', '--tags', '--abbrev=0', '--match', 'v*', 'master');
    branch = 'master';
  } else if (source === 'ref') {
    ({ ref, branch } = resolveRef(refArg));
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

// Compares the build with the server: what to upload (hashed files already there are skipped) and what to delete
async function planUpload(sftp, config, distDir) {
  const files = listLocalFiles(distDir).filter((file) => file !== '.htaccess');
  files.sort((a, b) => UPLOAD_LAST.indexOf(a) - UPLOAD_LAST.indexOf(b));
  const { files: remoteFiles, dirs: remoteDirs } = await listRemote(sftp, config.remoteDir);
  const remoteSet = new Set(remoteFiles);
  const localFiles = new Set(files);
  const localDirs = new Set(files.flatMap((file) => {
    const parts = file.split('/').slice(0, -1);
    return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
  }));
  return {
    // Files on the server, but none from a deploy of this app – someone else's content
    foreign: remoteFiles.some((file) => !KEEP_REMOTE.includes(file)) && !remoteSet.has('build-info.json'),
    upload: files.filter((file) => !(HASHED_FILE.test(file) && remoteSet.has(file))),
    unchanged: files.filter((file) => HASHED_FILE.test(file) && remoteSet.has(file)),
    staleFiles: remoteFiles.filter((file) => !localFiles.has(file) && !KEEP_REMOTE.includes(file)),
    staleDirs: remoteDirs.filter((dir) => !localDirs.has(dir)).sort((a, b) => b.length - a.length),
  };
}

async function upload(sftp, config, distDir, plan) {
  const remote = (relative) => path.posix.join(config.remoteDir, relative);

  // 1) Protection first – real names must never be reachable, not even for a moment
  if (config.auth) {
    await sftp.put(Buffer.from(`${config.auth.user}:${apr1(config.auth.password)}\n`), remote('.htpasswd'));
  }
  const appHtaccess = fs.readFileSync(path.join(distDir, '.htaccess'), 'utf8');
  await sftp.put(Buffer.from(htaccessWithAuth(appHtaccess, config)), remote('.htaccess'));
  console.log(config.auth ? '✔ Basic Auth (.htpasswd, .htaccess)' : '✔ .htaccess (no Basic Auth)');

  // 2) Changed application files, index.html and ngsw.json last
  for (const file of plan.upload) {
    const target = remote(file);
    const dir = path.posix.dirname(target);
    if (!(await sftp.exists(dir))) await sftp.mkdir(dir, true);
    await sftp.put(path.join(distDir, file), target);
  }
  console.log(`✔ Uploaded ${plan.upload.length} files (${plan.unchanged.length} unchanged skipped)`);

  // 3) Remove what is left over from older builds
  for (const file of plan.staleFiles) await sftp.delete(remote(file));
  for (const dir of plan.staleDirs) await sftp.rmdir(remote(dir), true);
  console.log(`✔ Removed ${plan.staleFiles.length} stale files, ${plan.staleDirs.length} stale directories`);
}

const authHeaders = (config) => config.auth
  ? { Authorization: `Basic ${Buffer.from(`${config.auth.user}:${config.auth.password}`).toString('base64')}` }
  : {};

// Reads the build info <meta> tags (scripts/build.mjs) from the index.html production serves
async function productionInfo(config) {
  const response = await fetch(`${config.siteUrl}/`, { headers: authHeaders(config), cache: 'no-store' });
  const html = await response.text();
  const meta = (name) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1] ?? null;
  return { status: response.status, version: meta('app-version'), revision: meta('app-revision'), builtAt: meta('app-built-at') };
}

const describeProduction = (info) => info.revision
  ? `${info.version || '(no release tag)'} – ${info.revision}, built ${info.builtAt}`
  : `unknown (HTTP ${info.status}, no build info in index.html)`;

async function verify(config, expectedRevision) {
  if (config.auth) {
    const anonymous = await fetch(`${config.siteUrl}/`);
    if (anonymous.status !== 401) throw new Error(`Site answers ${anonymous.status} without password – expected 401!`);
    console.log('✔ Without password: 401');
  }
  const info = await productionInfo(config);
  if (info.status !== 200 || info.revision !== expectedRevision) {
    throw new Error(`Deployed index.html does not report revision ${expectedRevision} (HTTP ${info.status}, got ${info.revision})`);
  }
  console.log(`✔ ${config.siteUrl} serves ${expectedRevision}`);
}

const config = loadConfig();
if (statusOnly) {
  console.log(`${config.target} (${config.siteUrl}): ${describeProduction(await productionInfo(config))}`);
  process.exit(0);
}
if (source === 'working' && git('status', '--porcelain') !== '') {
  console.warn('\n⚠️  WARNING: deploying the working copy WITH UNCOMMITTED CHANGES – the build will be marked as dirty.\n');
}

const { buildRoot, cleanup } = build();
try {
  const distDir = path.join(buildRoot, 'frontend', 'dist', 'frontend', 'browser');
  const info = JSON.parse(fs.readFileSync(path.join(distDir, 'build-info.json'), 'utf8'));
  const revision = `${info.branch}@${info.commit}${info.dirty ? '+dirty' : ''}`;

  const production = await productionInfo(config);
  if (production.status === 401 && !config.auth) {
    throw new Error(`${config.siteUrl} is behind Basic Auth, but .env has no ${TARGETS[config.target].prefix}_BASIC_AUTH_* – the deploy would make it public`);
  }
  const sftp = new SftpClient();
  await sftp.connect(config.sftp);
  let plan;
  try {
    plan = await planUpload(sftp, config, distDir);
    if (plan.foreign && !allowForeignContent) {
      throw new Error(`${config.siteUrl} web root contains files not deployed by this script (no build-info.json): `
        + `${plan.staleFiles.slice(0, 10).join(', ')}${plan.staleFiles.length > 10 ? ', …' : ''} – check them, then use --allow-foreign-content`);
    }
  } catch (error) {
    await sftp.end();
    throw error;
  }

  console.log('\n──────── Deploy summary ────────');
  console.log(`Target:     ${config.target} → ${config.siteUrl}`);
  console.log(`Now serves: ${describeProduction(production)}`);
  console.log(`Source:     ${source}${refArg ? ` ${refArg}` : ''}`);
  console.log(`Version:    ${info.tag ?? '(no release tag)'}${info.dance ? ` – ${info.dance.codename}` : ''}`);
  console.log(`Revision:   ${revision}`);
  console.log(`Members:    ${demo ? 'REAL (demo build, masked surnames)' : 'fictional'}`);
  console.log(`SFTP:       ${config.sftp.username}@${config.sftp.host}:${config.remoteDir}`);
  console.log(`Basic Auth: ${config.auth ? `yes (user ${config.auth.user})` : 'NO – site will be public'}`);
  console.log(`Files:      ${plan.upload.length} to upload, ${plan.unchanged.length} unchanged, ${plan.staleFiles.length} stale to delete`
    + `${plan.foreign ? ' (FOREIGN CONTENT – replaced on --allow-foreign-content)' : ''}`);
  console.log('────────────────────────────────\n');

  try {
    if (dryRun) {
      console.log('Dry run – nothing uploaded.');
    } else if (!assumeYes) {
      const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await prompt.question(`Deploy to ${config.siteUrl}? [y/N] `);
      prompt.close();
      if (answer.trim().toLowerCase() !== 'y') throw new Error('Cancelled.');
    }
    if (!dryRun) await upload(sftp, config, distDir, plan);
  } finally {
    await sftp.end();
  }

  if (!dryRun) {
    await verify(config, revision);
    console.log('\n✨ Deployed.');
  }
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
