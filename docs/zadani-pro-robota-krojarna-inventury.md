# Implementační zadání: Krojárna, Moje kroje a inventury (frontend + mock)

## 0. Kontext a hranice úkolu

Aplikace pro folklorní soubor, aktuální nasazená verze je **frontendový prototyp bez backendu**. Implementuj změny ve stávajícím Angular projektu. Nezakládej novou aplikaci. Nezasahuj do nesouvisejících modulů. Přizpůsob implementaci existující architektuře, routingu, UI komponentám a konvencím projektu; používej feature services a mock zdroj, nikoli přímé používání mock konstant v komponentách. Zachovej možnost budoucí náhrady mock services za PHP REST API + MySQL. V této fázi **neimplementuj backend, databázi, migrace ani autentizaci navíc**.

Aktuální screenshoty ukazují jednu společnou sekci „Kroje a Krojárna“ se záložkami Přehled, Součásti, Komplety, Zápůjčky, Lidé, Inventury. Inventura je nesprávně založena na konkrétní evidenční řadě a odklikávání jednotlivých položek. Cílem je **opravit doménové chápání a uživatelské scénáře**, nikoli pouze přejmenovat záložky.

Pracuj po malých změnách; zachovej funkční existující moduly. Všechny níže uvedené pracovní scénáře musí být proklikatelné na mobilu i desktopu na konzistentních demo datech. Preferuj češtinu v UI, angličtinu v kódu, typech a komentářích.

## 1. Dva oddělené vstupy v navigaci

### Moje kroje

Samostatná položka navigace a samostatná route pro všechny členy. Read-only osobní krojová karta přihlášeného člena:
- aktuálně zapůjčené fyzické součástky: typ/název, region, varianta, evidenční číslo a identifikace evidenční řady;
- rozdělení do přehledných skupin podle regionu/typu kroje pouze pro čitelnost;
- termíny vrácení, pokud existují; aktuální inventurní výzvy a návštěvy, pokud se člena týkají;
- žádné samostatné přepisování výpůjček členem;
- srozumitelný prázdný stav.

### Krojárna

Samostatná položka navigace a route pro správu krojového fondu: **Sklad / Krojové karty / Výpůjčky / Inventury / Nastavení** (názvy záložek lze přizpůsobit existující navigaci). Administrativní změny pouze v roli krojařky/pověřené osoby. Pokud existují pouze mock role, demonstruj dvě role a nezaváděj nové auth řešení. Běžný člen může mít podle existujících pravidel právo prohlížení, ale nikoli zápisu. Oddělení „Moje kroje“ a „Krojárna“ se nesmí opírat jen o skrytí záložek v jedné stránce.

## 2. Model krojového fondu

### 2.1 Fyzický kus je základní entita

Každá fyzická součástka má stabilní interní `id`, evidenční řadu, evidenční číslo **v rámci této řady**, kategorizaci, stav, umístění/držitele a historii. Čísla mohou obsahovat mezery (vyřazené kusy) a **nesmějí se po vyřazení přečíslovávat ani recyklovat bez výslovného pravidla**. Zobrazovat kombinaci řada + číslo; samotné číslo není globálně unikátní. Vyřazené položky zůstávají v historii.

### 2.2 Klasifikace

Příklady dimenzí u Vonice:
- pohlaví kroje: mužský / ženský;
- region: Horňácko / Kopanice / Zálesí / Slovensko;
- typ součástky: košile, gatě, traslavice, pruclek, klobouk, čižmy, rukávce, spodnica, fěrtůška, saky, šatka atd.;
- doplňkové rozlišení podle potřeby daného typu: nové/staré, modré/bílé atd.

Kategorizace má být **konfigurovatelná pro daný soubor** (jiný soubor může rozlišovat vesnici, sváteční/pracovní, dítě/dospělý). Nepředpokládej, že všechny dimenze platí pro všechny typy. **Nedělej však generický databázový framework ani generický renderer formulářů**: stačí explicitní typované modely, konfigurované možnosti/filtry a smysluplné doménové komponenty. Vazbu na `ensembleId` zachovat pro budoucí více souborů.

Evidenční řada je konkrétní definovaná kombinace klasifikace (např. mužské / Horňácko / košile). Rozlišení „bílé vs. modré“ může podle místního nastavení patřit buď do samotného klíče evidenční řady, nebo být atributem položky; **nezakóduj automaticky, že každá varianta vždy zakládá novou řadu**. V demo datech předveď několik řad a chybějící čísla.

### 2.3 Krojové komplety

„Komplet“ nesmí být primárně pevná sada kusů se shodnými čísly. Lze jej pojmout jako **šablonu druhů součástek** potřebných pro určitý kroj, s upozorněním na chybějící typy. Skutečná krojová karta držitele je soubor **individuálních zápůjček konkrétních fyzických kusů**. Jeden člověk může mít více regionů a více kusů stejného typu. Nevynucuj komplet k vytvoření výpůjčky.

### 2.4 Výpůjčky a pracovní úkoly

Výpůjčka propojuje konkrétní kus s konkrétním držitelem, obsahuje data a stav. Zachovávej historii; při vrácení či výměně nepřepisuj předchozí držení bez záznamu.

Zaveď koncept **pracovního úkolu na konkrétní součástce** (úprava/oprava/přešití; popis, stav, případně odpovědná osoba a datum). Úkol lze vytvořit při inventuře i mimo ni. Odděluj fyzické umístění kusu (sklad, člen, švadlena, oprava, neznámé) od jeho stavu a od aktuálního držitele v evidenci. Rozlišuj „poškozené“, „potřebuje úpravu, ale není poškozené“ a „nevydatelné“.

## 3. Inventura: jedna akce, dva pracovní režimy

Inventura je akce nad **celým skladem nebo explicitně definovanou podmnožinou fyzických kusů**, nikoli inventura jedné evidenční řady. Má identitu, název, datum, stav, rozsah a množinu cílových item ID vytvořenou při zahájení (snapshot). Postup inventury počítej podle **unikátních fyzických kusů, ne podle počtu kliknutí, návštěv či výpůjček**. Umožni pozdější výslovné přidání kusu do rozsahu s auditní poznámkou; nepřidávej jej potichu.

### 3.1 Výběr rozsahu

Krojařka může při založení použít filtry:
- celý fond, nebo klasifikace součástek (region, pohlaví, typ, případně varianty);
- volitelně existující **skupina členů** (např. muzikanti, tanečníci, holky, kluci);
- kombinace filtrů = průnik podmínek.

Pravidla rozsahu:
- bez filtru na lidi zahrnuje inventura relevantní kusy **zapůjčené i fyzicky ve skladu**, popř. kusy v opravě či na jiném místě, pokud patří do definovaného fondu;
- inventura skupiny „kroje muzikantů“ zahrnuje **kusy zapůjčené lidem ve skupině Muzikanti**, nikoliv obecně všechny kusy nějakého „muzikantského typu“, a nezahrnuje automaticky nezapůjčené skladové zásoby;
- kombinace skupiny a klasifikace zahrnuje jen odpovídající výpůjčky těchto lidí;
- člen může patřit do více skupin, kus se ve výsledné množině vyskytne pouze jednou;
- při zahájení vytvoř snapshot cílových kusů a dotčených osob (pro plán návštěv), aby pozdější výměna či změna skupiny nenarušila rozsah; současného držitele zobrazuj dle aktuálních dat.

Před založením ukaž náhled: počet kusů, počet dotčených držitelů, počet nezapůjčených kusů, popis použitých filtrů a upozornění na případný prázdný rozsah.

### 3.2 Režim A – kontrola zapůjčených kusů **podle lidí**

- Při vytvoření inventury sestav seznam **pouze osob, které drží alespoň jeden cílový kus**.
- Krojařka zveřejní termíny návštěv, kapacita např. **3 osoby na slot** (konfigurovatelná hodnota).
- Přihlásit se mohou jen dotčení lidé; člen vidí ve svých krojích inventurní výzvu, volné sloty a seznam kusů, které má přinést.
- Krojařka vidí přehled neobjednaných, objednaných a odbavených členů.
- Otevření návštěvy ukáže **krojovou kartu filtrovanou na cílové kusy inventury**, nikoli celou kartu bez rozlišení. Ukaž řadu i číslo.
- U každého kusu lze potvrdit fyzické předložení a stav: v pořádku / poškozeno / vyžaduje úpravu / nepředloženo. Lze zaznamenat poznámku a zadat pracovní úkol.
- V témže workflow lze běžnými operacemi krojárny kus **vrátit, nově vydat či vyměnit**; nebuduj odlišnou inventurní implementaci těchto operací.
- Výměna: explicitně zvol původní kus, potvrď, zda byl skutečně předložen a vrácen, vyber **existující dostupný fyzický kus** (nikoli volný text nového čísla jako produkční chování), potvrď nové vydání a případnou fyzickou kontrolu nového kusu. Neumožni jeden kus současně zapůjčit dvěma lidem. Pokud původní kus nebyl předložen, **neoznačuj jej jako fyzicky ověřený ani automaticky vrácený**.
- Na konci nabídni rekapitulaci: ověřené kusy, poškození a úpravy, nepředložené kusy, provedené pohyby a otevřené úkoly; krojařka potvrdí dokončení návštěvy.
- **Dokončená návštěva ≠ všechny kusy fyzicky ověřené.** Nepředložené zůstávají v inventuře otevřené a mohou se dořešit pozdější návštěvou/kontrolou.

### 3.3 Režim B – kontrola nezapůjčených kusů **podle součástek/řad**

Typický scénář: jedna krojařka vybírá ze skladu mužské horňácké košile a diktuje evidenční čísla, druhá je rychle odklikává.

UI požadavky:
- vstup ze stejné inventury, přepínač „Podle lidí“ / „Ve skladu“;
- ve skladové části seskupení dle klasifikace/evidenční řady; např. „Mužské / Horňácko / Košile“;
- zřetelná číselná mřížka se stavy a **rychlý číselný vstup s potvrzením Enter**;
- umožnit dávku oddělených čísel a rozsahy jako `1, 3, 7, 12-15`, ale bezpečně rozlišit neexistující čísla, duplicitně ověřené kusy a kusy, které se v mezidobí zapůjčily;
- po zadání ukázat okamžité potvrzení a další prázdný vstup, vhodné pro rychlou práci;
- možnost otevřít detail konkrétního kusu a zaznamenat poškození, úpravu, poznámku a pracovní úkol;
- nezapůjčené kusy mohou být v opravě/mimo fyzický sklad; nelze je potvrdit jen proto, že jsou v evidenci označené jako „ve skladu“;
- nepředpokládej souvislou číselnou řadu; čísla vyřazených kusů nevytvářej jako „chybějící“ položky inventury;
- změny v průběhu inventury se zobrazují i v opačném režimu; jedna fyzická součástka má právě jeden výsledný stav ověření v dané inventuře.

### 3.4 Stav a uzavření inventury

Rozlišuj:
1. **Průběh návštěv**: kolik dotčených lidí se dostavilo / zbývá.
2. **Pokrytí fyzických kusů**: počet unikátních fyzicky ověřených kusů / celkový snapshot cílových kusů.
3. **Otevřené nesrovnalosti a práce**: nepředloženo, nezvěstné, poškození, čeká na úpravu, úkoly k dořešení.

Poškozená, ale skutečně předložená součástka **se počítá jako fyzicky ověřená**. Nepředložená **ne**. Oprava může zůstat otevřená i po inventarizaci kusu.

Uzavření inventury:
- bez problémů, pokud byly všechny cílové kusy skutečně fyzicky ověřeny;
- jinak pouze **výslovné administrativní uzavření s nevyřešenými nesrovnalostmi**, potvrzením a záznamem důvodu; nikdy netvrdit, že byly všechny kusy zkontrolovány.

Historie kontrol musí umožnit dotaz „Kdy krojařka naposledy fyzicky viděla kus X?“ napříč inventurami (i za ~10 let).

## 4. Datový návrh pro TypeScript mocky (orientační, uprav dle stávajícího kódu)

Zachovej doménové entity oddělené; nepřidávej obří generickou entitu pro vše:
- `CostumeClassification` / `CostumeSeries`: definice klasifikace a evidenčních řad v souboru;
- `CostumeItem`: stabilní ID, `ensembleId`, `seriesId`, evidenční číslo, volitelná metadata, dostupnost, stav, fyzické umístění;
- `CostumeLoan`: item ID, member ID, výdej/vrácení, případně termín; historie;
- `CostumeWorkOrder`: item ID, typ, popis, stav, kdo řeší, data;
- `Inventory`: ID, název, filtry, zmrazený seznam cílových item IDs, metadata a stav;
- `InventoryAppointmentSlot`: inventura, datum/čas, kapacita;
- `InventoryBooking`: inventura, člen, slot, stav návštěvy;
- `InventoryCheck`: inventura, item ID, timestamp, krojařka, výsledek předložení/stavu, poznámka, případná návštěva; opakované kontroly uchovat v historii, do progresu započíst kus pouze jednou;
- případně doménová událost/historie pro výměnu a pohyby mezi umístěními.

**Nemíchej** `isPhysicallyVerified`, `condition`, `loanStatus`, `location`, `workOrderStatus` a `appointmentStatus` do jednoho stavového enumu. U mocku lze použít in-memory repozitář s obnovou demo dat; pokud stávající aplikace ukládá změny do localStorage, respektuj existující mechanismus. Není požadováno zavádět novou persistence vrstvu.

## 5. Demo data a průchody UI

Založ věrohodná, konzistentní mock data tak, aby šlo ručně vyzkoušet:
- mužské i ženské součástky, více regionů, různé varianty a nesouvislá čísla;
- skupinu Muzikanti a Tanečníci, osoby i ve více skupinách;
- osobu s několika rozdílně očíslovanými zapůjčenými kusy;
- nezapůjčené fyzické součástky ve skladu;
- částečnou inventuru „Ženské Kopanice“ a skupinovou „Kroje muzikantů“;
- kontrolu člověka, který vše přinesl, i člověka s nepředloženou součástkou;
- výměnu kusu za dostupný kus, vrácení, nové vydání;
- úpravu/opravu součástky;
- rychlé diktování evidenčních čísel v inventuře skladových kusů;
- kus mimo sklad na opravě;
- prázdné výsledky, chybné číslo, duplicitní kontrolu, překročenou kapacitu slotu.

## 6. Akceptační kritéria

- [ ] „Moje kroje“ a „Krojárna“ jsou samostatné položky navigace a route.
- [ ] Člen vidí vlastní jednotlivé výpůjčky, nikoliv uměle vytvořený komplet se shodným číslem.
- [ ] Součástka se jednoznačně identifikuje řadou + číslem, v kódu stabilním item ID; mezery v číslování jsou validní.
- [ ] Lze spustit inventuru všeho, podle kategorií, podle skupiny i průniku obou.
- [ ] Na termíny se může přihlásit jen držitel aspoň jednoho kusu spadajícího do inventury; kapacita slotu se dodržuje.
- [ ] Kontrola zapůjčených kusů probíhá podle lidí, včetně dokončení návštěvy s nevyřešenou položkou.
- [ ] Kontrola skladových kusů probíhá podle evidenčních řad, rychlým zadáním/diktováním čísel i klikáním.
- [ ] Neexistující, opakované nebo neaktuálně vhodné kusy jsou zřetelně ošetřeny, ne potichu potvrzeny.
- [ ] Krojařka může při kontrole vydat, vrátit a vyměnit konkrétní kus a založit opravu/úpravu.
- [ ] Fyzické ověření není zaměněno za stav součástky ani za dokončení návštěvy.
- [ ] Přesuny/výměny nezpůsobí dvojí započítání kusu nebo tichou změnu rozsahu inventury.
- [ ] Inventuru lze uzavřít s nesrovnalostmi pouze výslovně, s rekapitulací a důvodem.
- [ ] Funguje mobilní ovládání; číselný vstup je použitelný na mobilní klávesnici a na desktopu přes Enter.
- [ ] Změny jsou dosažitelné přes feature services a konzistentně se projeví napříč pohledy.
- [ ] Projekt projde stávajícím buildem a relevantními testy; neporušil se zbytek aplikace.

## 7. Implementační postup a výstup robota

Pracuj iterativně v tomto pořadí:
1. Zmapuj existující costume routes, models, services, mock data, role/permission checks a dostupné UI komponenty. Napiš stručně, co zachováš a co upravíš.
2. Odděl navigaci a osobní krojovou kartu od pracovního prostředí krojárny.
3. Uprav model fyzických kusů, evidenčních řad, půjčování a oprav; převeď demo data, zachovej funkčnost stávajících pohledů, pokud jsou smysluplné.
4. Uprav založení inventury a náhled rozsahu, zavedení snapshotu.
5. Implementuj objednávání a kontrolu **po lidech**, včetně výměn a rekapitulace.
6. Implementuj kontrolu **ve skladu po řadách** včetně rychlého zadávání čísel.
7. Přidej agregované přehledy, historii a uzavírání inventury; ověř akceptační scénáře.

Dělej minimální potřebné změny; nedělej plošné refaktory. Nevymýšlej nové produktové funkce mimo toto zadání. Nejasnosti, které mohou ovlivnit invarianty (například pravidlo, zda určitá varianta má vlastní číselnou řadu), popiš jako rozhodnutí ke schválení místo náhodného zakódování. Na závěr stručně vypiš změněné soubory, přehled uživatelských scénářů, výsledky build/test a známá omezení mock implementace.

## 8. Drobné otevřené produktové otázky (neblokují frontendové demo)

1. Zda konkrétní rozlišení variant (např. modré/bílé gatě) zakládá ve Vonici samostatné evidenční řady; musí být konfigurovatelné.
2. Kdo smí administrativně uzavřít inventuru s otevřenými nesrovnalostmi.
3. Jaké další stavy oprav a schvalovací pravomoci krojařky jsou skutečně potřeba.
4. Zda rezervace inventurních termínů budou později navázány na běžné souborové akce/kalendář; nyní stačí samostatné termíny bez nové backendové integrace.

**Nepovažuj tyto otázky za důvod nepřipravit proklikatelné demo.**
