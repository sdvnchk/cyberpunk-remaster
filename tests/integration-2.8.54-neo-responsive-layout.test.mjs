import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const source = fs.readFileSync(path.join(ROOT, 'runtime/neo-archive-controller.mjs'), 'utf8');

function finalResponsiveBlock() {
  const marker = '/* 2.8.54 — window-width responsive repair */';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, '2.8.54 final responsive block must exist');
  return source.slice(start, source.indexOf('</style>', start));
}

test('2.8.54 Neo Archive enters compact mode before its content column can collapse', () => {
  assert.match(source, /classList\.toggle\("is-compact",\s*!p\.minimized && visibleWidth < 1180\)/u);
  assert.match(source, /classList\.toggle\("is-narrow",\s*!p\.minimized && visibleWidth < 820\)/u);
  assert.match(source, /classList\.toggle\("is-tiny",\s*!p\.minimized && visibleWidth < 560\)/u);
});

test('2.8.54 final CSS always keeps main content first and navigation on the right', () => {
  const css = finalResponsiveBlock();
  assert.match(css, /\.pcm-window:not\(\.is-compact\):not\(\.nav-collapsed\) \.pcm-layout\{[\s\S]{0,260}grid-template-columns:minmax\(0,1fr\) clamp\(225px,28%,290px\)!important/u);
  assert.match(css, /\.pcm-window\.is-compact \.pcm-layout[\s\S]{0,200}grid-template-columns:minmax\(0,1fr\) 58px!important/u);
  assert.match(css, /\.pcm-window\.is-narrow \.pcm-layout[\s\S]{0,200}grid-template-columns:minmax\(0,1fr\) 50px!important/u);
  assert.match(css, /\.pcm-window\.is-tiny \.pcm-layout[\s\S]{0,200}grid-template-columns:minmax\(0,1fr\) 44px!important/u);
});

test('2.8.54 compact section headings cannot collapse into one-letter vertical text', () => {
  const css = finalResponsiveBlock();
  assert.match(css, /\.pcm-window\.is-compact \.pcm-section-head h1[\s\S]{0,260}white-space:nowrap!important/u);
  assert.match(css, /\.pcm-window\.is-compact \.pcm-section-head h1[\s\S]{0,320}word-break:normal!important/u);
  assert.match(css, /\.pcm-window\.is-compact \.pcm-section-head h1[\s\S]{0,380}overflow-wrap:normal!important/u);
  assert.match(css, /\.pcm-window\.is-compact \.pcm-section-head>div:first-child[\s\S]{0,160}min-width:0!important/u);
});

test('2.8.54 quick binding picker sizes against the archive window and reflows result rows', () => {
  const css = finalResponsiveBlock();
  assert.match(css, /\.pcm-window\.is-compact \.pcm-contact-picker[\s\S]{0,220}width:min\(680px,100%\)!important/u);
  assert.match(css, /\.pcm-window\.is-narrow \.pcm-picker-list>button[\s\S]{0,220}grid-template-columns:40px minmax\(0,1fr\)!important/u);
  assert.match(css, /\.pcm-window\.is-narrow \.pcm-picker-list>button>strong[\s\S]{0,240}grid-column:2!important/u);
  assert.match(css, /\.pcm-window\.is-tiny \.pcm-contact-picker[\s\S]{0,220}max-height:100%!important/u);
});
