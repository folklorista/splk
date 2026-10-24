# Stav vývoje

**Aktuální souhrn k 2026-10-24**, větev `feature/api-skeleton`. Pořadí implementace určuje [specifikace API v1](api-v1-a-schema.md), při rozporu platí [registr rozhodnutí](../decisions.md).

## Aktuální stav

**Poslední dokončený krok: 7 – Inventury, etapa 3d včetně doplněných testů souběhu.** Kroky 1–7 jsou dokončené lokálně. Krok 8 je rozpracovaný od databáze a kontraktů; kroky 9–10 nejsou implementované. Q-14 je rozhodnutá (D-65/D-66).

| Oblast | Současný stav |
|---|---|
| Kroky 1–3 | Monorepo, API, přihlášení, sessions, CSRF, katalog, evidenční řady, organizační správa, pověření a audit. Poslední zde zaznamenané nasazení API a Krojařky: `908001d` z 2026-10-24 (krok 3). |
| Krok 4 – Součástky | Kusy, nečíslované zásoby, fyzické komplety, určené složení, historie a pracovní úkoly. Jedna hlavní položka Součástky, přehled podle řad. Dokončeno lokálně, nenasazeno. |
| Krok 5 – Lidé a krojové karty | Společná identita a kontakty všem krojařkám, fondové profily a oddělené poznámky (D-60). Dokončeno lokálně, nenasazeno. |
| Krok 6 – Výpůjčky | Výdej, částečné vrácení, výměny, ztráty, pohyby a fondové karty. Dostupnost a držitelé ze skutečných výpůjček; ochrana proti dvojímu odečtu doplňků celého kompletu (D-61), ztráta s vyřazením kusu či snížením zásoby (D-62). Dokončeno lokálně, nenasazeno. |
| Krok 7 – Inventury | Zmrazený rozsah, tři režimy kontrol, termíny a návštěvy, rozšíření rozsahu, historie, nesrovnalosti, běžné operace s kontextem, neměnné uzavření a skupiny (D-48/D-51, D-63/D-64). Dokončeno lokálně, nenasazeno. |
| Krok 8 – Přílohy | Rozpracováno: databáze, kontrakty a zpracování fotografií. GPS údaje se odstraňují se zachováním obrazu/orientace (D-65); osobní skeny čtou i fondoví čtenáři (D-66). Lokální doplnění `gd` a `zip` uživatel schválil. |
| Krojařka a API | Standalone Angular, feature služby, zaměnitelné HTTP/mock adaptéry; PHP API, PostgreSQL, sdílené TS kontrakty a čistá doménová logika. Bez nových závislostí a změny architektury. |
| Demo a moje | Demo zůstává historickým prototypem; kód se z něj nepřebírá. Vývoj členské aplikace `moje.vonica.cz` je odložen. |

Produkční databáze, migrace ani nasazení se při lokálním vývoji kroků 4–7 neměnily. Nebyl proveden push ani merge.

## Dokončený krok 7

- Dokončené trasy `/inventury` a `/inventury/{id}`: náhled průniku filtrů, zahájení se zmrazeným rozsahem, režimy Ve skladu / Podle lidí / Komplety, jednotlivé i dávkové kontroly, zrušení chybného zápisu, výslovné rozšíření, termíny, návštěvy, rekapitulace a uzavření. Čtenář má stejný přehled bez zápisů. Rozvržení používá zalamované ovládání a mřížky podle šířky obrazovky.
- Skladová mřížka se seskupuje podle aktuálních řad, při přečíslování zachová i původní označení a pracuje jen se skutečnými cíli. Enter rozbalí dávku přes sdílený parser, vypíše výsledek každého čísla a nabídne zrušení poslední skutečně zapsané kontroly.
- Oddělené ukazatele D-63/D-64: číslované kusy, obaly kompletů, početní kontroly zásob, návštěvy a nesrovnalosti. Starší fyzické ověření zůstává v pokrytí i po novější nepřítomnosti; pozorování zásob se nesčítají jako identifikované kusy. Zjištěné poškození nevymaže kontrola bez nového zjištění stavu; starší stav „v pořádku“ nezakryje aktuální poškození evidence. Zjištění kontroly a aktuální stav kusu zůstávají samostatné údaje.
- Návštěvy obsahují zmrazené držitele, termíny s kapacitou a dokončení nezávislé na ověření kusů. Samostatně jsou kontrolovatelné i výdeje jiné složce D-52. Komplety ukazují určené složení, evidované počty a skutečné výpůjčky; nečekaný nález neprovádí skryté vrácení, přiřazení nebo změnu zásoby.
- Běžné formuláře výpůjček a nových úkolů zachovají výslovný inventurní kontext. Neplatný či uzavřený kontext se potichu nevynechá. Při úpravě termínu zůstává verze z počátku editace, i když se mezitím obnoví jiná data. Historie kusu ukazuje výsledek a zrušení kontroly i poslední nezrušené fyzické ověření napříč inventurami.
- Doplněny skupiny a členství podle D-48/D-51 ve stávající organizační správě, včetně historie odvolání a stránkování. Inventurní výběr poskytuje jen názvy/ID/složku skupiny, bez seznamu členů. Nebyly přidány závislosti ani změněna architektura; `packages/domain/src` odpovídá schválenému rozdělení a používá TS alias.

### Závěrečné ověření

| Kontrola | Výsledek |
|---|---|
| `npm run api:test` | **227 testů / 1842 assertions – prošlo**, pouze lokální `splk_test`; zahrnuje migrační down/up, integritu fondů, zamítnuté operace, audit, rollback i souběžné spojení |
| `npm run krojarka:test` (Node 24) | **146 testů / 32 souborů – prošlo** |
| TypeScript aplikace / testů / kontraktů | **Všechny tři kontroly prošly** |
| `npm run krojarka:build` (Node 24) | **Prošlo, úvodní balíček 480,41 kB**, bez zvýšení původního rozpočtu; inventurní stránky se načítají při vstupu do trasy |
| `git diff --check` | **Prošlo** |

Stávající testy zůstávají zachované a neoslabené. Ruční ověření v prohlížeči dosud neproběhlo.

### Cílené ověření souběhu

`api/tests/Integration/InventoryConcurrencyTest.php` a pomocný proces `api/tests/Support/inventory-concurrency-worker.php` přidávají čtyři scénáře nad skutečnými API operacemi a samostatnými PostgreSQL spojeními:

- Rozpracovaný výdej kusu nebo změna složení kompletu → zahájení inventury vrací `409 inventory_busy`, bez hlavičky, cílů a auditu inventury; po dokončení zápisu opakování zachytí správného držitele a složení.
- Odmítnuté zahájení uvolní i dříve získané sdílené zámky. Následný zápis do kusu s krátkým `lock_timeout` ověřuje možnou kolizi pořadí zámků při výdeji bez deadlocku.
- Zahájená inventura → skutečný výdej nebo změna složení v pomocném procesu prokazatelně čeká (`pg_blocking_pids`); po potvrzení inventury se dokončí, zmrazené cíle se nezmění a oba audity vzniknou právě jednou.

Testy mají časové limity a vlastní dočasné schéma v lokální testovací DB; po skončení se schéma odstraní. Produkční kód ani migrace tyto doplňky nemění.

Lokální commit doplněných testů: `532cec1` (`test: cover inventory start concurrency`). Předchozí souhrn dokončení byl v `6480ca7`; seznam implementačních commitů kroku 7 zůstává v archivním deníku.

### Změněné oblasti a soubory

- API: `InventoryScope`, `InventoryCoverage`, `InventoryRepository`, `InventoryChecks`, `InventoryAppointments`, `InventoryLink`, `InventoryController`; návaznosti v `LoanController/Repository`, `WorkOrderController/Repository` a `App.php`. `GroupController` a `GroupRepository` pro schválenou správu skupin. Nové integrace a unit testy v `api/tests/`.
- Migrace: inventury z etapy 1 `20261024200000`; nové dopředné/vratné migrace `20261024210000_add_inventory_observation_context` a `20261024220000_add_group_membership_revocation`. Původní fyzická evidence a výpůjčky se nepřepisují ani nedoplňují smyšlenou historií.
- Kontrakty a čistá TS logika: `packages/api-contracts/src/inventories.ts`, `inventory.ts`, `loans.ts`, `organization.ts`, `errors.ts`; `packages/domain/src/inventory-numbers.ts`, `inventory-progress.ts`, `index.ts` a TS alias v `apps/krojarka/tsconfig.json`.
- Krojařka: `data/inventory/` a organizační adaptéry; nové `features/inventury/`; skupiny v `features/nastaveni/groups*` a `users-page`; kontext v trasách výpůjček/součástek, historie v `soucastky/item-page`, překlady a `app.routes.ts`. Doplněné Vitest testy adaptérů, stores, parseru a chování formulářů.
- Dokumentace: tento stav, `api-v1-a-schema.md`, `monorepo-struktura.md`, `decisions.md` (D-63/D-64) a `open-questions.md` (Q-21/Q-22 vyřešeny; později vyřešena i Q-14).

## Rozpracovaný krok 8 – průběžné ověření

Databáze a kontrakty jsou v `a59044b`, zpracování fotografií v `700f932`. Základní API příloh zahrnuje upload, metadata, autorizované originály/miniatury a archivaci. ZIP export, odstranění po digitalizaci, adaptéry a obrazovky ještě nejsou dokončené.

Průběžné kontroly: **PHPUnit 260 testů / 2125 assertions**, TypeScript kontraktů a kontrola diffu prošly. Patří sem šest databázových testů příloh, obrazové testy včetně všech osmi orientací, deset integračních scénářů endpointů a ochrany soukromého úložiště/multipartu. Toto nejsou závěrečné výsledky dokončeného kroku 8; výsledky kroku 7 zůstávají oddělené výše.

Produkční migrace, data ani nasazení se nemění. Ruční testy uploadu, čitelnosti reálných A4 karet a mobilního ovládání proběhnou až po doplnění UI; limity souborů jsou konfigurovatelné.

## Ruční ověření před případným nasazením

Po místním použití migrací ověřit v HTTP i mock režimu, na počítači i mobilu:

Před souhrnným nasazením kroků 4–7 ověřit také založení a úpravy kusů, zásob a složení kompletů, společné kontakty a oddělené fondové poznámky, běžný výdej, částečné vrácení, výměnu a vypořádání ztrátou. Tyto uživatelské průchody dosud nebyly samostatně ručně provedeny.

1. Náhled průniku filtrů, skupinu jiné složky (Muzika), prázdný rozsah a zachování cílů po změně členství či výpůjčky. Mock registr nemá příslušnosti osob ke složkám, proto tento filtr v jeho současných syntetických datech správně vrací prázdný rozsah.
2. Skladovou mřížku po řadách, Enter `1, 03, 12-15`, neexistující a opakované číslo, půjčený kus, rozpor v umístění, přečíslování a zrušení poslední kontroly.
3. Předložený poškozený kus, pozdější nepředložení, opakované kladné zjištění, zrušení jediné kladné kontroly a historii napříč inventurami. Bez nového zjištění stavu se dřívější poškození nesmí vymazat.
4. Termín s kapacitou, zrušení rezervace a opakovanou návštěvu po dokončení; dokončení nesmí hromadně ověřit součástky. Zachování rozepsané úpravy termínu při konfliktu verze.
5. Komplet se samostatně půjčeným kusem a dvěma početními doplňky, skutečný částečný počet, nečekaný kus i doplněk. Ověření nemění určené složení, přidělení ani skutečné předání. Kontrolu kusu půjčeného jiné složce bez smyšlené osoby či vrácení.
6. Běžný výdej, vrácení, výměnu a nový pracovní úkol s inventurním kontextem; zamítnutí zastaralého/cizího/uzavřeného kontextu. Čisté uzavření i uzavření s důvodem a následnou neměnnost výsledku po pohybu či dokončení opravy.
7. Čtenáře bez tlačítek zápisu, nepřístupný fond, změnu fondu při načítání a přímý vstup přes URL. Na mobilu také práci s mřížkou, formuláři, termíny a historií.

## Další postup a omezení

- **Poslední kompletně dokončený krok: 7 – Inventury, etapa 3d včetně doplněných testů souběhu.** Kroky 4–6 jsou rovněž dokončené lokálně. Pokračuje krok 8 v původním schváleném pořadí; kroky 9–10 nezačaly.
- **Q-14 je vyřešená:** odstraňovat polohová EXIF data při zachování obrazu a orientace (D-65), osobní skeny i pro fondové čtenáře (D-66). Retence D-40 zůstává beze změny. Průběžné kontroly kroku 8 se evidují samostatně od závěrečných výsledků kroku 7 výše.
- Stav je připravený k místnímu a případnému testovacímu ověření. Produkční připravenost vyžaduje výše uvedené ruční ověření a výslovné schválení produkčních migrací a nasazení. V této části práce nebyla použita produkční DB, produkční migrace, deploy ani `git push`.

## Historické průběžné zápisy

Průběžný deník a commity etap kroků 4–7 jsou zachované v [archivním snímku z 2026-10-24](../archive/03-prubeh-api-v1-2026-10-24.md). Jeho dřívější blokace a počty testů popisují stav v době zápisu. Tento aktuální souhrn je nahrazuje. Starší deník dema do 19. 10. 2026 je [v samostatném archivu](../archive/03-postup-vyvoje.md).
