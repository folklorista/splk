import { STITCH_COLORS, STITCH_GRIDS, stitchIcon, stitchPaths } from './stitch-icons';

describe('stitch icons', () => {
  it('kreslí křížek do buňky 10×10 podle pozice v mřížce', () => {
    const grid = '0'.repeat(17) + '1' + '0'.repeat(238);

    expect(stitchPaths(grid)).toEqual([{ d: 'M12 12L18 18M12 18L18 12', color: 'currentColor' }]);
  });

  it('slučuje křížky jedné nitě do jedné cesty a řadí nitě podle čísla', () => {
    const grid = '21' + '0'.repeat(14) + '1' + '0'.repeat(239);
    const paths = stitchPaths(grid);

    expect(paths.map((p) => p.color)).toEqual([STITCH_COLORS[0], STITCH_COLORS[1]]);
    expect(paths[0].d).toBe('M12 2L18 8M12 8L18 2M2 12L8 18M2 18L8 12');
  });

  it('má platnou mřížku 16×16 pro každou ikonu ze sady', () => {
    for (const [name, grid] of Object.entries(STITCH_GRIDS)) {
      expect(grid).withContext(name).toMatch(/^[0-4]{256}$/);
      expect(grid).withContext(name).toMatch(/[1-4]/);
    }
  });

  it('vrací null pro ikonu, která v sadě chybí', () => {
    expect(stitchIcon('phone')).toBeNull();
    expect(stitchIcon('home')?.length).toBeGreaterThan(0);
  });
});
