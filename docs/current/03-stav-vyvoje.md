# Stav vývoje

Co je hotové a co se právě dělá. Pořadí vývoje určuje [`../decisions.md`](../decisions.md) D-02. Historický deník do 19. 10. 2026 je v [`../archive/03-postup-vyvoje.md`](../archive/03-postup-vyvoje.md).

## Stav k 2026-10-23

| Část | Stav |
|---|---|
| **Krojařka** (`krojarka.vonica.cz`) | Nezahájena. Zadání: `krojarka/frontend-demo-specifikace.md`, doménová pravidla `06` v0.5. Subdoména a SFTP ověřeny, web obsahuje jen placeholder poskytovatele. |
| **API** (`api.vonica.cz`) | Krok 1 (kostra) hotový ve větvi `feature/api-skeleton`: `api/` (PHP 8.5, Composer, vlastní router, `GET /v1/health`, CORS/origin/JSON politika, sessions v PostgreSQL, CSRF), Phinx s migrací identity a přístupu, PHPUnit (Unit + Integration proti PostgreSQL v Dockeru), Docker služba `api` na `localhost:8082`. Zatím nenasazeno, produkční DB je prázdná. |
| **Demo** (`demo.vonica.cz`) | Prototyp nasazený jako `design/identity-03@ce20f01`. Přesun z `moje` dokončen 22. 10. 2026. Nasazení: `/deploy` (`--target demo`). Popis kódu: `../archive/implementace-2026-10-21/`. |
| **moje.vonica.cz** | Vývoj odložen. Po přesunu dema prázdná, vyhrazená budoucí členské aplikaci. |
| Monorepo | Kořenový `package.json` má npm workspaces `apps/*`, `packages/*` (zatím prázdné, `packages/*` vzniknou až s prvním použitím) a `engines` Node ≥ 24; `.nvmrc` 24, image dema na `node:24`. Dál podle `api-v1-a-schema.md` kap. 6, krok 2 (přihlášení). |

## Známé rozdíly mezi demem a platnými rozhodnutími

Demo vzniklo před rozhodnutími z 22. 10. 2026 a dál se nerozvíjí ani nekonzervuje (D-33). Krojařka z něj nepřebírá kód (D-31). Rozdíly jsou uvedené jen pro orientaci:

- jediná entita `Member` (osoba + účet + členství), napevno `ensembleId = 1`, žádné složky (proti D-06, D-07);
- krojový model v0.4: šablony kompletů místo fyzických kompletů, bez množstevních doplňků, opakované použití čísel ve výchozím stavu vypnuté (proti D-19, D-20);
- Správa krojů s položkami Součástky / Krojové karty / Výpůjčky / Inventury / Nastavení; Krojařka má navíc Přehled, Hledat a Můj účet (D-22);
- oprávnění se kontrolují jen ve frontendu a ne všude (`../archive/implementace-2026-10-21/08-souhrn-zjisteni.md`).

## Deník

- **2026-10-23** – krok 1 implementace (kostra monorepa a API, `api-v1-a-schema.md` kap. 6).
- **2026-10-22** – uspořádání dokumentace (registr rozhodnutí, otevřené otázky, archiv); ověření hostingu a PostgreSQL 18; přesun dema z `moje` na `demo.vonica.cz` dokončen; deploy skript má povinný `--target`; lokální Docker převeden na PostgreSQL 18; rozhodnuto D-31 až D-33.
