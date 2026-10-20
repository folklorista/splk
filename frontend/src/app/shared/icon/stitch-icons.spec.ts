import { GROUP_ICON_OPTIONS } from './icon.component';
import { STITCH_COLORS, stitchIcon, stitchPaths } from './stitch-icons';
import { STITCH_GRIDS } from './stitch-icons.data';

describe('stitch icons', () => {
  it('kreslí křížek do buňky 10×10 podle pozice v mřížce 12×12', () => {
    const grid = '0'.repeat(13) + '1' + '0'.repeat(130);

    expect(stitchPaths(grid)).toEqual([{ d: 'M11.5 11.5L18.5 18.5M11.5 18.5L18.5 11.5', color: 'currentColor' }]);
  });

  it('slučuje křížky jedné nitě do jedné cesty a řadí nitě podle čísla', () => {
    const grid = '21' + '0'.repeat(10) + '1' + '0'.repeat(131);
    const paths = stitchPaths(grid);

    expect(paths.map((p) => p.color)).toEqual([STITCH_COLORS[0], STITCH_COLORS[1]]);
    expect(paths[0].d).toBe('M11.5 1.5L18.5 8.5M11.5 8.5L18.5 1.5M1.5 11.5L8.5 18.5M1.5 18.5L8.5 11.5');
  });

  it('má platnou mřížku 12×12 pro každou ikonu ze sady', () => {
    for (const [name, grid] of Object.entries(STITCH_GRIDS)) {
      expect(grid).withContext(name).toMatch(/^[0-2]{144}$/);
      expect(grid).withContext(name).toMatch(/[12]/);
    }
  });

  it('má kresbu pro každou ikonu nabízenou skupinám', () => {
    for (const name of GROUP_ICON_OPTIONS) {
      expect(stitchIcon(name).length).withContext(name).toBeGreaterThan(0);
    }
  });
});
