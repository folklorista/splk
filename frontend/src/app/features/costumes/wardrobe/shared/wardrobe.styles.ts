// Společné styly stránek Správy krojů a Mých krojů (přes CSS proměnné, aby fungoval tmavý režim)
export const WARDROBE_STYLES = `
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; margin-bottom: var(--spacing-md); }
  .toolbar__spacer { flex: 1; }
  .btn-secondary--active { border-color: var(--color-primary); color: var(--color-primary); font-weight: 600; }
  .btn-link { background: none; border: none; padding: 0; color: var(--color-primary); cursor: pointer; font-size: var(--font-size-sm); }
  .input, select.input, textarea.input { min-width: 0; }
  .input--search { flex: 1; min-width: 160px; }
  .input--short { width: 90px; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: var(--font-size-sm); color: var(--color-text-muted); }
  .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: var(--spacing-sm); margin-bottom: var(--spacing-md); }
  .error-box {
    padding: var(--spacing-sm) var(--spacing-md); border-radius: 6px; margin-bottom: var(--spacing-md);
    border: 1px solid var(--color-primary); color: var(--color-primary); background: var(--color-surface);
  }
  .info-box {
    padding: var(--spacing-sm) var(--spacing-md); border-radius: 6px; font-size: var(--font-size-sm); margin-bottom: var(--spacing-md);
    border: 1px solid var(--color-border); background: var(--color-surface-alt); color: var(--color-text-muted);
  }
  .warn-box {
    padding: var(--spacing-sm) var(--spacing-md); border-radius: 6px; font-size: var(--font-size-sm); margin-bottom: var(--spacing-md);
    border: 1px solid var(--status-warn-border); background: var(--status-warn-bg); color: var(--color-text);
  }
  .badge--alert { background: var(--status-danger-bg); color: var(--status-danger-fg); border-color: var(--status-danger-border); }
  .badge--ok { background: var(--status-ok-bg); color: var(--status-ok-fg); border-color: var(--status-ok-border); }
  .badge--warn { background: var(--status-warn-bg); color: var(--status-warn-fg); border: 1px solid var(--status-warn-border); }
  .badge--muted { background: var(--color-surface-alt); color: var(--color-text-muted); border: 1px solid var(--color-border); }
  .table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
  .table th, .table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
  .table th { color: var(--color-text-muted); font-weight: 600; }
  .table-wrap { overflow-x: auto; }
  .muted { color: var(--color-text-muted); font-size: var(--font-size-sm); }
  .link { color: var(--color-primary); }
  .stack { display: flex; flex-direction: column; gap: var(--spacing-sm); }
  .row { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; }
  .check { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-size-sm); cursor: pointer; }
  .section { margin-bottom: var(--spacing-xl); }
  .group-title { font-size: var(--font-size-base); font-weight: 600; margin: var(--spacing-md) 0 var(--spacing-xs); }
  .code { font-variant-numeric: tabular-nums; font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: var(--spacing-sm); margin-bottom: var(--spacing-md); }
  .stat { padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
  .stat__value { font-size: var(--font-size-h2, 1.4rem); font-weight: 700; display: block; }
  .stat__label { font-size: var(--font-size-xs); color: var(--color-text-muted); }
  .progress { height: 8px; border-radius: 4px; background: var(--color-surface-alt); overflow: hidden; margin: var(--spacing-xs) 0; }
  .progress__bar { height: 100%; background: var(--color-primary-fill); }
  .panel { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--spacing-md); background: var(--color-surface); margin: var(--spacing-sm) 0; }
  @media print { .detail, .item-list__item { box-shadow: none; } }
`;
