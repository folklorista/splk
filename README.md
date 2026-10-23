# Folklorní soubor – aplikace

Webové aplikace pro folklorní soubor Vonica. Jediná současná priorita je aplikace **Krojařka** (`krojarka.vonica.cz`) nad společným PHP REST API (`api.vonica.cz`, PostgreSQL 18). Tento repozitář zatím obsahuje hlavně prototyp členské aplikace (Angular, mock data v prohlížeči), který běží jako demo. Přehled dokumentace a rozhodnutí: [`docs/README.md`](docs/README.md).

## Aktuální stav

Aktuální stav: [`docs/current/03-stav-vyvoje.md`](docs/current/03-stav-vyvoje.md). Historie vývoje prototypu (fáze a vlny níže): [`docs/archive/03-postup-vyvoje.md`](docs/archive/03-postup-vyvoje.md).

**Fáze 1–3** (dokončeno)

- přihlašovací obrazovka s mock AuthService
- layout po přihlášení: mobilní spodní navigace + desktopový sidebar
- Přehled s rychlým potvrzením účasti, nástěnky po skupinách, Akce (seznam a měsíční kalendář), hrubý placeholder Krojové databáze
- mock feature services pro všechny moduly (komponenty na ně přistupují výhradně přes services, ne přímo na mock data)
- rozpracovaná administrace (CRUD pro příspěvky, akce, členy, skupiny)
- jednotkové testy (auth, routing, services, klíčová logika viditelnosti/účasti)

Nasazeno jako **demo pro výbor** (data se ukládají jen v prohlížeči). Další krok: zpětná vazba výboru (Fáze 4), vlny úprav podle `docs/03`, poté **Fáze 5 – první vertikální řez s PHP/MySQL backendem**

## Stack

| Vrstva | Technologie |
|---|---|
| Frontend | Angular 19, standalone components, SCSS |
| Backend (plánováno) | PHP 8.5 REST API, PostgreSQL 18 (`api.vonica.cz`) |
| Hosting | Websupport (PHP hosting), statický build přes SFTP |

## Struktura repozitáře

```
docs/          projektová dokumentace
frontend/      Angular aplikace
  src/app/
    core/      auth, layout
    features/  dashboard, posts, events, attendance, members, costumes
    styles/    SCSS proměnné a reset
```

## Spuštění frontendu

```bash
cd frontend
npm install
npx @angular/cli@19 serve
```

Otevřít: `http://localhost:4200`
Přihlášení: libovolný e-mail + heslo (mock, nekontroluje).

## Krojařka a API (vývoj)

Vyžaduje Node.js 24 (`nvm use`) a Docker.

```bash
npm install                        # závislosti workspaces (apps/krojarka, packages/*)
npm run api:install                # composer install v kontejneru api
docker compose up -d db api        # PostgreSQL 18 + API na http://localhost:8082 (GET /v1/health)
npm run api:migrate                # Phinx migrace lokální DB
npm run api:test                   # PHPUnit (Unit + Integration proti PostgreSQL v Dockeru)

npm run krojarka:start             # http://localhost:4200 proti lokálnímu API
npm run krojarka:start:mock        # bez serveru, mock data (přihlášení vypíše přihlašovací stránka)
npm run krojarka:test              # Vitest
```

První účet se správou organizace: `API_ADMIN_*` v `.env`, pak `docker compose run --rm api vendor/bin/phinx seed:run -s FirstAdministrator`.
Heslo se nastaví přes „Zapomenuté heslo“; lokálně jde e-mail do logu (`docker compose logs api`).

Nasazení: `npm run deploy -- --target api|krojarka [--dry-run]` (`scripts/deploy-app.mjs`, popis v hlavičce skriptu a ve skillu `/deploy`).

## Lokální Docker

Napodobuje produkci (Apache 2.4 + PHP 8.5 s `pdo_pgsql`, PostgreSQL 18). Na produkci Docker není.

```bash
docker compose up -d --build
```

| Služba | Adresa |
|---|---|
| Aplikace (produkční build za Apachem) | http://localhost:8080 |
| Adminer | http://localhost:8081 (systém PostgreSQL, server `db`, uživatel/heslo/databáze `splk`/`splk`/`splk`) |
| PostgreSQL 18 | `localhost:5433`, databáze `splk` (lokální hodnoty `DB_*`, produkční `PG_*` z `.env` se nepoužijí) |

Kontejner s aplikací obsahuje produkční build – po změně kódu je potřeba znovu `docker compose up -d --build`. Pro vývoj s hot reloadem dál `ng serve`.

## Vydání a nasazení

Demo běží na `https://demo.vonica.cz` (Websupport, SFTP), celé za HTTP Basic Auth. `moje.vonica.cz` je vyhrazená budoucí členské aplikaci a nic se tam nenasazuje bez výslovného požadavku. Deploy skript nemá výchozí cíl: vždy `--target demo` (případně `moje`).

```bash
cp .env.example .env               # jednou: přístupy k SFTP a heslo Basic Auth (.env není v gitu)
npm install                        # jednou: závislosti skriptů (ssh2-sftp-client)

git checkout master                # vydává se z masteru
npm run release -- "Změna 1" "Změna 2"      # verze vRRRR.M.N + tanec, changelog, commit a tag
npm run deploy -- --target demo --source tag --demo   # build posledního tagu a nahrání na demo
```

V Claude Code stačí `/deploy [tag|commit|větev|working]` (skill [`.claude/skills/deploy`](.claude/skills/deploy/SKILL.md)): zjistí verzi na demu, připraví migrace (až bude backend), ukáže shrnutí, po potvrzení nasadí a ověří web.

- `--source working|commit|tag` – pracovní kopie (i s necommitnutými změnami, s varováním), poslední commit aktuální větve, nebo poslední tag `v*` z `master`. `commit` a `tag` se sestaví v čistém dočasném `git worktree`.
- `--ref <tag|commit|větev>` – konkrétní tag (stačí jednoznačný začátek názvu), commit nebo větev, také v dočasném worktree.
- `--target demo|moje` – povinný cíl nasazení; proměnné se čtou s prefixem cíle (`DEMO_*`, `MOJE_*`, viz `.env.example`).
- `--allow-foreign-content` – dovolí přepsat webroot s cizím obsahem (např. placeholder poskytovatele).
- `--status` – jen vypíše, jakou verzi cíl právě servíruje.
- `--demo` – reální členové z `dev/local/clenove.tsv` (příjmení zamaskovaná). Bez Basic Auth skript demo build odmítne nasadit.
- `--dry-run` jen sestaví a vypíše shrnutí, `--yes` přeskočí potvrzení.
- Skript nejdřív nahraje `.htpasswd` a `.htaccess` s Basic Auth, pak změněné soubory aplikace (chunky s hashem v názvu, které už na serveru jsou, přeskočí; `index.html` a `ngsw.json` nakonec), smaže soubory ze starších verzí a ověří, že web bez hesla vrací 401 a s heslem novou revizi.
- Lokální produkční build bez nasazení: `npm run frontend:build` (`frontend:build:demo` s reálnými členy).

## Testy

```bash
cd frontend
npx @angular/cli@19 test --watch=false --browsers=ChromeHeadless
```

## Dokumentace

Vstupní bod: [`docs/README.md`](docs/README.md).

- [`docs/decisions.md`](docs/decisions.md) – co jsme rozhodli
- [`docs/open-questions.md`](docs/open-questions.md) – co musíme rozhodnout
- [`docs/current/`](docs/current/) – platné specifikace (Krojařka, API, odložená `moje`)
- [`docs/archive/`](docs/archive/) – historické a překonané dokumenty
