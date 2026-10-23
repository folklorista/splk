import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../../data/api-error';
import { errorMessage } from './error-messages';

describe('errorMessage', () => {
  it('translates stable codes and validation reasons to Czech', () => {
    expect(errorMessage(new ApiError(401, 'invalid_credentials'))).toBe('Nesprávný e-mail nebo heslo.');
    expect(errorMessage(new ApiError(422, 'validation_failed', { reason: 'password_too_short' }))).toBe('Heslo musí mít alespoň 10 znaků.');
  });

  it('reports a network failure and falls back for unknown errors', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('spojit se serverem');
    expect(errorMessage(new Error('x'))).toBe('Něco se nepovedlo. Zkuste to prosím znovu.');
  });
});
