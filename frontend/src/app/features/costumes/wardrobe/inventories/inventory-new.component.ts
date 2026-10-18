import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { InventoryService } from '../../inventory.service';
import { MembersService } from '../../../members/members.service';
import { GroupsService } from '../../../groups/groups.service';
import { InventoryScope, emptyScope } from '../../models/inventory.model';
import { resolveScope, scopeLabel } from '../../utils/inventory-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

type ScopeList = 'genderIds' | 'regionIds' | 'partTypeIds' | 'variantIds' | 'groupIds';

// Založení inventury: filtry (klasifikace × skupina = průnik) a náhled rozsahu před zahájením.
// Při zahájení se rozsah zmrazí (snapshot kusů a dotčených držitelů).
@Component({
  selector: 'app-wardrobe-inventory-new',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <a routerLink="/app/wardrobe/inventories" class="back-link">← Inventury</a>
      <h1 class="page__title">Nová inventura</h1>
      @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }
      @if (state(); as st) {
        <section class="detail stack section">
          <label class="field">Název<input class="input" [value]="name()" (input)="name.set($any($event.target).value)" placeholder="např. Ženské Kopanice – podzim" /></label>
          <p class="muted">Bez zaškrtnutí v dané skupině = bez omezení. Kombinace filtrů = průnik.</p>

          <h3 class="group-title">Pohlaví kroje</h3>
          <div class="row">@for (o of st.classification.genders; track o.id) { <label class="check"><input type="checkbox" [checked]="has('genderIds', o.id)" (change)="toggle('genderIds', o.id)" /> {{ o.label }}</label> }</div>
          <h3 class="group-title">Region</h3>
          <div class="row">@for (o of st.classification.regions; track o.id) { <label class="check"><input type="checkbox" [checked]="has('regionIds', o.id)" (change)="toggle('regionIds', o.id)" /> {{ o.label }}</label> }</div>
          <h3 class="group-title">Druh součástky</h3>
          <div class="row">@for (t of st.partTypes; track t.id) { <label class="check"><input type="checkbox" [checked]="has('partTypeIds', t.id)" (change)="toggle('partTypeIds', t.id)" /> {{ t.name }}</label> }</div>
          <h3 class="group-title">Varianta</h3>
          <div class="row">@for (v of st.classification.variants; track v.id) { <label class="check"><input type="checkbox" [checked]="has('variantIds', v.id)" (change)="toggle('variantIds', v.id)" /> {{ v.label }}</label> }</div>
          <h3 class="group-title">Skupina členů (volitelně)</h3>
          <p class="muted">Se skupinou se kontrolují jen kusy zapůjčené jejím členům – ne skladové zásoby.</p>
          <div class="row">@for (g of groups(); track g.id) { <label class="check"><input type="checkbox" [checked]="has('groupIds', g.id)" (change)="toggle('groupIds', g.id)" /> {{ g.name }}</label> }</div>
          <label class="field">Kapacita termínu návštěv (osob)<input class="input input--short" type="number" min="1" inputmode="numeric" [value]="capacity()" (input)="capacity.set(+$any($event.target).value)" /></label>
        </section>

        <section class="detail stack section">
          <h2 class="detail__section-title">Náhled rozsahu</h2>
          <p><strong>{{ label() }}</strong></p>
          <div class="stats">
            <div class="stat"><span class="stat__value">{{ preview().itemIds.length }}</span><span class="stat__label">kusů celkem</span></div>
            <div class="stat"><span class="stat__value">{{ preview().holders.length }}</span><span class="stat__label">dotčených držitelů</span></div>
            <div class="stat"><span class="stat__value">{{ preview().loanedCount }}</span><span class="stat__label">zapůjčených kusů</span></div>
            <div class="stat"><span class="stat__value">{{ preview().unloanedCount }}</span><span class="stat__label">nezapůjčených (sklad, oprava…)</span></div>
          </div>
          @if (!preview().itemIds.length) {
            <div class="warn-box">Rozsah je prázdný – žádný kus neodpovídá filtrům.</div>
          }
          <button type="button" class="btn-primary" [disabled]="busy() || !preview().itemIds.length" (click)="start()">Zahájit inventuru</button>
        </section>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeInventoryNewComponent {
  private inventories = inject(InventoryService);
  private router = inject(Router);
  private members = inject(MembersService).members;
  readonly groups = inject(GroupsService).groups;
  readonly state = toSignal(this.inventories.state$);

  readonly name = signal('');
  readonly scope = signal<InventoryScope>(emptyScope());
  readonly capacity = signal(this.state()?.defaultSlotCapacity ?? 3);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly preview = computed(() => (this.state() ? resolveScope(this.state()!, this.scope(), this.members()) : { itemIds: [], holders: [], loanedCount: 0, unloanedCount: 0 }));
  readonly label = computed(() => (this.state() ? scopeLabel(this.state()!, this.scope(), this.groups()) : ''));

  has(list: ScopeList, id: string | number): boolean {
    return (this.scope()[list] as (string | number)[]).includes(id);
  }

  toggle(list: ScopeList, id: string | number): void {
    this.scope.update((s) => {
      const values = s[list] as (string | number)[];
      return { ...s, [list]: values.includes(id) ? values.filter((v) => v !== id) : [...values, id] };
    });
  }

  start(): void {
    this.busy.set(true);
    this.error.set('');
    this.inventories.createInventory({ name: this.name(), scope: this.scope(), scopeLabel: this.label(), slotCapacity: this.capacity() || undefined }, this.members()).subscribe({
      next: (inv) => this.router.navigate(['/app/wardrobe/inventories', inv.id]),
      error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); },
    });
  }
}
