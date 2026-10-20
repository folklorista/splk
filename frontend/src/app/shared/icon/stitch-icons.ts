import type { IconName } from './icon.component';
import { STITCH_CELL, STITCH_GRIDS, STITCH_INSET, STITCH_SIZE } from './stitch-icons.data';

// Nit 1 je hlavní kresba – bere barvu textu (currentColor), takže sedí do světlého i tmavého režimu
// i do aktivního stavu navigace. Nit 2 je folklorní červená (token --stitch-accent).
export const STITCH_COLORS: readonly string[] = ['currentColor', 'var(--stitch-accent, #c73732)'];

export interface StitchPath {
  d: string;
  color: string;
}

// Každé políčko je křížek uvnitř buňky (viewBox 0 0 120 120), stejně jako SVG z generátoru v identity/.
// Křížky jedné nitě se slučují do jedné cesty.
export function stitchPaths(grid: string): StitchPath[] {
  const byThread = new Map<number, string[]>();
  for (let i = 0; i < grid.length; i++) {
    const thread = Number(grid[i]);
    if (!thread) continue;
    const x = i % STITCH_SIZE;
    const y = Math.floor(i / STITCH_SIZE);
    const a = x * STITCH_CELL + STITCH_INSET;
    const b = (x + 1) * STITCH_CELL - STITCH_INSET;
    const c = y * STITCH_CELL + STITCH_INSET;
    const d = (y + 1) * STITCH_CELL - STITCH_INSET;
    const parts = byThread.get(thread) ?? [];
    parts.push(`M${a} ${c}L${b} ${d}M${a} ${d}L${b} ${c}`);
    byThread.set(thread, parts);
  }
  return [...byThread.entries()]
    .sort(([x], [y]) => x - y)
    .map(([thread, parts]) => ({ d: parts.join(''), color: STITCH_COLORS[thread - 1] }));
}

const cache = new Map<IconName, StitchPath[]>();

export function stitchIcon(name: IconName): StitchPath[] {
  let paths = cache.get(name);
  if (!paths) {
    const grid = STITCH_GRIDS[name];
    paths = grid ? stitchPaths(grid) : [];
    cache.set(name, paths);
  }
  return paths;
}
