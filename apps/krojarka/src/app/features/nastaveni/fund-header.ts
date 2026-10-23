import { Component, inject } from '@angular/core';
import { FundContext } from '../../core/fund/fund-context';

/** Which fund the page edits and whether the person may change it. */
@Component({
  selector: 'app-fund-header',
  template: `
    @if (funds.current(); as fund) {
      <p class="fund-line">
        Krojový fond: <strong>{{ fund.name }}</strong>
        @if (!fund.canManage) {
          <span class="tag">jen pro čtení</span>
        }
      </p>
    }
  `,
})
export class FundHeader {
  protected readonly funds = inject(FundContext);
}
