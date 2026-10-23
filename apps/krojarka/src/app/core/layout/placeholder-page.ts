import { Component, input } from '@angular/core';

/** Section from the menu that is not implemented yet (title and description come from route data). */
@Component({
  selector: 'app-placeholder-page',
  template: `
    <h1 class="page-title">{{ title() }}</h1>
    <section class="card">
      <p>{{ description() }}</p>
      <p class="muted">Tato část se připravuje.</p>
    </section>
  `,
})
export class PlaceholderPage {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
