import { RelativeTimePipe } from './relative-time.pipe';

describe('RelativeTimePipe', () => {
  let pipe: RelativeTimePipe;

  beforeEach(() => {
    pipe = new RelativeTimePipe();
  });

  it('vrátí prázdný řetězec bez hodnoty', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('vrátí "právě teď" pro čas do minuty', () => {
    const now = new Date().toISOString();
    expect(pipe.transform(now)).toBe('právě teď');
  });

  it('vrátí minuty pro čas do hodiny', () => {
    const date = new Date(Date.now() - 32 * 60000).toISOString();
    expect(pipe.transform(date)).toBe('před 32 min');
  });

  it('vrátí hodiny pro čas do jednoho dne', () => {
    const date = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(pipe.transform(date)).toBe('před 3 h');
  });

  it('vrátí dny pro čas do 30 dní', () => {
    const date = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(pipe.transform(date)).toBe('před 5 d');
  });

  it('vrátí měsíce v jednotném čísle pro cca měsíc starý čas', () => {
    const date = new Date(Date.now() - 40 * 86400000).toISOString();
    expect(pipe.transform(date)).toBe('před 1 měsícem');
  });

  it('vrátí měsíce v množném čísle pro víc měsíců starý čas', () => {
    const date = new Date(Date.now() - 100 * 86400000).toISOString();
    expect(pipe.transform(date)).toBe('před 3 měsíci');
  });

  it('vrátí roky v jednotném čísle pro rok starý čas', () => {
    const date = new Date(Date.now() - 365 * 86400000).toISOString();
    expect(pipe.transform(date)).toBe('před 1 rokem');
  });

  it('vrátí roky v množném čísle pro víc let starý čas', () => {
    const date = new Date(Date.now() - 800 * 86400000).toISOString();
    expect(pipe.transform(date)).toBe('před 2 lety');
  });
});
