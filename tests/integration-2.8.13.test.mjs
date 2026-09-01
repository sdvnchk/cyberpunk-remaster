import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('Forge work tabs live outside the scrolling body', () => {
  const template = read('templates/cyberpunk-forge.hbs');
  const css = read('styles/cyberpunk-forge.css');
  const runtime = read('forge/forge-runtime.mjs');

  assert.match(
    template,
    /<div class="cyberpunk-forge-main-column">\s*<nav class="neon-forge-worktabs"[\s\S]*?<\/nav>\s*<main class="cyberpunk-forge-body">/u,
    'the tabs must be a sibling above the scrolling body, not a child of it',
  );
  assert.match(
    css,
    /\.cpel-neon-forge-application\s+\.cyberpunk-forge-main-column\s*\{[^}]*display\s*:\s*grid\s*;[^}]*grid-template-rows\s*:\s*auto\s+minmax\(0\s*,\s*1fr\)\s*;[^}]*overflow\s*:\s*hidden\s*;/s,
    'the left column must reserve a fixed row for tabs and a bounded row for content',
  );
  assert.match(
    css,
    /\.cpel-neon-forge-application\s+\.cyberpunk-forge-body\s*\{[^}]*overflow\s*:\s*auto\s*;/s,
    'only the body below the tabs should own the desktop scroll',
  );
  assert.match(
    runtime,
    /scrollable:\s*\["\.cyberpunk-forge-body"\]/u,
    'ApplicationV2 scroll restoration must continue to target the content body',
  );
});

test('2.8.13 metadata and changelog are synchronized', () => {
  const manifest = JSON.parse(read('module.json'));
  const pkg = JSON.parse(read('package.json'));
  const readme = read('README.md');
  const changelog = read('CHANGELOG.md');

  assert.equal(manifest.version, '2.8.13');
  assert.equal(pkg.version, '2.8.13');
  assert.match(readme, /Версия:\s*\*\*2\.8\.13\*\*/u);
  assert.match(changelog, /^## 2\.8\.13\b/mu);
  assert.match(changelog, /прокруч|scroll|панел/iu);
});
