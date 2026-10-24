# Stav vývoje

**Aktuální souhrn k 2026-10-24**, větev `feature/api-skeleton`. Pořadí implementace určuje [specifikace API v1](api-v1-a-schema.md), při rozporu platí [registr rozhodnutí](../decisions.md).

## Aktuální stav

**Poslední dokončený krok: 10 – Náklady na kroje, etapa 3 (HTTP/mock adaptéry, obrazovky a závěrečné ověření).** Kroky 1–10 jsou dokončené lokálně a automaticky otestované. Q-24 je vyřešená (D-68); v tomto rozsahu nezůstala blokující produktová otázka. Ruční provozní ověření dosud neproběhlo a zůstává před případným nasazením.

| Oblast | Současný stav |
|---|---|
| Kroky 1–3 | Monorepo, API, přihlášení, sessions, CSRF, katalog, evidenční řady, organizační správa, pověření a audit. Poslední zde zaznamenané nasazení API a Krojařky: `908001d` z 2026-10-24 (krok 3). |
| Krok 4 – Součástky | Kusy, nečíslované zásoby, fyzické komplety, určené složení, historie a pracovní úkoly. Jedna hlavní položka Součástky, přehled podle řad. Dokončeno lokálně, nenasazeno. |
| Krok 5 – Lidé a krojové karty | Společná identita a kontakty všem krojařkám, fondové profily a oddělené poznámky (D-60). Dokončeno lokálně, nenasazeno. |
| Krok 6 – Výpůjčky | Výdej, částečné vrácení, výměny, ztráty, pohyby a fondové karty. Dostupnost a držitelé ze skutečných výpůjček a výslovně převzatého aktuálního držení z papíru (D-67); ochrana proti dvojímu odečtu doplňků celého kompletu (D-61), ztráta s vyřazením kusu či snížením zásoby (D-62). Dokončeno lokálně, nenasazeno. |
| Krok 7 – Inventury | Zmrazený rozsah, tři režimy kontrol, termíny a návštěvy, rozšíření rozsahu, historie, nesrovnalosti, běžné operace s kontextem, neměnné uzavření a skupiny (D-48/D-51, D-63/D-64). Dokončeno lokálně, nenasazeno. |
| Krok 8 – Přílohy | Dokončeno lokálně: databáze, API, kontrakty, HTTP/mock adaptéry, galerie a průvodce převodem s původem držení `paper_migration`. GPS údaje se odstraňují se zachováním obrazu/orientace (D-65); osobní skeny čtou i fondoví čtenáři (D-66). Lokální doplnění `gd` a `zip` uživatel schválil. |
| Krok 9 – Přehledy a hledání | Kompletní fondové soupisy, JSON/CSV, tisk A4, hledání společných jmen a krojových objektů jen v povolených fondech. Dokončeno lokálně, nenasazeno. |
| Krok 10 – Náklady | Dokončeno lokálně: schéma, API, přesné podepsané částky a vlastní měna, souhrny po měnách, fondová pověření a audit, CSV, HTTP/mock adaptéry a obrazovka přes Přehledy. Pokladník čte všechny náklady a navázané součástky (D-49/D-68), nenasazeno. |
| Krojařka a API | Standalone Angular, feature služby, zaměnitelné HTTP/mock adaptéry; PHP API, PostgreSQL, sdílené TS kontrakty a čistá doménová logika. Bez nových npm/Composer knihoven a změny architektury; lokální PHP `gd`/`zip` a systémové knihovny výslovně schválil uživatel. |
| Demo a moje | Demo zůstává historickým prototypem; kód se z něj nepřebírá. Vývoj členské aplikace `moje.vonica.cz` je odložen. |

V této relaci se nepřistupovalo k produkční databázi, neprováděly se produkční migrace, nasazení, push ani merge.

## Závěrečné ověření současného kódu

| Kontrola | Výsledek |
|---|---|
| `npm run api:test` | **305 testů / 2569 assertions** – prošlo, pouze lokální `_test` DB; včetně migrací, fondové integrity, zamítnutých operací, auditu, rollbacku, výpůjček, převodu z papíru a skutečných testů souběhu inventur |
| `npm run krojarka:test` (Node 24) | **225 testů / 50 souborů** – prošlo |
| TypeScript aplikace / testů / kontraktů | **Všechny tři kontroly prošly** |
| `npm run krojarka:build` | **Úvodní balíček 488,20 kB** – prošlo bez zvýšení rozpočtu |
| `git diff --check` | **Prošlo** |

Stávající testy zůstaly zachované a neoslabené. Záměrně vyvolaná selhání auditu, porušení kontrolního součtu a chyby úklidu jsou součástí zamítnutých scénářů, nikoli nevyřešená selhání sady. Ruční ověření v prohlížeči a na mobilu dosud neproběhlo.

## Dokončený krok 10

- Přesná částka `numeric(18,4)` / JSON řetězec, vlastní třípísmenný kód měny, datum, dodavatel, doklad, popis, účel/dotace a nepovinné vazby na kusy, zásoby či komplety. Kladné, nulové i záporné záznamy; dobropisy a vratky podle D-68. Žádná plovoucí desetinná aritmetika; mock součty používají celočíselné výpočty. Různé měny se nesčítají a nepřepočítávají. Měnový kód se ověřuje formátem, bez externího měnového číselníku.
- API `GET /v1/costs`, fondová varianta, oprávněné fondy `/v1/costs/funds`, fondový POST a detail/PATCH s verzí. Úplné filtrované souhrny po měnách nezávisí na stránce ani počtu vazeb. Vstupní částka musí být řetězec s nejvýše 14 celými a 4 desetinnými místy; nadbytečná přesnost se odmítá, nezaokrouhluje potichu.
- Vazby jsou fondové, jednotlivý kus/komplet má počet 1 a zásoba kladný celý počet. Historický počet může přesahovat současnou zásobu. Náklad nepředstírá nákup/pohyb, nemění datum pořízení, držení, množství, složení ani fyzické ověření. Audit a všechny vazby se zapisují v jedné transakci; verze z počátku editace se zachová při obnovení seznamu. Konflikt nechá rozepsaný formulář k ručnímu porovnání.
- `costs.view` čte náklady všech fondů a aktuální údaje **přímo navázaných** součástek v detailu nákladu. Nedává přístup do libovolných krojových detailů, výpůjček, držitelů ani osobních karet. Správce organizace bez krojového/finančního pověření náklady neotevře. Krojařská pověření čtou jen své fondy, zápisy vyžadují správu aktivního fondu. Archivace fondu finanční historii nezmaže; čtení zůstává podle pověření.
- CSV obsahuje celý filtrovaný výběr, názvy fondů, vazby a souhrny po měnách. Přesné záporné částky zůstávají číselné, uživatelské textové vzorce jsou chráněné. Výpis/detail/export čtou konzistentní snímek. SQLSTATE `55P03` se bezpečně vrací jako opakovatelná 409; testuje se simulovaný konflikt bez částečného nákladu. Skutečné souběhy kroku 7 zůstávají v kompletní sadě.
- Obrazovka `/prehledy/naklady` je pod stávající položkou Přehledy (D-22), s filtrem fondu/data/měny/textu, souhrny, stránkováním, CSV, novým nákladem/dobropisem a úpravou vazeb. Pokladník se přes Přehledy dostane přímo k nákladům i bez krojového kontextu. Čtenář má detail bez editace a bez načítání nesouvisejících součástek. Formulář přijímá i českou desetinnou čárku. Změna filtru, odhlášení či opuštění obrazovky zneplatní opožděné odpovědi a stahování; dočasné URL se uvolňují.
- Nová migrace `20261024234000_create_costume_costs` nemění staré tabulky a zachovává kompatibilitu existujících dat. `down` odmítne smazat vzniklou finanční evidenci (`55000`). Nepřibyly knihovny, kurzový systém, účetnictví ani platby.

### Commity a změněné oblasti kroku 10

| Commit | Oblast |
|---|---|
| `6ca3aab` | schéma, kontrakty, migrační testy a rozhodnutí D-68 |
| `d7d79f2` | API nákladů, pověření, audit, CSV a integrační testy |
| `91c631f` | HTTP/mock adaptéry, přesné desetinné výpočty a testy |
| `3cebda9` | finanční obrazovka, feature služba, směrování, oprávnění a Vitest |
| `CSV_HASH` | čitelné názvy fondů v CSV a jejich ověření |

Konkrétní soubory: `api/db/migrations/20261024234000_create_costume_costs.php`, `Domain/Costumes/CostRepository.php`, `Http/Controller/CostController.php`, registrace v `App.php`, rozšíření `Authorization/Mandates.php`, sdílený CSV formát a `api/tests/Integration/{CostSchemaTest,CostsTest}.php`; `packages/api-contracts/src/costs.ts` a kódy chyb; `packages/domain/src/{cost-amount,report-csv}.ts`; Krojařka `data/costs`, `features/naklady`, odkazy z Přehledů, role/guardy a trasy. Změny schématu/endpoints jsou v [API specifikaci](api-v1-a-schema.md).

## Ruční ověření před případným nasazením

V HTTP i mock režimu, s fondovou krojařkou, čtenářem, pokladníkem a samotným správcem organizace, na počítači i mobilu:

1. Kusy, zásoby a komplety: čísla s úvodní nulou, opakované číslo, určené složení versus evidovaný počet a fyzická kontrola, nedostatek zásob a konflikt verze.
2. Osoby: společná identita/kontakty a oddělené fondové poznámky; výdej, částečné vrácení, výměna, ztráta, samostatná součást kompletu a početní doplňky bez dvojího odečtu.
3. Inventury: zmrazení průniku filtrů, dávka `1, 03, 12-15`, nečekaný nález, opakovaná kladná kontrola s pozdější nepřítomností, zrušení kontroly a zachování dřívějšího poškození. Termíny/návštěvy neověřují kusy; zásoby se nevydávají za identifikované kusy v procentu pokrytí.
4. Inventura s běžnými operacemi a kontextem, zamítnutí cizího/uzavřeného kontextu, uzavření s nesrovnalostmi a neměnnost výsledku po změně majetku. Mock nemá příslušnosti osob ke složkám; tento filtr v jeho syntetických datech vrací prázdný rozsah.
5. JPEG s GPS a orientací, čitelnost reálné A4 karty, PDF ke stažení, mobilní zoom/otočení/posun, archivace, ZIP skutečně uložený mimo aplikaci a teprve potom odstranění. Podporované formáty JPEG/PNG/PDF; HEIC není podporovaný. Mock soubory jsou jen v paměti relace; bez obrazového dekodéru není miniatura.
6. Převod papíru s neznámým i doloženým datem, opakování, cizí držení, nejednoznačné číslo, dokončení s nejasnostmi a skutečné následné vrácení. Porovnání originálu ani převod nesmějí potvrdit fyzickou přítomnost či úplnost.
7. Dlouhý soupis A4, úplný CSV export přes více stránek, diakritika, víceřádkové texty a import evidenčních čísel jako textu. Hledání v různých přístupných fondech a zamítnuté přímé URL.
8. Náklad, záporný dobropis, různé měny s oddělenými souhrny, velká částka se 4 desetinnými místy a její přesný import v používaném tabulkovém programu. Fondové vazby, historický počet zásoby, změna verze při editaci, archivovaný fond a odvolané pověření. Pokladník vidí navázané součástky, ne nesouvisející krojová data. Na mobilu přepnutí filtru či opuštění obrazovky během načítání/exportu nesmí vyvolat staré stahování.

## Připravenost a další postup

Kroky 1–10 jsou dokončené v kódu a automaticky otestované. **Produkční připravenost není potvrzená:** nejdříve výše uvedené ruční a pilotní ověření; produkční migrace a nasazení vyžadují výslovný souhlas uživatele. Do produkční DB se v této relaci nepřistupovalo, neproběhly produkční migrace, deploy, `git push` ani merge. Nový rozsah nad krok 10 se neimplementoval.

## Historické průběžné zápisy

Dřívější mezistavy, blokace, počty testů a commity jsou oddělené v [deníku kroků 1–7](../archive/03-prubeh-api-v1-2026-10-24.md) a [snímku průběhu kroků 8–10](../archive/03-prubeh-api-v1-kroky-8-10-2026-10-24.md). Jsou nezávazné; stav v tomto aktuálním souhrnu je nahrazuje. Deník dema do 19. 10. 2026 zůstává [v samostatném archivu](../archive/03-postup-vyvoje.md).
