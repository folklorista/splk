import { Component, OnInit, signal } from '@angular/core';
import { CostumeCategory, CostumeItem, CostumeCondition } from './models/costume.model';
import { CostumesService } from './costumes.service';

const CONDITION_LABELS: Record<CostumeCondition, string> = {
  'good': 'Dobrý stav',
  'needs-repair': 'Nutná oprava',
  'damaged': 'Poškozeno',
  'retired': 'Vyřazeno',
};

@Component({
  selector: 'app-costumes',
  standalone: true,
  templateUrl: './costumes.component.html',
})
export class CostumesComponent implements OnInit {
  categories = signal<CostumeCategory[]>([]);
  itemsByCategory = signal<Record<number, CostumeItem[]>>({});
  expandedCategoryId = signal<number | null>(null);
  loading = signal(true);

  readonly conditionLabels = CONDITION_LABELS;

  constructor(private costumesService: CostumesService) {}

  ngOnInit(): void {
    this.costumesService.getCategories().subscribe((categories) => {
      this.categories.set(categories);
      this.loading.set(false);
    });
  }

  toggleCategory(categoryId: number): void {
    if (this.expandedCategoryId() === categoryId) {
      this.expandedCategoryId.set(null);
      return;
    }
    this.expandedCategoryId.set(categoryId);
    if (!this.itemsByCategory()[categoryId]) {
      this.costumesService.getItems(categoryId).subscribe((items) => {
        this.itemsByCategory.update((map) => ({ ...map, [categoryId]: items }));
      });
    }
  }

  conditionLabel(condition: CostumeCondition): string {
    return CONDITION_LABELS[condition];
  }
}
