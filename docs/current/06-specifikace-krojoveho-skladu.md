# Krojový sklad – funkční specifikace pro krojařky

**Souborový systém · Verze 0.4 · 18. 10. 2026**
**Stav:** Verze 0.3 (zpětná vazba krojařky, 15. 10. 2026) sjednocená s opraveným doménovým modelem, podle kterého je od 17. 10. 2026 postaveno demo (fyzický kus + evidenční řada, komplet jako šablona, inventura ve dvou režimech), a s rozhodnutími o zápůjčkách mezi soubory z 18. 10. 2026. Podklad ke schválení krojařkami.

Navigace a obrazovky: `10-navigace-a-struktura-menu.md` kap. 4.5 (Moje kroje) a 4.6 (Správa krojů). Stav implementace: `03-postup-vyvoje.md`.

**Názvosloví:** *krojařka* = osoba s pověřením Správa krojů; *sklad* = místnost, kde leží nezapůjčené kroje; *Správa krojů* = agenda v aplikaci; *Moje kroje* = osobní krojová karta člena. Pojmy „krojárna“ a „krojárka“ nepoužíváme.

## 1. Proč krojový sklad digitalizujeme

Chceme mít na jednom místě spolehlivý přehled o krojových součástech: **co máme, kde to fyzicky je, komu je to podle evidence svěřeno, v jakém je to stavu a co chybí**. Evidence má usnadnit vydávání a vracení krojů, dohledávání jednotlivých kusů, opravy a skutečnou inventuru.

**Krojový sklad je autoritativní evidence** skutečného svěření a pohybu krojů – na rozdíl od docházky, která je jen orientační (viz `00`, `07`).

Aplikace má být použitelná na mobilu přímo u krojů a současně umožňovat práci na počítači, tisk a export přehledů.

## 2. Dohodnutá základní pravidla

1. **Základní entitou je fyzický kus** (součástka). Každý má stabilní interní identitu, evidenční řadu, evidenční číslo v rámci řady, klasifikaci, stav, umístění, držitele a historii.
2. **Evidenční řady jsou samostatné.** Číslo `1` může současně označovat „mužská horňácká košile 1“ i „ženská kopaničká spodnica 1“. Identifikaci pro lidi tvoří vždy **řada + číslo**; samotné číslo není jedinečné.
3. **Čísla mohou mít mezery a nepřečíslovávají se.** Vyřazený kus zůstává v historii i se svým číslem. **Opakované použití čísla vyřazeného kusu** je možné jen tam, kde to řada výslovně povoluje (nastavení řady); historie starého a nového kusu se nikdy nespojí.
4. **Klasifikace je konfigurovatelná pro soubor** (pohlaví kroje, region, druh součástky, doplňkové varianty). Jiný soubor může rozlišovat jiné dimenze.
5. **Komplet je šablona druhů součástek**, ne pevná sada kusů. Říká, co kroj daného pohlaví a regionu potřebuje, a slouží k upozornění, co držiteli chybí. Výpůjčka nikdy nevyžaduje komplet.
6. **Krojová karta držitele = soubor individuálních zápůjček konkrétních kusů.** Jeden člověk může mít kusy více regionů i více kusů stejného druhu.
7. **Existují dlouhodobá přidělení i krátkodobé zápůjčky.** Termín vrácení nemusí být u dlouhodobých přidělení vyplněn.
8. **Výdej, vrácení, výměny, opravy, inventury a vyřazení zapisují pouze krojařky** (pověření Správa krojů). Běžní členové evidenci sami nemění.
9. **Odpovědnost se řídí oficiální evidencí.** Neohlášené předání mezi členy odpovědnost nepřenáší.
10. **Zápůjčky mohou mít i externisté a bývalí členové.** Jejich identita a historie musí zůstat dohledatelná.
11. **Stav, umístění, vydatelnost a držitel jsou různé informace** a nemíchají se do jednoho stavu (kap. 3.2).
12. **Poznámky lze zapisovat ke kusu, k zápůjčce, k jejímu ukončení i k inventurní kontrole.** Historická poznámka se nepřepíše pozdějším vypráním či opravou.
13. **Součástí první provozní verze je inventura a tisk či export seznamů**, nejen přehled v mobilu.

## 3. Jednotlivé krojové součásti

### 3.1 Co evidujeme u kusu

- evidenční řadu a číslo v ní (číslo může dočasně chybět, pokud kus fyzické číslo teprve dostane),
- variantu jako atribut kusu, pokud není součástí klíče řady,
- velikost či míry, popis,
- **dlouhodobou poznámku** (například „povolený šev“, „chybí knoflík“),
- stav, vydatelnost, fyzické umístění (kap. 3.2),
- aktuálního držitele podle evidence, nebo „ve skladu“,
- případnou fotografii,
- historii: zápůjčky, vrácení, výměny, změny stavu a umístění, pracovní úkoly, inventurní kontroly, vyřazení.

Je potřeba snadno vyhledávat podle **řady a čísla**, klasifikace a osoby, které je kus svěřen.

### 3.2 Stav, vydatelnost, umístění a držitel

| Údaj | Hodnoty | Poznámka |
| --- | --- | --- |
| **Stav** | v pořádku / vyžaduje úpravu (není poškozený) / poškozený | nezávislý na umístění |
| **Vydatelnost** | vydatelný / nevydatelný | např. praní, zásadní vada; nevydatelný kus nelze půjčit bez ohledu na stav |
| **Fyzické umístění** | sklad / u držitele / u švadleny / v opravě / neznámé (+ poznámka) | kde kus skutečně je |
| **Držitel v evidenci** | člen / externista / nikdo | komu je kus oficiálně svěřen |

Vrácení kusu automaticky neznamená, že je připravený k dalšímu vydání: vrácená nevypraná košile je ve skladu, ale nevydatelná.

### 3.2a Kusy v opravě

Kus může být v evidenci „ve skladu“, ale fyzicky u švadleny. Inventura ho proto **nesmí potvrdit jen podle evidence** (kap. 7.4).

### 3.3 Klasifikace a evidenční řady

Příklady dimenzí u Vonice:

- pohlaví kroje: mužský / ženský;
- region: Horňácko / Kopanice / Zálesí / Slovensko;
- druh součástky: košile, gatě, traslavice, pruclek, klobouk, čižmy, rukávce, spodnica, fěrtůška, saky, šatka atd.;
- doplňkové varianty podle druhu: nové / staré, modré / bílé atd.

**Evidenční řada** je konkrétní kombinace klasifikace (např. mužské / Horňácko / košile). Varianta (bílé vs. modré gatě) může podle nastavení řady patřit **do klíče řady** (vlastní číslování), nebo být **atributem kusu** v jedné řadě. Nepředpokládá se, že každá varianta vždy zakládá novou řadu. Ne všechny dimenze platí pro všechny druhy.

Konfiguraci klasifikace, druhů, řad a šablon kompletů spravuje krojařka v **Správa krojů → Nastavení**. Nejde o obecný formulářový framework – jen o typované možnosti a filtry pro tento obor.

### 3.4 Zaměnitelné drobnosti bez čísla – otevřená otázka

Verze 0.3 počítala s neočíslovanými doplňky evidovanými podle druhu a počtu (např. dvě úzké mašle do vlasů, stav „1 ze 2“). **Současný model eviduje každý kus jednotlivě** (kus může být dočasně bez čísla, ale je to samostatný záznam). Zda je pro drobnosti potřeba evidence podle počtu, nebo stačí jednotlivé kusy bez fyzického čísla, je potřeba ověřit s krojařkami (kap. 13). Do rozhodnutí **nezavádět** hromadné množstevní položky.

## 4. Komplety jako šablony

Šablona kompletu = název, pohlaví, region a **seznam druhů součástek**, které kroj potřebuje (např. „Horňácký mužský“: košile, gatě, pruclek, klobouk, čižmy).

- Na krojové kartě držitele aplikace podle šablony upozorní, **které druhy mu chybějí**.
- Šablona nepředepisuje konkrétní čísla kusů; žádné „sady se shodným číslem“.
- Změna šablony nemění historii zápůjček.

**Výjimka – cizí komplety:** při dočasném příjmu cizího kroje (kap. 6B) lze celý komplet evidovat jako **jednu jednotku**, aby krojařka nemusela rozepisovat desítky dílů kvůli krátké výpůjčce.

## 5. Zápůjčky, vrácení a výměny

### 5.1 Výdej

Krojařka vybere **konkrétní dostupný kus** (vydatelný, nikomu nesvěřený), držitele a datum. Může doplnit termín vrácení a **poznámku k zápůjčce** („na vystoupení“, „předáno bez knoflíku“). Jeden kus nesmí být současně zapůjčen dvěma lidem.

Při vydávání více kusů jedné osobě může jako pomůcka posloužit šablona kompletu (co ještě chybí), ale vydávají se vždy jednotlivé kusy.

### 5.1a Nabídka kusů podle výchozího kroje osoby

U každé osoby (člena i externisty) lze evidovat **výchozí kroj**: mužský / ženský / neurčeno. Nejde o obecný údaj o pohlaví, ale o krojovou preferenci pro nabídku při vydávání. Údaj je nepovinný a nastavuje ho krojařka na krojové kartě osoby, případně Správa souboru v detailu osoby.

- Když pro kroj přijde Martina s výchozím krojem ženským, výběr kusu **primárně nabízí ženské součástky** a druhy použitelné v obou krojích (druh bez pohlaví). Stejně se řídí i šablona kompletu, podle které aplikace ukazuje, co osobě chybí.
- Jde jen o **řazení a výchozí filtr, nikdy o zákaz**. Jedním klepnutím („zobrazit všechny kusy“) lze vybrat kus libovolného pohlaví a vydat ho bez dalšího potvrzování. U takového kusu se na krojové kartě jen nenápadně zobrazí, že nejde o výchozí kroj osoby.
- U osoby s výchozím krojem „neurčeno“ se nabízí vše.
- **Kus pro jinou osobu:** Verča si může vypůjčit na sebe součástku pro manžela, odpovědnost pak nese ona. Pokud ji ale bude manžel nosit dlouhodobě, doporučuje se vést ho jako externistu s vlastní krojovou kartou, aby evidence odpovídala skutečnému držiteli.
- **Choreografie s obráceným krojem** (např. fašanková obchůzka, holky v mužských krojích): vydání proběhne běžně přes „zobrazit všechny kusy“, s volitelnou poznámkou k zápůjčce („fašank“) a termínem vrácení. Výchozí kroj osoby se tím nemění.
- Výchozí kroj neovlivňuje inventuru ani oprávnění.

### 5.2 Vrácení

Krojařka zaznamená skutečné převzetí a může doplnit **poznámku k vrácení** („vrácena nevypraná“). Současně může upravit stav, vydatelnost a umístění kusu. Zápůjčka se ukončí, historie i poznámka zůstanou.

Při vrácení více kusů najednou se výjimky označují **po jednotlivých kusech**; co se nevrátilo, zůstává u držitele.

### 5.3 Výměna

Výměna = vrácení původního kusu a vydání jiného **existujícího dostupného kusu** v jednom kroku, se vzájemnou vazbou obou zápůjček. Pokud původní kus nebyl skutečně předložen, **neoznačí se jako vrácený ani fyzicky ověřený**.

### 5.4 Odpovědnost za svěřené věci

Pokud má Anička zapůjčenou košili a bez vědomí krojařky ji dá Lojzovi, systém dál eviduje odpovědnost Aničky. Změní se pouze tehdy, když krojařka předání zaznamená.

### 5.5 Pracovní úkoly na kusu

Krojařka může na konkrétním kusu založit **pracovní úkol**: úprava / oprava / přešití, popis, kdo řeší, termín. Stavy: otevřený → rozpracovaný → hotovo / zrušeno (bez schvalování). Úkol lze založit při inventuře i mimo ni. Dokončení úkolu **samo nemění** stav ani umístění kusu – ty potvrdí krojařka.

Výhledově se pracovní úkoly mohou stát úkoly obecného modulu Úkoly s vazbou na kus (`10` kap. 4.9).

## 6. Kdo si může kroje půjčovat

**Aktivní člen souboru:** půjčuje si kroje a vidí je v **Moje kroje** – osobní krojové kartě jen ke čtení (zapůjčené kusy s řadou a číslem, seskupené podle regionu/druhu, termíny vrácení, inventurní výzvy).

**Bývalý člen:** přestane být aktivním členem, ale **jeho záznam se nesmí smazat**. Pokud má stále něco zapůjčeného, zůstává dohledatelný jako držitel a má omezený osobní přehled nevrácených krojů. Ukončení členství samo zápůjčku neuzavírá.

**Externista:** krojařka může zapůjčit kroj i člověku mimo soubor bez účtu v aplikaci (jméno, kontakt, poznámka). Není nutné ho zařazovat do skupin. Pokud se stane hostem akce nebo spolupracovníkem, může dostat cílený přístup; samotná zápůjčka mu ho nedává (viz `07`).

Zachování historie **neznamená automaticky zachování přístupu**.

## 6A. Osobní zápůjčka napříč folklorními soubory

**Sklad je autoritativní evidencí pohybů.** Jednotlivé folklorní soubory mají vlastní, navzájem oddělené sklady. Zápůjčka se může týkat osoby, která **není členem vydávajícího souboru**.

- Příklad: krojařka Malé Vonice vydá Ádě z dospělé Vonice záleský kroj. Ve skladu Malé Vonice je Áďa externí vypůjčitelka. **Členství ani přepnutí kontextu Malé Vonice jí nevzniká.**
- Pokud je externí vypůjčitel spolehlivě propojen s existující **globální osobou**, zápůjčka se mu zobrazí v **Moje kroje** s původem „Zapůjčeno z Malé Vonice“. Vidí jen své svěřené kusy, termíny a pokyny, nikoliv další položky ani členy cizího skladu.
- Externistu je možné vést **bez účtu**; dodatečné propojení s globální identitou musí proběhnout bezpečně, bez obecného seznamu všech účtů pro krojařku cizího souboru a bez náhodného propojení stejnojmenných osob.
- Přímá osobní zápůjčka **nezakládá duplicitní skladovou položku** v dospělé Vonici.
- Po odchodu člena z domovského souboru zůstává osobní přehled nevrácených krojů přístupný v omezeném rozsahu, aniž by se vracela oprávnění k souboru.

## 6B. Dočasný příjem cizích krojů a hromadné předání

Systém musí umět **převzít cizí kroje do dočasné správy** od jiného souboru, který může, ale nemusí aplikaci používat.

- Příjem obsahuje vlastníka/zapůjčitele (organizace nebo externí osoba), datum převzetí, případný termín vrácení, stav, **původní evidenční čísla** a aktuálního držitele. Původní čísla se nepřečíslují do vlastních řad; interní identita se vytváří zvlášť, i kdyby cizí číslo kolidovalo s místním.
- Dvě úrovně podrobnosti: **celý komplet jako jedna jednotka**, nebo evidence jednotlivých součástí.
- Převzaté kroje lze dále **přidělit členům**. Rozlišuje se **vlastník**, **evidující sklad** a **aktuální držitel**. Dočasný příjem nekončí, dokud nebylo vrácení či chybějící části vypořádáno; lze částečně vracet a dokumentovat nesrovnalosti.
- Po vrácení vlastníkovi položka přestává být **aktivním inventářem**, historie zůstává.
- Příklad **10 kompletů z Malé Vonice dospělé Vonici bez určení tanečníků**: sklad Malé Vonice zaznamená výdej externímu vypůjčiteli „Vonica“; sklad dospělé Vonice **samostatně** zaznamená dočasný příjem a následná přidělení tanečníkům. Jde o dvě evidence **různých etap odpovědnosti**, ne o synchronizaci skladů.
- Později lze nabídnout **import/export předávacího seznamu**, bez povinného propojení databází.

**Provozní pravidlo:** skutečný přesun odpovědnosti či věcí musí zaznamenat příslušná krojařka. Dohoda mimo aplikaci záznam nenahrazuje.

## 7. Inventura: jedna akce, dva pracovní režimy

Inventura je akce nad **celým fondem nebo výslovně vymezenou podmnožinou fyzických kusů** – nikoli inventura jedné evidenční řady. Má název, datum, stav, rozsah a **zmrazený seznam cílových kusů** vytvořený při zahájení. Postup se počítá podle **unikátních fyzických kusů**, ne podle počtu kliknutí, návštěv či zápůjček.

### 7.1 Rozsah

Při založení krojařka kombinuje filtry:

- celý fond, nebo klasifikace (region, pohlaví, druh, varianta);
- volitelně **skupina členů** (muzikanti, tanečníci, holky, kluci…);
- kombinace = **průnik** podmínek.

Pravidla:

- bez filtru na lidi zahrnuje inventura relevantní kusy **zapůjčené i ve skladu**, včetně kusů v opravě či jinde;
- inventura skupiny „kroje muzikantů“ zahrnuje **kusy zapůjčené lidem ve skupině Muzikanti**, ne všechny kusy „muzikantského typu“, a nezahrnuje nezapůjčené zásoby;
- člen ve více skupinách → každý kus v rozsahu jen jednou;
- při zahájení se zmrazí cílové kusy a dotčení držitelé; pozdější výměna či změna skupiny rozsah tiše nemění. Kus lze přidat později jen **výslovně s poznámkou**.

Před zahájením náhled: počet kusů, dotčených držitelů, nezapůjčených kusů, popis filtrů, upozornění na prázdný rozsah.

### 7.2 Režim „Podle lidí“ – zapůjčené kusy

- Seznam obsahuje **jen osoby, které drží aspoň jeden cílový kus**.
- Krojařka vypíše **termíny návštěv** s kapacitou (výchozí např. 3 osoby, nastavitelné). Termíny jsou samostatné, nenavázané na akce v kalendáři.
- Přihlásit se smí jen dotčení; člen vidí v **Moje kroje** inventurní výzvu, volné termíny a seznam kusů, které má přinést.
- Krojařka vidí neobjednané, objednané a odbavené členy.
- **Návštěva** ukáže krojovou kartu filtrovanou na cílové kusy (řada + číslo). U každého kusu: předložen / nepředložen, stav (v pořádku / poškozen / vyžaduje úpravu), poznámka, pracovní úkol.
- V témže kroku lze běžnými operacemi kus **vrátit, nově vydat či vyměnit** (kap. 5) – inventura nemá vlastní odlišnou implementaci pohybů.
- Na konci **rekapitulace**: ověřené kusy, poškození a úpravy, nepředložené kusy, provedené pohyby, otevřené úkoly; krojařka potvrdí dokončení návštěvy.
- **Dokončená návštěva ≠ všechny kusy ověřené.** Nepředložené zůstávají v inventuře otevřené.
- **Tvrzení držitele bez fyzického předložení není inventurní kontrolou.**

### 7.3 Režim „Ve skladu“ – nezapůjčené kusy po řadách

Typicky: jedna krojařka vybírá ze skladu mužské horňácké košile a diktuje čísla, druhá je zadává.

- Přepínač „Podle lidí“ / „Ve skladu“ v téže inventuře.
- Seskupení podle evidenční řady; **číselná mřížka** se stavy kusů.
- **Rychlé zadání čísel s potvrzením Enter**, i dávky a rozsahy (`1, 3, 7, 12-15`); okamžité potvrzení a prázdný vstup pro další číslo; zrušení posledního zápisu.
- Neexistující číslo, opakovaná kontrola a kus mezitím zapůjčený nebo vedený mimo sklad se **zřetelně vrátí**, nepotvrdí se potichu.
- Detail kusu: poškození, úprava, poznámka, pracovní úkol.
- Čísla vyřazených kusů nejsou „chybějící“ položky; nepředpokládá se souvislá řada.
- Výsledky jsou vidět v obou režimech; každý kus má v dané inventuře právě jeden výsledný stav ověření.

### 7.4 Průběh a uzavření

Sledují se odděleně:

1. **průběh návštěv** – kolik dotčených lidí se dostavilo / zbývá;
2. **pokrytí kusů** – unikátní fyzicky ověřené kusy / celý zmrazený rozsah;
3. **otevřené nesrovnalosti a práce** – nepředloženo, nezvěstné, poškozené, čeká na úpravu, otevřené úkoly.

Poškozený, ale předložený kus **je fyzicky ověřený**. Nepředložený **není**. Kus „ve skladu“ podle evidence, ale fyzicky nenalezený, není ověřený. Oprava může zůstat otevřená i po ověření kusu.

**Nepřítomnost kusu neznamená automaticky ztrátu.** Rozlišuje se „zatím nezkontrolováno“ a „skutečně chybí“.

Uzavření:

- **„vše ověřeno“** jen tehdy, když byly všechny cílové kusy skutečně fyzicky ověřeny;
- jinak jen **výslovné uzavření s nesrovnalostmi** s rekapitulací a uvedeným důvodem; aplikace nikdy netvrdí, že bylo zkontrolováno vše.

Výsledek se uloží a pozdější pohyby ho zpětně nepřepisují. Historie kontrol musí odpovědět na otázku **„Kdy krojařka naposledy fyzicky viděla kus X?“** napříč inventurami i po letech.

## 8. Poznámky, poškození a vyřazení

- **Poznámka ke kusu:** dlouhodobá informace o předmětu.
- **Poznámka k zápůjčce:** informace ke konkrétnímu vydání.
- **Poznámka k ukončení zápůjčky:** historický záznam z vrácení či výměny („vrácena nevypraná“).
- **Poznámka k inventurní kontrole:** zjištění při fyzické kontrole.
- **Pracovní úkol:** co je potřeba udělat (kap. 5.5).

O **vyřazení** rozhoduje krojařka. Zaznamená se datum, kdo a důvod; kus i jeho číslo zůstávají v historii. Číslo lze znovu použít jen u řady, která to výslovně povoluje. Pokud je kus stále zapůjčený, aplikace na to upozorní a vyžaduje vypořádání.

## 9. Viditelnost a oprávnění

Oprávnění vznikají **pověřením** (viz `08`), ne rolí:

- **Správa krojů (krojařka):** zápis a úpravy kusů, řad, šablon, zápůjček, výměn, úkolů, inventur a vyřazení; přehledy, tisk, export.
- **Náhled do správy krojů:** prohlížení evidence bez zápisu (např. vedení).
- **Běžný člen:** jen vlastní **Moje kroje**; nemůže měnit evidenci.
- **Správa souboru** sama o sobě **nedává** přístup ke krojové evidenci.
- **Externista** pro zápůjčku nepotřebuje účet. S cíleným přístupem vidí jen povolený obsah a evidenci nemění.

## 10. Přehledy, tisk a export – součást první provozní verze

- seznam kusů podle řady, čísla a klasifikace (Správa krojů → Sklad, cílově „Součástky“);
- krojová karta konkrétního držitele včetně externistů a bývalých členů;
- přehled zápůjček (aktivní i historie), nevrácené a po termínu;
- inventurní seznam a výsledky inventury včetně nesrovnalostí;
- přehled vyřazených kusů a jejich historie;
- kusy v opravě a otevřené pracovní úkoly.

Konkrétní tiskové sestavy a formáty doladíme s krojařkami. Exporty s osobními údaji podléhají stejným oprávněním jako aplikace.

## 11. Situace, které musí evidence zvládnout

**A. Evidenční řady:** „Mužská horňácká košile 1“ a „ženská kopaničká spodnica 1“ jsou dva různé kusy. Mezery v číslování jsou v pořádku.

**B. Vyřazení:** Vyřazený kus zůstane v historii se svým číslem; číslo dostane nový kus jen v řadě s povoleným opakovaným použitím.

**C. Varianta:** Modré a bílé gatě mají podle nastavení buď vlastní řady, nebo jsou variantou kusu v jedné řadě.

**D. Krojová karta:** Člen má několik různě očíslovaných kusů dvou regionů; šablona kompletu ukáže, který druh mu chybí.

**E. Částečné vrácení:** Člen vrátí všechno kromě jednoho kusu; ten zůstává u něj a je dohledatelný.

**F. Výměna:** Krojařka vymění kus za existující dostupný kus téhož druhu; obě zápůjčky jsou provázané, kus nikdy není u dvou lidí.

**G. Vrácení nevyprané košile:** Košile je vrácena (umístění sklad), poznámka k vrácení zůstane, kus je nevydatelný do vyprání.

**H. Oprava:** Kus je fyzicky u švadleny s otevřeným pracovním úkolem; inventura ve skladu ho nepotvrdí podle evidence.

**I. Externista a bývalý člen:** Krojařka zapůjčí kroj člověku mimo soubor bez účtu; bývalý člen má dál otevřenou zápůjčku a omezený osobní přehled.

**J. Inventura části fondu:** „Ženské Kopanice“ – klasifikační rozsah včetně kusů ve skladu.

**K. Inventura skupiny:** „Kroje muzikantů“ – jen kusy zapůjčené členům skupiny Muzikanti; člen ve více skupinách se nezapočítá dvakrát.

**L. Návštěva s nepředloženým kusem:** Návštěva se dokončí, nepředložený kus zůstane v inventuře otevřený.

**M. Diktování čísel:** Krojařky ve skladu rychle zadávají čísla; chybné, opakované a zapůjčené číslo aplikace zřetelně vrátí.

**N. Uzavření s nesrovnalostmi:** Jen výslovně, s rekapitulací a důvodem.

**O. Výpis do tisku:** Krojařka připraví seznam kusů nebo zápůjček pro kontrolu mimo aplikaci.

**P. Přímá osobní výpůjčka z jiného skladu:** Malá Vonica půjčí kroj Ádě; Áďa ho vidí v Moje kroje, ale nezískává členství ani čtení skladu Malé Vonice.

**Q. Dočasný příjem od cizí organizace:** Vonica převezme deset kompletů s původními čísly, rozdělí je členům, částečně vrátí a dohledá historii.

**R. Hromadné předání Malá Vonica → Vonica:** Výdej a příjem jsou samostatné operace dvou skladů.

**S. Odchod člena:** Ukončení členství neuzavře zápůjčky ani nevymaže historickou odpovědnost.

**T. Nabídka podle výchozího kroje:** Martině (výchozí kroj ženský) se při vydávání nabízejí nejdřív ženské a univerzální součástky. Krojařka přesto může jedním klepnutím vydat mužský kus, například na fašankovou obchůzku nebo Verče pro manžela.

## 12. Co může počkat na další verze

- QR kódy a automatické načítání evidenčních čísel,
- rezervování krojů na konkrétní vystoupení (krojové požadavky k akci, `10` kap. 4.10),
- automatické doporučování velikostí,
- automatické připomínky vrácení,
- napojení pracovních úkolů na obecný modul Úkoly,
- rozsáhlý obrazový archiv krojů,
- podrobné statistiky využívání,
- samoobslužné žádosti členů o zápůjčku (evidence se nikdy nezmění bez krojařky),
- import/export předávacích seznamů mezi soubory.

## 13. Zbývající upřesnění s krojařkami

1. **Seznam řad:** přesné názvy a klíče řad pro Vonici; které varianty (např. modré/bílé gatě) mají vlastní řadu. Demo ukazuje obojí (horňácké gatě = atribut, slovenské gatě = vlastní řady).
2. **Opakované použití čísel:** u kterých řad ho povolit (výchozí: nepovolovat).
3. **Zaměnitelné drobnosti bez čísla** (kap. 3.4): stačí jednotlivé kusy bez fyzického čísla, nebo je nutná evidence podle počtu?
4. **Uzavření inventury s nesrovnalostmi:** zatím smí každá krojařka, vždy s důvodem – potvrdit.
5. **Výchozí kroj osoby:** stačí mužský / ženský / neurčeno, nebo je potřeba jemnější rozlišení (např. dětský kroj u Malé Vonice)?
6. **Pracovní úkoly:** stačí stavy otevřený / rozpracovaný / hotovo / zrušeno bez schvalování?
7. **Termíny inventury:** zůstanou samostatné, nebo je navázat na akce v kalendáři?
8. **Tisk a export:** jaké sestavy a formáty potřebujete při první inventuře?

Tento dokument není technickým návrhem databáze; orientační doménové entity jsou v příloze.

## 14. Schválení

- [ ] Fyzický kus, evidenční řady, číslování a vyřazení jsou popsány správně.
- [ ] Komplet jako šablona druhů a krojová karta z individuálních zápůjček odpovídají praxi.
- [ ] Stav, vydatelnost, umístění a pracovní úkoly odpovídají praxi.
- [ ] Evidence aktivních, bývalých a externích vypůjčitelů odpovídá praxi.
- [ ] Inventura ve dvou režimech umožní provést první skutečnou kontrolu skladu.
- [ ] Rozsah první provozní verze je dostačující.

**Připomínky:**

................................................................................

**Datum projednání:** ................................

**Za krojový sklad:** ................................

## Příloha: orientační doménové entity

Entity zůstávají oddělené; žádná obří generická entita ani jeden společný stavový výčet.

| Entita | Obsah |
| --- | --- |
| `CostumeClassification` | pohlaví, regiony, varianty souboru |
| `CostumePartType` | druh součástky |
| `CostumeSeries` | evidenční řada = kombinace klasifikace (+ volitelně varianta), pravidlo opakovaného použití čísel |
| `CostumeItem` | stabilní ID, `ensembleId`, řada, číslo, varianta, velikost, poznámka, stav, vydatelnost, umístění, vyřazení |
| `CostumeKitTemplate` | šablona kompletu: pohlaví, region, seznam druhů |
| `ExternalPerson` | externí vypůjčitel bez účtu |
| výchozí kroj osoby | atribut osoby / externisty: mužský / ženský / neurčeno; jen pro řazení nabídky při vydávání (kap. 5.1a) |
| `CostumeLoan` | kus × držitel, výdej, termín, ukončení (vráceno / vyměněno / vypořádáno), vazba na nahrazovanou zápůjčku a inventuru |
| `CostumeWorkOrder` | pracovní úkol na kusu |
| `Inventory` | rozsah (filtry), zmrazený seznam kusů a držitelů, výslovná doplnění, uzavření s důvodem |
| `InventorySlot`, `InventoryVisit` | termín s kapacitou, rezervace a návštěva držitele |
| `InventoryCheck` | kontrola kusu (režim, výsledek předložení a stavu, poznámka, kdo, kdy); opakované kontroly v historii, do pokrytí se kus počítá jednou |
| historie / události | pohyby, výměny, změny stavu a umístění pro dohledání „kdy a kde byl kus naposledy viděn“ |

Neslučovat `isPhysicallyVerified`, `condition`, `loanStatus`, `location`, `workOrderStatus` a `visitStatus` do jednoho stavu. Všechny entity nesou `ensembleId`.

---

*Verze 0.4 nahrazuje model fyzických kompletů a množstevních doplňků z verze 0.3 modelem fyzických kusů, evidenčních řad a šablon kompletů, doplňuje stav/umístění/vydatelnost, pracovní úkoly a inventuru ve dvou režimech a zapracovává dříve samostatné implementační zadání (Krojárna, Moje kroje a inventury).*
