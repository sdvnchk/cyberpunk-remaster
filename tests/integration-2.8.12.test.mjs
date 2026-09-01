import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('Forge work tabs stay sticky at every responsive width', () => {
  const css = read('styles/cyberpunk-forge.css');
  assert.match(
    css,
    /\.cpel-neon-forge-application\s+\.neon-forge-worktabs\s*\{[^}]*position\s*:\s*sticky\s*;/s,
    'worktabs must have a sticky base rule'
  );
  assert.doesNotMatch(
    css,
    /@media[^\{]*\{[\s\S]*?\.cpel-neon-forge-application\s+\.neon-forge-worktabs\s*\{[^}]*position\s*:\s*(?:relative|static|absolute|fixed)\s*;/,
    'responsive rules must not disable sticky positioning'
  );
});


test('2.8.12 metadata and changelog are synchronized', () => {
  const manifest = JSON.parse(read('module.json'));
  const pkg = JSON.parse(read('package.json'));
  const readme = read('README.md');
  const changelog = read('CHANGELOG.md');

  assert.equal(manifest.version, pkg.version);
  assert.match(readme, new RegExp(`Версия:\\s*\\*\\*${manifest.version.replaceAll('.', '\\.')}\\*\\*`, 'u'));
  assert.match(changelog, /^## 2\.8\.12\b/mu);
  assert.match(changelog, /sticky|закреп/iu);
});
