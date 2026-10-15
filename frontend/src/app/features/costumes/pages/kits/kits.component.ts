import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { canManageCostumes } from '../../costume-permissions';
import { KIT_COMPLETENESS_LABELS } from '../../utils/costume-logic';
import { downloadCsv, printPage } from '../../../../shared/export/export.utils';
import { ActionFeedback, COSTUME_PAGE_STYLES } from '../items/costume-ui';
import { buildKitRows, kitsCsvRows } from './kits.utils';

@Component({
  selector: 'app-costume-kits',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-costumes-nav />
      <h1 class="page__title">Komplety</h1>

      <div class="cs-toolbar no-print">
        <span class="cs-toolbar__spacer"></span>
        <button type="button" class="cs-btn" (click)="print()">Tisk</button>
        <button type="button" class="cs-btn" (click)="exportCsv()">Export CSV</button>
      </div>

      @if (canManage()) {
        <details class="cs-panel kits__new no-print" [open]="newOpen()" (toggle)="newOpen.set($any($event.target).open)">
          <summary>+ Nový komplet</summary>
          <form class="cs-panel__body" (submit)="$event.preventDefault(); create()">
            <div class="cs-form__row">
              <label class="cs-field">
                <span>Označení *</span>
                <input type="text" placeholder="např. HČ ženský 3" [value]="label()" (input)="label.set($any($event.target).value)" />
              </label>
              <label class="cs-field">
                <span>Řada</span>
                <select (change)="seriesId.set($any($event.target).value)">
                  <option value="" [selected]="seriesId() === ''">Bez řady</option>
                  @for (series of state().series; track series.id) {
                    <option [value]="series.id" [selected]="seriesId() === '' + series.id">{{ series.name }}</option>
                  }
                </select>
              </label>
            </div>
            <label class="cs-field">
              <span>Poznámka</span>
              <input type="text" [value]="note()" (input)="note.set($any($event.target).value)" />
            </label>
            @if (feedback.error()) {
              <p class="cs-error" role="alert">{{ feedback.error() }}</p>
            }
            <div class="cs-form__actions">
              <button type="submit" class="cs-btn cs-btn--primary" [disabled]="feedback.busy()">Založit komplet</button>
            </div>
          </form>
        </details>
      }

      @if (!rows().length) {
        <p class="state-note">Zatím žádné komplety.</p>
      } @else {
        <ul class="item-list">
          @for (row of rows(); track row.view.kit.id) {
            <li class="item-list__item item-list__item--link" [routerLink]="['/app/costumes/kits', row.view.kit.id]">
              <div class="item-list__row">
                <span class="item-list__title">{{ row.view.kit.label }}</span>
                <span class="item-list__badges">
                  <span class="badge cs-status cs-status--{{ row.view.completeness }}">{{ completenessLabels[row.view.completeness] }}</span>
                  @if (row.holder) {
                    <span class="badge cs-status cs-status--on-loan">Zapůjčeno</span>
                  }
                </span>
              </div>
              <div class="item-list__meta kits__meta">
                @if (row.series) {
                  <span>{{ row.series }}</span>
                }
                <span>Součástí: {{ row.partCount }}</span>
                @if (row.holder) {
                  <span>Svěřeno: <strong>{{ row.holder }}</strong></span>
                }
              </div>
              @if (row.missing.length) {
                <div class="item-list__body">Chybí: {{ row.missing.join(', ') }}</div>
              }
              @if (row.view.kit.note) {
                <div class="item-list__body cs-muted">{{ row.view.kit.note }}</div>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    COSTUME_PAGE_STYLES,
    `
      .kits__new { margin-bottom: var(--spacing-md); }
      .kits__meta { display: flex; flex-wrap: wrap; gap: 2px var(--spacing-md); }
    `,
  ],
})
export class CostumeKitsComponent {
  private costumes = inject(CostumesService);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly state = toSignal(this.costumes.state$, { initialValue: this.costumes.snapshot });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });
  readonly canManage = computed(() => canManageCostumes(this.auth.currentUser()));
  readonly rows = computed(() => buildKitRows(this.state(), this.members()));
  readonly completenessLabels = KIT_COMPLETENESS_LABELS;
  readonly feedback = new ActionFeedback();

  readonly newOpen = signal(false);
  readonly label = signal('');
  readonly seriesId = signal('');
  readonly note = signal('');

  create(): void {
    const seriesId = this.seriesId() === '' ? undefined : Number(this.seriesId());
    this.feedback.run(this.costumes.createKit(this.label(), seriesId, this.note()), (kit) =>
      this.router.navigate(['/app/costumes/kits', kit.id]),
    );
  }

  print(): void {
    printPage();
  }

  exportCsv(): void {
    downloadCsv('krojovy-sklad-komplety', kitsCsvRows(this.rows()));
  }
}
