# Styl práce a rozhodovací pravidla

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
- role,
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
