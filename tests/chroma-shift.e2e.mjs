// Chroma Shift E2E テスト。リポジトリルートで:  node tests/chroma-shift.e2e.mjs
// 依存: npm i playwright-core（Chromium 実体は CHROMIUM_PATH で指定可）
// 1) 規則部分を Node で読み込み、全ステージがソルバーで解けて PAR と一致するか確認
// 2) ブラウザで実際にキー入力し、全ステージをソルバーの手順で通しクリアする
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'output');
mkdirSync(outDir, { recursive: true });
const html = readFileSync(join(root, 'games/chroma-shift/index.html'), 'utf8');

const fails = [];
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ': ' + name); if (!cond) fails.push(name); };

// ---- 1) 規則とステージの静的検証 ----
const core = html.split('/*CORE-BEGIN*/')[1].split('/*CORE-END*/')[0];
const api = new Function(core + '; return { parseLevel, initState, solve, colorAt, stepLayer, stepPlayer, LEVELS };')();
check('ステージ数 >= 8', api.LEVELS.length >= 8);
api.LEVELS.forEach((d, i) => {
  const L = api.parseLevel(d);
  const s0 = api.initState(L);
  check(`#${i + 1} 開始地点が白`, api.colorAt(L, s0.off, s0.px, s0.py) === 7);
  const r = api.solve(L, s0, 2000000);
  check(`#${i + 1} 解ける (最小ずらし ${r && r.shifts} / PAR ${d.par})`, !!r && r.shifts === d.par);
});
{ // 規則の単体確認: 足元が白でなくなるずらしは拒否
  const L = api.parseLevel({ rows: ['77', '00'], mov: 'R', off: [[0, 0], [0, 0], [0, 0]], start: [0, 0], exit: [1, 0] });
  const s = api.initState(L);
  check('足元が崩れるずらしは拒否', api.stepLayer(L, s, 0, 0, 1) === 'foot');
  check('固定層は動かない', api.stepLayer(L, s, 1, 1, 0) === 'lock');
}

// ---- 2) ブラウザでの通しプレイ ----
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(8941, r));
const executablePath = process.env.CHROMIUM_PATH
  ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://localhost:8941/games/chroma-shift/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
check('描画ループが回っている', (await page.evaluate(() => window.__cs.info().frames)) > 5);
await page.screenshot({ path: join(outDir, 'chroma-title.png') });
check('タイトル画面', (await page.evaluate(() => window.__cs.info().mode)) === 'title');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
check('Enter でプレイ開始', (await page.evaluate(() => window.__cs.info().mode)) === 'play');

const KEY = { '1,0': 'ArrowRight', '-1,0': 'ArrowLeft', '0,1': 'ArrowDown', '0,-1': 'ArrowUp' };
const n = await page.evaluate(() => window.__cs.levels);
for (let i = 0; i < n; i++) {
  const info0 = await page.evaluate(() => window.__cs.info());
  check(`#${i + 1} を表示中`, info0.li === i && info0.mode === 'play');
  const r = await page.evaluate(() => window.__cs.solve());
  let cur = -1;
  for (const a of r.acts) {
    const want = a.t === 'm' ? -1 : a.c;
    if (want !== cur) { await page.keyboard.press(want < 0 ? 'q' : String(want + 1)); cur = want; }
    await page.keyboard.press(KEY[a.dx + ',' + a.dy]);
  }
  const info = await page.evaluate(() => window.__cs.info());
  check(`#${i + 1} キー入力でクリア (ずらし ${info.shifts})`, info.mode === 'clear' && info.shifts === r.shifts);
  if (i === 0 || i === n - 1) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(outDir, `chroma-clear-${i + 1}.png`) });
  }
  await page.waitForTimeout(450);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
check('全クリア後タイトルへ戻る', (await page.evaluate(() => window.__cs.info().mode)) === 'title');
check('全ステージ解放が保存された', (await page.evaluate(() => JSON.parse(localStorage.getItem('chroma-shift-v1')).unlocked)) === n);

// UNDO / RESET / HINT / 拒否時のメッセージ
await page.evaluate(() => window.__cs.goto(2));
await page.waitForTimeout(200);
const before = await page.evaluate(() => window.__cs.info());
const r3 = await page.evaluate(() => window.__cs.solve());
const firstShift = r3.acts.find(a => a.t === 's');
await page.keyboard.press(String(firstShift.c + 1));
const tryDirs = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
let moved = false;
for (const k of tryDirs) {
  await page.keyboard.press(k);
  if ((await page.evaluate(() => window.__cs.info().shifts)) > 0) { moved = true; break; }
}
check('層をずらせる', moved);
await page.keyboard.press('z');
const afterUndo = await page.evaluate(() => window.__cs.info());
check('UNDO で戻る', afterUndo.shifts === 0 && JSON.stringify(afterUndo.off) === JSON.stringify(before.off));
await page.keyboard.press('h');
check('HINT がメッセージを出す', (await page.textContent('#msg')).startsWith('ヒント'));

// 途中のステージの画面（FX 全オン / 全オフ）
await page.evaluate(i => window.__cs.goto(i), n - 1);
await page.keyboard.press('1');
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, 'chroma-play-crt.png') });
await page.evaluate(() => window.__cs.setFx({ bloom: 0, scan: 0, mask: 0, curve: 0, ab: 0, noise: 0, dither: 0 }));
await page.waitForTimeout(200);
await page.screenshot({ path: join(outDir, 'chroma-play-raw.png') });
await page.evaluate(() => window.__cs.setFx({ dither: 1 }));
await page.waitForTimeout(200);
await page.screenshot({ path: join(outDir, 'chroma-play-dither.png') });

// スマホ縦画面: ボタン操作でプレイできる
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
m.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
await m.goto('http://localhost:8941/games/chroma-shift/', { waitUntil: 'networkidle' });
await m.waitForTimeout(500);
await m.tap('#screen');
await m.waitForTimeout(150);
const mr = await m.evaluate(() => window.__cs.solve());
let mcur = -1;
const BTN = { '1,0': '1,0', '-1,0': '-1,0', '0,1': '0,1', '0,-1': '0,-1' };
for (const a of mr.acts) {
  const want = a.t === 'm' ? -1 : a.c;
  if (want !== mcur) { await m.tap(`#targets button[data-t="${want}"]`); mcur = want; }
  await m.tap(`#dpad button[data-d="${BTN[a.dx + ',' + a.dy]}"]`);
}
check('スマホのボタン操作でクリア', (await m.evaluate(() => window.__cs.info().mode)) === 'clear');
const box = await m.evaluate(() => {
  const r = document.querySelector('#pad').getBoundingClientRect();
  return { bottom: r.bottom, sw: document.documentElement.scrollWidth };
});
check('スマホで操作盤が画面内', box.bottom <= 844 && box.sw <= 390);
await m.waitForTimeout(600);
await m.screenshot({ path: join(outDir, 'chroma-mobile.png') });

check('コンソールエラーなし', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
