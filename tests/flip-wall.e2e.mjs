// Flip Wall E2E テスト。リポジトリルートで:  node tests/flip-wall.e2e.mjs
// 依存: npm i playwright-core（Chromium 実体は CHROMIUM_PATH で指定可）
// 詳細な運用手順・目視チェック観点は docs/flip-wall-handover.md を参照。
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// スクリーンショット類は tests/output/ に出す（.gitignore 済み）
const outDir = join(root, 'tests', 'output');
mkdirSync(outDir, { recursive: true });
process.chdir(outDir);
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(8939, r));

const executablePath = process.env.CHROMIUM_PATH
  ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const fails = [];
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ': ' + name); if (!cond) fails.push(name); };

await page.goto('http://localhost:8939/games/flip-wall/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check('canvas present', await page.$('canvas.gl') !== null);
const grid = await page.evaluate(() => window.__wall.grid());
console.log('grid:', JSON.stringify(grid), 'aspect:', await page.evaluate(() => window.__wall.aspect()));
check('cube count near target', grid.n > 4000 && grid.n < 5600);

const brightness = await page.evaluate(() => {
  const gl = document.querySelector('canvas.gl');
  const c = document.createElement('canvas');
  c.width = 160; c.height = 90;
  const g = c.getContext('2d');
  g.drawImage(gl, 0, 0, 160, 90);
  const d = g.getImageData(0, 0, 160, 90).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
  return sum / (d.length / 4);
});
console.log('avg brightness:', brightness.toFixed(1));
check('wall renders', brightness > 10);
await page.screenshot({ path: 'wall-0-default.png' });

// ---- 番号+矢印のテスト画像を6枚ロード（向き検証用）----
// 横長 4:3 の画像でアスペクト追従も同時に検証
await page.evaluate(async () => {
  function testImg(n, color) {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 600;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 800, 600);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.font = 'bold 300px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 400, 330);
    // 上向き矢印
    g.beginPath();
    g.moveTo(400, 30); g.lineTo(340, 120); g.lineTo(460, 120); g.closePath();
    g.fill();
    // 左上に白角(ミラー検出用)
    g.fillRect(20, 20, 90, 90);
    return c.toDataURL('image/png');
  }
  const colors = ['#a03030', '#308030', '#3040a0', '#907020', '#803090', '#207880'];
  for (let i = 0; i < 6; i++) {
    await new Promise(r => window.__wall.loadDataURL(i, testImg(i + 1, colors[i]), r));
  }
});
await page.waitForTimeout(600);
const aspect2 = await page.evaluate(() => window.__wall.aspect());
console.log('aspect after landscape upload:', aspect2.toFixed(2));
check('aspect follows first user image', Math.abs(aspect2 - 800 / 600) < 0.05);
check('active set = 6 user images', (await page.evaluate(() => window.__wall.activeSet().length)) === 6);

// 各面に切り替えて向きを目視検証するスクリーンショット
for (let k = 0; k < 6; k++) {
  await page.evaluate(i => window.__wall.switchTo(i), k);
  // アニメ完了待ち: animating が 0 になるまで
  for (let w = 0; w < 40; w++) {
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => window.__wall.animating())) === 0) break;
  }
  check(`switched to ${k}`, (await page.evaluate(() => window.__wall.current())) === k);
  await page.screenshot({ path: `wall-face-${k + 1}.png` });
}
console.log('trigger cost ms:', await page.evaluate(() => window.__wall.triggerMs().toFixed(1)));

// ---- フリップパターン: 各パターンで切り替え完了すること ----
for (const pat of ['ripple', 'sweep', 'spiral', 'random', 'assemble']) {
  const target = (await page.evaluate(() => window.__wall.current()) + 1) % 6;
  await page.evaluate(({ t, p }) => window.__wall.trigger(t, p), { t: target, p: pat });
  await page.waitForTimeout(250);
  const animMid = await page.evaluate(() => window.__wall.animating());
  for (let w = 0; w < 60; w++) {
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => window.__wall.animating())) === 0) break;
  }
  const cur = await page.evaluate(() => window.__wall.current());
  check(`pattern ${pat} completes`, cur === target && animMid > 0);
}

// 集合パターンの中間ショット（目視確認用）
await page.evaluate(() => {
  const t = (window.__wall.current() + 1) % 6;
  window.__wall.trigger(t, 'assemble');
  return new Promise(r => setTimeout(() => {
    window.__shot1 = document.querySelector('canvas.gl').toDataURL('image/png');
    r();
  }, 700));
});
{
  const data = await page.evaluate(() => window.__shot1);
  const { writeFileSync } = await import('fs');
  writeFileSync('wall-assemble-mid.png', Buffer.from(data.split(',')[1], 'base64'));
}
for (let w = 0; w < 60; w++) {
  await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__wall.animating())) === 0) break;
}

// ---- シネマカメラ ----
check('cam starts front', (await page.evaluate(() => window.__wall.camMode())) === 'front');
await page.evaluate(() => window.__wall.toggleCamera());
check('cam toggles to cinema', (await page.evaluate(() => window.__wall.camMode())) === 'cinema');
const cp1 = await page.evaluate(() => window.__wall.camPos());
await page.waitForTimeout(3500); // 低fps環境＋イーズインを考慮して長めに待つ
const cp2 = await page.evaluate(() => window.__wall.camPos());
const moved = Math.hypot(cp1[0] - cp2[0], cp1[1] - cp2[1], cp1[2] - cp2[2]);
console.log('camera moved:', moved.toFixed(2));
check('cinema camera moves', moved > 0.3);
// 数ショットぶんスクリーンショット
for (let s = 0; s < 3; s++) {
  await page.evaluate(() => window.__wall.forceNextShot());
  await page.evaluate(() => new Promise(r => setTimeout(() => {
    window.__shot2 = document.querySelector('canvas.gl').toDataURL('image/png');
    r();
  }, 1200)));
  const data = await page.evaluate(() => window.__shot2);
  const { writeFileSync } = await import('fs');
  writeFileSync(`wall-cine-${s + 1}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
// アトラクト自動切替: 最大 40 秒待って current が変わること
const beforeAuto = await page.evaluate(() => window.__wall.current());
let autoChanged = false;
for (let w = 0; w < 80 && !autoChanged; w++) {
  await page.waitForTimeout(500);
  autoChanged = (await page.evaluate(() => window.__wall.current())) !== beforeAuto;
}
check('cinema auto-advances image', autoChanged);
await page.evaluate(() => window.__wall.toggleCamera());
check('cam back to front', (await page.evaluate(() => window.__wall.camMode())) === 'front');

// 壁クリック → 次の絵へ（current が進む）: 波紋パターンに固定
await page.evaluate(() => window.__wall.setPattern('ripple'));
for (let w = 0; w < 40; w++) {
  await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__wall.animating())) === 0) break;
}
const before = await page.evaluate(() => window.__wall.current());
await page.evaluate(() => window.__wall.clickCenter());
await page.waitForTimeout(300);
const during = await page.evaluate(() => ({ cur: window.__wall.current(), anim: window.__wall.animating() }));
check('wall click advances image', during.cur === (before + 1) % 6);
check('ripple animating', during.anim > 0);
await page.screenshot({ path: 'wall-ripple.png' });

// ---- 高粒子数: 50K で再構築して切り替えが完走すること ----
await page.evaluate(() => window.__wall.setCount(50000));
await page.waitForTimeout(800);
const grid50 = await page.evaluate(() => window.__wall.grid());
console.log('50K grid:', JSON.stringify(grid50));
check('50K rebuild', grid50.n > 45000 && grid50.n < 56000);
{
  const target = (await page.evaluate(() => window.__wall.current()) + 1) % 6;
  await page.evaluate(({ t }) => window.__wall.trigger(t, 'assemble'), { t: target });
  await page.waitForTimeout(250);
  const animMid = await page.evaluate(() => window.__wall.animating());
  for (let w = 0; w < 60; w++) {
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => window.__wall.animating())) === 0) break;
  }
  const cur = await page.evaluate(() => window.__wall.current());
  console.log('50K trigger cost ms:', await page.evaluate(() => window.__wall.triggerMs().toFixed(1)));
  check('50K assemble completes', cur === target && animMid > 0);
}
await page.evaluate(() => new Promise(r => setTimeout(() => {
  window.__shot3 = document.querySelector('canvas.gl').toDataURL('image/png');
  r();
}, 200)));
{
  const data = await page.evaluate(() => window.__shot3);
  const { writeFileSync } = await import('fs');
  writeFileSync('wall-50k.png', Buffer.from(data.split(',')[1], 'base64'));
}

// ---- ミニベンチマーク（2プリセット・短縮版）----
const bench = await page.evaluate(() => window.__wall.benchmark([5000, 20000], 2));
console.log('bench:', JSON.stringify(bench));
check('benchmark returns results', bench && bench.results.length === 2 && bench.score > 0);
check('benchmark fps sane', bench.results.every(r => r.fps > 0.2 && r.fps < 500));
check('bench overlay shown', await page.evaluate(() => !document.getElementById('bench-overlay').classList.contains('hidden')));
await page.screenshot({ path: 'wall-bench.png' });

// ---- モバイルレイアウト（iPhone相当）と UI 非表示モード ----
{
  const mp = await browser.newPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  });
  mp.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
  await mp.goto('http://localhost:8939/games/flip-wall/', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1200);
  const overlap = await mp.evaluate(() => {
    const rects = ['#quality', '#patterns', '#slots'].map(s => document.querySelector(s).getBoundingClientRect());
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return hit(rects[0], rects[1]) || hit(rects[1], rects[2]);
  });
  check('mobile UI bars do not overlap', !overlap);
  await mp.evaluate(() => window.__wall.toggleUI());
  check('UI hide mode', await mp.evaluate(() =>
    window.__wall.uiHidden() && getComputedStyle(document.getElementById('ui-bottom')).display === 'none'));
  await mp.evaluate(() => window.__wall.toggleUI());
  check('UI restore', !(await mp.evaluate(() => window.__wall.uiHidden())));
  await mp.screenshot({ path: 'wall-mobile.png' });
  await mp.close();
}

console.log('errors:', errors.length ? errors : 'none');
console.log(fails.length ? `FAILED: ${fails.join(', ')}` : 'ALL PASS');
console.log('※ 出力された wall-face-*.png を必ず目視確認すること（向き・鏡像・ギザギザ）');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
