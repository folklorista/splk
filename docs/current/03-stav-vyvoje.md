# Stav vývoje

Co je hotové a co se právě dělá. Pořadí vývoje určuje [`../decisions.md`](../decisions.md) D-02. Historický deník do 19. 10. 2026 je v [`../archive/03-postup-vyvoje.md`](../archive/03-postup-vyvoje.md).

## Stav k 2026-10-24

| Část | Stav |
|---|---|
| **Krojařka** (`krojarka.vonica.cz`) | Krok 2: kostra v `apps/krojarka` (Angular 22.2, zoneless, Vitest): boční menu podle D-22 (sekce zatím jako zástupné stránky), přihlášení, zapomenuté heslo, nastavení hesla z odkazu, Můj účet (pověření, změna hesla, přihlášená zařízení, odhlášení). Datová vrstva `data/` s HTTP a mock adaptérem (`npm run krojarka:start:mock`), interceptory podle hosting doc kap. 8. Trasy česky (`/prihlaseni`, `/lide`, `/soucastky`…). Nasazeno 2026-10-24 jako `feature/api-skeleton@62b8310`. Krok 3 (nasazeno 2026-10-24 jako `908001d`): výběr krojového fondu v menu, Nastavení → Katalog (regiony a oblasti, druhy součástek), Evidenční řady (součástek i kompletů), Uživatelé a pověření (D-59). Krok 4 dokončen lokálně: Součástky podle řad, kusy, zásoby, komplety, složení, historie a pracovní úkoly s HTTP/mock adaptéry; zatím nenasazeno. Krok 5 dokončen lokálně: Lidé, společné kontakty (D-60), fondové profily krojových karet; bez výpůjček. |
| **API** (`api.vonica.cz`) | Kroky 1–2 ve větvi `feature/api-skeleton`: kostra (router, `GET /v1/health`, CORS/origin/JSON, sessions v PostgreSQL, CSRF), migrace identity a přístupu, `auth/*` podle kap. 4.1 (přihlášení s omezením pokusů, odhlášení, `me`, změna hesla, obnova hesla e-mailem přes PHPMailer, přihlášená zařízení), seed prvního účtu `organization.admin` (pozvaný, heslo si nastaví odkazem). Testy PHPUnit (Unit + Integration). Nasazeno 2026-10-24 jako `feature/api-skeleton@62b8310`: `config/config.php` z `.env`, migrace `CreateIdentityAndAccess` (záloha před migrací v `dev/local/backups/`), pozvaný účet `organization.admin`. Krok 3 (nasazeno 2026-10-24 jako `908001d`, se seedy `VonicaUnits` a `VonicaCatalog`): migrace `CreateCatalogAndAudit` (regiony, druhy, řady, `audit_log`, `mandates.revoked_at`), katalog `/v1/funds/{u}/regions\|part-types\|series` s kontrolou pověření (404 mimo rozsah, 403 jen pro čtení), správa organizace (`/v1/persons`, `/v1/accounts`, `/v1/mandates`, `/v1/units`), audit všech zápisů, seedy `VonicaUnits` a `VonicaCatalog`. Krok 4 dokončen lokálně: migrace fyzické evidence, API kusů, zásob, kompletů, složení a pracovních úkolů; zatím nenasazeno. Krok 5 dokončen lokálně: Lidé, společné kontakty (D-60), fondové profily krojových karet; bez výpůjček. |
| **Demo** (`demo.vonica.cz`) | Prototyp nasazený jako `design/identity-03@ce20f01`. Přesun z `moje` dokončen 22. 10. 2026. Nasazení: `/deploy` (`--target demo`). Popis kódu: `../archive/implementace-2026-10-21/`. |
| **moje.vonica.cz** | Vývoj odložen. Po přesunu dema prázdná, vyhrazená budoucí členské aplikaci. |
| Monorepo | npm workspaces `apps/*`, `packages/*`, Node ≥ 24 (`.nvmrc`). `packages/api-contracts` (DTO a chybové kódy auth) – první sdílený balíček. Deploy: `npm run deploy -- --target api\|krojarka` (`scripts/deploy-app.mjs`). Kroky 4 a 5 dokončeny lokálně; Q-19 rozhodnuta → D-61, krok 6 rozpracován. |

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

## Krok 6 – rozpracováno po rozhodnutí Q-19

Uživatel rozhodl Q-19 → D-61: počet doplňků v kompletu při výpůjčce zachovat a zabránit dvojímu odečtu. Navazuje migrace a API výpůjček, potom adaptéry a obrazovky. Krok 6 zatím není dokončen.

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
