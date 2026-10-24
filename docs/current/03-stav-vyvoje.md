# Stav vývoje

Co je hotové a co se právě dělá. Pořadí vývoje určuje [`../decisions.md`](../decisions.md) D-02. Historický deník do 19. 10. 2026 je v [`../archive/03-postup-vyvoje.md`](../archive/03-postup-vyvoje.md).

## Stav k 2026-10-24

| Část | Stav |
|---|---|
| **Krojařka** (`krojarka.vonica.cz`) | Krok 2: kostra v `apps/krojarka` (Angular 22.2, zoneless, Vitest): boční menu podle D-22 (sekce zatím jako zástupné stránky), přihlášení, zapomenuté heslo, nastavení hesla z odkazu, Můj účet (pověření, změna hesla, přihlášená zařízení, odhlášení). Datová vrstva `data/` s HTTP a mock adaptérem (`npm run krojarka:start:mock`), interceptory podle hosting doc kap. 8. Trasy česky (`/prihlaseni`, `/lide`, `/soucastky`…). Nasazeno 2026-10-24 jako `feature/api-skeleton@62b8310`. Krok 3 (nasazeno 2026-10-24 jako `908001d`): výběr krojového fondu v menu, Nastavení → Katalog (regiony a oblasti, druhy součástek), Evidenční řady (součástek i kompletů), Uživatelé a pověření (D-59). Krok 4 dokončen lokálně: Součástky podle řad, kusy, zásoby, komplety, složení, historie a pracovní úkoly s HTTP/mock adaptéry; zatím nenasazeno. Krok 5 dokončen lokálně: Lidé, společné kontakty (D-60), fondové profily. Krok 6 dokončen lokálně: výpůjčky, pohyby, vrácení, výměny a ztráty (D-61, D-62), skutečná dostupnost a fondové karty s HTTP/mock adaptéry; zatím nenasazeno. |
| **API** (`api.vonica.cz`) | Kroky 1–2 ve větvi `feature/api-skeleton`: kostra (router, `GET /v1/health`, CORS/origin/JSON, sessions v PostgreSQL, CSRF), migrace identity a přístupu, `auth/*` podle kap. 4.1 (přihlášení s omezením pokusů, odhlášení, `me`, změna hesla, obnova hesla e-mailem přes PHPMailer, přihlášená zařízení), seed prvního účtu `organization.admin` (pozvaný, heslo si nastaví odkazem). Testy PHPUnit (Unit + Integration). Nasazeno 2026-10-24 jako `feature/api-skeleton@62b8310`: `config/config.php` z `.env`, migrace `CreateIdentityAndAccess` (záloha před migrací v `dev/local/backups/`), pozvaný účet `organization.admin`. Krok 3 (nasazeno 2026-10-24 jako `908001d`, se seedy `VonicaUnits` a `VonicaCatalog`): migrace `CreateCatalogAndAudit` (regiony, druhy, řady, `audit_log`, `mandates.revoked_at`), katalog `/v1/funds/{u}/regions\|part-types\|series` s kontrolou pověření (404 mimo rozsah, 403 jen pro čtení), správa organizace (`/v1/persons`, `/v1/accounts`, `/v1/mandates`, `/v1/units`), audit všech zápisů, seedy `VonicaUnits` a `VonicaCatalog`. Krok 4 dokončen lokálně: migrace fyzické evidence, API kusů, zásob, kompletů, složení a pracovních úkolů; zatím nenasazeno. Krok 5 dokončen lokálně: Lidé, společné kontakty (D-60), fondové profily. Krok 6 dokončen lokálně: výpůjčky, pohyby, vrácení, výměny a ztráty (D-61, D-62), skutečná dostupnost a fondové karty s HTTP/mock adaptéry; zatím nenasazeno. |
| **Demo** (`demo.vonica.cz`) | Prototyp nasazený jako `design/identity-03@ce20f01`. Přesun z `moje` dokončen 22. 10. 2026. Nasazení: `/deploy` (`--target demo`). Popis kódu: `../archive/implementace-2026-10-21/`. |
| **moje.vonica.cz** | Vývoj odložen. Po přesunu dema prázdná, vyhrazená budoucí členské aplikaci. |
| Monorepo | npm workspaces `apps/*`, `packages/*`, Node ≥ 24 (`.nvmrc`). `packages/api-contracts` (DTO a chybové kódy auth) – první sdílený balíček. Deploy: `npm run deploy -- --target api\|krojarka` (`scripts/deploy-app.mjs`). Kroky 4–6 dokončeny lokálně; Q-19 → D-61 a Q-20 → D-62 rozhodnuty. Krok 7: dokončena databázová etapa, Q-21 rozhodnuta → D-63, pokračuje inventurní API. |

## Krok 4 – Součástky (dokončeno 2026-10-24)

**2026-10-24: dokončena etapa 1 – databáze a kontrakty.** Následující etapy jsou také dokončeny (níže), včetně obrazovek a obou datových adaptérů. Další krok je 5 – Lidé a krojové karty.

- Migrace `20261024120000_create_costume_inventory`: kusy, nečíslované zásoby, fyzické komplety, početní řádky, historie složení, události kusů a pracovní úkoly. Vazby mezi fondy chrání složené cizí klíče. Aktivní čísla jsou jedinečná v řadě; zákaz opakovaného použití historického čísla podle nastavení řady bude kontrolovat API v etapě 2.
- `kit_id` vyjadřuje určené složení, nikoli potvrzenou přítomnost kusu. `required_qty` je požadavek, `present_qty` evidované množství přidělené kompletu (výchozí 0), nikoli fyzické ověření. Nový komplet má stav `unverified`; vložení složení jej automaticky nemění.
- Součet evidovaných množství v kompletech nesmí překročit celkovou zásobu. Databázové triggery kontrolují přidělení i snížení celkového množství se zamčením zásoby. Požadované množství může být vyšší než zásoba, aby šlo opsat neúplný lístek.
- Sdílené kontrakty jsou v `packages/api-contracts/src/inventory.ts`. Neobsahují odvozenou dostupnost ani držitele. Výpůjčky, kontroly inventury a jejich historie nevznikají; vazby na ně přibudou v příslušných krocích. Výchozí fyzické umístění nového kusu je `unknown`.
- Ověření: PHPUnit **85 testů / 342 assertions** (9 nových testů databázových pravidel včetně rollbacku a opětovného použití migrace), Vitest **40 testů**, striktní kontrola TS kontraktů a produkční build Krojařky. Build v sandboxu padal v esbuild, mimo sandbox prošel.
- Migrace byla spuštěna pouze v lokální testovací DB. Produkce ani nasazení se neměnily. Ruční ověření obrazovek přibude po implementaci UI.

### Etapa 2 – API jednotlivých kusů (2026-10-24)

- `GET/POST /v1/funds/{u}/items`, `GET/PATCH /v1/items/{id}`, `POST /v1/items/{id}/retire`, `GET /v1/items/{id}/history`.
- Rozsah fondu přes stávající `FundAccess`, zápisy pouze s `costumes.manage`; čtenáři nesmějí zapisovat (403), cizí objekty a fondy jsou skryté (404). Všechny trasy používají stávající sessions, CSRF a Origin kontroly.
- Seznam: stránkování a `total`, řazení z povoleného seznamu, filtry řady, hledání bez diakritiky, stavu, fyzického umístění, data pořízení a vyřazení. Filtry `available` a `holder` jsou do kroku 6 výslovně odmítnuty, aby nevznikaly zavádějící výsledky.
- API kontroluje druh řady, číslovanost, příslušnost ke fondu a archivaci řady, druhu i regionu včetně nadřazeného regionu. Kontrola čísel zamyká řadu; při zákazu opakovaného použití kontroluje i vyřazené kusy. Číslo může chybět, identita zůstává stabilní.
- Úpravy a vyřazení kontrolují `version` pod zámkem kusu (409 při konfliktu). Vyřazení vyžaduje důvod a zachovává historii. Vyřazený kus už nelze upravovat. U existujícího kusu v archivované řadě lze opravit ostatní údaje, ale nikoli změnit číslo v archivované řadě.
- Každý zápis kusu, jeho událostí a auditu běží ve stejné transakci. Historie obsahuje založení a skutečné změny údajů, nikoli výpůjčky či fyzická ověření. Změny složení nelze obejít přes PATCH kusu (`kitId` není povolený vstup).
- Související oprava katalogu: druh s existujícími kusy (včetně vyřazených a zatím bez čísla) nelze přepnout na nečíslovaný. Kontrola se zamyká proti souběžnému založení kusu.
- Ověření: PHPUnit **105 testů / 690 assertions**, z toho **20 nových testů API kusů**. Pokryty i odmítnuté endpointy, zaniklá pověření, CSRF, verze, filtry, čísla a rollback kusu i událostí při selhání auditu. Striktní kontrola TS kontraktů a `git diff --check` prošly. Frontendová logika ani databázová migrace se v etapě 2 neměnily.
- Produkční migrace ani deploy neproběhly.

Ruční ověření po lokálním spuštění API s migrací etapy 1 (zatím bez UI):

1. Jako krojařka založit kus bez čísla, načíst detail a historii; číslo zůstává `null`, fyzické umístění `unknown`, držitel ani dostupnost se nevrací.
2. Doplnit číslo, stav a poznámku s aktuální verzí; opakovat požadavek se starou verzí → 409. Ověřit původní a novou poznámku v historii.
3. Vyřadit kus s důvodem; ověřit detail, filtr `retired=true` a historii. Založit nový kus se stejným číslem podle nastavení řady; stará a nová identita se liší.
4. S pověřením jen pro čtení zkusit úpravu → 403; s pověřením jiného fondu detail i historii → 404. Zkusit filtr `holder` nebo `available` → 422. Tyto ruční scénáře zatím nebyly samostatně provedeny; jejich chování pokrývají integrační testy.

### Etapa 3 – API nečíslovaných zásob (2026-10-24)

- Seznam a založení ve fondu, úprava na kanonické adrese. Typ zásoby je neměnný; vyžaduje nečíslovaný aktivní druh stejného fondu.
- Přísná celočíselná množství, zámek zásoby při změně, zamítnutí snížení pod evidované přidělení do kompletů. Změny a audit jsou atomické. Používaný druh nelze přepnout mezi číslovaným a nečíslovaným.
- Vrací se `quantityTotal` a `quantityInKits`, nikoli dostupnost či držitelé. Výpůjčky zůstávají krokem 6.
- PHPUnit: **112 testů / 770 assertions**; 7 nových testů zásob, včetně oprávnění, množství, duplicity a rollbacku auditu. `git diff --check` prošel. Produkce beze změny.

### Etapa 4 – API kompletů a složení (2026-10-24)

- Komplety mají vlastní řady, detail s určenými kusy, požadovanými a evidovanými počty doplňků a historií změn. Seznam podporuje řadu, hledání a stránkování.
- Přidání, odebrání a přesun složení jsou atomické; přesun kontroluje verze obou kompletů a kusu, zamyká komplety v pořadí ID, zapisuje historii na obou stranách a audit. Kus nemůže být určen do dvou kompletů, vazby zůstávají ve stejném fondu.
- `add` u doplňků přičítá požadovaný i evidovaný počet k případnému řádku; `remove` odstraní celý řádek; `move` přesune zadané počty. Požadavek nemusí být krytý zásobou, evidované počty ano. Zápis lístku uvádí evidovaný počet 0, pokud přítomnost neznáme.
- Změna složení ponechá `unverified`; jiný předchozí stav přepne na `pending_check`. Ručně evidovaný stav nenahrazuje inventurní kontrolu. Fyzická přítomnost číslovaného kusu se z jeho příslušnosti ke kompletu neodvozuje.
- PHPUnit: **122 testů / 891 assertions**, 10 nových testů kompletů; TS kontrakty a diff v pořádku. Produkce beze změny.

### Etapa 5 – pracovní úkoly kusu (2026-10-24)

- Seznam a založení úkolu u kusu, úprava úkolu a souhrn fondu s filtrem stavu. Typy a stavy podle D-38; změna úkolu automaticky nemění stav, umístění ani vydatelnost kusu.
- Nový úkol nelze založit u vyřazeného kusu; existující lze dokončit či zrušit. Všechny zápisy, události kusu a audit jsou atomické a podléhají pověření fondu.
- PHPUnit: **127 testů / 954 assertions**, 5 nových testů pracovních úkolů včetně oprávnění, validace a rollbacku. Diff v pořádku. Následovala etapa 6 – Angular a adaptéry (dokončena níže).

### Etapa 6 a závěrečné ověření kroku 4 (2026-10-24)

- Jediná hlavní položka Součástky: přehled podle evidenčních řad, filtry klasifikace, stavu, umístění a pořízení, nečíslované zásoby a fyzické komplety. Trasy `/soucastky`, `/soucastky/nova`, `/soucastky/kusy/:id`, `/soucastky/komplety/:id`.
- Formuláře a detaily kusů, důvod a potvrzení vyřazení, historie, pracovní úkoly včetně úpravy a změn stavu. Detail kompletu odděluje určené kusy od požadovaných/evidovaných počtů; změny složení mají souhrn před potvrzením. Doplněno také částečné odebrání doplňků (s oběma počty) bez jiného kompletu.
- `InventoryStore` zajišťuje načtení všech stránek a ignorování opožděných odpovědí starého fondu nebo detailu. Při konfliktu zůstává formulář i původní verze zachovaná; obnovení se provádí výslovně. Rozhraní `InventoryApi` má zaměnitelné HTTP a mock adaptéry, komponenty HTTP nevolají. Mock data jsou pouze v paměti relace a operace se při chybě vracejí zpět jako celek.
- Číslované součástky nemají odvozenou dostupnost ani držitele. Zásoby ukazují celkem / v kompletech / mimo komplety; fyzická kontrola a výpůjčky nevznikají.
- Kompletní ověření: **PHPUnit 128 testů / 963 assertions**, **Vitest 65 testů v 16 souborech**, TypeScript aplikace, testů i sdílených kontraktů, produkční build **468,66 kB** (v limitu) a `git diff --check`. Bez nových závislostí a bez změny architektury.
- Samostatně připravený krok 4 lze po revizi a ručním ověření řízeně nasadit s migrací etapy 1; migrace zůstává pouze v lokální testovací DB. Produkce ani vzdálený Git se neměnily.

Ruční ověření UI, které zbývá provést v prohlížeči (zejména mobil 360 px a HTTP režim):

1. V mock režimu založit kus bez čísla, doplnit číslo a poznámku, zkontrolovat historii, založit a upravit pracovní úkol. Pak vyřadit kus s důvodem a znovu použít číslo podle nastavení řady.
2. Založit nečíslovanou zásobu a neověřený komplet. Opsat požadované množství s evidovaným počtem 0; ověřit, že se komplet neoznačí jako úplný.
3. Do kompletu přidat kus a doplňky, přesunout je mezi dvěma komplety a část doplňků odebrat. Před potvrzením zkontrolovat souhrn; po uložení historii obou kompletů a množství zásoby.
4. Se dvěma přihlášeními ověřit konflikt verze, zachování rozepsaného formuláře a výslovné obnovení. Přepnout fond během načítání a při probíhajícím zápisu. Zopakovat jako čtenář a jako správce organizace bez přístupu k fondu.
5. V HTTP režimu proti lokální migrované DB zopakovat ukládání a obnovení stránky. Automatické testy pokrývají uvedená pravidla, nenahrazují ruční kontrolu ergonomie.

## Krok 5 – Lidé a krojové karty (dokončeno 2026-10-24)

Q-18 rozhodnuta uživatelem → D-60: kontakty společné všem krojařkám, krojové poznámky po fondech.

- Etapa 1: kompatibilní migrace `CreateCostumeHolderProfiles`, DTO a API osob a profilů. Základní identita, společný kontakt a výchozí kroj jsou u osoby; fondové poznámky a stav evidence jen v autorizovaném profilu. Čtenář nemá nový přístup ke společnému kontaktu. Žádné automatické účty, příslušnosti, zápůjčky ani fyzické kontroly.
- Možná shoda jmen se potvrzuje samostatným požadavkem; lze založit dvě skutečně rozdílné osoby se stejným jménem. Zápisy osob, profilů a audit jsou transakční. Samotná správa organizace neotvírá krojové endpointy.
- Etapa 2: HTTP a mock adaptér `PeopleApi`, mock používá stejný registr osob jako mock správy organizace. Fondové profily jsou oddělené, společný kontakt se promítá i do Nastavení.
- Etapa 3: Lidé s hledáním bez diakritiky, filtrem příslušnosti a stavu karty; založení a úprava osoby, explicitní varování před duplicitou, společný kontakt a výchozí kroj, samostatný profil a poznámka zvoleného fondu. Trasy `/lide` a `/lide/:id`.
- Krojové karty nadále znamenají lidi s výpůjčkami (D-22). V kroku 5 je dostupný profil osoby ve fondu, zatímco seznam osob s výpůjčkami a historie předání navážou v kroku 6; UI tuto skutečnost přiznává a nevymýšlí prázdné výpůjčky či inventurní ověření.
- Kompletní ověření: **PHPUnit 137 testů / 1 076 assertions**, **Vitest 75 testů**, TypeScript aplikace, testů a kontraktů, produkční build **492,08 kB** a kontrola diffu. Testy zahrnují sdílení kontaktů, izolaci profilů, přístup jen pro čtení, duplicitní jména, opožděné odpovědi a rollback auditu.
- Ručně zbývá v HTTP i mock režimu ověřit založení externisty bez účtu, shodu jmen a výslovné potvrzení, změnu společného kontaktu ve dvou fondech a oddělené poznámky, přepínání fondů při načítání a mobilní ergonomii. Samostatné ruční testování zatím neproběhlo.
- Migrace pouze v lokální testovací DB, žádná produkční data, deploy ani push. Při návrhu kroku 6 zjištěn rozpor počítání doplňků (Q-19, níže); kroky 6–10 ještě nejsou implementované.

## Krok 6 – dokončeno lokálně

Uživatel rozhodl Q-19 → D-61: počet doplňků v kompletu při výpůjčce zachovat a zabránit dvojímu odečtu. Dokončena migrace, API, kontrakty, adaptéry, feature logika a obrazovky; výsledky závěrečných kontrol a ruční scénáře jsou níže.

Podle pravidel autonomie uživatele je implementace před krokem 6 zastavena. Nebyla zvolena vlastní interpretace množství a nevznikly migrace ani endpointy výpůjček. Poslední dokončený a otestovaný celek je krok 5. Kroky 4–5 jsou technicky připravené k řízenému nasazení po ruční kontrole a revizi migrací; žádné produkční spojení, migrace, nasazení, push ani merge neproběhly.

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


### Krok 6, etapa 1 – databáze a kontrakty

- D-61 řeší Q-19: doplňky zůstávají v evidenci kompletu, výpůjčka se neodečítá podruhé.
- Přidána zpětně vratná migrace výpůjček, řádků a historie jednotlivých vrácení, fondové cizí klíče, jedinečnost otevřené výpůjčky kusu a kapacitní ochrana zásob včetně následné změny složení.
- Sdílené TypeScript kontrakty výdeje, vrácení, výměny, seznamů a pohybů. API a obrazovky kroku 6 zatím nejsou dokončené.
- PHPUnit: **144 testů / 1104 assertions**, TypeScript kontrakty a `git diff --check` prošly. První běh odhalil chybu nového triggeru, opraveno a celá sada zopakována úspěšně. Migrace ověřena pouze v lokální testovací DB včetně down/up a zachování dosavadní evidence.
- Ručně zatím není co ovládat v UI; před případným nasazením bude potřeba ověřit výdej a částečné vrácení v HTTP režimu. Produkce, deploy a push neprovedeny.


### Krok 6, etapa 2a – API předání a vypořádání

- Výdej osobě i jiné složce, přesný snímek kompletu s vynechanými kusy a poznámkou při známé neúplnosti, stránkované seznamy a pohyby, detail, změna termínu a poznámky, částečná vrácení a atomická výměna existujících kusů. Pověření, fondové vazby, validace, vlastní události a audit na serveru.
- Q-20 rozhodnuta → D-62: vypořádání znamená ztrátu; kus se vyřadí, počet zásoby i evidované přidělení v původním kompletu se sníží, požadované množství a snímek zůstanou. Povinný důvod, žádné smyšlené převzetí nebo fyzické ověření.
- Kapacitní ochrana D-61 platí i pro nové výpůjčky, snížení zásoby a změnu složení; selhání vrací `insufficient_stock` a operace se vrátí zpět.
- PHPUnit: **161 testů / 1298 assertions**, Vitest: **75 testů / 20 souborů**, TypeScript aplikace, testů a kontraktů a kontrola diffu prošly. Produkční build: **492,46 kB**. Během doplnění ztrát opraven SQL řetězec a celá API sada zopakována úspěšně.
- Krok 6 není dokončen: následuje odvození dostupnosti a držitelů, napojení karet, HTTP/mock adaptéry a UI. Ruční ověření celých uživatelských toků bude možné po dokončení obrazovek. Produkce, deploy a push neprovedeny.


### Krok 6, etapa 2b – dostupnost a krojové karty v API

- Dostupnost a držitel kusu jsou odvozené z reálných výpůjček a oddělené od umístění. Přidány filtry `available` a `holder`; nevznikají fiktivní výpůjčky.
- Fondová karta vrací stránkované otevřené výpůjčky a pohyby; `hasLoans` v seznamu osob vyžaduje konkrétní oprávněný fond. Kontakty ani karta nezpřístupňují cizí fondové výpůjčky.
- PHPUnit: **163 testů / 1318 assertions**, kontrola diffu prošla. Navazuje etapa 3 – datové adaptéry a feature logika frontendu.


### Krok 6, etapa 3a – HTTP/mock adaptéry

- Sdílené kontrakty a zaměnitelné adaptéry pro všechny operace výpůjček, zásobu bez překryvu, reálnou dostupnost a fondové karty. Mock sdílí fyzickou evidenci a registr osob s dosavadními adaptéry; sériové operace mají rollback.
- Výslovné výjimky při předání kompletu zahrnují kusy i početní doplňky; verze náhledu brání předání mezitím změněného složení bez nového posouzení.
- PHPUnit: **164 testů / 1327 assertions**, Vitest: **85 testů / 22 souborů**, TypeScript aplikace a testů prošel. UI a feature store ještě nejsou dokončené; nic se nenasazovalo.


### Krok 6, etapa 3b – frontendová feature logika

- `LoansStore` vede metadata, seznamy, pohyby, detail a náhled kompletu; stránkuje přes API a kontroluje pověření před zápisem. Změna fondu vyčistí data a pozdní odpovědi předchozího fondu se zahodí.
- Vitest: **89 testů / 23 souborů**, včetně stránkování, změny kontextu, zamítnutí zápisu čtenáři a souběžných zápisů. Obrazovky kroku 6 se dále připravují.


### Krok 6 – oprava načítání kontextu pro čtenáře

- Při kontrole přímého vstupu do fondových tras nalezeno, že `costumes.view` pro celou organizaci může být přesměrováno před dokončením seznamu fondů. Guard nyní na seznam počká, souběžné čtení používá jeden požadavek a pozdní odpověď po odhlášení se zahodí.
- Vitest: **98 testů / 24 souborů**. Oprava zachovává pověření a stávající kontextovou službu; nepřidává závislosti ani nový způsob přístupu.


### Dokončení kroku 6 – obrazovky a návaznosti

- Výpůjčky zobrazují skutečné pohyby od nejnovějších a filtrované otevřené/uzavřené výpůjčky, termíny, externisty a držitele. Výdej jednotlivých kusů i kompletu má kontrolu skutečného obsahu, verzi náhledu a výjimky kusů i počtů doplňků; u papírové evidence upozorňuje na nový digitální výdej.
- Detail předání podporuje částečné převzetí po řádcích s poznámkami a změnou stavu/vydatelnosti/umístění, vypořádání ztráty s důvodem a výměnu po výslovném potvrzení předložení původního kusu. Uchovává všechny dílčí události. Výměna naviguje na navazující předání.
- Součástky ukazují skutečné držitele a dostupnost s filtry, zásoby celkové/přidělené/volné podle D-61. Komplety rozlišují určené složení a půjčení v kompletu nebo jiným předáním, odkazují na aktuální předání i historii. Karty osob seskupují skutečně svěřené řádky podle regionu a typu kroje; hlavní Krojové karty obsahují jen osoby s otevřenou výpůjčkou tohoto fondu.
- Stránky Výpůjčky, Lidé a Součástky se načítají při otevření trasy; URL, komponentové služby a adaptéry zůstávají zachované. Tím je úvodní balíček pod původním limitem bez jeho zvýšení.
- Závěrečné kontroly: **PHPUnit 165 testů / 1337 assertions; Vitest 98 testů / 24 souborů; TypeScript aplikace, testů i kontraktů; produkční build 444,60 kB; `git diff --check` – vše prošlo.** Průběžná selhání byla opravena, testy nebyly odstraněny nebo oslabeny.
- Ručně dosud neověřeno v prohlížeči. Před nasazením ověřit v HTTP i mock režimu: výdej kusu osobě a jiné složce; komplet se samostatně půjčeným šátkem a 2 mašlemi; výjimku jednoho doplňku; vrácení 1 ze 2; ztrátu druhé mašle a kusu; zamítnutou i úspěšnou výměnu; změnu fondu při načítání a přímý vstup čtenáře; práci na mobilu. Po místní migraci existující evidence nesmí sama získat žádné smyšlené výpůjčky.
- Bez produkčních migrací, produkční DB, deploye nebo push. Kód je připraven k lokálnímu ověření a případnému testovacímu nasazení, produkční nasazení vyžaduje výslovný souhlas a uvedené ruční ověření. Kroky 7–10 zatím nejsou dokončené.


## Krok 7 – rozpracováno, etapa 1 (databáze a kontrakty)

- Přidána vratná migrace inventur, zmrazených cílů, termínů, návštěv a historie kontrol. Fondové a inventurní vazby, jedinečnost fyzických kusů/početních kontextů, opakované návštěvy bez přepsání dokončených a povinný důvod explicitního rozšíření či uzavření s nesrovnalostmi.
- Vazby výpůjček, vrácení a pracovních úkolů na inventuru jsou zatím pouze připravené; žádné operace inventurního API nebo obrazovky zatím nejsou implementované. Stávající evidence se automaticky nepovažuje za fyzicky ověřenou.
- Základní sdílené TypeScript kontrakty. Testy migrací nyní dočasně odpojují pozdější závislé migrace uvnitř testovací transakce, aby i nadále ověřovaly skutečný down/up starších migrací bez oslabování kontrol.
- PHPUnit: **173 testů / 1361 assertions**; ověřeny i dosavadní výpůjčky, fondová integrita, historie opakovaných kontrol, důvody a zachování fyzické evidence při down/up. TypeScript kontrakty a kontrola diffu ověřeny samostatně. Poslední kompletní frontendové kontroly z kroku 6: Vitest **98 testů**, produkční build **444,60 kB**.
- **Blokující Q-21:** dokumentace neurčuje, zda u opakovaných protichůdných kontrol rozhoduje poslední nezrušená kontrola, nebo zda jedno starší fyzické ověření trvale plní pokrytí a novější nepřítomnost tvoří samostatnou nesrovnalost. Otázka odeslána uživateli; vyhodnocení a uzavření inventury nelze bezpečně dokončit bez této volby. Kroky 8–10 nezačaly.
- Ručně bude po dokončení API/UI potřeba ověřit celý průběh inventury, zejména zmrazení rozsahu po pohybu nebo změně skupiny a průběh s protichůdnými kontrolami. Tato etapa sama nemá ovladatelné UI. Migrována byla jen lokální testovací databáze; produkce, deploy a push neprovedeny.


### Pokračování kroku 7 po Q-21

Uživatel rozhodl Q-21 → D-63: fyzické ověření plní pokrytí, pozdější nepřítomnost tvoří samostatnou nesrovnalost. Q-22 → D-64: zásoby se vykazují samostatně, mimo procento ověřených kusů; jejich pozorování se nesčítají jako různé fyzické kusy.

- Etapa 2a dokončila vyhodnocení pokrytí, zmrazení rozsahu a uložení výsledku při uzavření. Filtry klasifikace a držitelů se kombinují průnikem. Rozdělení zásob mezi sklad, komplety a výpůjčky respektuje D-61; pozdější pohyby nemění zmrazené cíle.
- Historie kontrol zůstává zachovaná včetně zrušených kontrol. Úplné pokrytí neodstraní nesrovnalosti ani otevřené pracovní úkoly. Uzavření s nesrovnalostmi vyžaduje důvod; uložený výsledek pozdější změny evidence nepřepočítají.
- API endpointy a obrazovky ještě nejsou dokončené. Krok 7 zůstává rozpracovaný, kroky 8–10 nezačaly.
- PHPUnit: **190 testů / 1439 assertions**; `git diff --check` prošel. Ruční ověření zatím vyžaduje dokončení API a UI. Použita pouze lokální testovací databáze.

### Krok 7, etapa 2b – základní inventurní endpointy

- Náhled bez zápisu, založení se zmrazením rozsahu, seznam/detail a stránkované kolekce. Výslovné rozšíření vyžaduje poznámku; duplicity se odmítají atomicky. Rušení kontrol uchová historii.
- Zápisy mají fondové pověření, zámek a kontrolu verze, audit ve stejné transakci. Čisté uzavření odmítne neověřené cíle nebo nesrovnalosti; výslovné uzavření vyžaduje důvod. Čtení uzavřené inventury vrací uložený výsledek včetně kolekcí.
- PHPUnit: **196 testů / 1516 assertions**, TypeScript kontraktů a `git diff --check` prošly. Ověřeny i zamítnuté operace čtenáře, cizí fond, neplatné verze, duplicity a zápisy po uzavření. Zápisy kontrol, termíny/návštěvy a frontend ještě následují; žádné nasazení.

### Krok 7, etapa 2c – dávky fyzických kontrol

- Kontroly ve skladu, u lidí a v kompletu se sdílenou historií. Každý vstup vrací výsledek; opakované ověření vyžaduje výslovnou volbu. Číslo se hledá podle aktuální fyzické identity v již zmrazeném rozsahu.
- Zapůjčení a umístění mimo sklad se vracejí jako konflikty. Výslovné fyzické zjištění s poznámkou může překonat rozpor v evidovaném umístění, nikdy však skrytě nevrátí výpůjčku. Stav, přidělené množství, složení ani vyřazení se kontrolou automaticky nemění.
- Nová dopředná/vratná migrace uchová dobový kontext kontroly. Zásoby se samostatně porovnávají s aktuálně evidovaným množstvím příslušného kontextu; žádné pozorování nezvyšuje procento ověřených kusů.
- PHPUnit: **203 testů / 1576 assertions**, TypeScript kontraktů a `git diff --check` prošly. Testován i atomický rollback dávky, přečíslovaný kus, pozdější nepřítomnost, zapůjčená součást kompletu a nezměněné početní přidělení. Zbývají termíny/návštěvy, vazby běžných pohybů a frontend; krok 7 není dokončen.

### Krok 7, etapa 2d – termíny a návštěvy

- Fondově chráněné zakládání a částečné změny termínů/návštěv, kontrola časových pásem, kapacity a příslušnosti termínu do téže inventury. Kapacitu hlídá společný zámek inventury; zrušení rezervaci uvolní.
- Návštěvy jen pro držitele ze zmrazeného rozsahu. Dokončená nebo zrušená návštěva zůstává v historii, další návštěva je samostatná. Dokončení nezapisuje fyzické kontroly a opakované návštěvy nezvyšují počet odbavených osob.
- PHPUnit: **208 testů / 1631 assertions**, TypeScript kontraktů a `git diff --check` prošly. Ověřena i obsazená kapacita, neplatné časy, cizí termín, souběžná aktivní návštěva a neměnnost dokončené historie. Navazují vazby běžných pohybů a frontend.

### Krok 7, etapa 2e – návaznost běžných pohybů a práce

- Existující výdej/vrácení/výměna a založení pracovního úkolu podporují kontext otevřené inventury stejného fondu s verzí. Zachovány běžné validační a auditní operace; pohyb nezakládá fyzickou kontrolu ani tiše nemění rozsah.
- Rekapitulace pohybů a otevřených pracovních úkolů se při uzavření uloží do výsledku. Pozdější dokončení úkolu tento výsledek nezmění. Nové zápisy do uzavřeného kontextu, cizí fond a zastaralá verze jsou zamítnuty atomicky.
- Doplněn test skutečného souběžného databázového spojení. Inventura získává soubor sdílených zámků bez čekání a při probíhajícím zápisu vrátí opakovatelný konflikt `inventory_busy`; tím se zabrání deadlocku s běžnými pohyby. První fixture tohoto testu samo drželo zámky z předchozího náhledu v obalové testovací transakci; opraveno sestavení fixture, nikoli ověřované chování.
- PHPUnit: **214 testů / 1692 assertions**; TypeScript aplikace, testů a kontraktů i `git diff --check` prošly. Zbývá dokončit podklady pro výběr skupin a frontendové adaptéry, logiku a obrazovky. Krok 7 stále není dokončen, produkce ani deploy nebyly použity.

### Krok 7, etapa 2f – skupiny pro výběr rozsahu (D-48/D-51)

- Doplněna dosud chybějící správa skupin a jejich členství ve stávajícím Nastavení → Uživatelé a pověření, s HTTP/mock adaptéry a feature službou. Spravuje jen `organization.admin`; krojové pověření tuto správu nedává. Inventurní výběr dostává pouze ID/název/složku aktivních skupin.
- Překryvy členství se kontrolují pod zámkem skupiny. Odebrání uchová historii a projeví se ihned i pro členství založené dnes; nová vratná migrace proto přidává technické `revoked_at/by`, místo mazání nebo nepravdivého zpětného datování. Inventury už zmrazený rozsah nezmění. Jde o dokončení výslovně schválené potřeby skupin ve v1, bez nové hlavní nabídky či závislostí.
- PHPUnit: **217 testů / 1738 assertions**; Vitest **105 testů / 26 souborů**; TypeScript aplikace, testů a kontraktů; produkční build **455,14 kB** a `git diff --check` prošly. Testy pokrývají správu/odebrání/překryv, pověření, zachování rozsahu, HTTP cesty, mock historii a souběh frontendového načítání/zápisu.
- Ručně ověřit správu skupiny, opakované členství, archivaci a použití skupiny jiné složky (Muzika) pro inventuru oprávněného fondu. Inventurní frontend ještě následuje. Žádné produkční operace, deploy nebo push.

### Krok 7, etapa 3a – sdílená čistá frontendová logika

- Schválené `packages/domain/src` obsahuje parser čísel a projekci inventurního průběhu pro UI/mock. Připojeno TS aliasem bez nové npm závislosti. Autoritou pro integritu a uzavírání zůstává PHP.
- Parser zachová přesná čísla včetně nul a písmen, rozbalí číselné rozsahy a omezí dávku na 200 položek. Odmítá obrácené, nejednoznačně doplněné a příliš velké rozsahy. Opakování zachová pro odpověď serveru, nezkouší domýšlet chybějící čísla.
- Projekce D-63/D-64 odděluje pokrytí číslovaných součástek, komplety, zásoby, návštěvy a nesrovnalosti. Vitest: **110 testů / 27 souborů**; TypeScript aplikace/testů a `git diff --check` prošly. Navazují inventurní adaptéry a obrazovky.

### Krok 7, etapa 3b – zaměnitelné inventurní adaptéry

- Stávající `InventoryApi` má HTTP i mock operace náhledu, založení, kolekcí, explicitního rozsahu, kontrol, termínů, návštěv a uzavření. Mock sdílí stav i transakční frontu s fyzickou evidencí a výpůjčkami; odložené chybné operace vrátí celý stav včetně inventurních verzí a událostí.
- Mock podporuje D-63/D-64, samostatné početní kontexty D-61, konflikty skladu, zrušení kontroly, skupinový průnik a neměnné uzavřené výsledky. Syntetický registr zatím nemá příslušnosti osob ke složkám; filtr příslušnosti proto v mock datech vrací prázdný rozsah, žádná členství se nedomýšlejí. Skupiny se berou ze společného mock registru správy organizace.
- Kontext inventury je zapojen i do běžného mock výdeje, vrácení, výměny a pracovního úkolu; pohyby lze filtrovat podle inventury. Komponenty dále používají feature služby, nikoli HTTP.
- Vitest: **120 testů / 29 souborů**; TypeScript aplikace, testů a kontraktů a `git diff --check` prošly. Inventurní feature služba a obrazovky ještě nejsou hotové.

### Krok 7, etapa 3c – feature služba a kontext běžných operací

- `InventoriesStore` načítá stránky, metadata, náhled a všechny kolekce detailu. Ověřuje fond před čtením kolekcí, zahazuje pozdní odpovědi a při změně verze během čtení detail jednou znovu načte. Pověření a souběžné zápisy kontroluje před voláním adaptéru.
- Stávající formuláře výdeje/vrácení/výměny a nového pracovního úkolu podporují výslovný URL kontext inventury. Kontext se načte s pověřením a verzí; neplatný, cizí, právě načítaný či uzavřený kontext se nikdy tiše nevynechá. Po úspěšném navázaném zápisu se jeho verze posune. Přechod po výdeji/výměně kontext zachová; opuštění kontextu je výslovné.
- Vitest: **132 testů / 31 souborů**, TypeScript aplikace/testů, produkční build **475,24 kB** a `git diff --check` prošly. Testy zahrnují čtenáře, změnu fondu, souběh, nestabilní verzi při čtení a odmítnutí chybného kontextu. Původní komponentové fixture doplněny o novou závislost; navigační test nyní výslovně kontroluje zachování query kontextu.
- Inventurní hlavní obrazovky ještě následují; krok 7 není uzavřený. Žádné nasazení ani produkční data.

### Krok 7 – doplnění kontrol výdejů jiné složce (D-52)

- Při přípravě obrazovek odhalena mezera: samostatně půjčený kus držiteli typu složka nebylo možné fyzicky ověřit bez vrácení. Režim kontroly u držitele nyní přijímá právě osobu nebo složku, v souladu s existující identitou držitelů D-52. Nevzniká smyšlená osoba, návštěva, výpůjčka ani vrácení. Fondové pověření se nemění.
- PHP i mock zachovávají typ držitele v dobovém kontextu a odmítají kombinaci obou identit. Doplněny české popisky inventurních událostí v historii kusu.
- PHPUnit: **218 testů / 1748 assertions**; Vitest **133 testů / 31 souborů**; TypeScript testů a `git diff --check` prošly. Technické upřesnění existujícího D-52, nikoli nové produktové rozhodnutí. Hlavní inventurní obrazovky zůstávají rozpracované.
