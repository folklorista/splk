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

I když první verze poběží jen pro jeden soubor, má být od začátku připravená na více souborů.

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

Smyslem není hned implementovat složité rozhraní pro více organizací. Smyslem je nepřijít později na to, že se musí doplnit `ensemble_id` do celé aplikace.

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
ensembles
users
ensemble_members
groups
group_members
roles
member_roles
ensemble_modules
```

Význam:

- `ensembles` – jednotlivé soubory / organizace,
- `users` – přihlašovací účty,
- `ensemble_members` – členství uživatele v konkrétním souboru,
- `groups` – skupiny uvnitř souboru,
- `group_members` – zařazení členů do skupin,
- `roles` – role typu admin, vedoucí, člen,
- `member_roles` – role člena v konkrétním souboru,
- `ensemble_modules` – zapnuté moduly a jejich nastavení.

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

Modul nástěnky slouží pro oznámení a interní sdělení.

Základní funkce:

- seznam příspěvků,
- detail příspěvku,
- důležitý příspěvek,
- cílení na skupiny,
- publikace od/do,
- později komentáře nebo potvrzení přečtení.

Možné entity:

```text
posts
post_target_groups
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
