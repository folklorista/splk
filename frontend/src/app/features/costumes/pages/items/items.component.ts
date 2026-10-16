import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AccessService } from '../../../../core/access/access.service';
import { ITEM_STATUS_LABELS, ItemStatus } from '../../utils/costume-logic';
import { downloadCsv, printPage } from '../../../../shared/export/export.utils';
import { ItemFilter, buildItemRows, filterItemRows, itemCsvRows } from './items.utils';

const STATUSES: ItemStatus[] = ['available', 'not-ready', 'on-loan', 'retired'];

const optionalId = (value: string | null): number | undefined => (value ? Number(value) : undefined);

@Component({
  selector: 'app-costume-items',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink],
  templateUrl: './items.component.html',
  styles: [
    `
      .items__count { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--spacing-sm); }
      .items__code { font-weight: 700; }
      .items__meta { display: flex; flex-wrap: wrap; gap: 2px var(--spacing-md); }
      @media (min-width: 768px) {
        .item-list__item { padding: var(--spacing-sm) var(--spacing-md); }
      }
      @media print {
        .item-list { gap: 0; }
        .item-list__item { border-radius: 0; padding: 4px 0; border-width: 0 0 1px; }
      }
    `,
  ],
})
export class CostumeItemsComponent {
  private readonly accessService = inject(AccessService);
  private costumes = inject(CostumesService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly state = toSignal(this.costumes.state$, { initialValue: this.costumes.snapshot });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });
  readonly canManage = this.accessService.canManageCostumes;

  readonly statuses = STATUSES;
  readonly statusLabels = ITEM_STATUS_LABELS;

  // Výchozí filtry lze předat v URL (např. ?status=retired pro přehled vyřazených)
  private params = this.route.snapshot.queryParamMap;
  readonly query = signal(this.params.get('q') ?? '');
  readonly seriesId = signal(optionalId(this.params.get('seriesId')));
  readonly partTypeId = signal(optionalId(this.params.get('partTypeId')));
  readonly status = signal((this.params.get('status') as ItemStatus | null) ?? undefined);
  readonly kitId = signal(optionalId(this.params.get('kitId')));

  readonly rows = computed(() => buildItemRows(this.state(), this.members()));
  readonly filter = computed<ItemFilter>(() => ({
    query: this.query(),
    seriesId: this.seriesId(),
    partTypeId: this.partTypeId(),
    status: this.status(),
    kitId: this.kitId(),
  }));
  readonly visibleRows = computed(() => filterItemRows(this.rows(), this.filter()));
  readonly numberedPartTypes = computed(() => this.state().partTypes.filter((t) => t.numbered));
  readonly hasFilter = computed(() => {
    const f = this.filter();
    return !!f.query || f.seriesId !== undefined || f.partTypeId !== undefined || !!f.status || f.kitId !== undefined;
  });

  setNumber(target: 'series' | 'partType' | 'kit', value: string): void {
    const id = value === '' ? undefined : Number(value);
    if (target === 'series') this.seriesId.set(id);
    else if (target === 'partType') this.partTypeId.set(id);
    else this.kitId.set(id);
  }

  setStatus(value: string): void {
    this.status.set((value || undefined) as ItemStatus | undefined);
  }

  resetFilter(): void {
    this.query.set('');
    this.seriesId.set(undefined);
    this.partTypeId.set(undefined);
    this.status.set(undefined);
    this.kitId.set(undefined);
  }

  print(): void {
    printPage();
  }

  exportCsv(): void {
    const suffix = this.status() === 'retired' ? 'vyrazene-soucasti' : 'soucasti';
    downloadCsv(`krojovy-sklad-${suffix}`, itemCsvRows(this.visibleRows()));
  }
}
