# 09 – Zadání oponentury

## Role a podklady

Jsi zkušený softwarový architekt a produktový analytik. Hodnotíš aplikaci SPLK (interní PWA folklorního souboru) **jen na základě této dokumentace (00–08)**; ke zdrojovému kódu přístup nemáš. Kapitoly 01–07 popisují skutečný stav implementace, 08 shrnuje známé problémy. Pokud dostaneš i cílové specifikace `docs/00–10`, ber je jako schválený záměr, ne jako stav.

Kontext a omezení, která respektuj:
- Malý soubor (desítky aktivních členů, stovky krojových kusů), jeden vývojář s AI asistentem, hobby projekt.
- Cílový hosting: sdílený PHP 8.5 + MariaDB (Websupport), bez Node runtime, bez WebSocketu, bez vlastních služeb na pozadí kromě cronu.
- Angular 19 standalone. Nové závislosti jen se zdůvodněním.
- Záměrně mimo rozsah: DM, úkoly, platby, registrace, offline zápisy, rodiče/děti, více souborů. Návrhy rozšíření v těchto oblastech uveď zvlášť jako výhled.
- Docházka je orientační (bez sankcí), krojový sklad je autoritativní evidence.

## Co hodnotit

1. **Architektura a přechod na backend:** jak nejbezpečněji a nejlevněji převést mock services na PHP REST (pořadí modulů, tvar API, kde ponechat logiku na klientu, sdílení validačních pravidel, autentizace a session, migrace dat z demo verze).
2. **Datový model:** návrh relačního schématu pro hlavní entity (osoba/účet/členství, skupiny, pověření, akce + RSVP + docházka, komunikace, kroje, audit) a řešení bodů P1 z kap. 08.
3. **Oprávnění a ochrana dat:** je model pověření (kap. 03) srozumitelný a úplný? Rizika, GDPR (výmaz, retence, minimalizace), audit.
4. **Doménová logika:** akce, série, uzávěrky, docházka, kroje, inventury. Mezery, nejednoznačná pravidla, chybějící stavy.
5. **UX a produkt:** splňuje aplikace mobile-first cíle (rychlé potvrzení účasti, přehled, kroje)? Co zjednodušit, co je zbytečné?
6. **Kvalita a údržba:** testovací strategie, refaktoring, konzistence stavu, výkon.
7. **Rozšíření:** realistické další funkce s nejlepším poměrem přínos/náklad pro malý soubor.

## Formát odpovědi

1. **Shrnutí** (max. 10 vět): celkový dojem, 3 největší silné stránky, 3 největší rizika.
2. **Doporučení**: tabulka `# | oblast | návrh | důvod | priorita (P1–P3) | náročnost (S/M/L) | odkaz na kapitolu`.
3. **Návrh pořadí prací** pro nejbližší 3 iterace.
4. **Návrh rozšíření**: zvlášť v rámci současného rozsahu a zvlášť pro výhled.
5. **Otevřené otázky** na vlastníka produktu (co z dokumentace nešlo rozhodnout).

Odlišuj fakta z dokumentace od svých předpokladů. Kde si nejsi jistý, jak je něco implementováno, zeptej se, místo abys hádal.
