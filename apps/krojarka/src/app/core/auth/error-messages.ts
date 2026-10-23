import { ApiError } from '../../data/api-error';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Nesprávný e-mail nebo heslo.',
  too_many_attempts: 'Příliš mnoho neúspěšných pokusů. Zkuste to znovu za 15 minut.',
  reset_token_invalid: 'Odkaz je neplatný nebo vypršel. Požádejte o nový.',
  unauthenticated: 'Přihlášení vypršelo. Přihlaste se znovu.',
  network_error: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.',
};

const REASONS: Record<string, string> = {
  required: 'Vyplňte prosím všechna pole.',
  invalid_email: 'Zadejte platný e-mail.',
  password_too_short: 'Heslo musí mít alespoň 10 znaků.',
  password_incorrect: 'Současné heslo není správné.',
  too_long: 'Zadaný text je příliš dlouhý.',
};

/** Czech message for an API error; the stable code decides, not the English message. */
export function errorMessage(error: unknown): string {
  const apiError = ApiError.from(error);
  if (apiError.code === 'validation_failed') {
    return REASONS[apiError.reason ?? ''] ?? 'Zkontrolujte zadané údaje.';
  }
  return MESSAGES[apiError.code] ?? 'Něco se nepovedlo. Zkuste to prosím znovu.';
}
