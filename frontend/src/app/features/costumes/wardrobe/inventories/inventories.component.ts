import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../inventory.service';
import { AccessService } from '../../../../core/access/access.service';
import { inventoryProgress } from '../../utils/inventory-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

@Component({
  selector: 'app-wardrobe-inventories',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink, DatePipe],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <div class="page__header">
        <h1 class="page__title">Inventury</h1>
        @if (canManage()) { <a class="btn-primary btn-primary--sm no-print" routerLink="/app/wardrobe/inventories/new">Založit inventuru</a> }
      </div>
      <p class="info-box">Inventura je jedna akce nad celým fondem nebo jeho výslovně vymezenou částí. Zapůjčené kusy se kontrolují podle lidí (termíny návštěv), nezapůjčené ve skladu podle evidenčních řad.</p>
      <ul class="item-list">
        @for (row of rows(); track row.inventory.id) {
          <li class="item-list__item item-list__item--link" [routerLink]="['/app/wardrobe/inventories', row.inventory.id]">
            <div class="item-list__row">
              <span class="item-list__title">{{ row.inventory.name }}</span>
              <span class="item-list__badges">
                @if (row.inventory.closure; as c) {
                  <span class="badge" [class.badge--warn]="c.withDiscrepancies">{{ c.withDiscrepancies ? 'Uzavřeno s nesrovnalostmi' : 'Uzavřeno' }}</span>
                } @else { <span class="badge badge--ok">Probíhá</span> }
              </span>
            </div>
            <div class="item-list__meta">{{ row.inventory.scopeLabel }} · zahájeno {{ row.inventory.startedAt | date: 'd. M. yyyy' }}</div>
            <div class="progress"><div class="progress__bar" [style.width.%]="row.p.total ? (row.p.verified / row.p.total) * 100 : 0"></div></div>
            <div class="item-list__meta">Fyzicky ověřeno {{ row.p.verified }} / {{ row.p.total }} kusů · odbaveno {{ row.p.completed }} / {{ row.p.people }} lidí · nepředloženo {{ row.p.notPresented }}</div>
          </li>
        } @empty { <li class="state-note">Zatím žádná inventura.</li> }
      </ul>
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeInventoriesComponent {
  readonly canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(inject(InventoryService).state$);
  readonly rows = computed(() => {
    const state = this.state();
    if (!state) return [];
    return [...state.inventories]
      .sort((a, b) => Number(!!a.closure) - Number(!!b.closure) || b.startedAt.localeCompare(a.startedAt))
      .map((inventory) => ({ inventory, p: inventoryProgress(state, inventory) }));
  });
}
