# Konsolidace dokumentace Souborového systému — 18. 10. 2026

## Stav a doporučený způsob používání

- Dokumenty **`00`–`10` jsou aktuální tematické specifikace** a obsahují schválená produktová rozhodnutí z diskuse.
- **Schválené cílové chování ≠ funkce již implementovaná v kódu.** Původní historické informace o verzích, mock implementaci a plánu vývoje zůstaly zachovány a tam, kde bylo potřeba, byly výslovně označeny za historické.

## Přehled změn podle dokumentů

| Soubor | Zapracované oblasti |
| --- | --- |
| `00-prehled.md` | Produktová filozofie, globální účet, dva samostatné soubory, cílové dětské režimy, autoritativní kroje a orientační účast |
| `01-technicky-stack.md` | Relace/důvěryhodná zařízení, kontext a autorizace, offline read-only přes IndexedDB + ETag, plán záloh, sdílené přílohy |
| `02-core-a-moduly.md` | Rozlišení osoby/účtu/členství/pověření, rodičovské zastupování, skupiny, propojení osobních zápůjček |
| `03-postup-vyvoje.md` | Blok schválených požadavků a otevřených implementačních závislostí, bez přepsání historického stavu kódu |
| `04-styl-prace.md` | Rozhodovací pravidla proti zbytečné administrativě, rozdíl komunikace a oficiální evidence |
| `05-motivace-a-vize.md` | Upravená formulace cíle projektu a závěrečné motto; dobrovolná komunikace mimo aplikaci |
| `06-specifikace-krojoveho-skladu.md` | Přímé externí zápůjčky, globální „Moje kroje“, dočasné přijetí cizích kompletů a hromadné předání, doplněné scénáře |
| `07-souborovy-system-vize-funkce-roadmapa.md` | Odstranění zastaralého návrhu hierarchických rolí, účast a upozornění, série a výjimky, ICS, děti, účet a odchody, skupiny, přílohy, offline, zálohy |
| `08-skupiny-opravneni-a-komunikace.md` | Volba historie chatů, archivace a skutečné mazání pouze archivovaných skupin, rodiče, přílohy, nahlášení zpráv |
| `09-soukrome-zpravy-dm-a-sifrovani.md` | Parametrická komunikace nezletilých, nahlášení pro všechny, DM po odchodu/úmrtí, offline a zálohy klíčů |
| `10-navigace-a-struktura-menu.md` | Osobní přehled napříč soubory, přepnutí kontextu vs. účtu vs. zastupování, externí kroje, kalendář, skupinové přílohy a offline banner |

## Významná nyní schválená rozhodnutí

- Souborový systém usnadňuje online komunikaci, ale nenutí zaznamenávat veškerý život souboru; **krojový sklad je autoritativní**.
- Jedno přihlášení, více samostatných folklorních souborů a **jeden osobní přehled**; žádná automatická společná evidence akce nebo skladu.
- Dětská samostatnost a komunikace řízené konfigurovatelnými profily; rodič jedná vlastním účtem za dítě.
- Zápůjčky cizích krojů mohou být přímo na osobu nebo hromadně mezi sklady prostřednictvím samostatného výdeje a dočasného příjmu.
- `last_viewed_at` detailu akce, důležitá změna, volitelné výslovné potvrzení; výzvy k účasti až v nastaveném předstihu (nácvik 7 dní, vystoupení 14 dní), nepovinná **měkká uzávěrka**.
- Série nácviků: konečné období, konkrétní výskyty, **jednorázové výjimky prázdnin a svátků** se stavem „Vynecháno“; negativní položky v osobním ICS odběru.
- Skupiny: volba dostupnosti historie, archivace, **smazání pouze archivované**; více kontextových odkazů na jediný počítačový soubor.
- Odchod, vyloučení a úmrtí neznamenají vymazání historie; zůstává omezený osobní přehled bývalého člena. U úmrtí lze volitelně zveřejnit označení zesnulého.
- Offline: automaticky připravený **text a metadata aktivního obsahu**, čtení bez možnosti zápisu; ETag + obnova cca po 10 minutách při aktivní aplikaci.
- Zálohy: denní u poskytovatele (14 dní) a plánovaný týdenní **šifrovaný externí archiv** databáze, příloh a obnovovacích klíčů.
- **Nahlášení zprávy dostupné ve všech souborech**, bez plošného zpřístupnění soukromých zpráv vedení.

## Stále otevřené otázky (nezaměňovat s hotovým zadáním)

1. Detaily 2FA, důvěryhodných zařízení a bezpečného přepínání několika přihlášených účtů v jednom prohlížeči.
2. Konkrétní bezpečnostní politiky DM nezletilých, osoba přijímající hlášení, střet zájmů, blokování a krizový postup.
3. Přesné retenční lhůty osobních údajů, IP a bezpečnostních logů, proces anonymizace a žádostí o výmaz.
4. Rozsah ukládané historie skupinového chatu offline a délka platnosti lokálních dat.
5. Přesná implementace správy odkazů na sdílené přílohy a ochrany před souběžným přepsáním.
6. Kalendářový ICS feed: tokeny, správa odběrů a reálné chování synchronizace klientů.
7. Exportní cesta databáze na hostingu bez ověřeného `mysqldump`, volba externího úložiště a test obnovy.
8. Časová a prioritní roadmapa implementace rozhodnutých funkcí.
