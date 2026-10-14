import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { BuildInfo } from './build-info';

@Injectable({ providedIn: 'root' })
export class BuildInfoService {
  private readonly http = inject(HttpClient);

  // Při `ng serve` bez vygenerovaného souboru (nebo offline) je výsledek null
  private readonly buildInfo$: Observable<BuildInfo | null> = this.http
    .get<BuildInfo>('build-info.json')
    .pipe(
      catchError(() => of(null)),
      shareReplay(1),
    );

  getBuildInfo(): Observable<BuildInfo | null> {
    return this.buildInfo$;
  }
}
