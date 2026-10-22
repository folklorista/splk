# 00 – Index: implementační dokumentace SPLK (stav kódu 2026-10-21)

> **ARCHIV – datovaný snímek.** Popis skutečného stavu kódu dema k 2026-10-21, připravený pro externí oponenturu. Neaktualizuje se. Odkazy na `docs/00–10` vedou dnes do `docs/current/` a `docs/archive/` (viz `docs/README.md`).


> Sada popisuje **skutečný stav implementace** (větev `design/identity-03` vč. necommitnutých změn). Je určena oponentovi bez přístupu ke kódu. Cílové (schválené, ale ne nutně implementované) chování je ve zvláštních specifikacích `docs/00–10`; zde se na ně odkazuje jen u odchylek („cíl dle docs/NN“).

## Produkt v kostce

- **Co:** webová aplikace (PWA, mobile-first, ~95 % použití na mobilu) pro interní organizaci folklorního souboru **Vonica**. Cílově i samostatný dětský soubor Malá Vonica se společným přihlášením. Nahrazuje roztříštěné FB skupiny, Messenger/WhatsApp a Google Sheets – **ne** veškerou komunikaci.
- **Pro koho:** dospělí členové (desítky osob), výbor, vedoucí, krojařky. Rodiče/zastupování dětí zatím ne.
- **Principy:** konkrétní aplikace, ne univerzální framework; pevné doménové moduly; skupiny jako základ viditelnosti; **oprávnění = pověření** (ne hierarchie rolí); digitalizovat jen to, co ulehčí život. Krojový sklad = **autoritativní evidence**; docházka = **orientační** (bez sankcí). Offline jen čtení (cíl).
- **Moduly (implementované):** Přehled (dashboard), Akce + odpovědi na účast + skutečná docházka + série, Skupiny (nástěnka, chat, členové, správa), Hledání, Moje kroje, Správa krojů (sklad, krojové karty, výpůjčky, inventury, nastavení), Správa souboru (osoby, skupiny, konfigurace, historie), Profil, Nastavení, Novinky.
- **Mimo rozsah (záměrně neimplementováno):** soukromé zprávy (DM), úkoly, platby, push/e-mail, WebSocket, registrace, offline zápisy, více souborů + přepínač kontextu, rodiče.

## Technický stav v kostce

- **Frontend-only** Angular 19 (standalone, signals + RxJS, zone.js), bez UI knihoven. ~19 k řádků TS, ~3,5 k řádků SCSS.
- **Žádný backend.** Mock services drží stav, ukládají do `localStorage` (data per prohlížeč). Mock services se chovají jako budoucí backend (validace pravidel, kontroly oprávnění – ne všude).
- Cílový backend: PHP 8.5 REST + MariaDB/MySQL na sdíleném hostingu (Websupport), polling místo WebSocketu. Docker lokálně jen napodobuje produkci.
- Nasazeno jako **demo pro výbor** na `moje.vonica.cz` za HTTP Basic Auth; přihlášení je mock (heslo se neověřuje).
- Testy: Karma + Jasmine, 73 spec souborů, 493 testů, vše zelené. Pokrytá hlavně čistá logika a services, slabě komponenty.

## Slovníček

| Termín | Význam |
|---|---|
| soubor | folklorní soubor (tenant); v kódu napevno jeden (`ensembleId = 1`) |
| osoba / člen (`Member`) | jedna entita = osoba + účet + členství v souboru; stavy aktivní člen / externista / bývalý člen / vyřazený externista |
| externista | osoba mimo soubor (host akce, vypůjčitel kroje); v krojích existuje i samostatné `ExternalPerson` |
| skupina | podmnožina členů (např. taneční, muzika, výbor); viditelnost otevřená / soukromá / skrytá; má nástěnku a chat |
| pověření (`Mandate`) | oprávnění s rozsahem soubor / skupina / akce: Správa souboru, hlavní správce / spolusprávce skupiny, Organizace akcí, Evidence docházky, Správa krojů, Náhled do správy krojů |
| odpověď na účast (RSVP) | slib člena (jdu / nejdu / možná) – „nahlášená účast“ |
| skutečná docházka | přítomen / nepřítomen zapsaný po akci, oddělená od RSVP |
| krojařka | osoba s pověřením Správa krojů |
| sklad | místnost s nezapůjčenými kroji |
| evidenční řada | číselná řada kusů dané klasifikace (pohlaví × region × varianta) |
| kus | fyzická krojová součástka se stabilním ID a číslem v řadě |
| komplet / krojová karta | šablona druhů součástek pro osobu (upozorňuje na chybějící druh) |
| výpůjčka | jeden kus svěřený jednomu držiteli, s historií |
| inventura | snapshot rozsahu kusů; režim „podle lidí“ (termíny, návštěvy) nebo „ve skladu“ (číselná mřížka) |

## Soubory sady

| Soubor | Obsah |
|---|---|
| [01-architektura.md](01-architektura.md) | stack, repo, skripty (build/release/deploy), routing a guardy, `core/`, `shared/`, vzor stavu a persistence, styling, PWA, testy |
| [02-domenovy-model.md](02-domenovy-model.md) | katalog entit a výčtů, osoba vs. účet vs. člen, ER přehled, uložená vs. odvozená data, seed |
| [03-opravneni.md](03-opravneni.md) | pověření a rozsahy, predikáty, viditelnost, ochranná pravidla, kde se kontroly vynucují, matice oprávnění |
| [04-akce-a-dochazka.md](04-akce-a-dochazka.md) | akce, cílení, RSVP, uzávěrky, důležité změny, série, docházka, nedostupnost, ICS export |
| [05-komunikace-a-skupiny.md](05-komunikace-a-skupiny.md) | nástěnka, komentáře, zmínky, chat skupiny, členství ve skupinách, badge/nepřečtené, upozornění, hledání |
| [06-kroje.md](06-kroje.md) | Moje kroje a Správa krojů: model, stavové automaty, mutace a pravidla, inventury, obrazovky, tisk/CSV |
| [07-sprava-clenove-a-prehled.md](07-sprava-clenove-a-prehled.md) | Správa souboru, osoby a jejich mazání, audit, konfigurace, profil, nastavení, Přehled, login |
| [08-souhrn-zjisteni.md](08-souhrn-zjisteni.md) | průřezový, prioritizovaný souhrn problémů a dluhu ze všech kapitol |
| [09-zadani-oponentury.md](09-zadani-oponentury.md) | zadání pro oponenta: co hodnotit a v jakém formátu odpovědět |

Každá kapitola 01–07 končí sekcí **„Pozorování a technický dluh“** (konkrétní zjištění z kódu, ne domněnky).

## Konvence textu

- Cesty k souborům jsou relativní k `frontend/src/app` (informativní; oponent je nemusí otevírat).
- Typové náčrty jsou zkrácené (pole + význam), ne doslovný kód.
- Data v příkladech jsou smyšlená; reálné osobní údaje členů sada neobsahuje.
