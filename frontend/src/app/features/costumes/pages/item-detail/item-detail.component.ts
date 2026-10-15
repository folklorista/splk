import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { canManageCostumes } from '../../costume-permissions';
import {
  ITEM_STATUS_LABELS,
  borrowerKey,
  borrowerLabel,
  itemCode,
  itemStatus,
  kitLabel,
  openLineForItem,
  partTypeName,
  seriesName,
} from '../../utils/costume-logic';
import { ActionFeedback, COSTUME_PAGE_STYLES } from '../items/costume-ui';
import { itemHistory, userName } from './item-history';

@Component({
  selector: 'app-costume-item-detail',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink, DatePipe],
  templateUrl: './item-detail.component.html',
  styles: [COSTUME_PAGE_STYLES],
})
export class CostumeItemDetailComponent {
  private costumes = inject(CostumesService);
  private auth = inject(AuthService);

  readonly itemId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  readonly state = toSignal(this.costumes.state$, { initialValue: this.costumes.snapshot });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });
  readonly canManage = computed(() => canManageCostumes(this.auth.currentUser()));
  readonly feedback = new ActionFeedback();
  readonly statusLabels = ITEM_STATUS_LABELS;

  readonly item = computed(() => this.state().items.find((i) => i.id === this.itemId));
  readonly view = computed(() => {
    const state = this.state();
    const item = this.item();
    if (!item) return undefined;
    const open = openLineForItem(state, item.id);
    return {
      item,
      code: itemCode(state, item),
      series: seriesName(state, item.seriesId),
      partType: partTypeName(state, item.partTypeId),
      kit: kitLabel(state, item.kitId),
      status: itemStatus(state, item),
      loan: open?.loan,
      holder: open ? borrowerLabel(open.loan.borrower, this.members(), state.externals) : undefined,
      holderKey: open ? borrowerKey(open.loan.borrower) : undefined,
      retiredBy: item.retired ? userName(this.members(), item.retired.byUserId) : '',
    };
  });
  readonly history = computed(() => itemHistory(this.state(), this.itemId, this.members()));

  // Formuláře akcí
  readonly readyNote = signal('');
  readonly targetKitId = signal<string>(String(this.item()?.kitId ?? ''));
  readonly kitNote = signal('');
  readonly retireReason = signal('');
  readonly settleLoan = signal(false);

  toggleReady(): void {
    const item = this.item();
    if (!item) return;
    this.feedback.run(this.costumes.setItemReady(item.id, !item.ready, this.readyNote()), () => this.readyNote.set(''));
  }

  moveToKit(): void {
    const target = this.targetKitId();
    const kitId = target === '' ? undefined : Number(target);
    this.feedback.run(this.costumes.moveItemToKit(this.itemId, kitId, this.kitNote()), () => this.kitNote.set(''));
  }

  retire(): void {
    this.feedback.run(
      this.costumes.retireItem(this.itemId, this.retireReason(), this.settleLoan()),
      () => this.retireReason.set(''),
      'Součást vyřazena',
    );
  }
}
