# Pracovní pravidla pro AI asistenta

## Jazyk

- Komunikace s uživatelem: **česky**
- Kód, názvy souborů, proměnné, komentáře v kódu, commit messages: **anglicky**

## Pracovní styl

- Pracovat po malých, ověřitelných krocích.
- Před větší změnou (nový modul, refaktoring, změna architektury) nejdřív navrhnout plán a počkat na schválení.
- Po dokončení kroku vypsat změněné soubory a co ručně otestovat.
- Nepřidávat knihovny ani závislosti bez předchozího schválení.
- Neměnit architekturu ani strukturu projektu bez předchozího schválení.

## Architektonická pravidla

- Komponenty **nesmí volat HTTP API přímo**.
- Data mají vždy jít přes services: `komponenta → feature service → API service / mock service`.
- Mock implementace a HTTP implementace services musí být vzájemně zaměnitelné beze změny komponent.
- Nepoužívat NgModules – standalone components. Demo (`frontend/`) je na Angularu 19, Krojařka na aktuální stabilní verzi (D-42).

## Rozsah implementace

- Vstupní bod dokumentace je [`docs/README.md`](docs/README.md). Co platí, je v [`docs/decisions.md`](docs/decisions.md); při rozporu s jiným dokumentem platí registr. Co je nerozhodnuté, je v [`docs/open-questions.md`](docs/open-questions.md); nerozhodnuté věci nedomýšlet, zeptat se.
- Závazné jsou jen dokumenty v `docs/current/`, a to podle statusu v jejich hlavičce. Nic z `docs/proposals/` ani `docs/archive/` není závazné. Stav implementace se eviduje v `docs/current/03-stav-vyvoje.md`.
- **Jediná současná priorita je aplikace Krojařka** (`krojarka.vonica.cz`) a společné API (`api.vonica.cz`, PHP 8.5 + PostgreSQL 18). `moje.vonica.cz` je odložená; `demo.vonica.cz` je prototyp, ne cílová architektura; Krojařka z něj nepřebírá kód (D-02, D-11, D-31).
- Neimplementovat cílovou ani budoucí funkcionalitu bez výslovného zadání (WebSocket, push notifikace, platby, multi-tenant a přepínač kontextu, rodiče/zastupování dětí, registrace, DM, úkoly, offline režim apod.).
- Konkrétní aplikace pro folklorní organizace, ne univerzální framework. Jedna instalace = jedna organizace se **složkami** (Vonica: dospělá složka, Malá Vonica, Děvčice, muzika; Vonička samostatně), viz D-06. Oprávnění = pověření s rozsahem soubor / složka / skupina / akce / modul, bez superadministrátora (D-09, D-10).
- Nejdřív využít stávající model; nový modul nebo položku menu navrhnout až tehdy, když stávající model přestane stačit.
- Názvosloví krojů: **Krojařka** = aplikace, **krojařka** = osoba s pověřením ke krojům (pomocnice jsou rovnocenné), **sklad** = místnost s nezapůjčenými kroji, seznam kusů = **Součástky**, agenda v `moje` = **Správa krojů**. Nepoužívat „krojárna“ ani „krojárka“ (viz `docs/context/glossary.md`).
- Komentáře v kódu odkazují na `docs/06`, `docs/07`, `docs/08` a `docs/10` podle čísla (soubory jsou v `docs/current/` a `docs/current/moje/`). Čísla souborů ani kapitol neměnit.

## Git commit messages

- Commit message má být krátký, ideálně jednořádkový.
- Používat conventional commit prefixy: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- Negenerovat tělo commitu (víceřádkový popis), pokud není výslovně vyžádáno.
- Nikdy nepřidávat `Co-Authored-By`, Claude/AI attribution ani žádnou zmínku o způsobu generování.
- Commit message popisuje změnu, ne to, kdo nebo co ji vytvořil.

## Testování

- Testovací stack: Krojařka (`apps/krojarka`) Vitest (D-58), demo (`frontend/`) Karma + Jasmine, API PHPUnit (D-44).
- Testy zaměřit na logiku (auth, routing, services), ne na vzhled.
- Nový produkční kód pro hlavní logiku má mít odpovídající testy.

## Příkazy

Node 24 – výchozí shell má Node 20, které Angular CLI odmítne, proto před npm příkazy `source ~/.nvm/nvm.sh && nvm use`. API běží jen v Dockeru (na produkci Docker není). Root `package.json` je npm workspace (`apps/*`, `packages/*`); demo `frontend/` má vlastní `node_modules` mimo workspace.

```bash
docker compose up -d db api                # PostgreSQL 18 + API na http://localhost:8082 (GET /v1/health)
npm run api:install | api:migrate | api:test
docker compose run --rm api vendor/bin/phpunit --testsuite Unit
docker compose run --rm api vendor/bin/phpunit --filter LoansTest          # jeden test / třída
docker compose run --rm api vendor/bin/phinx seed:run -s FirstAdministrator   # API_ADMIN_* z .env

npm run krojarka:start                     # http://localhost:4200 proti lokálnímu API
npm run krojarka:start:mock                # bez API, mock adaptéry
npm run krojarka:test                      # Vitest přes @angular/build:unit-test
npm run krojarka:test -- --include src/app/features/soucastky/inventory.store.spec.ts
npm run krojarka:build

npm --prefix frontend test                 # demo, Karma + Jasmine
npm run frontend:start                     # demo dev server
```

Integrační testy API si samy vytvoří a zmigrují DB `<DB_NAME>_test`; každý test běží v transakci, která se na konci vrátí (`api/tests/Integration/DatabaseTestCase.php`). Lokálně jde e-mail (reset hesla) do `docker compose logs api`.

Nasazení jen na výslovný pokyn, přes skill `/deploy` nebo `npm run deploy -- --target api|krojarka [--dry-run]` (volby v hlavičce `scripts/deploy-app.mjs`; u API záloha DB → Phinx migrace → upload → health check).

## Architektura

- **`api/`** – PHP 8.5 bez frameworku, namespace `Splk\Api\` (PSR-4 `src/`). `public/index.php` → `App` (HTTP kernel): `RequestPolicy` (CORS/origin/JSON) → `Router` → pro autentizované routy session z cookie + CSRF hlavička `x-csrf-token` u nebezpečných metod → handler. Všechny chyby jsou JSON se stabilním kódem (`HttpException`). Routy registrují kontrolery v `Http/Controller/*::register()`, zapojené v `App::registerRoutes()`. Kontrolery dědí `Controller` (lazy PDO, `mandates()`, auditované zápisy); data přes repozitáře v `Domain/Costumes` a `Domain/Identity` (čisté PDO, žádné ORM). Oprávnění: `Authorization/Mandates` + `FundAccess` (fond složky: 404 bez pověření, 403 při zápisu s pověřením jen ke čtení). Schéma = Phinx migrace v `api/db/migrations`, seedy v `api/db/seeds`. Konfigurace `api/config/config.php` (vzor `config.example.php`, Docker `config.docker.php`).
- **`packages/api-contracts`** (`@splk/api-contracts`) – TypeScriptové zrcadlo requestů, response a chybových kódů API v1; zdrojem pravdy je API, při změně endpointu upravit obojí. **`packages/domain`** (`@splk/domain`) – sdílená čistá logika (čísla inventáře, částky, CSV reportů). Oba se importují přímo ze zdrojů přes `paths` v `apps/krojarka/tsconfig.json`, nebuildí se.
- **`apps/krojarka/`** – Angular (standalone, signals). Vrstvy: `features/*` (stránky + route-scoped `*.store.ts` se signály) → `data/*` abstraktní `XxxApi` třídy s `HttpXxxApi` a `MockXxxApi` implementacemi → `provideData()` v `data/provide-data.ts` vybírá adaptéry podle `environment.dataSource` (`http` | `mock`). Nový API modul = abstraktní třída + obě implementace + registrace v `provideData`. `core/` obsahuje auth, layout a `FundContext` (aktuálně vybraný fond složky).
- **`frontend/`** – demo prototyp (Angular 19, mock data v prohlížeči); Krojařka z něj nepřebírá kód.
- `scripts/` – build, release a deploy skripty (Node, SFTP).
