import { ApiError } from '../../data/api-error';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Nesprávný e-mail nebo heslo.',
  too_many_attempts: 'Příliš mnoho neúspěšných pokusů. Zkuste to znovu za 15 minut.',
  reset_token_invalid: 'Odkaz je neplatný nebo vypršel. Požádejte o nový.',
  unauthenticated: 'Přihlášení vypršelo. Přihlaste se znovu.',
  network_error: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.',
  forbidden: 'K této akci nemáte pověření.',
  not_found: 'Záznam nebyl nalezen, nebo k němu nemáte přístup.',
  duplicate_name: 'Položka se stejným názvem už existuje.',
  part_type_not_numbered: 'Nečíslovaný druh nemá evidenční řadu – eviduje se počtem.',
  account_exists: 'Osoba už účet má.',
  email_taken: 'Tento e-mail už používá jiný účet.',
  account_not_invited: 'Pozvánku lze poslat jen účtu, který ještě nemá heslo.',
  account_not_disabled: 'Účet není zablokovaný.',
  cannot_disable_self: 'Vlastní účet zablokovat nelze.',
  mandate_exists: 'Osoba už toto pověření má.',
  possible_duplicate: 'Osoba se stejným jménem už může být evidovaná. Zkontrolujte shody; samostatnou osobu lze výslovně potvrdit.',
  version_conflict: 'Záznam mezitím změnila jiná krojařka. Vaše rozepsané údaje zůstaly zachované. Obnovte záznam a změny porovnejte.',
  number_already_used: 'Číslo už v této řadě existuje, nebo jej podle pravidel řady nelze použít znovu.',
  duplicate_stock: 'Zásoba stejného druhu a varianty už existuje.',
  insufficient_stock: 'Počet nestačí na evidované množství v kompletech.',
  item_retired: 'Součástka je vyřazená a nelze ji takto měnit.',
  composition_conflict: 'Složení se změnilo nebo součástka patří do jiného kompletu. Obnovte záznam.',
  last_admin: 'Poslední správu organizace nelze odebrat.',
};

const REASONS: Record<string, string> = {
  required: 'Vyplňte prosím všechna pole.',
  invalid_email: 'Zadejte platný e-mail.',
  password_too_short: 'Heslo musí mít alespoň 10 znaků.',
  password_incorrect: 'Současné heslo není správné.',
  too_long: 'Zadaný text je příliš dlouhý.',
  invalid: 'Některý údaj není platný.',
  immutable: 'Druh a typ řady nelze měnit.',
  region_has_children: 'Region s oblastmi nemůže být oblastí jiného regionu.',
  organization_scope_only: 'Toto pověření platí jen pro celou organizaci.',
  not_a_costume_fund: 'Vybraná složka nemá krojový fond.',
};

/** Czech message for an API error; the stable code decides, not the English message. */
export function errorMessage(error: unknown): string {
  const apiError = ApiError.from(error);
  if (apiError.code === 'validation_failed') {
    return REASONS[apiError.reason ?? ''] ?? 'Zkontrolujte zadané údaje.';
  }
  return MESSAGES[apiError.code] ?? 'Něco se nepovedlo. Zkuste to prosím znovu.';
}
