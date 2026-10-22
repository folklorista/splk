# Souborový systém – plán architektonického experimentu

> **Status:** návrh (B). Dokument se označuje jako „schválený postup prací“, schválení ale není doloženo (Q-12). Organizační model a identita jsou mezitím rozhodnuté (D-06, D-07) a prioritou je Krojařka (D-02). Pořadí etap je proto otevřené. Podklady, na které odkazuje, jsou dnes v `docs/current/identity-model-v2.md`, `docs/context/` a `docs/archive/implementace-2026-10-21/`.

**Oblast:** Identita, členství, organizační struktura a oprávnění  
**Stav:** Schválený postup prací; konkrétní datový model podléhá samostatné revizi  
**Podklady:** Popisy fungování souborů Vonica a Vonička, dokumentace současné implementace SPLK  
**Výchozí dokument návrhu:** `identity-model-v2.md`

## 1. Cíl a východiska

Před implementací PHP backendu ověřit, že **jedna společná kódová základna** Souborového systému dokáže správně obsloužit dvě organizačně odlišné folklorní organizace:

- **Vonica** – dospělá taneční složka, Malá Vonica, Děvčice z Vonice a spolupracující muzika; překrývající se členství, funkce a pověření.
- **Vonička** – samostatný dětský folklorní spolek se skupinami I–III; rodiče zastupují děti, starší děti mohou používat vlastní účet, existuje zvláštní formální členství ve spolku.

Obě organizace mají mít **samostatnou instalaci, databázi, uživatelské účty, oprávnění a konfiguraci**. Experiment nepočítá se společnou databází ani přepínáním mezi instalacemi v jednom účtu. Malá Vonica je složkou souboru Vonica, nikoliv samostatnou Voničkou.

Existující Angular demo již obsahuje funkční moduly a nechceme je zbytečně přepisovat. Potřebujeme ale odstranit předpoklady současného modelu, které by při připojení backendu nebo při použití ve Voničce selhávaly – především spojení fyzické osoby, uživatelského účtu a členství do jediného objektu `Member`.

### Zásady postupu

1. **Nejdřív ověřit pravidla, potom programovat.**
2. **Dělat malé změny:** zachovat existující architekturu a funkční části aplikace, kde to dává smysl.
3. **Ověřovat na reálných scénářích** z obou souborů, nikoliv na hypotetickém univerzálním spolku.
4. **Nezačínat backendem ani velkým refaktoringem Angularu.**
5. **Oddělovat doménový model od uživatelského rozhraní.** Například rozdělení docházkového seznamu na kluky a holky je způsob zobrazení, ne důvod pro dvě akce.
6. **Každou etapu dokončit a vyhodnotit** před zahájením další.

## 2. Pět etap experimentu

### Etapa 1 – Pravidla identity a testovací scénáře

**Bez programování.** Převést zjištění z popisů Vonice a Voničky do jednoznačných pravidel:

- kdo je fyzická osoba a kdo má uživatelský účet;
- jak se eviduje příslušnost k souborové složce a skupině;
- jak se liší aktivní člen, zájemce, externista a bývalý člen;
- jak funguje rodičovské zastupování;
- kdo smí vidět, spravovat a měnit konkrétní údaje;
- jak se liší formální členství ve spolku od provozní účasti v souboru.

**Výstup:** odsouhlasený Markdown dokument s pravidly a ověřovacími scénáři. Na tento krok navazuje návrh `identity-model-v2.md`.

### Etapa 2 – Návrh doménového modelu

Připravit konkrétní TypeScript rozhraní, vztahy a omezení. Každý pojem musí mít vysvětlený účel a vazbu na skutečné použití. Nejde ještě o finální databázové tabulky.

Pracovní pojmy modelu:

| Pojem | Význam |
|---|---|
| `Person` | Fyzická osoba, nezávislá na existenci přihlašovacího účtu |
| `User` | Účet používaný k přihlášení konkrétní osoby |
| `Unit` | Organizační složka, například Malá Vonica |
| `Group` | Organizační nebo komunikační skupina v rámci souboru |
| `Membership` | Příslušnost osoby, její stav a případná historie |
| `Representation` | Oprávnění jednat za jinou osobu, typicky rodič za dítě |
| `Mandate` | Konkrétní pověření s určeným rozsahem |
| Formální členství ve spolku | Právní členství a případné hlasovací postavení, odlišné od taneční účasti |

**Důležité:** jde o logické pojmy, nikoliv předem schválený seznam osmi tabulek. Návrh se má zjednodušovat tam, kde by samostatná entita nepřinášela skutečnou hodnotu.

**Výstup:** revidovaný doménový model a jeho TypeScript kontrakty.

### Etapa 3 – Ověření na mock datech a automatických testech

Ve vývojové větvi připravit reprezentativní data pro **samostatnou instalaci Vonice** a **samostatnou instalaci Voničky**. Nejdříve testovat vztahy, rozhodování o oprávněních a jednání za jinou osobu **bez tvorby nových obrazovek**.

Zvlášť ověřit, že účet rodiče, osoba dítěte, členství ve skupině a záznam docházky nejsou zaměňovány. Automatické testy mají zachytit i nepovolené čtení či změny dat.

**Výstup:** sada testů, která dokládá správné chování obou organizací a slouží jako ochrana při následných změnách.

### Etapa 4 – Malé zapojení do frontendu

Ověřený model zapojit postupně do omezené části současné aplikace:

1. správa osob a skupin;
2. přihlášení a určení identity aktuálního uživatele;
3. jeden konkrétní scénář omluvení či potvrzení účasti dítěte rodičem.

Teprve potom postupně přizpůsobovat ostatní moduly. Není cílem najednou vytvořit kompletní druhý frontend Voničky.

**Výstup:** funkční prototyp využívající nový model, při zachování stávajícího dema a maximálním využití existujícího UI.

### Etapa 5 – Návrh MariaDB schématu a PHP API

Až bude doménový model ověřen:

- navrhnout relační tabulky a cizí klíče;
- definovat REST kontrakty;
- navrhnout autentizaci a správu relací;
- prosadit oprávnění a filtraci citlivých údajů **na serveru**;
- připravit postupný převod mock služeb na HTTP služby;
- vyřešit přechod existujících dat a zachování integrity odkazů.

Backend nesmí pouze kopírovat dnešní chování mock služeb včetně nedostatečné autorizace.

**Výstup:** implementační zadání PHP backendu a databáze; následně postupná implementace po modulech.

## 3. První ověřovací scénáře

Jde o původní sadu osmi scénářů pro experiment. Podrobný návrh identity ji může dále rozšířit.

1. **Vonica – více složek:** jedna osoba současně působí ve třech souborových složkách a v každé má jiné kompetence.
2. **Vonica – zájemce:** zájemce dochází na nácviky, ale ještě není aktivním členem; nesmí automaticky získat všechna členská práva.
3. **Vonička – dva sourozenci:** rodič omluví jedno ze svých dvou dětí; každé dítě má vlastní docházku.
4. **Vonička – samostatné starší dítě:** dítě ze skupiny III se přihlásí vlastním účtem a odpoví na akci; oprávněný rodič za něj může také jednat.
5. **Vonička – rozdílná oprávnění:** vedoucí II vidí jména dětí ve III, nikoliv jejich docházku; jeho pomocník má oprávnění jen pro II.
6. **Vonička – více skupin:** jedno dítě navštěvuje II i III a má oddělenou docházku pro jednotlivé nácviky obou skupin.
7. **Vonička – finanční soukromí:** hospodářka eviduje příspěvky sourozenců, ale vedoucí skupiny vidí finanční stav pouze u dětí, které vede.
8. **Vonica – zápůjčka napříč složkami:** krojařka zapůjčí krojovou součástku osobě z jiné složky, aniž by získala přístup k jejím ostatním citlivým údajům.

**Doplňující pravidlo docházky:** v rámci jednoho nácviku Voničky II existuje jeden seznam docházky; rozdělení na kluky a holky je pouze prezentační pomůcka pro rychlé vyplňování.

## 4. Rozdělení odpovědností

### Doménová rozhodnutí

**Zadavatel / znalec provozu obou souborů:**

- posuzuje, zda návrh odpovídá skutečnému fungování Vonice a Voničky;
- potvrzuje význam jednotlivých pojmů, procesů a oprávnění;
- schvaluje případné změny rozsahu.

### Architektonická příprava

**ChatGPT:**

- připraví návrh doménového modelu, vysvětlení vztahů a testovací případy;
- porovná návrh se známou dokumentací aktuální implementace;
- vytváří omezená, konkrétní zadání implementačních kroků;
- upozorňuje na rizika pro existující funkcionalitu.

### Práce se zdrojovým kódem

**Claude Code** (s přístupem k repozitáři):

- před změnami provede analýzu konkrétních závislostí stávajícího modelu;
- zejména vyhledá předpoklad `Member.userId === Member.id` a podobné vazby;
- navrhne nejmenší bezpečný zásah;
- implementuje změny a automatické testy po malých krocích;
- nepřistupuje k plošnému refaktoringu bez samostatného schválení.

**První zadání pro Claude Code je pouze analýza dopadů – bez úprav kódu.**

## 5. Hranice experimentu

Do prvního experimentu **nepatří**:

- kompletní implementace PHP backendu;
- kompletní druhá verze frontendového rozhraní pro Voničku;
- plošné přepisování současných modulů;
- sdílení dat nebo uživatelských účtů mezi Vonicou a Voničkou;
- realizace plnohodnotného účetnictví, repertoáru, úkolů a dalších rozšíření;
- nasazení neověřených změn do provozního dema.

Tyto funkce mohou být důležité v dalších etapách projektu, ale **nesmějí odvádět pozornost od ověření identity a organizačního modelu**.

## 6. Kontrolní body a kritérium úspěchu

| Kontrolní bod | Co musí být ověřeno před pokračováním |
|---|---|
| Po etapě 1 | Pravidla z obou souborů jsou zdokumentovaná a neodporují známým procesům |
| Po etapě 2 | Každá entita má jasný účel, vztahy jsou vysvětlené, otevřené otázky jsou označené |
| Po etapě 3 | Scénáře pro oba soubory procházejí automatickými testy, včetně zamítaných nepovolených operací |
| Po etapě 4 | Vybraný průchod UI funguje, bez nežádoucího narušení dosavadních modulů |
| Před etapou 5 | Je možné odvodit konzistentní relační model a vynucovat oprávnění na backendu |

**Experiment bude úspěšný, pokud prokáže, že společný doménový model obslouží obě organizace bez speciálních výjimek natvrdo zabudovaných pro Vonicu či Voničku, a současně nevyžaduje zbytečné přepisování funkčního dema.**

## 7. Bezprostřední další krok

1. Provést doménovou revizi návrhu `identity-model-v2.md`.
2. Uzavřít základní vztahy `Person`, `User`, `Membership`, `Unit`, `Group`, `Representation` a `Mandate`.
3. Připravit **analytické zadání pro Claude Code**: vyhledat vazby dnešního kódu na starý model a popsat dopad změn; zatím **nic neimplementovat**.
4. Na základě analýzy připravit nejmenší implementační iteraci a testy.

---

> **Hlavní princip:** Nejde o vybudování co nejobecnějšího spolkového systému. Jde o bezpečné odstranění omezení současného modelu tak, aby jedna udržovatelná aplikace správně sloužila dvěma různým souborům.
