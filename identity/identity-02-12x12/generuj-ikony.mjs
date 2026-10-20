#!/usr/bin/env node
// Generátor křížkových ikon Vonica 12×12 – ekvivalent SVG exportu z vyšívací dílny.
//
//   node generuj-ikony.mjs [zdroj.json] [výstupní složka]
//
// Zdroj: ikony-12x12.json – každá ikona má 12 řádků po 12 znacích:
//   "." prázdné políčko, "X" nit 1 (tmavý inkoust / barva textu), "R" nit 2 (folklorní červená).
// Výstup:
//   svg/barevne/<id>.svg – pevné barvy z palety (pro dokumenty, náhledy)
//   svg/ui/<id>.svg      – nit 1 = currentColor, nit 2 = var(--stitch-accent, červená) – pro aplikaci
//   svg/mono/<id>.svg    – vše currentColor (jednobarevné použití, disabled stav)
//   nahled.html          – kontrolní list: mřížka, skutečné velikosti, světlý/tmavý podklad, stavy

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] ?? join(here, 'ikony-12x12.json');
const out = process.argv[3] ?? here;

// Geometrie stehu – společná pro celou sadu (buňka 10×10 jednotek, viewBox 0 0 120 120)
const SIZE = 12;
const CELL = 10;
const INSET = 1.5; // odsazení křížku od okraje buňky
const STROKE = 4.2; // tloušťka nitě (42 % buňky – čitelné při 20–24 px)
const THREADS = { X: 1, R: 2 };

const data = JSON.parse(readFileSync(src, 'utf8'));
const [INK, RED] = data.palette;

// Ikony mají vždy 12×12, ornamenty (category "ornament") mohou mít libovolný obdélník
function parseRows(item) {
  const rows = item.rows;
  const ornament = item.category === 'ornament';
  const h = rows?.length, w = rows?.[0]?.length;
  if (!Array.isArray(rows) || (!ornament && h !== SIZE)) throw new Error(`${item.id}: čekám ${SIZE} řádků, je ${h}`);
  const width = ornament ? w : SIZE;
  return rows.map((row, y) => {
    if (row.length !== width) throw new Error(`${item.id}: řádek ${y + 1} má ${row.length} znaků místo ${width}`);
    return [...row].map((ch, x) => {
      if (ch === '.') return 0;
      if (!(ch in THREADS)) throw new Error(`${item.id}: neznámý znak "${ch}" na ${x + 1}×${y + 1}`);
      return THREADS[ch];
    });
  });
}

function pathsByThread(grid) {
  const byThread = new Map();
  grid.forEach((row, y) =>
    row.forEach((thread, x) => {
      if (!thread) return;
      const a = x * CELL + INSET, b = (x + 1) * CELL - INSET;
      const c = y * CELL + INSET, d = (y + 1) * CELL - INSET;
      const parts = byThread.get(thread) ?? [];
      parts.push(`M${a} ${c}L${b} ${d}M${a} ${d}L${b} ${c}`);
      byThread.set(thread, parts);
    }),
  );
  return [...byThread.entries()].sort(([a], [b]) => a - b).map(([thread, parts]) => ({ thread, d: parts.join('') }));
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function svg(item, grid, paths, colorOf) {
  const body = paths.map((p) => `<path d="${p.d}" stroke="${colorOf(p.thread)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid[0].length * CELL} ${grid.length * CELL}" fill="none" stroke-width="${STROKE}" stroke-linecap="round"><title>${esc(item.name)}</title>${body}</svg>\n`;
}

const variants = {
  barevne: (t) => (t === 1 ? INK : RED),
  ui: (t) => (t === 1 ? 'currentColor' : `var(--stitch-accent, ${RED})`),
  mono: () => 'currentColor',
};
for (const v of Object.keys(variants)) mkdirSync(join(out, 'svg', v), { recursive: true });

const ids = new Set();
const rendered = data.items.map((item) => {
  if (ids.has(item.id)) throw new Error(`Duplicitní id ${item.id}`);
  ids.add(item.id);
  const grid = parseRows(item);
  const paths = pathsByThread(grid);
  for (const [v, colorOf] of Object.entries(variants)) writeFileSync(join(out, 'svg', v, `${item.id}.svg`), svg(item, grid, paths, colorOf));
  return { item, grid, inline: svg(item, grid, paths, variants.ui) };
});

// Kontrolní list
const cats = { nav: 'Navigace', action: 'Akce a ovládání', info: 'Informace a metadata', group: 'Skupiny a avatary', ornament: 'Ornamenty (masky pro CSS)' };
const gridCells = (grid) =>
  grid.flat().map((t) => `<i class="t${t}"></i>`).join('');
const card = ({ item, grid, inline }) => `
  <figure>
    <div class="grid" style="--cols:${grid[0].length}">${gridCells(grid)}</div>
    <div class="sizes">
      <span class="s24">${inline}</span><span class="s20">${inline}</span><span class="s16">${inline}</span>
    </div>
    <div class="states">
      <span class="active">${inline}</span><span class="idle">${inline}</span><span class="disabled">${inline}</span>
    </div>
    <figcaption>${esc(item.name)}<code>${esc(item.id)}</code>${item.source ? `<small>předloha ${esc(item.source)}</small>` : ''}</figcaption>
  </figure>`;
const sections = Object.entries(cats)
  .map(([key, title]) => {
    const items = rendered.filter((r) => r.item.category === key);
    return items.length ? `<h2>${title} <small>(${items.length})</small></h2><div class="list">${items.map(card).join('')}</div>` : '';
  })
  .join('');

const html = `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vonica ikony 12×12</title>
<style>
  :root { --bg:#FDF8ED; --card:#fffdf8; --line:#eadfcf; --ink:${INK}; --muted:#6b6f76; --stitch-accent:${RED}; color-scheme: light; }
  .dark { --bg:#1d1b19; --card:#26231f; --line:#3a3530; --ink:#f3eee3; --muted:#a39d94; --stitch-accent:#e05a4f; }
  body { margin:0; font:14px/1.4 system-ui, sans-serif; background:#ddd; }
  .theme { background:var(--bg); color:var(--ink); padding:20px 24px 32px; }
  h1 { font:600 26px Georgia, serif; margin:0 0 4px; } h2 { font:600 18px Georgia, serif; margin:24px 0 10px; } h2 small { color:var(--muted); font:13px system-ui; }
  p { color:var(--muted); margin:0; }
  .list { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px; }
  figure { margin:0; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:10px; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .grid { display:grid; grid-template-columns:repeat(var(--cols), 7px); gap:1px; background:var(--line); border:1px solid var(--line); }
  .grid i { width:7px; height:7px; background:var(--card); } .grid .t1 { background:var(--ink); } .grid .t2 { background:var(--stitch-accent); }
  .sizes, .states { display:flex; align-items:center; gap:10px; }
  .s24 svg { width:24px; height:24px; } .s20 svg { width:20px; height:20px; } .s16 svg { width:16px; height:16px; }
  .states svg { width:22px; height:22px; } .active { color:var(--stitch-accent); } .idle { color:var(--muted); } .disabled { color:var(--muted); opacity:.4; --stitch-accent:currentColor; }
  figcaption { text-align:center; font-size:12px; } figcaption code, figcaption small { display:block; color:var(--muted); }
</style></head><body>
<div class="theme">
  <h1>Vonica – křížkové ikony 12×12</h1>
  <p>${rendered.length} ikon · mřížka · 24 / 20 / 16 px · stavy: aktivní / neaktivní / disabled · steh ${STROKE} z buňky ${CELL}</p>
  ${sections}
</div>
<div class="theme dark">
  <h1>Tmavý režim</h1>
  ${sections}
</div>
</body></html>
`;
writeFileSync(join(out, 'nahled.html'), html);
console.log(`${rendered.length} ikon → ${join(out, 'svg')} (barevne, ui, mono) + nahled.html`);
