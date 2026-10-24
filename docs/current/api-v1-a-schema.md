# API v1 a databázové schéma Krojařky

**Stav:** schváleno 2026-10-23 (D-57). Body kap. 7 rozhodnuty (D-48 až D-56). Implementace probíhá postupně; stav viz `03-stav-vyvoje.md`. Při implementaci se upřesňuje v malých krocích; změny rozsahu jdou do `decisions.md`.
**Vychází z:** `current/06` v0.5, `current/krojarka/frontend-demo-specifikace.md`, `current/identity-model-v2.md`, `current/hosting-postgresql-api-auth.md`, `current/monorepo-struktura.md` a rozhodnutí D-06 až D-47.

Značení:

- **[R]** = přímo z rozhodnutí nebo specifikace;
- **[N]** = můj návrh technického řešení;
- **[?]** = otevřené, rozhodnutí v kap. 7.

## 1. Rozsah v1

Krojařka v1 potřebuje:

- přihlášení a pověření;
- osoby a složky;
- katalog a řady;
- kusy, nečíslované zásoby a komplety;
- výpůjčky a pohyby;
- pracovní úkoly;
- inventury;
- přílohy (skeny, fotky);
- náklady na kroje;
- přehledy a hledání;
- audit.

**Mimo v1** (tabulky nevznikají, model jim nebrání):

- zastupování dítěte (`Representation`), funkce (`PositionAssignment`), formální členství a „přijatý člen“;
- dočasný příjem krojů od cizích organizací (06 kap. 6B, zadání Krojařky P2). **Výdej jiné složce ve v1 je** (D-52).
- akce, docházka a komunikace.

Model identity (D-07) se zavede postupně: v1 vytvoří `persons`, `user_accounts`, `units`, `unit_affiliations`, `groups`, `group_memberships` a `mandates`, zbytek přibude migracemi, až ho bude potřeba **[N]**. Skupiny jsou ve v1 kvůli rozsahu inventury (D-51).

## 2. Obecné konvence

### 2.1 Databáze (PostgreSQL 18) [N]

- Jedna instalace = jedna databáze (D-06). **Žádný sloupec `ensemble_id`** – rezerva z D-06 se řeší až při skutečném multi-tenant provozu.
- Primární klíče `bigint generated always as identity`. U příloh navíc neprůhledné `uuid` (`gen_random_uuid()`, vestavěné, bez rozšíření) pro URL.
- Čas `timestamptz` (session `SET TIME ZONE 'Europe/Prague'`), data bez času `date`. Peníze `numeric(10,2)`.
- **Stavy jako `text` + `CHECK`** (ne `enum`). Přidání stavu = malá migrace, která upraví `CHECK`, a úprava pravidel (k D-38).
- Rozšíření: `citext` (e-maily bez ohledu na velikost písmen), `unaccent` + `pg_trgm` (hledání jmen bez diakritiky). Jsou na hostingu dostupná (ověřeno 22. 10.), aktivuje je první migrace.
- `created_at`, `created_by` u hlavních tabulek. `version int` pro optimistické zamykání u entit, které upravují dvě krojařky současně (kus, komplet, inventura – zadání Krojařky S12).
- **Nic se nemaže fyzicky**, pokud na to existují historické vazby. Vyřazení, ukončení a archivace jsou stavy [R 06].

### 2.2 API [N]

- `https://api.vonica.cz/v1/…`, jen JSON. Sessions, CSRF, CORS a Origin podle D-12.
- Chyba: HTTP kód + `{"error": {"code": "item_already_loaned", "message": "…", "details": {…}}}`. Kódy jsou stabilní a frontend je překládá.
- `409 conflict` při nesouhlasu `version`; `422` při porušení doménového pravidla; `403` bez pověření; `404` i pro objekty mimo rozsah pověření (neprozrazovat existenci).
- Seznamy: `?limit=&offset=` + `total`, filtry jako query parametry, řazení `?sort=`. Data jsou malá (stovky kusů), kurzorové stránkování netřeba.
- **Rozsah pověření v URL:** agenda fondu je pod `/v1/funds/{unitId}/…`. Detail objektu má kanonickou adresu (`/v1/items/{id}`) a server ověří, že objekt patří do fondu s pověřením.
- CSV exporty přes `Accept: text/csv` u seznamových a přehledových endpointů.
- `GET /v1/health` → verze kódu a poslední migrace (pro deploy, D-45).

### 2.3 Autorizace [R D-09, D-10, D-21, D-36; N implementace]

| Pověření (`kind`) | Rozsah | Dává |
|---|---|---|
| `costumes.manage` | složka | zápis i čtení ve fondu složky; pomocnice mají totéž |
| `costumes.view` | složka (nebo celá organizace) | jen čtení fondu – audit |
| `costs.view` | organizace | čtení nákladů na kroje všech fondů **včetně kusů, ke kterým se náklad váže** (pokladník, D-23, D-49) |
| `organization.admin` | organizace | správa osob, skupin, účtů a pověření; **nedává** přístup do fondů (D-48) |

Pravidla:

- Krojařka jiné složky vidí **společné údaje osob** (jméno, přezdívka, příslušnost ke složkám a kontakt podle D-60), ne fondy, výpůjčky ani náklady [R D-21].
- Každé pravidlo se vyhodnocuje na serveru. Testy PHPUnit pokrývají ke každému endpointu i **zamítnuté** případy [R D-44].

## 3. Schéma

### 3.1 Identita a přístup

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `persons` | `first_name`, `last_name`, `nickname`, `contact`, `note`, `default_costume` (`male` / `female` / `unspecified`), `deceased_at` | fyzická osoba, i bez účtu a příslušnosti [R D-07]; výchozí kroj **jeden u osoby** [R D-34, D-38, D-50] |
| `user_accounts` | `person_id` **unique**, `login_email` citext unique (přihlášení e-mailem, D-53), `password_hash` (Argon2id), `status` (`invited` / `active` / `disabled`), `last_login_at` | 0..1 účet na osobu [R D-07] |
| `sessions` | `token_hash` unique, `account_id`, `csrf_token`, `created_at`, `last_seen_at`, `expires_at`, `user_agent` | [R D-12] |
| `login_attempts` | `login_email`, `ip`, `at`, `success` | rate limiting [R hosting kap. 6] |
| `password_reset_tokens` | `account_id`, `token_hash`, `created_at`, `expires_at`, `used_at` | obnova hesla odkazem e-mailem (D-49); token jednorázový, krátká platnost [N] |
| `groups` | `unit_id` (null = celá organizace), `name`, `archived_at` | skupiny osob (muzikanti, kluci, holky…) [R D-51] |
| `group_memberships` | `group_id`, `person_id`, `valid_from`, `valid_to` | jeden autoritativní vztah s historií [R identity-model-v2 kap. 4.1] |
| `units` | `name`, `short_name`, `has_costume_fund` bool, `archived_at` | složky úrovně 2 [R D-06]; muzika `has_costume_fund = false` [R D-21] |
| `unit_affiliations` | `person_id`, `unit_id`, `status` (`interested` / `active`), `valid_from`, `valid_to`, `end_reason` | historie příslušnosti [R D-07] |
| `mandates` | `person_id`, `kind`, `scope_type` (`organization` / `unit` / …), `scope_id`, `valid_from`, `valid_to`, `granted_by` | rozsahy podle D-10; v1 jen typy z kap. 2.3 |

### 3.2 Katalog a řady (vše patří fondu = `unit_id`)

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `costume_regions` | `unit_id`, `name`, `parent_id` | region → oblast (Slovensko → Zemplín, Moravské Lieskové) [R D-37] |
| `costume_part_types` | `unit_id`, `name`, `gender` (`male` / `female` / null = obojí), `region_id` (null = univerzální, např. měkké boty), `numbered` bool | druh součástky; seed z `krojovy-katalog-vonica.json` (`cislovano` → `numbered`) [R D-37] |
| `costume_series` | `unit_id`, `kind` (`part` / `kit`), `name`, `part_type_id` (u `part`), `region_id`, `gender`, `variant` (null = varianta jen atributem kusu), `allow_number_reuse` default **true** | řady součástek i kompletů [R D-20, D-35, D-37] |

Jedinečnost čísla [N]: částečný unikátní index `(series_id, number) WHERE retired_at IS NULL AND number IS NOT NULL`. Když řada opakované použití zakazuje, API odmítne i číslo vyřazeného kusu.

### 3.3 Kusy, nečíslované zásoby a komplety

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `costume_items` | `unit_id`, `series_id`, `number` (null = číslo zatím chybí), `variant`, `size`, `description`, `note`, `condition` (`ok` / `needs_adjustment` / `damaged`), `issuable` bool, `location` (`store` / `holder` / `seamstress` / `repair` / `unknown`), `location_note`, `acquired_on`, `kit_id` (určené složení), `retired_at`, `retired_by`, `retire_reason`, `version` | fyzický kus [R 06 kap. 3]; stav, vydatelnost, umístění a držitel jsou oddělené [R 06 kap. 3.2] |
| `costume_bulk_stocks` | `unit_id`, `part_type_id`, `variant`, `quantity_total`, `note` | nečíslované součásti podle druhu a počtu (kytička, korále, mašle), i mimo komplet [R D-35, D-37] |
| `costume_kits` | `unit_id`, `series_id` (`kind = kit`), `number`, `description`, `composition_state` (`unverified` / `complete` / `incomplete` / `pending_check`), `note`, `retired_at`, `version` | fyzický komplet s lístkem [R D-19, D-35] |
| `costume_kit_bulk_lines` | `kit_id`, `bulk_stock_id`, `required_qty`, `present_qty` | nečíslované doplňky v kompletu („1 ze 2“) [R 06 kap. 3.4] |
| `costume_kit_changes` | `kit_id`, `item_id` / `bulk_stock_id`, `change` (`added` / `removed` / `moved`), `qty`, `at`, `by`, `note` | historie složení [R 06 kap. 4.1] |

Odvozené údaje (nikde se neukládají):

- **dostupnost kusu** = vydatelný + bez otevřené výpůjčky + nevyřazený;
- **„chybí v kompletu“** = kus s `kit_id`, který je samostatně půjčený;
- **volné nečíslované kusy** = `quantity_total` − přidělené nebo dosud zapůjčené množství bez dvojího odečtu (D-61). Počty v kompletech zůstávají při jejich výpůjčce zachované; snímek předání se podruhé neodečítá. Samostatné výpůjčky se odečítají zvlášť. Změna složení nesmí uvolnit dosud nevrácené množství.

#### Implementační upřesnění kroku 4 (2026-10-24, etapa 1)

- Určené složení (`costume_items.kit_id`) samo neprokazuje přítomnost ani fyzickou kontrolu kusu. U početních řádků je `required_qty` požadované množství a `present_qty` evidované přidělené množství, ve výchozím stavu **0**. Opsaný lístek zůstává `unverified`; přidání řádků nemění automaticky stav složení.
- Početní řádky mají technické `id` a `unit_id`; historie složení také `unit_id`. Složené cizí klíče brání vazbám mezi fondy. Zásoba je jedinečná pro druh a variantu ve fondu (varianta bez ohledu na velikost písmen).
- Platí `0 <= present_qty <= required_qty`, `required_qty > 0`, `quantity_total >= 0`. Součet `present_qty` napříč komplety nepřesáhne celkovou zásobu; hlídá jej databáze i při změně celkové zásoby. Samotný požadavek zásobu nerezervuje.
- Číslo se ukládá jako text, může chybět (`null`), nesmí být prázdné. Nový kus má výchozí umístění `unknown`. Typ řady, číslovanost druhu, archivaci katalogu a zákaz opakovaného čísla bude ověřovat API v dalších etapách kroku 4.
- Etapa 1 nezavádí výpůjčky ani inventury a neodvozuje dostupnost či držitele. Uvedené vzorce dostupnosti a volných zásob jsou cílové pro krok 6; tehdy se doplní otevřené výpůjčky. `inventory_id` pracovního úkolu přibude spolu s inventurami.

### 3.4 Výpůjčky a pohyby

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `costume_loans` | `unit_id`, `holder_person_id`, `holder_unit_id` (výdej jiné složce, 06 kap. 6B), `kit_id` (výdej celého kompletu), `issued_at`, `issued_by`, `due_at` (null = dlouhodobé), `note`, `replaces_loan_id` (výměna) | hlavička předání; právě jeden z `holder_*` [R 06 kap. 5, 6A, 6B] |
| `costume_loan_lines` | `loan_id`, `item_id` **nebo** `bulk_stock_id` + `qty`, `returned_qty`, `closed_at`, `closed_by`, `close_type` (`returned` / `exchanged` / `settled`), `close_note`, `inventory_id` | **obsah předání v okamžiku výdeje**; vrácení a poznámka po řádcích [R 06 kap. 5.1b, 5.2] |

Integrita [N]:

- částečný unikátní index `costume_loan_lines(item_id) WHERE closed_at IS NULL` – **kus nemůže být u dvou lidí**;
- výdej, vrácení i výměna jsou v **jedné transakci**, včetně zápisu do `costume_item_events`.

Pohled **Výpůjčky = skladové pohyby od nejnovějších** [R D-22] se skládá z výdejů a uzavření řádků (endpoint v kap. 4.5).

#### Implementační upřesnění kroku 6 (2026-10-24, databáze a kontrakty)

- D-61: pro každou zásobu se sčítají samostatné otevřené výpůjčky a za každý komplet větší z jeho evidovaného přidělení a dosud nevráceného snímku výpůjčky. Překryv se odečítá jednou; pozdější odebrání ze složení neuvolní dosud předané množství. Výdej a vrácení nemění `present_qty` ani stav fyzického ověření.
- Tabulky řádků mají technické `unit_id` a složené cizí klíče chrání fondové vazby. Historie částečných vrácení v `costume_loan_returns` zachovává každé převzetí, počet, čas, autora a poznámku; souhrnné `returned_qty` je kumulativní.
- `inventory_id` přibude s krokem 7. Nová migrace nemění dřívější migrace ani nevytváří historické výpůjčky z dosavadního umístění kusů.
- Sdílené kontrakty výpůjček používají čas v ISO 8601 s časovým pásmem; `returnedQty` ve vstupu znamená počet převzatý právě nyní. `omitItemIds` při výdeji kompletu umožňuje výslovné vynechání kusu podle kap. 5.1b specifikace skladu. Volitelné `kitVersion` kontroluje verzi zobrazeného náhledu, `kitBulk[{stockId,qty}]` výslovně určuje skutečně předané počty (nejvýše evidované, nula nebo vynechání řádku znamená nepředat). Při výjimce je povinná poznámka.

### 3.5 Pracovní úkoly, historie, osoby ve fondu

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `costume_work_orders` | `item_id`, `type` (`adjustment` / `repair` / `resewing`), `description`, `assignee`, `due_on`, `status` (`open` / `in_progress` / `done` / `cancelled`), `inventory_id` | [R 06 kap. 5.5, D-38] |
| `costume_item_events` | `item_id`, `at`, `by`, `event` (`created` / `condition_changed` / `location_changed` / `issuable_changed` / `number_assigned` / `retired` …), `data jsonb` | odpověď na „kdy a kde byl kus naposledy“ [R 06 kap. 7.4] |
| `costume_holder_profiles` | `unit_id`, `person_id`, `paper_state` (`paper` / `migrating` / `digital`), `paper_checked_at`, `migrated_at`, `migrated_by`, `note` | stav převodu papírové karty a poznámka „má vlastní krpce“ – **po fondech** [R zadání K06–K07, D-38, D-40] |

### 3.6 Inventury

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `inventories` | `unit_id`, `name`, `scope jsonb` (filtry), `status` (`open` / `closed`), `started_at`, `started_by`, `closed_at`, `closed_by`, `closed_with_issues`, `close_reason`, `version` | [R 06 kap. 7] |
| `inventory_targets` | `inventory_id`, `item_id` / `kit_id` / `bulk_stock_id`, `holder_person_id` při zahájení, `added_explicitly`, `note` | zmrazený rozsah [R 06 kap. 7.1] |
| `inventory_slots` | `inventory_id`, `starts_at`, `ends_at`, `capacity` | samostatné termíny [R D-38] |
| `inventory_visits` | `inventory_id`, `person_id`, `slot_id`, `status` (`booked` / `in_progress` / `completed` / `cancelled`), `completed_at` | |
| `inventory_checks` | `inventory_id`, `target_id`, `mode` (`people` / `store` / `kit`), `result` (`presented` / `not_presented` / `found` / `not_found`), `condition`, `checked_qty` (nečíslované), `note`, `by`, `at`, `cancelled_at` | opakované kontroly zůstávají v historii, do pokrytí se cíl počítá jednou [R 06 kap. 7.4] |

Rozsah inventury ve v1: klasifikace (region, pohlaví, druh, varianta, řada) a volitelně **skupina držitelů** (06 kap. 7.1, „kroje muzikantů“) nebo příslušnost ke složce; kombinace = průnik [R D-51].

#### Implementační upřesnění kroku 7, etapa 1 – schéma a kontrakty

- Všechny fondové vazby mají technické `unit_id` a složené cizí klíče; kontrola i termín návštěvy patří do stejné inventury jako její cíl/návštěva. Opakovaná návštěva může vzniknout po dokončení předchozí, souběžně je aktivní nejvýše jedna návštěva osoby v inventuře.
- Cíle mají `snapshot` a `expected_qty`, u držitele také `holder_unit_id` pro D-52. Početní cíle mohou rozlišit `context_kit_id` a `loan_line_id`, aby bylo možné zmrazit přidělení a skutečně předané množství bez dvojího odečtu D-61. Jedinečnost cílů brání duplicitě stejného kusu či stejného početního kontextu.
- Uzavření má vlastní `result_snapshot`; dokončená návštěva má `completed_at`. Zrušení kontroly zachová původní řádek a přidá `cancelled_at/by`. Nové tabulky samy neprovádějí pohyby, neověřují dosavadní evidenci a nevyřazují nepřítomné kusy.
- Přidány volitelné vazby `inventory_id` u řádků výpůjček, jednotlivých vrácení a pracovních úkolů; databáze brání vazbě na jiný fond. Zapojení do API následuje až s inventurními operacemi.
- D-63 řeší Q-21: pokrytí plní alespoň jedna nezrušená fyzicky pozitivní kontrola. Pozdější nepřítomnost zůstává samostatnou nesrovnalostí a brání čistému uzavření i při úplném pokrytí.
- D-64 řeší Q-22: nečíslované zásoby se vykazují samostatně, mimo procento fyzicky ověřených kusů. U každého početního kontextu se uvádí očekávaný a zjištěný počet; pozorování se nesčítají jako různé fyzické kusy. Komplety mají vlastní ukazatel, aby obal nezvyšoval počet ověřených součástek.

### 3.7 Přílohy, náklady, audit

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `attachments` | `uuid`, `unit_id`, `owner_type` (`person` / `kit` / `series` / `item` / `inventory_check` / `archive`), `owner_id`, `kind` (`person_card` / `kit_card` / `kit_label` / `series_card` / `loan_book` / `loose_slip` / `item_photo` / `check_photo`), `storage_key`, `mime`, `size`, `sha256`, `page`, `caption`, `original_date`, `uploaded_by`, `uploaded_at`, `archived_at`, `purged_at` | soubor mimo webroot, stahování jen přes API [R zadání kap. 5.3]; po digitalizaci export do ZIP a `purged_at` [R D-40] |
| `costume_costs` | `unit_id`, `spent_on`, `amount`, `supplier`, `document_ref`, `description`, `purpose` (např. dotace na provoz), `created_by` | náklady na kroje pro pokladníka [R D-23] |
| `costume_cost_links` | `cost_id`, `item_id` / `bulk_stock_id` / `kit_id`, `qty` | volitelná vazba nákladu na pořízené kusy (soupis „pořízeno mezi daty“ [R D-39]) |
| `audit_log` | `at`, `actor_account_id`, `action`, `entity_type`, `entity_id`, `unit_id`, `data jsonb` | všechny zápisy API; čtení jen pro `organization.admin` a `costumes.view` v rozsahu [N] |

## 4. Endpointy v1

### 4.1 Přihlášení a účet

| Metoda a cesta | Účel |
|---|---|
| `POST /v1/auth/login` | e-mail + heslo → session cookie, odpověď s `csrfToken` |
| `POST /v1/auth/logout` | zrušení session |
| `GET /v1/auth/me` | účet, osoba, pověření a jejich rozsahy, `csrfToken` |
| `POST /v1/auth/password` | změna vlastního hesla |
| `POST /v1/auth/password-reset` | žádost o obnovu – odešle odkaz e-mailem; odpověď vždy stejná (neprozradí, zda účet existuje) [D-49] |
| `POST /v1/auth/password-reset/confirm` | nastavení nového hesla podle tokenu z odkazu |
| `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/{id}` | moje přihlášená zařízení [N, Můj účet] |

### 4.2 Organizace (`organization.admin`, D-48)

V Krojařce obrazovka **Nastavení → Uživatelé a pověření**.

`GET/POST /v1/persons`, `PATCH /v1/persons/{id}`, `GET/POST/PATCH /v1/units`, `POST /v1/persons/{id}/affiliations`, `GET/POST/PATCH /v1/groups`, `POST/DELETE /v1/groups/{id}/members`, `POST /v1/accounts` (založit účet a poslat pozvánku e-mailem), `POST /v1/accounts/{id}/disable`, `GET/POST/DELETE /v1/mandates`.

První účet se správou organizace vytvoří seed z `.env` při první migraci.

### 4.3 Osoby pro krojařky

| Metoda a cesta | Účel |
|---|---|
| `GET /v1/people?q=&unit=&hasLoans=&paperState=` | **Lidé**: seznam osob (jméno, přezdívka, příslušnosti); údaje fondu jen pro fondy s pověřením |
| `PATCH /v1/people/{id}` | úprava základní identity, společného kontaktu a výchozího kroje krojařkou (K04, D-50, D-60); nikoli globální poznámky |
| `POST /v1/people` | rychlé založení osoby krojařkou (externista, nová osoba) s upozorněním na možné duplicity [R zadání K04] |
| `GET /v1/funds/{u}/people/{id}/card` | **Krojová karta**: otevřené výpůjčky, historie, profil fondu |
| `PUT /v1/funds/{u}/people/{id}/profile` | stav papírové karty, převod, poznámka |

#### Implementace kroku 5 (2026-10-24)

- `GET /v1/people` vyžaduje platný přístup k alespoň jednomu aktivnímu fondu. Kontakty jsou společné pro `costumes.manage` (D-60); čtenářům se vrací `contact=null, contactVisible=false`. Účet, pověření a společná organizační poznámka osoby se nikdy nevrací.
- Stránkování je `limit` 1–200 (výchozí 50), `offset` od 0; hledání jména/přezdívky bez diakritiky, `unit` vybírá současnou příslušnost. `fund` výslovně určuje autorizovaný fond pro `profile` a filtr `paperState`. Bez zadaného fondu se soukromé profily nevracejí; neexistující profil je `null`, nikoli automaticky „papírový“.
- Založení shodného jména vrací 422 `possible_duplicate` se seznamem kandidátů; `confirmDuplicate=true` výslovně založí jinou identitu. Nevzniká účet ani příslušnost. Krojová poznámka se ukládá jen přes profil fondu, nikoli přes společnou osobu.
- `defaultCostume` je jediný u osoby (D-50). PATCH společných údajů vyžaduje `costumes.manage` některého aktivního fondu; samotné `organization.admin` nemá přístup k těmto krojovým endpointům a používá vlastní správu osob.
- PUT profilu přijímá `paperState` a `note`; první přechod na `digital` zaznamená `migrated_at/by`. Nejde o fyzické ověření; `paper_checked_at` zůstává bez automatické hodnoty a nesmí se zaslat z klienta. Zápis profilu i audit jsou atomické.
- Karta v kroku 5 obsahuje společnou identitu a profil konkrétního fondu. Výpůjčky, jejich historie a filtr `hasLoans` navazují v kroku 6; do té doby se nevytvářejí smyšlené údaje a filtr je výslovně odmítnut.

### 4.4 Katalog, kusy, komplety (pod `/v1/funds/{u}`)

| Metoda a cesta | Účel |
|---|---|
| `GET/POST/PATCH …/regions`, `…/part-types`, `…/series` | Nastavení – katalog a řady |
| `GET …/items?series=&q=&available=&holder=&condition=&location=&acquiredFrom=&acquiredTo=` | **Součástky** (i filtrované dotazy D-39) |
| `POST …/items`, `GET/PATCH /v1/items/{id}`, `POST /v1/items/{id}/retire` | kus |
| `GET /v1/items/{id}/history` | současný a historický držitel, pohyby, kontroly („kdo měl košili č. 3“) [R D-39] |
| `GET/POST …/bulk-stocks`, `PATCH /v1/bulk-stocks/{id}` | nečíslované zásoby |
| `GET/POST …/kits`, `GET/PATCH /v1/kits/{id}` | komplety |
| `POST /v1/kits/{id}/composition` | přidat, odebrat nebo přesunout kus či počet nečíslovaných |
| `GET/POST /v1/items/{id}/work-orders`, `PATCH /v1/work-orders/{id}` | pracovní úkoly; `GET …/work-orders?status=open` souhrn |

#### Implementované API kusů – krok 4, etapa 2 (2026-10-24)

- Vstup a odpověď odpovídají `ItemInput`, `CostumeItem`, `ItemPatch` a `ItemRetireInput` v `packages/api-contracts/src/inventory.ts`. Číslo i textová pole se ořezávají; prázdná volitelná pole se normalizují na `null`. Datum je `YYYY-MM-DD` a musí existovat v kalendáři. Výchozí umístění je `unknown`; držitel ani dostupnost se zatím nevrací.
- Seznam standardně vrací aktivní kusy; `retired=true` vybere vyřazené. `limit` je 1–200 (výchozí 50), `offset` nezáporný (výchozí 0). `sort` podporuje `series`, `number`, `acquiredOn`, `id` a stejné hodnoty s předponou `-`; výchozí je řada a číslo. Číslo se řadí jako text; shodu rozhoduje interní ID. Hledání zahrnuje název řady, číslo, variantu, popis a poznámku, bez diakritiky; znaky `%` a `_` ve vstupu jsou doslovné.
- `available` a `holder` v etapě 2 vracejí 422 `validation_failed` (`reason=not_allowed`), protože výpůjčky ještě nejsou implementované. Neznámé query parametry a nepovolená pole těla jsou také odmítnuty. Filtry stavu a umístění se nemíchají s odpovědností držitele.
- PATCH a vyřazení vyžadují aktuální `version`; neplatná verze vrací 409 `version_conflict`. Vyřazení vyžaduje neprázdný `reason`. Vyřazený kus nelze měnit (422 `item_retired`). Duplicita čísla v řadě vrací 422 `number_already_used`; při zákazu znovupoužití se kontroluje celá historie kusů.
- Archivované katalogové údaje nebrání čtení a opravě ostatních údajů existujícího kusu; založení či změna řady nebo čísla vyžadují aktivní řadu, číslovaný druh a aktivní regiony. Druh s existujícími kusy nelze přepnout na nečíslovaný, včetně kusů vyřazených nebo zatím bez čísla.
- `/items/{id}/history` vrací stránkované `{items, total}` (stejné `limit`, `offset`) s událostmi kusu od nejnovější. Založení ukládá počáteční údaje, změny ukládají původní i novou hodnotu a vyřazení důvod. Výpůjčky, pohyby a kontroly se doplní v příslušných krocích; zatím se nevytvářejí. Audit je transakčně spojený se zápisem i událostmi.

#### Dokončení kroku 4 – zásoby, komplety a pracovní úkoly (2026-10-24)

- Nečíslované zásoby mají seznam s `limit/offset`, založení a PATCH; typ je neměnný. Odpověď obsahuje `quantityTotal` a `quantityInKits`. `duplicate_stock` značí duplicitu druhu/varianty, `insufficient_stock` porušení množství. Používaný druh nelze změnit na číslovaný.
- Komplety mají stránkovaný seznam s `series/q`, založení, PATCH s `version` a detail `KitDetail` včetně určených kusů, početních řádků a `changes`.
- Složení používá diskriminované `CompositionInput`: `add/remove/move`, `version`, právě jeden z `itemId + itemVersion` nebo `bulkStockId`; přesun navíc `targetKitId + targetVersion`. U doplňků `add` přičítá `requiredQty/presentQty`. `remove` bez počtů odebírá celý řádek, s oběma počty odebírá část. `move` přesouvá oba zadané počty; zbylý řádek musí zůstat konzistentní. Přesun zaznamená historii i audit u obou kompletů. Při chybě se vrací zpět celý zápis.
- Po změně složení zůstává `unverified`; ostatní stavy se mění na `pending_check`. Stav lze výslovně upravit přes PATCH, ale nevzniká tím inventurní kontrola ani ověření jednotlivých kusů. U číslovaných součástí se přítomnost z příslušnosti ke kompletu neodvozuje.
- Pracovní úkoly mají endpointy z kap. 4.4 včetně souhrnu fondu s filtrem `status` a stránkováním. Nový úkol je `open`, existující úkol vyřazeného kusu lze dokončit či zrušit. Úkol nemění automaticky stav, vydatelnost ani fyzické umístění kusu; jeho změny jsou v auditu i historii kusu.
- Kontrakty jsou v `packages/api-contracts/src/inventory.ts`; fyzické kontroly, výpůjčky a jejich vazby přibudou v příslušných krocích.

### 4.5 Výpůjčky

| Metoda a cesta | Účel |
|---|---|
| `GET …/movements?person=&item=&kit=&from=&to=` | **Výpůjčky** = skladové pohyby od nejnovějších |
| `GET …/loans?open=&overdue=&holderType=external` | otevřené a po termínu, zapůjčené externistům |
| `POST …/loans` | výdej: držitel, `items[]`, `bulk[{stockId, qty}]`, nebo `kitId` (server vynechá kusy půjčené jinde a vrátí je v odpovědi jako vynechané), `dueAt`, `note` |
| `POST /v1/loans/{id}/return` | vrácení po řádcích: `lines[{lineId, returnedQty, closeType, note, condition, issuable, location}]` |
| `POST /v1/loans/{id}/exchange` | výměna kusu za jiný dostupný kus v jedné transakci |
| `PATCH /v1/loans/{id}` | termín vrácení, poznámka |
| `GET /v1/loans/{id}` | detail snímku výdeje a historie jednotlivých vrácení v oprávněném fondu |

Implementační upřesnění kroku 6, část API:

- Držitel ve vstupu i odpovědi je právě `{personId}` nebo `{unitId}`. Samotný výdej nezakládá členství, účet ani profil papírové karty. Seznam výpůjček podporuje také filtry `person` a `kit`.
- Výdej kompletu vrací `omittedItemIds`; nevydatelné, vyřazené nebo již půjčené kusy nepředává. Při vynechání kusu nebo známé neúplnosti vyžaduje poznámku (D-38). Určené složení ani stav fyzického ověření se nemění.
- Vracení přijímá skutečně převzaté množství a `closeType=returned`, nebo vypořádání ztrátou `settled` podle D-62 s povinným důvodem. `exchanged` vzniká pouze atomickou výměnou (`lineId`, nový `itemId`, nepovinně poznámka a stav převzatého kusu). Při ztrátě se vyřadí nevrácený kus nebo sníží zásoba i přidělení v původním kompletu; snímek a požadované složení zůstávají. Historie vrácení i pohyby vracejí také `lostQty`.
- Přehled zásob přidává `quantityReserved` a `quantityAvailable`; rezervované množství zahrnuje přidělení i výpůjčky bez dvojího odečtu (D-61). Historie pohybů obsahuje i každé částečné vrácení. Řazení je od nejnovějších, stránkování používá `limit` a `offset` podle kap. 2.
- Stabilní chyby: `item_unavailable`, `kit_unavailable`, `loan_line_closed`, `insufficient_stock`. Všechny zápisy včetně vlastních událostí a auditu jsou atomické. Kusy vracejí `loanId`, `loanKitId`, `available` a `holder` (právě `{personId}` nebo `{unitId}`, jinak null); podporují filtry `available=true|false` a `holder` jako ID osoby. Karta vrací `openLoans` a `movements` jako první stránky po 50 řádcích, další stránky poskytují seznamové endpointy. Komplet vrací aktuální `loanId` a `holder`; `loanKitId` u kusu umožňuje odlišit předání v kompletu od jiného předání. Řádky výpůjčky mají čitelný `label`, `region` a `gender` odvozené z aktuálního katalogu pro seskupení karty (identita a množství snímku zůstávají neměnné). Filtr osob `hasLoans=true|false` vyžaduje výslovný oprávněný `fund`. Frontend kroku 6 je implementovaný s HTTP/mock adaptéry: výdej, vrácení, ztráty, výměna, pohyby, dostupnost a fondové krojové karty.

### 4.6 Inventury

| Metoda a cesta | Účel |
|---|---|
| `POST …/inventories/preview` | náhled rozsahu (počty kusů, držitelů, nezapůjčených) |
| `GET/POST …/inventories`, `GET /v1/inventories/{id}` | seznam, založení se zmrazením rozsahu, detail s průběhem |
| `POST /v1/inventories/{id}/targets` | výslovné přidání kusu s poznámkou |
| `GET/POST/PATCH /v1/inventories/{id}/slots`, `…/visits` | termíny a návštěvy |
| `POST /v1/inventories/{id}/checks` | dávka kontrol; čísla „1, 3, 12-15“ rozbalí klient (`packages/domain`), server ke každé položce vrátí výsledek (`ok` / `already_checked` / `unknown_number` / `loaned_to` / `not_in_store`) |
| `DELETE /v1/inventory-checks/{id}` | zrušení omylem zapsané kontroly |
| `GET /v1/inventories/{id}/issues`, `POST /v1/inventories/{id}/close` | nesrovnalosti; uzavření (s nesrovnalostmi jen s důvodem) |

Implementováno v kroku 7, etapy 2b–2c: fondový náhled/založení/seznam, detail s `progress`, stránkované čtení `targets`, `checks`, `issues`, `slots`, `visits`, výslovné přidání cíle, dávky kontrol, zrušení kontroly a uzavření. Zápisy vyžadují `costumes.manage`, zámek hlavičky a aktuální `version`; zrušení kontroly předává verzi v query. Čtenář `costumes.view` může výsledky číst, cizí fond dostává 404. Náhled nezapisuje. Uzavřené kolekce i ukazatele se čtou z uloženého výsledku. Správa termínů/návštěv následuje v další části etapy.

- Dávka má `mode`, pro lidi `personId`, pro komplet `kitId`, a nejvýše 200 `entries`. Položka určí `targetId`, nebo aktuální `seriesId` + `number`; přečíslování nesmí potvrdit jinou fyzickou identitu ani rozšířit zmrazený rozsah. Výsledek je `presented/not_presented` u lidí, jinak `found/not_found`. Zásoby vyžadují `checkedQty`; žádná kontrola sama nemění jejich celkový či přidělený počet.
- Opakované kladné ověření vyžaduje `recheck=true`; záporné zjištění lze zapsat i po ověření (D-63). Zapůjčený kus ve skladové dávce vrací `loaned_to` bez vrácení. Zaznamenané umístění mimo sklad vrací `not_in_store`; výslovné `confirmConflict=true` s poznámkou dovolí zapsat fyzické zjištění a zachová původní umístění. Kontrola kompletu nevrací samostatně zapůjčený kus ani nepotvrzuje úplnost opsaného lístku.
- Vratná migrace přidává kontrolám `context` s dobovým držitelem/umístěním, osobou či kompletem kontroly a u zásob evidovaným množstvím daného kontextu v okamžiku porovnání. Nejde o součet identifikovaných kusů ani o povinnou opakovanou kontrolu po každém pohybu (D-64). Zrušení i fyzická kontrola kusu mají také vlastní událost v historii kusu.

### 4.7 Přílohy, náklady, přehledy, hledání

| Metoda a cesta | Účel |
|---|---|
| `POST /v1/attachments` (multipart), `GET /v1/attachments?ownerType=&ownerId=`, `GET/PATCH /v1/attachments/{uuid}`, `GET /v1/attachments/{uuid}/content`, `…/thumbnail`, `POST /v1/attachments/{uuid}/archive` | podle zadání Krojařky kap. 5.3 |
| `POST …/attachments/export` | ZIP skenů k uložení do digiarchivu, potom `purge` [R D-40] |
| `GET/POST …/costs`, `PATCH /v1/costs/{id}` | náklady na kroje |
| `GET …/reports/series/{seriesId}`, `…/reports/person/{personId}`, `…/reports/item/{itemId}` | soupisy podle řady, člověka a součástky; CSV přes `Accept` [R D-39] |
| `GET /v1/search?q=` | osoby, komplety, „řada + číslo“ (např. „kopanická košile 17“) jen ve fondech s pověřením |

## 5. Rozdělení odpovědnosti frontend × API [R D-15, monorepo kap. 2]

- **API:** veškerá pravidla z `06` (dostupnost, kus u jednoho držitele, zmrazení rozsahu, uzavření inventury, opakované číslo), transakce, audit, filtrování podle pověření, soubory.
- **`packages/api-contracts`:** TS typy požadavků a odpovědí z kap. 4 a chybové kódy.
- **`packages/domain`:** parser čísel, formát „řada + číslo“, popisky stavů, odvozené pohledy pro okamžité UI. **Není autoritou.**
- **Krojařka:** obrazovky, stav formulářů, mock adaptér se stejným rozhraním pro vývoj bez serveru.

## 6. Pořadí implementace (malé ověřitelné kroky)

1. **Kostra:**
   - monorepo (npm workspaces, Node 24);
   - `api/` s Composerem, routerem, `health`, CORS/CSRF/sessions a PHPUnit;
   - Phinx s první migrací (identita a přístup);
   - Docker služba `api`.
2. **Přihlášení:**
   - `auth/*` včetně obnovy hesla e-mailem (PHPMailer, SMTP `smtp.websupport.cz`, D-55, D-56);
   - první účet se správou organizace (seed);
   - kostra Krojařky (Angular 22, layout a menu podle D-22, přihlášení);
   - nasazení `api` a `krojarka` (rozšířit deploy skript o cíle `api` a `krojarka`).
3. **Katalog a řady:** seed z JSON, Nastavení.
4. **Součástky:** kusy, nečíslované zásoby, komplety.
5. **Lidé a krojové karty.**
6. **Výpůjčky a pohyby**, včetně výdeje kompletu a vrácení po řádcích.
7. **Inventury** (Ve skladu → Podle lidí → Komplety).
8. **Přílohy a převod papírových karet.**
9. **Přehledy a hledání.**
10. **Náklady na kroje.**

Každý krok má testy API (včetně zamítnutých operací) a je nasaditelný samostatně.

## 7. Rozhodnuto 2026-10-23

1. **Účty a pověření** spravuje pověření `organization.admin` v Krojařce (Nastavení → Uživatelé a pověření); první účet vytvoří seed (D-48).
2. **Zapomenuté heslo:** hned odkaz e-mailem (D-49). Odesílání přes SMTP Websupportu je ověřené v projektu Katerinských hodů (`smtp.websupport.cz`, s náhradou přes PHP `mail()`). [?] Z jaké schránky se bude posílat (např. `krojarka@vonica.cz`)? Rozhodnuto: schránka `krojarka@vonica.cz` (D-55), knihovna **PHPMailer** (D-56).
3. **Pokladník** čte náklady všech fondů i kusy, ke kterým se váží (D-49).
4. **Výchozí kroj** je jeden u osoby (D-50).
5. **Skupiny už ve v1** kvůli rozsahu inventury (D-51).
6. **Výdej jiné složce už ve v1** (D-52).
7. **Přihlášení e-mailem** (D-53).
8. **Úložiště příloh a konfigurace** – vlastní kořenový adresář `api` = `/vonica.cz/sub/api/public`, nastaveno a ověřeno 2026-10-23 (D-54, kap. 8).

## 8. Rozložení `api` na hostingu [ověřeno 2026-10-23, D-54]

```text
/vonica.cz/sub/api/          ← kořen SFTP účtu API (dnes zároveň webroot)
├── public/                  ← nový webroot (Vlastní kořenový adresář v administraci)
│   ├── index.php
│   └── .htaccess
├── src/, vendor/            ← kód, mimo web
├── config/config.php        ← DB, SMTP, klíče; nahrává se jednou, deploy ho nepřepisuje
└── storage/attachments/     ← soubory příloh, stahují se jen přes API
```

Ověřeno testem (dočasné soubory, po testu odstraněny):

- webroot je `public/`; prázdný vrací 403;
- soubory v nadřazeném adresáři, `config/`, `storage/` i pokus `/../` vracejí 404;
- PHP z `public/` čte `../config` a zapisuje, čte i maže v `../storage` (soubory 0644);
- `display_errors` je vypnuté.

Pravidla pro deploy (D-45):

- nahrává jen `public/`, `src/` a `vendor/`;
- `config/` se nahrává jednou ručně a nepřepisuje se;
- `storage/` se nikdy nemaže;
- API si `display_errors=0` nastavuje samo. Soubory `.user.ini` a `.htaccess`, které generuje administrace, leží v nadřazeném adresáři a pro `public/` neplatí.
- Výchozí `index.php` poskytovatele v nadřazeném adresáři už není z webu dostupná; při prvním nasazení ji lze smazat.
