import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { BuildInfoService } from '../../core/build/build-info.service';
import { versionLabel } from '../../core/build/build-info';

@Component({
  selector: 'app-version-label',
  standalone: true,
  imports: [RouterLink],
  template: `<a class="version-label" routerLink="/app/changelog" title="Co je nového">{{ label() }}</a>`,
})
export class VersionLabelComponent {
  private readonly buildInfo = inject(BuildInfoService);
  readonly label = toSignal(this.buildInfo.getBuildInfo().pipe(map(versionLabel)), { initialValue: '' });
}
