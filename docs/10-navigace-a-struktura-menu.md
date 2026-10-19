# 10 – Navigace, struktura menu a přehled aplikace

> Stav: pracovní návrh k připomínkování, nikoliv finální specifikace implementace.
> Navazuje na `00-prehled.md`, `02-core-a-moduly.md`, `03-postup-vyvoje.md`, `04-styl-prace.md`, `07-souborovy-system-vize-funkce-roadmapa.md`, `08-skupiny-opravneni-a-komunikace.md` a `09-soukrome-zpravy-dm-a-sifrovani.md`.
> Cíl: popsat informační architekturu aplikace, všechny uvažované navigační cesty a pravidla jejich sjednocení pro mobil, tablet i desktop.
> Revize 2026-10-18: strom porovnán s aktuálním kódem (větev `feature/wardrobe-inventories`), doplněna sekce Správa, výhledové oblasti, osobní spodní lišta a sjednocené názvosloví krojů.

> **Konsolidace 18. 10. 2026:** Schválené cílové chování zahrnuje přepínání samostatných folklorních souborů, **globální osobní přehled napříč soubory**, rodičovské jednání za dítě, přihlášení více účtů na sdíleném zařízení, globální „Moje kroje“ včetně externích zápůjček, konfigurovatelné kalendářové odběry, skupinové přílohy a offline read-only. **Nejde o potvrzení hotového UI**; implementované routy níže jsou historickým snímkem k 18. 10. 2026.

## 1. Proč je potřeba navigaci řešit samostatně

Aplikace nebude mít jen několik nezávislých obrazovek. Stejný obsah lze otevřít z více kontextů:

- akci z přehledu, kalendáře, skupiny, vyhledávání či sezónního rozcestníku,
- příspěvek z nástěnky skupiny, přehledu (připnutá oznámení), chatu nebo vyhledávání,
- úkol z osobního seznamu, akce, skupiny nebo Správy krojů,
- konverzaci ze skupiny, konkrétní akce, soukromých zpráv nebo společného seznamu zpráv,
- krojovou součástku z vlastní krojové karty, skladu, krojové karty člena, výpůjček nebo inventury,
- osobu ze seznamu členů skupiny, účastníků akce, krojové karty nebo Správy.

Navigace proto musí odlišovat **strukturu hlavních oblastí**, **kontext konkrétního objektu** a **lokální pracovní kroky**. Nesmí vést k tvorbě několika různých detailů téže entity.

Zásady:

1. **Mobile-first:** hlavní operace člena musí být snadné na telefonu, bez zbytečného procházení menu.
2. **Konzistentní princip:** stejné typy podstránek se mají ovládat stejně napříč moduly (seznam → detail → úprava; záložky; nastavení modulu vždy jako poslední záložka).
3. **Nepřetěžovat hlavní menu:** úplný strom obrazovek není seznam všech položek primární navigace.
4. **Jeden objekt, jedna kanonická adresa, více vstupních cest:** opakovaně využívat stejné detaily akcí, úkolů, příspěvků, součástek a osob.
5. **Respektovat kontext a pověření:** zobrazovat oblasti podle skutečných pověření (docs/08), ne podle „rolí“.
6. **Stabilní navigační kostra:** aktuální sezónní dění ani nové skupiny nesmí uživateli přeskládat menu, které si sám nastavil.
7. **Iterativní ověřování:** třetí úroveň menu ani URL nefixovat bez prototypu a připomínek.
8. **Běžný člen nesmí platit za složitost agend.** Správa krojů, Docházka a Správa souboru jsou pracovní nástroje několika lidí; jejich hloubka se nesmí propsat do menu člena, který jen potvrzuje účast a čte nástěnku.
9. **Důležité věci do tří klepnutí.** Běžný člen nemá procházet mezivrstvu (např. rozcestník Skupiny), pokud se jeho místa vejdou přímo do lišty.
10. **Vždy cesta zpět k nastavení.** Nastavení a Profil jsou v hlavičce a nelze je odebrat. Přehled je pevný a slouží jako záložní rozcestník.

## 2. Stav rozhodnutí a značení

Dokument kombinuje výslovné požadavky, návrhy z diskuse a skutečný stav kódu.

- **✅** – v prototypu implementováno (mock data, frontend).
- **◐** – implementováno částečně nebo v jiné podobě, než strom popisuje.
- **Bez značky** – pojmenovaná oblast nebo přirozená součást toku; zatím neexistuje.
- **`[?]`** – návrh nebo detail, který ještě nebyl odsouhlasen.
- **`→`** – odkaz na existující typ detailu či modul; neznamená vytváření druhé kopie obrazovky.
- **`(pověření)`** – dostupnost závislá na pověření, členství nebo skupině; konkrétní pověření je uvedeno, pokud je známé.

Pověření, se kterými kód pracuje (`mandate.model.ts`, docs/08 kap. 3):

| Pověření | Rozsah | Otevírá |
| --- | --- | --- |
| Správa souboru | soubor | Správa (osoby, skupiny, pověření, konfigurace, historie) – **bez čtení obsahu soukromých skupin** |
| Hlavní správce / spolusprávce skupiny | skupina | záložka Správa ve skupině |
| Organizace akcí | soubor / skupina / akce | zakládání a úprava akcí |
| Evidence docházky | soubor / skupina / akce | skutečná docházka, přehled Docházka |
| Správa krojů (= krojařka) | soubor | Správa krojů včetně zápisu |
| Náhled do krojárky → přejmenovat na **Náhled do správy krojů** | soubor | Správa krojů jen ke čtení |

## 3. Úrovně navigace

| Úroveň | Úloha | Příklady | Orientační podoba |
| --- | --- | --- | --- |
| 1. Globální | Přepínání hlavních oblastí | Přehled, Akce, jednotlivé skupiny, Moje kroje, Správa krojů, Správa | Mobil: spodní lišta (Přehled pevně + 4 volitelné pozice, příp. „Více“); desktop: sidebar |
| 2. Kontextová | Část oblasti nebo objektu | Akce: Seznam / Kalendář; skupina: Chat / Nástěnka / Členové / Správa; Správa krojů: Sklad / Krojové karty / Výpůjčky / Inventury / Nastavení | Záložky pod titulkem, přepínače |
| 3. Detailní / procesní | Detail položky nebo krok práce | Inventura → režim Ve skladu → evidenční řada | Detail, filtr, **pracovní režim** (celá obrazovka s postupem), ne třetí řada záložek |

Tři úrovně jsou **mentální model**, nikoliv povinnost vykreslit tři souběžná menu. Na jedné obrazovce mají být vidět nejvýš **dvě** navigační lišty (globální + kontextová).

## 4. Úplný pracovní navigační strom

Seznam obsahuje i obrazovky dosažitelné jen ze souvisejících míst, nejen přímé položky menu. U implementovaných částí je uvedena skutečná route (bez prefixu `/app`).

### 4.1 Přehled ✅ `/dashboard`

- **Přehled**
  - **Čeká na vás** ✅ – jeden seznam povinností napříč moduly (kap. 7.2)
    - Pozvánky do skupin ✅ → Skupiny
    - Žádosti o členství ke schválení (správci skupin) `[?]` → Skupina → Správa
    - Nepotvrzené účasti ✅ → Akce
    - Inventurní výzva / rezervace termínu `[?]` → Moje kroje
    - Výpůjčka po termínu vrácení `[?]` → Moje kroje
    - Docházka k zapsání po akci (pověření Evidence docházky) `[?]` → Detail akce
    - Úkoly po termínu a úkoly k přijetí `[?]` → Detail úkolu (kap. 4.9)
    - Dotaz na dostupnost k poptávce vystoupení, otázka / anketa k akci `[?]` → Detail akce (kap. 4.10)
    - Retenční varování soukromé konverzace (správci konverzace) `[?]` → Zprávy (kap. 4.8)
  - **Nejbližší akce** ✅
    - Rychlá odpověď **Přijdu / Nepřijdu / Možná** ✅ (řádek RSVP)
    - → Detail akce ✅
    - → Všechny akce v kalendáři ✅
  - **Připnutá oznámení** ✅ → Detail příspěvku
  - ~~Moje kroje (kompaktní karta)~~ – z Přehledu odebráno 19. 10. 2026; upozornění na kroje (inventura, vrácení) jsou v „Čeká na vás“
  - **Novinky z mých skupin** `[?]` – nepřečtené zprávy a příspěvky; dnes jen jako badge v menu
  - **Moje úkoly** `[?]` (až s modulem Úkoly)
  - **Aktuální sezónní téma** `[?]` → zastřešující akce (kap. 4.10)
  - ~~Moje místa~~ – odebráno 19. 10. 2026; záložní cestou ke všem místům je ikona **Více** v mobilní hlavičce (`/more`)
    - Upravit lištu → Nastavení → Spodní lišta

### 4.1a Globální osobní přehled a přepnutí kontextu `[?]`

- Přehled „Moje“ sbírá **moje relevantní akce, čekající odpovědi, upozornění a osobní kroje** napříč folklorními soubory, ke kterým mám odpovídající vztah. Naopak správa, chaty, skupiny, inventury a souborové dokumenty se zobrazují ve **zvoleném souborovém kontextu**.
- V hlavičce nebo osobním menu **přepínač souboru** (Dospělá Vonica / Malá Vonica). Nepřidává členství do cizího souboru. Přímý odkaz na akci jiného souboru otevře její správný kontext; cílová URL s explicitním identifikátorem souboru je **návrh k ověření, nikoli hotová route**.
- **Přepnutí přihlašovacího účtu** (rodinný počítač) je oddělená osobní funkce, ne přepnutí souboru. Stejně odlišné je **jednání rodiče za dítě**: rodič zůstává přihlášený pod svou identitou a potvrzuje účast dítěte s jasně zaznamenaným aktérem.
- Notifikace se přijímají **napříč soubory**, i když je zobrazen jiný kontext; každá má označení původu.

### 4.2 Akce ✅ `/events` (modul Akce a docházka)

- **Akce**
  - **Seznam** ✅ (`?view=list`)
    - Nadcházející ✅, pod nimi sbalené **Uplynulé** ✅
    - Filtry: typ akce ✅, moje odpověď ✅, skupina `[?]`
  - **Kalendář** ✅ (`?view=calendar`; výchozí pohled si člen nastaví v Nastavení)
    - Měsíc, přechod na Dnes ✅
    - Týden / agenda `[?]`
  - **Detail akce** ✅ `/events/:id?tab=…` – záložky **Detail** (informace, souhrn účasti) / **Účast** (moje odpověď, odpovědi členů; po skončení akce jen ke čtení) / **Chat** (jen s povoleným chatem akce) / **Docházka** (od začátku akce, jen s pověřením; nevyplnění nahoře podle nahlášené účasti, hromadné označení, filtr podle skupin) / **Zobrazení** (organizátoři)
    - Popis: název, termín, místo, popis, pokyny ✅
    - **Moje účast** ✅ – odpověď, poznámka, zrušení odpovědi
    - **Účast** ✅ – kdo přijde / nepřijde / neodpověděl; → Detail osoby `[?]`
      - štítek „nedostupný od–do“ u členů s dlouhodobou nedostupností v termínu akce ✅ – jen pro pověřené organizátory, informativní (nenahrazuje odpověď)
    - **Skutečná docházka** ✅ `(Evidence docházky)`
    - Komentáře k akci `[?]` – doporučení: nevytvářet nový typ chatu, viz kap. 8.1
    - Další sekce podle zapnutých **funkcí akce** `[?]` – Program, Otázky, Pobyt, Obsazení tanců, Úkoly, Kroje k akci, Doprava, Dokumenty a fotky (kap. 4.10)
    - → Napsat účastníkům `[?]` (kap. 4.8)
    - Úprava akce ✅ `/events/:id/edit` `(Organizace akcí)` – při volbě termínu upozornění „X členů cílových skupin je nedostupných“ ✅; druh změny drobná / důležitá / s potvrzením ✅
  - Nová akce ✅ `/events/new` `(Organizace akcí)` – předstih výzvy a měkká uzávěrka ✅, **opakovaná série** s předvyplněnými výjimkami ✅
  - Důležitá změna a zobrazení detailu ✅ – pruh v detailu, potvrzení přečtení, kdo otevřel po změně
  - Do kalendáře (.ics) ✅ – jedna akce z detailu, mé akce v Nastavení → Kalendář; průběžný odběr až s backendem
  - **Nastavení modulu Akce** `[?]` `(Organizace akcí v rozsahu souboru)` – kategorie/typy akcí, šablony akcí (docs/07 kap. 33). Dnes jsou kategorie jen v mock datech a žádná obrazovka je nespravuje.

#### Produktové doplnění akcí (18. 10. 2026)

- Otevření **detailu** akce aktualizuje jediné `last_viewed_at` (osoba × akce). Rychlé potvrzení účasti **ze seznamu** ho neaktualizuje. Organizátor u neodpovědivších pozná, kdo otevřel detail před/po důležité změně.
- Při úpravě vybrat **drobnou / důležitou / výjimečně výslovně potvrzovanou** změnu. Seznam nevyřízených účastí a badge se aktivují až po dosažení předstihu výzvy, nikoliv pro všechny dávno naplánované nácviky.
- Účast lze zadat ihned po vytvoření akce; standardní první výzva **nácvik 7 dní**, **vystoupení 14 dní**, s možností úpravy např. na 365 dní. Nepovinná **měkká uzávěrka** spustí opakovanou výzvu pro MOŽNÁ / BEZ ODPOVĚDI.
- Pravidelná série: generovat konkrétní termíny v omezeném období; předvyplnit prázdninové/sváteční výjimky jako **Vynecháno + důvod** s možností úprav před uložením. Nic nevytvářet mimo období série.
- V osobním Nastavení umožnit **iCalendar/ICS odběr typů akcí** (napříč soubory) a jednorázové `.ics`. Týdenní nácviky ve výchozím osobním odběru nepřenášet, ale umožnit „**NENÍ VONICA – důvod**“ pro výjimky v existující sérii. Jde o cílové obrazovky, ne současné route.

### 4.3 Docházka ✅ `/attendance` `(Evidence docházky)`

- **Docházka** – přehled skutečné docházky proběhlých akcí
  - Filtry, export CSV ✅
  - → Detail akce (zápis docházky) ✅
  - → Docházka jednoho člena `[?]` (také z detailu osoby ve Správě, docs/08 kap. 4.1)

Docházka je dnes samostatná položka hlavního menu jen pro pověřené. Doporučení viz kap. 6.2: je to běžné místo nabízené jen pověřeným; ve výchozí liště vedení buď přímo, nebo pod „Více“.

### 4.4 Skupiny ✅ `/boards`, `/boards/:slug`

- **Skupiny (rozcestník)** ✅ `/boards` – volitelné místo lišty; běžný člen ho nepotřebuje, má-li skupiny přímo v liště (kap. 6.2)
  - Moje skupiny ✅
  - Další dostupné skupiny (otevřené) – žádost o vstup ✅
  - Čekající pozvánky a žádosti ✅ (badge u položky Skupiny)
  - Založit skupinu ✅ `/groups/new` `(podle Konfigurace: Správa souboru nebo všichni členové)`
- **Prostor skupiny** ✅ `/boards/:slug?tab=…` (např. *Kluci*, *Holky*, *Muzikanti*)
  - **Chat** ✅ (`tab=chat`, pokud ho skupina má zapnutý)
    - Zprávy, zmínky, souhrnné karty komentářů k příspěvkům ✅
    - Režim upozornění skupiny (vše / zmínky / ztlumit) ✅
  - **Nástěnka** ✅ (`tab=board`, pokud je zapnutá)
    - **Detail příspěvku** ✅ `/posts/:id` – obsah, komentáře se zmínkami
    - Nový příspěvek ✅ `/boards/:slug/new`, úprava ✅ `/posts/:id/edit`
  - **Členové** ✅ (`tab=members`) → Detail osoby `[?]`
  - **Správa** ✅ (`tab=manage`) `(Hlavní správce / spolusprávce)` – stejný panel jako Správa → Skupiny → detail (kap. 4.7)
  - **Akce skupiny** ✅ (`tab=events`) – akce, které skupina pořádá nebo pro ni jsou; **stejný detail akce**, ne „skupinový typ akce“
  - **Dokumenty skupiny** `[?]`
  - Úkoly skupiny `[?]` (V2)

**Poznámka k URL:** prostor skupiny leží na `/boards/:slug` z doby, kdy skupina byla jen nástěnka. Doporučení: přejmenovat na `/groups/:slug` a `/boards` přesměrovat (viz kap. 10).

### 4.5 Moje kroje ✅ `/costumes` (modul Kroje, každý člen)

- **Moje kroje** – osobní krojová karta, jen ke čtení ✅
  - Zapůjčené kusy seskupené podle regionu/typu ✅ (druh, region, varianta, evidenční řada a číslo)
  - Termíny vrácení ✅
  - **Inventurní výzvy** ✅ – přihlášení na termín návštěvy, zrušení rezervace
  - Historie mých výpůjček `[?]`
  - Požadavek na kroj (k akci, výměna velikosti, oprava) `[?]` → vzniká pracovní úkol ve Správě krojů

Člen výpůjčky sám nepřepisuje; vše mění krojařka.

### 4.6 Správa krojů ✅ `/wardrobe` `(Správa krojů = zápis, Náhled = čtení)`

> **Názvosloví:** v UI dnes „Krojárna“ – tento pojem soubor nepoužívá, nahradit (kap. 11.1). **Krojařka** = osoba s pověřením Správa krojů. **Sklad** = místnost, kde leží nezapůjčené kroje.

Skutečná podoba se liší od původního návrhu (Součástky / Komplety / Lidé). Komplety nejsou samostatná evidence, ale **šablona v Nastavení**; „Lidé“ se jmenují **Krojové karty**.

- **Správa krojů**
  - **Součástky** ✅ `/wardrobe/stock` – všechny fyzické kusy podle evidenčních řad (dříve záložka „Sklad“; „ve skladu“ je jen umístění kusu a režim inventury)
    - Filtry podle klasifikace (druh, region, varianta, pohlaví), tisk, export CSV ✅
    - **Detail kusu** ✅ `/wardrobe/stock/:id`
      - Stav, umístění, aktuální držitel / zápůjčka
      - Historie držení, změny a pohyby
      - Inventurní kontroly
      - Pracovní úkoly (oprava, úprava) – založit, rozpracovat, dokončit, zrušit ✅
      - Vyřadit kus ✅
    - Nový kus ✅ `/wardrobe/stock/new`, úprava ✅ `/wardrobe/stock/:id/edit`
  - **Krojové karty** ✅ `/wardrobe/cards` – kdo má co zapůjčeno
    - Karta osoby ✅ `/wardrobe/cards/:key` – vydat, vrátit, vyměnit kus, úkol
      - Výchozí kroj osoby (mužský / ženský / neurčeno) ✅ – výběr kusu při vydávání primárně nabízí odpovídající součástky, „zobrazit všechny kusy“ jedním klepnutím (`06` kap. 5.1a)
    - Externisté (držitelé mimo soubor) ✅
  - **Výpůjčky** ✅ `/wardrobe/loans` – jeden řádek = jeden kus u jednoho držitele; historie, export CSV
    - Nová výpůjčka ✅ `/wardrobe/loans/new`
  - **Inventury** ✅ `/wardrobe/inventories`
    - Přehled probíhajících a uzavřených ✅
    - **Nová inventura** ✅ `/wardrobe/inventories/new` – rozsah = průnik klasifikace × skupina, náhled, zmrazení rozsahu
    - **Detail inventury** ✅ `/wardrobe/inventories/:id`
      - Termíny návštěv a jejich kapacita ✅
      - Pracovní režim **Podle lidí** ✅ (`?tab=people`) → **Inventurní návštěva** `/inventories/:id/visit/:key` – předložení kusů, stav, vrácení/výměna/vydání během návštěvy, rekapitulace
      - Pracovní režim **Ve skladu** ✅ → **Evidenční řada** `/inventories/:id/stock/:seriesId` – číselná mřížka, rychlé zadávání čísel
      - Nesrovnalosti: nezkontrolované, nepředložené, poškozené / k úpravě ✅
      - Uzavření (vše ověřeno / s nesrovnalostmi), export výsledků ✅
  - **Nastavení** ✅ `/wardrobe/settings` – klasifikace (regiony, varianty), druhy součástek, evidenční řady, šablony kompletů, výchozí kapacita termínu inventury
  - Pracovní úkoly napříč fondem `[?]` – dnes jen v detailu kusu; chybí souhrnný seznam „co je v opravě“
  - Krojové požadavky k akcím `[?]` (docs/07 kap. 26)
  - Chat krojařek `[?]` – doporučení: **běžná skupina „Krojařky“** s chatem a nástěnkou, ne zvláštní chat modulu

**Rozhodnuto implementací:** inventura je **pracovní režim**, ne třetí úroveň záložek. Detail inventury je rozcestník, návštěva i evidenční řada jsou samostatné obrazovky s jasným krokem zpět na detail inventury. Doporučuji to zachovat a na mobilu v těchto obrazovkách skrývat spodní lištu (víc místa, méně omylů).

#### Sklad a osobní výpůjčky napříč soubory

„Moje kroje“ je osobní pohled napříč soubory: i zápůjčka **Z12 z Malé Vonice** se zobrazí člověku, který je členem pouze dospělé Vonice, **bez položky Malá Vonica v jeho přepínači**. Přímá osobní výpůjčka se v druhém skladu neduplikuje.

„Správa krojů“ je vždy **agenda jediného evidujícího souboru**. Kromě vlastních položek později přijme **cizí kroje do dočasné správy** s původními čísly a vazbou na zapůjčitele. Hromadné předání Malá Vonica → Vonica vznikne jako výdej z jednoho skladu a **samostatný** dočasný příjem do druhého; žádná automatická synchronizace mezi sklady není podmínkou.

### 4.7 Správa ✅ `/manage` `(Správa souboru)`

Správa = **jádro souboru**: osoby, skupiny, pověření, moduly a jejich audit. **Nedává** čtení obsahu soukromých skupin ani správu akcí, docházky a krojů (ty mají vlastní pověření a vlastní nastavení u svého modulu). Starý odkaz `/admin` přesměrovává sem.

- **Správa**
  - **Členové** ✅ `/manage/members`
    - Filtry: Aktivní členové / Externisté / Bývalí členové / Všichni ✅
    - Hledání podle jména, přezdívky, funkce ✅
    - **Nová osoba** ✅ `/manage/members/new`
    - **Detail osoby** ✅ `/manage/members/:id`
      - Osobní údaje: jméno, příjmení, přezdívka, e-mail, telefon ✅
      - Souborová funkce (kronikářka, ekonomka…) – jen informativní ✅
      - Výchozí kroj ✅ – stejný údaj jako na krojové kartě (`06` kap. 5.1a)
      - **Členství v souboru** – ukončit / obnovit aktivní členství (historie zůstává) ✅
      - **Skupiny** – přidat do skupiny / odebrat ✅ (sebe přidat nelze – ochrana soukromí skupin)
      - **Pověření** – přidělit / odebrat, s rozsahem soubor / skupina / akce ✅; přechodná pověření označená ✅
      - **Náhled skutečných přístupů** ✅ – co člověk reálně uvidí a smí
      - Statistiky docházky a účasti `[?]` → Docházka (citlivé, jen s pověřením Evidence docházky)
      - Krojová karta osoby `[?]` → Správa krojů → Krojové karty (jen s pověřením ke krojům)
      - Pozvat do aplikace / obnovit přístup `[?]` (až s backendem a přihlašováním)
    - Hromadný import osob (CSV) `[?]`
    - Export seznamu / adresáře `[?]`
  - **Skupiny** ✅ `/manage/groups` – provozní metadata všech skupin, bez přístupu k obsahu
    - **Nová skupina** ✅ `/manage/groups/new` (název, slug, hlavní správce)
    - **Detail skupiny** ✅ `/manage/groups/:id` = sdílený panel správy skupiny
      - Nastavení: název, slug, popis, ikona, viditelnost (soukromá / otevřená / skrytá), chat a nástěnka zap/vyp, výchozí záložka ✅
      - Členové a role: hlavní správce, spolusprávce, předání hlavní správy ✅
      - Přidat hned / pozvat ✅
      - Čekající žádosti a pozvánky – schválit, zamítnout, zrušit ✅
      - Historie skupiny ✅
      - **Archivovat / obnovit skupinu** ✅ – jen ke čtení, bez notifikací, mimo lištu (docs/08 kap. 10.5)
      - **Smazat skupinu** ✅ – **jen archivovanou skupinu**, po výslovném potvrzení, správcem souboru. Odstraní výlučný obsah skupiny, ne evidenci krojů, docházku ani přílohy používané jinde
  - **Pověření** `[?]` – přehled „kdo co smí“ napříč souborem (dnes jen v detailu každé osoby)
    - Seznam podle druhu pověření: kdo spravuje kroje, kdo eviduje docházku, kdo organizuje akce, správci skupin
    - Přechodná pověření k vyřešení
    - Kontrola „bez pojistky“: varování, když nikdo jiný nemá Správu souboru nebo skupina nemá hlavního správce
  - **Konfigurace** ✅ `/manage/config`
    - Název souboru ✅
    - **Moduly**: Akce a docházka, Kroje a krojová evidence ✅ (popisek v UI dnes „Kroje a Krojárna“ – upravit) (vypnutý modul zmizí z menu všem, data zůstanou)
    - **Kdo zakládá skupiny**: jen Správa souboru / všichni aktivní členové ✅; „člen navrhne, správce schválí“ později
    - **Výchozí nastavení nové skupiny**: viditelnost, výchozí záložka, chat, nástěnka ✅
    - **Seskupování komentářů v chatu**: od kolika komentářů, max. pauza ✅
    - Souborové funkce jako číselník `[?]` (dnes volný text)
    - Informace o pravidle retence soukromých konverzací (12 měsíců + 60 dní, docs/09 kap. 5) – jen ke čtení; o zachování rozhoduje správce konverzace, **ne Správa souboru**
    - Logo a barvy souboru `[?]`
  - **Historie** ✅ `/manage/history` – audit změn
    - Filtry: Vše / Osoby / Členství, žádosti, pozvánky / Pověření / Skupiny a konfigurace / Mimořádné zásahy ✅
    - Moderace obsahu a změny akcí sem nepatří – jsou v historii skupin ✅
  - **Ochrana údajů** `[?]` (s backendem)
    - Export osobních údajů osoby
    - Anonymizace bývalého člena (při zachování historie zápůjček a docházky)

**Pravidlo pro budoucnost:** nastavení odborného modulu patří **do modulu** jako jeho poslední záložka (Správa krojů → Nastavení, Akce → Nastavení `[?]`), ne do Správy. Správa jen zapíná a vypíná moduly a rozdává pověření. Díky tomu krojařka nepotřebuje Správu souboru a správce souboru se nemusí orientovat v evidenčních řadách.

### 4.8 Zprávy – soukromé konverzace (DM) `[?]` (výhled, docs/09)

Soukromé zprávy vytvoří obsah, který **nemá jiný domov** než globální seznam, protože DM nepatří žádné skupině ani akci. Proto doporučuji globální oblast **Zprávy** jako jedno místo pro všechny konverzace. Chat organizační skupiny zůstává ve skupině a Zprávy na něj jen odkazují (jeden originál).

- **Zprávy** `/messages`
  - **Seznam konverzací** – podle poslední aktivity, nepřečtené zvýrazněné
    - Chaty mých skupin → stejný chat jako v prostoru skupiny (`/groups/:slug?tab=chat`); ztlumené skupiny bez badge
    - **Přímé konverzace 1:1** (`direct`) – dva rovnocenní účastníci, bez správce
    - **Soukromé skupinové konverzace** (`group`) – ad-hoc okruh lidí (např. „auto na Velikonoce“), mají vlastní správce konverzace
    - Filtr: vše / nepřečtené / skupiny / soukromé; hledání v názvech a účastnících
    - Skryté konverzace (obnovení zobrazení)
  - **Nová zpráva** `/messages/new` – výběr jedné osoby (→ 1:1, existující se znovu otevře) nebo více osob (→ skupinová konverzace s názvem)
  - **Konverzace** `/messages/:conversationId`
    - Zprávy, zmínky, odkazy na akce / příspěvky (rozbalí se jako náhled)
    - Hlavička → **Informace o konverzaci**
      - Účastníci; u skupinové konverzace přidat / odebrat, jmenovat správce `(správce konverzace)`
      - Upozornění: vše / zmínky / ztlumit
      - Skrýt ze seznamu (jen pro mě)
      - Opustit konverzaci (poslední správce musí nejdřív předat správu)
      - Smazat konverzaci pro všechny `(správce skupinové konverzace)`, s potvrzením; u 1:1 tato akce neexistuje
    - **Retenční varování** (docs/09 kap. 5) – pruh v konverzaci a položka v „Čeká na vás“ u správců: „Neaktivní 12 měsíců, bude smazána za 60 dní – Zachovat?“
  - Vstupy odjinud:
    - Detail osoby (člen skupiny, účastník akce, adresář) → **Napsat zprávu**
    - Seznam účastníků akce → **Napsat vybraným** (založí skupinovou konverzaci) `[?]`

Navigační zásady pro DM:

- Nově přidaný účastník nevidí starší zprávy. UI to má říct systémovou zprávou „Zprávy před vaším přidáním nejsou dostupné“, ne prázdnou historií bez vysvětlení.
- Správce souboru ani skupiny nemá do Zpráv žádný zvláštní vstup. Ve Správě se DM neobjevují vůbec (ani počty).
- Vyhledávání (`/search`) prohledává DM jen pro účastníky, v rozsahu jejich intervalů členství.

### 4.9 Úkoly `[?]` (výhled V2, docs/07 kap. VI)

Úkoly propojují **domluvu, zodpovědnou osobu, termín a výsledek**. Nejde o projektový nástroj. Úkol může zadat každý člen.

- **Úkoly** `/tasks`
  - **Moje úkoly** (výchozí pohled) – řazení podle termínu: po termínu / dnes / tento týden / později / bez termínu
  - **Zadané mnou** – co jsem komu zadal a v jakém stavu to je
  - **K přijetí** – úkoly, které mi někdo zadal a já je ještě nepřijal / neodmítl (docs/07 kap. 29)
  - Hotové (archiv)
  - **Nový úkol** `/tasks/new` – název, popis, řešitel(é), termín, viditelnost, vazba (skupina / akce / kus kroje)
  - **Detail úkolu** `/tasks/:id`
    - Popis, termín, stav (nový → přijatý → hotový / odmítnutý / zrušený)
    - Zadavatel, řešitel(é); přijmout / odmítnout / předat
    - Komentáře (stejná komponenta jako u příspěvku)
    - Odkaz na výsledek (příspěvek, dokument, kus kroje)
    - → Související kontext (skupina / akce / Správa krojů)
- **Kontextové seznamy** (stejná data, filtr):
  - Detail akce → sekce **Úkoly k akci** (viditelnost: účastníci nebo jen organizátoři)
  - Prostor skupiny → záložka **Úkoly** (jen když je ve skupině aspoň jeden úkol nebo ji správce zapne)
  - Správa krojů → **Pracovní úkoly** (souhrn oprav napříč fondem)
- **Přehled** → v bloku „Čeká na vás“ úkoly po termínu a úkoly ke přijetí; nikdy celý seznam

**Viditelnost** (docs/07 kap. 30): osobní / přiřazený / skupinový / organizační u akce. Právo úkol číst je oddělené od práva měnit řešitele, termín a stav.

**Umístění v menu:** na začátku **bez** položky ve spodní liště. Stačí „Čeká na vás“ na Přehledu, kontextové seznamy a dlaždice ve „Více“. Globální položka až tehdy, když úkoly budou používat i běžní členové, ne jen organizátoři.

**Vztah ke Správě krojů:** pracovní úkoly Správy krojů (oprava kusu) jsou dnes samostatné. Doporučuji, aby se staly úkoly s vazbou na kus kroje. Zobrazí se pak i v osobních úkolech švadleny, ale **dokončení úkolu samo nemění evidenci** (stav kusu potvrdí krojařka, docs/07 kap. 31).

### 4.10 Speciální a sezónní akce `[?]` (výhled, docs/07 kap. VII)

Principem je **typ × funkce × šablona** (docs/07 kap. 33): běžná zkouška zůstává jednoduchá, složitá akce si **zapne funkce**, které potřebuje. Navigačně tedy nevzniká nová oblast. Detail akce dostane podle zapnutých funkcí další sekce a záložky.

- **Akce** (beze změny vstupu)
  - **Nová akce ze šablony** `[?]` – Velikonoce, Katerinské hody, Vánoční besídka, Soustředění, Pravidelná zkouška: předvyplní typ, funkce, cílové skupiny, pokyny a úkoly
  - **Detail akce** – sekce / záložky podle zapnutých funkcí:

| Funkce akce | Co přidá do detailu | Typické použití |
| --- | --- | --- |
| Účast (základ) ✅ | Moje účast, Účast | vše |
| Skutečná docházka ✅ | Docházka | zkoušky, vystoupení |
| **Program / dílčí akce** | záložka Program se seznamem dílčích bodů, každý s vlastní účastí | zájezd, hody, soustředění |
| **Otázky / ankety** | sekce Otázky – cílené na skupinu (holky: „kde budeš na Velikonoce?“, kluci: „jedeš autem?“) | Velikonoce (docs/07 kap. 38) |
| **Pobyt, noclehy, jídla** | Můj pobyt (příjezd / odjezd, výjimky); organizátor: souhrn pro objednávky | soustředění (kap. 36) |
| **Obsazení tanců** | Program vystoupení: čísla a kdo v nich tančí | vystoupení (kap. 35) |
| **Úkoly** | Úkoly k akci | hody, zájezd |
| **Kroje k akci** | požadované kroje, kdo co má, co je třeba vydat → Správa krojů | vystoupení, zájezd |
| **Doprava** `[?]` | kdo jede čím, volná místa | zájezd, obchůzka |
| **Komentáře** | dotazy pod akcí | vše |
| **Dokumenty a fotky** | soubory a galerie, po akci → Kronika | vše |

- **Poptávka vystoupení** `[?]` (kap. 34) – akce ve stavu *poptávka* s průběhem: předběžná poptávka → **dostupnost muziky** → dostupnost tanečníků → návrh programu → potvrzeno. Předběžná dostupnost je jiná odpověď než závazná účast („mohl bych“ ≠ „přijdu“). Navigačně: filtr „Poptávky“ v Akcích jen pro pověření Organizace akcí; členům se poptávka ukáže v „Čeká na vás“ jako dotaz na dostupnost.
- **Vánoční losování dárků** `[?]` (kap. 39) – jednorázová funkce akce; výsledek vidí jen dárce. Až po ověření potřeby (kap. 40).
- **Rozpis služeb** (bufet, šatna) – zatím **ne**, stačí příspěvek a přihlášení komentářem (kap. 37).

**Zastřešující akce:** Velikonoce, hody nebo zájezd jsou jedna akce s Programem dílčích bodů, ne zvláštní navigační oblast. Na Přehledu se v době konání zobrazí její karta („Aktuálně: Katerinské hody – program, úkoly, otázky“). Pro intenzivní komunikaci lze k akci jedním tlačítkem založit **dočasnou skupinu** (nebo soukromou skupinovou konverzaci, kap. 4.8), kterou po skončení archivuje její správce nebo Správa. Menu se tím nemění.

**Filtr před každou novou funkcí** (docs/07 kap. 40): opakuje se problém? Nestačí akce, příspěvek, komentář nebo úkol? Je potřeba strukturovaný výsledek? Použije se i u jiných akcí? Nezatíží běžného člena?

### 4.10a Upozornění `[?]` (výhled)

Až budou upozornění chodit z více modulů (zmínky, DM, úkoly, změna akce, výpůjčka po termínu), doporučuji **zvonek v hlavičce** se seznamem posledních událostí `/notifications`:

- Seznam událostí s odkazem na kanonický detail; přečteno / nepřečteno, „označit vše“.
- Odlišit od „Čeká na vás“: **zvonek = co se stalo** (informace), **Čeká na vás = co mám udělat** (povinnost, zmizí po vyřízení).
- Preference zůstávají v Nastavení → Upozornění ✅ a v režimu upozornění u skupiny / konverzace ✅.
- Push a e-mail až s backendem; UX nesmí počítat s okamžitým doručením (polling).

#### Nové osobní a skupinové cesty (cílové, bez hotové route)

- Skupina → **Soubory**: agregovaný přehled příloh chatu/nástěnky, možnost oprávněného připojení stejného obsahu k **příspěvku v jiné skupině** (např. příspěvek choreografie v repertoárové skupině). Jeden obsah, více odkazů; sdílený obsah nelze přepsat ze zprávy.
- Skupina → **Archivovat** / **Obnovit**; Správa souboru → **Smazat archivovanou skupinu** po potvrzení (skutečně odstraní výlučný skupinový obsah, ale ne cizí vazby nebo nezávislou docházku/kroje).
- Chat skupiny → Nastavení **otevřená historie / historie od vstupu**; staré nepřístupné zprávy se nesmí retroaktivně odkrýt.
- Zpráva → **Nahlásit** (pro všechny soubory; pouze označený obsah pro pověřeného příjemce). Konkrétní bezpečnostní workflow dosud není uzavřeno.
- Profil / Nastavení → **Přihlášená zařízení a relace**, jejich vzdálené ukončení; oddělená možnost důvěryhodného prohlížeče a v budoucnu **Přepnout účet** na sdíleném zařízení.
- Při výpadku API → banner **Offline: pouze pro čtení**, zakázat všechny zápisy; dostupné jsou jen lokálně uložené aktivní texty a metadata.

### 4.11 Osobní část: profil, nastavení, hledání ✅

Vždy v hlavičce (jméno/avatar, lupa, ozubené kolo) ✅, nelze je odebrat ani přesunout do lišty:

- **Můj profil** ✅ `/profile` – osobní údaje, odhlášení
  - **Moje nedostupnost** ✅ – období od–do s volitelnou poznámkou; přidat / upravit / smazat; rodič zadává za dítě svým účtem. Důvod vidí jen člen a pověření organizátoři
  - Moje skupiny a pověření `[?]` (náhled vlastních přístupů – stejná komponenta jako ve Správě)
- **Nastavení** ✅ `/settings` – osobní: vzhled (režim, velikost písma), upozornění, výchozí zobrazení akcí. **Nezaměňovat se Správou.**
  - **Spodní lišta** ✅ – výběr a pořadí míst (kap. 6.2)
  - **Boční menu** ✅ – pořadí a skrytí položek v sekcích Moje skupiny a Agendy (kap. 6.4)
  - **Kalendář** ✅ – export mých akcí do .ics (typy akcí, vynechané termíny jako „NENÍ …“)
- **Hledat** ✅ `/search` – příspěvky, komentáře, zprávy chatu, akce
  - Osoby, kusy krojů (podle evidenčního čísla) `[?]`
- **Novinky v aplikaci** ✅ `/changelog`
- Adresář členů `[?]` – kontakty všech aktivních členů (rozsah údajů podle souhlasu); dnes jen členové ve skupině
- Dokumenty souboru `[?]` (stanovy, přihlášky, pokyny)

### 4.12 Budoucí oblasti a kam patří `[?]`

Z docs/07 kap. VII–VIII. **Nejdřív využít stávající model** (skupina, nástěnka, příspěvek, přílohy, akce a její funkce, úkol). Nový modul ani položku menu zakládat teprve tehdy, když stávající model přestane stačit (docs/07 kap. 40). Žádná z oblastí nemá automaticky nárok na položku hlavního menu.

| Oblast | Stav | Řešení ve stávajícím modelu / navrhované umístění |
| --- | --- | --- |
| Dlouhodobá nedostupnost členů | **kandidát k realizaci** | Profil → Moje nedostupnost; informace v Účasti a ve formuláři akce (kap. 4.11) |
| Úkoly | výhled V2 | Přehled („Čeká na vás“) + kontextové seznamy; globální položka až podle používání (kap. 4.9) |
| Repertoár, choreografie | bez nového modulu | skupina „Repertoár“ nebo skupina tanečníků; **jeden příspěvek na choreografii** s videi, nahrávkami, notami a texty; připnutý rozcestník (docs/07 kap. 43) |
| Texty písní, nahrávky ke zkoušení | bez nového modulu | stejně jako repertoár: příspěvky s přílohami ve skupině muziky / zpěvu |
| Kronika a archiv akcí | výhled | detail proběhlé akce (komentáře, přílohy, fotky) |
| Fotogalerie | výhled | přílohy u akce a příspěvků; Skupina → Soubory |
| Poptávky vystoupení | výhled | akce ve stavu „poptávka“, filtr pro pověření Organizace akcí (kap. 4.10) |
| Obsazení tanců, pobyt a jídla, doprava | výhled | funkce akce (kap. 4.10) |
| Finance, dotace, vyúčtování | výhled | agenda s vlastním pověřením (místo v liště / „Více“) |
| Dětský soubor, rodiče | cílový model (docs/02, 07, 08) | přepnutí souboru a jednání za dítě (kap. 4.1a); UI zatím nenavrženo |
| Zpěvník, audio/videobanka, inventář nástrojů, rezervace zkušebny, narozeniny, nábor, hlasování, statistiky, cestovní údaje, kontakty pořadatelů, veřejná prezentace | **nezávazný zásobník** (docs/07) | nenavrhovat navigaci |

## 5. Průchody a opakovaně použitelné detaily

### 5.1 Příklad: skupina Kluci a akce Velikonoce

```text
Skupiny
└── Kluci                         /groups/kluci   (dnes /boards/kluci)
    ├── Chat                      ?tab=chat
    ├── Nástěnka                  ?tab=board
    │   └── Texty písní           /posts/:id  (kanonická adresa příspěvku)
    ├── Členové                   ?tab=members
    ├── Akce [?]                  ?tab=events → seznam akcí cílených na Kluky
    │   └── Velikonoce            /events/:id (stejný detail jako v Akcích)
    └── Správa                    ?tab=manage (jen správci skupiny)
```

### 5.2 Různé cesty k téže obrazovce

```text
Přehled → Velikonoce → Účast
Akce → Velikonoce → Účast
Skupiny → Kluci → Akce → Velikonoce → Účast
Hledat → „Velikonoce“ → Velikonoce → Účast
Zprávy → zpráva s odkazem → Velikonoce → Účast
```

Ve všech případech jde o stejný detail `/events/:id` a stejný seznam účastníků.

### 5.3 Návrat a zachování kontextu – doporučené pravidlo

- **Zpět (šipka v hlavičce i systémové gesto) = historie prohlížeče.** Když historie v aplikaci neexistuje (přímý odkaz, notifikace), šipka vede na **kanonického rodiče** (detail akce → Akce, příspěvek → jeho skupina).
- **Breadcrumb (jen desktop) ukazuje kanonickou polohu**, ne cestu, kudy uživatel přišel: „Akce › Velikonoce“, i když přišel ze skupiny. Je to předvídatelné a stejné pro všechny. Na mobilu breadcrumb nebude, stačí titulek a šipka zpět.
- Filtr, pohled a záložka patří do URL (query param), takže se po návratu obnoví samy. Pozici scrollu obnovuje router (`scrollPositionRestoration`).
- Přímý odkaz na jakýkoli detail musí fungovat bez předchozí navigace ✅ (už dnes).
- **Aktivní položka menu** se odvozuje z kanonické oblasti: detail akce zvýrazní Akce, detail příspěvku jeho skupinu.

## 6. Návrh navigace podle zařízení

### 6.1 Doporučená kostra: pevný základ + osobní lišta

Každý vidí jinou sadu míst podle členství a pověření. Pevné menu, které vyhoví všem, proto neexistuje. Navrhuji kostru ze čtyř pevných prvků a jedné **osobní, konfigurovatelné spodní lišty**:

| Prvek | Obsah | Konfigurovatelné | Mobil | Desktop |
| --- | --- | --- | --- | --- |
| **Přehled** | dashboard + rozcestník do všech míst (kap. 7) | ne – vždy první | 1. pozice lišty | 1. položka sidebaru |
| **Osobní lišta** | 0–4 další místa, která si uživatel vybere z dostupných | ano | pozice 2–5 lišty, přebytek pod „Více“ | sidebar má vlastní, nezávislou konfiguraci (kap. 6.4) |
| **Hlavička** | Hledat, Nastavení, Profil (avatar), později Upozornění | ne | vždy viditelná ✅ | vždy viditelná ✅ |
| **Více** | vše dostupné, co není v liště | automaticky | poslední pozice, jen když se místa do lišty nevejdou | — |
| **Pracovní režimy** | inventura, formuláře | — | lišta skrytá, „Zpět“ v hlavičce | normálně |

**Místo** = cokoli, kam uživatel smí vstoupit: Akce, jednotlivá skupina, rozcestník Skupiny, Zprávy `[?]`, Moje kroje, Správa krojů, Docházka, Správa souboru, Úkoly `[?]` a další moduly. Nabídka v konfiguraci je vždy filtrovaná podle zapnutých modulů a pověření (`NavigationService`).

**Nastavení, Profil a Odhlášení nejsou místa** a do lišty je nelze přidat ani z ní odebrat. Jsou vždy v hlavičce, takže se k přeskládání lišty uživatel dostane, ať si lištu nastaví jakkoli.

### 6.2 Mobil – osobní spodní lišta

**Stav (18. 10. 2026):** implementováno podle pravidel níže ✅ – Přehled pevně, osobní výběr v Nastavení → Spodní lišta, stránka Více (`/more`), ikona Více v mobilní hlavičce (dřív „Moje místa“ na Přehledu) na Přehledu. Jednorázová nabídka „Přidat novou skupinu do lišty?“ zatím chybí `[?]`.

**Problém dnešního stavu:** posuvná lišta je anti-vzor (položky za okrajem nikdo neobjeví, palec nemá pevné cíle). Obsah se navíc mění s každou novou skupinou a nedá se ovlivnit.

#### Pravidla lišty

1. **Nejvýš 5 viditelných pozic, nikdy posun do strany.**
2. **1. pozice = Přehled**, pevně. Je to záchranný rozcestník: odtud vede cesta všude, i když si uživatel ostatní místa z lišty vyřadí.
3. **Pozice 2–5** si uživatel vybere a seřadí v **Nastavení → Spodní lišta**.
4. **Přetečení:** vybere-li uživatel víc míst, než se vejde, zobrazí se první tři a **5. pozice se změní na „Více“** se zbytkem. Uživatel tak nevolí „režim“. Kdo má ≤ 5 míst, má je všechna přímo. Kdo jich má víc, rozhodne pořadím, co je „okrajové“.
5. **Badge „Více“** = součet badge schovaných míst (u jednotlivých skupin tečka, u povinností číslo). Schované místo tak nepřestane upozorňovat.
6. **Skupiny jako jedna položka:** místo „Skupiny“ (rozcestník) lze do lišty dát místo jednotlivých skupin nebo vedle vybraných skupin. Skupiny, které v liště nejsou, jsou v rozcestníku seřazené podle aktivity. Typicky pro vedení: dvě nejdůležitější skupiny přímo + „Skupiny“ pro ostatní.
7. **Lišta se po přizpůsobení sama nemění.** Novou skupinu uživatel uvidí na Přehledu, v rozcestníku a ve „Více“. Jednou dostane nabídku „Přidat Muzikanty do lišty?“ (ano / ne, už se neptat). Ztráta přístupu (odchod ze skupiny, vypnutý modul, odebrané pověření) místo z lišty tiše odebere.
8. **Více souborů:** nabídka míst obsahuje místa ze všech souborů, kde je člověk členem (např. skupina Malé Vonice i dospělé Vonice). Skupina jiného souboru nese v liště i v nabídce štítek souboru; klepnutí přepne kontext (kap. 4.1a). Přehled zůstává společný napříč soubory.
9. Dokud uživatel lištu nepřizpůsobil, platí **automatický výchozí návrh** (níže) a ten se změnám přístupů přizpůsobuje sám.

#### Automatický výchozí návrh

Pořadí kandidátů: Akce → skupiny, kde je člen → agendy s právem zápisu (Docházka, Správa krojů) → Moje kroje (jen s výpůjčkou) → agendy jen ke čtení a Správa souboru → Zprávy `[?]`.

- **Běžný člen bez agend** dostane skupiny vždy přímo, pokud se s Akcemi vejdou do 4 pozic; Moje kroje pak najde přes ikonu Více v hlavičce.

- Vejdou-li se všichni kandidáti do 4 pozic za Přehledem, dostane je přímo.
- Pokud ne, **skupiny se sloučí do položky Skupiny**. Vejdou-li se pak, hotovo. Jinak se přebytek přesune pod „Více“.

Výsledek pro typické osoby:

```text
Běžný člen (Taneční, Kluci, má kroj zapůjčený)
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Přehled  │   Akce   │ Taneční  │  Kluci   │  Kroje   │
│          │   (1)    │   (3)    │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
→ žádná mezivrstva: zpráva ve skupině = 1 klepnutí, odpověď na akci = 1–2

Krojařka (3 skupiny, pověření Správa krojů)
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Přehled  │   Akce   │ Skupiny  │Spr. krojů│  Kroje   │
└──────────┴──────────┴──────────┴──────────┴──────────┘

Vedení (6 skupin, Docházka, Správa souboru, Správa krojů – náhled)
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Přehled  │   Akce   │ Skupiny  │ Docházka │   Více   │
│          │   (2)    │   (7)    │          │   (•)    │
└──────────┴──────────┴──────────┴──────────┴──────────┘
  Více: Správa · Správa krojů · Moje kroje
```

Každý si pak lištu může upravit. Například vedoucí si dá „Kluci“ přímo a Docházku pošle do „Více“.

#### Konfigurace lišty – Nastavení → Spodní lišta

```text
Spodní lišta                                      [Obnovit výchozí]
┌───────────────────────────────────────────────┐
│ náhled: Přehled · Akce · Taneční · Kluci · Kroje │
└───────────────────────────────────────────────┘
V liště (pořadí tažením nebo šipkami ↑↓)
  🔒 Přehled                    vždy první
  ≡  Akce                       [odebrat]
  ≡  Taneční                    [odebrat]
  ≡  Kluci                      [odebrat]
  ≡  Moje kroje                 [odebrat]
     ─ od sem dál se zobrazí pod „Více“ ─
Další dostupná místa
  +  Skupiny (všechny skupiny v jedné položce)
  +  Hledat
```

- Řazení musí jít i bez tažení (šipky ↑↓, přístupnost).
- Čára „od sem dál pod Více“ ukazuje přetečení předem, bez překvapení.
- Vstupy do konfigurace: **Nastavení** (hlavička, vždy), odkaz **„Upravit lištu“** na konci Přehledu a ve „Více“, dlouhé podržení lišty jako zkratka `[?]`.
- Uložení: osobní preference v `SettingsService` (dnes localStorage, stejně jako výchozí pohled akcí). S backendem synchronizovat mezi zařízeními.
- Popisek položky v liště: krátký (≤ 10 znaků) + ikona. Skupina má ikonu ✅. Pro dlouhé názvy přidat do nastavení skupiny **krátký název** `[?]`.

#### Pravidlo „do tří klepnutí“ – ověření

| Úkon | Běžný člen | Vedení (sloučené skupiny) |
| --- | --- | --- |
| Odpovědět na nejbližší akci | 1 (Přehled) | 1 |
| Odpovědět na jinou akci | 2–3 (Akce → akce → odpověď) | 2–3 |
| Kdo přijde na akci | 2 | 2 |
| Přečíst nové zprávy ve skupině | **1** (skupina v liště) | 2 (Skupiny → skupina) nebo 1, má-li ji v liště |
| Napsat příspěvek do skupiny | 2–3 | 3 |
| Co mám zapůjčeno | 1 (Kroje) | 2 (Více → Moje kroje) |
| Zapsat docházku po zkoušce | — | 2–3 (Přehled → „Čeká na vás“ → akce) |
| Vydat kus kroje | — | 3 (Správa krojů → Krojové karty → osoba) |
| Změnit lištu | 2 (Nastavení → Spodní lišta) | 2 |

Místa, která si uživatel z lišty vyřadil, zůstávají dosažitelná do dvou klepnutí přes ikonu **Více** v mobilní hlavičce (vždy viditelná) nebo přes položku „Více“ v liště.

#### Další pravidla mobilu

- **Pracovní režimy** (inventurní návštěva, evidenční řada, formuláře) skrývají spodní lištu a mají v hlavičce jasné „Zpět na inventuru“.
- Kontextové záložky pod titulkem: max. 4–5; víc → horizontální posun s viditelným oříznutím (Správa krojů má dnes 5, to je hranice).
- Primární akce (odpověď na účast, nový příspěvek) dostupná bez otevírání podnabídek; plovoucí tlačítko jen tam, kde je jedna jasná hlavní akce (nástěnka → nový příspěvek).
- Stránka **Více** (`/more`): nahoře schovaná místa z lišty (s badge), pod nimi dlaždice *Agendy* (podle pověření), *Soubor* (Adresář, Dokumenty… `[?]`), odkaz „Upravit lištu“. Nastavení a Profil zde mohou být zopakované, ale jejich hlavní místo je hlavička.

### 6.3 Tablet

- Na šířce ≥ 768 px sidebar; uživatel ho může sbalit na ikony (kap. 6.4) ✅.
- **Seznam + detail vedle sebe** tam, kde se prochází řada položek: Zprávy (seznam konverzací | chat), Krojové karty (seznam lidí | karta), Součástky (seznam | detail kusu).
- Inventura na tabletu je pravděpodobně hlavní zařízení krojařky ve skladu – režim Ve skladu optimalizovat na tablet na výšku.

### 6.4 Desktop

- **Sidebar** ✅ má pevné sekce: Přehled a Akce → **Moje skupiny** (jednotlivé skupiny pohromadě, sekce chybí, nemá-li člen žádnou) → **Agendy** (Docházka, Moje kroje, Správa krojů, Správa – podle pověření a modulů) → **Soubor** (rozcestník Skupiny, Hledat).
  - **Nastavení → Boční menu** ✅: pořadí a skrytí položek jen uvnitř Moje skupiny a Agendy, „Obnovit výchozí“. Přehled, Akce a Soubor jsou pevné; přesun mezi sekcemi ani vlastní odkazy nejsou. Konfigurace je nezávislá na spodní liště a uložená v zařízení (jako lišta). Nedostupná místa v uložené konfiguraci se tiše vynechají.
  - Skryté položky jsou v sekci pod rozbalovacím **„Další (n)“** se součtem badge; skupiny navíc v rozcestníku Skupiny.
  - **Sbalený režim** ✅ (jen ikony, ~68 px): přepínač v hlavičce sidebaru, volba uložená v zařízení (výchozí rozbalený). Název položky jako tooltip a zároveň přístupný název, nadpisy sekcí jako oddělovače, badge zmenšený u ikony; profil, odhlášení a Nastavení jako ikony v patičce. Na mobilu se neuplatní.
- Druhá úroveň jako záložky pod titulkem (stejné jako na mobilu – jedna terminologie, jedno chování).
- Breadcrumb s kanonickou polohou u detailů 3. úrovně.
- Široké tabulky, hromadné akce a exporty (Sklad, Výpůjčky, Docházka, Členové) – desktop je hlavní místo pro agendy.

### 6.5 Společné chování

- Záložka, pohled a filtr jsou v URL a dají se poslat odkazem.
- Stejná terminologie na všech zařízeních.
- Aktivní položka a aktuální kontext jsou zřetelné.
- **Badge = něco čeká na moji akci nebo pozornost**, ne celkový počet položek. Ztlumená skupina badge nezvyšuje ✅.
- Skrytí položky v UI nenahrazuje autorizaci na backendu.

## 7. Přehled / Dashboard – priority obsahu

Přehled je pro člena **rychlý rozcestník k nejbližší povinnosti nebo akci**, ne výpis novinek. Je to jediné místo lišty, které nelze odebrat, a zároveň **záložní rozcestník** do všech míst (kap. 7.4).

### 7.1 První priorita: dnes a zítra ✅

Karta nejbližší akce: název, datum, čas, místo, můj stav účasti, **Přijdu / Nepřijdu / Možná** jedním klepnutím, vstup do účastníků a detailu.

**UX cíl:** nejbližší akce = odpověď **jedním klepnutím**, jakákoli akce = nejvýš tři interakce. Návrhové kritérium k otestování, ne změřený výsledek.

### 7.2 Doporučení: jeden blok „Čeká na vás“

Dnes jsou pozvánky a nepotvrzené účasti samostatné pruhy nad přehledem. S přibývajícími moduly jich bude víc (žádosti ke schválení, inventurní výzva, vrácení kroje, docházka k zapsání, úkoly). Doporučuji je sjednotit do **jednoho seznamu povinností** nahoře:

```text
Čeká na vás
  ● Velikonoce – odpovězte na účast            [Přijdu] [Nepřijdu]
  ● Inventura krojů – vyberte termín návštěvy  →
  ● 2 žádosti o vstup do skupiny Muzikanti     →
  ● Vraťte košili č. M-14 do 30. 10.           →
```

- Každý modul přispívá vlastními položkami přes jednotné rozhraní (feature service vrací „položky k vyřízení“). Dashboard nezná detaily modulů.
- Když není nic, blok zmizí (žádné „Nemáte nic k vyřízení“, které jen zabírá místo).
- Stejný zdroj může později napájet badge na položce Přehled a upozornění (push / e-mail).

### 7.3 Další pořadí

1. Čeká na vás
2. Nejbližší akce ✅
3. Připnutá oznámení ✅
4. Novinky ze skupin `[?]` – max. 3 řádky „Kluci: 4 nové zprávy“, žádný přenesený chat
5. Moje kroje ✅ – jen když má člen výpůjčku; upozornění jdou do „Čeká na vás“
6. Aktuální zastřešující akce `[?]`
7. ~~Moje místa~~ – odebráno 19. 10. 2026 (nahrazeno ikonou Více v hlavičce)

### 7.4 Moje místa – záložní rozcestník (odebráno 19. 10. 2026)

> Na přání uživatele z Přehledu odebráno; stejnou roli plní ikona **Více** v mobilní hlavičce, která vede na stránku `/more` se všemi místy. Původní návrh níže ponechán pro kontext.

Na konci Přehledu je mřížka dlaždic **všech míst, kam uživatel smí** (stejný zdroj jako nabídka konfigurace lišty), s badge:

```text
Moje místa
 [Akce 1] [Taneční •] [Kluci] [Muzikanti •] [Moje kroje] [Skupiny]
 [Docházka] [Správa krojů] [Správa]                 Upravit lištu →
```

- Zaručuje, že vyřazení místa z lišty nikdy neznamená, že se k němu člověk nedostane: Přehled → místo jsou 2 klepnutí.
- Místa, která už jsou v liště, mohou být v mřížce potlačená (menší / šedá) nebo vynechaná `[?]`. Doporučuji je ponechat kvůli stabilní poloze.
- Odkaz „Upravit lištu“ je druhý, objevitelnější vstup do konfigurace vedle Nastavení.
- Na desktopu, kde sidebar ukazuje vše, může mřížka chybět.

### 7.5 Stavové situace k pokrytí

Žádná akce; účast už potvrzena (nabídnout změnu); víc akcí v jeden den; člen není cílovou skupinou; akce zrušena / změněna; načítání / chyba / offline.

## 8. Průřezové oblasti: chat, úkoly, oznámení

### 8.1 Chat a konverzace

Implementováno: skupinový chat ✅ se zmínkami, souhrnnými kartami komentářů a režimy upozornění. Navrženo: DM a soukromé skupinové konverzace (docs/09).

**Doporučení k diskuzi u akce:** nevytvářet třetí typ chatu. Možnosti v pořadí preference:
1. Komentáře přímo u akce (stejná komponenta jako komentáře příspěvku) – pro dotazy typu „kdo veze kroje?“.
2. Pro velké akce (zájezd) dočasná skupina s chatem.

Polling, ne WebSocket – UX nesmí slibovat okamžité doručení.

### 8.2 Úkoly

Jedna datová i obrazovková reprezentace, více kontextových seznamů. Viz kap. 4.9.

### 8.3 Nástěnky a příspěvky

**Rozhodnuto implementací:** nástěnka patří skupině. Celosouborová oznámení = příspěvek ve skupině, do které patří všichni (např. „Celý soubor“), a připnutí na Přehled. Samostatný globální modul Nástěnka **nedoporučuji** – vznikla by druhá cesta k týmž příspěvkům.

## 9. Pověření, moduly a více souborů

- Menu se skládá z jedné konfigurace oblastí filtrované podle zapnutých modulů a pověření ✅ (`NavigationService`, společná pro sidebar i lištu).
- Skupiny v menu jen ty, kde je uživatel členem ✅.
- Správa souboru nedává obsah soukromých skupin ✅; to se musí projevit i v navigaci (Správa → Skupiny neodkazuje do chatu skupiny ✅).
- Vypnutí modulu odstraní jeho položky ze všech vrstev menu i z „Čeká na vás“.
- **Schválený cílový model více souborů:** přepínač souboru v hlavičce / osobním menu, nikoli další položka hlavní navigace. Společný osobní přehled zobrazuje relevantní data napříč soubory; vlastní správcovské agendy zůstávají ve zvoleném kontextu. Implementace přepínače zatím není potvrzena.

### Zabezpečení kontextu a odkazů

Všechny serverové endpointy ověřují **skutečný souborový kontext a pověření** (nezávisle na tom, jakou položku frontend zobrazil). URL ani lokální nastavení aktivního souboru nesmí stačit pro přístup do jiného souboru. Úzké osobní čtení `Moje kroje` ze cizího skladu je jiný endpoint než správa skladu. Pro novou souborově jednoznačnou navigaci lze zvážit prefix v URL (např. `/s/:ensembleSlug/events/:id`), ale **není tím rozhodnuta okamžitá migrace stávajících rout**.

## 10. Doporučení pro implementaci navigace v Angularu

- Detaily entit mají **jednu kanonickou URL podle domény objektu** ✅ (`/events/:id`, `/posts/:id`, `/wardrobe/stock/:id`).
- Záložky a pohledy přes **query param `tab` / `view`** ✅ (skupina, inventura, akce). Držet jednotně; podcesty používat jen pro samostatné obrazovky (formuláře, pracovní režimy).
- Formuláře konzistentně: `…/new`, `…/:id/edit` ✅.
- Menu z jedné konfigurace ✅, žádný obecný dynamický renderer.
- Nastavení modulu jako poslední záložka modulu (`/wardrobe/settings` ✅, `/events/settings` `[?]`).

### 10.1 Skutečné routy (2026-10-18) a doporučené úpravy

```text
/login
/app/dashboard                         Přehled
/app/events  ?view=list|calendar       Akce
/app/events/new | /:id | /:id/edit
/app/attendance                        Docházka
/app/boards                            Skupiny – rozcestník        → doporučeno /app/groups
/app/boards/:slug ?tab=chat|board|members|manage                   → /app/groups/:slug
/app/boards/:slug/new                  nový příspěvek              → /app/groups/:slug/posts/new
/app/groups/new                        založení skupiny
/app/posts/:id | /:id/edit
/app/costumes                          Moje kroje                  → zvážit /app/my-costumes
/app/wardrobe → /wardrobe/stock        Správa krojů              → zvážit /app/costume-admin
/app/wardrobe/stock[/new|/:id|/:id/edit]
/app/wardrobe/cards[/:key]
/app/wardrobe/loans[/new]
/app/wardrobe/inventories[/new|/:id ?tab=…]
/app/wardrobe/inventories/:id/visit/:key
/app/wardrobe/inventories/:id/stock/:seriesId
/app/wardrobe/settings
/app/manage → /manage/members          Správa (/app/admin přesměrováno)
/app/manage/members[/new|/:id]
/app/manage/groups[/new|/:id]
/app/manage/config
/app/manage/history
/app/search  /app/settings  /app/profile  /app/changelog
```

Přejmenování `boards → groups` a `costumes → my-costumes` je kosmetické, ale odstraní matení (dvojice `costumes` / `wardrobe` dnes nic neříká; `wardrobe` navíc znamená šatník). Staré adresy přesměrovat, ať fungují odkazy v notifikacích a záložkách.

Navrhované nové routy `[?]`: `/app/messages[/new|/:conversationId]`, `/app/tasks[/new|/:id]`, `/app/notifications`, `/app/events/:id?tab=program|questions|stay|tasks`, `/app/more`, `/app/manage/mandates`, `/app/events/settings`, `/app/groups/:slug?tab=events`.

## 11. Otevřená rozhodnutí – s doporučením

| # | Otázka | Doporučení | Stav |
| --- | --- | --- | --- |
| 1 | Primární menu | Osobní lišta: Přehled pevně + 4 volitelná místa, přetečení pod „Více“; automatický výchozí návrh (skupiny přímo, při nedostatku místa sloučené do Skupiny); Nastavení vždy v hlavičce; Přehled → Moje místa jako záloha | směr schválen, detaily k ověření |
| 2 | Nástěnka | Jen skupinové nástěnky + připnutí na Přehled | rozhodnuto implementací |
| 3 | Adresář členů | Ano, jako položka „Více“ s rozsahem údajů podle souhlasu | k rozhodnutí |
| 4 | Detail akce – záložky | Zatím jedna stránka se sekcemi (Popis, Moje účast, Účast, Docházka); záložky až při ≥ 5 sekcích | k rozhodnutí |
| 5 | Chaty | Globální Zprávy – nutné kvůli DM | doporučeno |
| 6 | Úkoly | Kontextové seznamy + „moje úkoly“ na Přehledu; globální položka později | V2 |
| 7 | Správa krojů – sekundární menu | Součástky (dnes Sklad) / Krojové karty / Výpůjčky / Inventury / Nastavení | rozhodnuto implementací, kromě názvu první záložky |
| 8 | Inventura | Pracovní režim (Podle lidí / Ve skladu) | rozhodnuto implementací |
| 9 | Sezónní obsah | Zastřešující akce + karta na Přehledu + dočasná skupina | k rozhodnutí |
| 10 | Navigace podle pověření | Agendy jsou běžná místa nabízená jen s pověřením; ve výchozím návrhu za skupinami, u vedení typicky pod „Více“ | k rozhodnutí |
| 11 | Zpět / breadcrumbs | Zpět = historie, fallback kanonický rodič; breadcrumb kanonický, jen desktop | doporučeno |
| 12 | Názvosloví | viz kap. 11.1 | k rozhodnutí |
| 13 | Kde spravovat kategorie akcí | Akce → Nastavení (pověření Organizace akcí v rozsahu souboru) | nové |
| 14 | Přehled pověření ve Správě | Ano, stránka Správa → Pověření | nové |
| 15 | Archivace skupin | Aktivní → archivovaná → smazaná; smazat jen archivovanou | **rozhodnuto** (docs/08 kap. 10.5) |
| 16 | Zprávy (DM) v liště | Až DM vzniknou: nabídnout jako místo; do výchozího návrhu jen tomu, kdo má soukromou konverzaci; nepřečtené DM vždy i v „Čeká na vás“ / zvonku | nové |
| 17 | Krátký název skupiny pro lištu | Volitelné pole v nastavení skupiny | nové |
| 18 | Lišta napříč soubory | Místa ze všech souborů se štítkem souboru; Přehled společný | nové |
| 19 | Dlouhodobá nedostupnost | Profil → Moje nedostupnost; informace organizátorům v Účasti a formuláři akce | **schváleno k realizaci**, detail k návrhu |

### 11.1 Názvosloví – návrh

| Pojem | Doporučeno | Nepoužívat | Poznámka |
| --- | --- | --- | --- |
| osobní kroje | **Moje kroje** (v liště zkráceně **Kroje**) | Kroje (pro fond) | |
| agenda / položka menu pro práci s krojovým fondem | **Správa krojů** (pracovně, k potvrzení) | Krojárna, Krojárka | shoduje se s názvem pověření; v UI dnes „Krojárna“ – přejmenovat |
| osoba pověřená správou krojů | **krojařka** | krojárka | |
| místnost s nezapůjčenými kroji | **sklad** (krojový sklad) | krojárna, krojárka | záložku „Sklad“ se všemi kusy přejmenovat na **Součástky** |
| pověření jen ke čtení | **Náhled do správy krojů** | Náhled do krojárky | |
| skupinová komunikace v reálném čase | **Chat** | Diskuze | |
| komentáře pod příspěvkem/akcí | **Komentáře** | Diskuze, Chat | |
| skupinové příspěvky | **Nástěnka** (oblast), **příspěvek** (položka) | Příspěvky jako název záložky | |
| všechny konverzace | **Zprávy** | Chaty | zahrnuje i DM |
| správa jádra souboru | **Správa** | Administrace | ✅ přejmenováno |
| osobní preference | **Nastavení** | — | nikdy pro Správu |
| oprávnění | **Pověření** | role | docs/08 kap. 3 |

## 12. Doporučený postup ověření

1. ~~Porovnat strom s existujícím vývojem.~~ Hotovo touto revizí.
2. **Prototyp osobní spodní lišty** s automatickým výchozím návrhem a stránkou Nastavení → Spodní lišta; vyzkoušet na běžném členovi (2 skupiny), krojařce a někom z vedení. Ověřit, zda najdou cestu k úpravě lišty a k místu, které z ní vyřadili.
3. Vzorová cesta: Přehled → odpověď na účast → kdo přijde (cíl: 1–2 klepnutí).
4. Skupinový kontext: Více/Skupiny → Kluci → Chat → odkaz na akci → zpět.
5. Agenda: Správa krojů → Inventura → návštěva → zpět na inventuru, na tabletu ve skladu.
6. Správa: založit osobu → přidat do skupiny → přidělit pověření → ověřit náhled přístupů.
7. Úkolové testy bez vysvětlování struktury („Zjistěte, kdo jede na Velikonoce“, „Kdy máte vrátit kroj?“).
8. Teprve potom uzavřít názvy, breakpointy a přejmenování rout.

## 13. Vztah k MVP

Prototyp už pokrývá víc než původní MVP z `03-postup-vyvoje.md` (skupiny s chatem, pověření, Správa, Správa krojů s inventurami). Tento dokument popisuje **cílový prostor navigace**, ne závazný rozsah další verze. Úkoly, DM, sezónní obsah a budoucí oblasti z kap. 4.12 lze odložit nebo nejdřív ukázat jako neaktivní dlaždici ve „Více“.

**Princip:** nejdřív konzistentní kostra a ověřené uživatelské cesty, potom postupné naplňování modulů.
