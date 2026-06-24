import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

const source = path.join(rootDir, 'public', 'changelog.json');
const target = path.join(rootDir, 'frontend', 'public', 'changelog.json');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);

console.log('Synced changelog.json to frontend/public/changelog.json');