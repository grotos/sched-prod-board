// Copies app/ to dist/ and stamps the git sha of HEAD into index.html (R6).
import { execSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const sha = execSync('git rev-parse HEAD').toString().trim();
const dirty = execSync('git status --porcelain -- app').toString().trim();
if (dirty) {
  console.error('app/ has uncommitted changes; commit first so the sha names this build.');
  process.exit(1);
}
rmSync('dist', { recursive: true, force: true });
cpSync('app', 'dist', { recursive: true });
const html = readFileSync('dist/index.html', 'utf8').replaceAll('__BUILD_SHA__', sha);
writeFileSync('dist/index.html', html);
writeFileSync('dist/.nojekyll', '');
console.log(`dist/ built at ${sha}`);
