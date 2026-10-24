import { Component, input } from '@angular/core';
import { InventoryProgress } from '@splk/api-contracts';

@Component({ selector: 'app-inventory-progress', template: `
  <section class="card" aria-label="Průběh inventury">
    @if (progress().expectedQuantity > 0) {
      <p><strong>Číslované kusy: {{ progress().verifiedQuantity }} / {{ progress().expectedQuantity }} fyzicky ověřeno ({{ percentage() }} %)</strong></p>
    } @else { <p>Rozsah neobsahuje číslované kusy.</p> }
    <p>Komplety: {{ progress().verifiedKitCount }} / {{ progress().kitCount }} fyzicky ověřeno.</p>
    <p>Nečíslované zásoby: zapsané počty na {{ progress().comparedBulkTargetCount }} / {{ progress().bulkTargetCount }} místech evidence (sklad, komplety, výpůjčky).</p>
    <p>Návštěvy: {{ progress().visitedPeopleCount }} / {{ progress().peopleCount }} dotčených osob odbaveno.</p>
    <p>Nevyřešené položky: {{ progress().openIssueCount }}. Dokončená návštěva ani údaj o složení nenahrazují fyzické ověření.</p>
    <p class="muted">Jedno fyzické ověření stačí pro pokrytí kusu; pozdější nepřítomnost zůstává samostatnou nesrovnalostí. Zásoby se do procenta kusů nezapočítávají.</p>
  </section>
` })
export class InventoryProgressPanel {
  readonly progress = input.required<InventoryProgress>();
  protected percentage(): number { const p = this.progress(); return p.expectedQuantity ? Math.round(100 * p.verifiedQuantity / p.expectedQuantity) : 0; }
}
