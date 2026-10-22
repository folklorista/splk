# Styl práce a rozhodovací pravidla

> **Status:** platné (D-01, D-04). Odkazy na `07` vedou do `current/moje/07`. Pasáž „Dlouhodobý směr“ je historická: backend je PHP + PostgreSQL 18 (D-11).

## Iterativní vývoj

Vývoj má probíhat po malých, ověřitelných krocích.

Doporučený rytmus:

```text
zadání malé části
↓
návrh
↓
implementace
↓
rychlé otestování
↓
připomínky
↓
úprava
↓
další část
```

Cílem není navrhnout dokonalý systém předem. Cílem je rychle ověřovat skutečné potřeby souboru a přitom si nezavřít cestu k budoucímu rozšíření.

## Práce s vedoucím souboru

Vedoucí souboru má být zapojen hlavně do připomínkování procesů a obrazovek.

Nemá smysl s ním primárně řešit:

- databázové tabulky,
- technologie,
- REST API,
- hosting,
- frontendovou architekturu.

Má smysl s ním řešit:

- co členové reálně potřebují,
- jak probíhá komunikace,
- jak se plánují akce,
- jak se potvrzuje účast,
- jaké skupiny v souboru existují,
- kdo co smí vidět,
- kdo co smí upravovat,
- kde dnes vznikají chyby a zmatky.

## Přístup k rozhodování

Při každém návrhu je vhodné si položit otázky:

1. Je to potřeba pro první verzi?
2. Je to core, nebo modul?
3. Je to pravidlo konkrétního souboru, nebo obecný princip?
4. Má to být napevno, nebo konfigurovatelné?
5. Nebude tato změna nutit upravit mnoho nesouvisejících částí?
6. Dá se to nejdřív ověřit mockem?

## Co má být pevné

Pevné by měly být základní principy aplikace:

- uživatel,
- soubor,
- členství,
- skupina,
- pověření (původně „role“; viz D-09),
- modul,
- akce,
- příspěvek,
- účast,
- krojový díl.

Tyto pojmy by neměly být nahrazené anonymními dynamickými entitami typu „tabulka“, „záznam“, „sloupec“.

## Co může být konfigurovatelné

Konfigurovatelné mohou být věci, které se pravděpodobně budou lišit mezi soubory:

- zapnuté moduly,
- názvy skupin,
- pravidla viditelnosti podle skupin,
- typy akcí,
- typy krojových dílů,
- volitelná pole,
- notifikační preference,
- některá pravidla půjčování.

## Neopakovat chybu příliš dynamické architektury

Předchozí krojová databáze narazila na problém, že se architektura snažila být obecná příliš brzy.

*Původní popis (převzato z `archive/00-prehled.md`, kap. „Poučení z krojové databáze“):*

Předchozí pokus o krojovou databázi směřoval k velmi dynamickému řešení, kde se REST API a frontend měly automaticky přizpůsobovat změnám ve struktuře databáze.

To se ukázalo jako problematické, protože reálná doménová pravidla nejsou jen tabulky a sloupce. Typický problém:

- člen z určité skupiny může dostat k zapůjčení jen krojové díly z určitých kategorií,
- některé skupiny členů mají přístup k jiným částem evidence,
- vazební tabulky a pravidla nebyly od začátku zohledněné,
- malá doménová změna vyžadovala úpravy napříč mnoha vrstvami.

Z toho plyne závěr:

- nedělat vše univerzálně a horizontálně,
- nerozšiřovat aplikaci přes generické tabulky bez doménového významu,
- držet pevné moduly podle oblasti použití,
- připravit skupiny a vazby jako základní prvek systému.

*Poznámka 2026-10-22: první odrážka popisuje tehdejší pravidlo; zda je zákaz výdeje podle skupiny vůbec potřeba, je Q-02.*

Rizika příliš dynamického přístupu:

- špatná čitelnost,
- složitá validace,
- komplikovaná oprávnění,
- složité UI,
- malé doménové pravidlo mění mnoho vrstev,
- obtížné testování,
- problém s mobilním UX.

Nový přístup:

- moduly podle domény,
- pevné modely,
- konkrétní API,
- sdílené core služby,
- rozšiřitelnost přes skupiny, moduly a nastavení.

## Doporučený pracovní režim s AI

Pracovat po menších blocích.

Vhodné zadání:

- „Navrhni modely pro akce a docházku.“
- „Připrav Angular service a mock data pro nástěnku.“
- „Zkontroluj, jestli tento model krojů pokryje půjčování podle skupin.“
- „Navrhni první PHP endpointy pro akce.“
- „Uprav layout pro mobilní-first použití.“

Nevhodné zadání:

- „Vygeneruj celou aplikaci.“
- „Udělej univerzální systém pro všechny budoucí potřeby.“
- „Vymysli všechny tabulky dokonale dopředu.“

## Produktová kritéria ověřená v říjnu 2026

- **Nejdřív využít stávající model, nový modul až když přestane stačit.** Repertoár, texty písní nebo nahrávky lze vést jako příspěvky s přílohami ve skupině, sezónní akci jako akci se zapnutými funkcemi, dočasnou koordinaci jako dočasnou skupinu. Nový modul, entita nebo položka menu potřebuje konkrétní důvod (strukturované hledání, výpočet, kontrola), viz `07` kap. 40.
- Neusilovat o elektronizaci všech domluv; **pokud už se věc řeší online**, má být jednodušší ji vyřídit uvnitř aplikace než přes externí chat, formulář nebo tabulku. Nepřidávat administrativu jen kvůli tomu, že ji systém umí evidovat.
- **Rozlišovat evidenční zdroj pravdy a komunikační pomůcku:** krojové pohyby oficiálně evidovat; účast je orientační, ale uchovávat historii změn odpovědí pro provozní řešení opakovaných nesouladů.
- Uživatelské funkce neztotožňovat s oprávněním: přepnutí folklorního souboru, přepnutí přihlašovacího účtu a zastupování dítěte jsou tři různé děje.
- Nastavení pro děti a jednotlivé soubory mají být **parametry domény**, nikoliv kopie aplikace či nový univerzální permission builder. Pro vysoce citlivé operace stanovit bezpečné serverové hranice.
- Výchozí „offline“ politika: **prohlížení omezeného uloženého textu, žádné zápisy** a žádná fronta pozdější synchronizace. Při neúspěšném requestu neslibovat, že se změna uložila.
- Produktová specifikace popisuje odsouhlasené chování; **stav implementace a prioritizace se evidují samostatně**. Starší kapitoly označit jako historický záznam, pokud už jejich předpoklady neplatí.

## Dlouhodobý směr

První verze má běžet jednoduše na PHP/MySQL hostingu.

Dlouhodobě má být možné přejít na:

- Node.js / TypeScript backend,
- PostgreSQL,
- WebSocket realtime komunikaci,
- Dockerizované služby,
- mobilní aplikaci přes Capacitor.

Tomu se má přizpůsobit hlavně frontendová architektura:

- komponenty oddělené od API implementace,
- služby místo přímého HTTP v komponentách,
- jasné modely,
- modulová struktura,
- žádná pevná závislost na PHP detailu.
