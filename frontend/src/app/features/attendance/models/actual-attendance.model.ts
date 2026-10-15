// Skutečná přítomnost na akci – vede ji výbor/admin. Je oddělená od nahlášené účasti
// (AttendanceRecord), takže původní odpověď člena zůstává zachovaná pro porovnání.
export interface ActualAttendance {
  eventId: number;
  memberId: number;
  present: boolean;
  recordedByMemberId: number;
  recordedAt: string;
}
