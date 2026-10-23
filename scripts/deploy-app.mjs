// Deploys the API (api.vonica.cz) or Krojařka (krojarka.vonica.cz) over SFTP; deploy.mjs hands over --target api|krojarka.
// Usage: npm run deploy -- --target <api|krojarka> [--source working|commit | --ref <tag|branch|commit>] [--dry-run] [--yes] [--status]
//   working – current working copy incl. uncommitted changes (default); commit / --ref – clean temporary worktree
//   --dry-run – build and print the plan (incl. pending migrations), change nothing on the server
//   --yes     – skip the confirmations
//   --status  – only print which version the target serves now
//   --allow-foreign-content – the web root has files not deployed by this script (hosting placeholder); replace them
//   API only:
//   --init-config – the server has no config/config.php: generate it from .env and upload it (never overwrites, D-54)
//   --seed-admin  – after migrations run the FirstAdministrator seed (API_ADMIN_* from .env; does nothing when an admin exists)
//   --seed <A,B>  – after migrations run these data seeds, e.g. VonicaUnits,VonicaCatalog (each does nothing when its data exist)
// API steps (D-45, monorepo-struktura chap. 5): phinx status → pg_dump backup → phinx migrate → upload code → GET /v1/health.
// Migrations run from this machine in the Docker api container against production over TLS; never over HTTP.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import SftpClient from 'ssh2-sftp-client';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : undefined;
};
const flag = (name) => args.includes(name);
const refArg = option('--ref');
const source = refArg ? 'ref' : option('--source') ?? 'working';
const targetName = option('--target');
const assumeYes = flag('--yes');
const dryRun = flag('--dry-run');

const TARGETS = {
  api: { prefix: 'API', domain: 'api.vonica.cz' },
  krojarka: { prefix: 'KROJARKA', domain: 'krojarka.vonica.cz' },
};
const OTHER_ACCOUNT_PREFIXES = ['VONICA', 'DEMO', 'MOJE', 'API', 'KROJARKA'];
const HASHED_FILE = /-[A-Z0-9]{8}\.(js|css)$/;
// API: the only paths the deploy writes or cleans; config/ and storage/ are never touched (D-54)
const API_CODE_DIRS = ['vendor', 'src', 'public'];

class DeployError extends Error {}
const fail = (message) => {
  throw new DeployError(message);
};

const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: rootDir, encoding: 'utf8' }).trim();
const gitOk = (...gitArgs) => spawnSync('git', gitArgs, { cwd: rootDir, stdio: 'ignore' }).status === 0;

function run(command, commandArgs, { cwd = rootDir, capture = false, env, okCodes = [0] } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: env ?? process.env,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (!okCodes.includes(result.status)) fail(`${command} ${commandArgs.join(' ')} failed`);
  return capture ? result.stdout : null;
}

async function confirm(question) {
  if (assumeYes) return;
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`${question} [y/N] `);
  prompt.close();
  if (answer.trim().toLowerCase() !== 'y') fail('Cancelled.');
}

function loadConfig() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) fail('Missing .env – copy .env.example and fill it in.');
  const target = TARGETS[targetName];
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
  const sharedWith = OTHER_ACCOUNT_PREFIXES.filter((prefix) => prefix !== target.prefix && env[`${prefix}_SFTP_USER`] === value('SFTP_USER'));
  if (sharedWith.length) {
    fail(`${name('SFTP_USER')} is the same account as ${sharedWith.map((prefix) => `${prefix}_SFTP_USER`).join(', ')} – refusing to deploy`);
  }
  return {
    target: targetName,
    sftp: { host: value('SFTP_HOST'), port: Number(value('SFTP_PORT')), username: value('SFTP_USER'), password: value('SFTP_PASSWORD') },
    remoteDir: value('SFTP_REMOTE_DIR'),
    siteUrl: siteUrl.origin,
  };
}

// Working copy or a clean temporary worktree at the requested ref, plus the revision reported by the build
function prepareSource() {
  if (source === 'working') {
    const dirty = git('status', '--porcelain') !== '';
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    return { root: rootDir, revision: `${branch}@${git('rev-parse', '--short', 'HEAD')}${dirty ? '+dirty' : ''}`, cleanup: () => {} };
  }
  let ref;
  let branch;
  if (source === 'commit') {
    ref = 'HEAD';
    branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  } else if (source === 'ref') {
    if (!gitOk('rev-parse', '--verify', '--quiet', `${refArg}^{commit}`)) fail(`Unknown --ref ${refArg}`);
    ref = refArg;
    branch = gitOk('show-ref', '--verify', '--quiet', `refs/heads/${refArg}`) ? refArg : 'detached';
  } else {
    fail(`Unknown --source ${source} (working|commit)`);
  }
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'splk-deploy-'));
  run('git', ['worktree', 'add', '--detach', worktree, ref]);
  const cleanup = () => run('git', ['worktree', 'remove', '--force', worktree]);
  return { root: worktree, revision: `${branch}@${git('rev-parse', '--short', ref)}`, cleanup };
}

function listLocalFiles(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listLocalFiles(path.join(dir, entry.name), relative) : [relative];
  });
}

async function listRemote(sftp, dir, prefix = '') {
  const result = { files: [], dirs: [] };
  if (!(await sftp.exists(dir))) return result;
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

// Uploads files (0644, directories 0755 – the hosting default is 0666) and removes stale ones under remoteBase
async function syncDir(sftp, localDir, remoteBase, files, { skip = new Set(), last = [] } = {}) {
  const ordered = [...files].sort((a, b) => last.indexOf(a) - last.indexOf(b));
  const madeDirs = new Set();
  for (const file of ordered) {
    if (skip.has(file)) continue;
    const target = path.posix.join(remoteBase, file);
    const dir = path.posix.dirname(target);
    if (!madeDirs.has(dir)) {
      if (!(await sftp.exists(dir))) await sftp.mkdir(dir, true);
      await sftp.chmod(dir, 0o755);
      madeDirs.add(dir);
    }
    await sftp.put(path.join(localDir, file), target);
    await sftp.chmod(target, 0o644);
  }
}

async function removeStale(sftp, remoteBase, remote, localFiles) {
  const local = new Set(localFiles);
  const localDirs = new Set(localFiles.flatMap((file) => {
    const parts = file.split('/').slice(0, -1);
    return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
  }));
  const staleFiles = remote.files.filter((file) => !local.has(file));
  const staleDirs = remote.dirs.filter((dir) => !localDirs.has(dir)).sort((a, b) => b.length - a.length);
  for (const file of staleFiles) await sftp.delete(path.posix.join(remoteBase, file));
  for (const dir of staleDirs) await sftp.rmdir(path.posix.join(remoteBase, dir), true);
  return staleFiles.length;
}

function printSummary(rows) {
  console.log('\n──────── Deploy summary ────────');
  for (const [label, value] of rows) console.log(`${`${label}:`.padEnd(12)}${value}`);
  console.log('────────────────────────────────\n');
}

// ───────────────────────── Krojařka ─────────────────────────

async function krojarkaInfo(config) {
  const response = await fetch(`${config.siteUrl}/`, { cache: 'no-store' });
  const html = await response.text();
  const meta = (name) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1] ?? null;
  return { status: response.status, revision: meta('app-revision'), builtAt: meta('app-built-at') };
}

function buildKrojarka(src) {
  if (Number(process.versions.node.split('.')[0]) < 24) fail(`Krojařka needs Node.js 24 (D-47), this is ${process.version} – run "nvm use" first.`);
  if (src.root !== rootDir) fs.symlinkSync(path.join(rootDir, 'node_modules'), path.join(src.root, 'node_modules'));
  const appDir = path.join(src.root, 'apps', 'krojarka');
  run('npx', ['ng', 'build', '--configuration', 'production'], { cwd: appDir });
  const distDir = path.join(appDir, 'dist', 'krojarka', 'browser');

  const builtAt = new Date().toISOString();
  fs.writeFileSync(path.join(distDir, 'build-info.json'), `${JSON.stringify({ revision: src.revision, builtAt }, null, 2)}\n`);
  const meta = `  <meta name="app-revision" content="${src.revision}">\n  <meta name="app-built-at" content="${builtAt}">\n`;
  const indexPath = path.join(distDir, 'index.html');
  fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replace('</head>', `${meta}</head>`));
  return distDir;
}

async function deployKrojarka(config) {
  const src = prepareSource();
  try {
    const distDir = buildKrojarka(src);
    const files = listLocalFiles(distDir);
    const production = await krojarkaInfo(config);

    const sftp = new SftpClient();
    await sftp.connect(config.sftp);
    try {
      const remote = await listRemote(sftp, config.remoteDir);
      const remoteSet = new Set(remote.files);
      const foreign = remote.files.length > 0 && !remoteSet.has('build-info.json');
      if (foreign && !flag('--allow-foreign-content')) {
        fail(`${config.siteUrl} web root contains files not deployed by this script: ${remote.files.slice(0, 10).join(', ')} – check them, then use --allow-foreign-content`);
      }
      const skip = new Set(files.filter((file) => HASHED_FILE.test(file) && remoteSet.has(file)));
      const stale = remote.files.filter((file) => !files.includes(file));

      printSummary([
        ['Target', `krojarka → ${config.siteUrl}`],
        ['Now serves', production.revision ? `${production.revision}, built ${production.builtAt}` : `unknown (HTTP ${production.status})`],
        ['Revision', src.revision],
        ['SFTP', `${config.sftp.username}@${config.sftp.host}:${config.remoteDir}`],
        ['Files', `${files.length - skip.size} to upload, ${skip.size} unchanged, ${stale.length} stale to delete${foreign ? ' (FOREIGN CONTENT)' : ''}`],
      ]);
      if (dryRun) {
        console.log('Dry run – nothing uploaded.');
        return;
      }
      await confirm(`Deploy to ${config.siteUrl}?`);

      // index.html last, so a client never gets an index pointing to chunks that are not there yet
      await syncDir(sftp, distDir, config.remoteDir, files, { skip, last: ['build-info.json', 'index.html'] });
      console.log(`✔ Uploaded ${files.length - skip.size} files`);
      console.log(`✔ Removed ${await removeStale(sftp, config.remoteDir, remote, files)} stale files`);
    } finally {
      await sftp.end();
    }

    const info = await krojarkaInfo(config);
    if (info.status !== 200 || info.revision !== src.revision) fail(`${config.siteUrl} does not report ${src.revision} (HTTP ${info.status}, got ${info.revision})`);
    const route = await fetch(`${config.siteUrl}/prihlaseni`);
    const missing = await fetch(`${config.siteUrl}/chunk-MISSING0.js`);
    if (route.status !== 200 || missing.status !== 404) fail(`SPA fallback: /prihlaseni → ${route.status}, missing chunk → ${missing.status} (expected 200 / 404)`);
    console.log(`✔ ${config.siteUrl} serves ${src.revision}; app route 200, missing asset 404`);
    console.log('\n✨ Deployed.');
  } finally {
    src.cleanup();
  }
}

// ───────────────────────── API ─────────────────────────

async function apiHealth(config) {
  try {
    const response = await fetch(`${config.siteUrl}/v1/health`, { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch (error) {
    return { status: 0, body: null, error: error.message };
  }
}

const describeHealth = (health) => health.body?.version
  ? `${health.body.version}, migration ${health.body.migration?.version ?? 'none'} (${health.body.status})`
  : `unknown (HTTP ${health.status})`;

const PG_KEYS = ['PG_HOST', 'PG_PORT', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD'];

// Phinx from the dev vendor of the api container, with phinx.php and migrations of the deployed source (/deploy)
function phinx(staging, phinxArgs, extraEnv = {}, okCodes = [0]) {
  const envNames = [...PG_KEYS, ...Object.keys(extraEnv)];
  const output = run('docker', [
    'compose', 'run', '--rm', '--no-deps', '-T', '-v', `${staging}:/deploy`,
    ...envNames.flatMap((key) => ['-e', key]),
    'api', 'vendor/bin/phinx', ...phinxArgs, '-c', '/deploy/phinx.php', '-e', 'production',
  ], { capture: true, env: { ...process.env, ...extraEnv }, okCodes });
  return output.toString('utf8');
}

function migrationStatus(staging) {
  // phinx status exits 2 with missing and 3 with pending migrations; the JSON says which
  const output = phinx(staging, ['status', '--format', 'json'], {}, [0, 2, 3]);
  const json = output.split('\n').reverse().find((line) => line.startsWith('{'));
  if (!json) fail(`Unexpected phinx status output:\n${output}`);
  return JSON.parse(json);
}

// pg_dump 18 over TLS into dev/local/backups (git-ignored), checked to be a non-empty dump
function backupDatabase() {
  const env = {
    ...process.env,
    PGHOST: process.env.PG_HOST, PGPORT: process.env.PG_PORT, PGDATABASE: process.env.PG_DATABASE,
    PGUSER: process.env.PG_USER, PGPASSWORD: process.env.PG_PASSWORD, PGSSLMODE: 'require',
  };
  const dump = run('docker', [
    'run', '--rm', ...['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE'].flatMap((key) => ['-e', key]),
    'postgres:18', 'pg_dump', '--no-owner', '--no-privileges',
  ], { capture: true, env });
  if (dump.length < 100 || !dump.toString('utf8', 0, 200).includes('PostgreSQL database dump')) fail('pg_dump returned no usable dump – migration stopped');
  const dir = path.join(rootDir, 'dev', 'local', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `api-${new Date().toISOString().replace(/[:.]/g, '-')}.sql.gz`);
  fs.writeFileSync(file, zlib.gzipSync(dump));
  return { file: path.relative(rootDir, file), size: dump.length };
}

const phpString = (value) => `'${String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// config/config.php for the hosting from .env (structure of api/config/config.example.php)
function hostingConfig() {
  const env = process.env;
  const missing = [...PG_KEYS, 'KROJARKA_EMAIL_ADDRESS', 'KROJARKA_EMAIL_PASSWORD'].filter((key) => !env[key]);
  if (missing.length) fail(`--init-config needs in .env: ${missing.join(', ')}`);
  return `<?php

// Generated by scripts/deploy-app.mjs --init-config on ${new Date().toISOString()}. Never overwritten by deploy (D-54).

return [
    'db' => [
        'host' => ${phpString(env.PG_HOST)},
        'port' => ${Number(env.PG_PORT) || 5432},
        'database' => ${phpString(env.PG_DATABASE)},
        'user' => ${phpString(env.PG_USER)},
        'password' => ${phpString(env.PG_PASSWORD)},
        // the hosting reaches PostgreSQL over the provider's private network, which offers no TLS (Q-11)
        'sslmode' => 'prefer',
    ],
    'app' => [
        'krojarkaUrl' => 'https://krojarka.vonica.cz',
    ],
    'mail' => [
        'transport' => 'smtp',
        'host' => ${phpString(env.KROJARKA_EMAIL_SMTP_HOST || 'smtp.websupport.cz')},
        'port' => ${Number(env.KROJARKA_EMAIL_SMTP_PORT) || 465},
        'secure' => 'ssl',
        'username' => ${phpString(env.KROJARKA_EMAIL_ADDRESS)},
        'password' => ${phpString(env.KROJARKA_EMAIL_PASSWORD)},
        'from' => ${phpString(env.KROJARKA_EMAIL_ADDRESS)},
        'fromName' => 'Krojařka',
    ],
    'cors' => [
        'allowedOrigins' => ['https://krojarka.vonica.cz'],
    ],
    'session' => [
        'cookieName' => '__Host-vonica_sid',
        'cookieSecure' => true,
        'absoluteLifetime' => 30 * 24 * 3600,
        'idleTimeout' => 14 * 24 * 3600,
    ],
];
`;
}

// Copy of the api sources with production dependencies only; the dev vendor of the working copy stays untouched
function buildApi(src) {
  if (!fs.existsSync(path.join(rootDir, 'api', 'vendor', 'bin', 'phinx'))) fail('api/vendor is missing – run "npm run api:install" first.');
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'splk-api-'));
  for (const entry of ['public', 'src', 'db', 'phinx.php', 'composer.json', 'composer.lock']) {
    fs.cpSync(path.join(src.root, 'api', entry), path.join(staging, entry), { recursive: true });
  }
  run('docker', ['compose', 'run', '--rm', '--no-deps', '-T', '-v', `${staging}:/deploy`, '-w', '/deploy', 'api',
    'composer', 'install', '--no-dev', '--optimize-autoloader', '--no-interaction', '--no-progress']);
  fs.writeFileSync(path.join(staging, 'build-info.json'), `${JSON.stringify({ version: src.revision, builtAt: new Date().toISOString() }, null, 2)}\n`);
  const latestMigration = fs.readdirSync(path.join(staging, 'db', 'migrations')).map((file) => file.split('_')[0]).sort().at(-1);
  return { staging, latestMigration, cleanup: () => fs.rmSync(staging, { recursive: true, force: true }) };
}

async function deployApi(config) {
  const dataSeeds = (option('--seed') ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  const unknownSeeds = dataSeeds.filter((name) => !/^[A-Z][A-Za-z]+$/.test(name) || !fs.existsSync(path.join(rootDir, 'api', 'db', 'seeds', `${name}.php`)));
  if (unknownSeeds.length) fail(`Unknown seed(s): ${unknownSeeds.join(', ')}`);
  const missingPg = PG_KEYS.filter((key) => !process.env[key]);
  if (missingPg.length) fail(`Missing in .env: ${missingPg.join(', ')}`);
  const src = prepareSource();
  let build;
  try {
    build = buildApi(src);
    const { staging } = build;
    const production = await apiHealth(config);
    const status = migrationStatus(staging);
    if (status.missing_count > 0) fail('Production has migrations that this source does not know – deploying older code? Stopped.');
    const pending = status.migrations.filter((m) => m.migration_status === 'down');

    const sftp = new SftpClient();
    await sftp.connect(config.sftp);
    try {
      const remoteRoot = config.remoteDir;
      const hasConfig = await sftp.exists(path.posix.join(remoteRoot, 'config', 'config.php'));
      const hasBuildInfo = await sftp.exists(path.posix.join(remoteRoot, 'build-info.json'));
      const remotePublic = await listRemote(sftp, path.posix.join(remoteRoot, 'public'));
      if (!hasConfig && !flag('--init-config')) fail('config/config.php is missing on the server – rerun with --init-config (generated from .env) or upload it by hand.');
      if (!hasBuildInfo && remotePublic.files.length && !flag('--allow-foreign-content')) {
        fail(`public/ on the server has files not deployed by this script: ${remotePublic.files.join(', ')} – check them, then use --allow-foreign-content`);
      }
      const codeFiles = Object.fromEntries(API_CODE_DIRS.map((dir) => [dir, listLocalFiles(path.join(staging, dir))]));

      printSummary([
        ['Target', `api → ${config.siteUrl}`],
        ['Now serves', describeHealth(production)],
        ['Revision', src.revision],
        ['Migrations', pending.length ? pending.map((m) => `${m.migration_id} ${m.migration_name}`).join(', ') : 'none pending'],
        ['Seed admin', flag('--seed-admin') ? `yes (${process.env.API_ADMIN_EMAIL || 'API_ADMIN_EMAIL missing!'})` : 'no'],
        ['Seeds', dataSeeds.length ? dataSeeds.join(', ') : 'none'],
        ['Config', hasConfig ? 'config/config.php present (kept)' : 'MISSING – will be generated from .env (--init-config)'],
        ['SFTP', `${config.sftp.username}@${config.sftp.host}:${remoteRoot}`],
        ['Files', API_CODE_DIRS.map((dir) => `${dir}/ ${codeFiles[dir].length}`).join(', ') + ' + build-info.json'],
      ]);
      if (dryRun) {
        console.log('Dry run – nothing changed.');
        return;
      }

      // 1) Configuration (only when absent)
      if (!hasConfig) {
        await confirm('Upload config/config.php generated from .env?');
        const configDir = path.posix.join(remoteRoot, 'config');
        if (!(await sftp.exists(configDir))) await sftp.mkdir(configDir, true);
        await sftp.put(Buffer.from(hostingConfig()), path.posix.join(configDir, 'config.php'));
        await sftp.chmod(path.posix.join(configDir, 'config.php'), 0o644);
        console.log('✔ config/config.php uploaded');
      }

      // 2) Backup and migrations
      if (pending.length) {
        await confirm(`Back up the production database and apply ${pending.length} migration(s)?`);
        const backup = backupDatabase();
        console.log(`✔ Backup ${backup.file} (${Math.round(backup.size / 1024)} kB uncompressed)`);
        process.stdout.write(phinx(staging, ['migrate']));
        const after = migrationStatus(staging);
        if (after.pending_count !== 0) fail('Migrations still pending after phinx migrate – stopped before uploading code.');
        console.log('✔ Migrations applied');
      }
      if (flag('--seed-admin')) {
        const adminEnv = { ADMIN_EMAIL: process.env.API_ADMIN_EMAIL, ADMIN_FIRST_NAME: process.env.API_ADMIN_FIRST_NAME, ADMIN_LAST_NAME: process.env.API_ADMIN_LAST_NAME };
        if (Object.values(adminEnv).some((value) => !value)) fail('--seed-admin needs API_ADMIN_EMAIL, API_ADMIN_FIRST_NAME and API_ADMIN_LAST_NAME in .env');
        await confirm(`Create the first organization.admin account ${adminEnv.ADMIN_EMAIL} (only if none exists)?`);
        process.stdout.write(phinx(staging, ['seed:run', '-s', 'FirstAdministrator'], adminEnv));
      }

      if (dataSeeds.length) {
        await confirm(`Run seeds ${dataSeeds.join(', ')} on production (each skips existing data)?`);
        process.stdout.write(phinx(staging, ['seed:run', ...dataSeeds.flatMap((name) => ['-s', name])]));
      }

      // 3) Code: vendor and src first, build info, public/ (the entry point) last; config/ and storage/ untouched
      await confirm(`Upload the API code to ${config.siteUrl}?`);
      for (const dir of API_CODE_DIRS) {
        const remoteDir = path.posix.join(remoteRoot, dir);
        const remote = await listRemote(sftp, remoteDir);
        if (dir === 'public') {
          await sftp.put(path.join(staging, 'build-info.json'), path.posix.join(remoteRoot, 'build-info.json'));
          await sftp.chmod(path.posix.join(remoteRoot, 'build-info.json'), 0o644);
        }
        await syncDir(sftp, path.join(staging, dir), remoteDir, codeFiles[dir], { last: ['index.php'] });
        const removed = await removeStale(sftp, remoteDir, remote, codeFiles[dir]);
        console.log(`✔ ${dir}/: ${codeFiles[dir].length} files uploaded, ${removed} stale removed`);
      }
      const storage = path.posix.join(remoteRoot, 'storage', 'attachments');
      if (!(await sftp.exists(storage))) await sftp.mkdir(storage, true);
    } finally {
      await sftp.end();
    }

    // 4) Verification
    const health = await apiHealth(config);
    if (health.status !== 200 || health.body?.version !== src.revision || health.body?.migration?.version !== build.latestMigration) {
      fail(`/v1/health does not report ${src.revision} with migration ${build.latestMigration}: HTTP ${health.status} ${JSON.stringify(health.body)}`);
    }
    console.log(`✔ ${config.siteUrl}/v1/health: ${describeHealth(health)}`);
    console.log('\n✨ Deployed.');
  } finally {
    build?.cleanup();
    src.cleanup();
  }
}

// ───────────────────────── main ─────────────────────────

try {
  if (!TARGETS[targetName]) fail(`deploy-app.mjs handles --target ${Object.keys(TARGETS).join('|')}`);
  const config = loadConfig();
  if (flag('--status')) {
    const description = targetName === 'api'
      ? describeHealth(await apiHealth(config))
      : await krojarkaInfo(config).then((info) => (info.revision ? `${info.revision}, built ${info.builtAt}` : `unknown (HTTP ${info.status})`));
    console.log(`${targetName} (${config.siteUrl}): ${description}`);
  } else if (targetName === 'api') {
    await deployApi(config);
  } else {
    await deployKrojarka(config);
  }
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  if (!(error instanceof DeployError)) console.error(error.stack);
  process.exitCode = 1;
}
