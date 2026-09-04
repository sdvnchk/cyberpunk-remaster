import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const neo = fs.readFileSync(path.join(ROOT, 'runtime/neo-archive-controller.mjs'), 'utf8');

function restoreBlock() {
  const marker = '/* 2.8.56 — explicit nav collapse only; restore compact top labels */';
  const start = neo.indexOf(marker);
  assert.ok(start >= 0, '2.8.56 final restore block must exist');
  return neo.slice(start, neo.indexOf('</style>', start));
}

test('2.8.56 compact width keeps the full right navigation until the user explicitly collapses it', () => {
  const css = restoreBlock();
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) \.pcm-layout\{[\s\S]{0,300}grid-template-columns:minmax\(0,1fr\) clamp\(220px,30%,290px\)!important/u);
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) aside\{[\s\S]{0,320}position:static!important/u);
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) aside\{[\s\S]{0,420}width:auto!important/u);
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) aside>button>span[\s\S]{0,180}display:block!important/u);
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) \.pcm-caption[\s\S]{0,180}display:block!important/u);
});

test('2.8.56 only nav-collapsed produces the icon-only strip', () => {
  const css = restoreBlock();
  assert.match(css, /\.pcm-window\.nav-collapsed \.pcm-layout\{[\s\S]{0,260}grid-template-columns:minmax\(0,1fr\) 58px!important/u);
  assert.match(css, /\.pcm-window\.nav-collapsed aside>button>span[\s\S]{0,220}display:none!important/u);
  assert.match(css, /\.pcm-window\.is-narrow\.nav-collapsed \.pcm-layout\{[\s\S]{0,180}grid-template-columns:minmax\(0,1fr\) 50px!important/u);
  assert.match(css, /\.pcm-window\.is-tiny\.nav-collapsed \.pcm-layout\{[\s\S]{0,180}grid-template-columns:minmax\(0,1fr\) 44px!important/u);
});

test('2.8.56 compact top HUD buttons keep their text labels and wrap instead of becoming icon-only', () => {
  const css = restoreBlock();
  assert.match(css, /\.pcm-window\.is-compact \.pcm-top-actions\{[\s\S]{0,220}flex-wrap:wrap!important/u);
  assert.match(css, /\.pcm-window\.is-compact \.pcm-top-actions>button span\{[\s\S]{0,140}display:inline!important/u);
  assert.match(css, /\.pcm-window\.is-compact \.pcm-top-actions>button:not\(\.pcm-window-toggle\):not\(\.pcm-close\)\{[\s\S]{0,260}width:auto!important/u);
  assert.match(css, /\.pcm-window\.is-compact \.pcm-top-actions>button:not\(\.pcm-window-toggle\):not\(\.pcm-close\)\{[\s\S]{0,320}max-width:none!important/u);
});
