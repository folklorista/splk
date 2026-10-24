# Stav vývoje

**Aktuální souhrn k 2026-10-24**, větev `feature/api-skeleton`. Pořadí implementace určuje [specifikace API v1](api-v1-a-schema.md), při rozporu platí [registr rozhodnutí](../decisions.md).

## Aktuální stav

**Poslední dokončený krok: 9 – Přehledy a hledání, etapa 2 (obrazovky a závěrečné ověření).** Kroky 1–9 jsou dokončené lokálně a automaticky otestované. Ruční provozní ověření zůstává před nasazením. **Krok 10 je rozpracovaný: databáze a kontrakty prošly, API a obrazovky následují.** Q-24 je rozhodnutá (D-68). Q-14 a převzetí držení z papíru jsou rozhodnuté (D-65 až D-67).

| Oblast | Současný stav |
|---|---|
| Kroky 1–3 | Monorepo, API, přihlášení, sessions, CSRF, katalog, evidenční řady, organizační správa, pověření a audit. Poslední zde zaznamenané nasazení API a Krojařky: `908001d` z 2026-10-24 (krok 3). |
| Krok 4 – Součástky | Kusy, nečíslované zásoby, fyzické komplety, určené složení, historie a pracovní úkoly. Jedna hlavní položka Součástky, přehled podle řad. Dokončeno lokálně, nenasazeno. |
| Krok 5 – Lidé a krojové karty | Společná identita a kontakty všem krojařkám, fondové profily a oddělené poznámky (D-60). Dokončeno lokálně, nenasazeno. |
| Krok 6 – Výpůjčky | Výdej, částečné vrácení, výměny, ztráty, pohyby a fondové karty. Dostupnost a držitelé ze skutečných výpůjček a výslovně převzatého aktuálního držení z papíru (D-67); ochrana proti dvojímu odečtu doplňků celého kompletu (D-61), ztráta s vyřazením kusu či snížením zásoby (D-62). Dokončeno lokálně, nenasazeno. |
| Krok 7 – Inventury | Zmrazený rozsah, tři režimy kontrol, termíny a návštěvy, rozšíření rozsahu, historie, nesrovnalosti, běžné operace s kontextem, neměnné uzavření a skupiny (D-48/D-51, D-63/D-64). Dokončeno lokálně, nenasazeno. |
| Krok 8 – Přílohy | Dokončeno lokálně: databáze, API, kontrakty, HTTP/mock adaptéry, galerie a průvodce převodem s původem držení `paper_migration`. GPS údaje se odstraňují se zachováním obrazu/orientace (D-65); osobní skeny čtou i fondoví čtenáři (D-66). Lokální doplnění `gd` a `zip` uživatel schválil. |
| Krok 9 – Přehledy a hledání | Kompletní fondové soupisy, JSON/CSV, tisk A4, hledání společných jmen a krojových objektů jen v povolených fondech. Dokončeno lokálně, nenasazeno. |
| Krok 10 – Náklady | Etapa 1 hotová: schéma a kontrakty. Vlastní měna každého nákladu a záporné dobropisy/vratky podle D-68; přístup pokladníka podle D-49. |
| Krojařka a API | Standalone Angular, feature služby, zaměnitelné HTTP/mock adaptéry; PHP API, PostgreSQL, sdílené TS kontrakty a čistá doménová logika. Bez nových npm/Composer knihoven a změny architektury; lokální PHP `gd`/`zip` a systémové knihovny výslovně schválil uživatel. |
| Demo a moje | Demo zůstává historickým prototypem; kód se z něj nepřebírá. Vývoj členské aplikace `moje.vonica.cz` je odložen. |

V této relaci se nepřistupovalo k produkční databázi, neprováděly se produkční migrace, nasazení, push ani merge.

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

## Dokončený krok 8

- Soukromé přílohy JPEG/PNG/PDF, sanitizace polohových metadat při zachování obrazu/orientace, autorizované miniatury a originály, verzovaná metadata, archivace, skutečný ZIP s manifestem a potvrzené odstranění obsahu se zachováním metadat/auditu (D-40, D-65/D-66).
- Obrazovka Dokumenty a galerie na kartách osoby, kusu, kompletu, řady a inventurní kontroly. Výběr vlastníka podle názvu, řazení stran, zvětšení/posun/otočení/přepínání, načítání pouze viditelných miniatur, uvolňování Blob URL, zachování rozepsané editace při konfliktu verze a nenahraných souborů při částečném selhání. PDF se stahuje; HEIC se nepřijímá. Mock data jsou pouze v paměti relace, bez dekodéru poctivě chybí miniatura.
- Průvodce `/lide/:id/prevod` odděluje podklady, porovnání papírového originálu, převzetí doloženého současného držení, historické nesrovnalosti a výslovné převzetí digitální evidence. Fyzické kontroly zůstávají samostatnou inventurní operací; nic se automaticky nepotvrzuje. Původní skeny se archivují samostatně a odstraňují až po ověřeném exportu.
- D-67: převod má `origin=paper_migration`, skutečné `issued_at/by` zůstávají null, datum/autor digitalizace jsou samostatné a doložené historické datum je volitelné. Běžné vrácení původ zachová. Chybějící, nejednoznačný, vyřazený či již jinak držený kus zůstane nesrovnalostí; jiná držení se nepřepisují. Opakování ani dva identifikátory téhož kusu nevytvářejí duplicitní otevřené držení. Kolize zámků je bezpečně opakovatelná 409.
- Nová dopředná migrace `20261024233000_add_paper_migration_provenance` zachovává existující výpůjčky a data výdejů; její rollback odmítne smazat vzniklé převody či nesrovnalosti. Automatické testy ověřují prázdný down/up i odmítnutí ztráty dat.

| Závěrečná kontrola kroku 8 | Výsledek |
|---|---|
| `npm run api:test` | **283 testů / 2349 assertions – prošlo**, lokální `_test` DB, včetně souběhu kroku 7, migrací, oprávnění, auditu, integrity, exportu, bezpečného opakování a převodu |
| `npm run krojarka:test` (Node 24) | **185 testů / 40 souborů – prošlo** |
| TypeScript aplikace / testů / kontraktů | **Všechny tři kontroly prošly** |
| `npm run krojarka:build` | **Prošlo, úvodní balíček 489,02 kB**, bez zvýšení rozpočtu; účet a uživatelská správa se načítají při vstupu do trasy |
| `git diff --check` | **Prošlo** |

Commity kroku 8: `a59044b` databáze/kontrakty, `700f932` fotografie, `d8d3251` souborové API, `2ea0a29` export/odstranění, `37f85a0` binární CSRF, `3dd9e06` adaptéry, `d485f45` model/API převodu, `02540f9` porovnání originálu, `706f13e` adaptéry převodu a původ, `6f8309e` obrazovky příloh a převodu.

Změněné oblasti: `api/db/migrations`, `api/src/Domain/Costumes/LoanRepository.php`, `Domain/Identity/PeopleRepository.php`, přílohové a převodové controllery, soukromé úložiště a obrazové zpracování, HTTP request/policy, `api/tests`; `packages/api-contracts/src/{attachments,paper-migrations,loans,people,errors}.ts`; Krojařka `data/attachments`, `data/people`, `data/inventory`, `features/dokumenty`, průvodce v `features/lide`, galerie ve stávajících detailech, popisky historie a trasy. Stávající testy zůstaly zachované; testovací příprava odložených Angular komponent nyní výslovně čeká na `compileComponents()`.

Před nasazením ručně ověřit obě datové varianty, reálnou čitelnost A4 a mobilní zoom/otočení/posun, JPEG s GPS a orientací i PDF, archivaci a ZIP uložený mimo aplikaci, přerušení dávky a opakování úklidu; dále převod s neznámým/známým datem, konflikt držitele, opakování, dokončení s nejasnostmi a skutečné vrácení. Galerie podporuje klávesnici a vrací fokus po zavření. Ruční průchod v prohlížeči zatím neproběhl. Produkční připravenost není tímto potvrzena.

## Dokončený krok 9

Etapa 1 (API, kontrakty) a etapa 2 (HTTP/mock adaptéry, obrazovky a závěrečné ověření) jsou dokončené:

- Soupisy podle řady kusů i kompletů, člověka a konkrétního kusu s historií; samostatně fyzický komplet, inventurní cíle/kontroly/nesrovnalosti, výpůjčky a pracovní úkoly. Filtry stavu, umístění, vyřazení, dostupnosti a data pořízení, otevřené/opožděné výpůjčky a externisté. Pracovní úkoly lze omezit na otevřené a rozpracované či konkrétní stav. Nepoužitelné filtry řad kompletů API odmítá a UI je nenabízí.
- JSON i CSV obsahují celou sestavu včetně dalších stránek. Server používá read-only opakovatelný snímek, uzavřená inventura vlastní uložené výsledky. Výstupy rozlišují evidenci, skutečné výdeje, převzetí z papíru a fyzické inventurní kontroly; neznámé původní datum výdeje zůstává prázdné. Přehledy nezpřístupňují strukturované kontakty.
- CSV: UTF-8, BOM, středník, korektní uvozovky/nové řádky a ochrana před interpretací uživatelských textů jako tabulkových vzorců. Evidenční čísla při importu do tabulky načítat jako text kvůli úvodním nulám. Tisk A4 obsahuje fond a datum sestavení, skrývá navigaci a opakuje hlavičky tabulek.
- Hledání jmen/přezdívek a označení řada + číslo, bez diakritiky a rozdílů velikosti, doslovné `%`/`_`, stránkování. Fyzické objekty pouze z přístupných fondů, společná identita bez kontaktů. UI dovoluje aktuální nebo všechny přístupné fondy a před otevřením výsledku zvolí jeho oprávněný fond. Opožděné odpovědi ani CSV se nepřenesou do jiného kontextu.
- Lazy trasy `/prehledy`, `/hledat`; stejné feature služby a zaměnitelné HTTP/mock adaptéry. Katalog a evidenční řady se nově načítají při vstupu do jejich tras, rozpočet se nezvyšoval. Žádná nová migrace ani závislost v kroku 9.

| Závěrečná kontrola kroku 9 | Výsledek |
|---|---|
| `npm run api:test` | **292 testů / 2433 assertions – prošlo**, lokální `_test` DB; devět scénářů přehledů/hledání navíc proti dokončenému kroku 8, starší testy zachované |
| `npm run krojarka:test` (Node 24) | **198 testů / 44 souborů – prošlo**; nové adaptéry, fondová oprávnění, řady kompletů, papírový původ, filtry, stale odpovědi a exporty, CSV a hledání |
| TypeScript aplikace / testů / kontraktů | **Všechny tři kontroly prošly** |
| `npm run krojarka:build` | **Prošlo, úvodní balíček 477,35 kB**, bez varování rozpočtu |
| `git diff --check` | **Prošlo** |

Commity: `db4eb0e` API/kontrakty, `5e49bbc` filtry pracovních úkolů a validace kompletů, `e49b0b7` adaptéry, obrazovky, tisk a testy. Změněné oblasti: `api/src/Domain/Costumes/Report{Repository,Labels}.php`, `ReportController`, `SearchController`, registrace v `App.php`, `ReportsSearchTest` a zpětně kompatibilní volitelné hlavičky testovacího helperu; `packages/api-contracts/src/reports.ts`, čistá CSV logika v `packages/domain/src`; Krojařka `data/reports`, `features/prehledy`, trasy, výběr adaptérů a tiskové styly. Dokumentace aktuálního stavu, API a Q-24 je synchronizovaná.

Ruční ověření zatím neproběhlo: tisk reálných dlouhých sestav A4, import CSV v používaném tabulkovém programu (diakritika, úvodní nuly, víceřádkové texty), mobilní tabulky, srovnání filtrů s evidencí, výsledek jiné přístupné složky a zamítnutí neoprávněných vstupů. Automatické testy zahrnují i sestavu přes 200 řádků, ochranu vzorců, původ z papíru a neměnnost uzavřené inventury po změně kusu.

## Rozpracovaný krok 10 – průběžné ověření

Etapa 1: migrace `20261024234000_create_costume_costs`, sdílené DTO nákladů a navázaných fyzických objektů. Přesná částka `numeric(18,4)` a třípísmenný kód měny, metadata dokladu/dodavatele/účelu, fondové vazby na kus/zásobu/komplet, množství a optimistická verze. Jednotlivý kus či komplet má množství 1; nečíslovaná zásoba kladné množství. Vazby nemění fyzické počty, data pořízení ani držení. Náklad se při souhrnu nezdvojuje počtem vazeb.

**Průběžné testy: PHPUnit 295 testů / 2445 assertions – prošlo**, pouze lokální testovací databáze; tři nové testy schématu včetně neplatných dat, fondů, zachování přesných záporných částek, down/up a odmítnutí rollbacku se vzniklou evidencí. Kontrakty prošly TypeScriptem. Nejde ještě o závěrečné ověření celého kroku 10.

Etapa 2: fondové a souhrnné API, přesné částky, dobropisy/vratky, souhrny po měnách, vazby na fyzické objekty, omezený přístup pokladníka (D-49), audit a transakční rollback, verze a skutečný CSV export všech stránek. **PHPUnit 305 testů / 2568 assertions – prošlo**, deset nových integračních scénářů. Zkouší i existující cizí kus, odmítnuté zápisy, odvolání pověření ve stejné session, archivovaný fond, chybu auditu a simulované SQLSTATE `55P03` bez částečné evidence. Stávající reálné testy souběhu inventur jsou stále součástí celé sady. Frontendové datové adaptéry a obrazovky následují samostatně.

## Ruční ověření před případným nasazením

Po místním použití migrací ověřit v HTTP i mock režimu, na počítači i mobilu:

Před souhrnným nasazením kroků 4–9 ověřit také založení a úpravy kusů, zásob a složení kompletů, společné kontakty a oddělené fondové poznámky, běžný výdej, částečné vrácení, výměnu a vypořádání ztrátou. Tyto uživatelské průchody dosud nebyly samostatně ručně provedeny.

1. Náhled průniku filtrů, skupinu jiné složky (Muzika), prázdný rozsah a zachování cílů po změně členství či výpůjčky. Mock registr nemá příslušnosti osob ke složkám, proto tento filtr v jeho současných syntetických datech správně vrací prázdný rozsah.
2. Skladovou mřížku po řadách, Enter `1, 03, 12-15`, neexistující a opakované číslo, půjčený kus, rozpor v umístění, přečíslování a zrušení poslední kontroly.
3. Předložený poškozený kus, pozdější nepředložení, opakované kladné zjištění, zrušení jediné kladné kontroly a historii napříč inventurami. Bez nového zjištění stavu se dřívější poškození nesmí vymazat.
4. Termín s kapacitou, zrušení rezervace a opakovanou návštěvu po dokončení; dokončení nesmí hromadně ověřit součástky. Zachování rozepsané úpravy termínu při konfliktu verze.
5. Komplet se samostatně půjčeným kusem a dvěma početními doplňky, skutečný částečný počet, nečekaný kus i doplněk. Ověření nemění určené složení, přidělení ani skutečné předání. Kontrolu kusu půjčeného jiné složce bez smyšlené osoby či vrácení.
6. Běžný výdej, vrácení, výměnu a nový pracovní úkol s inventurním kontextem; zamítnutí zastaralého/cizího/uzavřeného kontextu. Čisté uzavření i uzavření s důvodem a následnou neměnnost výsledku po pohybu či dokončení opravy.
7. Čtenáře bez tlačítek zápisu, nepřístupný fond, změnu fondu při načítání a přímý vstup přes URL. Na mobilu také práci s mřížkou, formuláři, termíny a historií.

## Další postup a omezení

- **Poslední kompletně dokončený krok: 9 – Přehledy a hledání, etapa 2.** Krok 10 pokračuje po rozhodnutí Q-24 → D-68. Databáze a kontrakty jsou hotové; další etapy nejsou ještě prohlášeny za dokončené.
- **Q-14 je vyřešená:** odstraňovat polohová EXIF data při zachování obrazu a orientace (D-65), osobní skeny i pro fondové čtenáře (D-66). Retence D-40 zůstává beze změny. Závěrečné výsledky jednotlivých kroků jsou oddělené výše; historický deník je odkazovaný níže.
- Stav je připravený k místnímu a případnému testovacímu ověření. Produkční připravenost vyžaduje výše uvedené ruční ověření a výslovné schválení produkčních migrací a nasazení. V této části práce nebyla použita produkční DB, produkční migrace, deploy ani `git push`.

## Historické průběžné zápisy

Průběžný deník a commity etap kroků 4–7 jsou zachované v [archivním snímku z 2026-10-24](../archive/03-prubeh-api-v1-2026-10-24.md). Jeho dřívější blokace a počty testů popisují stav v době zápisu. Tento aktuální souhrn je nahrazuje. Starší deník dema do 19. 10. 2026 je [v samostatném archivu](../archive/03-postup-vyvoje.md).
