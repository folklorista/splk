# Souborový systém – produktový a technický kontext

> **ARCHIV – nezávazné.** Původní přehled produktu (2026-06-23, doplněno 2026-10-18). Model samostatných souborů se společnou identitou nahradilo rozhodnutí D-06 (model se složkami). Platí `docs/decisions.md`; viz `docs/archive/README.md`.


## Cíl projektu

Cílem je vytvořit webovou aplikaci pro interní komunikaci a organizaci folklorního/tanečního souboru.

Primární cílová skupina první verze:

- dospělý soubor,
- pouze členové,
- bez rodičů a zákonných zástupců v prvním provozním rozsahu (nikoliv jako trvalé omezení architektury),
- mobilní použití jako hlavní scénář.

Do budoucna má být možné aplikaci rozšířit také pro:

- dětský soubor,
- jiné soubory s odlišnými pravidly,
- jiné potřeby v oblasti komunikace, docházky, krojů, dokumentů, oprávnění a případně plateb.

Projekt nemá být od začátku univerzální framework pro libovolnou organizaci. Má jít o konkrétní aplikaci pro soubor, která má od začátku připravené rozšiřovací body.

## Hlavní princip

Aplikace má být navržená podle zásady:

> Jedna aplikace se společným přihlášením může sloužit více samostatným folklorním souborům; každý má vlastní data, skupiny, agendy a pravidla. Digitalizujeme jen to, co skutečně usnadňuje život souboru.

To znamená:

- pevné jádro aplikace,
- pevné doménové moduly,
- žádné 100% dynamické REST API nad libovolnou databázovou tabulkou,
- konfigurace pouze tam, kde je pravděpodobné, že se soubory budou lišit,
- skupiny členů jako základ pro viditelnost, oprávnění a pravidla.

## Upřesněná produktová pravidla (rozhodnutí z 18. 10. 2026)

- Aplikace **nenahrazuje osobní domluvy, Messenger ani veškerou komunikaci**. Má být pohodlnějším místem pro online organizaci než roztříštěné chaty, externí formuláře a tabulky. Nezavádět úkoly a evidenci jen kvůli evidenci.
- **Krojový sklad je autoritativní evidence** skutečného svěření a pohybu krojů. **Docházka je orientační**: sleduje slib, případné změny a skutečnou účast bez automatických sankcí.
- `moje.vonica.cz` využívá **globální identitu a přihlášení**; dospělá Vonica a Malá Vonica jsou **samostatné soubory** bez automaticky sdílených akcí či skladů. Osobní přehled však bezpečně agreguje relevantní informace z obou.
- Dětské soubory potřebují samostatná, konfigurovatelná pravidla rodičovského zastupování a komunikace; rodič může být současně vedoucím či členem jiné skupiny/souboru.
- Offline provoz je pouze **pro čtení aktivních textových dat**; žádné změny mimo spojení a žádné automatické odesílání offline zápisů.

**Status:** Tato pravidla jsou odsouhlaseným cílovým chováním, nikoliv konstatováním, že už jsou v aplikaci implementována.

## Hlavní oblasti aplikace

První úvahy počítají s těmito oblastmi:

1. Přihlášení a uživatelský účet.
2. Členové souboru.
3. Skupiny členů.
4. Nástěnka / oznámení.
5. Akce a kalendář.
6. Docházka / potvrzení účasti.
7. Krojová databáze.
8. Dokumenty a soubory.
9. Notifikace.
10. Nastavení souboru.

Pro první MVP není nutné implementovat vše. Důležité je připravit strukturu tak, aby se moduly daly přidávat postupně.

## Mobilní-first přístup

Předpoklad je, že přibližně 95 % běžného provozu bude probíhat na mobilu.

Mobilní aplikace/web má rychle pokrýt hlavně tyto scénáře:

- přečíst oznámení,
- zjistit nejbližší akci,
- potvrdit účast/neúčast,
- napsat krátkou poznámku,
- podívat se na vlastní povinnosti nebo půjčené kroje,
- najít základní kontakt.

Desktop nesmí být návrhem znemožněn. Desktop bude vhodný hlavně pro:

- správu členů,
- plánování akcí,
- práci s krojovou databází,
- hromadné úpravy,
- exporty,
- administraci a nastavení.

## Poučení z krojové databáze

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
