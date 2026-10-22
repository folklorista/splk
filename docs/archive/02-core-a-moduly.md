# Core aplikace a moduly

## Základní myšlenka

Aplikace má být postavená jako pevné jádro a sada modulů.

Jádro řeší věci, které budou potřeba vždy:

- soubory / organizace,
- uživatelé,
- členství,
- skupiny,
- role a oprávnění,
- autentizace,
- základní nastavení,
- povolené moduly.

Moduly řeší konkrétní oblasti:

- nástěnka,
- akce,
- docházka,
- krojová databáze,
- dokumenty,
- komentáře,
- notifikace,
- později platby, omluvenky nebo chat.

## Multi-tenant připravenost

První provozní zaměření zůstává dospělá Vonica, ale cílový model počítá s dospělou Vonicí a samostatnou Malou Vonicí na **jedné doméně a se společným přihlášením**.

Proto má být v modelu pojem:

```text
ensemble / organization / soubor
```

Většina dat by měla patřit ke konkrétnímu souboru.

Příklady entit s vazbou na soubor:

- členové,
- skupiny,
- příspěvky,
- akce,
- krojové díly,
- dokumenty,
- nastavení.

Souborový kontext se musí přepínat v rozhraní i kontrolovat na serveru. Osobní přehled agreguje údaje napříč přístupnými soubory; společné vystoupení může být samostatnou akcí v každém z nich. Nezavádět povinné sdílené skladové položky ani „nadřazenou organizaci“ jen kvůli společné doméně.

## Skupiny jako základ pravidel

Skupiny jsou klíčová entita. Nemají být jen doplněk k uživateli.

Příklady skupin:

- dospělí,
- děti,
- kluci,
- holky,
- muzikanti,
- tanečníci,
- vedoucí,
- přípravka,
- starší děti.

Člen může být ve více skupinách.

Skupiny se budou používat pro:

- cílení příspěvků,
- cílení akcí,
- viditelnost dokumentů,
- pravidla půjčování krojů,
- oprávnění,
- notifikace.

## Doporučené core entity

První návrh core entit:

```text
persons
users
user_person_links
ensembles
ensemble_memberships
parent_child_links
groups
group_memberships
mandates
mandate_assignments
ensemble_modules
sessions
```

Význam:

- `persons` – evidované fyzické osoby, včetně dětí, bývalých členů a externích vypůjčitelů bez účtu;
- `users`, `user_person_links` – přihlašovací účty a bezpečná vazba na osobu;
- `ensembles`, `ensemble_memberships` – samostatné folklorní soubory a historizované členství osoby v konkrétním souboru;
- `parent_child_links` – rodičovské/zástupcovské vazby a rozsah jednání za dítě;
- `groups`, `group_memberships` – skupiny daného souboru a intervaly členství;
- `mandates`, `mandate_assignments` – **nezávislá pověření** pro soubor, skupinu, akci či modul (nikoli pevně děděná hierarchie admin/vedoucí/člen; viz `08`);
- `ensemble_modules` – zapnuté moduly a jejich nastavení;
- `sessions` – serverem spravované, odvolatelné přihlašovací relace.

Jde o **logické entity, nikoli definitivně schválená jména tabulek**. Přesná implementace se přizpůsobí existujícím modelům po revizi kódu.

## Průřezové vztahy a pravidla

- **Rodičovské zastupování:** předškolák jedná přes zástupce; žák 1. stupně může mít omezený účet bez chatu; 2. stupeň se skupinovým chatem podle politiky souboru a povinným rodičovským účtem; středoškolák s plným účtem a nepovinnou vazbou rodiče. Jde o nastavitelné profily samostatnosti, ne automatické věkové soudy.
- **Politiky souborů:** pravidla komunikace nezletilých a výchozí parametry akcí jsou specifická pro folklorní soubor; skupina smí bezpečnostní politiku zpřísnit, nikoli obejít.
- **Osobní agendy napříč soubory:** `Moje kroje` mohou obsahovat zápůjčku ze skladu, v němž osoba nemá členství, **bez přístupu do jeho evidence**. Autoritativní sklad vlastníka a případný dočasný příjem jiným souborem jsou oddělené záznamy.
- **Životní cyklus:** odchod, vyloučení, úmrtí, návrat a deaktivace dlouho neaktivního účtu jsou odlišné operace; potřebné historické záznamy zůstávají. Archivovat lze skupinu, smazat pouze již archivovanou skupinu (obsah skupiny se skutečně odstraní; nezávislá evidence ne).
- **Přílohy:** jeden počítačový soubor (`file`) a více kontextových odkazů (`attachment`) v chatu, nástěnce a galeriích. Nelze zpřístupňovat soukromé soubory pouhým uhodnutím jejich URL.
- **Offline:** pouze lokálně nacachovaný aktivní text a metadata, žádné zápisy; aktuální snímky po modulech s ETag (viz `01`).

## První moduly

První verze by měla směřovat k těmto modulům:

1. Dashboard.
2. Nástěnka.
3. Akce.
4. Docházka.
5. Členové.
6. Krojová databáze.

## Dashboard

Dashboard má být rychlý mobilní rozcestník.

Typický obsah:

- nejbližší akce,
- důležité oznámení,
- moje nepotvrzené účasti,
- moje půjčené kroje,
- poslední novinky.

## Nástěnka

Modul nástěnky slouží pro oznámení a interní sdělení. Každá skupina může mít vlastní nástěnku a chat; obsah vidí jen osoby s příslušným obsahovým oprávněním. **Správa souboru sama o sobě nezpřístupňuje soukromý obsah skupiny** (viz `08`).

Základní funkce:

- seznam příspěvků nástěnky skupiny,
- detail příspěvku,
- důležitý příspěvek,
- publikace od/do,
- později komentáře nebo potvrzení přečtení.

Možné entity:

```text
posts (group_id)
post_comments
```

## Akce

Modul akcí slouží pro zkoušky, vystoupení, soustředění, schůzky a další události.

Základní funkce:

- seznam akcí,
- detail akce,
- datum a čas,
- místo,
- popis,
- cílení na skupiny,
- potvrzení účasti.

Možné entity:

```text
events
event_target_groups
event_attendance
```

## Docházka

Docházka je navázaná na akce.

První jednoduchý model může mít stavy:

- nezadáno,
- přijdu,
- nepřijdu,
- možná.

Později lze rozšířit o:

- přijdu pozdě,
- přijdu bez kroje,
- beru auto,
- mám volná místa,
- poznámku pro vedoucího.

## Členové

Modul členů slouží pro přehled lidí v souboru.

Základní funkce:

- seznam členů,
- detail člena,
- skupiny člena,
- kontaktní údaje podle oprávnění,
- aktivní/neaktivní členství.

## Krojová databáze

Krojová databáze bude modul, ne základ celé aplikace.

Základní funkce:

- evidence krojových kategorií,
- evidence krojových dílů,
- fotografie,
- velikosti / míry,
- stav,
- výpůjčky,
- přiřazení členovi,
- omezení podle skupin.

Důležitý princip:

- pravidla půjčování mají být vyjádřena přes konkrétní doménové vazby,
- ne přes univerzální dynamický systém.

Například:

```text
costume_categories
costume_items
costume_assignments
costume_category_allowed_groups
```

Tím lze vyjádřit pravidlo:

> Členům ve skupině „kluci“ lze půjčovat díly z kategorií „chlapecké kroje“.
