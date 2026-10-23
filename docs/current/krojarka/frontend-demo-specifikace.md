# Krojařka · `krojarka.vonica.cz`

**Zadání samostatného frontendového dema**  
**Stav:** pracovní návrh, 22. 10. 2026. Směr je rozhodnutý (D-02, D-22); obrazovky K01–K25 a práce se skeny jsou návrh k ověření s krojařkou. Doménová pravidla: `../06-specifikace-krojoveho-skladu.md` v0.5.  
**Produkt:** Krojová evidence a první digitální inventura Slováckého souboru Vonica  
**Rozsah dokumentu:** informační architektura, obrazovky, UX, demo scénáře a podklady pro přílohy / skeny. **Není** to nová specifikace doménového modelu ani zadání kompletního backendu.

## 1. Cíl a hranice

První úspěšné nasazení Souborového systému je **první skutečná digitální inventura krojů**, kterou krojařka a její pomocnice zvládnou při práci s fyzickými kroji. Souborový portál `moje.vonica.cz` může existovat paralelně a na zahájení inventury není potřeba dokončit jeho ostatní funkce.

`krojarka.vonica.cz` je úzce zaměřené pracovní rozhraní. Očekávaní uživatelé jsou krojařka a pověřené pomocnice. Nejčastější zařízení je mobil při práci ve skladu či s členem; počítač slouží k přípravě katalogu, kontrole evidence, větším úpravám, tisku a exportu.

**Hlavní principy:**

1. Při první digitalizaci **nepřepisovat automaticky papírové záznamy na pravdivý aktuální stav**. Sken je podklad; ověřený záznam vzniká kontrolou nebo potvrzeným přepisem.
2. **Osoby převádět postupně.** Zatím nepřevedená osoba zůstává v režimu papírové evidence, převedená osoba už využívá digitální zápisy.
3. Jeden konkrétní předmět po jeho zavedení do aktivní digitální evidence dále spravovat digitálně; nové digitální zápůjčky lze vydat i dosud nepřevedené osobě.
4. Při inventuře nabídnout minimum kroků: vyhledat osobu / řadu / komplet → nahlédnout do podkladu → zkontrolovat → uložit.
5. Neztratit historii a nezaměnit číselné řady. Identita kusu není samotné evidenční číslo.
6. Nesrovnalost je legitimní výsledek; **nezkontrolováno**, **nepředloženo** a **nenalezeno** nejsou synonyma.
7. Frontendové demo má být uvěřitelné a proklikatelné; backend, migrace a přesné doménové entity jsou samostatná práce.

### 1.1 Vztah k existující aplikaci

- *Neplatí (D-31, 22. 10. 2026): z dema se nepřebírá žádný kód.* ~~Demo využije jako východisko existující Angular implementaci Správy krojů (`/wardrobe`): sklad, karty, zápůjčky, inventury, nastavení. Je vhodné zachovat její zaběhnuté scénáře a formuláře, nikoli stavět druhou definici pravidel.~~
- Novými prioritami jsou samostatné rozhraní, adresář všech osob se skeny, archiv dokladů, převod papírové evidence a foto přílohy.
- Společný budoucí PHP REST backend (`api.vonica.cz`, PostgreSQL 18, D-11 a D-12) bude sloužit také portálu `moje.vonica.cz`. Aplikace žije v monorepu spolu s API (D-03). Frontend Krojařky se má dát nasadit samostatně. **Nezavádět nyní `admin.vonica.cz` jako předpoklad.**
- Uživatelé bez účtu (včetně osob vedených pro historické zápůjčky) zůstávají plnohodnotnými osobami evidence; členství a účet se přidávají až tehdy, kdy budou potřebné. Identitní vazby popisuje `../identity-model-v2.md` (směr schválen v D-06 a D-07). Krojařka pracuje s fondem své složky. Krojařky jiných složek vidí jen seznamy lidí, pomocnice mají stejná práva (D-21).

## 2. Rozsah dema a pořadí

Značky: **P0** = pro první průchozí demo; **P1** = potřeba pro důvěryhodnou první inventuru; **P2** = dopracování před běžným ostrým provozem nebo navazující iterace. Neznamená to, že P2 ruší požadavky platné funkční specifikace v1.0.

| Oblast | Priorita | Výsledek pro demo |
|---|---|---|
| Přehled / rychlé akce | P0 | Krojařka ví, co má udělat dál |
| Osoby a osobní karty | P0 | Založení osoby, dohledání, skeny papírové karty |
| Katalog a číselné řady | P0 | Připravená klasifikace před inventurou |
| Komplety a soupisy | P0 | Komplet má kartu, podkladový sken a známé/ověřené složení |
| Dokumenty a mobilní snímání | P0 | Vyfotit, připojit, zobrazit, přidat novější verzi |
| Nová součást / detail součásti | P0 | Fyzický kus lze jednoznačně zavést |
| Inventura – osoby a sklad | P0 | Fyzická kontrola, rychlé zadání, nesrovnalosti |
| Převod papírové karty | P0 | Řízený přechod osoby na digitální evidenci |
| Výdej, vrácení, výměna | P1 | Po převodu zůstává evidence použitelná |
| Inventura kompletů, nečíslované množství | P1 | Funkční specifikace se plní i pro reálné tašky a mašle |
| Tisk, CSV, rekapitulace | P1 | Výsledky kontroly lze předat a archivovat |
| Opravy, vyřazení, historické události | P1 | Dlouhodobý provoz evidence |
| Rezervace inventurních termínů | P2 | Pro první interní demo lze použít zjednodušený seznam návštěv |
| Pokročilé hromadné převody mezi sklady | P2 | Zachovat jako požadavek původní specifikace; nedělat pro první demo |
| QR štítky, OCR, automatické čtení karet | Mimo demo | Sken je obrázek, nikoliv automatický převod dat |
| Základní finanční evidence | součást základu aplikace (D-23) | Rozsah zatím neurčen (Q-03); obrazovky dosud nenavrženy |

## 3. Navigace a orientace

### 3.1 Primární menu

**Rozhodnuto (D-22, 22. 10. 2026)** – boční menu:

| Položka | Obsah |
|---|---|
| **Přehled** | co dělat dál (K02) |
| **Součástky** | katalog podle evidenčních řad, **včetně kompletů** (K08–K12) |
| **Krojové karty** | lidé s výpůjčkami a jejich karty (K05) |
| **Lidé** | všechny osoby evidence včetně těch bez výpůjček; papírové karty a převod (K03, K04, K06, K07) |
| **Výpůjčky** | skladové pohyby od nejnovějších po nejstarší (K13–K15) |
| **Inventury** | K16–K22 |
| **Dokumenty** | archiv skenů a podkladů (K23) |
| **Přehledy** | tisk a export (K25) |
| **Hledat** | osoba / komplet / řada a číslo |
| **Nastavení** | katalog, řady, drobné nastavení (K24) |
| **Můj účet** | přihlášená krojařka, odhlášení |

Položky Lidé, Dokumenty a Přehledy byly doplněny 23. 10. (D-22). Otevřené: zda vyčlenit Komplety do samostatné položky (Q-04) a podoba mobilní lišty (Q-17).

*Původní návrh (nahrazen):* mobil Přehled · Lidé · Sklad · Inventury + Více; desktop Přehled · Lidé · Sklad · Komplety · Zápůjčky · Inventury · Dokumenty · Katalog a nastavení. Pojem „Sklad“ pro seznam součástí odporoval terminologii (sklad = místnost, D-17).

Primární akce `+` je kontextová; nemá působit jako globální univerzální formulář.

**Obecné UX:** vždy viditelné globální hledání **osoba / komplet / řada a číslo**; vyhledání „17“ bez řady nemusí být jednoznačné. Odkazy mezi detaily zachovávají návrat do inventurního kontextu. V rámci dlouhých formulářů pevná spodní lišta s hlavním uložením. Při uložené změně jasné potvrzení, při chybě zachovat rozepsanou práci.

### 3.2 Návrh tras (pracovní, nikoli závazný refaktor stávajících routes)

*Poznámka 22. 10.: trasy vznikly před rozhodnutím D-22. `/people` odpovídá položce Lidé, seznam Krojových karet je pohled na osoby s výpůjčkami (trasa zatím nenavržena), `/stock` + `/kits` položce Součástky, `/documents` Dokumentům a `/reports` Přehledům; názvy tras se ověří při implementaci.*

```text
/                                 Přehled
/people                           Seznam osob
/people/new                       Nová osoba
/people/:id                       Detail osoby + digitální krojová karta
/people/:id/edit                  Úprava osoby
/people/:id/paper                 Papírové podklady a stav převodu
/people/:id/migration             Průvodce převodem osoby
/stock                            Sklad součástí
/stock/new                        Nová součást
/stock/:id                        Detail součásti
/stock/:id/edit                   Úprava součásti
/kits                             Seznam kompletů
/kits/new                         Nový komplet
/kits/:id                         Detail kompletu a složení
/kits/:id/edit                    Úprava kompletu
/loans                            Přehled zápůjček
/loans/new                        Výdej jednotlivých součástí / kompletu
/loans/:id                        Detail zápůjčky / její vrácení
/inventories                      Seznam inventur
/inventories/new                  Založení inventury
/inventories/:id                  Detail a přehled průběhu
/inventories/:id/people/:personId Kontrola osoby
/inventories/:id/stock/:seriesId  Kontrola skladu po řadě
/inventories/:id/kits/:kitId      Kontrola kompletu
/inventories/:id/issues           Nesrovnalosti a uzavření
/documents                        Archiv podkladových skenů
/documents/:id                    Náhled dokumentu / přiřazení
/settings/catalog                 Regiony, pohlaví, varianty, druhy
/settings/series                  Evidenční řady
/settings                         Drobné nastavení Krojařky
/reports                          Přehledy, tisk a exporty
```

## 4. Obrazovky – detailní UX zadání

### K01 · Přihlášení a přístup (P0)

**Účel:** jednoduchý vstup pouze pro pověřené osoby. Formulář přihlášení, identita přihlášené krojařky, odhlášení, informační stav demo / ostré prostředí. V demo režimu lze nabídnout volbu „Krojařka“ / „Pomocnice“, která pouze simuluje role. Neimitovat produkční bezpečnost přes localStorage.

### K02 · Přehled práce (P0, `/`)

**Obsah:** otevřená inventura a její postup, počet osob s nepřevedenou kartou, počet osob převedených, nové nesrovnalosti, otevřené zápůjčky, poslední změny. Výrazné rychlé akce: **Najít osobu**, **Zkontrolovat součást**, **Vyfotit papírovou kartu**, **Přidat komplet**, **Vydat kroj**. Nevytvářet obecný souborový dashboard ani grafy bez užitku.

**Prázdný stav:** „Zatím nemáte žádné osoby ani kroje“ + průvodce pořadím: katalog → lidé → skeny → komplety → inventura.

### K03 · Lidé (P0, `/people`)

**Obsah:** seznam **všech** osob relevantních pro krojovou evidenci, nejen aktivních členů nebo držitelů zapůjčených věcí. Vyhledávání jména bez diakritiky, filtr `Papírová evidence / Převádí se / Digitální evidence`, volitelné `Má zápůjčky / Má sken / Bez skenu`, rozlišení stejnojmenných osob. Na řádku jméno, poslední sken, počet digitálních zápůjček, stav převodu, poslední inventurní ověření.

**Akce:** + Nová osoba; otevřít kartu; rychle přidat sken. Při založení upozornit na možné duplicity, ale neblokovat oprávněné shody jmen.

### K04 · Nová / úprava osoby (P0)

**Obsah:** jméno a příjmení, případně rozlišující poznámka / kontakt; jiné osobní údaje jen pokud mají konkrétní účel. Volitelná poznámka, odkud karta pochází, a její označení v šanonu. Nevytvářet automaticky přihlašovací účet ani členství. Uložení otevře detail a nabídne „Vyfotit osobní kartu“.

### K05 · Detail osoby – digitální krojová karta (P0, `/people/:id`)

**Hlavička:** identita, stav převodu, počet aktuálních digitálně evidovaných součástí a kompletů, případné upozornění na současný papírový režim. Rychlá akce `Přidat sken`, `Spustit / pokračovat v převodu`, `Vydat`, `Zaznamenat vrácení`, `Otevřít inventurní kontrolu`.

**Záložky:**
- **Aktuálně svěřeno:** digitálně evidované položky seskupené podle regionu a typu kroje, včetně jednotlivých součástí z kompletů; po termínu, stav a navazující akce.
- **Papírová karta:** galerie snímků, datum jejich pořízení, varování „sken nemusí zahrnovat novější zápisy“, prohlížeč s přiblížením. Odkaz na průvodce převodem.
- **Historie:** digitální výdeje, vrácení, výměny, inventurní kontroly a původ zápisu; **nedeklarovat naskenované papíry za strukturovanou historii**.
- **Poznámky / dokumenty:** další podklady relevantní pouze pro tuto osobu.

**Důležitý souběh:** i člověk v papírovém režimu může mít *nové digitální zápůjčky*. UI je zobrazuje odděleně od neznámého obsahu papírové karty.

### K06 · Papírové podklady a stav převodu (P0, `/people/:id/paper`)

**Obsah:** chronologicky seřazené snímky **osobní karty**. U každého snímku datum pořízení, kdo ho nahrál, označení listu/strany, poznámka; označit starší snímek jako archivní, nikoli jej přepisovat. Viditelné datum posledního porovnání s fyzickým originálem.

**Stavy:** `Papír je autoritativní` → `Převod rozpracován` → `Digitální evidence je autoritativní`. Akce `Novější fotografie`, `Ověřeno s originálem`, `Začít převod`. Text upozornění, že sken může zastarat, dokud je originál aktivní.

**Pravidlo:** kdykoliv se po naskenování změní papírový originál, krojařka při další návštěvě otevře originál nebo pořídí nový snímek. Neslibovat automatickou synchronizaci papíru s aplikací.

### K07 · Průvodce převodem osoby (P0, `/people/:id/migration`)

**Kroky:**
1. **Podklady:** zobrazit poslední sken a datum; potvrdit, že byl zkontrolován aktuální papírový originál (nebo zapsat, že není dostupný).
2. **Předložené věci:** seznam očekávaných podle podkladů *jen pokud byly ručně zadány*; jinak prázdný a možnost rychle přidat součást / komplet. Fyzicky zkontrolované položky zapisovat jednotlivě nebo v dávce.
3. **Nejasnosti:** poznamenat zápisy na kartě, které neodpovídají skutečnosti; rozlišit nepředloženou, neověřenou, doloženou pouze z papíru a nově nalezenou věc. Neuzavírat existující půjčku fiktivním vrácením.
4. **Rekapitulace:** co je digitálně ověřeno, co má osoba nově oficiálně svěřeno, které papírové otázky zůstaly otevřené.
5. **Převzetí evidence:** výslovné potvrzení „Od této chvíle se změny u této osoby zapisují elektronicky“ s datem, jménem krojařky a archivací papírové karty.

**Blokování:** finalizace nesmí nenápadně duplikovat existující digitální zápůjčky. Nevyřešené položky mohou zůstat jako explicitní nesrovnalosti; pravidlo, zda konkrétní typ otevřené nesrovnalosti brání potvrzení, je nutné při pilotu ověřit s krojařkou. „Převedeno“ neznamená, že byl fyzicky zkontrolován veškerý majetek souboru.

### K08 · Součástky – seznam součástí (P0, `/stock`)

**Obsah:** řady a součásti, hledání např. „kopaničká košile 17“, filtry region / pohlaví / varianta / druh / řada / dostupnost / aktuální držitel / inventurní ověření. Zobrazení seskupené podle řady a volitelné tabulky. Štítky: sklad, zapůjčeno, mimo sklad, vyřazeno, původ údaje a datum ověření. Akce `Nová součást`, `Vydat`, `Export`, `Tisk`.

**Pozor:** fyzicky neexistující číslo není automaticky chybějící předmět; mezera v řadě může být nepoužité číslo.

### K09 · Nová / úprava součásti (P0)

**Obsah:** řada, číslo (případně zatím bez čísla), varianta, velikost, popis, dlouhodobá poznámka, umístění, komplet, fotografie. Zobrazovat nepoužitá a případně znovu použitelná čísla podle pravidel řady. Rozlišit `úmyslně neočíslovaný zaměnitelný druh` a `číslovaný kus, jehož číslo ještě neznáme`. Formulář nesmí měnit historii jiného kusu se starým znovu použitým číslem.

**Inventurní vstup:** otevřeno z rychlého zadání v inventuře s předvyplněnou řadou a číslem; po uložení vrátit na rozpracovanou kontrolu.

### K10 · Detail součásti (P0)

**Obsah:** čitelné označení `řada + číslo`, aktuální držitel / komplet / místo, fotografie, velikost a poznámky, dostupnost pro výdej, naposledy fyzicky ověřeno a původ údajů. Sekce **Historie držení**, **Inventurní kontroly**, **Pohyby**, **Přílohy**; akce `Vydat`, `Vrátit`, `Vyměnit`, `Upravit`, `Vyřadit` (potvrzení a historický záznam). Poznámka při vrácení zůstává u dané historické události; aktuální poznámku lze změnit nezávisle.

### K11 · Komplety (P0, `/kits`; v menu pod Součástkami, D-22)

**Obsah:** karty/řádky kompletů s vlastním označením, typem kroje, současným držitelem, počtem položek, stavem `složení neověřeno / úplný / neúplný / čeká na kontrolu`, počtem skenů. Filtrování a hledání podle čísla nebo druhu kompletu; `Nový komplet`, `Otevřít`, `Vydat`.

### K12 · Založení / detail / úprava kompletu (P0/P1)

**Založení:** řada a číslo kompletu (vlastní řady kompletů, D-35), region/pohlaví/varianta, stručný popis, **připojit fotografii lístku na tašce a historickou kartu kompletu**.

**Detail:** odděleně **předepsané (určené) složení**, **aktuálně přítomné položky**, **samostatně půjčené**, **neověřené / chybějící**. U číslovaných součástí řada + číslo, u zaměnitelných množství `1 ze 2`. Zobrazit původ soupisu: opsáno z lístku vs. fyzicky zkontrolováno. Historie zápůjček kompletu včetně toho, *co bylo při konkrétním výdeji skutečně předáno*.

**Akce:** `Vyfotit soupisku`, `Zkontrolovat komplet`, `Přidat / odebrat / přesunout součást`, `Vydat celý komplet`, `Vrátit komplet`, `Tisk soupisu`. Změna předepsaného složení zpětně nemění starší výdeje.

### K13 · Zápůjčky – přehled (P1, `/loans`)

**Obsah:** otevřené / po termínu / historie; hledat osobu, komplet, číslo součásti; rozlišit individuální zápůjčky a hromadné předání kompletu. Na řádku vypůjčitel, obsah, datum, předpokládané vrácení, stav, poznámka. Přístup na osobní kartu nebo detail kusu a export.

### K14 · Nový výdej (P1, `/loans/new`)

**Tok:** vybrat osobu (případně rychle založit) → přidat jednotlivé dostupné součásti **nebo komplet** → u kompletu ukázat přesné položky skutečně vydané a předem označit nedostupné → datum, volitelný termín, poznámka → potvrzení. Změny se zaznamenají jednou; nedostupné kusy nelze omylem vykázat jako vydané. U osoby v papírovém režimu nabídnout upozornění „Tento nový výdej se vede digitálně“.

### K15 · Vrácení / částečné vrácení / výměna (P1)

**Tok:** otevřít zápůjčku → u každé součásti potvrdit vrácení nebo ponechat otevřené → poznámka u **každého řádku** → případné označení „zatím nelze znovu vydat“ → potvrzení. U dvou mašlí umožnit návrat `1 ze 2`. Výměna musí ukázat, zda původní kus byl fyzicky vrácen. Výsledek zachová původní obsah předání i jeho historii.

### K16 · Seznam inventur (P0, `/inventories`)

**Obsah:** probíhající nahoře, dokončené zvlášť; název, čas, rozsah, postup, počet neověřených a nesrovnalostí, kdo inventuru založil. Nová inventura; pokračovat; zobrazit starší výsledky. Uživatelsky explicitní režim „První digitalizační inventura“ jako UX pracovní postup – **nepředjímat novou entitu**, pokud to stávající model nepotřebuje.

### K17 · Založit inventuru (P0)

**Obsah:** název a popis, rozsah (celý sklad / konkrétní region, pohlaví, druh, varianta / vybraná skupina osob), živý náhled počtu známých kusů a osob, datum zahájení. Pro první inventuru upozornit, že v databázi může být zatím **méně kusů, než fyzicky existuje**, a proto procento pokroku vůči známým kusům není procentem z celého reálného fondu.

### K18 · Detail inventury a režimy (P0, `/inventories/:id`)

**Hlavička:** stav, rozsah, průběh, poslední aktivita, přímé akce. Hlavní záložky **Podle lidí · Ve skladu · Komplety · Nesrovnalosti · Výsledky** (termíny jako volitelná sekundární záložka).

- **Podle lidí:** seznam osob se stavem návštěvy, dostupnými skeny, počtem kontrol a odkazem na převod osoby.
- **Ve skladu:** evidenční řady s počty ověřeno/neověřeno. Možnost zapsat i nově nalezený, dosud neexistující kus.
- **Komplety:** přehled kontrol tašek včetně neověřeného složení a početních doplňků.
- **Nesrovnalosti:** neznámé číslo, konflikt s papírem, kus u jiného držitele, chybějící součást, nepředložený kus, nedohledaný komplet.
- **Výsledky:** stabilní výstupy, tisk, CSV, ukončení s přiznanými otevřenými položkami.

### K19 · Inventurní návštěva osoby (P0)

**Kontext:** jméno, poslední snímek její původní karty, stav převodu, aktuální digitální zápůjčky. Na mobilu lze otevřít sken v překryvném panelu a vrátit se bez ztráty rozepsané kontroly.

**Akce:** `Zahájit návštěvu`; rychle najít/načíst součást podle řady a čísla; `Fyzicky ověřeno`, `Poškozeno / vyžaduje úpravu`, `Nepředloženo`, `Zatím nekontrolováno`; podle potřeby přidat nově zjištěnou součást, poznámku či fotografii; v rámci kontroly provést vydání, vrácení nebo výměnu. Ukázat zjevné rozpory se starým skenem. `Dokončit návštěvu` se souhrnem a možností ponechat otevřené problémy.

**Důležité:** dokončení návštěvy není totéž co fyzické ověření všech kusů. Pouhé ujištění vypůjčitele se nezapočítává jako osobní inventurní kontrola krojařky.

### K20 · Inventura skladu po řadách (P0)

**Obsah:** velké pole evidenčního čísla s numerickou klávesnicí a opakovaným automatickým návratem focusu; dávkový vstup `1, 3, 7, 12-15`, stav právě zadaných hodnot, číselná mřížka. Reakce na číslo: **známý kus → potvrdit kontrolu**, **známý, ale veden u osoby → výrazný konflikt a kontrola před opravou**, **číslo neexistuje → nabídnout založení**, **již ověřeno → upozornit, nezduplikovat**. Označit `Nenalezeno` bez automatického vyřazení. Po uložení další číslo jedním klepnutím.

### K21 · Inventura kompletu (P1)

**Obsah:** sken lístku a karty, očekávané složení, aktuálně dostupné vs. dočasně vypůjčené, při fyzické kontrole jednotlivé řádky `Přítomno / Nepřítomno / Neověřeno`, fotka problému, u zaměnitelných doplňků ověřené množství. Souběžně lze zapsat neznámou součást, ale nevracet či nepřevádět vypůjčený kus skrytým vedlejším efektem.

### K22 · Nesrovnalosti a uzavření inventury (P1)

**Obsah:** filtrování podle druhu nesrovnalosti, osoby, řady, kompletu; stav nevyřešeno / vysvětleno / potvrzeno k dalšímu řešení; odkaz zpět na kontrolu a původní sken. Uzavření může proběhnout i s neověřenými kusy, ale s výslovným potvrzením a důvodem. Výsledek se archivuje jako neměnný historický snímek, pozdější změny zápůjček jej nepřepisují.

### K23 · Archiv dokumentů (P0, `/documents`)

**Účel:** dohledat zejména historický sešit a lístky, které zatím nejdou přímo přiřadit jedné osobě či kompletu.

**Obsah:** seznam/fotogalerie dokumentů, filtry `Osobní karta / Karta kompletu / Soupis řady / Kniha zápůjček / Lístek / Jiné`, datum pořízení, přibližné datum původního záznamu (pokud známé), přiřazená osoba/komplet/řada, „nepřiřazeno“, autora nahrání. Detail: zobrazení snímků, ručně zadaný popisek, datum původní zápůjčky (je-li doloženo), přiřazení k více souvisejícím objektům podle potřeby, možnost nového snímku a archivace nesprávného či nečitelného snímku.

**Kniha a lístky:** nevytvářet při nahrání automaticky strukturovanou zápůjčku; umožnit pozdější přepis ručně a uchovat vazbu na původní dokument.

### K24 · Katalog a nastavení (P0/P1)

**Samostatné podstránky:** regiony, pohlaví, varianty, druhy součástí; evidenční řady součástek i kompletů (včetně číselných pravidel a znovupoužití čísel; šablony kompletů se nepoužívají, D-35); jednoduché výchozí nastavení inventury. Nejprve naplnit tyto číselníky, až poté rychle zadávat kusy. Rizikové úpravy existujících názvů/řad nesmějí bez upozornění změnit identitu starých předmětů.

### K25 · Přehledy, tisk a export (P1)

**Vytisknout / CSV:** sklad podle řad, komplet včetně chybějících věcí, krojová karta konkrétní osoby, otevřené a opožděné zápůjčky, vyřazené kusy, inventurní soupis a závěrečné nesrovnalosti. Tisk na A4, jasné datum sestavení, označení „podle evidence“ vs. „fyzicky ověřeno“, případně poznámka „historická evidence není úplná“.

## 5. Práce se skeny, fotografiemi a soubory

Tato oblast **není v současných podkladech dotažená do návrhu služby úložiště**. Původní specifikace dovoluje fotografie součástí; nové požadavky na archiv papírových karet a knihy zápůjček zde doplňujeme jako **nový návrh**, nikoli jako již implementovanou funkci.

### 5.1 Co přikládáme

| Typ | Vazba | Příklad | Důležitá metadata |
|---|---|---|---|
| Osobní karta | Osoba | 3 snímky listů ze šanonu | Datum pořízení, autor, pořadí stran, případně datum posledního porovnání s originálem |
| Karta kompletu | Komplet | Historie výdejů a vrácení | Datum pořízení, strany, popis |
| Soupis v tašce | Komplet | Lístek s číslem a součástmi | Datum pořízení, označení kompletu |
| Karta řady | Evidenční řada | Starý soupis košil | Datum pořízení, poznámka o aktuálnosti |
| Kniha zápůjček | Archiv + vazby dle potřeby | Stránka knihy | Číslo stránky, případné období |
| Volný lístek | Archiv + volitelná osoba/kus | „Půjčeno dne …“ | Původní datum, pokud se dá přečíst |
| Fotografie součásti | Konkrétní kus | Šev, skvrna, značení | Fotografie obecná či k inventurní události |
| Fotografie z kontroly | Inventurní záznam | Zjištěná nesrovnalost | Datum, autor, komentář, vazba na kontrolu |

Snímky mohou být více stránkové; prohlížeč musí podporovat **zvětšení, posouvání, otočení a přepínání stran**. Pro dlouhé seznamy načítat náhledy, nikoliv všechny originály.

### 5.2 Mobilní nahrání – navrhované UX

1. Krojařka stiskne `Přidat sken` u osoby, kompletu nebo v archivu.
2. Nabídka `Vyfotit` nebo `Vybrat soubor` (podle možností zařízení). V demo verzi využít běžný souborový input `accept="image/*,application/pdf"` a na mobilu případně `capture="environment"` jako progresivní vylepšení; neslibovat univerzálně stejné chování fotoaparátu.
3. Náhled fotografie, otočení / případný ruční ořez, přidání další stránky, přeuspořádání snímků, stručný popisek.
4. Volba typu dokumentu, přiřazený objekt předvyplněn podle místa nahrání, datum pořízení automaticky; datum původního zápisu pouze volitelně.
5. Po uložení se objeví miniatura a jasná zpráva `Uloženo`. Nedokončený upload nesmí vyvolat mylný dojem úspěchu.

**Doporučení pro MVP:** mobilní fotografie JPEG/PNG/HEIC tam, kde je prohlížeč umí zpracovat; PDF při importu existujících skenů. Prohlížeč musí zvládnout čitelný text na formátu A4; příliš agresivní komprese je nevhodná. Vícestránkové PDF lze zatím ukládat jako jeden dokument, fotografie jako posloupnost stran.

### 5.3 Přehled požadavků na backend souborů (mimo rozsah frontendového dema)

Doporučený minimální kontrakt:

```text
POST   /attachments                    Nahrát soubor + metadata + vazby
GET    /attachments?ownerType=&ownerId= Seznam příloh a metadat
GET    /attachments/:id                 Metadata, dostupné náhledy
GET    /attachments/:id/content         Autorizované čtení originálu
GET    /attachments/:id/thumbnail       Autorizovaný náhled
PATCH  /attachments/:id                 Upravit popis, pořadí, vazby
DELETE /attachments/:id                 Řízené odstranění / archivace
```

Toto je **návrh API pro budoucí implementaci**, nikoliv schválené endpointy. Příloha má vlastní neprůhledné ID, vazbu na objekt a autora. Souborovou cestu ani název od uživatele nepoužívat jako veřejný identifikátor.

**Úložiště:** na PHP hostingu lze pro první verzi ukládat fyzické soubory v soukromém adresáři **mimo veřejný webroot**, metadata a vazby do MariaDB. Originál ani náhled nepublikovat na veřejně odhadnutelné URL. Stahování přes PHP s kontrolou oprávnění. Pokud hosting neumožní bezpečné privátní úložiště, navrhnout odpovídající zabezpečenou variantu před spuštěním, neukládat osobní karty do veřejné složky.

**Bezpečnost a provoz:** kontrola MIME podle skutečného obsahu (nejen přípony), omezení velikosti a počtu souborů, bezpečné názvy, limity PHP uploadu, ochrana před škodlivými soubory, oddělené oprávnění ke čtení osobních karet, audit nahrání a odebrání. EXIF polohová metadata u fotografií z mobilu pokud možno odstraňovat. U skenů řešit osobní údaje, retenci a zálohování **databáze i souborů společně**; obnova musí obnovit také vazby příloh.

**Optimalizace:** prohlížeč zobrazuje menší náhled, originál načte při otevření. Pro originály zachovat čitelnost ručně psaných údajů; nastavit praktický limit až po reálném otestování na vzorku karet. Nepotřebujeme OCR, veřejné CDN ani pokročilý DAM systém.

### 5.4 Co stačí simulovat ve frontendovém demu

- Výběr souboru, vícenásobné fotografie, pořadí, popis, navázání na osobu/komplet/řadu.
- Galerii s náhledem, přiblížením a zobrazením starších verzí.
- Ukázkové dokumenty a proměnu stavu po nahrání; pro jednoduché demo lze použít soubory v `assets/mock-documents/` a pro nově nahrané soubory dočasné `object URL` v paměti relace.
- **Výslovné demo upozornění:** nově nahrané soubory **nejsou bezpečně ani trvale uloženy na server**. Nevytvářet dojem, že browserový `localStorage` představuje vhodný archiv skenů. Pro ostrý pilot je perzistentní, autorizované úložiště povinné.

## 6. Klíčové scénáře pro proklikatelné demo

**S1 – Připravit katalog:** přidat region „Kopanice“, mužskou variantu a druh součásti „košile“; založit příslušnou číselnou řadu. Přechod do skladu ukáže prázdnou řadu.

**S2 – Naskenovat osobní kartu:** založit Františka Nováka, připojit tři stránky ze šanonu, zobrazit je ve správném pořadí, změnit popisek a uvidět varování o neověřeném aktuálním stavu.

**S3 – Papír mezitím zastaral:** zobrazit sken z 1. listopadu, přidat novější fotografii karty ze 20. listopadu a zaznamenat datum posledního porovnání s originálem. Původní sken zůstane k dispozici.

**S4 – Založit komplet:** vytvořit tašku K-12, vyfotit soupis a kartu kompletu, opsat známé složení jako **neověřené**, otevřít detail a později fyzicky zkontrolovat chybějící součást.

**S5 – Kontrola osoby:** Franta přinese košili v řadě „kopanická mužská košile“, číslo 17. V inventurní návštěvě se založí či najde konkrétní kus, zaznamená fyzická kontrola a přiřadí skutečnému držiteli. Poznámka na staré kartě zůstane historickým podkladem.

**S6 – Konflikt papír × skutečnost:** starý sken uvádí košili č. 17 u Franty, kus se ale fyzicky najde ve skladu. UI vyžaduje explicitní vyřešení a **nevymýšlí datum historického vrácení**.

**S7 – Postupný přechod:** Franta je označen jako převedený, Pepa zůstává na papíru. Krojařka vydá Pepovi novou digitálně zaevidovanou součást; Pepovy staré papírové zápůjčky zůstávají nepřevedené.

**S8 – Rychlá kontrola řady:** ve skladu otevřít řadu a zadat `1, 3, 7, 12-15`; aplikace ukáže úspěšně zkontrolované kusy, již ověřené číslo a číslo, které v databázi ještě není.

**S9 – Neúplný komplet:** z kompletu je samostatně půjčený šátek; při výdeji tašky se nevydává podruhé, v detailu je uveden jako chybějící. Při vrácení části kompletu zůstává šátek otevřený.

**S10 – Nečíslované drobnosti:** sada obsahuje dvě mašle; fyzicky se vrátí jedna, UI zaznamená `1 ze 2` bez identifikace konkrétní mašle.

**S11 – Uzavření inventury:** část kusů neověřena, část nepředložena; krojařka uvede důvod uzavření s nesrovnalostmi, vytiskne přehled a exportuje CSV.

**S12 – Spolupráce dvou krojařek:** v demo scénáři simulovat změnu provedenou druhou pomocnicí. Před uložením zastaralého formuláře zobrazit konflikt a nabídnout obnovení. V ostré aplikaci musí konflikty řešit API, nikoliv jen frontend.

## 7. Vizuální a ergonomické požadavky

- **Pracovní nástroj, ne generický Bootstrap dashboard**: střídmá grafika inspirovaná folklorem Vonice (jemný vzor či výšivka jen v hlavičce, typografii nebo oddělovačích), nikoli dekorace konkurující drobným evidenčním číslům.
- Hlavní činnost zvládnutelná jednou rukou na mobilu; velká klepací plocha u `Ověřeno`, `Nepředloženo`, `Další kus`, možnost opakovaného zadání bez návratu přes menu.
- U čísel `řada + číslo` vždy plný, čitelný kontext. Barva nikdy není jediným nositelem významu.
- Uživatelsky srozumitelné rozdíly: **údaj opsaný z papíru / ověřeno při inventuře**; **papírová karta aktivní / digitální evidence aktivní**; **chybí / nepředloženo / ještě nekontrolováno**.
- U každého citlivého kroku uchovat historii a zobrazit potvrzení: vyřazení, oprava držitele, dokončení převodu osoby, uzavření inventury.
- Dobře použitelné na telefonu šířky cca 360 px i na desktopu. Tiskové stránky nejsou screenshoty mobilní aplikace.
- U akcí, které mění více věcí, zobrazit shrnutí ještě před potvrzením.

## 8. Data a implementační pokyny pro demo

**Demo seed** obsahuje: nejméně dva regiony, obě pohlaví, více variant, dvě řady se stejnými čísly, znovupoužité číslo po vyřazení, několik desítek kusů, 2–3 komplety, jednotlivé i kompletní zápůjčky, nečíslované doplňky, aktuálně otevřenou inventuru, osoby ve všech třech stavech převodu a dokumenty různého stáří.

**Simulovaná úložiště:** oddělit rozhraní práce s daty od komponent, aby šlo později vyměnit mock adaptéry za HTTP klienty. Nepsat do demo souborových dat reálné osobní karty. Pro demo používat syntetická jména a dokumenty.

**Co nepředpokládat:** hotový PHP backend, OCR, centrální správu organizací, skutečné nahrávání do cloudu, přihlášení všech evidovaných osob, automatický převod historických papírových půjček.

**Koexistence:** `moje.vonica.cz` má být v budoucnu další klient stejných API, ale jeho implementace ani spuštění není předpokladem dema Krojařky. Změny frontendových obrazovek Krojařky lze nasazovat samostatně; změny API vyžadují zachovat kontrakty ostatních klientů.

## 9. Akceptační kritéria frontendového dema

- [ ] Na mobilu lze vytvořit osobu a připojit k ní několik skenů v pořadí.
- [ ] Je zřejmé, zda je u osoby aktivní papír, převod, nebo digitální evidence.
- [ ] Starší a novější sken stejné karty jsou dohledatelné, nikdy se tiše nepřepisují.
- [ ] Lze vytvořit druh/řadu, jednotlivý číslovaný kus a komplet se soupisem.
- [ ] Je možné zahájit inventuru a projít kontrolou osoby, řady a kompletu.
- [ ] UI odděluje převzatou informaci ze skenu od fyzicky potvrzeného nálezu.
- [ ] Při zápůjčce nebo vrácení kompletu je vidět přesný obsah předání a lze řešit výjimky.
- [ ] Nelze zaměnit stejné číslo z různých číselných řad.
- [ ] Osoba v papírovém režimu může dostat novou digitální zápůjčku.
- [ ] Uzavření inventury s nesrovnalostmi vyžaduje vědomé potvrzení.
- [ ] Demo jasně ukazuje, že upload souboru zatím není trvalým produkčním uložením.
- [ ] Navigace, přílohy a práce s inventurou jsou použitelné na telefonu i na počítači.

## 10. Otevřené otázky pro pilot s krojařkou

*Zodpovězeno 2026-10-23 (D-38 až D-40):*

1. ~~Výdej celého kompletu na papírové kartě~~ – zapisuje se jen číslo kompletu, nesoulad se dopisuje do poznámky.
2. ~~Kontrola originálu při převodu~~ – **stačí poslední fotka** karty (doporučení kontrolovat originál neplatí).
3. ~~Převod s nevyjasněnými záznamy~~ – **převod smí být dokončen**, nesrovnalosti zůstávají jako výslovné záznamy („budou tam vždycky“).
4. ~~Počet a čitelnost skenů~~ – **jeden sken na jednu krojovou kartu**, fotky jsou čitelné. **OCR se nepoužívá** (ručně psané poznámky).
5. ~~Tiskové sestavy~~ – viz `../06` kap. 10.
6. ~~Retence skenů~~ – skeny slouží **jen k digitalizaci**. Po ní se **zazipují, uloží do souborového digiarchivu mimo aplikaci a z aplikace se odstraní** (D-40).

## 11. Zdrojové podklady a vztah k nim

**Zachované doménové požadavky:** `../06-specifikace-krojoveho-skladu.md` (při vzniku tohoto dokumentu se vycházelo z verze 0.3; fyzické komplety a nečíslované množství od 22. 10. potvrzuje v0.5, D-19) — jednotlivé kusy, samostatné číselné řady, znovupoužití čísel, komplet jako držitel, neúplné komplety, nečíslované množství, částečná vrácení, historie, inventura, tisk/export a oprávnění.  
**Současné obrazovky a implementační stav:** `../../archive/implementace-2026-10-21/06-kroje.md` — již realizované sklady, karty, výdeje, inventurní návštěvy, rychlé zadání čísel, nastavení; v dokumentu je také uvedena absence některých cílových funkcí.  
**Společná architektura a identita:** `../../archive/implementace-2026-10-21/01-architektura.md`, `…/02-domenovy-model.md` (stav dema), `../identity-model-v2.md`, `../hosting-postgresql-api-auth.md`.  
**Výchozí navigace:** `../moje/10-navigace-a-struktura-menu.md` (navigace `moje`; Krojařka má vlastní menu podle D-22).  
**Nové návrhy v tomto dokumentu:** samostatná adresa Krojařky, její menu, obrazovky K01–K25, práce se skeny a archivními dokumenty, přechodové stavy osob a režim první digitalizační inventury. Tyto návrhy nejsou prohlášeny za hotovou implementaci ani za schválenou změnu doménového modelu.

---

**Produktový milník:** Krojařka založí člověka, připojí jeho papírovou kartu, při skutečné inventuře fyzicky ověří kroje, vyřeší nebo zaznamená rozpory a bezpečně přepne tuto osobu na digitální evidenci. Následné výdeje a vrácení pak vede bez dalšího papírového zápisu.
