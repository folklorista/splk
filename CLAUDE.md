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
- Nepoužívat NgModules – projekt je postaven na standalone components (Angular 19).

## Rozsah implementace

- Držet se dokumentace v [`docs/`](docs/).
- Neimplementovat budoucí funkcionalitu bez výslovného zadání (WebSocket, push notifikace, platby, rodiče/zástupci, registrace, komplexní oprávnění apod.).
- Projekt má být konkrétní aplikace pro jeden soubor, ne univerzální dynamický framework.

## Git commit messages

- Commit message má být krátký, ideálně jednořádkový.
- Používat conventional commit prefixy: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- Negenerovat tělo commitu (víceřádkový popis), pokud není výslovně vyžádáno.
- Nikdy nepřidávat `Co-Authored-By`, Claude/AI attribution ani žádnou zmínku o způsobu generování.
- Commit message popisuje změnu, ne to, kdo nebo co ji vytvořil.

## Testování

- Testovací stack: Karma + Jasmine (výchozí Angular stack).
- Testy zaměřit na logiku (auth, routing, services), ne na vzhled.
- Nový produkční kód pro hlavní logiku má mít odpovídající testy.
