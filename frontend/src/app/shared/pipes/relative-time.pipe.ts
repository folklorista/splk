import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'relativeTime',
  standalone: true,
  pure: false,
})
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';

    const diffMs = Date.now() - new Date(value).getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'právě teď';
    if (diffMin < 60) return `před ${diffMin} min`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `před ${diffHour} h`;

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `před ${diffDay} d`;

    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `před ${diffMonth} ${diffMonth === 1 ? 'měsícem' : 'měsíci'}`;

    const diffYear = Math.floor(diffMonth / 12);
    return `před ${diffYear} ${diffYear === 1 ? 'rokem' : 'lety'}`;
  }
}
