import { Component } from '@angular/core';

@Component({
  selector: 'app-posts',
  standalone: true,
  template: `
    <div class="placeholder-page">
      <h1>Nástěnka</h1>
      <p class="placeholder-page__note">Oznámení a příspěvky – připravuje se.</p>
    </div>
  `,
})
export class PostsComponent {}
