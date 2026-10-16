// Přihlášený uživatel – jen identita. Členství a pověření se čtou živě přes AccessService,
// aby změna ve Správě platila hned a nezůstávala zamrzlá v uloženém přihlášení.
export interface User {
  id: number;
  name: string;
  email: string;
}
