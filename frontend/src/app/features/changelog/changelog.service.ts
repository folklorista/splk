import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ReleaseDance } from '../../core/build/build-info';

// Záznam z public/changelog.json (zapisuje scripts/release.mjs), nejnovější první
export interface ChangelogEntry {
  version: string;
  releasedAt: string;
  dance: ReleaseDance;
  changes: string[];
}

@Injectable({ providedIn: 'root' })
export class ChangelogService {
  constructor(private http: HttpClient) {}

  getChangelog(): Observable<ChangelogEntry[]> {
    return this.http.get<ChangelogEntry[]>('changelog.json').pipe(catchError(() => of([])));
  }
}
