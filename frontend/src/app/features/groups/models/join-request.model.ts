// Žádost o vstup (podává sám člověk) nebo pozvánka (posílá správce, nebo ji navrhne člen skupiny
// a správce schválí). Přístup vznikne až dokončením celého toku (docs/08 kap. 7).
export type JoinRequestKind = 'request' | 'invitation';

export type JoinRequestStatus =
  | 'awaiting-manager' // žádost nebo návrh čeká na správce skupiny
  | 'awaiting-member' // pozvánka čeká na pozvaného
  | 'accepted'
  | 'rejected' // zamítl správce
  | 'declined' // pozvaný odmítl
  | 'cancelled';

export interface JoinRequest {
  id: number;
  groupId: number;
  memberId: number;
  kind: JoinRequestKind;
  status: JoinRequestStatus;
  createdById: number;
  createdAt: string;
  // Kdo návrh/žádost schválil správcovsky (u pozvánky od správce = tvůrce)
  approvedById?: number;
  decidedAt?: string;
  decidedById?: number;
  message?: string;
}

export const JOIN_STATUS_LABELS: Record<JoinRequestStatus, string> = {
  'awaiting-manager': 'Čeká na správce',
  'awaiting-member': 'Čeká na pozvaného',
  accepted: 'Přijato',
  rejected: 'Zamítnuto',
  declined: 'Odmítnuto',
  cancelled: 'Zrušeno',
};

export function isPendingJoinRequest(r: JoinRequest): boolean {
  return r.status === 'awaiting-manager' || r.status === 'awaiting-member';
}
