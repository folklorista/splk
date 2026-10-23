# Krojový sklad – funkční specifikace pro krojařky

**Souborový systém · Verze 0.5 · 22. 10. 2026**
**Stav:** Platná doménová specifikace pro aplikaci **Krojařka** a pro budoucí Správu krojů v `moje`. Je to podklad ke schválení krojařkami (kap. 14 je nevyplněná).

**Vývoj verzí:**

- v0.3 (15. 10.) – fyzické komplety a neočíslované doplňky;
- v0.4 (18. 10.) – fyzický kus + evidenční řada, komplet jako šablona, inventura ve dvou režimech; podle ní je postaveno demo;
- **v0.5 (22. 10.)** zapracovává rozhodnutí z `docs/decisions.md`:
  - **fyzické komplety** s proměnlivým složením a nečíslovanými doplňky (D-19);
  - **opakované použití čísel povolené ve výchozím stavu** (D-20);
  - krojový fond a pověření **podle složky**, pomocnice rovnocenné (D-21);
  - model se složkami místo samostatných souborů (D-06).

Verze 0.3 je v `docs/archive/06-specifikace-krojoveho-skladu-v0.3.md`, v0.4 v historii Gitu.

Obrazovky aplikace Krojařka: `krojarka/frontend-demo-specifikace.md`. Navigace budoucí `moje`: `moje/10-navigace-a-struktura-menu.md` kap. 4.5 a 4.6. Stav implementace: `03-stav-vyvoje.md`. Otevřené podrobnosti: `docs/open-questions.md` Q-01 až Q-05.

**Názvosloví:**

- *krojařka* = osoba s pověřením ke krojům složky; pomocnice jsou také krojařky;
- *Krojařka* = aplikace;
- *sklad* = místnost, kde leží nezapůjčené kroje;
- *Správa krojů* = agenda v `moje`;
- *Moje kroje* = osobní krojová karta člena.

Pojmy „krojárna“ a „krojárka“ nepoužíváme.

## 1. Proč krojový sklad digitalizujeme

Chceme mít na jednom místě spolehlivý přehled o krojových součástech: **co máme, kde to fyzicky je, komu je to podle evidence svěřeno, v jakém je to stavu a co chybí**. Evidence má usnadnit vydávání a vracení krojů, dohledávání jednotlivých kusů, opravy a skutečnou inventuru.

**Krojový sklad je autoritativní evidence** skutečného svěření a pohybu krojů – na rozdíl od docházky, která je jen orientační (viz `00`, `07`).

Aplikace má být použitelná na mobilu přímo u krojů a současně umožňovat práci na počítači, tisk a export přehledů.

## 2. Dohodnutá základní pravidla

1. **Základní entitou je fyzický kus** (součástka). Každý má stabilní interní identitu, evidenční řadu, evidenční číslo v rámci řady, klasifikaci, stav, umístění, držitele a historii.
2. **Evidenční řady jsou samostatné.** Číslo `1` může současně označovat „mužská horňácká košile 1“ i „ženská kopaničká spodnica 1“. Identifikaci pro lidi tvoří vždy **řada + číslo**; samotné číslo není jedinečné.
3. **Čísla mohou mít mezery a nepřečíslovávají se.** Vyřazený kus zůstává v historii i se svým číslem. **Opakované použití čísla vyřazeného kusu je ve výchozím stavu povolené.** U konkrétní řady ho lze v nastavení zakázat (D-20). Historie starého a nového kusu se nikdy nespojí.
4. **Klasifikace je konfigurovatelná pro krojový fond** (pohlaví kroje, region, druh součástky, doplňkové varianty). Jiný fond nebo organizace může rozlišovat jiné dimenze.
5. **Komplet je fyzická jednotka**: taška nebo ramínka v jednom obalu s lístkem, na kterém je výčet součástek. Má vlastní označení, **proměnlivé složení** (komplety téže řady se mohou lišit) a může obsahovat číslované kusy i **nečíslované doplňky evidované počtem**. Lze ho vydat celý a inventarizovat (kap. 4, D-19). Výpůjčka jednotlivého kusu komplet nevyžaduje.
6. **Krojová karta držitele = soubor jeho výpůjček**, tedy jednotlivých kusů a celých kompletů. Jeden člověk může mít kusy více regionů i více kusů stejného druhu.
7. **Existují dlouhodobá přidělení i krátkodobé zápůjčky.** Termín vrácení nemusí být u dlouhodobých přidělení vyplněn. Na vystoupení se typicky vydávají celé komplety a po vystoupení vracejí.
8. **Výdej, vrácení, výměny, opravy, inventury a vyřazení zapisují pouze krojařky** (pověření ke krojům dané složky). Pomocnice mají stejná práva jako hlavní krojařka. Běžní členové evidenci sami nemění.
9. **Odpovědnost se řídí oficiální evidencí.** Neohlášené předání mezi členy odpovědnost nepřenáší.
10. **Zápůjčky mohou mít i externisté a bývalí členové.** Jejich identita a historie musí zůstat dohledatelná.
11. **Stav, umístění, vydatelnost a držitel jsou různé informace** a nemíchají se do jednoho stavu (kap. 3.2).
12. **Poznámky lze zapisovat ke kusu, k zápůjčce, k jejímu ukončení i k inventurní kontrole.** Historická poznámka se nepřepíše pozdějším vypráním či opravou.
13. **Součástí první provozní verze je inventura a tisk či export seznamů**, nejen přehled v mobilu.
14. **Krojový fond patří složce** (dospělá Vonica, Malá Vonica, Děvčice; u Voničky I, II, III – D-29). Krojařka pracuje jen s fondem složky, ke které má pověření. Krojařky jiných složek vidí jen seznamy lidí, ne cizí evidenci (D-21).

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

Konfiguraci klasifikace, druhů a řad (součástek i kompletů) spravuje krojařka v **Nastavení** (v `moje` Správa krojů → Nastavení). Nejde o obecný formulářový framework – jen o typované možnosti a filtry pro tento obor.

### 3.4 Zaměnitelné drobnosti bez čísla

Některé drobné doplňky není účelné jednotlivě označovat. U Vonice jsou nečíslované **kytička, korále, mašle barevné a mašle bílá** (D-37). Například v kompletu jsou předepsané dvě úzké mašle do vlasů, ale nezáleží na tom, zda se po vrácení jedná o tytéž fyzické kusy (D-19).

U takové položky stačí evidovat **druh, požadovaný počet, aktuálně přítomný počet a případnou poznámku**. Při jednom kusu může rozhraní ukazovat prosté **přítomno / chybí**, při více kusech stav **1 ze 2**. Při předání a vrácení se sleduje počet kusů, ne jejich identita. Krojařka je nemusí číslovat ani označovat štítkem.

Je důležité rozlišit doplněk **záměrně bez čísla** od jedinečného kusu, kterému fyzické číslo **zatím chybí** a má ho teprve dostat.

**Nečíslované doplňky lze evidovat a půjčovat i mimo komplet** (ve skladu, u osoby), vždy podle druhu a počtu (D-35).

## 4. Komplety

*Text vychází z verze 0.3 (kap. 4–5), upraveno podle rozhodnutí D-19.*

Komplet je **fyzická jednotka**: součásti uložené společně v tašce nebo na ramínkách v jednom obalu, na kterém je **lístek s výčtem součástek**. Má vlastní označení (např. „Záleský komplet Z12“) a může obsahovat **číslované kusy i nečíslované doplňky evidované počtem**.

**Komplet nemá pevnou strukturu.** Komplety téže řady nebo typu mohou obsahovat různé druhy součástek. Krojová evidence proto u každého kompletu vede jeho vlastní určené složení.

U každého kompletu musí být vidět:

- **určené složení** – co do něj patří (odpovídá lístku);
- **aktuálně přítomné součásti** – co je evidováno v kompletu a není samostatně vypůjčeno jinde;
- **chybějící součásti** – co do něj patří, ale je samostatně zapůjčeno, nebo zatím nebylo ověřeno či nalezeno;
- stav: **úplný / neúplný / čeká na kontrolu / složení neověřeno** (opsáno z lístku, ale fyzicky nezkontrolováno);
- komu je případně celý komplet svěřen;
- seznam **výpůjček kompletu** (historie);
- přiložené fotografie lístku a karty kompletu (`krojarka/frontend-demo-specifikace.md` kap. 5).

Komplet se při práci chová jako **evidenční držitel součástí**. Krojařka do něj součásti zařazuje a může je z něj přesouvat nebo půjčovat. Komplet ale není osoba a nenese osobní odpovědnost.

### 4.1 Trvalá změna složení

Krojařka může součást do kompletu přidat, trvale ji odebrat nebo ji přesunout do jiného kompletu. Systém zachová, **kdy a kdo složení změnil**. Dřívější výpůjčky a inventury se tím zpětně nemění. Ke změně lze připsat poznámku.

### 4.2 Dočasná zápůjčka součásti z kompletu

Když krojařka samostatně půjčí šátek z kompletu, **šátek dál patří do určeného složení kompletu**, ale označí se jako dočasně nepřítomný. Komplet tak ukazuje chybějící díl i osobu, které byl šátek oficiálně svěřen. Po řádném vrácení do kompletu se jeho dostupnost obnoví.

### 4.3 Řady a čísla kompletů; bez šablon

Komplety mají **vlastní evidenční řady a čísla**, oddělené od řad součástek (např. „Záleský komplet Z12“). Platí pro ně stejná pravidla řad (identita ≠ číslo, opakované použití čísla podle D-20).

**Šablony kompletů se nepoužívají** (D-35). Model v0.4 je měl jako seznam druhů pro upozornění „co držiteli chybí“; tuto funkci aplikace nemá.

### 4.4 Cizí komplety

Při dočasném příjmu cizího kroje (kap. 6B) lze celý komplet evidovat jako **jednu jednotku**, aby krojařka nemusela rozepisovat desítky dílů kvůli krátké výpůjčce.

## 5. Zápůjčky, vrácení a výměny

### 5.1 Výdej

Krojařka vybere **konkrétní dostupný kus** (vydatelný, nikomu nesvěřený), držitele a datum. Může doplnit termín vrácení a **poznámku k zápůjčce** („na vystoupení“, „předáno bez knoflíku“). Jeden kus nesmí být současně zapůjčen dvěma lidem.

### 5.1a Nabídka kusů podle výchozího kroje osoby

U každé osoby (člena i externisty) lze evidovat **výchozí kroj**: mužský / ženský / neurčeno. Nejde o obecný údaj o pohlaví, ale o krojovou preferenci pro nabídku při vydávání. Údaj je nepovinný a nastavuje ho krojařka na krojové kartě osoby, případně Správa souboru v detailu osoby.

- Když pro kroj přijde Martina s výchozím krojem ženským, výběr kusu **ve výchozím stavu nabízí jen ženské součástky** a druhy použitelné v obou krojích (druh bez pohlaví).
- Jde o **výchozí filtr, nikdy o zákaz** (D-34). Volitelný přepínač **„nabízet krojové součástky pro opačné pohlaví“** zobrazí i ostatní kusy a vybraný kus lze vydat bez dalšího potvrzování. U takového kusu se na krojové kartě jen nenápadně zobrazí, že nejde o výchozí kroj osoby.
- U osoby s výchozím krojem „neurčeno“ se nabízí vše.
- **Kus pro jinou osobu:** Verča si může vypůjčit na sebe součástku pro manžela, odpovědnost pak nese ona. Pokud ji ale bude manžel nosit dlouhodobě, doporučuje se vést ho jako externistu s vlastní krojovou kartou, aby evidence odpovídala skutečnému držiteli.
- **Choreografie s obráceným krojem** (např. fašanková obchůzka, holky v mužských krojích): vydání proběhne běžně po zapnutí přepínače „nabízet krojové součástky pro opačné pohlaví“, s volitelnou poznámkou k zápůjčce („fašank“) a termínem vrácení. Výchozí kroj osoby se tím nemění.
- Výchozí kroj neovlivňuje inventuru ani oprávnění.

### 5.1b Výdej celého kompletu jedním krokem

Krojařka vybere komplet a aplikace zobrazí jeho **aktuálně přítomné součásti** a nabídne předání **všech najednou**. Před potvrzením lze zkontrolovat výjimky a konkrétní položku z předání vynechat.

- **Součást, která do kompletu patří, ale je právě samostatně půjčená jinému, se do výdeje nezahrne.** Aplikace na neúplnost upozorní, ale nesmí zaznamenat předání věci, kterou nový držitel nepřevzal.
- Při výdeji se uloží **přesný seznam předaných číslovaných kusů a druhy a počty nečíslovaných doplňků v okamžiku předání**. Pozdější změna složení kompletu tento seznam nemění.

(Převzato z v0.3 kap. 5.2.)

### 5.2 Vrácení

Krojařka zaznamená skutečné převzetí a může doplnit **poznámku k vrácení** („vrácena nevypraná“). Současně může upravit stav, vydatelnost a umístění kusu. Zápůjčka se ukončí, historie i poznámka zůstanou.

Při vrácení více kusů najednou nebo celého kompletu se jedním krokem potvrdí převzetí většiny a výjimky se označí **po jednotlivých řádcích**. Co se nevrátilo, zůstává u držitele. Zápůjčku nelze označit jako vyřízenou, dokud není každá její část vrácena nebo jinak oficiálně vypořádána. **Ke každému vracenému řádku lze zapsat vlastní poznámku**, například:

- košile č. 1 – vrácena, ale nevypraná;
- šátek č. 21 – nevrácen, zůstává v zápůjčce;
- úzké mašle – vrácen 1 kus ze 2, jeden chybí.

U nečíslovaných doplňků se poznámka vztahuje k druhu a počtu kusů v dané zápůjčce. *(Převzato z v0.3 kap. 5.3.)*

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

## 6A. Osobní zápůjčka napříč složkami

*Upraveno ve v0.5 podle modelu se složkami (D-06). Původní text počítal s Malou Vonicí jako samostatným souborem se společnou globální identitou.*

**Sklad je autoritativní evidencí pohybů.** Složky (dospělá Vonica, Malá Vonica, Děvčice) mají vlastní, navzájem oddělené krojové fondy. Zápůjčka se může týkat osoby, která **nepatří k vydávající složce**.

- Příklad: krojařka Malé Vonice vydá Ádě z dospělé Vonice záleský kroj. Ve fondu Malé Vonice je Áďa vypůjčitelka mimo složku. Jde o **tutéž osobu v téže instalaci**; žádná kopie osoby ani „externista“ navíc nevzniká. **Příslušnost k Malé Vonici jí tím nevzniká.**
- Áďa vidí zápůjčku ve svém přehledu krojů s původem „Zapůjčeno z Malé Vonice“. Vidí jen své svěřené kusy, termíny a pokyny, nikoliv další položky ani lidi cizího fondu.
- Krojařka Malé Vonice smí Áďu vyhledat v seznamu osob, ale nezíská tím přístup k jejím ostatním údajům (docházka, příspěvky, evidence jiné složky).
- Přímá osobní zápůjčka **nezakládá duplicitní položku** ve fondu dospělé Vonice.
- **Muzika** nemá vlastní krojařku ani fond; muzikanti si půjčují přímo z fondu dospělé složky (D-21).
- Po ukončení příslušnosti ke složce zůstává osobní přehled nevrácených krojů přístupný v omezeném rozsahu, aniž by se vracela další oprávnění.

Mezi **různými instalacemi** (Vonica × Vonička) se osoby ani účty nesdílejí. Zápůjčka do jiné organizace je výdej externí osobě nebo organizaci podle kap. 6B.

## 6B. Dočasný příjem cizích krojů a hromadné předání

Systém musí umět **převzít cizí kroje do dočasné správy** od jiné složky nebo organizace, která může, ale nemusí aplikaci používat.

- Příjem obsahuje vlastníka/zapůjčitele (organizace nebo externí osoba), datum převzetí, případný termín vrácení, stav, **původní evidenční čísla** a aktuálního držitele. Původní čísla se nepřečíslují do vlastních řad; interní identita se vytváří zvlášť, i kdyby cizí číslo kolidovalo s místním.
- Dvě úrovně podrobnosti: **celý komplet jako jedna jednotka**, nebo evidence jednotlivých součástí.
- Převzaté kroje lze dále **přidělit členům**. Rozlišuje se **vlastník**, **evidující sklad** a **aktuální držitel**. Dočasný příjem nekončí, dokud nebylo vrácení či chybějící části vypořádáno; lze částečně vracet a dokumentovat nesrovnalosti.
- Po vrácení vlastníkovi položka přestává být **aktivním inventářem**, historie zůstává.
- Příklad **10 záleských kompletů z Malé Vonice dospělé Vonici bez určení tanečníků**: fond Malé Vonice zaznamená výdej složce „dospělá Vonica“; fond dospělé Vonice **samostatně** zaznamená dočasný příjem a následná přidělení tanečníkům. Jde o dvě evidence **různých etap odpovědnosti**, ne o synchronizaci fondů (odpovídá praxi ve vonica.md: „složka zapůjčuje složce“). *Zda ve stejné instalaci nabídnout předání mezi fondy jedním krokem, se zatím nerozhodlo.*
- Později lze nabídnout **import/export předávacího seznamu**, bez povinného propojení databází.

**Provozní pravidlo:** skutečný přesun odpovědnosti či věcí musí zaznamenat příslušná krojařka. Dohoda mimo aplikaci záznam nenahrazuje.

## 7. Inventura: jedna akce, tři pracovní režimy

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

- Přepínač „Podle lidí“ / „Ve skladu“ / „Komplety“ v téže inventuře.
- Seskupení podle evidenční řady; **číselná mřížka** se stavy kusů.
- **Rychlé zadání čísel s potvrzením Enter**, i dávky a rozsahy (`1, 3, 7, 12-15`); okamžité potvrzení a prázdný vstup pro další číslo; zrušení posledního zápisu.
- Neexistující číslo, opakovaná kontrola a kus mezitím zapůjčený nebo vedený mimo sklad se **zřetelně vrátí**, nepotvrdí se potichu.
- Detail kusu: poškození, úprava, poznámka, pracovní úkol.
- Čísla vyřazených kusů nejsou „chybějící“ položky; nepředpokládá se souvislá řada.
- Výsledky jsou vidět ve všech režimech; každý kus má v dané inventuře právě jeden výsledný stav ověření.

### 7.3a Kontrola kompletu

*Doplněno ve v0.5 (D-19), podle `krojarka/frontend-demo-specifikace.md` K21.*

- Zobrazí lístek a kartu kompletu (sken), určené složení a rozdíl mezi aktuálně přítomnými a dočasně vypůjčenými součástmi.
- Každý řádek se fyzicky zkontroluje jako **přítomno / nepřítomno / neověřeno**. U nečíslovaných doplňků se zapíše **ověřený počet**.
- Lze zapsat dosud neznámou součást nalezenou v kompletu. Vypůjčený kus se ale nesmí vrátit ani převést skrytým vedlejším efektem.
- Kontrola kompletu je třetí pracovní režim téže inventury vedle „Podle lidí“ a „Ve skladu“.

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

O **vyřazení** rozhoduje krojařka. Zaznamená se datum, kdo a důvod; kus i jeho číslo zůstávají v historii. Číslo lze znovu použít, pokud to řada nezakazuje (D-20). Pokud je kus stále zapůjčený, aplikace na to upozorní a vyžaduje vypořádání.

## 9. Viditelnost a oprávnění

Oprávnění vznikají **pověřením** (viz `moje/08`, D-09), ne rolí. Rozsahem krojových pověření je **složka** (D-10, D-21):

- **Správa krojů (krojařka):** zápis a úpravy kusů, kompletů, řad, zápůjček, výměn, úkolů, inventur a vyřazení ve fondu své složky; přehledy, tisk, export. **Pomocnice mají stejné pověření** jako hlavní krojařka.
- **Krojařka jiné složky:** vidí jen **seznamy lidí**, ne cizí fond ani jeho zápůjčky.
- **Náhled do správy krojů:** účet jen pro čtení, prohlížení evidence bez zápisu – např. pro **audit práce krojařek** (D-36).
- **Běžný člen:** jen vlastní **Moje kroje**; nemůže měnit evidenci.
- **Správa souboru** sama o sobě **nedává** přístup ke krojové evidenci. Role superadministrátora neexistuje (D-09).
- **Externista** pro zápůjčku nepotřebuje účet. S cíleným přístupem vidí jen povolený obsah a evidenci nemění.

## 10. Přehledy, tisk a export – součást první provozní verze

*Sestavy upřesněné krojařkou 2026-10-23 (D-39):*

- **soupis podle řady** – „kdo má půjčené všechny kopanické košile?“;
- **soupis podle člověka** – „co všechno má půjčené Lojza?“;
- **současný a historický soupis konkrétní součástky** – „kdo teď má a kdo dříve měl kopanickou košili č. 3?“;
- **filtrované dotazy** – např. potřebuje opravu, zapůjčeno externistům, součástky pořízené mezi dvěma daty.

Dále:

- seznam kusů podle řady, čísla a klasifikace (Součástky);
- krojová karta konkrétního držitele včetně externistů a bývalých členů;
- přehled zápůjček (aktivní i historie), nevrácené a po termínu;
- inventurní seznam a výsledky inventury včetně nesrovnalostí;
- přehled vyřazených kusů a jejich historie;
- kusy v opravě a otevřené pracovní úkoly.

Formáty (tisk A4, CSV) se doladí při implementaci. Exporty s osobními údaji podléhají stejným oprávněním jako aplikace.

## 11. Situace, které musí evidence zvládnout

**A. Evidenční řady:** „Mužská horňácká košile 1“ a „ženská kopaničká spodnica 1“ jsou dva různé kusy. Mezery v číslování jsou v pořádku.

**B. Vyřazení:** Vyřazený kus zůstane v historii se svým číslem. Číslo může dostat nový kus, pokud řada opakované použití nezakazuje; historie se nespojí.

**C. Varianta:** Modré a bílé gatě mají podle nastavení buď vlastní řady, nebo jsou variantou kusu v jedné řadě.

**D. Krojová karta:** Člen má několik různě očíslovaných kusů dvou regionů a jeden celý komplet.

**D2. Výdej kompletu na vystoupení:** Krojařka vydá komplet Z12; šátek z něj je právě půjčený jinému, proto se do výdeje nezahrne a komplet je veden jako neúplný.

**D3. Nečíslované doplňky:** Komplet obsahuje dvě mašle; vrátí se jedna, zapíše se „1 ze 2“ bez identifikace konkrétní mašle.

**D4. Kontrola kompletu při inventuře:** Krojařka otevře komplet, porovná lístek se skutečností, označí chybějící součást a dopíše nalezenou neevidovanou.

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

**P. Přímá osobní výpůjčka z fondu jiné složky:** Malá Vonica půjčí kroj Ádě; Áďa ho vidí v Moje kroje, ale nezískává příslušnost k Malé Vonici ani čtení jejího fondu.

**Q. Dočasný příjem od cizí organizace:** Vonica převezme deset kompletů s původními čísly, rozdělí je členům, částečně vrátí a dohledá historii.

**R. Hromadné předání Malá Vonica → dospělá Vonica:** Výdej a příjem jsou samostatné operace dvou fondů.

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

*Odpovědi krojařky z 2026-10-23 jsou zapsané v D-37 až D-40 (`docs/decisions.md`).*

1. ~~Seznam řad~~ – řady vycházejí z číselníku `krojarka/krojovy-katalog-vonica.md`. Varianta má, nebo nemá vlastní číslování podle řady (D-37). Slovenské součástky patří k oblasti Zemplín, kromě košile Moravské Lieskové.
2. ~~Opakované použití čísel~~ – rozhodnuto (D-20): výchozí povoleno, u Vonice se zatím nezakazuje u žádné řady.
3. ~~Zaměnitelné drobnosti bez čísla~~ – rozhodnuto (D-19, D-35): podle počtu, v kompletech i mimo ně.
3a. **Komplety:** řady a čísla a zrušení šablon rozhodnuty (D-35). Výdej neúplného kompletu s poznámkou potvrzen (D-38).
3b. ~~Vlastní součástka člena~~ – stačí poznámka na krojové kartě osoby (D-38).
4. ~~Uzavření inventury s nesrovnalostmi~~ – smí každá krojařka, vždy s důvodem (D-38).
5. ~~Výchozí kroj osoby~~ – stačí mužský / ženský / neurčeno (D-38).
6. ~~Pracovní úkoly~~ – stavy otevřený / rozpracovaný / hotovo / zrušeno bez schvalování; další stav musí jít později doplnit (D-38).
7. ~~Termíny inventury~~ – samostatné, nenavázané na kalendář (D-38).
8. ~~Tisk a export~~ – sestavy v kap. 10 (D-39).

Tento dokument není technickým návrhem databáze; orientační doménové entity jsou v příloze.

## 14. Schválení

- [ ] Fyzický kus, evidenční řady, číslování a vyřazení jsou popsány správně.
- [ ] Fyzické komplety (proměnlivé složení, nečíslované doplňky, výdej celého kompletu, kontrola kompletu) a krojová karta odpovídají praxi.
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
| `CostumeSeries` | evidenční řada = kombinace klasifikace (+ volitelně varianta), pravidlo opakovaného použití čísel (výchozí povoleno) |
| `CostumeItem` | stabilní ID, fond (složka), řada, číslo, varianta, velikost, poznámka, stav, vydatelnost, umístění, vyřazení |
| `CostumeKit` | fyzický komplet: vlastní řada a číslo, fond, popis, určené složení, stav ověření složení, přílohy (lístek, karta) |
| řádek složení kompletu | číslovaný kus, nebo nečíslovaný druh s požadovaným a přítomným počtem; historie změn složení |
| osoba (`Person`) | vypůjčitel včetně externistů a osob bez účtu – jedna evidence osob (`identity-model-v2.md`); dřívější samostatné `ExternalPerson` se nepoužívá |
| výchozí kroj osoby | atribut osoby: mužský / ženský / neurčeno; jen pro výchozí filtr nabídky při vydávání (kap. 5.1a) |
| `CostumeLoan` | kus, komplet nebo počet nečíslovaných doplňků × držitel; výdej, termín, ukončení po řádcích (vráceno / vyměněno / vypořádáno), zachycený obsah předání, vazba na nahrazovanou zápůjčku a inventuru |
| `CostumeWorkOrder` | pracovní úkol na kusu |
| `Inventory` | rozsah (filtry), zmrazený seznam kusů a držitelů, výslovná doplnění, uzavření s důvodem |
| `InventorySlot`, `InventoryVisit` | termín s kapacitou, rezervace a návštěva držitele |
| `InventoryCheck` | kontrola kusu (režim, výsledek předložení a stavu, poznámka, kdo, kdy); opakované kontroly v historii, do pokrytí se kus počítá jednou |
| historie / události | pohyby, výměny, změny stavu a umístění pro dohledání „kdy a kde byl kus naposledy viděn“ |

Neslučovat `isPhysicallyVerified`, `condition`, `loanStatus`, `location`, `workOrderStatus` a `visitStatus` do jednoho stavu. Všechny entity krojové evidence patří ke krojovému fondu složky. `ensembleId` zůstává jen jako rezerva (D-06).

---

*Verze 0.5 (22. 10. 2026) vrací fyzické komplety s proměnlivým složením a nečíslovanými doplňky (D-19), mění výchozí opakované použití čísel na povolené (D-20), váže fondy a pověření na složky (D-21) a přepisuje kap. 6A/6B na model se složkami (D-06).*

*Verze 0.4 nahrazuje model fyzických kompletů a množstevních doplňků z verze 0.3 modelem fyzických kusů, evidenčních řad a šablon kompletů, doplňuje stav/umístění/vydatelnost, pracovní úkoly a inventuru ve dvou režimech a zapracovává dříve samostatné implementační zadání (Krojárna, Moje kroje a inventury).*
