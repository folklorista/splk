# Struktura monorepa

**Stav:** schváleno 2026-10-23 (D-41, D-43, D-45, D-47). Implementace: `api/`, `apps/krojarka` a `packages/api-contracts` (kroky 1–2); `packages/domain` a `packages/ui` zatím nevznikly.
**Vychází z:** D-03 (monorepo), D-11 a D-12 (PHP + PostgreSQL, sessions), D-31 (Krojařka nepřebírá kód dema), D-33 (demo se nekonzervuje), D-41 až D-45 (rozhodnutí uživatele k Q-10).

## 1. Cílový strom

```text
splk/
├── apps/                          frontendové aplikace, každá samostatně sestavitelná a nasaditelná
│   ├── krojarka/                  Angular 22 – krojarka.vonica.cz
│   │   ├── src/app/
│   │   │   ├── core/              přihlášení (GET /auth/me), HTTP interceptory (credentials, CSRF, 401), layout, menu
│   │   │   ├── data/              datová vrstva: rozhraní + HTTP adaptér + mock adaptér (výběr přes DI)
│   │   │   └── features/          prehled, soucastky, krojove-karty, lide, vypujcky, inventury,
│   │   │                          dokumenty, prehledy, hledat, nastaveni, ucet
│   │   ├── angular.json, package.json, tsconfig.json
│   └── (demo/)                    jen pokud se schválí přesun dnešního frontend/ (kap. 4)
├── packages/                      sdílené TypeScript knihovny (zdrojové TS, bez vlastního buildu)
│   ├── api-contracts/             DTO a typy požadavků a odpovědí, chybové kódy, stránkování
│   ├── domain/                    čisté TS modely a pravidla bez Angularu (formát „řada + číslo“, parser „1, 3, 12-15“, stavy, popisky)
│   └── ui/                        vizuální identita: design tokens (SCSS), ikony (SVG + generátor), základní styly
├── api/                           jedna společná PHP 8.5 aplikace – api.vonica.cz
│   ├── public/                    webroot: index.php (front controller), .htaccess
│   ├── src/                       PSR-4 `Splk\Api\…`: Http (router, CORS, CSRF, JSON), Auth (sessions),
│   │                              Authorization (pověření), Domain\{Identity, Units, Costumes, Costs, Attachments},
│   │                              Infrastructure\Db (PDO)
│   ├── config/                    config.example.php; skutečná konfigurace na hostingu mimo webroot (Q-11)
│   ├── db/migrations/, db/seeds/  Phinx
│   ├── tests/                     PHPUnit: Unit, Integration (proti PostgreSQL v Dockeru)
│   └── composer.json, phinx.php, phpunit.xml
├── frontend/                      dnešní demo (Angular 19) – zatím beze změny
├── docs/, scripts/, identity/, data/, public/   jako dnes (data/ a public/ patří k demu)
├── package.json                   npm workspaces: apps/krojarka, packages/*  (demo mimo workspaces)
└── docker-compose.yml             db (PostgreSQL 18), api (PHP 8.5 + pdo_pgsql + Composer), adminer; demo jako dnes
```

## 2. Hranice

| Část | Smí | Nesmí |
|---|---|---|
| **`apps/*`** | UI, routing, stav obrazovek, feature services; volat API jen přes `data/`; používat `packages/*` | importovat z jiné aplikace; volat HTTP z komponent; být autoritou oprávnění |
| **`packages/*`** | čisté TS bez vedlejších efektů; vlastní testy; vzniká jen s **aspoň jedním skutečným použitím** | HTTP volání; kód konkrétní aplikace; Angular (kromě případných komponent v `ui` až pro druhou aplikaci) |
| **`api/`** | **jediná autorita** pro přihlášení, autorizaci, validaci, integritu dat, audit a migrace | sdílet kód s TypeScriptem; důvěřovat validaci z frontendu |

Poznámky:

- **`packages/domain` není bezpečnostní vrstva.** Pravidla, na kterých závisí data (kdo smí vydat kus, uzavřít inventuru…), platí v PHP. V TS se opakují jen kvůli pohodlí UI (okamžitá zpětná vazba) a testy je drží v souladu se serverem.
- **`packages/api-contracts`** je TS zrcadlo API. Zdrojem pravdy je API. Případné generování z popisu API (OpenAPI) se zváží, až API trochu vyroste.
- **`packages/ui`** zpočátku obsahuje tokeny, ikony a styly. Dnešní zdroje identity (`identity/`, generátor `scripts/generate-stitch-icons.mjs`) zůstávají, do `ui` se převezmou výstupy, které Krojařka skutečně použije. Krojařka má vlastní design (D-31), sdílí se jen identita Vonice.
- **Demo do workspaces nepatří.** Jeho Angular 19 a TypeScript 5.x by se kvůli sdíleným závislostem bily s Angularem 22 a TypeScriptem 6. Demo nepoužívá `packages/*`.

## 3. Verze nástrojů

| Nástroj | Krojařka | Demo | Ověřeno |
|---|---|---|---|
| Angular | **22.2.x** (aktuální `latest`) | 19.2.x | `npm view @angular/core` 2026-10-23 |
| TypeScript | **≥ 6.0 < 6.1** (požadavek `@angular/compiler-cli` 22) | 5.x | dtto |
| Node.js | **^22.22.3 \|\| ^24.15.0 \|\| ≥ 26** | Angular 19: ≥ 22.0.0 vyhovuje | dtto |

**Rozhodnuto: Node.js 24 LTS pro celý repozitář (D-47).** Vyhoví Krojařce i demu.

- **Lokálně je dnes Node 20.19.3**, Angularu 22 nestačí – nutné aktualizovat.
- `Dockerfile` dema používá `node:20` – sjednotit při stejném kroku.
- Node běží jen při vývoji a buildu, na hostingu ne.

## 4. Demo: `frontend/` → `apps/demo`?

Přesun **neodporuje** D-31 ani D-33. D-31 se týká přebírání kódu do Krojařky, D-33 zakládání archivu. Jde ale o čistě technický přesun, který se dotkne:

- `Dockerfile`, `scripts/build.mjs`, `build-info.mjs`, `sync-public.mjs`, `deploy.mjs`;
- `scripts/import-members.mjs` (zapisuje do `frontend/src/…`), `.gitignore`;
- `README.md`, `CLAUDE.md`, skillu `/deploy`.

**Rozhodnuto:** demo se nepřesouvá (D-41).

## 5. Migrace databáze (Phinx) na hostingu

Ověřená omezení hostingu:

- bez SSH a bez spouštění příkazů (SFTP only);
- CRON umí spustit PHP soubor;
- z internetu je databáze dostupná přes TLS (`sslmode=require`);
- z hostingu vede spojení přes lokální proxy (`127.0.0.1`) a privátní síť bez TLS (Q-11).

| Varianta | Popis | Hodnocení |
|---|---|---|
| **A – z vývojového stroje** | `phinx migrate` běží lokálně (PHP v Dockeru) proti produkční DB přes TLS. Vyžaduje povolit domácí IP ve filtru | **zvoleno (D-45)**: žádný migrační kód na webu, šifrované spojení, plná kontrola |
| B – chráněný HTTP endpoint | API by mělo skrytou URL, která spustí migrace | ne: migrace by šly spustit HTTP požadavkem, i když chráněným |
| C – jednorázový CRON | nahrát skript, nastavit CRON, po běhu smazat | ne: neprůhledné, ruční, těžko se ověřuje výsledek |

Navržený postup `npm run deploy -- --target api` (varianta A), každý krok s potvrzením:

1. **Stav:** `phinx status` proti produkci → seznam čekajících migrací (při žádné se krok 2–3 přeskočí).
2. **Záloha:** `pg_dump` (verze 18, z image `postgres:18`) přes TLS do `dev/local/backups/<datum>.sql.gz` (mimo Git) a ověření, že soubor není prázdný. Navíc lze v administraci hostingu vytvořit ruční zálohu.
3. **Migrace:** `phinx migrate` a kontrolní `phinx status`.
4. **Kód:** nahrání `api/` přes SFTP (včetně `vendor/` nainstalovaného lokálně `composer install --no-dev`). Konfigurace se nepřepisuje.
5. **Ověření:** `GET /v1/health` (verze kódu + poslední migrace).

Pravidla:

- migrace **nikdy neběží při běžném HTTP požadavku**;
- schéma se mění **zpětně kompatibilně** (nejdřív přidat, kód přepnout, staré odebrat až další migrací), aby krátký nesoulad kódu a schématu nic nerozbil;
- produkční migraci předchází záloha.

## 6. Rozhodnuto 2026-10-23

1. Demo se **nepřesouvá**, zůstává ve `frontend/` (D-41).
2. **Node.js 24 LTS** pro celý repozitář (D-47).
3. Migrace **variantou A** z vývojového stroje (D-45). IP filtr databáze je zapnutý s domácí IP a spojení z ní běží přes TLS 1.2 (ověřeno, D-46).
4. Jmenný prostor PHP **`Splk\Api\`** s moduly `Domain\{Identity, Units, Costumes, Costs, Attachments}` (D-43).
