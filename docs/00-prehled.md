# Souborový systém – produktový a technický kontext

## Cíl projektu

Cílem je vytvořit webovou aplikaci pro interní komunikaci a organizaci folklorního/tanečního souboru.

Primární cílová skupina první verze:

- dospělý soubor,
- pouze členové,
- bez rodičů a zákonných zástupců,
- mobilní použití jako hlavní scénář.

Do budoucna má být možné aplikaci rozšířit také pro:

- dětský soubor,
- jiné soubory s odlišnými pravidly,
- jiné potřeby v oblasti komunikace, docházky, krojů, dokumentů, oprávnění a případně plateb.

Projekt nemá být od začátku univerzální framework pro libovolnou organizaci. Má jít o konkrétní aplikaci pro soubor, která má od začátku připravené rozšiřovací body.

## Hlavní princip

Aplikace má být navržená podle zásady:

> Konkrétní aplikace pro jeden soubor, ale s připravenou strukturou pro více souborů, moduly a rozdílná pravidla.

To znamená:

- pevné jádro aplikace,
- pevné doménové moduly,
- žádné 100% dynamické REST API nad libovolnou databázovou tabulkou,
- konfigurace pouze tam, kde je pravděpodobné, že se soubory budou lišit,
- skupiny členů jako základ pro viditelnost, oprávnění a pravidla.

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
