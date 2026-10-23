# Výchozí katalog krojových součástí – Vonica

> **Status:** návrh číselníku druhů, upravený podle odpovědí z 2026-10-23 (D-37). Zmíněné `krojovy-katalog-vonica.csv` a zdrojová `.xls` v repozitáři nejsou (Q-15). JSON (`krojovy-katalog-navrh-2`) má 83 položek a počty odpovídají tabulce níže. Navíc má pole `cislovano` (false = nečíslovaná součást) a `oblast` (u Slovenska).

> **Pracovní návrh pro frontendové demo Krojařky.** Zdroj: `skladova-karta-chlapci (2).xls`, `skladova-karta-holky (2).xls`. Nejde o inventuru skutečných kusů ani o ověřený soupis evidenčních čísel.

## Jak číst katalog

- Zachovává názvy položek z původních karet, včetně případných zkratek či nejednotného pravopisu.
- Horní skupiny **Horňácko, Kopanice, Slovensko, Zálesí a Obuv** jsou odvozeny z nadpisů a rozložení skladových karet. **Obuv** je průřezová kategorie, ne krojový region (viz rozhodnutí níže).
- Varianta je uvedena jen tehdy, když vyplývá přímo z názvu řádku; podrobnější regionální hierarchii je potřeba potvrdit s krojařkou.
- Opakované názvy na různých řádcích (např. košile, spodnica, čelenka) se zatím **neslučují**. Některé řádky mohou být souhrnné a budou vyžadovat rozdělení při tvorbě finálního číselníku.
- Položky „kufr – Vonica“ (původně řádek 49 a 57, kategorie Ostatní) byly **odstraněny** – kufry a tašky se neevidují (2026-10-23).
- Řádek 28 „šátek bílý, jatelinka, červený“ je **rozdělen** na tři druhy (ID `ž-28a`–`ž-28c`).
- **Nečíslované součásti** (`cislovano: false`): kytička, korále, mašle barevné, mašle bílá. Ostatní se číslují.

## Přehled

| Pohlaví | Skupina | Počet řádků katalogu |
|---|---|---:|
| muži | Horňácko | 15 |
| muži | Kopanice | 6 |
| muži | Slovensko | 8 |
| muži | Zálesí | 1 |
| muži | Obuv | 2 |
| ženy | Horňácko | 27 |
| ženy | Kopanice | 9 |
| ženy | Slovensko | 11 |
| ženy | Obuv | 4 |

**Celkem: 83 položek** (85 řádků tiskopisů − 2 kufry + 2 nové položky z rozdělených šátků).

## Položky katalogu

### Muži

#### Horňácko

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 5 | košile | — |
| 6 | pruclek | — |
| 7 | nohavice Velické | Velická / Velické (výslovně v názvu) |
| 8 | řemen | — |
| 9 | šáteček | — |
| 10 | klobouk Velický | Velická / Velické (výslovně v názvu) |
| 11 | kabát bílý | — |
| 12 | kabát modrý | — |
| 13 | halena | — |
| 14 | traslavice | — |
| 15 | zástěra | — |
| 16 | pruclek Nová Lhota | Nová Lhota (výslovně v názvu) |
| 17 | nohavice Nová Lhota | Nová Lhota (výslovně v názvu) |
| 18 | klobouk Nová Lhota | Nová Lhota (výslovně v názvu) |
| 19 | kosáry | — |

#### Kopanice

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 24 | košile | — |
| 25 | vesta | — |
| 26 | nohavice | — |
| 27 | řemen | — |
| 28 | návleky | — |
| 29 | klobouk+bambulky | — |

#### Slovensko

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 32 | košile | — oblast Zemplín |
| 33 | košile stuhová | — oblast Zemplín |
| 34 | kordula | — oblast Zemplín |
| 35 | nohavice | — oblast Zemplín |
| 36 | řemen | — oblast Zemplín |
| 37 | klobouk | — oblast Zemplín |
| 38 | ostruhy | — oblast Zemplín |
| 39 | košile Moravské Lieskove | Moravské Lieskové (výslovně v názvu; oblast Moravské Lieskové) |

#### Zálesí

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 42 | opasek Zálesí | — |

#### Obuv

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 45 | čižmy | — |
| 46 | krpce | — |

### Ženy

#### Horňácko

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 5 | rubáč | — |
| 6 | strakaté rukávce | — |
| 7 | bílé rukávce | — |
| 8 | žluté rukávce | — |
| 9 | čepeček | — |
| 10 | šatka | — |
| 11 | šatka pracovní | — |
| 12 | fěrtoch žlutý | — |
| 13 | fěrtoch bílý | — |
| 14 | sukňa | — |
| 15 | fěrtuška kartůnová | — |
| 16 | fěrtuška modrá | — |
| 17 | fěrtuška červená | — |
| 18 | fěrtuška svát. Vyšívaná | — |
| 19 | fěrtuška červ. Originál | — |
| 20 | kabátek červený | — |
| 21 | kordula bílá velická | Velická / Velické (výslovně v názvu) |
| 22 | lajbl | — |
| 23 | kordula novolhotská | Nová Lhota (výslovně v názvu) |
| 24 | plachetka | — |
| 25 | vlňák | — |
| 26 | věneček | — |
| 27 | šátek rožkový | — |
| 28 | šátek bílý | — (rozděleno z „šátek bílý, jatelinka, červený“) |
| 28 | šátek jatelinka | — (rozděleno) |
| 28 | šátek červený | — (rozděleno) |
| 29 | kytička | — *(nečíslovaná)* |

#### Kopanice

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 31 | rukávce | — |
| 32 | leknica | — |
| 33 | zástěra tmavá | — |
| 34 | zástěra barevná | — |
| 35 | návleky | — |
| 36 | sak | — |
| 37 | čelenka | — |
| 38 | šátek turecký | — |
| 39 | spodnica | — |

#### Slovensko

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 40 | halenka | — oblast Zemplín |
| 41 | halenka Zemplín | Zemplín (výslovně v názvu; oblast Zemplín) |
| 42 | spodnička cudnička | — oblast Zemplín |
| 43 | spodnica | oblast Zemplín (slovenská/zemplínská spodnica) |
| 44 | kabátek barevný | — oblast Zemplín |
| 45 | sukňa barevná | — oblast Zemplín |
| 46 | korále | — *(nečíslovaná)*; oblast Zemplín |
| 47 | mašle barevné | — *(nečíslovaná)*; oblast Zemplín |
| 48 | mašle bílá | — *(nečíslovaná)*; oblast Zemplín |
| 49 | čelenka | oblast Zemplín (slovenská/zemplínská čelenka) |
| 50 | kapesník | — oblast Zemplín |

#### Obuv

| Řádek XLS | Druh / označení v kartě | Výslovně uvedená varianta |
|---:|---|---|
| 53 | horňácké tvrdé | — |
| 54 | slovenské měkké | — |
| 55 | krpce | — |
| 56 | botičky | — |

## Rozhodnutí k číselníku (2026-10-23, D-37)

1. **Horňácko – varianty:** varianta **může** mít vlastní číslování (košile Velická / Novolhotská), ale **nemusí** (červené / žluté rukávce = jedna řada, varianta je atribut). Rozhoduje se u každé řady zvlášť.
2. **Slovensko** se dělí na oblasti **Zemplín** a **Moravské Lieskové**; časem mohou přibýt další. Na skladové kartě byly sloučené jen proto, že košile z Moravského Lieskového přibyly později. Všechny slovenské součástky kromě košile Moravské Lieskové patří k oblasti **Zemplín** (2026-10-23).
3. **Obuv:** některé součástky patří jen k jednomu regionu (horňácké tvrdé čižmy). Když pro člověka nemáme vhodnou obuv, může nosit „univerzální“ měkké boty, které se běžně používají k Zemplínu a Moravskému Lieskovému.
4. **Souhrnné řádky:** „šátek bílý, jatelinka, červený“ rozdělit (provedeno). „Klobouk+bambulky“ zůstává jedna součástka; chybějící bambulky se uvedou v poznámce ke kusu.
5. **Zdánlivé duplicity jsou různé řady:** slovenská košile (obyčejná) × slovenská košile stuhová; kopanická × slovenská (zemplínská) spodnica; kopanická × slovenská (zemplínská) čelenka.
6. **Kufry a tašky se neevidují** (odstraněno).

## Doporučení pro demo

Katalog importovat pouze jako **návrh číselníku druhů**, nikoli jako jednotlivé fyzické kusy. Frontend umožní procházení podle pohlaví a regionální skupiny, vyhledávání podle názvu a editaci/rozštěpení položek po konzultaci s krojařkou. **Evidenční čísla, stavy skladu ani držitele tyto dva tiskopisy neobsahují.**

## Datové exporty

- `krojovy-katalog-vonica.csv` – tabulka pro ruční kontrolu a import (v repozitáři není, Q-15; neodpovídá už verzi 2).
- `krojovy-katalog-vonica.json` – strukturovaný seznam pro seed frontendového dema.
