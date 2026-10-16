import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumeRuleError, CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AccessService } from '../../../../core/access/access.service';
import { inventoryProgress, seriesName } from '../../utils/costume-logic';
import { userNameFromMembers } from '../inventory-detail/inventory-detail.utils';

@Component({
  selector: 'app-costume-inventories',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink, FormsModule, DatePipe],
  template: `
    <div class="page">
      <app-costumes-nav />
      <div class="page__header">
        <h1 class="page__title">Inventury</h1>
        @if (canManage() && !formOpen()) {
          <button type="button" class="btn-primary btn-primary--sm" (click)="formOpen.set(true)">Zahájit inventuru</button>
        }
      </div>

      @if (error()) {
        <div class="inv-error" role="alert">{{ error() }}</div>
      }

      @if (formOpen()) {
        <form class="detail inv-form" (ngSubmit)="start()">
          <h2 class="detail__section-title">Nová inventura</h2>
          <label class="inv-field">
            Název
            <input class="inv-input" name="name" [ngModel]="name()" (ngModelChange)="name.set($event)"
              placeholder="např. Podzimní inventura 2026" />
          </label>
          <label class="inv-field">
            Rozsah
            <select class="inv-input" name="scope" [ngModel]="scope()" (ngModelChange)="scope.set($event)">
              <option value="">Celý sklad</option>
              @for (s of state()?.series ?? []; track s.id) {
                <option [value]="s.id">Řada {{ s.name }}</option>
              }
            </select>
          </label>
          <p class="inv-hint">Očekávaný stav (co je ve skladu a co u vypůjčitelů) se zachytí v okamžiku zahájení.</p>
          <div class="inv-actions">
            <button type="submit" class="btn-primary btn-primary--sm" [disabled]="busy()">Zahájit</button>
            <button type="button" class="attendance-btn" (click)="formOpen.set(false)">Zrušit</button>
          </div>
        </form>
      }

      @if (!state()) {
        <p class="state-note">Načítání…</p>
      } @else if (!rows().length) {
        <p class="state-note">Zatím neproběhla žádná inventura.</p>
      } @else {
        <ul class="item-list">
          @for (row of rows(); track row.inventory.id) {
            <li class="item-list__item item-list__item--link" [routerLink]="['/app/costumes/inventories', row.inventory.id]">
              <div class="item-list__row">
                <a class="item-list__title" [routerLink]="['/app/costumes/inventories', row.inventory.id]">{{ row.inventory.name }}</a>
                <span class="item-list__badges">
                  <span class="badge" [class.inv-open]="!row.inventory.closedAt">{{ row.inventory.closedAt ? 'Uzavřená' : 'Probíhá' }}</span>
                </span>
              </div>
              <div class="item-list__meta">
                {{ row.scope }} · zahájeno {{ row.inventory.startedAt | date: 'd. M. yyyy' }} ({{ userName(row.inventory.startedByUserId) }})
                @if (row.inventory.closedAt) { · uzavřeno {{ row.inventory.closedAt | date: 'd. M. yyyy' }} }
              </div>
              <div class="inv-progress">
                <div class="inv-progress__bar" [style.width.%]="row.progress.total ? (row.progress.checked / row.progress.total) * 100 : 0"></div>
              </div>
              <div class="item-list__meta">
                Zkontrolováno {{ row.progress.checked }} / {{ row.progress.total }}
                · nesrovnalosti {{ row.progress.problem }}
                · chybí {{ row.progress.missing }}
                · mimo sklad neověřeno {{ row.progress.outsideUnchecked }}
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .inv-error {
      background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; border-radius: 6px;
      padding: var(--spacing-sm) var(--spacing-md); margin-bottom: var(--spacing-md); font-size: var(--font-size-sm);
    }
    .inv-form { margin-bottom: var(--spacing-lg); gap: var(--spacing-sm); }
    .inv-field { display: flex; flex-direction: column; gap: var(--spacing-xs); font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .inv-input {
      padding: 10px var(--spacing-sm); border: 1px solid var(--color-border); border-radius: 6px;
      font-size: var(--font-size-base); background: var(--color-surface); color: var(--color-text);
    }
    .inv-hint { font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .inv-actions { display: flex; gap: var(--spacing-sm); flex-wrap: wrap; }
    .inv-progress { height: 6px; border-radius: 3px; background: var(--color-surface-alt); overflow: hidden; margin: var(--spacing-xs) 0; }
    .inv-progress__bar { height: 100%; background: var(--color-primary); }
    .inv-open { color: var(--color-primary); border-color: var(--color-primary); }
    .item-list__title { color: var(--color-text); text-decoration: none; }
  `,
})
export class CostumeInventoriesComponent {
  private readonly accessService = inject(AccessService);
  private readonly costumes = inject(CostumesService);
  private readonly membersService = inject(MembersService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly state = toSignal(this.costumes.state$);
  readonly members = toSignal(this.membersService.getMembers(), { initialValue: [] });
  readonly canManage = this.accessService.canManageCostumes;

  readonly formOpen = signal(false);
  readonly name = signal('');
  // '' = celý sklad, jinak id řady
  readonly scope = signal<string>('');
  readonly busy = signal(false);
  readonly error = signal('');

  // Nejnovější nahoře; starší výsledky zůstávají k porovnání
  readonly rows = computed(() => {
    const state = this.state();
    if (!state) return [];
    return [...state.inventories]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((inventory) => ({
        inventory,
        progress: inventoryProgress(inventory),
        scope: inventory.seriesId !== undefined ? `Řada ${seriesName(state, inventory.seriesId)}` : 'Celý sklad',
      }));
  });


  userName(userId: number): string {
    return userNameFromMembers(this.members(), userId);
  }

  start(): void {
    if (!this.canManage()) return;
    const scope = this.scope();
    this.busy.set(true);
    this.error.set('');
    this.costumes.startInventory(this.name(), scope ? Number(scope) : undefined).subscribe({
      next: (inventory) => {
        this.busy.set(false);
        this.router.navigate(['/app/costumes/inventories', inventory.id]);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e instanceof CostumeRuleError ? e.message : 'Inventuru se nepodařilo zahájit.');
      },
    });
  }
}
