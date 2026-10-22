# Stav vývoje

Co je hotové a co se právě dělá. Pořadí vývoje určuje [`../decisions.md`](../decisions.md) D-02. Historický deník do 19. 10. 2026 je v [`../archive/03-postup-vyvoje.md`](../archive/03-postup-vyvoje.md).

## Stav k 2026-10-22

| Část | Stav |
|---|---|
| **Krojařka** (`krojarka.vonica.cz`) | Nezahájena. Zadání: `krojarka/frontend-demo-specifikace.md`, doménová pravidla `06` v0.5. Subdoména a SFTP ověřeny, web obsahuje jen placeholder poskytovatele. |
| **API** (`api.vonica.cz`) | Nezahájeno. Hosting, PostgreSQL 18, CORS, cookie sessions a CSRF ověřeny prototypem (`hosting-postgresql-api-auth.md`). DB je prázdná. |
| **Demo** (`demo.vonica.cz`) | Prototyp nasazený jako `design/identity-03@ce20f01`. Přesun z `moje` dokončen 22. 10. 2026. Nasazení: `/deploy` (`--target demo`). Popis kódu: `../archive/implementace-2026-10-21/`. |
| **moje.vonica.cz** | Vývoj odložen. Po přesunu dema prázdná, vyhrazená budoucí členské aplikaci. |
| Monorepo | Rozhodnuto (D-03), rozvržení otevřené (Q-10). Kód zatím obsahuje jen jednu Angular aplikaci (`frontend/`). |

## Známé rozdíly mezi demem a platnými rozhodnutími

Demo vzniklo před rozhodnutími z 22. 10. 2026. Liší se:

- jediná entita `Member` (osoba + účet + členství), napevno `ensembleId = 1`, žádné složky (proti D-06, D-07);
- krojový model v0.4: šablony kompletů místo fyzických kompletů, bez množstevních doplňků, opakované použití čísel ve výchozím stavu vypnuté (proti D-19, D-20);
- Správa krojů s položkami Součástky / Krojové karty / Výpůjčky / Inventury / Nastavení; Krojařka má navíc Přehled, Hledat a Můj účet (D-22);
- oprávnění se kontrolují jen ve frontendu a ne všude (`../archive/implementace-2026-10-21/08-souhrn-zjisteni.md`).

## Deník

- **2026-10-22** – uspořádání dokumentace (registr rozhodnutí, otevřené otázky, archiv); ověření hostingu a PostgreSQL 18; přesun dema z `moje` na `demo.vonica.cz` dokončen; deploy skript má povinný `--target`.
