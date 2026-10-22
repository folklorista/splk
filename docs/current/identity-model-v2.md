# Souborový systém — identita a organizační model v2

**Stav:** **směr schválen 22. 10. 2026** (`docs/decisions.md` D-06, D-07, D-09, D-10): model se složkami; implementovat `Person`, `UserAccount`, `UnitAffiliation`, `GroupMembership`, `Representation`, `PositionAssignment`, formální členství a „přijatého člena“. Rozhraní níže jsou **konceptuální**, nejde o schválené databázové schéma ani programovací zadání. Otevřené: Q-01, Q-07 až Q-09.  
**Datum:** 22. října 2026  
**Rozsah:** společný model pro dvě nezávislé instalace: Slovácký soubor Vonica a Vonička Zlín  
**Výchozí implementace:** Angular 19 / frontend-only demo, větev `design/identity-03`, dokumentace skutečného stavu z 21. 10. 2026

> **Konvence:** Oddíly „Potvrzené potřeby“ vycházejí z popisů organizací a následných upřesnění. Oddíly „Navržené řešení“ jsou architektonické návrhy, které je třeba ověřit. Oddíly „Otevřené otázky“ nejsou domýšlené skutečnosti.

## 1. Cíl a hranice návrhu

Cílem je odstranit před backendem předpoklad, že **osoba = uživatelský účet = člen souboru**. Tentýž zdrojový kód musí umět pracovat s dospělým členem Vonice, dítětem Voničky bez účtu, dvěma rodiči oprávněnými jednat za stejné dítě, externistou půjčujícím si kroj i vedoucím působícím ve více organizačních složkách.

**Nejde o multi-tenant aplikaci:** Vonica a Vonička budou mít **samostatné instalace, vlastní databáze, přihlášení a konfigurace**. Osoba v jedné instalaci není automaticky totožná s osobou v druhé instalaci. V aplikaci proto nepotřebujeme přepínač organizací ani globální sdílený registr osob. Současné `ensembleId = 1` nelze chápat jako základ budoucí společné DB.

Uvnitř instalace Vonice ovšem existují autonomní **souborové složky** (dospělá Vonica, Malá Vonica, Děvčice z Vonice a přidružená muzika). Ty sdílejí některé osoby a společné souborové agendy, ale jiné údaje a krojové fondy mají oddělené. Vonička má naproti tomu tři taneční **skupiny** I–III a jeden společný krojový fond.

> *Upřesnění 22. 10. 2026 (D-06):* u Voničky jsou **Vonička I, II a III složkami úrovně 2**. Krojařky jsou přiřazené po složkách (Gabča I, Anuška II a III) a **krojové fondy jsou rozdělené po složkách** (D-29).

**Teď řešíme:** identitu, vztahy osob, členství, složky, skupiny, zastupování, pověření a pravidla viditelnosti. **Zatím neimplementujeme:** finance, ankety, nominace, úkoly, nové obrazovky ani backend; pouze dbáme, aby jim základní model nepřekážel.

## 2. Potvrzené doménové potřeby

### 2.1 Vonica

- Jedna osoba může působit zároveň v několika souborových složkách, každá může mít vlastní vedení, docházku a krojový fond.
- Ve složce Vonica lze rozlišovat zájemce, aktivní a bývalé členy; externista může pomáhat na akcích nebo dostat konkrétní pověření.
- *(Neplatí – D-30: přijatý člen nemá v aplikaci žádná práva navíc, výbor se volí na schůzi.)* ~~Funkce ve výboru vyžaduje **aktivního a „přijatého“ člena**. „Přijetí“ je slavnostní institut s historií, případně kmotrem/kmotrou; samo o sobě nepřináší obecné přístupy do aplikace. Konkrétní organizační úkol však může dostat i externista.~~
- Organizační funkce a oprávnění nejsou totéž. Jedna osoba může současně zastávat více funkcí; pomocníci nedostávají automaticky hlas ve výboru.
- Jména osob mohou být potřebná napříč složkami, ale údaje o členských příspěvcích, docházce či skladové agendě nikoliv.
- Postavení muzikantů z přidružené muziky ve vztahu k aktivnímu členství a hlasování se ještě ověřuje.

### 2.2 Vonička

- Formálními členy právnické osoby Vonička Zlín, z. s., jsou členové spolku s hlasovacím právem (v zápisu z července 2026 jich bylo deset). Děti tanečních skupin **nejsou formálními členy spolku**, ač se za jejich účast platí „členské příspěvky“. Rodiče se nestávají formálními členy spolku pouze proto, že jejich děti docházejí.
- Dítě může mít **nula nebo jeden vlastní účet**, oba rodiče mohou mít vlastní přístupy a zastupovat je. Jeden rodič může zastupovat více dětí. U I a II obvykle komunikují rodiče, u III zejména děti, někdy rodiče nebo obojí.
- Dítě může navštěvovat více skupin zároveň. O přesunech rozhodují vedoucí. Každá skupina má vlastní nácviky a docházku.
- Jeden nácvik má **jednu docházku**; zobrazení „kluci / holky“ je jen praktické členění seznamu, nikoliv samostatné akce nebo samostatná oprávnění.
- Vedoucí vidí seznamy ostatních skupin, ale **ne jejich docházku**; nemohou za jinou skupinu omlouvat ani zapisovat přítomnost. Vedoucí mohou pověřovat pomocníky ve své skupině.
- Údaje o zaplacení příspěvků vidí hospodářka a vedoucí skupin, které dítě navštěvuje; nikoliv každý vedoucí celý spolek.
- Krojový fond je společný skupinám I–III a výpůjčka je evidována na **dítě**, nikoliv na rodiče.

## 3. Slovníček a hranice pojmů

| Pojem | Co znamená | Co **neznamená** |
|---|---|---|
| **Instalace** | Jedno samostatné nasazení aplikace s vlastní databází | Složka nebo skupina uvnitř souboru |
| **Osoba (`Person`)** | Fyzický člověk vedený v evidenci | Automaticky přihlášený uživatel nebo aktivní člen |
| **Účet (`UserAccount`)** | Autentizační identita člověka, který se přihlašuje | Dítě nebo zastupovaná osoba sama o sobě |
| **Složka (`Unit`)** | Autonomní organizační část jedné instalace | Komunikační skupina nebo samostatná instalace |
| **Příslušnost ke složce (`UnitAffiliation`)** | Člověk je zájemcem, aktivně působí nebo dříve působil v dané složce | Přihlášení do aplikace ani nutně právní členství |
| **Skupina (`Group`)** | Organizační/komunikační okruh s vlastními členy a případným chatem/nástěnkou | Automaticky samostatná složka nebo právnická osoba |
| **Členství ve skupině (`GroupMembership`)** | Vazba osoby na skupinu, s historií | Oprávnění spravovat skupinu |
| **Zastupování (`Representation`)** | Oprávněná osoba jedná v konkrétních věcech za jinou osobu | Sdílení hesla nebo převzetí všech práv dítěte |
| **Pověření (`Mandate`)** | Oprávnění k určité činnosti ve vymezeném rozsahu | Titul, funkce nebo automatické hlasovací právo |
| **Funkce (`PositionAssignment`)** | Organizační pozice konkrétní osoby a její historie | Sama o sobě všeobecný přístup k datům |
| **Formální členství** | Právní členství ve spolku Vonička, pokud je relevantní | Slavnostní „přijetí“ ve Vonici |
| **Přijatý člen Vonice** | Historicky evidované slavnostní přijetí | Právní členství Voničky |

**Podstatné:** „externista“ není druh fyzické osoby. Je to *vztah k činnosti souboru*. Externista může mít účet i nemusí; může být pozván na akci a pověřen úkolem, ale neznamená to automaticky příslušnost k některé složce. „Bývalý člen“ vyplývá z historie ukončené příslušnosti, ne z globálního vypnutí osoby.

## 4. Navržené řešení: základní entity

Následující TypeScript rozhraní jsou **konceptuální**. Nejde o požadavek přesně takto pojmenovat soubory ani o definitivní databázové tabulky. Identifikátory jsou záměrně nezávislé; není mezi nimi rovnost `personId === accountId`.

```ts
interface Person {
  id: number;
  firstName: string;
  lastName: string;
  nickname?: string;
  // Další kontaktní a osobní údaje podle přístupových pravidel.
}

interface UserAccount {
  id: number;
  personId: number;
  loginEmail: string;
  status: 'invited' | 'active' | 'disabled';
  // Přihlašovací údaje a relace řeší autentizační vrstva.
}

interface Unit {
  id: number;
  name: string;
  archivedAt?: string;
}

interface UnitAffiliation {
  id: number;
  personId: number;
  unitId: number;
  status: 'interested' | 'active';
  from: string;
  to?: string;
  endReason?: 'left' | 'excluded' | 'other';
}

interface Group {
  id: number;
  name: string;
  unitId?: number; // Bez unitId = skupina napříč složkami / na úrovni organizace.
  // Zachovat současné nastavení viditelnosti, chatu a nástěnky.
}

interface GroupMembership {
  id: number;
  groupId: number;
  personId: number;
  joinedAt: string;
  leftAt?: string;
}
```

### 4.1 Kardinality a životní cyklus

- `Person` **1 → 0..1 `UserAccount`** v první verzi; osoba bez účtu je plnohodnotně evidovatelná. Každý účet patří konkrétnímu člověku. Tento jednoduchý předpoklad v budoucnu lze přehodnotit, ale neřešíme více účtů na člověka bez důvodu.
- `Person` **1 → N `UnitAffiliation`**; stejná osoba může mít zároveň aktivní příslušnosti k několika složkám. Příslušnost má časovou historii; změna na bývalého člena ji nesmaže.
- `Unit` **1 → N `Group`**, ale `Group.unitId` může být prázdné pro celosouborové či mezisložkové skupiny (např. Výbor).
- `Person` **M:N `Group`** přes `GroupMembership`; účast ve skupinách II a III současně je normální.
- **Zájemce → aktivní účastník → bývalý účastník** se řeší historií příslušnosti, nikoli změnou `Person` nebo přidělením účtu. Ukončená příslušnost automaticky ruší nárok na práva, která z ní vyplývala; historii docházky, krojů a akcí zachováváme.
- Organizace může v adresáři evidovat i osobu **bez jakékoliv příslušnosti** (externí muzikant, host, půjčitel kroje, rodič bez tanečního členství). Takovou osobu není nutné zavést podruhé jako krojového „externistu“.
- Skupina může reprezentovat také pracovní či komunikační tým (např. Výbor nebo Krojařky), nikoli jen taneční kolektiv. Pro vstup do skupiny se uplatní její konkrétní pravidla, nikoliv pouhá shoda příslušnosti ke složce.

**Pravidlo konzistence:** Aktivní vazby a jejich intervaly se nesmějí udržovat jako dvě nezávislé kopie (`groupIds` + `groupIntervals`); pro backend navrhujeme jeden autoritativní vztah s historií, z něhož se aktuální členství odvodí.

## 5. Zastupování dětí

```ts
interface Representation {
  id: number;
  representativePersonId: number; // Rodič / pověřená osoba
  representedPersonId: number;    // Dítě
  relationship: 'parent' | 'guardian' | 'authorized-person';
  from: string;
  to?: string;
  // Konkrétní možnosti zastupování stanoví pravidlo organizace.
}
```

- Vazba je **M:N**: jeden rodič ↔ několik dětí, jedno dítě ↔ více oprávněných osob.
- Rodič se **přihlašuje vlastním účtem**; nepřihlašuje se pod účtem dítěte. Dítě ve III může mít zároveň vlastní účet.
- Při požadavku „Omluvit dítě“ musí systém ověřit dvě věci: **smí účet jednat za toto dítě?** a **smí dítě/rodič danou operaci provést vzhledem ke konkrétní akci?**
- Zastupování se týká zejména vlastních odpovědí na účast a omluv. **Nedává rodiči právo zapisovat skutečnou docházku celého nácviku**, spravovat skupinu nebo prohlížet interní konverzaci vedoucích.
- Zastupování **neznamená automatický přístup k soukromým zprávám dítěte**. DMs nejsou součástí této fáze; případná pravidla komunikace nezletilých budou samostatné rozhodnutí.
- Při zápisu změny uložíme **`actorAccountId`** (kdo přihlášený změnu provedl) a **`subjectPersonId`** (koho se změna týká). Příklad: otec odpověděl na účast dcery; autorem změny je otec, účast je dcery.
- Ukončení zastupování musí být možné bez zásahu do historie docházky a výpůjček dítěte.

**Návrh pro frontend:** po přihlášení se ukáže vlastní profil a případně možnost jednat za zastupované osoby. Pro Voničku I/II je přirozené vybírat dítě; u Voničky III může dítě pracovat samo. Toto je volba **subjektu úkonu**, nikoliv přepínač samostatných souborů.

## 6. Funkce, členství ve spolku a pověření

### 6.1 Evidované funkce

Současný `Member.functionTitle` je jeden textový popisek. Pro opakované i souběžné funkce a jejich historii navrhujeme logický `PositionAssignment(personId, title, unitId?, from, to?)`. Záznam funkce **sám neposkytuje přístup** do citlivé agendy. Není nutné nyní budovat číselník všech titulů; důležitější je umožnit více souběžných/historických záznamů.

### 6.2 Dva různé druhy členství

- **Vonička — právní členství ve spolku:** samostatně evidovaná vazba člověka ke spolku (s obdobím, případně funkcí v jeho orgánech). Dítě docházející na nácviky není jen proto členem spolku. Formální členství je relevantní pro členskou schůzi a hlasování.
- **Vonica — slavnostní „přijaté členství“:** samostatná historická skutečnost (datum/rok, případný kmotr/kmotra). Podle potvrzeného pravidla je spolu s **aktivním členstvím** podmínkou funkce ve výboru; neposkytuje automaticky přístup do skupiny Výbor ani oprávnění správce.

Nejde o stejný boolean ani stejnou tabulku jen s jiným názvem. Podmínky volitelnosti, hlasování a evidence funkcí mohou být pravidly konkrétní instalace.

### 6.3 Pověření a jejich rozsahy

Zachovat princip stávajícího `Mandate` a rozšířit jeho rozsahy, kde je to nutné:

> *Rozhodnuto 22. 10. 2026 (D-10):* rozsahy jsou **soubor (organizace) / složka / skupina / akce / modul**. Superadministrátor neexistuje (D-09).

- `organization`: správa instalace; **neznamená automaticky čtení obsahu soukromých skupin**;
- `unit`: vymezená souborová složka (zejména správa krojů Vonice);
- `group`: určitá skupina (např. zápis docházky Voničky II);
- `event`: jediná akce, pokud to činnost dovoluje;
- `module`: odborný modul (např. kroje), viz `moje/08` kap. 3.4.

Ne všechny druhy pověření musí podporovat všechny rozsahy. Nesnažíme se z nich udělat generický ACL framework. Oprávnění zůstávají **explicitními typy operací** (správa osob, správa skupiny, organizace akcí, evidence docházky, správa krojů, finanční přehled apod.).

**Důležitá asymetrie:** vedoucí Voničky může být oprávněn **zobrazit základní seznam osob v jiné skupině**, ale nesmí číst její docházku. Stejně tak může mít právo **vidět stav příspěvků vlastních dětí**, ale ne celou finanční evidenci. **Právo číst seznam osob, zápisy docházky, údaje o příspěvcích a obsah skupin je třeba vyhodnocovat odděleně.**

**Externista:** může být pověřen konkrétní operací, například pomocí s nácvikem, ale tím se nestává aktivním ani přijatým členem Vonice nebo formálním členem spolku Vonička. Funkce ve výboru má vlastní kontrolu způsobilosti, odlišnou od možnosti dostat pověření.

### 6.4 Ilustrační přístupová pravidla

| Akce | Kdo smí | Kdo nesmí automaticky |
|---|---|---|
| Omluvit dítě z nácviku Voničky II | Dítě se svým účtem (je-li dané jednání povoleno) nebo jeho platně oprávněný rodič | Rodič jiného dítěte |
| Zapsat skutečnou docházku Voničky II | Vedoucí nebo pomocník s pověřením v rozsahu II | Vedoucí III bez pověření pro II |
| Číst docházku Voničky III | Pověřený vedoucí/pomocník III; vlastní údaje dítěte dle pravidel účtu a zastupování | Vedoucí II jen proto, že vidí seznamy III |
| Zobrazit stav příspěvků dítěte | Hospodářka a vedoucí skupiny, do které dítě patří; vlastní rodinné údaje podle budoucích finančních pravidel | Libovolný vedoucí ostatních skupin |
| Půjčit kroj dítěti z Voničky I | Pověřená osoba pro společný sklad; držitelem je dítě | Rodič jako implicitní držitel |
| Spravovat kroje Malé Vonice | Pověřená krojařka s příslušným rozsahem | Krojařka jiné složky bez pověření |
| Číst skrytý výborový chat | Členové skupiny podle její viditelnosti | Technický správce jen z titulu své funkce |

**Důsledky pro server:** každé čtení i každý zápis kontrolovat na backendu; seznamová API filtrovat a vracet potřebná pole či agregace. Nestačí poslat vše do Angularu a až tam skrýt políčka. Oprávnění se mají ověřovat i při delegaci a při změně skupiny či příslušnosti.

## 7. Konkrétní scénáře pro akceptační testy

Tyto testy jsou **cílové chování**, nikoliv tvrzení, že je dnešní aplikace už umí.

1. **Vonica — více složek:** osoba je tanečnicí dospělé Vonice, vede Malou Vonicu a zpívá v Děvčicích. Má jednu identitu, více příslušností a různá oprávnění; nevzniknou tři kopie osoby.
2. **Vonica — zájemce:** nováček chodí na nácviky a má docházku, ale není aktivním členem, nemá automatické hlasovací právo ani pověření. Pozdější přechod mezi stavy nemaže historii.
3. **Vonička — dva sourozenci:** rodič má vlastní účet a může omluvit každé ze dvou dětí; jejich docházka se nikdy neslije. Jeden předpis/úhrada pro sourozence patří do finanční agendy, nikoli do tabulky účtů.
4. **Vonička — dvě oprávněné osoby:** oba rodiče mohou jednat za jedno dítě. V historii je rozlišeno, který z rodičů provedl kterou změnu.
5. **Vonička — starší dítě:** dítě ze III má vlastní účet; rodič může mít souběžné zastupování. Jejich přístupové možnosti se určují explicitně, nesdílejí přihlašovací údaje.
6. **Vonička — dvě skupiny:** dítě navštěvuje II i III. Pro každý nácvik existuje jediný záznam docházky příslušný konkrétní akci, bez duplicity za kluky/holky.
7. **Vonička — oddělení práv:** vedoucí II vidí seznam dětí III, ale ne jejich docházku, nemůže je omlouvat a nevidí jejich platby. Pomocník II zapisuje docházku jen II.
8. **Vonica — mezisložkový kroj:** krojařka s odpovídajícím pověřením zapůjčí kroj člověku z jiné složky. Výpůjčka odkazuje na jednu osobu; nezpřístupní jí automaticky ostatní údaje této osoby.
9. **Externista:** člověk bez příslušnosti ke složce může být pozván na vystoupení, dostat úkol či výpůjčku, případně vlastní účet s omezeným pověřením; není tím kooptován do výboru.
10. **Ztráta oprávnění:** po ukončení členství nebo zastupování už osoba nemůže nově číst nebo měnit chráněná data. Historické záznamy a audit zůstávají zachovány.

## 8. Dopad na současný Angular model

| Dnes | Návrh | Poznámka k migraci |
|---|---|---|
| `Member { id, userId=id, ensembleId=1, isExternal, isActive, groupIds, groupIntervals }` | `Person` + `UserAccount` + `UnitAffiliation` + `GroupMembership` | **Nejdůležitější změna před backendem.** V přechodné vrstvě lze zachovat některé názvy metod a existující komponenty. |
| `User` odvozený z `Member` | Účet a přihlášená relace oddělené od osoby | Neukládat do klientské session trvale oprávnění jako zdroj pravdy. |
| `functionTitle` jako jeden text | Více `PositionAssignment` s historií | Nesmí se zaměňovat s pověřením. |
| `Mandate.memberId` a skupinové/akční rozsahy | `Mandate` vázaný na osobu; přidán případný rozsah složky a oddělená agendová čtecí oprávnění | Zachovat existující čisté predikáty, rozšířit jejich vstupy. |
| Krojové `ExternalPerson` a souborové `Member.isExternal` | Jedna `Person`, i bez účtu/příslušnosti | Při migraci slučovat osoby **jen po ověření**; stejné jméno nestačí. |
| RSVP/docházka vedené přes `memberId` a „odpovídám za sebe“ | Záznam se vztahuje k osobě; změna má zvlášť aktéra | Vhodná jedna první integrační ukázka: rodič omluví dítě. |
| Jeden `EnsembleSettings`, `ensembleId=1` | Konfigurace samostatné instalace + její složky | Vlastní databáze instalací; není třeba celosystémový tenant-switcher. |

**Očekávaný postup v kódu:** nejdřív zjistit všechna místa závislá na `Member`, `memberId`, `userId`, `groupIds`, `isExternal`, `isActive` a `ensembleId`. Pak navrhnout kompatibilní přechod a provádět změny po modulech; neopravovat současně stylování, navigaci ani nesouvisející komponenty.

**Důležité:** budoucí PHP API má být jedinou autoritou pro přihlášení, autorizaci, změny členství a integritu vazeb. Mock služby mohou při prototypování používat stejné logické kontrakty, ale nesmějí být bezpečnostním opatřením produkce.

## 9. Předběžný plán implementačních iterací

1. **Doménová revize (tento dokument):** potvrdit názvy a hranice entit, zejména složka × skupina, příslušnost × členství ve spolku, rodičovské zastupování a funkce × pověření.
2. **Audit aktuálního kódu (bez změn):** Claude Code vypíše konkrétní dotčené modely, služby, komponenty, import/seed, testy a místa kontroly oprávnění; návrh migračního pořadí.
3. **Čistý model + testy:** implementovat nové typy a predikáty v samostatné vrstvě, vytvořit testovací údaje reprezentující obě organizace; zatím bez přepisu všech obrazovek.
4. **Malý funkční průřez:** osoba / účet / zastupování → jedna akce → odpověď nebo omluva dítěte → bezpečný záznam aktéra a subjektu.
5. **Postupná migrace:** skupiny, správa osob, kroje, komunikace. Změny proti současnému UI provádět jen tam, kde je nový model potřebuje.
6. **Backend design:** z ověřených vztahů odvodit relační schéma a REST kontrakty; zároveň navrhnout serverové filtrování a audit. Teprve pak zahájit jejich implementaci.

**Podmínka dokončení této fáze:** scénáře z kapitoly 7 jsou jednoznačně vyjádřitelné novým modelem, aniž by se pro jednu instalaci zaváděly nezdůvodněné výjimky v kódu.

## 10. Otevřené otázky a vědomě odložená rozhodnutí

### Potřebujeme potvrdit před definitivním uzavřením modelu

1. **Muzikanti Vonice:** jsou přidružení muzikanti z hlediska aktivního členství a hlasovacího práva posuzováni stejně jako tanečníci, nebo zvlášť? Ověřuje se; model nesmí předjímat odpověď.
2. **Způsobilost k funkci ve výboru:** potvrzené pravidlo Vonice je „aktivní + přijatý člen“, ale detaily přidělování a historických výjimek zatím nepřepisujeme do rigidní sady validačních pravidel. U Voničky je právní členství samostatný institut.
3. **Rozsah rodičovského zastupování:** víme, že se rodiče podílejí na omluvách a přihlašování na akce. Podrobné možnosti čtení osobních údajů, ukončení/ověření zastupování a přístup k údajům o platbách vyžadují samostatná bezpečnostní rozhodnutí před produkčním nasazením.
4. **Historická data a identity:** při importu reálných osob může být více záznamů jednoho člověka. Návrh nesmí automaticky spojovat osoby jen podle shody jména, přezdívky nebo e-mailu.

### Záměrně mimo tuto iteraci

- **Rodiny a sourozenecké slevy:** samotný vztah rodič–dítě není dostatečná definice jedné rodiny pro výpočet příspěvků. Případné `Family` / `Household` bude řešit až návrh financí, nikoli autentizace.
- **Ankety zájmu a nominace:** patří do dalšího návrhu akcí; již nyní ale musí být možné evidovat účast osoby odlišně od účtu jednajícího za ni.
- **Úkoly, dotace a jiný majetek:** budoucí agendy; mohou odkazovat na `Person`, `Unit`, `Group` a `Event` bez nového registru lidí.
- **Přímé zprávy, push a e-mail:** ani zastupování dítěte automaticky nezakládá přístup k jeho soukromé komunikaci.
- **Vlastní registrace a správa souhlasu nezletilých:** dopracovat před případným otevřením produkčního přihlašování rodičům a dětem; neřešit spekulativně v první mock iteraci.

## 11. Podklady

- `vonica(1).md` — popis Vonice, verze 2, stav k říjnu 2026.
- `vonicka.md` — souhrnný popis Voničky sestavený ze zápisu členské schůze a následných upřesnění.
- `Zápis z členské schůze 2026.doc` — autentický zápis členské schůze Voničky z 28. 7. 2026; především formální členství, skupiny, příspěvky, majetek a organizace akcí.
- `00-index.md`, `02-domenovy-model.md`, `03-opravneni.md`, `07-sprava-clenove-a-prehled.md`, `08-souhrn-zjisteni.md` — dokumentace **aktuální implementace** aplikace k 21. 10. 2026.

---

**Pracovní závěr:** nejprve oddělit osobu, účet, příslušnosti a zastupování; zachovat stávající koncept skupin a pověření; teprve potom rozhodovat o konkrétních databázových tabulkách a změnách Angular služeb. Jedna kódová základna ano, společná databáze nebo univerzální multi-tenant framework ne.
