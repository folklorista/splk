# Souborový systém

## Produktová vize, funkční rozsah a plán rozvoje

**Pracovní dokument k diskusi a postupnému schvalování**  
**Verze dokumentu:** 0.3 · **Datum:** 15. 10. 2026  
**První zamýšlené nasazení:** dospělý folklorní soubor Vonica

> **Jeden soubor. Jedno místo pro informace, akce, účast i kroje. Vždy po ruce.**

---

## Jak tento dokument číst

Tento dokument slouží současně jako:

1. **Vysvětlení, proč aplikace vzniká** – pro vedení i běžné členy souboru.
2. **Produktový popis systému** – jaké problémy řeší, jaké oblasti propojuje a jak by měl fungovat při běžné práci.
3. **Vymezení první provozní verze** – co musí skutečně fungovat před nasazením a co jej nesmí zbytečně zdržovat.
4. **Dlouhodobá vize** – co by aplikace jednou mohla umět, aniž by to dnes bylo slíbeno nebo naplánováno k realizaci.
5. **Podklad pro konzultace** – s vedoucími, krojařkami, muzikanty, členy výboru a později s dalšími soubory.

**Rozlišujeme čtyři stupně závaznosti:**

- **V1.0 – nutné pro provoz:** požadavek na první skutečně používanou verzi.
- **V2.0 – předpokládaný další rozvoj:** důležitá funkce, na kterou má být systém připraven, ale není podmínkou prvního spuštění.
- **Později / podle potřeby:** konkrétní námět, který dává smysl ověřit v praxi.
- **Otevřená otázka:** pravidlo nebo rozhodnutí, které je nutné projednat s uživateli; není automaticky schváleným požadavkem.

Číslování verzí je **produktový plán, nikoliv kalendářní příslib**. Označení „V2.0“ neznamená, že musí obsahovat úplně všechny zde uvedené návrhy. Dokument popisuje chování a účel aplikace, nikoli databázové struktury ani programátorské implementační detaily.

## Obsah dokumentu

- **I. Proč systém vzniká** – současné problémy, cíle a přínosy.
- **II. Základní filozofie** – mobilní použití, jednoduchost a hranice univerzálnosti.
- **III. Lidé a oprávnění** – hosté, členové, vedoucí, administrátoři, správci skupin, ochrana soukromí a pravidla pro zakládání skupin.
- **IV. V1.0** – dashboard, nástěnky, akce, účast, skutečná docházka, kroje, inventura, notifikace.
- **V. Vazby mezi částmi** – proč spolu agendy mají souviset.
- **VI. Úkoly** – návrh hlavní funkce pro V2.0.
- **VII. Rozšířené akce** – vystoupení, soustředění, hody, Velikonoce a besídka.
- **VIII. Další směry** – kronika, fotografie, repertoár, hudba, finance.
- **IX. Dětský soubor** – rodiče, centralizovanější vedení a bezpečné oprávnění.
- **X. Další soubory** – možnosti využití systému v jiných organizacích.
- **XI. Použitelnost a provoz** – soukromí, spolehlivost, technologie jako prostředek.
- **XII. Verze a priority** – hranice V1.0, pilot, kritéria spuštění a plán rozvoje.
- **XIII. Otevřené otázky** – podklady pro schvalování s vedením a krojařkami.
- **XIV. Představení projektu** – text pro prezentaci členům.

---

## Konsolidace produktových rozhodnutí z 18. 10. 2026

Následující doplnění po kapitolách představují **odsouhlasený cílový model**, ne tvrzení o dokončené implementaci. Starší harmonogram a označení V1.0 v tomto dokumentu jsou **historický návrh**; dokument `08` zaznamenává, že V1.0 již byla vydána. Při plánování rozlišit existující mock/frontend, současný backend a budoucí požadavky.

**Autoritativní témata:** detailní krojová evidence `06`, pověření a skupinová komunikace `08`, soukromé DM `09`, navigace `10`, produkční technologie a offline/zálohy `01`.

# I. Proč Souborový systém vzniká

## 1. Současná situace

Organizace folklorního souboru dnes běží souběžně v mnoha různých prostředích:

- facebookové skupiny a facebookové události,
- Messenger a skupinové konverzace,
- skupiny na WhatsAppu,
- Instagram,
- Google Sheets, Microsoft Excel Online a jiné tabulky,
- soukromé poznámky jednotlivých organizátorů a osobní domluvy.

Každý nástroj zvládá část práce, ale **chybí jedno společné místo, kde je možné najít úplný a aktuální obraz dění v souboru**. Při hledání starší informace není jasné, zda byla v události, komentáři, soukromé zprávě nebo tabulce. Některé informace se opakují, jiné zapadnou. Noví členové obtížně dohledávají souvislosti a organizátoři musí stejné informace opakovaně předávat.

Současná evidence docházky navíc neplní svůj účel: do sdílených tabulek přispívá jen malá část členů a jejich používání z mobilu je nepohodlné. Stejně praktický problém představuje krojový sklad: evidence jednotlivých krojových součástí, jejich přidělení a skutečná inventura jsou náročné na čas a dohledávání.

## 2. Co chceme změnit

**Souborový systém má vytvořit jedno spolehlivé místo pro každodenní život souboru.**

Člen otevře telefon a zjistí, co se chystá, co je nového, zda má něco potvrdit a které kroje mu byly oficiálně svěřeny. Vedoucí uvidí, kdo reagoval na akci, kdo přišel na zkoušku a které organizační záležitosti zbývá dořešit. Krojařka zjistí, kde mají být jednotlivé předměty, které komplety jsou úplné a co musí při inventuře zkontrolovat.

Časem bude možné propojit také úkoly, kroniku, fotografie, repertoár a další agendy. **Výhodou nemá být jen seznam funkcí, ale především jejich vzájemné vazby a dohledatelná historie.**

Nejde o vytvoření dalšího kanálu, který se přidá k Facebooku a WhatsAppu. Cílem je, aby se podstatné informace a oficiální evidence postupně přesunuly na jedno autoritativní místo. Neformální komunikace jinde může přirozeně pokračovat.

## 3. Společná paměť souboru

Systém má být užitečný nejen dnes, ale i za několik let. U konkrétního vystoupení by jednou mohlo být možné najít datum, místo, program, účastníky, organizační poznámky, fotografie a kronikářský zápis. U tradičních akcí by organizátoři mohli navázat na zkušenosti minulých ročníků místo opakovaného vymýšlení postupů.

Dohledatelnost ale neznamená, že každý smí vidět všechno. **Historie musí respektovat skupinovou viditelnost, oprávnění a soukromí členů.**

## 4. Jak poznáme, že projekt přináší hodnotu

Nejde především o počet vytvořených modulů. Úspěch bude znamenat například:

- členové vědí, kde hledat oficiální informace a termíny;
- většina členů potvrzuje účast přímo v aplikaci;
- vedoucí získají použitelný přehled plánované i skutečné účasti;
- krojařky dokážou průběžně evidovat zápůjčky a provést inventuru;
- důležitá rozhodnutí a souvislosti se dají zpětně dohledat;
- aplikace funguje především z telefonu, bez nutnosti používat počítač;
- její používání je jednodušší než dosavadní souběh tabulek a komunikačních kanálů.

---

# II. Základní filozofie systému

## 5. Konkrétní aplikace, nikoli univerzální platforma pro všechno

První zákazník a první skutečné testovací prostředí je dospělá Vonica. Aplikace má především dobře zvládnout **reálný provoz jednoho folklorního souboru**.

Zároveň by nebylo rozumné předpokládat, že všechny ostatní soubory mají stejné skupiny, pravidla, kroje či způsob vedení. Proto má být jádro připraveno na více organizací a nastavitelná pravidla, ale **nemá vznikat univerzální systém libovolných formulářů, tabulek a procesů**.

Základ budou tvořit srozumitelné oblasti: členové, skupiny, akce, docházka, oznámení, kroje a později úkoly či další specializované moduly.

## 6. Mobil jako hlavní místo používání

Běžný člen má zvládnout většinu situací během několika sekund na mobilním telefonu:

- přečíst důležité sdělení;
- zjistit čas a místo nejbližší akce;
- potvrdit účast nebo se omluvit;
- napsat krátkou poznámku či komentář;
- zjistit své svěřené kroje;
- později vidět vlastní úkoly.

Desktop je vhodný zejména pro hromadnou administraci, plánování, složitější editace a přehledy. Mobilní funkce však nesmějí být pouhým zmenšením desktopové tabulky.

## 7. Jednoduché situace mají zůstat jednoduché

Založení obyčejné zkoušky nemá vyžadovat vyplnění desítek polí. Rozšířené možnosti se zobrazí až tehdy, když jsou pro danou událost potřebné.

Totéž platí pro role: běžný člen nemá být zahlcen přehledy a administračními nástroji určenými vedoucím. Naopak osoba, která má něco skutečně zařídit, musí dostat potřebné informace a odpovídající oprávnění.

### Nepovinná digitalizace (rozhodnuto)

Souborový systém není povinným deníkem všech osobních domluv. Dohoda na zkoušce, v hospodě, po telefonu nebo přes externí messenger je v pořádku. Aplikace má být **pohodlnější než WhatsApp skupiny, Google Formuláře a tabulky**, když už se něco řeší online, nikoliv novou administrativní povinností. Výjimkou je **autoritativní krojový sklad**, který musí zachytit skutečné předání a odpovědnost; docházka zůstává orientační, nikoliv sankční.

## 8. Vlastní odpovědnost a jasné pravomoci

Člověk může být členem více skupin a mít různé povinnosti, aniž by se stal administrátorem celého systému. Například krojařka potřebuje upravovat krojovou evidenci, kronikář pracovat s historickými záznamy a organizátor vystoupení řešit jeho přípravu.

**Odpovědnost za určitou oblast nemá automaticky znamenat neomezený přístup do všech ostatních oblastí.**

---

# III. Lidé, skupiny, role a oprávnění

## 9. Kdo bude systém používat

### Běžný člen

Sleduje informace svých skupin, akce, potvrzuje účast, komunikuje v povolených diskusích a vidí svoje kroje. Později může mít vlastní i přiřazené úkoly.

### Host

Host s přihlašovacím účtem vidí pouze skupiny výslovně zpřístupněné hostům a akce, ke kterým byl přímo přizván. Host není automaticky členem aktivního souboru. Externista evidovaný pouze kvůli zápůjčce kroje nemusí mít účet vůbec.

### Vedoucí a organizátoři

Připravují akce a oznámení, pracují s docházkou a podle svého pověření získávají podrobnější přehledy, například kdo reagoval nebo kdo si přečetl důležitý příspěvek. **Vedoucí nemá automaticky přístup ke skupinám ani statistikám jejich příspěvků, pokud k nim jinak není oprávněn.**

### Administrátor

Spravuje účty, základní nastavení, skupiny a pravidla přístupu. **Administrátorské oprávnění samo o sobě neumožňuje číst soukromé příspěvky, komentáře a akce skupin, jejichž není oprávněným členem.**

### Superadministrátor

Má nejvyšší technické pravomoci, může provádět mimořádné zásahy a v nezbytných případech přistupovat ke všem datům. Taková role má být vyhrazena minimálnímu počtu důvěryhodných lidí a její používání se řídí zásadami auditu a ochrany soukromí.

### Pověřené osoby

Jde například o krojařky, ekonoma, kronikáře, organizátora konkrétní akce nebo vedoucí dětské složky. Jejich kompetence se určují podle konkrétní činnosti.

### Bývalí členové a externisté

**Člověk nemusí být aktuálním členem souboru, aby byl v systému veden.** Krojařka může evidovat výpůjčku bývalému členovi nebo externistovi; kvůli tomu mu není třeba zřizovat přihlašovací účet ani jej zařazovat do interních skupin.

Záznam bývalého člena zůstane zachován kvůli minulým akcím, docházce, svěřeným krojům a dalším historickým vazbám. **Ukončení členství odebere aktuální oprávnění, ale nemaže osobu ani historii.** Otevřené zápůjčky zůstávají dohledatelné.

Externista může současně vystupovat jako **host jedné akce** nebo jako **dočasně spolupracující osoba**. Pokud potřebuje vidět organizační informace nebo potvrdit účast, dostane samostatně přístup přes účet a cílené oprávnění. Přístup k určité akci ani zápůjčka kroje z něj automaticky nedělají člena všech skupin dospělé Vonice.

## 10. Role a skupiny nejsou totéž

**Role určuje, co člověk smí dělat. Skupina určuje zejména, kam patří a které informace jsou pro něj určené.** Samostatnou otázkou je **stav vztahu k souboru** (aktivní člen, bývalý člen, externista/host) a **existence přihlašovacího účtu**. Tyto věci se nesmějí zaměňovat.

**Aktuální pravidlo:** v demu mohou stále existovat označení admin/vedoucí/uživatel, ale **cílový autorizační model netvoří hierarchie pevných rolí**. Organizační funkce jsou lidské názvy, pravomoc vzniká až samostatným **pověřením** pro soubor, skupinu, akci či odborný modul (viz `08`, které nahrazuje starší návrh rolí). Správce souboru automaticky nečte soukromé skupiny a neovládá krojový sklad. Přístup musí v každém konkrétním objektu kontrolovat server. Když se funkce odvolá, původní členství ve skupinách tím samo o sobě nezaniká; když člověk soubor opustí, historie zůstane, ale přístup končí.

Příklady skupin Vonice:

- tanečníci a tanečnice;
- muzika;
- kluci a holky;
- výbor, tvořený vedoucími složek i lidmi s další odpovědností (např. ekonom, kronikář);
- vedoucí dětského souboru Malá Vonica;
- osoby pověřené krojovým skladem.

Člen může patřit do více skupin zároveň. Skupiny se využívají k cílení akcí a příspěvků a později také k omezení přístupu k dokumentům, úkolům či jednotlivým částem repertoáru.

Členství ve Výboru samo o sobě nemusí znamenat právo měnit všechny akce. Členství ve skupině Krojový sklad zase nesmí být jedinou náhodnou podmínkou pro plná oprávnění k zápůjčkám, pokud bude potřeba rozlišit správce skladu a další členy skupiny.

Případné skupiny **Externí, Hosté či Neaktivní členové** mohou sloužit k cílení informací, nejsou však povinné pro samotnou evidenci člověka. Bývalý člen ztratí přístup z dřívějších aktivních skupin; historická informace o jeho dřívějším zařazení se zachová. **Skupina s názvem „Veřejnost“ automaticky neznamená obsah dostupný komukoliv na internetu.**

### 10.1 Správce skupiny (garant)

Každá skupina má alespoň jednoho **správce skupiny** (organizačně lze používat také označení *garant*). Správce je členem své skupiny a odpovídá za její členství a pořádek na její nástěnce. Může mít zástupce; skupina nesmí nechtěně zůstat bez správce.

Ve své skupině smí zejména:

- přidávat a odebírat členy podle pravidel souboru;
- připínat důležité příspěvky;
- archivovat a obnovovat i cizí příspěvky v rámci skupiny;
- skrývat nevhodné příspěvky a komentáře, aniž by se ztratil dohledatelný záznam zásahu;
- zobrazovat statistiky čtenosti **své** skupiny;
- spravovat popis a běžná pravidla vlastní skupiny.

Správce skupiny **nezískává systémová administrátorská oprávnění** a nemůže prohlížet ostatní soukromé skupiny. Pravomoc moderovat obsah se nepřenáší mimo skupinu, kterou spravuje. Moderátorské zásahy a změny členství mají mít dohledatelnou historii.

### 10.2 Soukromí skupin a administrátorský přístup

Soukromé skupinové diskuse nejsou automaticky přístupné vedení souboru ani běžnému systémovému administrátorovi. Platí to i pro statistiky jejich čtenosti. **Administrace účtů a konfigurace skupin se odděluje od oprávnění číst jejich obsah.** Správce systému může znát potřebná provozní metadata skupiny, ale nečte její neveřejné příspěvky jen z titulu své role.

Zvlášť citlivou situací je, když by si administrátor chtěl přidělit členství v soukromé skupině. Výchozím pravidlem je, že **administrátor nesmí sám sobě tiše udělit přístup**. O jeho přijetí rozhoduje správce příslušné skupiny. Pro nutné mimořádné zásahy existuje superadministrátorská cesta.

Změny členství a správcovství musí být viditelné v historii skupiny; její správci o nich mají být informováni a členové mají mít možnost poznat, kdo a od kdy do skupiny patří. Dodatečné odebrání členství neznamená, že člověk nemohl dříve přístupný obsah přečíst. Proto jsou preventivní omezení důležitější než pouhá zpětná notifikace.

Superadministrátor může technicky získat přístup ke všem datům. Při zásazích provedených **prostřednictvím aplikace** je nutné zaznamenat kdo, kdy, proč a co změnil či mimořádně otevřel, nakolik to aplikace umí doložit. Přímý přístup do databáze nemusí být aplikačním auditem zachycen; jeho zabezpečení a audit jsou samostatnou provozní povinností. Bez odpovídajícího technického řešení nelze slibovat absolutní utajení obsahu před provozovatelem systému.

### 10.3 Kdo smí vytvářet skupiny – nastavení konkrétního souboru

Pravidla pro vytváření skupin jsou **konfigurovatelná zvlášť pro každý soubor**, nikoli jako jediné globální nastavení celé aplikace. To umožní, aby měla Vonica přísnější pravidla a jiný dospělý soubor případně volnější model.

| Režim | Chování | Plán |
| --- | --- | --- |
| **Pouze administrátoři** | Nové skupiny zakládají administrátoři a superadministrátoři. | **Výchozí nastavení Vonice a V1.0** |
| **Všichni aktivní členové** | Každý aktivní člen může založit skupinu; stává se jejím prvním správcem. | **Podporovaný režim V1.0**, lze zapnout později |
| **Členové se schválením** | Člen navrhne skupinu, administrátor ji schválí nebo zamítne. | **Pozdější rozšíření**, nikoli podmínka V1.0 |

I když člen může skupinu vytvořit, **nezískává tím právo udělovat systémové role ani zasahovat do obsahu jiných skupin**. Nová skupina musí mít explicitně nastavenou viditelnost, nejméně jednoho správce a jasná pravidla přidávání členů. Soukromí je výchozí bezpečná volba; zpřístupnění hostům musí být úmyslné.

### 10.4 Další jednoduchá pravidla členství ve skupinách

Výchozím pravidlem je, že členy skupiny spravuje její správce a případný vstup nového člena se řídí pravidly daného souboru. Do budoucna je vhodné umožnit žádost o vstup či dobrovolný odchod, případně odlišné chování pro oficiální organizační skupiny. Není však nutné stavět do V1.0 rozsáhlý konfigurovatelný schvalovací systém.

Hostům zpřístupněná skupina neznamená veřejnou webovou stránku bez přihlášení. Skupiny se nesmějí používat jako skrytá cesta k udělování globálních administrátorských práv. Historie dřívějších členů zůstává zachována pro audit a záznamy o minulých akcích, ale sama jim neposkytuje přístup k aktuálnímu obsahu.

## 11. Organizátor konkrétní akce

Akce by měla mít možnost určit jednu nebo více **zodpovědných či organizačně pověřených osob**. Organizátor konkrétní akce není automaticky administrátor ani vedoucí celého souboru.

Každá akce musí mít **jasně určenou organizační odpovědnost a cílové publikum**, nemusí však patřit výhradně jedné skupině. Volitelně může mít hlavní organizující skupinu (například Výbor); současně může být určena více skupinám (Tanečníci, Tanečnice, Muzika) i konkrétním přizvaným hostům. Organizátor akce, její čtenář a účastník nejsou vždy tatáž osoba.

Správce soukromé skupiny neuděluje organizováním akce ostatním uživatelům přístup k jejím soukromým příspěvkům. Zpřístupnění společné akce více skupinám **nespojuje jejich nástěnky ani jejich neveřejnou historii**. Rozšiřování cílových skupin při přípravě vystoupení je do budoucna užitečné, ale nepředpokládá automaticky zpřístupnění všech starších diskusí.

To je důležité už pro V1.0 jako základní organizační vazba; ve V2.0 na ni budou moci navázat úkoly, kontrola povinností a další delegování. Přesný rozsah pravomocí organizátora je ještě nutné ověřit při návrhu uživatelských postupů.

## 12. Viditelnost informací

V základním návrhu platí:

- informace pro **celý aktivní soubor** mohou číst jeho oprávnění aktivní členové; označení „celý soubor“ samo o sobě nezahrnuje externisty a bývalé členy;
- skupinové informace jsou určeny oprávněným osobám v daných skupinách, případně explicitně přizvaným hostům, nikoli všem lidem vedeným v evidenci;
- osobní údaje a soukromá agenda se nezpřístupňují jen kvůli členství v souboru;
- podrobnější statistiky přečtení a docházky mají jen oprávněné osoby v rozsahu příslušné skupiny nebo akce; samotné označení „vedoucí“ nepovoluje číst statistiky cizích soukromých skupin;
- pravomoc vytvořit či upravit obsah je oddělena od práva jej přečíst.

Pokud při zakládání akce nebo příspěvku není vybrána žádná skupina, nemá systém bez upozornění předpokládat neomezené zveřejnění. Vhodnější je výslovná volba „celý soubor“ nebo „vybrané skupiny“.

**Host může být pozván ke konkrétní akci bez přístupu k ostatním akcím a nástěnkám aktivního souboru.** Alternativně může dostat omezené zařazení do skupiny, pokud spolupráce trvá déle. Po skončení účasti nebo odebrání pověření má přístup zaniknout, zatímco záznam o jeho účasti zůstane zachován. Samostatné pozvání k akci nemá automaticky odhalit historii jiné souborové komunikace. Přístup musí být skutečně ověřován, nikoli jen skryt v navigaci.

---

# IV. Součásti první provozní verze (V1.0)

## 13. Co V1.0 skutečně znamená

**První provozní verze musí zvládnout tři plnohodnotné pracovní oblasti:**

1. **Komunikace a organizace souboru** – členové, skupiny, nástěnky, akce, diskuse.
2. **Účast a skutečná docházka** – člen nahlásí plán, vedoucí zaznamená realitu.
3. **Krojový sklad a inventura** – jednotlivé krojové součásti, komplety, svěřené předměty, zápůjčky a kontrola inventáře.

Podmínkou nasazení je spolehlivé ukládání a práce s reálnými daty, bezpečný přístup, dostatečně jednoduché ovládání a vyřešený způsob upozorňování na důležitá sdělení. **Úkoly, speciální velikonoční formuláře ani pokročilé obsazování tanců nejsou vstupenkou do V1.0.**

Následující kapitoly popisují očekávané chování, nikoli tvrzení, že všechny funkce dnešního dema již pracují s trvale uloženými daty.

## 14. Přihlášení, profil a správa členů

Uživatel se bezpečně přihlásí, zobrazí svůj profil a informace, které pro svou činnost potřebuje. Administrace umožní vedení spravovat **osoby v evidenci** (aktivní členy, bývalé členy a externisty), jejich případné přihlašovací účty, členství, skupiny a role. Zápis člověka kvůli vypůjčenému kroji neznamená automatické vytvoření účtu ani přístup do interní části aplikace.

Pro reálné spuštění musí být vyřešena obnova přístupu k účtu, změna hesla a bezpečné ukončení přihlášení. Nesmí být nutné, aby autor aplikace osobně zasahoval při každém zapomenutém hesle.

V uživatelském profilu mají mít přednost praktické informace. Zobrazení kontaktů dalších členů se musí řídit oprávněním a jejich skutečným účelem.

## 15. Úvodní přehled

Dashboard nemá být další zahlcená stránka se vším, co systém zná. Má odpovědět na otázky:

- Co je nejbližší důležité?
- Mám nějakou akci bez odpovědi?
- Vyšlo nové oznámení, které se mě týká?
- Je něco, co vyžaduje můj zásah?
- Kde najdu své přidělené kroje?

Do budoucna se zde mohou zobrazovat vlastní úkoly, ale není nutné je programovat před prvním nasazením.

### Osobní přehled a kontext souboru

Na `moje.vonica.cz` se člen přihlašuje **jediným globálním účtem**. Dospělá Vonica a Malá Vonica jsou samostatné folklorní soubory: oddělené skupiny, chaty, akce, sklady i nastavení. Uživatel může přepnout souborový kontext, současně ale vidí **společný osobní přehled** svých relevantních akcí, upozornění, nevyřízených odpovědí a osobně svěřených krojů napříč soubory. Zápůjčka ze skladu jiného souboru neuděluje členství ani přístup do jeho prostředí. Přepínání **uživatelských účtů na sdíleném zařízení** je jiná funkce než přepnutí souboru.

## 16. Nástěnky a oznámení

Každá skupina může mít svůj komunikační prostor. Člen vidí ty nástěnky a příspěvky, ke kterým má přístup. Příspěvek může být určen konkrétní skupině či více skupinám a může obsahovat důležité organizační sdělení.

**V1.0 má zahrnovat:**

- vytvoření, zveřejnění a úpravu příspěvků oprávněnou osobou;
- rozlišení důležitých oznámení a běžných informací;
- diskusi formou komentářů;
- zmínky na konkrétního člena, pokud je lze bezpečně použít v rámci jeho oprávnění;
- rozpoznání nových a přečtených příspěvků;
- historii a zpětné dohledání obsahu;
- odpovídající zobrazení na mobilu.

Vedoucí mohou podle oprávnění potřebovat podrobnější přehled přečtení, **ale jen u obsahu, ke kterému mají oprávněný přístup**. Správce skupiny smí číst statistiky své skupiny. Je nutné transparentně určit, kdo tyto údaje vidí a jak dlouho se uchovávají.

Autor může svůj příspěvek archivovat. Správce skupiny může připínat důležité příspěvky a moderovat, skrývat, archivovat či obnovit příspěvky ostatních členů své skupiny. Tyto zásahy mají být dohledatelné, ne nepozorovaným mazáním historie.

Soukromé chatovací místnosti a plnohodnotná náhrada Messengeru **nejsou požadavkem V1.0**. Nástěnky a komentáře mají nejprve nahradit roztříštěnou oficiální komunikaci.

## 17. Akce a kalendář

Člen vidí seznam nebo kalendář událostí, které se ho týkají: zkoušky, vystoupení, soustředění, schůzky a další souborové akce.

U akce potřebuje zejména:

- název, typ, datum a čas;
- místo konání a praktické informace;
- případný důležitý popis či instrukce;
- komu je akce určena;
- možnost odpovědět na účast;
- možnost napsat poznámku či omluvu;
- kontakt či označení organizátora;
- přehled účasti odpovídající jeho oprávnění.

V základním zobrazení nemá běžného člena obtěžovat dlouhý seznam těch, kdo už odpověděli, ani detailní údaje o tom, kdo akci četl. Podrobnosti mohou být rozbalovací nebo dostupné především vedoucím.

Typy jako „pravidelný nácvik“, „soustředění“, „vystoupení“ či „jiné“ jsou ve V1.0 hlavně srozumitelným rozlišením akcí, nikoli spouštěčem komplexních specializovaných procesů.

Akce může mít hlavní organizující skupinu, ale **nemusí být povinně podřízena jediné skupině**. Musí mít explicitně určené cílové skupiny, případně pozvané jednotlivce, a osoby oprávněné ji spravovat. Vytvoření společné akce nemění členství lidí ve skupinách a neodkrývá jejich soukromé nástěnky.

**Externista nebo bývalý člen může být pozván například na jediný zájezd či vystoupení.** Cílem V1.0 je umožnit jednoduché a kontrolované zpřístupnění konkrétní akce nebo informací určené skupiny, pokud má daná osoba účet. Rozsáhlé workflow hostování, automatické pozvánky a samoobslužné žádosti o účast mohou přijít později. Pokud externista účet nemá, lze jej evidovat jako účastníka podle pravomocí organizátora, ale nemůže se v aplikaci sám přihlásit ani odpovídat.

### Opakování, výjimky a osobní kalendář (rozhodnuto)

- Akce je viditelná po vytvoření/zveřejnění; **není potřeba samostatné plánované `published_at`**.
- Série nácviků má rozsah datumů, opakovací pravidlo a čas. Každý výskyt má **vlastní akci**, účast a docházku. Úprava jednoho výskytu nesmí nechtěně měnit celou sérii či historii minulých zkoušek.
- Při založení série lze **jednorázově předvyplnit** výjimky podle českých svátků, školních prázdnin a okresu (včetně režimu celý prázdninový týden), zkontrolovat náhled a uložit vynechané termíny **se stavem „Vynecháno“ a uvedeným důvodem**. Automatická pravidla později tiše nepřepočítávají existující sérii. Mimo období série (např. letní prázdniny) **žádná akce nevzniká**.
- Předem plánované vynechání je pouze informační. Dodatečné zrušení plánované zkoušky aktivně upozorní dotčené členy.
- Osobní odběr **ICS/iCalendar** je pouze pro čtení a může kombinovat relevantní akce více souborů a zastupovaných dětí. Člen filtruje typy; výchozí preference **neexportovat běžné týdenní nácviky**, ale exportovat ostatní akce a volitelně **„NENÍ VONICA – důvod“** u vynechaných/zrušených termínů v rámci série. Tyto negativní položky se exportují jako viditelné informační události, ne skryté `STATUS:CANCELLED`. Aktualizace odběru není zaručeně okamžitá, urgentní změny jdou také vlastní notifikací.

## 18. Potvrzování účasti

Každý oslovený člen může jednoduše zvolit:

- **Přijdu**;
- **Nepřijdu**;
- **Možná**;
- **Zatím neodpovězeno** (výchozí stav).

Podle potřeby může doplnit poznámku, například důvod omluvy nebo informaci o pozdním příchodu. Odpověď musí jít změnit, pokud se situace změní; vedoucí uvidí aktuální stav.

Vhodné je umožnit reagovat přímo ze seznamu akcí, bez otevírání detailu. Neodpovězené akce mají být dobře rozpoznatelné, ale aplikace by neměla neustále naléhavě upozorňovat na termíny, které jsou ještě velmi vzdálené.

### Časování odpovědí a zobrazení detailu (rozhodnuto)

- Odpovědět lze **kdykoliv od zveřejnění akce**. V badge a aktivních výzvách se objeví pouze akce, u kterých nastal předstih připomínky. Výchozí předstih: **nácvik 7 dní**, **vystoupení 14 dní**, ruční úprava až na **365 dní** např. při poptávce vystoupení.
- Odpovědi ANO/NE jsou pro plánování definitivní, MOŽNÁ a BEZ ODPOVĚDI nikoliv. **Nepovinný termín definitivní odpovědi** vytvoří dodatečnou výzvu právě nerozhodnutým; uzávěrka je **měkká**, pozdější změny jsou možné a dohledatelné.
- Jediný údaj `last_viewed_at` pro **člověka × akci** se aktualizuje při **každém otevření detailu**, nikoliv při odpovědi ze seznamu. S `important_changed_at` lze rozlišit poslední otevření před/po důležité změně; nejde o právní důkaz přečtení.
- Organizátor při úpravě volí drobnou změnu bez výzvy, **důležitou změnu** s notifikací a novým sledováním zobrazení, nebo výjimečnou zprávu vyžadující **výslovné potvrzení**. To je jiný údaj než pouhé zobrazení.

## 19. Skutečná docházka – výslovný požadavek V1.0

Současná docházka vedená v tabulkách není dostatečně používaná. **Proto musí první provozní verze umět vedle nahlášené účasti evidovat i to, kdo skutečně dorazil.**

Příklad: Člen předem odpoví „Přijdu“, ale na zkoušku nakonec nepřijde. Jeho původní odpověď se nesmí zaměnit se skutečností ani jí být bez historie nahrazena.

Vedoucí potřebuje:

- jednoduchý seznam očekávaných účastníků pro konkrétní akci;
- rychle označit skutečnou přítomnost či nepřítomnost;
- přehled dosud nezkontrolovaných členů;
- možnost doplnit či opravit záznam podle přidělených pravomocí;
- základní přehled docházky za zvolené období;
- praktickou možnost získat data pro běžnou administrativu (forma výstupu k potvrzení při pilotu).

Základní docházka nemusí znamenat složité hodnocení členů. Eviduje faktický průběh zkoušek a relevantních akcí. Pokročilé statistiky, hodnocení aktivit nebo sankce nejsou automatickou součástí projektu.

## 20. Krojový sklad – výslovný požadavek V1.0

Krojová databáze byla jedním z původních důvodů vzniku systému. **V1.0 nesmí skončit u pouhého katalogu; musí umožňovat reálné zápůjčky a použitelnou inventuru.**

Podrobný návrh pro připomínky krojárek je veden samostatně v dokumentu **`06-specifikace-krojoveho-skladu.md`**. Zde jsou shrnuty klíčové provozní principy.

### 20.1 Jednotlivé evidované předměty

Každý **jedinečný krojový předmět** má vlastní evidenční číslo. Drobné zaměnitelné doplňky, například úzké mašle do vlasů, se mohou evidovat **bez fyzického čísla podle druhu a množství v kompletu**. U nich nerozlišujeme nezaměnitelnou identitu jednotlivých kusů. Pokud se požaduje jeden kus, lze zobrazit jen přítomno / chybí.

U součásti lze vést kategorii, popis, míry nebo velikost, textovou poznámku, fotografie, příslušnost ke kompletu, umístění a historii. Rozsah údajů se má přizpůsobit druhu krojové součásti.

### 20.2 Opětovné použití evidenčních čísel

Číselné řady jsou oddělené podle konkrétního druhu kroje. Je tedy možné mít zároveň „horňáckou černou 1“, „kopaničkou 1“ a „slovenskou starou 1“. Po vyřazení předmětu se jeho evidenční číslo v dané řadě může znovu přidělit. Je to praktická nutnost například u košil, kde musí být označení dostatečně krátké pro umístění na šev. **Nový předmět se stejným číslem však nikdy nesmí převzít historii starého předmětu.**

Přesné názvy a seznam používaných číselných řad se doplní při zavedení krojové evidence.

### 20.3 Komplety

Související součásti mohou patřit do kompletu uloženého v tašce či obalu. Číslované součásti si zachovávají vlastní identitu; u neočíslovaných drobností se sleduje požadovaný a skutečný počet kusů.

Systém ukazuje, co do kompletu patří, co je skutečně pohromadě a co je samostatně zapůjčeno nebo chybí. Komplet může být neúplný, aniž by tím byl zrušen. Při předání kompletu se zaznamenají právě přítomné a skutečně předané součásti, nikoli již samostatně vypůjčené chybějící díly.

### 20.4 Dlouhodobá přidělení i jednorázové zápůjčky

Některé kroje mají členové doma dlouhodobě, jiné si půjčují jen na vystoupení. Musí jít oficiálně předat jednotlivý díl, více dílů i celý komplet a také je vracet postupně.

**Změny zápůjček a přidělení zapisují pouze pověřené krojařky.** Zápůjčky lze vést také u externistů a bývalých členů, aniž by jim tím vznikl přístup k interním akcím nebo skupinám. Při vrácení kompletu může krojařka u každé součásti zvlášť napsat například „vrácena nevypraná“. Poznámka zůstane v historii a převzatou, ale nepřipravenou věc lze dočasně vyřadit z nabídky pro nové půjčení.

Pokud Anička bez domluvy s krojařkou půjčí Lojzovi šátek ze svého kompletu, v oficiální evidenci se nic nezmění. Za šátek dál evidenčně odpovídá Anička. Případné předání odpovědnosti musí krojařka zaznamenat.

### 20.5 Inventura

Krojařka může zahájit kontrolu skladu, kompletu nebo vybrané části evidence a postupně označovat ověřené očíslované předměty i počty neočíslovaných doplňků. U věcí svěřených členům nebo externistům postačí osobní kontrola a potvrzení krojařky. Musí vidět:

- co již bylo zkontrolováno;
- co ještě čeká na kontrolu;
- co je přiděleno členům a musí být ověřeno jiným způsobem;
- co nebylo nalezeno, je jinde, je poškozeno nebo chybí v kompletu;
- jaké nesrovnalosti zbývají vyřešit.

Výsledky starších inventur se zachovávají. Nenalezení věci při kontrole skladu **není automaticky totéž jako její ztráta**.

### 20.6 Přehled „Moje kroje“

Běžný člen vidí, které konkrétní krojové součásti a komplety mu byly oficiálně svěřeny. Nemůže si svévolně změnit evidované přiřazení ani sám zaznamenat vrácení.

### 20.7 Co může počkat

QR štítky, automatické rezervace podle vystoupení, složité vyhledávání podle velikostí, automatické upomínky, specializované tiskové sestavy či pokročilé řízení oprav mohou být dalšími kroky. **Základní tisk a export seznamů jsou již požadavkem V1.0** stejně jako poznámky k vráceným součástem. Nemají však blokovat první funkční inventuru další pokročilé formáty.

## 20.8 Stav dosavadního frontendu

V současném demonstračním frontendu již byly představeny základní obrazovky: přihlášení, přehled, seznam a kalendář akcí, detail akce, nástěnky skupin s komentáři, profil, nastavení, přehled změn a základní administrace. Součástí obrazovek jsou rovněž prvky pro reakce na akce a orientaci podle skupin.

Tento stav je důkazem, že lze testovat vzhled a uživatelské postupy. **Není to však doklad dokončené autentizace, backendu, inventury ani trvalého uložení dat.** Skutečný stav jednotlivých funkcí se musí ověřit při implementaci a pilotu.

## 20.9 Nastavení a historie verzí

Aplikace má umožnit základní osobní nastavení, například preferovaný vzhled a později způsob upozorňování. Přehled změn (changelog) může přehledně říkat, co se v jednotlivých vydáních změnilo; nemá ale zbytečně zabírat místo na hlavní obrazovce běžného člena.

Tyto doplňky jsou užitečné, ale samy o sobě nejsou hlavním důvodem spuštění systému.

### Rozšíření skladové agendy – napříč soubory

Krojový sklad je **autoritativní evidence**. Přímá osobní výpůjčka z Malé Vonice dospělé Ádě se zobrazí v jejích globálních **Moje kroje**, ale Áďa **není členkou Malé Vonice** ani nesmí prohlížet její sklad. Jde o individuální zpřístupnění vlastního závazku.

Při **hromadném předání** např. deseti kompletů Malá Vonica → Vonica je přípustné, aby Malá Vonica vydala externistovi „Vonica“ a dospělá Vonica samostatně převzala stejné cizí komplety do **dočasné skladové evidence** a rozdělovala je členům. Týž model platí při příjmu od externího souboru mimo aplikaci. Zachovat původní evidenční čísla, interní ID a rozdíl vlastník / evidující sklad / aktuální držitel. Není požadovaná automatická synchronizace těchto skladů; viz `06`.

## 21. Základní administrace

Oprávněné osoby musí zvládat běžné úkony bez zásahu programátora:

- spravovat osoby, jejich případné účty, aktivní i ukončená členství, skupiny a omezené přístupy hostů **bez automatického čtení soukromého obsahu skupin**;
- zakládat skupiny podle nastavení konkrétního souboru (pro Vonici ve V1.0 pouze administrátoři) a určit jejich správce;
- zpřístupnit nastavení pravidel zakládání skupin (`pouze administrátoři` / `všichni aktivní členové`) bez programátorského zásahu;
- zveřejňovat a upravovat akce a příspěvky;
- přidělovat odpovídající pravomoci;
- zaznamenávat skutečnou docházku;
- spravovat krojový sklad v rozsahu svého pověření.

Administrace bude zřejmě častěji využívána na počítači, ale základní operace – například zaškrtnutí docházky nebo vydání krojového dílu – musí být přirozeně použitelné na telefonu.

**Správa členů a nastavení neznamená automaticky oprávnění číst obsah cizích soukromých skupin.** Moderování skupiny se deleguje na jejího správce. Změny členství, správců a významných oprávnění se evidují; mimořádné zásahy mají zvláštní režim.

## 22. Upozornění a notifikace

Pokud aplikace převezme roli hlavního informačního místa, nemůže spoléhat jen na to, že ji každý den všichni sami otevřou.

Cílem V1.0 je **spolehlivě upozornit na podstatné změny**: nové důležité oznámení, akci vyžadující reakci, případně další události podle oprávnění a preferencí.

Preferovaným řešením jsou **webové push notifikace**. Pro webovou aplikaci nejsou samy o sobě podmíněné WebSockety ani Node.js serverem; jejich proveditelnost ale závisí na reálných možnostech hostingu a podporovaných zařízeních. Je nutné ověřit fungování na Androidu i iPhonech a vysvětlit potřebné povolení oznámení či instalaci webové aplikace na plochu.

**Rozhodnutí před ostrým spuštěním:** pokud push notifikace nebudou připravené, musí existovat ověřený náhradní způsob doručení důležitých sdělení (například e-mail nebo dočasné upozornění v původním kanálu). Nelze tiše předpokládat, že všichni členové nové zprávy sami najdou.

Běžné diskusní reakce nesmějí uživatele zavalit notifikacemi. Později bude možné nastavit jejich četnost a priority podrobněji.

### Aktivní notifikace, nikoli zahlcení

Interní upozornění, web push a e-mail jsou **oddělené kanály**. Hosting má pro e-mailové odesílání ověřenou provozní zkušenost. Není požadováno posílat každou zprávu všemi kanály. Příjemce musí rozlišit odeslání/doručení upozornění, **otevření detailu po důležité změně** a výslovné potvrzení. Uživatel dostává relevantní notifikace **napříč soubory**, nezávisle na právě zvoleném kontextu. Nové oznámení samo o sobě není administrativní povinností.

## 23. Historie a vyhledávání

Motivace projektu přímo vyžaduje, aby informace **nezmizely v proudu zpráv**. Už první verze má mít přehlednou historii akcí a příspěvků a použitelnou možnost jejich dohledání podle relevantních údajů, názvu, času nebo skupiny.

Jednotné pokročilé fulltextové vyhledávání napříč úkoly, dokumenty, kroji, fotografiemi a kronikou je až dlouhodobý cíl. I tehdy musí respektovat, co konkrétní uživatel smí zobrazit.

---

# V. Důležité vazby napříč systémem

## 24. Akce jako organizační centrum

Akce se postupně může stát hlavním místem, kolem kterého se propojí:

- účastníci, skupiny a případní hosté bez trvalého členství;
- organizátoři;
- plánovaná účast a skutečná docházka;
- diskuse a oznámení;
- později úkoly, obsazení tanců, doprava a stravování;
- později fotografie, kronikářské záznamy a další archivní podklady.

**Není nutné všechny vazby zprovoznit současně.** Podstatné je nepovažovat akci pouze za izolovanou položku v kalendáři. Již od první verze má mít jasně určené skupiny, účastníky a organizační odpovědnost.

## 25. Příspěvek, diskuse a úkol nejsou totéž

Příspěvek sděluje informaci, komentář umožňuje domluvu, úkol vyjadřuje odpovědnost a očekávaný výsledek.

Ve V1.0 lze například napsat „Lojzo, prosím vezmi na vystoupení prodlužovačku“ a označit ho v komentáři. Pro složitější sledování povinností je to nedostatečné, ale **samostatný modul Úkoly může vzniknout později bez toho, aby nynější diskuse byla chybným návrhem**.

V budoucnu by mělo jít vytvořit úkol v návaznosti na akci či příspěvek, nikoli místo komentářů stavět paralelní komunikaci.

## 26. Krojový sklad a akce

Dnes má krojová evidence vlastní jednoznačný účel: vědět, co soubor vlastní a komu je co svěřeno. V budoucnu může výběr programu vystoupení usnadnit přípravu konkrétních krojů nebo rezervaci součástí.

První verze však **nemusí automaticky přiřazovat kroje podle programu vystoupení**. Propojení lze přidat ve chvíli, kdy bude evidence kompletní a bude znám skutečný způsob přípravy krojů na akce.

## 27. Kronika a archiv akcí

Kronikář by v budoucnu mohl vycházet z informací již uložených u akce a doplnit historicky hodnotný zápis, fotografie nebo vzpomínky členů. Samotný kronikářský zápis je něco jiného než interní diskuse, surový seznam účasti nebo komentáře organizačního výboru. Do kroniky se nesmějí bez uvážení kopírovat neveřejná či soukromá data.

---

# VI. Úkoly – hlavní kandidát V2.0

## 28. Proč modul Úkoly vznikne

Organizační odpovědnosti se dnes snadno ztratí v konverzacích. Někdo se nabídne, že zajistí tombolu, jiný má obstarat dopravu, třetí napsat článek do kroniky. Po týdnu už nikdo neví, kdo co slíbil a zda je to hotové.

Úkoly mají propojit **domluvu, zodpovědnou osobu, termín a výsledek**. Nemají být plnohodnotnou náhradou komplexních projektových nástrojů typu Jira nebo Asana.

## 29. Úkol může vytvořit každý

Modul nemá sloužit jen k řízení práce vedením. Počítá se s tím, že každý člen může zadat osobní úkol nebo požádat o spolupráci jiného člena – samozřejmě s ohledem na pravidla konkrétního souboru.

Příklady:

- „Na vystoupení půjčit Lojzovi čižmy.“
- „Sepsat kronikářský zápis z Katerinských hodů.“
- „Připravit tombolu.“
- „Zajistit podklady pro vyúčtování dotace.“
- „Opravit poškozenou krojovou součást.“

Zadání úkolu jiné osobě by nemělo samo o sobě znamenat, že tato osoba práci bezvýhradně přijala. Pozdější návrh má určit, jak funguje přijetí či odmítnutí pověření.

## 30. Různá viditelnost úkolů

Ne každý úkol musí být veřejný:

- **osobní** – vidí jeho autor;
- **přiřazený** – vidí zadavatel a řešitel;
- **skupinový** – vidí oprávnění členové konkrétní skupiny;
- **organizační u akce** – vidí účastníci nebo jen organizátoři podle nastavení.

Právo číst úkol se musí odlišovat od práva měnit řešitele, termín nebo stav. U každého úkolu by mělo být jasné, kdo za něj skutečně odpovídá.

## 31. Přirozené začlenění do aplikace

Na dashboardu se mohou objevovat **Moje úkoly**, ale pouze tam, kde to uživateli přináší hodnotu. U konkrétní akce lze zobrazit úkoly související s jejím pořádáním. Úkol může mít popis, termín, stav, komentáře a odkaz na výsledek.

Samotná existence úkolu nemá automaticky měnit evidenci krojů, účetnictví ani jiné oficiální záznamy. Úkol říká, co se má udělat; příslušná agenda zaznamenává, co se skutečně provedlo.

## 32. Co musí V1.0 kvůli budoucím úkolům zachovat

- identitu jednotlivých členů a jejich skupin;
- odpovídající práva ke skupinovému obsahu a jeho správcům: úkol vázaný na skupinu nemá automaticky zpřístupnit soukromé příspěvky jiným osobám;
- možnost jednoznačně přiřadit akci a její organizátory;
- zachování historie a kontextu komentářů;
- možnost rozšiřovat aplikaci dalšími moduly bez zásadního předělání stávajících obrazovek.

**Není potřeba ve V1.0 vytvářet neviditelný modul úkolů, budoucí formuláře ani kompletní pravidla delegování.**

---

# VII. Rozšířené akce a jejich specializované potřeby

## 33. Typ, funkce a šablona jsou tři různé věci

Tento princip je důležitý pro dlouhodobý rozvoj:

- **Typ akce** vyjadřuje, o co jde: zkouška, vystoupení, soustředění, schůzka, společenská událost.
- **Funkce akce** určuje, co se v ní dá řešit: skutečná docházka, úkoly, otázky, sestava tanců, plán pobytu.
- **Šablona akce** předvyplní opakované postupy: Katerinské hody, Velikonoce, pravidelná zkouška, vánoční besídka.

Běžná zkouška má zůstat jednoduchá. Složitější organizace se zpřístupní jen tehdy, když ji konkrétní akce potřebuje.

Není cílem vytvořit pro každý tradiční zvyk vlastní speciální modul. Funkce mají být konkrétní a přiměřeně kombinovatelné.

## 34. Poptávka na vystoupení

Častá situace: pořadatel se zeptá, zda soubor může vystoupit. Nejdřív je nutné zjistit dostupnost muzikantů; teprve když se sestaví muzika, má smysl oslovit tanečníky.

Budoucí workflow by mohlo rozlišovat:

1. předběžnou poptávku;
2. oslovení muziky a zjištění její dostupnosti;
3. oslovení tanečníků;
4. návrh programu podle dostupných lidí;
5. závazné potvrzení vystoupení.

**Předběžná dostupnost není totožná se závazným potvrzením účasti.** Přesný způsob vyhodnocení „máme dost muzikantů“ je potřeba domluvit s vedením a muzikou.

## 35. Obsazení jednotlivých tanců

U vystoupení by později mohlo jít určit, které tance se provedou a kdo bude v jednotlivých číslech účinkovat. To přirozeně souvisí s budoucí evidencí repertoáru, kroji a dostupností členů.

Automatické sestavování programu ani doporučování náhradníků není pro první rozšíření nutné. Základní přínos má už ručně evidovaná sestava přístupná všem relevantním osobám.

## 36. Soustředění, noclehy a jídla

Při soustředění nestačí jediná odpověď „Přijdu“. Členové přijíždějí a odjíždějí v různý čas; organizátoři potřebují objednat odpovídající počty noclehů, snídaní, obědů a večeří.

Možná budoucí funkce:

- člen vyplní začátek a konec svého pobytu;
- systém podle konkrétního programu vypočítá očekávané noclehy a jídla;
- člen nebo organizátor může upravit výjimky;
- pořadatel dostane souhrn pro objednávky a může dohledat změny.

Počítání z pouhého data bez časů jídel by mohlo dávat chybné výsledky. Je nutné ověřit, jak soustředění skutečně probíhají.

## 37. Katerinské hody

Katerinské hody jsou příkladem rozsáhlé organizační akce: tombola, vstupenky, program, hudba, výzdoba, bufet, služby a mnoho dalších povinností.

V první verzi může domluva probíhat ve skupinové diskusi a přes označení konkrétních členů. Ve V2.0 přibude možnost navázat na akci úkoly.

**Není nutné vytvářet zvláštní modul rozpisu služeb.** Například službu v bufetu od 21:00 do 22:00 lze zatím vypsat v oznámení a zájemci se přihlásí komentářem. Samostatná evidence směn by dávala smysl až při opakovaném a dostatečně častém využití.

## 38. Velikonoce

Velikonoční obchůzka ukazuje, že odlišné skupiny mohou u jedné akce řešit odlišné otázky:

- holky: kdo bude doma, kdo bude u jiné členky, kdo je pryč;
- kluci: kdo půjde na obchůzku, jaká bude trasa, kdo pojede autem;
- organizátoři: kdo a kde se sejde a co je potřeba domluvit.

Do budoucna se nabízí **jednoduché cílené otázky nebo ankety u akce**, nikoliv nový pevný „velikonoční modul“ ani samostatné „skládání do aut“.

## 39. Vánoční besídka

U vánoční besídky se mohou objevit zvláštní potřeby, například anonymní přidělení, komu kdo chystá dárek. To je pěkný příklad funkce, která může být užitečná, ale **nesmí kvůli jednomu každoročnímu použití komplikovat první verzi aplikace**.

Případné tajné losování by muselo spolehlivě chránit samotné výsledky před ostatními členy.

## 40. Jak zabránit nekonečnému množení funkcí

Před přidáním specializované funkce se vždy ptáme:

1. Opakuje se problém dostatečně často nebo má zásadní dopad?
2. Nestačí akce, cílený příspěvek, komentář či úkol?
3. Potřebujeme strukturovaný výsledek, výpočet nebo kontrolu, kterou prostá diskuse nezvládne?
4. Lze funkci použít i u jiných druhů akcí?
5. Nezatíží běžného člena složitostí, kterou nikdy nevyužije?

---

# VIII. Další možné oblasti rozvoje

## 41. Kronika a dokumentování historie

Kronikář může dostat úkol sepsat článek o konkrétní akci nebo tématu. V budoucnu by měl mít možnost vytvořit kronikářský záznam navázaný na událost, doplnit text, fotografie a další podklady.

Kronika není automatickým přepisem všech interních dat. Jde o připravený historický dokument, jehož obsah má být redakčně spravován a cíleně zveřejněn.

## 42. Společná fotogalerie a úložiště

Možnosti zahrnují fotografie ze zkoušek, festivalů a soustředění, organizační dokumenty, scénáře a další společné materiály.

Otázky do budoucna: velikost úložiště, kvalita fotografií, kdo smí nahrávat a mazat, komu jsou fotografie přístupné, pravidla zveřejňování a uchování.

### Souborové přílohy, galerie a životnost dat

Počítačový `file` se ukládá **jednou**; chatová příloha, příloha příspěvku choreografie a dokument jsou **samostatné odkazy k témuž obsahu**. Muzikant může opravit přílohu ve zprávě, **dokud má pouze jedno použití**. Po připojení ke druhému místu (např. k příspěvku choreografie) se její obsah uzamkne; případná náhrada vytvoří nový soubor a mění příslušný odkaz, nikoliv obsah používaný na jiném místě. Každá skupina má přehled vlastních příloh, nikoliv plnohodnotnou náhradu Google Drive. Po odstranění skupiny musí soubor nadále používaný v galerii zůstat. Přístup k souboru se kontroluje podle oprávněného kontextu, ne podle znalosti URL.

## 43. Repertoár a choreografie

Evidence tanců a programových čísel může později obsahovat názvy, popisy, poznámky k obsazení, potřebné kroje a instruktážní videa choreografií.

To by pomohlo při opakování zapomenutých tanců a při přípravě vystoupení. Práce s videi musí respektovat oprávnění a případné autorské nebo osobnostní nároky.

**Preferovaný jednoduchý přístup pro Vonici (bez nového modulu):** repertoár lze zpočátku vést ve stávajících skupinách a na jejich nástěnkách. Každá choreografie bude mít vlastní příspěvek s popisem, videi, hudebními nahrávkami, notami a dalšími přílohami. Může vzniknout samostatná skupina „Repertoár“, nebo se obsah povede v existující skupině tanečníků; výběr je organizační rozhodnutí. Příspěvky by mělo jít snadno dohledat (například jednotným názvem a připnutým rozcestníkem). **Samostatnou evidenci repertoáru nyní neplánujeme**; odůvodněná by byla až tehdy, kdyby příspěvky a přílohy přestaly dostačovat, například kvůli strukturovanému hledání nebo vazbám na program vystoupení.

## 44. Texty písní a hudební databanka

Pro muziku může být užitečné společné místo pro texty písní, notové či studijní podklady, nahrávky a doprovodnou muziku pouštěnou na zkouškách.

Způsob ukládání, přehrávání, přístupu a případného sdílení mimo soubor je nutné navrhnout i s ohledem na licence a autorská práva.

## 45. Finance, náklady, dotace a vyúčtování

V budoucnu mohou ekonom a organizátoři evidovat výdaje a příjmy konkrétních akcí, podklady k vyúčtování dotací, důležité termíny, dokumenty či povinnosti.

Není cílem bez další analýzy vytvořit účetní software. Smysl má především přehled konkrétních souborových agend a propojení podkladů k akcím a úkolům.

## 46. Doprava a společné cestování

Domluva míst v autech a dostupnosti dopravy se opakuje zejména u vystoupení a výjezdů. Základní komunikaci lze zvládnout přes akci a komentáře. Strukturované nabídky míst či přihlašování na odvoz mají smysl až podle skutečné poptávky.

## 47. Automatizace a další užitečné drobnosti

Potenciálně užitečné mohou být například:

- přidání akce do osobního kalendáře;
- otevření místa akce v navigaci;
- opakování pravidelných zkoušek;
- založení nové tradiční akce podle předchozího ročníku;
- připomínky nevyřízených úkolů či blížících se zápůjček;
- export soupisů podle oprávnění;
- jednoduché ankety a potvrzení přečtení důležitých instrukcí.

Každý námět se posoudí samostatně podle přínosu a náročnosti.

### Dlouhodobá dostupnost členů – kandidát k realizaci

Člen (případně rodič jednající za dítě) si může zaznamenat delší období, kdy není dostupný pro zkoušky a vystoupení, například dovolenou, studijní pobyt nebo rekonvalescenci. Při plánování akcí se tato skutečnost může zobrazit oprávněným organizátorům a upozornit na kolizi s termínem. **Nejde o automatickou omluvenku ani náhradu potvrzení účasti na konkrétní akci**. Preferovat jednoduché zadání intervalu od–do, volitelnou poznámku a přiměřené soukromí důvodu. Podrobné chování je potřeba teprve navrhnout; jde o jediný nově vybraný námět z níže uvedeného seznamu pro možnou implementaci.

### Nezávazný zásobník námětů pro jiné soubory

Následující myšlenky **nejsou v plánu realizace pro Vonici**. Ponecháváme je pouze jako inspiraci při případném nasazení systému v jiném souboru. Nezakládají požadavek na nový modul, položku menu ani úpravu datového modelu:

- samostatný zpěvník, audiobanka a videobanka (místo příloh a příspěvků);
- obecný inventář hudebních nástrojů, techniky a rekvizit mimo krojový sklad;
- rezervace zkušeben a dalších prostor;
- narozeniny, výročí a jubilea členů;
- veřejná náborová přihláška pro zájemce o členství;
- formální členská hlasování, například výroční;
- osobní cestovní údaje pro zahraniční výjezdy (s důrazem na minimalizaci citlivých dat);
- souhrnné roční statistiky činnosti a účasti;
- historie kontaktů s pořadateli a organizátory vystoupení;
- veřejná prezentace vybraných akcí a fotografií na webu.

Externí výpůjčky krojů, kalendářové exporty ICS, finanční agenda a základní evidence repertoáru jsou již popsané jinde v tomto dokumentu; tímto seznamem je znovu nezadáváme.

---

# IX. Dětský soubor – odlišná pravidla, nikoli jen menší dospělí

## 48. Proč dětský soubor potřebuje samostatný návrh

Malá Vonica může sdílet některé nástroje dospělého souboru – akce, skupiny, oznámení, docházku, kroje – ale způsob řízení je podstatně odlišný.

U dětského souboru je vedení typicky více centralizované a autoritativní. Informace a organizační rozhodnutí jsou převážně odpovědností vedoucích a rodičů, nikoli samotných dětí.

**Dětský soubor nemá být zpřístupněn jen zapnutím skupiny „Děti“ ve stávajícím dospělém prostředí.** Potřebuje promyšlený režim oprávnění, komunikace a práce s osobními údaji nezletilých.

## 49. Rodiče a zákonní zástupci

Do dětského provozu přibývá role rodiče nebo zákonného zástupce:

- vidí informace týkající se svého dítěte;
- potvrzuje účast či omluvu, pokud je k tomu pověřen;
- může dostávat důležitá organizační oznámení;
- může řešit svěřené kroje nebo dokumenty dítěte v rozsahu stanoveném vedením;
- pokud má více dětí, měl by mezi nimi pohodlně přepínat.

Vztah dítě–zákonný zástupce a pravidla, kdo smí za dítě jednat, je potřeba samostatně ověřit.

## 50. Bezpečná komunikace s nezletilými

U dětského souboru je výchozí princip jasný:

**Dětem se automaticky nezpřístupní soukromé chaty, skryté skupiny ani volné vzájemné diskuse v zákoutích aplikace.**

Možné bezpečnější nastavení:

- oznámení od vedoucích směrem k rodičům či členům;
- řízené dotazy a odpovědi;
- komentáře jen tam, kde je vedení výslovně povolí a dokáže je spravovat;
- žádné automatické přenesení dospělých komunikačních oprávnění do dětského režimu.

Před nasazením se musí stanovit pravidla ochrany osobních údajů, přístupů k fotografiím, kontaktům, údajům o dětech a proces správy rodičovských oprávnění. Nelze je považovat za kosmetické nastavení.

### Konfigurovatelné profily samostatnosti a politika komunikace

| Kategorie | Účet dítěte | Chat | Rodičovské zastupování |
| --- | --- | --- | --- |
| Předškoláci | Bez vlastní potřeby účtu | Ne | Povinné, jedná rodič |
| 1. stupeň ZŠ | Volitelný omezený účet | Bez chatu | Povinné |
| 2. stupeň ZŠ | Vlastní účet | Skupinový chat dle politiky; DM konfigurovat | Povinné |
| Středoškoláci | Plnohodnotný účet | Dle pravidel souboru | Volitelné |

Jde o **konfigurovatelné profily**, nikoliv neměnné hardcoded věkové hranice. Jedno dítě mohou zastupovat dva rodiče, rodič může zastupovat více dětí; rodič jedná **svým účtem** s evidencí aktéra a dítěte. Rodič může být zároveň vedoucí či člen jiného souboru, žádné pověření se automaticky nepřenáší. Pro jednotlivé soubory lze politiku DM nastavit různě, skupina ji smí pouze zpřísnit. **Zastupování automaticky nezpřístupňuje DM dítěte.**

**Nahlášení zprávy je dostupné všem členům**, dospělým i nezletilým, a zpřístupní pověřené osobě jen nahlášený obsah a nezbytný kontext. Samotné nahlášení nevede automaticky k trestu ani plošnému čtení DM. Konkrétní bezpečnostní postupy při hlášeních a DM nezletilých je nutné dokončit před jejich nasazením (viz `09`).

## 51. Úkoly a docházka dětí

Na rozdíl od dospělého souboru se od dětských členů neočekává rozsáhlé samostatné zadávání úkolů nebo organizační rozhodování.

Úkoly mohou být především pro vedoucí a rodiče. Zda a jakým způsobem dítě samo potvrzuje účast, se musí určit podle věku a provozu souboru. Skutečnou docházku mohou evidovat vedoucí.

## 52. Organizační autonomie

**Rozhodnuto:** Malá Vonica a dospělá Vonica jsou dvě relativně samostatné organizační jednotky na stejné doméně se společnou globální identitou. Mají vlastní skupiny, akce, sklad a komunikační politiku. I společné vystoupení může být samostatnou akcí v každém souboru, s vlastním časem srazu a pokyny. Společná „nadřazená“ organizace ani automatická synchronizace skladů není podmínkou.

**Rozšíření o dětský soubor není součástí V1.0.** Není však vhodné budovat první verzi na předpokladu, že všichni uživatelé jsou dospělí se stejnými komunikačními právy.

---

# X. Další folklorní soubory

## 53. Co lze sdílet mezi soubory

Jiné dospělé soubory pravděpodobně potřebují podobné základy:

- členy, role a skupiny;
- nástěnky a akce;
- potvrzování účasti a docházku;
- krojový sklad;
- úkoly, historii a dokumenty.

Rozdílné však mohou být názvy skupin, typy akcí, pravidla vedoucích, typy krojů, míra samostatnosti členů nebo způsob potvrzování účasti.

## 54. Co má být nastavitelné

Dává smysl umožnit například:

- vlastní skupiny a jejich názvy;
- různou viditelnost obsahu;
- povolené moduly;
- typy akcí a výchozí způsoby jejich používání;
- přiměřeně odlišná oprávnění a pravidla správců skupin;
- **režim zakládání skupin pro daný soubor** (ve V1.0 administrátoři / všichni aktivní členové; schvalování návrhů později);
- typy a popisy krojových součástí.

Naopak není vhodné předem vytvářet univerzální prostředí, ve kterém si libovolný soubor může definovat jakoukoli entitu, formulář a složitý proces bez ohledu na jeho smysl.

## 55. Oddělení organizací

Provoz dospělé Vonice a Malé Vonice počítá se samostatnými soubory již jako **cílový model**; každý má vlastní členy, skupiny, události, krojovou evidenci i nastavení. Přístup mezi organizacemi nesmí vznikat náhodně. Výjimkou je úzce omezený osobní pohled na **vlastní zápůjčku z cizího skladu**, který neuděluje přístup k obsahu cizího souboru.

Jeden člověk však může být členem více souborů. Jeho přístup a pravomoci se pak vyhodnocují pro každý soubor zvlášť.

Rozhraní pro provoz více souborů, cenový model ani veřejná registrace organizací nejsou tématy V1.0. **Připravenost na více souborů neznamená nutnost nasadit multiorganizační službu hned.**

---

# XI. Uživatelská zkušenost, důvěra a provoz

## 56. Přehlednost, nikoli množství ovládacích prvků

Každá stránka má přednostně ukazovat to, kvůli čemu ji uživatel otevřel. Detail zkoušky má nejdřív zobrazit čas, místo a moji účast, nikoli padesát jmen. Podrobné seznamy a statistiky lze rozbalit.

Navigace na mobilu má zůstat přehledná i u lidí patřících do většího počtu skupin. Případný přehled všech nástěnek je vhodnější než neomezeně rostoucí počet položek v dolní liště.

Je potřeba otestovat čitelnost světlého i tmavého režimu, zobrazení administrativních formulářů, správné české datumy a chování na úzkých displejích.

## 57. Základní důvěryhodnost aplikace

Systém musí spolehlivě ukládat změny a jasně informovat o úspěchu nebo chybě. U akcí, účasti, krojových zápůjček a inventur je důležité vědět, zda operace skutečně proběhla.

Pro první reálný provoz jsou podstatné:

- bezpečné přihlašování a serverová kontrola oprávnění, včetně skutečného zákazu čtení cizích soukromých skupin běžným administrátorem;
- zálohování a vyzkoušená obnova;
- možnost rozumně dohledat důležité změny, zejména v evidenci krojů, změnách členství, správcovství skupin a zásazích do jejich obsahu;
- předvídatelné chování při výpadku připojení;
- srozumitelné chyby a prázdné stavy;
- použitelnost na běžném telefonu;
- provoz, který nemusí každý týden ručně opravovat jeho autor.

### Offline provoz a zálohy – provozní kompromis

Aplikace je **online-first**. Offline slouží pouze ke čtení poslední uložené kopie **aktivních textových dat a metadat**, bez fotografií, audia a videa; při ztrátě spojení se viditelně oznámí offline režim a **všechny zápisy se zakážou**. Lokální IndexedDB cache se při aktivní online aplikaci aktualizuje přibližně každých **10 minut**, okamžitě při otevření detailu nebo potvrzené změně. Datové sady se srovnávají po modulech přes **ETag**; bez změnového kurzorového deníku a bez fronty offline zápisů. Cache odděluje účty a při obnovení spojení zohlední aktuální oprávnění. Již stažená offline data však nelze na odpojeném zařízení okamžitě odvolat.

Hosting provádí denní zálohy MySQL a souborů s maximálně **14denní historií** (u MySQL větší než 2 GB uvádí jen týdenní zálohování). Jako dodatečnou ochranu plánujeme **týdenní šifrovaný export mimo hosting** včetně příloh a klíčů nutných k obnově DM. Při úplné ztrátě poskytovatele může být ztráta dat až cca **týden**, denní zálohy poskytovatele samy o sobě nezaručují hodinové RPO. Konkrétní exportní a obnovovací postup musí být otestován (viz `01`).

## 58. Osobní údaje a soukromí

Aplikace bude obsahovat údaje o konkrétních lidech, jejich členství, kontaktech, účasti, přečtení příspěvků či svěřených předmětech. U budoucích dětských skupin může jít navíc o údaje nezletilých.

Před spuštěním je nutné určit správce údajů, účely zpracování, kdo smí které údaje vidět, pravidla uchování, postup při ukončení členství a způsob řešení žádostí členů. Práva přístupu nelze nahradit pouhým schováním tlačítka ve frontendu. **Ani vedoucí, ani administrátor nesmějí jen díky své roli číst cizí soukromé skupinové diskuse.** Administrátor nesmí získávat přístup tichým přidáním sebe sama do skupiny; členství a zásahy do skupin musí být transparentní a dohledatelné. Superadministrátorský přístup se používá jen výjimečně a je chráněn odpovídajícími provozními opatřeními.

Podrobný právní a bezpečnostní režim bude samostatnou provozní otázkou; tento produktový dokument jej nenahrazuje.

### Životní cyklus osob a skupin (rozhodnuto)

**Člověk, globální účet, členství v konkrétním souboru a pověření jsou různé entity.** Dobrovolný odchod, vyloučení, úmrtí ani deaktivace dlouhodobě neaktivního účtu **automaticky nemažou historickou osobu** či záznamy autoritativní evidence.

- **Bývalý člen:** globální účet a omezený osobní přehled zejména otevřených zápůjček zůstane, ale souborová interní komunikace, skupiny, seznam členů a nové akce se znepřístupní. V jiném souboru může být nadále aktivní. Dřívější obsah zachován; bývalý člen jej už sám zpětně neupravuje ani nemaže. Zákonné žádosti o výmaz posuzovat individuálně.
- **Vyloučení:** okamžité odebrání dotčeného souborového přístupu bez automatického zásahu do jiných členství; otevřené závazky se neuzavírají. Možný zvláštní celosystémový bezpečnostní blok.
- **Úmrtí:** zneplatnit relace, znemožnit přihlášení a zastavit notifikace, zachovat potřebnou historii. „Zesnulý člen“ lze na profilu **volitelně zveřejnit pouze vědomým rozhodnutím** oprávněného správce; neotevírat DM pozůstalým automaticky.
- **Návrat:** obnovit členství téže osoby bez automatického obnovení někdejších pověření.
- **Dlouhodobá neaktivita:** u bývalého člena bez dalších aktivních rolí či závazků lze po orientačně **3–5 letech** předem avizovanou e-mailovou výzvou deaktivovat účet. Zachovat nezbytnou osobní historii. Konkrétní lhůty výmazu/kontaktů/IP samostatně posoudit.
- **Skupiny:** aktivní → archivovaná (read-only, bez notifikací) → skutečně smazaná. **Smazat lze pouze archivovanou skupinu** a jen oprávněným správcem s potvrzením. Odstraní výlučně skupinové zprávy, nástěnku, ankety a výlučné přílohy; nezávislé evidenční záznamy a jinde používané počítačové soubory zůstávají. Archiv lze znovu aktivovat.

## 59. Webová aplikace, technologie a hosting – pouze směr

Aktuální frontend je připravován jako webová aplikace v Angularu. Původně plánovaný provoz využíval běžný PHP hosting, PHP API a MySQL. Zvažovanou alternativou je Node.js/TypeScript s PostgreSQL na vhodném serveru, případně s WebSockety pro pozdější živější komunikaci.

**Technologie nejsou součástí veřejného příslibu funkcí.** Volba hostingu má být samostatným rozhodnutím podle nákladů, správy a skutečných potřeb. Webové push notifikace samy o sobě nevyžadují WebSocket server. Datové a aplikační vazby mají zůstat srozumitelné a rozšiřitelné bez ohledu na zvolený backend.

Není nutné začít provozovat vlastní velkou infrastrukturu jen proto, že systém jednou možná přidá další moduly.

---

# XII. Verze, priority a cesta k nasazení

## 60. Pravidlo uzavření rozsahu

**Nově objevená užitečná funkce automaticky neposouvá termín první verze.**

Výjimkou mohou být jen funkce, bez nichž by nebylo možné splnit původní důvod spuštění. Právě proto byly do V1.0 výslovně zařazeny skutečná docházka a použitelná krojová inventura.

Úkoly, rozšířené obsazování tanců, speciální formuláře k Velikonocům a další nápady budou zapsány, ale nebudou blokovat první provoz.

## 61. Přehled verzí

| Etapa | Zaměření | Podmínky / výsledek |
| --- | --- | --- |
| **Současné demo** | Frontendový prototyp a testování obrazovek | Ověřování uživatelských postupů, mock data, připomínky |
| **0.9 – pilot** | První skutečná data a omezený provoz | Reálné účty, akce, nástěnky, docházka, použitelný krojový sklad a základ inventury; ověření záznamů externistů, soukromí skupin, správců a omezení přístupu; test s vybranými členy a krojařkami |
| **1.0 – první provoz** | Běžné používání dospělou Vonicí | Ověřené postupy, spolehlivé ukládání, práva, zálohy, použitelná mobilní aplikace a vyřešené upozorňování |
| **1.x – stabilizace** | Zlepšování podle pilotu | Opravy, přehledy, drobné usnadnění práce, případně lepší exporty a notifikace |
| **2.0 – úkoly** | Delegování odpovědnosti | Osobní, přiřazené, skupinové a organizační úkoly s vazbou na akce; konkrétní rozsah se upřesní |
| **2.x – specializované akce** | Různé funkce podle potřeby | Poptávky vystoupení, obsazení tanců, soustředění, cílené otázky, šablony; postupně podle priority |
| **Pozdější rozšíření** | Archiv, multimédia, finance, další skupiny | Kronika, dokumenty, hudba, repertoár, dětský soubor a případně další soubory |

Pořadí rozšíření od V2.0 dál je orientační; může se změnit podle reálného provozu. Nebude-li například soustředění aktuální problém, nemá smysl jej programovat před jinou naléhavější funkcí.

## 61.1 Priority podle dopadu

| Priorita | Oblast | Proč |
| --- | --- | --- |
| **P0 – bez toho nespustíme V1.0** | Bezpečné účty a oprávnění včetně externistů a bývalých členů; soukromé skupiny, jejich správci a oddělení administrace od čtení obsahu; nastavení zakládání skupin; akce a skupinová komunikace; plánovaná a skutečná docházka; krojová inventura a základní export; trvalá data, zálohy a upozornění | Řeší původní problémy, které mají být přechodem do aplikace odstraněny, aniž by zaniklo soukromí jednotlivých skupin. |
| **P1 – první větší rozšíření** | Úkoly propojené s akcemi; praktická zlepšení provozu podle pilotu | Zodpovědnost za společnou práci a odstranění zbytečné administrativy. |
| **P2 – podle častosti využití** | Poptávky vystoupení, sestavy tanců, soustředění, otázky podle skupin, šablony akcí | Vysoký přínos v konkrétních situacích, ale nemusí blokovat první vydání. |
| **P3 – strategické možnosti** | Kronika, fotografie, repertoár, hudba, finance, dětský soubor, další organizace | Rozšíření dlouhodobé hodnoty a rozsahu systému po ověření jádra. |

Priorita není totéž co technická složitost: malé zlepšení použitelnosti se může realizovat průběžně, i když se týká nižší priority.

## 62. Tři první ověřované pracovní scénáře

### Scénář A: zkouška

Vedoucí založí zkoušku → člen ji uvidí → potvrdí účast → vedoucí vidí odpovědi → po zkoušce zapíše skutečnou docházku → údaje zůstanou zachované.

### Scénář B: krojový sklad

Krojařka zaeviduje číslovaný díl i neočíslované doplňky → zařadí je do kompletu → předá komplet členovi či externistovi → u částečného vrácení doplní poznámku ke konkrétní součásti → provede inventuru → vidí zjištěné nesrovnalosti a historii.

### Scénář C: komunikace

Vedoucí zveřejní oznámení pro určené skupiny → oprávnění členové jej uvidí a dostanou potřebnou informaci → mohou reagovat v komentářích → příspěvek lze později dohledat.

### Scénář D: host na jednom vystoupení

Krojařka zaeviduje externistu jako vypůjčitele bez nutnosti zřídit mu účet → organizátor jej případně přizve k jednomu zájezdu a udělí mu potřebný přístup → host nevidí interní akce ani nástěnky jiných skupin → po skončení spolupráce může být přístup odebrán, ale zápůjčka a účast zůstanou dohledatelné.

Tyto scénáře mají být prověřeny **od začátku do konce s reálnými daty a tam, kde je nutné přihlášení, také s účty**, nikoli pouze klikáním v demu.

## 63. Kritéria pro zahájení běžného provozu V1.0

- [ ] Členové se bezpečně přihlásí a umějí obnovit přístup.
- [ ] Skupinová viditelnost a role jsou ověřené i proti neoprávněnému přístupu; běžný administrátor a vedoucí nevidí soukromé nástěnky ani statistiky cizích skupin.
- [ ] Každá skupina má alespoň jednoho správce, který může spravovat členství, připínat, skrývat, archivovat a obnovovat příspěvky ve své skupině.
- [ ] Pro Vonici funguje výchozí pravidlo „skupiny zakládají administrátoři“; volitelný režim zakládání aktivními členy je nastavitelný samostatně pro soubor.
- [ ] Administrátor nemůže sám sebe nepozorovaně přidat do soukromé skupiny; změny členství a správcovství jsou dohledatelné a viditelné oprávněným lidem.
- [ ] Akce mohou být určeny více skupinám i individuálním hostům bez zpřístupnění soukromých nástěnek těchto skupin.
- [ ] Bývalí členové a externisté zůstávají evidovaní bez automatického přístupu k interním skupinám; účast hosta na vybrané akci přístup nerozšiřuje jinam.
- [ ] Vedoucí bez zásahu vývojáře založí a upraví akci i důležité oznámení.
- [ ] Členové jednoduše potvrzují účast na telefonu.
- [ ] Vedoucí zaznamená skutečnou docházku, odlišnou od původní odpovědi člena.
- [ ] Krojařky samostatně evidují díly, komplety, zápůjčky a vrácení.
- [ ] Krojařky ověřily skutečný inventurní postup na reálných předmětech včetně neočíslovaných doplňků.
- [ ] Při vrácení kompletu fungují poznámky ke konkrétním součástem a rozlišení převzatých, ale nepřipravených věcí.
- [ ] K dispozici jsou základní tiskové nebo exportní přehledy pro krojařky.
- [ ] Recyklace evidenčních čísel nezaměňuje historické záznamy.
- [ ] Data se spolehlivě ukládají a existuje ověřená záloha i obnova.
- [ ] Významná oznámení mají reálně fungující doručovací nebo upozorňovací cestu.
- [ ] Aplikace se dá používat na běžných telefonech členů a krojárek.
- [ ] Omezený pilot odhalil a odstranil zásadní překážky v reálném provozu.

Není podmínkou, aby při vydání V1.0 byly už zdigitalizovány úplně všechny skladové předměty. **Podmínkou je, že krok za krokem funguje postup, kterým je lze skutečně zaevidovat a inventarizovat.**

## 64. Přechod od současných nástrojů

Na počátku není realistické zakázat WhatsApp či Messenger. Přechod by měl být postupný:

1. Vybraní členové otestují systém na skutečných údajích.
2. Oficiální termíny, potvrzování účasti a základní skupinová sdělení se přesunou do aplikace.
3. Staré kanály mohou dočasně upozorňovat na nové místo informací, ale nemají dál vytvářet konkurenční verze pravdy.
4. Docházka se přestane znovu přepisovat do tabulek, jakmile se nová evidence osvědčí.
5. Inventura může probíhat postupně, ale přírůstky a oficiální zápůjčky se od zahájení provozu vedou konzistentně.

Rozhodnutí o definitivním opuštění konkrétního nástroje musí učinit lidé, kteří jej dnes používají – podle toho, zda jim nová aplikace už práci opravdu nahradí.

## 65. Co nebude podmínkou V1.0

Zejména:

- samostatný modul Úkoly;
- rozpisy bufetových služeb a dopravy;
- automatická poptávková workflow vystoupení;
- obsazení jednotlivých tanců;
- plánování noclehů a objednávek jídla;
- speciální velikonoční dotazníky a tajné losování dárků;
- kompletní fotogalerie, hudební archiv a kronika;
- finance, dotace a podrobné účetní evidence;
- samoobslužný dětský soubor a rodičovské účty;
- provoz aplikace pro další nezávislé organizace;
- plnohodnotný soukromý chat nebo trvalé spojení přes WebSocket.

---

# XIII. Otevřené otázky k dalším konzultacím

## 66. Pro vedení souboru

- Které typy sdělení se dnes nejčastěji ztrácejí?
- Které osoby smějí vytvářet a upravovat akce, určovat jejich organizátory a zvát externisty k jednotlivým událostem?
- Jak přesně bude probíhat přijetí do soukromé skupiny a kdo bude zastupovat chybějícího správce?
- Které údaje o změnách členství mají vidět všichni členové skupiny a které jen její správci?
- Jaký provozní postup použije superadministrátor při mimořádném zásahu do soukromého obsahu?
- Jaké přesné údaje o skutečné docházce je nutné zaznamenávat?
- Jak se mají chovat opravy docházky a její přehledy za období?
- Které informace se musí členům skutečně doručit jako upozornění?
- Jaká část komunikace může zatím zůstat na původních kanálech?

## 67. Pro krojařky

- Jaký je konečný seznam názvů číselných řad pro jednotlivé druhy krojů?
- Jaké neočíslované zaměnitelné doplňky a jejich požadované počty je nutné evidovat?
- Jaké konkrétní tiskové sestavy a formáty exportů mají být připraveny při první inventuře?
- Má být při předání části kompletu vždy nutné potvrdit výjimky výslovně?
- Vyhovuje jednoduché označení „nepřipraveno k zapůjčení“ s volnou poznámkou?

Podrobněji viz dokument `06-specifikace-krojoveho-skladu.md`, určený přímo ke schválení krojařkami.

## 68. Pro budoucí rozšíření

- Jak budeme rozhodovat o přijetí úkolu od jiného člena?
- Kdo smí vidět soukromé, skupinové a organizační úkoly?
- Jaké typy akcí opravdu potřebují strukturované funkce navíc?
- Jak přesně se rozhoduje, zda je možné sestavit muziku a taneční obsazení pro vystoupení?
- Jak má fungovat oddělené vedení dětského souboru a zastupování dítěte rodičem?
- Jaké typy dat by se případně sdílely mezi soubory a které musí zůstat striktně oddělené?
- Má být pro jednorázové hosty pohodlnější přímé pozvání ke konkrétní akci, nebo časově omezené skupinové oprávnění?

---

# XIV. Shrnutí pro představení projektu

## 69. Krátké představení (například na schůzi souboru)

Souborový systém vzniká proto, že dnes řešíme organizaci souboru na příliš mnoha různých místech. Termíny jsou na Facebooku, domluvy v Messengeru nebo WhatsAppu, docházka v tabulkách a část informací se časem ztrácí. Chceme jedno společné místo, kde člen na telefonu najde důležité zprávy, akce, potvrzení účasti a informace o svých krojích.

Vedoucím systém pomůže s plánováním a skutečnou docházkou, krojařkám s evidencí zápůjček a inventurou. Postupně může přidat také úkoly, kroniku, fotografie, repertoár nebo další organizační nástroje. Nejde o to všechno vytvořit najednou. Jde o to začít funkcemi, které nám konkrétně pomohou už dnes, a na nich rozumně stavět.

## 70. Jedna věta, ke které se chceme vracet

> **Souborový systém má zjednodušovat společnou práci, sjednocovat důležité informace a uchovávat paměť souboru – tak, aby měl každý to podstatné vždy po ruce.**

---

## Návazné projektové dokumenty

Tento dokument sjednocuje a rozvíjí dřívější podklady; nenahrazuje detailní provozní konzultace jednotlivých agend:

- `00-prehled.md` – původní směr produktu, cílové skupiny a zásady;
- `01-technicky-stack.md` – dosavadní technické varianty a oddělení frontendu od backendu;
- `02-core-a-moduly.md` – vymezení jádra, modulů a skupin;
- `03-postup-vyvoje.md` – iterativní vývoj a původní MVP;
- `04-styl-prace.md` – zásady rozhodování a přístup k vývoji;
- `05-motivace-a-vize.md` – stručný motivační text;
- `06-specifikace-krojoveho-skladu.md` – detailní uživatelská specifikace ke schválení krojařkami.

**Poznámka k návaznosti:** Dřívější dokumenty 02 a 03 počítaly s menším rozsahem první verze. Tento souhrnný dokument odráží novější rozhodnutí: **skutečná docházka a použitelná inventura krojů patří do V1.0**, včetně evidence externistů, neočíslovaných doplňků, poznámek při vracení a základních exportů; úkoly a specializované funkce akcí až do následného rozvoje. Původní úvahy o technologiích zůstávají možnostmi, nikoli automaticky potvrzeným konečným výběrem.

---

*Stav: pracovní návrh k připomínkování. Verze dokumentu 0.3 dále zpřesňuje systémové role, správce skupin, soukromí skupin a konfigurovatelné zakládání skupin. Nadále zahrnuje dřívější rozhodnutí o externistech, hostech, docházce a krojovém skladu. Rozsah první verze je zde stanoven jako produktové rozhodnutí; otevřené provozní postupy je třeba potvrdit odpovědnými osobami.*
