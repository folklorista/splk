# Folklorní soubor – aplikace

Webová aplikace pro interní organizaci folklorního souboru. Mobilní-first přístup, Angular frontend, PHP REST API backend (připraveno, zatím mock data).

## Aktuální stav

Podrobný stav a další kroky viz [`docs/03-postup-vyvoje.md`](docs/03-postup-vyvoje.md).

**Fáze 1–3** (dokončeno)

- přihlašovací obrazovka s mock AuthService
- layout po přihlášení: mobilní spodní navigace + desktopový sidebar
- Dashboard, Nástěnka, Akce (s potvrzením účasti), Členové, Skupiny, hrubý placeholder Krojové databáze
- mock feature services pro všechny moduly (komponenty na ně přistupují výhradně přes services, ne přímo na mock data)
- rozpracovaná administrace (CRUD pro příspěvky, akce, členy, skupiny)
- jednotkové testy (auth, routing, services, klíčová logika viditelnosti/účasti)

Další krok: **Fáze 4 – konzultace s vedoucím souboru**, poté **Fáze 5 – první vertikální řez s PHP/MySQL backendem**

## Stack

| Vrstva | Technologie |
|---|---|
| Frontend | Angular 19, standalone components, SCSS |
| Backend (plánováno) | PHP REST API, MySQL |
| Hosting (plánováno) | PHP hosting, statický build |

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
