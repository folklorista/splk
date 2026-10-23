import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api-error';
import { MOCK_LOGIN, MockAuthApi } from './mock-auth-api';

describe('MockAuthApi', () => {
  let api: MockAuthApi;

  beforeEach(() => {
    vi.useFakeTimers();
    api = new MockAuthApi();
  });

  afterEach(() => vi.useRealTimers());

  const resolve = async <T>(source: Promise<T>): Promise<T> => {
    await vi.runAllTimersAsync();
    return source;
  };

  it('behaves like the API: 401 before login, profile after it', async () => {
    await expect(firstValueFrom(api.me())).rejects.toMatchObject({ status: 401, code: 'unauthenticated' });
    await expect(firstValueFrom(api.login(MOCK_LOGIN.email, 'wrong'))).rejects.toMatchObject({ code: 'invalid_credentials' });

    const me = await resolve(firstValueFrom(api.login(MOCK_LOGIN.email.toUpperCase(), MOCK_LOGIN.password)));
    expect(me.account.loginEmail).toBe(MOCK_LOGIN.email);
    expect((await resolve(firstValueFrom(api.me()))).person.lastName).toBe('Ukázková');
  });

  it('validates password changes with the API error codes', async () => {
    await resolve(firstValueFrom(api.login(MOCK_LOGIN.email, MOCK_LOGIN.password)));

    const wrong = (await firstValueFrom(api.changePassword('bad', 'long enough 1')).catch((e: unknown) => e)) as ApiError;
    expect(wrong.reason).toBe('password_incorrect');
    const short = (await firstValueFrom(api.changePassword(MOCK_LOGIN.password, 'short')).catch((e: unknown) => e)) as ApiError;
    expect(short.reason).toBe('password_too_short');

    await resolve(firstValueFrom(api.changePassword(MOCK_LOGIN.password, 'long enough 1')));
    await resolve(firstValueFrom(api.logout()));
    await expect(resolve(firstValueFrom(api.login(MOCK_LOGIN.email, 'long enough 1')))).resolves.toBeTruthy();
  });
});
