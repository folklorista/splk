export interface ReleaseDance {
  url: string;
  title: string;
  codename: string;
  slug: string;
}

// Generuje scripts/build-info.mjs do public/build-info.json
export interface BuildInfo {
  version: string | null;
  tag: string | null;
  dance: ReleaseDance | null;
  branch: string;
  commit: string;
  dirty: boolean;
  builtAt: string;
}

// Vydaná verze se označí tancem (verze bez tance tagem); build mimo release (nebo s necommitnutými změnami) revizí
export function versionLabel(info: BuildInfo | null): string {
  if (!info) return 'vývojová verze';
  if (info.dance && !info.dirty) return info.dance.codename;
  if (info.tag && !info.dirty) return info.tag;
  return `${info.branch}@${info.commit}${info.dirty ? '*' : ''}`;
}
