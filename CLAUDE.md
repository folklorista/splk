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
