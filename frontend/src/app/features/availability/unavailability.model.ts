// Dlouhodobá nedostupnost člena (dovolená, studijní pobyt, rekonvalescence) – docs/07, docs/10 kap. 4.11.
// Jen informace pro organizátory; nenahrazuje odpověď na konkrétní akci ani není omluvenkou.
export interface Unavailability {
  id: number;
  ensembleId: number;
  memberId: number;
  // Datum od–do včetně (YYYY-MM-DD)
  from: string;
  to: string;
  // Důvod vidí jen člen sám a pověření organizátoři
  note?: string;
  createdAt: string;
  createdById: number;
}

export interface UnavailabilityInput {
  from: string;
  to: string;
  note?: string;
}
