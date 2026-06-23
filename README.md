# Folklorní soubor – aplikace

Webová aplikace pro interní organizaci folklorního souboru. Mobilní-first přístup, Angular frontend, PHP REST API backend (připraveno, zatím mock data).

## Aktuální stav

**Fáze 1 – Angular shell** (dokončeno)

- přihlašovací obrazovka s mock AuthService
- layout po přihlášení: mobilní spodní navigace + desktopový sidebar
- placeholder routes pro všechny hlavní moduly
- základní jednotkové testy (auth, guard, login)

Další krok: **Fáze 2 – TypeScript modely, mock data a feature services**

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
