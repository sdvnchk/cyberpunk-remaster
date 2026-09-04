import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const neo = fs.readFileSync(path.join(ROOT, 'runtime/neo-archive-controller.mjs'), 'utf8');
const mapCss = fs.readFileSync(path.join(ROOT, 'styles/world-city-map.css'), 'utf8');
const leafletCss = fs.readFileSync(path.join(ROOT, 'vendor/leaflet/leaflet.css'), 'utf8');

function responsiveBlock() {
  const marker = '/* 2.8.55 — compact nav overlay and clickable map editor */';
  const start = neo.indexOf(marker);
  assert.ok(start >= 0, '2.8.55 responsive override block must exist');
  return neo.slice(start, neo.indexOf('</style>', start));
}

test('2.8.55 compact Neo navigation expands as an overlay when nav-collapsed is off', () => {
  const css = responsiveBlock();
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) \.pcm-layout\{[\s\S]{0,260}grid-template-columns:minmax\(0,1fr\) 0!important/u);
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) aside\{[\s\S]{0,420}position:absolute!important/u);
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) aside\{[\s\S]{0,520}width:min\(280px,72%\)!important/u);
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) aside>button>span[\s\S]{0,220}display:block!important/u);
  assert.match(css, /\.pcm-window\.is-compact:not\(\.nav-collapsed\) \.pcm-caption[\s\S]{0,220}display:block!important/u);
});

test('2.8.55 compact Neo navigation remains icon-only only while nav-collapsed is on', () => {
  const css = responsiveBlock();
  assert.match(css, /\.pcm-window\.is-compact\.nav-collapsed \.pcm-layout[\s\S]{0,240}grid-template-columns:minmax\(0,1fr\) 58px!important/u);
  assert.match(css, /\.pcm-window\.is-compact\.nav-collapsed aside>button>span[\s\S]{0,220}display:none!important/u);
});

test('2.8.55 map editor sits above every Leaflet pane and accepts pointer input', () => {
  const leafletPaneZ = Number(leafletCss.match(/\.leaflet-pane\s*\{\s*z-index:\s*(\d+)/u)?.[1] ?? 0);
  const inspectorRule = mapCss.match(/\.world-city-map-inspector\s*\{([^}]*)\}/u)?.[1] ?? '';
  const inspectorZ = Number(inspectorRule.match(/z-index:\s*(\d+)/u)?.[1] ?? 0);
  assert.ok(leafletPaneZ >= 400, 'Leaflet pane baseline should be detected');
  assert.ok(inspectorZ > 700, `map inspector z-index ${inspectorZ} must stay above Leaflet interactive panes`);
  assert.match(inspectorRule, /pointer-events:\s*none/u);
  assert.match(mapCss, /\.world-city-map-detail,\.world-city-map-editor\{[^}]*pointer-events:\s*auto/u);
});
