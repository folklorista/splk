# Krojový sklad – funkční specifikace pro krojárky

> **ARCHIV – nezávazné.** Verze 0.3 specifikace krojového skladu (15. 10. 2026, s doplňkem 6A/6B z 18. 10.), zkopírovaná z neverzovaného `dev/docs/souborovy-system/`. Používá zastaralý pojem „krojárka“ a model samostatných souborů. Platná je `docs/current/06-specifikace-krojoveho-skladu.md`; fyzické komplety z této verze převzala v0.5 (D-19).


**Souborový systém · Verze 0.3 · 15. 10. 2026**  
**Stav:** Upraveno podle zpětné vazby krojárky a navazující diskuse o neočíslovaných doplňcích a vracení; podklad ke schválení.

## 1. Proč krojový sklad digitalizujeme

Chceme mít na jednom místě spolehlivý přehled o krojových součástech: **co máme, kde to podle evidence je, komu je to svěřeno, co patří do kterého kompletu a co chybí**. Evidence má usnadnit předávání krojů, vracení, dohledávání jednotlivých věcí a skutečnou inventuru.

Aplikace má být použitelná na mobilu přímo u krojů a současně umožňovat práci na počítači, tisk a export přehledů.

## 2. Dohodnutá základní pravidla

1. **Všechny krojové součásti musí být evidovatelné, ale ne všechny potřebují fyzické číslo.** Jedinečné předměty mají vlastní evidenční číslo. Zaměnitelné drobnosti, například úzké mašle do vlasů, lze evidovat bez čísla podle druhu a množství v kompletu.
2. **Číselné řady jsou samostatné pro konkrétní druhy krojů.** Číslo `1` tak může současně označovat „horňácká černá 1“, „kopaničká 1“ a „slovenská stará 1“. Identifikaci tvoří společně číselná řada a číslo.
3. **Evidenční čísla se mohou znovu použít.** Po vyřazení součásti je číslo v její řadě opět volné. Historie původního předmětu zůstane zachována a nikdy se nesmí spojit s historií nové součásti se stejným číslem.
4. **Komplet má určený seznam součástí, ale jeho složení lze měnit.** Trvalé změny složení se zaznamenávají, aby bylo zpětně dohledatelné, co do kompletu patřilo dříve.
5. **Komplet se při práci chová jako samostatný držitel součástí.** Krojárka do něj součásti zařazuje a může je z něj přesouvat nebo půjčovat. Není to však přihlášený uživatel ani člověk nesoucí osobní odpovědnost.
6. **Komplet může být neúplný.** Samostatné zapůjčení šátku neznamená, že šátek přestal do kompletu patřit.
7. **Existují dlouhodobá přidělení i krátkodobé zápůjčky.** Termín vrácení nemusí být u dlouhodobých přidělení vyplněn.
8. **Zápůjčky, vrácení, převody, změny kompletů a vyřazení zapisují pouze pověřené krojárky.** Běžní členové nemohou evidenci sami měnit.
9. **Odpovědnost se řídí oficiální evidencí.** Neohlášené předání mezi členy odpovědnost nepřenáší.
10. **Zápůjčky mohou mít i externisté a bývalí členové.** Jejich identita a historie musí zůstat dohledatelná, i když nejsou aktivními členy souboru.
11. **Poznámky lze zapisovat k součásti, k zápůjčce a také při vrácení ke každé konkrétní vracené součásti.** Historická poznámka při vrácení se zachová i po pozdějším vyprání či opravě.
12. **Převzetí věci a její připravenost k další zápůjčce jsou odlišné informace.** Vrácená, ale nevypraná košile může být evidována jako převzatá, a přesto zatím nepřipravená k vydání.
13. **Součástí v1.0 je inventura a tisk či export seznamů**, nejen přehled v mobilu.

## 3. Jednotlivé krojové součásti

U samostatně číslované součásti chceme zaznamenat:

- evidenční číslo v příslušné číselné řadě,
- druh součásti a případné bližší označení nebo popis,
- velikost či míry, pokud jsou pro daný druh relevantní,
- **volnou textovou poznámku** (například „špinavé“, „povolený šev“, „chybí knoflík“),
- případnou fotografii či fotografie,
- komplet, do kterého součást patří,
- kdo ji má aktuálně oficiálně svěřenou, nebo zda je ve skladu,
- historii zápůjček, vrácení, kontrol a případného vyřazení.

**Pro první verzi nejsou potřeba povinné předem dané stavy typu „čisté / špinavé / poškozené“.** Krojárkám zatím stačí textové poznámky. Později lze přidat strukturované stavy, pokud se ukáže, že jsou užitečné.

Je potřeba snadno vyhledávat podle **číselné řady a evidenčního čísla**, druhu kroje či součásti, kompletu a osoby, které je předmět svěřen.

### 3.1 Zaměnitelné součásti bez fyzického čísla

Některé drobné doplňky není účelné jednotlivě označovat. Například v kompletu je předepsaná jedna úzká mašle do vlasů, ale není důležité, zda se po vrácení jedná o tentýž fyzický kus.

U takové položky stačí evidovat **druh, požadovaný počet, aktuálně přítomný počet a případnou poznámku**. Pokud je požadován jeden kus, rozhraní může ukazovat prosté **přítomno / chybí**. Pokud má komplet obsahovat dvě mašle, musí být možné zapsat i stav **1 ze 2**.

Při předání a vrácení se sleduje počet odpovídajících kusů, nikoliv jejich nezaměnitelná fyzická identita. Systém si může vést vlastní neviditelné označení záznamu, ale **krojárka nemusí předmět očíslovat, označovat ho štítkem ani ověřovat virtuální číslo na každém vráceném kusu**. Historie zápůjček zachytí druh a počet kusů, které byly vydány a vráceny.

Je důležité rozlišit součást **záměrně bez čísla** od jedinečného předmětu, kterému fyzické číslo zatím chybí a má ho teprve dostat.

## 4. Komplety: co do nich patří a co je v nich právě teď

Komplet je skupina evidovaných součástí, obvykle uchovávaných společně v tašce či obalu nebo přidělovaných jedné osobě. Má vlastní označení a seznam součástí. Může obsahovat **jak individuálně číslované předměty, tak neočíslované doplňky evidované podle množství**.

U každého kompletu musí být vidět:

- **jeho určené složení** – co do něj patří,
- **aktuální dostupné součásti** – co je nyní evidováno jako součást kompletu a není samostatně vypůjčeno jinde,
- **chybějící součásti** – co do něj patří, ale je samostatně zapůjčeno nebo dosud nebylo ověřeno či nalezeno,
- zda je komplet úplný, neúplný nebo čeká na kontrolu,
- komu je případně celý komplet svěřen.

### 4.1 Trvalá změna složení

Krojárka může součást do kompletu přidat, trvale ji odebrat nebo ji přesunout do jiného kompletu. Systém zachová informaci, **kdy a kdo složení změnil**, a původní zápůjčky a inventury se tím zpětně nezmění. K dispozici může být volitelná poznámka s vysvětlením změny.

### 4.2 Dočasná zápůjčka z kompletu

Pokud krojárka půjčí samostatně šátek z kompletu, **šátek zůstává součástí jeho určeného složení**, ale označí se jako dočasně nepřítomný. Kompletu se tak zobrazí chybějící díl i osoba, které byl šátek oficiálně svěřen.

Když se šátek řádně vrátí do kompletu, jeho dostupnost se opět obnoví.

## 5. Zápůjčky a vracení

### 5.1 Jednotlivá součást

Krojárka vybere předmět, osobu, které ho předává, a datum předání. Může doplnit předpokládané vrácení a **poznámku přímo k této konkrétní zápůjčce** – například „na vystoupení“, „předáno bez knoflíku“ nebo „vrátit po Katerinkách“.

Při vrácení zaznamená skutečné převzetí a může doplnit **samostatnou poznámku právě k vrácení této součásti**, například „vrácena nevypraná“. Historie původní zápůjčky i tato poznámka se zachovají. Vrácení věci automaticky neznamená, že je připravená k další zápůjčce.

### 5.2 Celý komplet jedním krokem

Krojárka vybere komplet, zobrazí se jeho aktuální seznam dostupných součástí a systém nabídne předání **všech těchto součástí najednou**. Před potvrzením lze snadno zkontrolovat výjimky a případně konkrétní položku z předání vynechat.

**Pokud šátek do kompletu patří, ale je právě samostatně půjčený někomu jinému, do nové zápůjčky celého kompletu se nezahrne.** Aplikace na tuto neúplnost upozorní, ale nesmí zaznamenat předání šátku, který nový vypůjčitel nepřevzal.

U zápůjčky kompletu se uloží přesný seznam předaných číslovaných součástí a druhy a množství předaných neočíslovaných doplňků **v okamžiku předání**. Když krojárka později upraví složení kompletu, seznam dříve zapůjčených věcí zůstane stejný.

### 5.3 Částečné vrácení a poznámky k jednotlivým součástem

Při vrácení kompletu musí jít jedním krokem potvrdit převzetí většiny předmětů a označit výjimky. Pokud se něco nevrátilo, zůstane to nadále evidováno u odpovědné osoby. Systém nesmí označit celou zápůjčku jako vyřízenou, pokud některá její součást dosud nebyla vrácena nebo jinak oficiálně vypořádána.

**U každého řádku vraceného kompletu musí jít samostatně zadat volnou textovou poznámku.** Například:

- košile č. 1 – **vrácena, ale nevypraná**;
- kordulka č. 14 – vrácena bez závad;
- šátek č. 21 – **nevrácen**, zůstává v zápůjčce;
- úzké mašle – vrácen 1 kus ze 2, **jeden kus chybí**.

Poznámka z vrácení se uchová jako **historická informace o konkrétním předání/vrácení**, nikoli jako text, který se přepíše při další zápůjčce. Vedle toho lze upravit aktuální poznámku na kartě součásti. U zaměnitelných doplňků je poznámka vztažena k druhu a počtu kusů v dané zápůjčce.

Krojárka musí mít možnost označit převzatou součást **dočasně nepřipravenou k dalšímu zapůjčení**, například kvůli praní nebo opravě. Pro v1.0 stačí jednoduchá dostupnost a textová poznámka; není nutný podrobný seznam typů závad.

### 5.4 Odpovědnost za svěřené věci

Pokud má Anička zapůjčený komplet a bez vědomí krojárky dá šátek Lojzovi, systém dál eviduje odpovědnost Aničky. Změní se pouze tehdy, když krojárka oficiální předání zaznamená. Neformální domluva mezi členy evidenci sama o sobě nemění.

## 6. Kdo si může kroje půjčovat

**Aktivní člen souboru:** Půjčuje si kroje a může ve svém profilu vidět přehled „Moje kroje“.

**Bývalý člen:** Když odejde ze souboru, přestane být aktivním členem a nebude dál patřit do příslušných aktivních skupin. **Jeho záznam se ale nesmí smazat** – kvůli historii členství, akcí, zápůjček, odpovědnosti i dohledávání krojů. Pokud má stále něco zapůjčeného, musí být nadále dohledatelný jako vypůjčitel. Ukončení členství samo o sobě zápůjčku neuzavírá.

**Externista:** Krojárka může zapůjčit kroj i člověku, který členem souboru není a nemusí mít přístup do aplikace. Stačí možnost jej jednoznačně evidovat jako vypůjčitele a podle potřeby doplnit kontaktní údaj. Není nutné jej kvůli zápůjčce zařazovat do některé ze souborových skupin.

**Externista se však může stát také hostem konkrétní akce** nebo po určitou dobu spolupracovat se souborem. V takovém případě může dostat účet a cílený přístup ke konkrétní akci či určené skupině; samotná evidence zápůjčky mu jej automaticky nedává. Podrobnější pravidla řeší celková specifikace systému `07-souborovy-system-vize-funkce-roadmapa.md`.

Přístup bývalých členů k ostatním částem aplikace bude určen pravidly členství a oprávnění. Zachování historie **neznamená automaticky zachování přístupu**.

## 6A. Osobní zápůjčka napříč folklorními soubory (doplnění 18. 10. 2026)

**Sklad je autoritativní evidencí pohybů.** Jednotlivé folklorní soubory mají vlastní, navzájem oddělené skladové agendy. Zápůjčka se může týkat osoby, která **není členem skladu vydávajícího souboru**.

- Příklad: krojárka Malé Vonice vydá Ádě z dospělé Vonice „Záleský komplet Z12“. Ve skladu Malé Vonice je Áďa externí vypůjčitelka. **Členství ani přepnutí kontextu Malé Vonice jí nevzniká.**
- Pokud je externí vypůjčitel spolehlivě propojen s již existující **globální osobou**, zápůjčka se mu zobrazí v osobním přehledu **Moje kroje** s původem „Zapůjčeno z Malé Vonice“. Vidí jen své svěřené věci, součásti, termíny a pokyny určené vypůjčiteli, nikoliv další položky ani členy cizího skladu.
- Externistu je možné vést **bez účtu**; dodatečné propojení s globální identitou musí proběhnout bezpečně, bez obecného seznamu všech účtů pro krojárku cizího souboru a bez náhodného propojení stejnojmenných osob.
- Přímá osobní zápůjčka **nezakládá duplicitní skladovou položku** v dospělé Vonici. Autoritativní evidence je u vydávajícího skladu.
- Po odchodu člena z jeho domovského souboru zůstává osobní přehled nevrácených krojů přístupný v omezeném rozsahu, aniž by se tím vracela oprávnění k souboru.

## 6B. Dočasný příjem cizích krojů a hromadné předání

Kromě výdeje vlastních krojů systém musí umět také **převzít cizí komplety či součásti do dočasné správy** od jiného folklorního souboru, který může, ale nemusí aplikaci používat.

- Příjem obsahuje vlastníka/zapůjčitele (organizace nebo externí osoba), datum převzetí, případný termín vrácení, stav, původní evidenční čísla a aktuálního držitele. **Původní čísla se nepřečíslují** do vlastní číselné řady; interní ID se vytváří zvlášť, i kdyby cizí číslo kolidovalo s místním.
- Dvě úrovně podrobnosti: **celý komplet jako jedna evidovaná jednotka**, nebo detailní evidence jeho součástí. Krojárka nemá povinnost rozepisovat stovky dílů jen kvůli krátké výpůjčce.
- Převzaté komplety lze ve vlastním skladu dále **přidělit členům**. Je nutné rozlišovat **vlastníka**, **evidující sklad** a **aktuálního držitele**. Dočasný příjem nekončí, dokud nebylo vrácení či chybějící části vypořádáno; lze částečně vracet a dokumentovat nesrovnalosti.
- Po vrácení vlastníkovi položka přestává být **aktivním inventářem**, ale evidenční historie předání a vypořádání zůstává.
- Příklad interního předání **10 kompletů z Malé Vonice dospělé Vonici bez určení tanečníků**: sklad Malé Vonice zaznamená výdej externímu vypůjčiteli „Vonica“; sklad dospělé Vonice **samostatně** zaznamená dočasný příjem od „Malé Vonice“ a následná přidělení jednotlivým tanečníkům. Jde o dvě autoritativní evidence **různých etap odpovědnosti**, nikoliv o automatickou synchronizaci stejných skladových položek.
- Až později lze nabídnout **import/export předávacího seznamu** pro úsporu přepisování, bez povinného propojení databází.

**Provozní pravidlo:** skutečný přesun odpovědnosti či věcí musí být zaznamenán příslušnou krojárkou. Dohoda mimo aplikaci sama záznam nenahrazuje.

## 7. Inventura

Inventura musí umožňovat ověřovat jednotlivé číslované předměty, **počet zaměnitelných neočíslovaných součástí**, komplety i zápůjčky mimo sklad.

Navržený postup:

1. Krojárka zahájí inventuru celého skladu nebo jeho vybrané části.
2. Postupně prochází krojové součásti, případně celé komplety, a zaznamenává výsledky fyzické kontroly.
3. U předmětů ve skladu potvrdí, že je skutečně viděla a zkontrolovala.
4. **U věcí svěřených členům nebo externistům stačí osobní kontrola a potvrzení krojárky.** Samotné tvrzení vypůjčitele bez takového ověření není inventurní kontrolou.
5. Aplikace rozlišuje zkontrolované, dosud nezkontrolované a problémové položky. Zvlášť ukazuje věci, které jsou podle evidence mimo sklad.
6. Lze poznamenat nesrovnalost, poškození či jiný komentář zjištěný při kontrole.
7. Výsledek inventury se uloží a je dostupný pro pozdější porovnání. Pozdější změny zápůjček ho zpětně nepřepisují.

**Nepřítomnost předmětu při kontrole skladu neznamená automaticky ztrátu.** Pokud je podle evidence u konkrétní osoby, čeká na její fyzické ověření. Také je nutné odlišit „zatím nezkontrolováno“ a „skutečně chybí“.

## 8. Poznámky, poškození a vyřazení

- **Poznámka k součásti:** Dlouhodobá informace o samotném předmětu (například „špinavé“, „natržený rukáv“).
- **Poznámka k zápůjčce:** Informace ke konkrétnímu předání (například „zapůjčeno na jeden večer“, „při předání chyběl knoflík“).
- **Poznámka k vrácení konkrétní součásti:** Historický záznam z kontroly při vracení (například „košile vrácena nevypraná“). Je možný i při hromadném vrácení kompletu.
- **Poznámka při inventuře:** Informace z fyzické kontroly, pokud je třeba zdokumentovat zjištěnou nesrovnalost.

Pro v1.0 postačí volný text; není nutné zavádět katalog závad nebo proces oprav.

O **vyřazení** součásti rozhoduje vždy některá z pověřených krojárek. Při vyřazení se zaznamená datum, kdo rozhodnutí provedl, a případně důvod. Historie zůstane zachována. Evidenční číslo se uvolní v příslušné řadě.

Pokud je předmět stále evidován jako zapůjčený, systém musí na tuto skutečnost při vyřazování upozornit a vyžadovat vyjasnění jeho vypořádání.

## 9. Viditelnost a oprávnění

**Krojárky** mohou zapisovat a upravovat krojové součásti, komplety, zápůjčky, vrácení, inventury a vyřazení. Mohou rovněž používat všechny potřebné přehledy, tisk a export.

**Běžný člen** může vidět vlastní oficiálně svěřené kroje a související údaje. Nemůže sám převádět součásti mezi lidmi nebo měnit oficiální evidenci.

**Vedoucí a administrátoři** mohou dostat další oprávnění k nahlížení podle potřeb souboru. Role v ostatních částech aplikace automaticky neznamená právo měnit krojovou evidenci.

**Externista** pro samotné zapůjčení kroje nepotřebuje uživatelský účet ani přístup do aplikace. Pokud však dostane zvlášť přístup jako host akce nebo člen vybrané skupiny, vidí jen povolený obsah a nemá právo měnit krojovou evidenci.

## 10. Přehledy, tisk a export – součást v1.0

Už první provozní verze musí umožňovat prohlížení na mobilu **a také tisk či export** vhodných seznamů, zejména:

- seznam evidovaných krojových součástí podle druhu kroje, čísla a dalších filtrů,
- seznam kompletu včetně přehledu, které součásti jsou momentálně mimo komplet,
- přehled krojů oficiálně zapůjčených konkrétnímu člověku (včetně externistů a bývalých členů),
- seznam nevrácených nebo po termínu vrácení,
- inventurní seznam pro kontrolu a souhrn inventury včetně nesrovnalostí,
- přehled vyřazených položek a jejich historie.

Konkrétní podobu tiskových sestav a exportní formáty ještě doladíme. U exportů s osobními údaji musí platit stejná oprávnění jako v aplikaci.

## 11. Situace, které musí v1.0 zvládnout

**A. Číselné řady:** „Horňácká černá 1“, „kopaničká 1“ a „slovenská stará 1“ mohou být tři různé košile. Po vyřazení lze číslo v dané řadě použít znovu bez záměny historie.

**B. Doplnění kompletu:** Krojárka přidá novou součást ke kompletu. Od toho okamžiku do něj patří, ale starší zápůjčky kompletu se zpětně nedoplňují.

**C. Dočasné vypůjčení šátku:** Šátek patří do kompletu, ale je oficiálně půjčen Lojzovi. Komplet je neúplný; ostatní dostupné části lze půjčit společně.

**D. Předání neúplného kompletu:** Krojárka jedním úkonem půjčí všechny aktuálně dostupné součásti kompletu Aničce. Šátek u Lojzy se do této zápůjčky nezahrne.

**E. Částečné vrácení:** Anička vrátí všechno kromě jedné součásti. Zápůjčka zůstává pro tuto součást otevřená a dohledatelná.

**F. Externista:** Pověřená krojárka zapůjčí kroj člověku mimo soubor, aniž by jej musela zakládat jako aktivního člena.

**G. Odchod člena:** Člen odejde ze souboru, ale jeho historie i případné otevřené zápůjčky zůstanou v evidenci.

**H. Osobní kontrola:** Krojárka osobně ověří kroj držený bývalým členem a označí jej v inventuře jako zkontrolovaný.

**I. Výpis do tisku:** Krojárka připraví seznam kompletů nebo zapůjčených věcí pro kontrolu mimo aplikaci.

**J. Mašle bez čísla:** Komplet má obsahovat dvě úzké mašle. Předány jsou dvě, vrácena jedna; krojárka eviduje stav 1 ze 2 bez kontroly konkrétního kusu nebo virtuálního čísla.

**K. Vrácení nevyprané košile:** Při vrácení celého kompletu krojárka zapíše ke košili „vrácena nevypraná“. Zápůjčka košile se ukončí, její historická poznámka zůstane a košile zatím není připravená k další zápůjčce.

### Doplněné akceptační scénáře pro zápůjčky mezi soubory

**L. Přímá osobní výpůjčka z jiného skladu:** Malá Vonica půjčí Z12 Ádě; Áďa jej vidí v „Moje kroje“, ale nezískává členství, přepínač ani čtení skladu Malé Vonice.

**M. Neznámý externí vypůjčitel:** Krojárka zapíše skutečnou externí osobu bez účtu; zápůjčka je evidovatelná i bez pozvánky do aplikace.

**N. Dočasný příjem od cizí organizace:** Vonica převezme deset kompletů s původními čísly, rozdělí je členům, částečně vrátí a dohledá historii.

**O. Hromadné předání Malá Vonica → Vonica:** Výdej a příjem jsou samostatné operace dvou skladů; nepředpokládá se znalost konkrétních držitelů v okamžiku prvního výdeje.

**P. Odstranění člena:** Ukončení členství neuzavře zápůjčky ani nevymaže jejich historickou odpovědnost; osoba může mít nadále omezený osobní přehled.

## 12. Co může počkat na další verze

- QR kódy a automatické načítání evidenčních čísel,
- rezervování krojů na konkrétní vystoupení,
- automatické doporučování velikostí nebo kompletů,
- automatické připomínky vrácení,
- pokročilé sledování oprav a související úkoly,
- rozsáhlý obrazový archiv krojů,
- podrobné statistiky využívání,
- samoobslužné žádosti členů o zápůjčku (systém evidenci nikdy automaticky nepřevede bez schválení krojárkou).

## 13. Zbývající upřesnění před definitivním schválením

1. **Číselné řady:** Je potvrzeno, že se řady rozlišují podle konkrétního druhu kroje (například „horňácká černá“ či „kopaničká“). Před zavedením dat se ještě doplní přesný seznam používaných názvů řad.
2. **Tisk a export:** Jaké konkrétní sestavy a formáty potřebujete při první inventuře? Stačí tisková stránka a export do tabulky, nebo už používáte formulář, který má aplikace napodobit?
3. **Výjimky v předání:** Návrh počítá s možností vypůjčit jen část aktuálně dostupného obsahu kompletu; krojárky mohou potvrdit, zda má být vždy vyžadováno výslovné označení výjimek.

Ostatní pravidla vycházejí z poskytnutých odpovědí krojárky. Tento dokument není technickým návrhem databáze ani implementace.

## 14. Schválení

- [ ] Pravidla číselných řad a neočíslovaných doplňků jsou popsána správně.
- [ ] Práce s komplety, jejich složením a zápůjčkami odpovídá praxi.
- [ ] Při vracení kompletu lze zaznamenat poznámku a připravenost k dalšímu půjčení u každé součásti zvlášť.
- [ ] Evidence aktivních, bývalých a externích vypůjčitelů odpovídá praxi.
- [ ] Inventura a požadované přehledy umožní provést první skutečnou kontrolu skladu.
- [ ] Rozsah v1.0 je dostačující.

**Připomínky:**

................................................................................

**Datum projednání:** ................................

**Za krojový sklad:** ................................

---

*Verze 0.3 doplňuje neočíslované zaměnitelné doplňky, poznámky ke konkrétním vráceným součástem a možnost účasti externistů v dalších agendách. Nahrazuje návrh 0.2; po schválení zbývajících provozních detailů může sloužit jako funkční zadání krojového skladu v1.0.*
