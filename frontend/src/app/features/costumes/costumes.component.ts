import { Component } from '@angular/core';
import { CostumesNavComponent } from './costumes-nav/costumes-nav.component';

@Component({
  selector: 'app-costumes',
  standalone: true,
  imports: [CostumesNavComponent],
  templateUrl: './costumes.component.html',
})
export class CostumesComponent {}
