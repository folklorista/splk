# Návrh: API v1 a databázové schéma Krojařky

**Stav:** návrh ke schválení, 2026-10-23 (zbytek Q-10). Nic zatím není implementováno.
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

- skupiny a členství ve skupinách;
- zastupování dítěte (`Representation`), funkce (`PositionAssignment`), formální členství a „přijatý člen“;
- dočasný příjem krojů od cizích organizací (06 kap. 6B, zadání Krojařky P2);
- akce, docházka a komunikace.

Model identity (D-07) se zavede postupně: v1 vytvoří `persons`, `user_accounts`, `units`, `unit_affiliations` a `mandates`, zbytek přibude migracemi, až ho bude potřeba **[N]**.

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
| `costs.view` [?] | organizace | čtení nákladů na kroje všech fondů (pokladník, D-23) |
| `organization.admin` [?] | organizace | správa osob, účtů a pověření; **nedává** přístup do fondů |

Pravidla:

- Krojařka jiné složky vidí jen **seznam osob** (jméno, přezdívka, příslušnost ke složkám), ne fondy, výpůjčky ani náklady [R D-21].
- Každé pravidlo se vyhodnocuje na serveru. Testy PHPUnit pokrývají ke každému endpointu i **zamítnuté** případy [R D-44].

## 3. Schéma

### 3.1 Identita a přístup

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `persons` | `first_name`, `last_name`, `nickname`, `contact`, `note`, `default_costume` (`male` / `female` / `unspecified`), `deceased_at` | fyzická osoba, i bez účtu a příslušnosti [R D-07]; výchozí kroj [R D-34, D-38] – [?] u osoby, nebo zvlášť po fondech |
| `user_accounts` | `person_id` **unique**, `login_email` citext unique, `password_hash` (Argon2id), `status` (`invited` / `active` / `disabled`), `last_login_at` | 0..1 účet na osobu [R D-07] |
| `sessions` | `token_hash` unique, `account_id`, `csrf_token`, `created_at`, `last_seen_at`, `expires_at`, `user_agent` | [R D-12] |
| `login_attempts` | `login_email`, `ip`, `at`, `success` | rate limiting [R hosting kap. 6] |
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
- **volné nečíslované kusy** = `quantity_total` − počty v kompletech − otevřené výpůjčky.

### 3.4 Výpůjčky a pohyby

| Tabulka | Klíčové sloupce | Poznámka |
|---|---|---|
| `costume_loans` | `unit_id`, `holder_person_id`, `holder_unit_id` (výdej jiné složce, 06 kap. 6B), `kit_id` (výdej celého kompletu), `issued_at`, `issued_by`, `due_at` (null = dlouhodobé), `note`, `replaces_loan_id` (výměna) | hlavička předání; právě jeden z `holder_*` [R 06 kap. 5, 6A, 6B] |
| `costume_loan_lines` | `loan_id`, `item_id` **nebo** `bulk_stock_id` + `qty`, `returned_qty`, `closed_at`, `closed_by`, `close_type` (`returned` / `exchanged` / `settled`), `close_note`, `inventory_id` | **obsah předání v okamžiku výdeje**; vrácení a poznámka po řádcích [R 06 kap. 5.1b, 5.2] |

Integrita [N]:

- částečný unikátní index `costume_loan_lines(item_id) WHERE closed_at IS NULL` – **kus nemůže být u dvou lidí**;
- výdej, vrácení i výměna jsou v **jedné transakci**, včetně zápisu do `costume_item_events`.

Pohled **Výpůjčky = skladové pohyby od nejnovějších** [R D-22] se skládá z výdejů a uzavření řádků (endpoint v kap. 4.5).

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

Rozsah inventury v v1 [?]: klasifikace (region, pohlaví, druh, varianta, řada) a volitelně **příslušnost držitelů ke složce**. Filtr podle skupiny (06 kap. 7.1, „kroje muzikantů“) vyžaduje skupiny, které v1 nemá.

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
| `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/{id}` | moje přihlášená zařízení [N, Můj účet] |

### 4.2 Organizace (`organization.admin`) [?]

`GET/POST /v1/persons`, `PATCH /v1/persons/{id}`, `GET/POST/PATCH /v1/units`, `POST /v1/persons/{id}/affiliations`, `POST /v1/accounts` (založit účet a dočasné heslo), `POST /v1/accounts/{id}/reset-password`, `GET/POST/DELETE /v1/mandates`.

### 4.3 Osoby pro krojařky

| Metoda a cesta | Účel |
|---|---|
| `GET /v1/people?q=&unit=&hasLoans=&paperState=` | **Lidé**: seznam osob (jméno, přezdívka, příslušnosti); údaje fondu jen pro fondy s pověřením |
| `POST /v1/people` | rychlé založení osoby krojařkou (externista, nová osoba) s upozorněním na možné duplicity [R zadání K04] |
| `GET /v1/funds/{u}/people/{id}/card` | **Krojová karta**: otevřené výpůjčky, historie, profil fondu |
| `PUT /v1/funds/{u}/people/{id}/profile` | stav papírové karty, převod, poznámka |

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

### 4.5 Výpůjčky

| Metoda a cesta | Účel |
|---|---|
| `GET …/movements?person=&item=&kit=&from=&to=` | **Výpůjčky** = skladové pohyby od nejnovějších |
| `GET …/loans?open=&overdue=&holderType=external` | otevřené a po termínu, zapůjčené externistům |
| `POST …/loans` | výdej: držitel, `items[]`, `bulk[{stockId, qty}]`, nebo `kitId` (server vynechá kusy půjčené jinde a vrátí je v odpovědi jako vynechané), `dueAt`, `note` |
| `POST /v1/loans/{id}/return` | vrácení po řádcích: `lines[{lineId, returnedQty, closeType, note, condition, issuable, location}]` |
| `POST /v1/loans/{id}/exchange` | výměna kusu za jiný dostupný kus v jedné transakci |
| `PATCH /v1/loans/{id}` | termín vrácení, poznámka |

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
   - `auth/*`;
   - první administrátorský účet (Q v kap. 7);
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

## 7. Otevřené k rozhodnutí

1. **Správa účtů a pověření v Krojařce v1.** Kdo zakládá účty krojařek a přiděluje pověření, když Správa (`moje`) neexistuje? Návrh: pověření `organization.admin` a jednoduchá obrazovka **Nastavení → Uživatelé a pověření** v Krojařce; první účet vytvoří migrace nebo seed z `.env`.
2. **Zapomenuté heslo.** V1 jen reset správcem (dočasné heslo), nebo hned e-mailový odkaz? E-mail z hostingu zatím neověřen.
3. **Přístup pokladníka k nákladům** (`costs.view` v rozsahu organizace) – potvrdit; má pokladník vidět i kusy, ke kterým se náklad váže?
4. **Výchozí kroj** u osoby (jeden pro celou organizaci), nebo po fondech?
5. **Rozsah inventury podle skupin** – v1 bez skupin (jen klasifikace a příslušnost ke složce), nebo zavést skupiny už teď?
6. **Výdej jiné složce** (`holder_unit_id`, 06 kap. 6B, příklad 10 kompletů z Malé Vonice) – už ve v1, nebo později? Dočasný příjem cizích krojů je mimo v1.
7. **Přihlašovací identifikátor** – e-mail (návrh), nebo uživatelské jméno?
8. **Kam ukládat soubory příloh** na hostingu (adresář mimo webroot dostupný z PHP na `api`) – souvisí s Q-11 „přístupové údaje k DB na `api`“; ověřit jedním testem.
