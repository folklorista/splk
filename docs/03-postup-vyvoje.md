# Postup vývoje

## Základní strategie

Vývoj má probíhat iterativně a po malých celcích.

Nejprve vznikne frontendový prototyp s mock daty, poté se budou postupně nahrazovat mock data reálným PHP REST API a MySQL databází.

Důležitá zásada:

> Nejdřív ověřit uživatelský tok a obrazovky, ale už od začátku držet rozumné modely a services.

## Fáze 1 – Angular shell

Cílem je vytvořit základní aplikaci, která půjde spustit, proklikat a ukázat vedoucímu.

Obsah:

1. Angular projekt.
2. Routing.
3. Přihlašovací obrazovka.
4. Mock AuthService.
5. Základní layout po přihlášení.
6. Mobilní spodní navigace.
7. Desktop sidebar/header.
8. Dashboard placeholder.
9. Základní routes pro hlavní moduly.

## Fáze 2 – Mock modely a API services

Cílem je zavést typy a služby tak, aby se později daly přepojit na reálný backend.

Obsah:

1. TypeScript modely pro core entity.
2. TypeScript modely pro první moduly.
3. Mock data.
4. Feature services.
5. Základní loading/error/empty states.

Důležité pravidlo:

- komponenty nesmí být pevně navázané na mock data,
- data mají získávat přes services.

## Fáze 3 – První obrazovky pro připomínkování

Cílem je mít klikací prototyp pro schůzku s vedoucím.

Doporučené obrazovky:

1. Login.
2. Dashboard.
3. Seznam akcí.
4. Detail akce.
5. Potvrzení účasti.
6. Nástěnka.
7. Detail příspěvku.
8. Seznam členů.
9. Hrubý placeholder krojové databáze.

## Fáze 4 – Konzultace s vedoucím

Na schůzce se nemá řešit databáze ani technologie. Má se řešit realita provozu souboru.

Hlavní otázky:

1. Co dnes nejvíc bolí v komunikaci?
2. Jaké informace se nejčastěji ztrácí?
3. Co musí člen zvládnout na mobilu během několika sekund?
4. Jak vedoucí vytváří akce?
5. Jak se dnes potvrzuje účast?
6. Jaké skupiny členů reálně používáte?
7. Co má vidět každý a co jen vybraní?
8. Kdo může vytvářet oznámení?
9. Kdo může upravovat akce?
10. Má krojová databáze sloužit jen jako evidence, nebo i jako půjčovna?

## Fáze 5 – První vertikální řez

Po odsouhlasení prvního modulu se vytvoří první reálný backendový řez.

Doporučený první modul: akce.

Vertikální řez:

```text
Angular seznam akcí
Angular detail akce
Angular potvrzení účasti
PHP GET /events
PHP GET /events/{id}
PHP POST /events/{id}/attendance
MySQL tabulky events a event_attendance
```

Cílem je ověřit:

- deploy frontendu,
- deploy PHP API,
- připojení k MySQL,
- autentizaci nebo její první náhradu,
- tvar API,
- error handling,
- strukturu služeb ve frontendu.

## Fáze 6 – Postupné nahrazování mock dat

Po prvním řezu se budou mock data nahrazovat reálnými endpointy po modulech:

1. Akce.
2. Docházka.
3. Nástěnka.
4. Členové.
5. Krojová databáze.
6. Dokumenty.

## Co zatím nedělat

Před první konzultací není vhodné napevno implementovat:

- komplexní databázovou strukturu,
- finální role a oprávnění,
- složitou registraci,
- WebSocket,
- push notifikace,
- platby,
- rodiče a zákonné zástupce,
- složitý workflow půjčování krojů,
- univerzální dynamický REST framework.

## Doporučené MVP

První použitelné MVP by mohlo obsahovat:

1. Přihlášení.
2. Dashboard.
3. Členové.
4. Nástěnka.
5. Akce.
6. Potvrzení účasti.
7. Základní krojová databáze jako katalog.

Pozdější rozšíření:

- komentáře,
- dokumenty,
- notifikace,
- pokročilá půjčovna krojů,
- dětský soubor,
- rodiče/zástupci,
- platby,
- mobilní aplikace přes Capacitor,
- WebSocket realtime backend.
