// Společné styly stránek zápůjček a vypůjčitelů (přes CSS proměnné, aby fungoval tmavý režim)
export const LOAN_PAGE_STYLES = `
  .toolbar { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; margin-bottom: var(--spacing-md); }
  .toolbar__spacer { flex: 1; }
  .btn-secondary {
    display: inline-block; padding: 8px 14px; border-radius: 6px; font-size: var(--font-size-sm);
    border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); cursor: pointer;
  }
  .btn-secondary:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
  .input, select.input, textarea.input {
    padding: 8px; border: 1px solid var(--color-border); border-radius: 6px; font-size: var(--font-size-base);
    background: var(--color-surface); color: var(--color-text); font-family: inherit;
  }
  .input:focus { outline: none; border-color: var(--color-primary); }
  .input--search { flex: 1; min-width: 180px; }
  .input--count { width: 70px; }
  .error-box {
    padding: var(--spacing-sm) var(--spacing-md); border-radius: 6px; margin-bottom: var(--spacing-md);
    border: 1px solid var(--color-primary); color: var(--color-primary); background: var(--color-surface);
  }
  .info-box {
    padding: var(--spacing-sm) var(--spacing-md); border-radius: 6px; font-size: var(--font-size-sm);
    border: 1px solid var(--color-border); background: var(--color-surface-alt); color: var(--color-text-muted);
  }
  .badge--overdue { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
  .badge--muted { background: var(--color-surface-alt); color: var(--color-text-muted); border: 1px solid var(--color-border); }
  .badge--ok { background: var(--color-surface-alt); color: var(--color-text); border: 1px solid var(--color-border); }
  .table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
  .table th, .table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
  .table th { color: var(--color-text-muted); font-weight: 600; }
  .table-wrap { overflow-x: auto; }
  .muted { color: var(--color-text-muted); font-size: var(--font-size-sm); }
  .link { color: var(--color-primary); }
  .stack { display: flex; flex-direction: column; gap: var(--spacing-sm); }
  .row { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; }
  .check { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-size-sm); cursor: pointer; }
  .print-only { display: none; }
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block; }
    .detail, .item-list__item { box-shadow: none; }
  }
`;
