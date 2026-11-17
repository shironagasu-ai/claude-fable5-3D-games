// Chroma Shift ステージ生成: ランダムに作り、ソルバーで解けて手数が狙いの範囲のものを選ぶ。
// 使い方（リポジトリルートで）:
//   node tools/chroma-shift-gen.mjs games/chroma-shift/index.html <シード> <SPECS の番号> [秒数上限=300]
// 標準エラーに手数、標準出力に LEVELS 配列へ貼る 1 行を出す。大きい面は数分かかるので番号ごとに並列実行する。
import { readFileSync } from 'fs';
const html = readFileSync(process.argv[2], 'utf8');
const core = html.split('/*CORE-BEGIN*/')[1].split('const LEVELS')[0];
const api = new Function(core + '; return { parseLevel, colorAt, initState, solve, stepLayer, stepPlayer };')();

let seed = +process.argv[3] || 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ri = n => Math.floor(rnd() * n);

function gen(p) {
  const { w, h, M, mov, ncry, fill, noise } = p;
  // 白の形: ランダムウォークで掘る
  const W = new Uint8Array(w * h);
  let x = ri(w), y = ri(h), cnt = 0, guard = 0;
  while (cnt < fill * w * h && guard++ < 5000) {
    if (!W[y * w + x]) { W[y * w + x] = 1; cnt++; }
    const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][ri(4)];
    const nx = x + d[0], ny = y + d[1];
    if (nx >= 0 && ny >= 0 && nx < w && ny < h) { x = nx; y = ny; }
  }
  const rows = [];
  for (let yy = 0; yy < h; yy++) {
    let r = '';
    for (let xx = 0; xx < w; xx++) {
      let c = 0;
      for (let i = 0; i < 3; i++) if (W[yy * w + xx] || rnd() < noise) c |= 1 << i;
      r += c;
    }
    rows.push(r);
  }
  const off = [0, 1, 2].map(i => mov.includes('RGB'[i]) ? [ri(2 * M + 1) - M, ri(2 * M + 1) - M] : [0, 0]);
  const d = { rows, M, mov, off, start: [0, 0], exit: [0, 0], cry: [] };
  let L = api.parseLevel(d);
  const whites = [];
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (api.colorAt(L, L.off0, xx, yy) === 7) whites.push([xx, yy]);
  if (!whites.length) return null;
  d.start = whites[ri(whites.length)];
  d.exit = [ri(w), ri(h)];
  if (Math.abs(d.exit[0] - d.start[0]) + Math.abs(d.exit[1] - d.start[1]) < Math.min(w, h)) return null;
  const used = new Set([d.start + '', d.exit + '']);
  for (let i = 0; i < ncry; i++) {
    const c = [ri(w), ri(h), [3, 5, 6][ri(3)]];
    if (used.has(c[0] + ',' + c[1])) return null;
    used.add(c[0] + ',' + c[1]); d.cry.push(c);
  }
  L = api.parseLevel(d);
  const s0 = api.initState(L);
  if (s0.lit) return null;
  const r = api.solve(L, s0, 150000);
  if (!r) return null;
  const layers = new Set(r.acts.filter(a => a.t === 's').map(a => a.c));
  return { d, shifts: r.shifts, states: r.states, layers: layers.size, walk: r.acts.length - r.shifts };
}

const SPECS = [
  { w: 7, h: 4, M: 2, mov: 'R', ncry: 0, fill: 0.5, noise: 0.15, min: 2, max: 2 },
  { w: 8, h: 5, M: 2, mov: 'RG', ncry: 0, fill: 0.45, noise: 0.2, min: 4, max: 5 },
  { w: 9, h: 6, M: 2, mov: 'RGB', ncry: 0, fill: 0.45, noise: 0.2, min: 5, max: 6 },
  { w: 9, h: 6, M: 2, mov: 'RG', ncry: 1, fill: 0.45, noise: 0.2, min: 5, max: 6 },
  { w: 10, h: 7, M: 2, mov: 'RGB', ncry: 0, fill: 0.42, noise: 0.22, min: 8, max: 9 },
  { w: 10, h: 7, M: 2, mov: 'RGB', ncry: 1, fill: 0.42, noise: 0.22, min: 9, max: 10 },
  { w: 11, h: 7, M: 2, mov: 'RGB', ncry: 2, fill: 0.45, noise: 0.22, min: 10, max: 13 },
  { w: 12, h: 8, M: 2, mov: 'RGB', ncry: 0, fill: 0.4, noise: 0.25, min: 13, max: 15 },
  { w: 12, h: 8, M: 2, mov: 'RGB', ncry: 2, fill: 0.4, noise: 0.25, min: 14, max: 17 },
  { w: 12, h: 8, M: 2, mov: 'RGB', ncry: 2, fill: 0.42, noise: 0.25, min: 15, max: 30 },
];
const out = [];
const only = +process.argv[4], T0 = Date.now(), LIMIT = (+process.argv[5] || 300) * 1000;
SPECS.forEach((p, i) => {
  if (i !== only) return;
  let best = null;
  for (let t = 0; t < 6000; t++) {
    const g = gen(p);
    if (!g || g.shifts < p.min || g.shifts > p.max || g.layers < p.mov.length) continue;
    // 歩きの多いもの（道筋がある）を優先
    if (!best || g.shifts * 10 + g.walk > best.shifts * 10 + best.walk) best = g;
    if (best && t > 3000) break;
    if (Date.now() - T0 > LIMIT) break;
  }
  if (!best) { console.error('no level for spec', i); return; }
  console.error(`#${i + 1} shifts=${best.shifts} walk=${best.walk} states=${best.states}`);
  best.d.par = best.shifts;
  out.push(best.d);
});
for (const d of out) {
  console.log(`  { rows: ${JSON.stringify(d.rows)}, M: ${d.M}, mov: '${d.mov}', off: ${JSON.stringify(d.off)}, start: ${JSON.stringify(d.start)}, exit: ${JSON.stringify(d.exit)}, cry: ${JSON.stringify(d.cry)}, par: ${d.par} },`);
}
