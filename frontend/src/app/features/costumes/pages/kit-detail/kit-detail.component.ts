import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AccessService } from '../../../../core/access/access.service';
import {
  ITEM_STATUS_LABELS,
  KIT_COMPLETENESS_LABELS,
  borrowerKey,
  borrowerLabel,
  itemCode,
  kitLabel,
  kitView,
  partTypeName,
  seriesName,
} from '../../utils/costume-logic';
import { downloadCsv, printPage } from '../../../../shared/export/export.utils';
import { ActionFeedback } from '../items/costume-ui';
import { userName } from '../item-detail/item-history';
import { bulkSeparateHolders, bulkStatusText, compositionStatus, kitCompositionCsvRows } from '../kits/kits.utils';

const toInt = (value: string): number => (value.trim() === '' ? 0 : Number(value));

@Component({
  selector: 'app-costume-kit-detail',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink, DatePipe],
  templateUrl: './kit-detail.component.html',
  styles: [
    `
      .kit__list { list-style: none; display: flex; flex-direction: column; }
      .kit__row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px var(--spacing-md); padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--color-border); font-size: var(--font-size-sm); }
      .kit__row:last-child { border-bottom: none; }
      .kit__name { font-weight: 600; }
      .kit__state { color: var(--color-text-muted); }
      .kit__state--warn { color: var(--color-primary); font-weight: 600; }
    `,
  ],
})
export class CostumeKitDetailComponent {
  private readonly accessService = inject(AccessService);
  private costumes = inject(CostumesService);
  private auth = inject(AuthService);

  readonly kitId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  readonly state = toSignal(this.costumes.state$, { initialValue: this.costumes.snapshot });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });
  readonly canManage = this.accessService.canManageCostumes;
  readonly feedback = new ActionFeedback();
  readonly completenessLabels = KIT_COMPLETENESS_LABELS;
  readonly statusLabels = ITEM_STATUS_LABELS;

  readonly kit = computed(() => this.state().kits.find((k) => k.id === this.kitId));
  readonly view = computed(() => {
    const kit = this.kit();
    return kit ? kitView(this.state(), kit) : undefined;
  });
  readonly series = computed(() => seriesName(this.state(), this.kit()?.seriesId));
  readonly holder = computed(() => {
    const loan = this.view()?.kitLoan;
    return loan ? { label: borrowerLabel(loan.borrower, this.members(), this.state().externals), key: borrowerKey(loan.borrower), loanId: loan.id } : undefined;
  });

  readonly itemRows = computed(() => {
    const state = this.state();
    return (this.view()?.items ?? [])
      .map((entry) => ({
        entry,
        name: partTypeName(state, entry.item.partTypeId),
        code: itemCode(state, entry.item),
        status: compositionStatus(state, entry, this.members()),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs') || a.code.localeCompare(b.code, 'cs', { numeric: true }));
  });

  readonly bulkRows = computed(() => {
    const state = this.state();
    const view = this.view();
    if (!view) return [];
    return view.bulk.map((bulk) => ({
      bulk,
      name: partTypeName(state, bulk.line.partTypeId),
      text: bulkStatusText(bulk),
      holders: bulkSeparateHolders(state, view, bulk.line.partTypeId, this.members()),
    }));
  });

  readonly history = computed(() =>
    this.state()
      .log.filter((entry) => entry.kitId === this.kitId)
      .map((entry) => ({ entry, by: userName(this.members(), entry.byUserId) }))
      .sort((a, b) => a.entry.at.localeCompare(b.entry.at)),
  );

  // Přidání existující součásti – nevyřazené součásti mimo tento komplet
  readonly addCandidates = computed(() => {
    const state = this.state();
    return state.items
      .filter((item) => !item.retired && item.kitId !== this.kitId)
      .map((item) => ({
        item,
        label: `${partTypeName(state, item.partTypeId)} – ${itemCode(state, item)}`,
        fromKit: kitLabel(state, item.kitId),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs', { numeric: true }));
  });
  readonly unnumberedTypes = computed(() => this.state().partTypes.filter((t) => !t.numbered));

  readonly addItemId = signal('');
  readonly addNote = signal('');
  readonly selectedCandidate = computed(() => this.addCandidates().find((c) => String(c.item.id) === this.addItemId()));

  readonly removeItemId = signal('');
  readonly removeNote = signal('');

  readonly bulkPartTypeId = signal('');
  readonly bulkRequired = signal('');
  readonly bulkPresent = signal('');
  readonly bulkNote = signal('');

  readonly editLabel = signal('');
  readonly editSeriesId = signal('');
  readonly editNote = signal('');
  readonly editNeedsCheck = signal(false);

  constructor() {
    this.resetEdit();
  }

  resetEdit(): void {
    const kit = this.kit();
    this.editLabel.set(kit?.label ?? '');
    this.editSeriesId.set(kit?.seriesId !== undefined ? String(kit.seriesId) : '');
    this.editNote.set(kit?.note ?? '');
    this.editNeedsCheck.set(!!kit?.needsCheck);
  }

  addItem(): void {
    if (!this.addItemId()) return;
    this.feedback.run(this.costumes.moveItemToKit(Number(this.addItemId()), this.kitId, this.addNote()), () => {
      this.addItemId.set('');
      this.addNote.set('');
    });
  }

  removeItem(): void {
    if (!this.removeItemId()) return;
    this.feedback.run(this.costumes.moveItemToKit(Number(this.removeItemId()), undefined, this.removeNote()), () => {
      this.removeItemId.set('');
      this.removeNote.set('');
    });
  }

  // Výběr druhu předvyplní současné počty, pokud už ve složení je
  selectBulkType(value: string): void {
    this.bulkPartTypeId.set(value);
    const line = this.kit()?.bulk.find((b) => String(b.partTypeId) === value);
    this.bulkRequired.set(line ? String(line.required) : '1');
    this.bulkPresent.set(line ? String(line.present) : '1');
    this.bulkNote.set('');
  }

  saveBulk(): void {
    if (!this.bulkPartTypeId()) return;
    this.feedback.run(
      this.costumes.setKitBulk(this.kitId, Number(this.bulkPartTypeId()), toInt(this.bulkRequired()), toInt(this.bulkPresent()), this.bulkNote()),
      () => this.bulkNote.set(''),
    );
  }

  saveKit(): void {
    this.feedback.run(
      this.costumes.updateKit(this.kitId, {
        label: this.editLabel(),
        seriesId: this.editSeriesId() === '' ? undefined : Number(this.editSeriesId()),
        note: this.editNote(),
        needsCheck: this.editNeedsCheck(),
      }),
    );
  }

  print(): void {
    printPage();
  }

  exportCsv(): void {
    const view = this.view();
    if (!view) return;
    downloadCsv(`komplet-${view.kit.label}`, kitCompositionCsvRows(this.state(), view, this.members()));
  }
}
