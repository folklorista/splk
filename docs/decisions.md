# Registr rozhodnutí

Platná rozhodnutí projektu (úroveň **A**). Každé má datum, zdroj a dokumenty, kterých se týká. Pokud podrobný dokument s registrem nesouhlasí, **platí registr** a dokument je třeba opravit.

Nerozhodnuté věci jsou v [`open-questions.md`](open-questions.md). Historické a překonané návrhy jsou v [`archive/`](archive/).

Pravidla registru:

- Rozhodnutí se nepřepisuje. Když se změní, staré se označí *nahrazeno D-xx* a přidá se nové.
- Zdroj „uživatel 2026-10-22“ znamená výslovné rozhodnutí vlastníka produktu při konsolidaci dokumentace 22. 10. 2026. Důvody, které nebyly uvedeny, se nedoplňují.

---

## Produkt a rozsah

### D-01 Konkrétní aplikace, ne univerzální framework

Pevné doménové moduly, žádné dynamické REST API nad libovolnou tabulkou ani univerzální renderer formulářů. Konfigurovat jen to, co se mezi organizacemi opravdu liší.
**Zdroj:** `archive/00-prehled.md` (2026-06-23), `current/04-styl-prace.md`, poučení z předchozí krojové databáze.

### D-02 Rozdělení na aplikace; Krojařka je jediná priorita

| Adresa | Účel | Stav |
|---|---|---|
| `krojarka.vonica.cz` | Samostatná aplikace **Krojařka** pro správu krojového fondu | **jediná současná priorita** |
| `api.vonica.cz` | Společný PHP REST backend; postupně slouží všem frontendům | vzniká spolu s Krojařkou |
| `moje.vonica.cz` | Budoucí členský informační systém | **vývoj odložen** |
| `demo.vonica.cz` | Dosavadní prototyp (Angular, data v prohlížeči) | demo/prototyp, ne cílová architektura ani grafika |

Pojem **„V1.0“ se nepoužívá**, protože byl nejednoznačný (`07` jím myslí první ostrý provoz, `08` vydané demo). Starší roadmapy a pořadí vývoje (`archive/03`, `current/moje/07` kap. XII) jsou historické.
**Zdroj:** uživatel 2026-10-22; `current/hosting-postgresql-api-auth.md` (domény).

### D-03 Monorepo s více aplikacemi

Krojařka, API a později `moje` budou v jednom repozitáři jako samostatně nasaditelné aplikace. Konkrétní rozvržení a hranice sdíleného kódu viz Q-10.
**Zdroj:** uživatel 2026-10-22.

### D-04 Nejdřív stávající model; digitalizace je nepovinná

Nový modul, entita nebo položka menu potřebuje konkrétní důvod (strukturované hledání, výpočet, kontrola). Aplikace nenahrazuje osobní domluvy.
**Zdroj:** `current/04-styl-prace.md`, `current/moje/07` kap. 7 a 40 (2026-10-18).

### D-05 Krojová evidence je autoritativní, docházka orientační

Krojový sklad musí zachytit skutečné předání a odpovědnost. Docházka slouží k organizaci, ne k sankcím.
**Zdroj:** `current/moje/05`, `current/moje/07` kap. 7 (2026-10-18).

## Organizace, identita a oprávnění

### D-06 Model se složkami; jedna instalace = jedna organizace

- **Úroveň 1 = organizace = jedna instalace** s vlastní databází, přihlášením a konfigurací.
- **Úroveň 2 = složky** (`Unit`) uvnitř instalace.

| Instalace (úroveň 1) | Složky (úroveň 2) |
|---|---|
| Slovácký soubor **Vonica** | dospělá složka (Vonica), Malá Vonica, Děvčice z Vonice, muzika |
| **Vonička** Zlín, z. s. | Vonička I, Vonička II, Vonička III |

Mezi instalacemi se nesdílí účty ani osoby.

Model z 18. 10. 2026, kde jsou dospělá a Malá Vonica samostatné soubory se společnou globální identitou a přepínačem kontextu, se **nepoužívá**. `ensemble_id` může v modelu zůstat jen jako rezerva pro případný budoucí multi-tenant provoz.
**Zdroj:** uživatel 2026-10-22; `context/` (vonica.md, vonicka.md); `current/identity-model-v2.md`.
**Nahrazuje:** cílový model více souborů v `archive/00`, `archive/02`, `current/01`, `current/moje/07` kap. 15/52/55 a `current/moje/10` kap. 4.1a.

### D-07 Identita: osoba ≠ účet ≠ příslušnost ≠ pověření

Implementovat podle `current/identity-model-v2.md`:

- `Person`, `UserAccount` (0..1 na osobu);
- `UnitAffiliation` (zájemce / aktivní, s historií);
- `GroupMembership` s historií;
- `Representation` (zastupování dítěte);
- `PositionAssignment` (funkce s historií);
- **formální členství ve spolku** (Vonička);
- **„přijatý člen“** (Vonica).

Jde o konceptuální model, ne o schválené databázové schéma. Otevřené detaily jsou Q-08 a Q-09; „přijatý člen“ viz D-30.
**Zdroj:** uživatel 2026-10-22.

### D-08 „Člen souboru“ = člen dospělé složky

V terminologii Vonice „člen souboru“ znamená člena dospělé taneční složky. Obecný „člen celé Vonice“ v praxi neexistuje. Viz [`context/glossary.md`](context/glossary.md).
**Zdroj:** uživatel 2026-10-22; vonica.md.

### D-09 Oprávnění = pověření; bez superadministrátora

- Organizační funkce nejsou systémové role. Pravomoc vzniká jen **pověřením** s vymezeným rozsahem.
- Správa (osob, skupin, konfigurace) nedává právo číst obsah.
- **Role superadministrátora neexistuje.** Nouzový zásah je možný jen přímo v databázi, mimo aplikaci.

**Zdroj:** `current/moje/08` kap. 1.1 a 3 (2026-10-16, implementováno v demu); uživatel 2026-10-22 (bez superadmina).
**Nahrazuje:** role host / člen / vedoucí / administrátor / superadministrátor v `current/moje/07` kap. 9 a 10.

### D-10 Rozsahy pověření

**soubor (organizace) / složka / skupina / akce / modul.** Ne každý druh pověření musí podporovat každý rozsah.
**Zdroj:** uživatel 2026-10-22. **Rozšiřuje:** `current/moje/08` kap. 3 (soubor / skupina / akce / modul).

## Technologie a provoz

### D-11 Backend: PHP 8.5 REST API + PostgreSQL 18

Hosting Websupport, `api.vonica.cz`. Databáze **PostgreSQL 18** (UTF-8, `cs_CZ` collation), přístup přes PDO s nativními prepared statements.
**Zdroj:** uživatel 2026-10-22; ověřeno v `current/hosting-postgresql-api-auth.md`.
**Nahrazuje:** „PHP + MySQL“ v `current/01`, README a `archive/03`. Lokální `docker-compose.yml` dosud používá MariaDB (Q-11).

### D-12 Autentizace: serverové sessions v PostgreSQL

- Host-only cookie `__Host-…` na `api.vonica.cz` (`Secure`, `HttpOnly`, `SameSite=Lax`).
- V databázi se ukládá jen hash tokenu.
- CSRF token v hlavičce `X-CSRF-Token`, allowlist originů, pouze JSON.
- Bez JWT, bez tokenů v `localStorage`, bez sdílené cookie `.vonica.cz`.
- Hesla Argon2id.

**Zdroj:** `current/hosting-postgresql-api-auth.md` kap. 6–8 (ověřeno v Chrome 2026-10-22); uživatel 2026-10-22 („řešeno“).

### D-13 Veřejný přístup k databázi omezit na IP

**Zdroj:** `current/hosting-postgresql-api-auth.md` kap. 10 (rozhodnuto 2026-10-22, zatím neprovedeno).

### D-14 Polling, ne WebSocket

**Zdroj:** `current/01`, `current/moje/08` kap. 11.2.

### D-15 Architektura frontendu

`komponenta → feature service → API service / mock service`. Mock a HTTP implementace musí být zaměnitelné. Angular standalone, bez NgModules.
**Zdroj:** `CLAUDE.md`, `current/01`.

### D-16 Zálohy: provozní kompromis

Denní záloha u poskytovatele (14 dní) a vlastní týdenní šifrovaný export mimo hosting s testem obnovy.
**Zdroj:** `current/01` (2026-10-18). *Formulace pochází z doby MySQL; zálohování PostgreSQL u poskytovatele viz Q-11.*

## Kroje a aplikace Krojařka

### D-17 Terminologie

| Pojem | Význam |
|---|---|
| **Krojařka** (velké K) | název aplikace na `krojarka.vonica.cz` |
| **krojařka** | osoba s pověřením ke krojům; pomocnice jsou také krojařky |
| **sklad** | místnost s nezapůjčenými kroji |
| **Správa krojů** | agenda v budoucí `moje` |

Nepoužívat „krojárna“ ani „krojárka“. Adresu `krojarka.vonica.cz` bez diakritiky lze ponechat.
**Zdroj:** `CLAUDE.md`, `current/moje/10` kap. 11.1 (2026-10-18); uživatel 2026-10-22 (název aplikace a doména).

### D-18 Základ krojové evidence

- Základem je fyzický kus se stabilní identitou.
- Evidenční řady jsou samostatné; identita kusu ≠ evidenční číslo.
- Evidenci mění jen krojařky.
- Držiteli mohou být i externisté a bývalí členové.
- Odpovědnost se řídí oficiální evidencí.
- „Nezkontrolováno“ ≠ „nepředloženo“ ≠ „chybí“.
- Inventuru s nesrovnalostmi lze uzavřít jen výslovně a s důvodem.

**Zdroj:** `current/06` v0.4 i `archive/06-…-v0.3` shodně.

### D-19 Fyzické komplety

- Komplet je **fyzická jednotka**: taška nebo ramínka v jednom obalu s lístkem, na kterém je výčet součástek.
- **Nemá pevnou strukturu.** Komplety téže řady se mohou lišit složením.
- Může obsahovat i **nečíslované zaměnitelné doplňky evidované počtem** (např. 2 mašle).
- Sklad eviduje výpůjčky kompletu. Lze **vydat celý komplet**. Inventura umí **kontrolu kompletu**.

**Zdroj:** uživatel 2026-10-22.
**Nahrazuje:** „komplet = šablona druhů“ a odklad množstevních položek v `06` v0.4. Navazuje na model v0.3 (`archive/06-…-v0.3.md`). Detaily viz Q-04.

### D-20 Opakované použití evidenčních čísel

Ve výchozím nastavení **povoleno** u všech řad. U konkrétní řady ho lze konfigurací **zakázat**. Historie starého a nového kusu se nikdy nespojí.
**Zdroj:** uživatel 2026-10-22. **Nahrazuje:** výchozí „nepovolovat“ v `06` v0.4 kap. 13.2.

### D-21 Krojový fond a pověření podle složky

- Krojařka pracuje jen v rozsahu svého pověření (složka).
- Krojařky různých složek si **navzájem nevidí do evidence**, jen do seznamů lidí.
- Pomocnice jsou v Krojařce **rovnocenné** hlavní krojařce. Rozdíly existují jen mimo aplikaci, např. hlasování ve výboru.
- Muzika vlastní krojařku nemá a půjčuje si od dospělé složky.

| Instalace | Krojařky (stav 2026-10) |
|---|---|
| Vonica | Lucka Š (dospělá složka; pomocnice Anička Z, Terka P), Danča (Malá Vonica), Broňa (Děvčice) |
| Vonička | Gabča (Vonička I), Anuška (Vonička II a III) – fondy jsou rozdělené po složkách (D-29) |

**Zdroj:** uživatel 2026-10-22; vonica.md (pomocnice).

### D-22 Navigace Krojařky (boční menu)

**Přehled · Součástky · Krojové karty · Lidé · Výpůjčky · Inventury · Dokumenty · Přehledy · Hledat · Nastavení · Můj účet**

- **Součástky:** katalog podle evidenčních řad, včetně kompletů.
- **Krojové karty:** lidé s výpůjčkami.
- **Lidé:** všechny osoby evidence, i bez výpůjček (papírová karta, převod na digitální evidenci).
- **Výpůjčky:** skladové pohyby od nejnovějších.
- **Dokumenty:** archiv skenů a podkladů (osobní karty, karty a lístky kompletů, kniha zápůjček).
- **Přehledy:** tisk a export.

Zda komplety vyčlenit do samostatné položky, je Q-04. Podoba mobilní lišty je Q-17.
**Rozšíření 2026-10-23:** položky Lidé, Dokumenty a Přehledy doplněny podle Q-17 (uživatel).
**Zdroj:** uživatel 2026-10-22. **Nahrazuje:** menu v `current/krojarka/frontend-demo-specifikace.md` kap. 3.1 (Přehled / Lidé / Sklad / Inventury…).

### D-23 Základní finanční evidence je součástí Krojařky

Minimálně základní evidence financí patří do základu aplikace Krojařka. Rozsah zatím není určen (Q-03).
**Zdroj:** uživatel 2026-10-22; vonica.md (TODO pokladna, výdaje za kroje).

### D-29 Krojové fondy Voničky jsou rozdělené po složkách

Stejně jako u Vonice má každá složka Voničky (I, II, III) vlastní krojový fond. Krojařka spravuje fondy složek, ke kterým má pověření (Anuška II i III).
**Zdroj:** uživatel 2026-10-23 (Q-01). Údaj „jeden společný krojový fond“ ve vonicka.md je zastaralý a vonicka.md je k aktualizaci.

## Identita (doplnění)

### D-30 „Přijatý člen“ nemá v aplikaci žádná práva navíc

Je to jen evidovaná historická skutečnost (rok, kmotr nebo kmotra). Není podmínkou funkce ani pověření. Funkce ve výboru vzniká volbou na schůzi, ne v aplikaci.
**Zdroj:** uživatel 2026-10-23 (Q-07); vonica.md. **Nahrazuje:** „potvrzené pravidlo“ v `current/identity-model-v2.md` kap. 2.1.

## Odložené, ale schválené cíle pro `moje.vonica.cz`

Platí jako cílové chování pro dobu, kdy se vývoj `moje` obnoví. Teď se nevyvíjejí. Pokud odporují D-06 (model se složkami), platí D-06.

| # | Rozhodnutí | Zdroj |
|---|---|---|
| D-24 | Offline jen pro čtení (IndexedDB, ETag, bez offline zápisů) | `current/01` |
| D-25 | DM: serverové šifrování XChaCha20-Poly1305, oprávnění podle účastníka konverzace | `current/moje/09` kap. 13 (ADR) |
| D-26 | Skupina: aktivní → archivovaná → smazaná; historie chatu otevřená / od vstupu | `current/moje/08` kap. 10.3 a 10.5 |
| D-27 | Skupinový chat ve všech skupinách s automatickým seskupováním komentářů | `current/moje/08` kap. 1.1 |
| D-28 | Navigace: osobní spodní lišta (Přehled + 4 místa + Více) | `current/moje/10` kap. 6 |
