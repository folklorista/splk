# Folklorní soubor – aplikace

Webová aplikace pro interní organizaci folklorního souboru. Mobilní-first přístup, Angular frontend, PHP REST API backend (připraveno, zatím mock data).

## Aktuální stav

Podrobný stav a další kroky viz [`docs/03-postup-vyvoje.md`](docs/03-postup-vyvoje.md).

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
| Backend (plánováno) | PHP REST API, MySQL |
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

## Lokální Docker

Napodobuje produkci (Apache 2.4 + PHP 8.5, MariaDB 11.4). Na produkci Docker není.

```bash
docker compose up -d --build
```

| Služba | Adresa |
|---|---|
| Aplikace (produkční build za Apachem) | http://localhost:8080 |
| Adminer | http://localhost:8081 (server `db`, uživatel/heslo `splk`/`splk`, root/`root`) |
| MariaDB | `localhost:3307`, databáze `splk` |

Kontejner s aplikací obsahuje produkční build – po změně kódu je potřeba znovu `docker compose up -d --build`. Pro vývoj s hot reloadem dál `ng serve`.

## Vydání a nasazení

Aplikace běží na `https://moje.vonica.cz` (Websupport, SFTP), celá za HTTP Basic Auth.

```bash
cp .env.example .env               # jednou: přístupy k SFTP a heslo Basic Auth (.env není v gitu)
npm install                        # jednou: závislosti skriptů (ssh2-sftp-client)

git checkout master                # vydává se z masteru
npm run release -- "Změna 1" "Změna 2"      # verze vRRRR.M.N + tanec, changelog, commit a tag
npm run deploy -- --source tag --demo       # build posledního tagu a nahrání na web
```

V Claude Code stačí `/deploy [tag|commit|větev|working]` (skill [`.claude/skills/deploy`](.claude/skills/deploy/SKILL.md)): zjistí verzi na produkci, připraví migrace (až bude backend), ukáže shrnutí, po potvrzení nasadí a ověří web.

- `--source working|commit|tag` – pracovní kopie (i s necommitnutými změnami, s varováním), poslední commit aktuální větve, nebo poslední tag `v*` z `master`. `commit` a `tag` se sestaví v čistém dočasném `git worktree`.
- `--ref <tag|commit|větev>` – konkrétní tag (stačí jednoznačný začátek názvu), commit nebo větev, také v dočasném worktree.
- `--status` – jen vypíše, jakou verzi produkce právě servíruje.
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

Viz složka [`docs/`](docs/):

- [`00-prehled.md`](docs/00-prehled.md) – cíl projektu a kontext
- [`01-technicky-stack.md`](docs/01-technicky-stack.md) – stack a architektonický směr
- [`02-core-a-moduly.md`](docs/02-core-a-moduly.md) – core entity a moduly
- [`03-postup-vyvoje.md`](docs/03-postup-vyvoje.md) – fáze vývoje
- [`04-styl-prace.md`](docs/04-styl-prace.md) – rozhodovací pravidla
