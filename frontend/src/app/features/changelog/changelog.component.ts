import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ChangelogEntry, ChangelogService } from './changelog.service';
import { BuildInfoService } from '../../core/build/build-info.service';
import { versionLabel } from '../../core/build/build-info';

@Component({
  selector: 'app-changelog',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './changelog.component.html',
})
export class ChangelogComponent {
  private readonly changelog = inject(ChangelogService);
  private readonly buildInfoService = inject(BuildInfoService);

  readonly entries = toSignal<ChangelogEntry[] | null>(this.changelog.getChangelog(), { initialValue: null });
  readonly buildInfo = toSignal(this.buildInfoService.getBuildInfo(), { initialValue: null });
  readonly currentLabel = toSignal(this.buildInfoService.getBuildInfo().pipe(map(versionLabel)), { initialValue: '' });
}
