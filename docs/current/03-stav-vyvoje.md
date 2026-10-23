# Stav vývoje

Co je hotové a co se právě dělá. Pořadí vývoje určuje [`../decisions.md`](../decisions.md) D-02. Historický deník do 19. 10. 2026 je v [`../archive/03-postup-vyvoje.md`](../archive/03-postup-vyvoje.md).

## Stav k 2026-10-23

| Část | Stav |
|---|---|
| **Krojařka** (`krojarka.vonica.cz`) | Krok 2: kostra v `apps/krojarka` (Angular 22.2, zoneless, Vitest): boční menu podle D-22 (sekce zatím jako zástupné stránky), přihlášení, zapomenuté heslo, nastavení hesla z odkazu, Můj účet (pověření, změna hesla, přihlášená zařízení, odhlášení). Datová vrstva `data/` s HTTP a mock adaptérem (`npm run krojarka:start:mock`), interceptory podle hosting doc kap. 8. Trasy česky (`/prihlaseni`, `/lide`, `/soucastky`…). Nasazeno 2026-10-24 jako `feature/api-skeleton@62b8310`. Krok 3 (nasazeno 2026-10-24 jako `908001d`): výběr krojového fondu v menu, Nastavení → Katalog (regiony a oblasti, druhy součástek), Evidenční řady (součástek i kompletů), Uživatelé a pověření (D-59). |
| **API** (`api.vonica.cz`) | Kroky 1–2 ve větvi `feature/api-skeleton`: kostra (router, `GET /v1/health`, CORS/origin/JSON, sessions v PostgreSQL, CSRF), migrace identity a přístupu, `auth/*` podle kap. 4.1 (přihlášení s omezením pokusů, odhlášení, `me`, změna hesla, obnova hesla e-mailem přes PHPMailer, přihlášená zařízení), seed prvního účtu `organization.admin` (pozvaný, heslo si nastaví odkazem). Testy PHPUnit (Unit + Integration). Nasazeno 2026-10-24 jako `feature/api-skeleton@62b8310`: `config/config.php` z `.env`, migrace `CreateIdentityAndAccess` (záloha před migrací v `dev/local/backups/`), pozvaný účet `organization.admin`. Krok 3 (nasazeno 2026-10-24 jako `908001d`, se seedy `VonicaUnits` a `VonicaCatalog`): migrace `CreateCatalogAndAudit` (regiony, druhy, řady, `audit_log`, `mandates.revoked_at`), katalog `/v1/funds/{u}/regions\|part-types\|series` s kontrolou pověření (404 mimo rozsah, 403 jen pro čtení), správa organizace (`/v1/persons`, `/v1/accounts`, `/v1/mandates`, `/v1/units`), audit všech zápisů, seedy `VonicaUnits` a `VonicaCatalog`. |
| **Demo** (`demo.vonica.cz`) | Prototyp nasazený jako `design/identity-03@ce20f01`. Přesun z `moje` dokončen 22. 10. 2026. Nasazení: `/deploy` (`--target demo`). Popis kódu: `../archive/implementace-2026-10-21/`. |
| **moje.vonica.cz** | Vývoj odložen. Po přesunu dema prázdná, vyhrazená budoucí členské aplikaci. |
| Monorepo | npm workspaces `apps/*`, `packages/*`, Node ≥ 24 (`.nvmrc`). `packages/api-contracts` (DTO a chybové kódy auth) – první sdílený balíček. Deploy: `npm run deploy -- --target api\|krojarka` (`scripts/deploy-app.mjs`). Dál krok 4 (součástky). |

## Známé rozdíly mezi demem a platnými rozhodnutími

Demo vzniklo před rozhodnutími z 22. 10. 2026 a dál se nerozvíjí ani nekonzervuje (D-33). Krojařka z něj nepřebírá kód (D-31). Rozdíly jsou uvedené jen pro orientaci:

- jediná entita `Member` (osoba + účet + členství), napevno `ensembleId = 1`, žádné složky (proti D-06, D-07);
- krojový model v0.4: šablony kompletů místo fyzických kompletů, bez množstevních doplňků, opakované použití čísel ve výchozím stavu vypnuté (proti D-19, D-20);
- Správa krojů s položkami Součástky / Krojové karty / Výpůjčky / Inventury / Nastavení; Krojařka má navíc Přehled, Hledat a Můj účet (D-22);
- oprávnění se kontrolují jen ve frontendu a ne všude (`../archive/implementace-2026-10-21/08-souhrn-zjisteni.md`).

## Deník

- **2026-10-23** – krok 1 implementace (kostra monorepa a API, `api-v1-a-schema.md` kap. 6). Krok 2: přihlášení v API, kostra Krojařky, deploy cíle `api` a `krojarka`; Vitest pro Krojařku (D-58).
- **2026-10-24** – krok 3: katalog a řady, Uživatelé a pověření, audit log (D-59); nasazeno `908001d`.
- **2026-10-24** – první nasazení `api` a `krojarka` (`62b8310`); ověřeno: health, CORS z Krojařky, 403 pro cizí origin a zápis bez Origin, 404 pro `config/` a `src/`, HSTS.
- **2026-10-22** – uspořádání dokumentace (registr rozhodnutí, otevřené otázky, archiv); ověření hostingu a PostgreSQL 18; přesun dema z `moje` na `demo.vonica.cz` dokončen; deploy skript má povinný `--target`; lokální Docker převeden na PostgreSQL 18; rozhodnuto D-31 až D-33.
