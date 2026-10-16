import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CostumesNavComponent } from './costumes-nav/costumes-nav.component';
import { MyCostumesComponent } from './my-costumes/my-costumes.component';
import { CostumesService } from './costumes.service';
import { AuthService } from '../../core/auth/auth.service';
import { AccessService } from '../../core/access/access.service';
import { stockSummary } from './utils/costume-logic';

// Rozcestník krojů: každý člen vidí své kroje, krojárky a vedení navíc souhrn skladu
@Component({
  selector: 'app-costumes',
  standalone: true,
  imports: [CostumesNavComponent, MyCostumesComponent, RouterLink],
  templateUrl: './costumes.component.html',
})
export class CostumesComponent {
  private readonly accessService = inject(AccessService);
  private auth = inject(AuthService);
  private state = toSignal(inject(CostumesService).state$);

  readonly canManage = this.accessService.canManageCostumes;
  readonly canViewStock = this.accessService.canViewCostumeStock;
  readonly summary = computed(() => {
    const state = this.state();
    return state ? stockSummary(state) : null;
  });
}
