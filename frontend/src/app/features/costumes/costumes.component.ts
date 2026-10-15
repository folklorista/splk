import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CostumesNavComponent } from './costumes-nav/costumes-nav.component';
import { MyCostumesComponent } from './my-costumes/my-costumes.component';
import { CostumesService } from './costumes.service';
import { AuthService } from '../../core/auth/auth.service';
import { canManageCostumes, canViewCostumeStock } from './costume-permissions';
import { stockSummary } from './utils/costume-logic';

// Rozcestník krojů: každý člen vidí své kroje, krojárky a vedení navíc souhrn skladu
@Component({
  selector: 'app-costumes',
  standalone: true,
  imports: [CostumesNavComponent, MyCostumesComponent, RouterLink],
  templateUrl: './costumes.component.html',
})
export class CostumesComponent {
  private auth = inject(AuthService);
  private state = toSignal(inject(CostumesService).state$);

  readonly canManage = computed(() => canManageCostumes(this.auth.currentUser()));
  readonly canViewStock = computed(() => canViewCostumeStock(this.auth.currentUser()));
  readonly summary = computed(() => {
    const state = this.state();
    return state ? stockSummary(state) : null;
  });
}
