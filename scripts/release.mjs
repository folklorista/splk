import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();

const packagePath = path.join(rootDir, 'package.json');
const dancesPath = path.join(rootDir, 'data', 'release-dances.json');
const changelogPath = path.join(rootDir, 'public', 'changelog.json');

let dryRun = false;
let changeIndex = 2;

if (process.argv[2] === '--dry-run') {
  dryRun = true;
  changeIndex = 3;
}

const changes = process.argv.slice(changeIndex);

if (changes.length === 0) {
  console.error('Usage: npm run release -- [--dry-run] "Added admin CRUD" "Fixed mobile layout"');
  process.exit(1);
}

function calculateNextVersion() {
  const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentYearMonth = `${currentYear}.${currentMonth}`;

  if (changelog.length === 0) {
    return `v${currentYear}.${currentMonth}.0`;
  }

  const lastVersion = changelog[0].version;
  const match = lastVersion.match(/^v(\d{4})\.(\d{1,2})\.(\d+)$/);

  if (!match) {
    console.error(`Invalid version format in changelog: ${lastVersion}`);
    process.exit(1);
  }

  const [, lastYear, lastMonth, lastVersionNum] = match;
  const lastYearMonth = `${lastYear}.${lastMonth}`;

  if (lastYearMonth === currentYearMonth) {
    const nextVersionNum = parseInt(lastVersionNum, 10) + 1;
    return `v${currentYear}.${currentMonth}.${nextVersionNum}`;
  } else {
    return `v${currentYear}.${currentMonth}.0`;
  }
}

const nextVersion = calculateNextVersion();

const dances = JSON.parse(fs.readFileSync(dancesPath, 'utf8'));
const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));

const usedSlugs = new Set(changelog.map((entry) => entry.dance?.slug).filter(Boolean));

const nextDance = dances.find((dance) => !usedSlugs.has(dance.slug));

if (!nextDance) {
  console.error('No unused dance names left.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const newEntry = {
  version: nextVersion,
  releasedAt: today,
  dance: nextDance,
  changes,
};

const updatedChangelog = [newEntry, ...changelog];

const tagName = `${nextVersion}-${nextDance.slug}`;
const commitMessage = `chore: release ${nextVersion} ${nextDance.codename}`;

if (dryRun) {
  console.log('\n📋 DRY RUN — no files will be modified\n');
  console.log(`Version: ${nextVersion}`);
  console.log(`Dance (codename): ${nextDance.codename}`);
  console.log(`Dance (title): ${nextDance.title}`);
  console.log(`Dance URL: ${nextDance.url}`);
  console.log(`Release date: ${today}`);
  console.log(`\nChanges:`);
  changes.forEach((change, i) => console.log(`  ${i + 1}. ${change}`));
  console.log(`\nFiles to be modified:`);
  console.log(`  - ${changelogPath}`);
  console.log(`  - ${packagePath}`);
  console.log(`\nGit operations:`);
  console.log(`  git add public/changelog.json package.json`);
  console.log(`  git commit -m "${commitMessage}"`);
  console.log(`  git tag ${tagName}`);
  console.log('\n✅ Run without --dry-run to apply changes\n');
  process.exit(0);
}

fs.writeFileSync(changelogPath, JSON.stringify(updatedChangelog, null, 2) + '\n');

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.version = nextVersion.replace(/^v/, '');
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

spawnSync('git', ['add', 'public/changelog.json', 'package.json'], { stdio: 'inherit' });
spawnSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' });
spawnSync('git', ['tag', tagName], { stdio: 'inherit' });

console.log(`\n✨ Created release ${nextVersion} ${nextDance.codename}`);
console.log(`Git tag: ${tagName}`);
console.log(`Dance: ${nextDance.title}`);
console.log(`URL: ${nextDance.url}\n`);