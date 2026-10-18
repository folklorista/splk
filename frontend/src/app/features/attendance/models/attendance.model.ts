export type AttendanceStatus = 'yes' | 'no' | 'maybe' | 'pending';

export interface AttendanceRecord {
  eventId: number;
  memberId: number;
  status: AttendanceStatus;
  note?: string;
  firstViewedAt?: string;
  // Poslední otevření detailu akce (každé otevření; rychlá odpověď ze seznamu ho nemění) – docs/07 kap. 18
  lastViewedAt?: string;
  // Výslovné potvrzení důležité změny (jiný údaj než pouhé zobrazení)
  confirmedAt?: string;
}
