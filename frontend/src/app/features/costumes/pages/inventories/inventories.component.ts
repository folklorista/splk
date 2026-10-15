import { Component } from '@angular/core';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';

// TODO: implementovat podle docs/06-specifikace-krojoveho-skladu.md
@Component({
  selector: 'app-costume-inventories',
  standalone: true,
  imports: [CostumesNavComponent],
  template: `
    <div class="page">
      <app-costumes-nav />
      <h1 class="page__title">Inventury</h1>
    </div>
  `,
})
export class CostumeInventoriesComponent {}
