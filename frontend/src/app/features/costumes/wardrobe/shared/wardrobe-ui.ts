import { AccessDeniedError } from '../../../../core/access/mandate-rules';
import { CostumeRuleError } from '../../utils/costume-ops';

// Text chyby pro uživatele: pravidla evidence a oprávnění mají vlastní srozumitelné hlášky
export function errorMessage(error: unknown, fallback = 'Akci se nepodařilo provést.'): string {
  return error instanceof CostumeRuleError || error instanceof AccessDeniedError ? error.message : fallback;
}
