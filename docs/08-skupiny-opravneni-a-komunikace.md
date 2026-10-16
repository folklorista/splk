# 08 – Skupiny, pověření, správa a sjednocená komunikace

**Projekt:** Souborový systém (SPLK) – Vonica  
**Typ:** Funkční specifikace / zadání pro další implementaci  
**Verze dokumentu:** 0.1  
**Datum:** 16. 10. 2026  
**Stav:** Schválený směr návrhu s výslovně označenými detaily k ověření

> **Základní princip:** Lidé mají právo číst obsah podle členství ve skupinách a cíleného přístupu; právo něco spravovat získávají samostatným pověřením s vymezeným rozsahem. Skupinová komunikace má jednu časovou osu, kde se potkává chat, aktivita nástěnky a provozní oznámení, ale neztrácí se samostatný kontext jednotlivých příspěvků.

---

## 1. Účel a vztah k ostatním dokumentům

Tento dokument popisuje rozhodnutí přijatá při návrhu **Správy, skupin, oprávnění, členství, nástěnek a skupinového chatu**. Je určen také vývojové AI jako podklad pro postupnou úpravu existující aplikace.

- Navazuje na `07-souborovy-system-vize-funkce-roadmapa.md` a zachovává jeho motivaci: jedno místo pro akce, docházku, komunikaci, kroje a dohledatelnou historii.
- Navazuje na `06-specifikace-krojoveho-skladu.md`; **nemění pravidlo, že skutečné změny v krojové evidenci provádějí pouze pověřené krojárky**.
- Navazuje na interaktivní prototyp `splk-simulator-opravneni.html`, v němž lze proklikávat osoby, skupiny a pověření. Je to **UX reference**, nikoli autoritativní implementace bezpečnostních pravidel.
- **Nahrazuje starší návrh pevně děděných systémových rolí** „host → člen → vedoucí → administrátor → superadministrátor“ v dokumentu 07. Starší dokument 07 může obsahovat jiné formulace; v oblastech upravených zde má přednost tento dokument, dokud se 07 nesjednotí.
- V1.0 Souborového systému už byla vydána. Následující požadavky jsou **rozšířením a úpravou běžící aplikace**, nikoli zpětně novou podmínkou jejího prvního vydání.

### 1.1 Co je závazně dohodnuto

1. Organizační funkce ve folklorním souboru nejsou pevnými systémovými rolemi.
2. Existují pověření k **celému souboru, konkrétní skupině, konkrétní akci nebo konkrétnímu modulu**.
3. Správce souboru může pověření přidělovat, ale **nezískává jejich věcný výkon automaticky** (např. spravovat kroje nebo všechny akce).
4. Správa systému a čtení soukromých diskuzí jsou **oddělená oprávnění**.
5. Skupiny mají členy, hlavního správce a mohou mít spolusprávce/zástupce.
6. Vznikne nová sekce **Správa** namísto dosavadní „Administrace“; běžná práce se skupinovým obsahem se provádí přímo ve skupině.
7. Přijetí do skupiny může probíhat žádostí či pozvánkou a schválením příslušným správcem skupiny.
8. **Všechny existující skupiny Vonice dostanou skupinový chat při prvním zavedení chatu**; nezůstane jen u pilotní skupiny.
9. Skupina může mít chat i nástěnku, každé lze samostatně zapnout/vypnout a lze nastavit výchozí záložku.
10. Komentář pod příspěvkem nástěnky je součástí jeho vlastní diskuze a zároveň se může zobrazit v časové ose skupinového chatu.
11. **Delší diskuze pod příspěvky se ve společném chatu automaticky seskupují**; celá diskuze zůstává přístupná pod příspěvkem.
12. Časová osa zobrazuje také vybrané systémové události (členství, připnutí, změny akcí apod.).

### 1.2 Co je návrhem či potřebuje upřesnění

Konkrétní prahy pro automatické seskupení komentářů, režim zobrazování starší historie nově přijatému členovi, pravidla veřejných/skrytých skupin, delegování delegace a politika notifikací vyžadují ještě doladění. Dokument navrhuje bezpečné výchozí chování, aby na něm vývoj mohl začít; **tyto parametry nejsou bez další dohody definitivními organizačními pravidly**.

---

## 2. Základní pojmy

| Pojem | Význam | Příklad |
|---|---|---|
| **Osoba** | Člověk evidovaný v systému, i bez aktivního členství či účtu | Bývalý člen s vypůjčeným krojem |
| **Uživatelský účet** | Možnost přihlášení a práce v aplikaci | Přihlášení Aňyčky |
| **Členství v souboru** | Aktivní člen, bývalý člen, externí spolupracovník apod. | Eriček je aktivní člen |
| **Skupina** | Organizační nebo komunikační uskupení | Výbor, Holky, Kluci |
| **Členství ve skupině** | Přístup osoby do skupiny dle pravidel viditelnosti | Kačka je členkou Holek |
| **Souborová funkce** | Lidsky čitelná organizační pozice; sama neuděluje přístup | Kronikářka, ekonomka |
| **Oprávnění** | Konkrétní možnost vykonat činnost | Evidovat docházku |
| **Pověření** | Oprávnění přidělené osobě ve stanoveném rozsahu | Tezi je spolusprávkyní Taneční složky |
| **Hlavní správce skupiny** | Osoba primárně odpovědná za danou skupinu | Staňa ve skupině Kluci |
| **Spolusprávce skupiny** | Pověřený zástupce hlavního správce | Kuba D u skupiny Kluci |
| **Organizátor akce** | Osoba pověřená konkrétní akcí, nikoliv všemi akcemi | Organizátor Katerinských hodů |

**Souborová funkce není systémová role.** „Vedoucí souboru“, „organizační vedoucí“, „vedoucí taneční složky“, „vedoucí skupiny“, „ekonom“, „kronikář“, „hospodář/krojárka“ či „vedoucí propagace“ jsou pozice v organizační struktuře. Jejich pravomoci v aplikaci vznikají samostatným pověřením, případně členstvím ve skupinách.

**Členství není pověření.** Člověk může být členem Výboru bez správcovského přístupu a může technicky spravovat nastavení skupiny, aniž by směl číst její soukromou komunikaci. Pokud má někdo moderovat její obsah, musí mít i oprávněný přístup k příslušnému obsahu.

---

## 3. Model oprávnění – bez hierarchie systémových rolí

### 3.1 Pověření pro celý soubor

**Správa souboru** (typicky organizační/hlavní vedoucí, v demu Kuba D):

- zakládání a evidence osob / uživatelských účtů;
- nastavení či ukončení aktivního členství, bez mazání historie osoby;
- zakládání skupin a nastavení jejich metadat;
- přidělování a odnímání pověření ve stanoveném rozsahu;
- základní nastavení, výchozí preference a zapínání/vypínání modulů;
- dohled nad tím, že žádná skupina nezůstane bez odpovědné osoby.

**Toto pověření samo o sobě nedává:** právo číst chat a příspěvky neveřejných skupin, vidět statistiky jejich čtenosti, upravovat libovolnou akci, zapisovat skutečnou docházku nebo manipulovat se zápůjčkami krojů. Takové možnosti vyžadují samostatné pověření a případně oprávněný přístup ke konkrétnímu obsahu.

V aplikaci musí vždy existovat **alespoň jeden aktivní uživatel s pověřením Správa souboru**. Posledního nelze deaktivovat ani mu pověření odebrat bez předání přístupu jinému.

### 3.2 Pověření pro skupinu

**Hlavní správce skupiny** odpovídá za skupinu, přiděluje pomocníky/spolusprávce, rozhoduje o přístupech podle nastavených pravidel a spravuje skupinu.

**Spolusprávce** může provádět běžné správcovské operace ve svěřené skupině, například:

- schvalovat žádosti a spravovat členství;
- spravovat skupinovou nástěnku, připínat příspěvky a moderovat nevhodný obsah;
- archivovat a obnovovat příspěvky v rámci skupiny;
- zobrazovat relevantní statistiky a historii moderace;
- spravovat dostupné skupinové volby (chat, nástěnka, výchozí záložka) podle delegovaného rozsahu.

Pro prvotní jednoduchou verzi zástupce **nemůže dále pověřovat další zástupce**; tuto možnost si ponechává hlavní správce nebo správce souboru. Je to navržené omezení ke schválení.

**Soukromí:** správa metadat skupiny bez členství v ní automaticky nezpřístupňuje obsah. Příklad z prototypu: Kuba D může mít technickou správu skupiny Holky, ale pokud není členem, neuvidí její nástěnku ani chat. **Obsahové moderování bez možnosti obsah oprávněně číst nedává smysl**: pro takový zásah musí být pověřena osoba s příslušným obsahovým přístupem.

### 3.3 Pověření pro akci

- **Organizátor akce** může upravovat svěřenou akci a organizovat její účast podle nastavených možností.
- **Správce docházky** může zaznamenávat skutečnou docházku v určeném rozsahu.
- Správce skupiny organizující akci může dostat možnost její správy, **ale není automaticky správcem každé akce, na kterou je jeho skupina jen pozvána**.
- Akce má oddělené: *organizující skupinu či organizátory*, *skupiny a jednotlivce, kterým je určena*, *pověřené osoby ke správě*.
- Jedna akce může cílit několik skupin a jednotlivé hosty; nemusí patřit jediné skupině.
- Možnost vidět akci není totožná s možností ji upravovat nebo vidět statistiky ostatních.

### 3.4 Pověření pro odborný modul

- **Správa krojů (Krojárka)** umožňuje evidovat součásti, komplety, zápůjčky, vrácení a inventury.
- Běžný člen vidí pouze vlastní svěřené kroje, pokud má příslušný přístup k modulu.
- Člověk s pověřením Správa souboru nedostává automaticky správu krojů.
- Krojárka nemusí mít pověření ke Správě souboru ani číst jiné skupinové konverzace.
- Do budoucna půjde obdobně doplnit pověření pro kroniku, finance a další oblasti bez nových celosystémových rolí.

### 3.5 Praktické pravidlo vyhodnocování přístupu

Rozhodnutí musí zohlednit **osobu + požadovanou činnost + konkrétní objekt a jeho rozsah**. Každá citlivá operace se musí kontrolovat v backendu; skrytí tlačítka ve frontendu není bezpečnostní opatření.

Je potřeba samostatně vyhodnocovat:

1. **Viditelnost obsahu** – může tuto skupinu, příspěvek, chatovou zprávu nebo akci vidět?
2. **Možnost vytvářet obsah** – smí publikovat post, poslat zprávu, komentovat?
3. **Možnost moderovat a upravovat** – je autor nebo oprávněný správce?
4. **Možnost konfigurovat** – má odpovídající pověření pro danou skupinu/modul/soubor?

Při pochybnosti se přístup **nepovolí**. Přístup do krojové databáze, docházky ani chatů nesmí být odvozen jen z názvu organizační funkce nebo názvu skupiny.

---

## 4. Sekce a menu aplikace

Dosavadní sekci **Administrace** nahradit sekcí **Správa**. Nejde o přidání role „administrátor“, ale o obrazovky dostupné na základě pověření Správa souboru.

| Položka | Komu | Obsah |
|---|---|---|
| **Přehled** | Přihlášený uživatel | Nejbližší a důležité akce, zprávy, osobní povinnosti |
| **Akce** | Dle cílení a přístupů | Plánované a minulé akce, potvrzení účasti, detaily |
| **Docházka** | Pověřené osoby | Skutečná docházka, přehledy proběhlých akcí |
| **Skupinové nástěnky / skupiny** | Členové příslušných skupin a další výslovně oprávnění | Chat, nástěnka, členové, správa skupiny dle pověření |
| **Kroje / Moje kroje** | Člověk s vlastní zápůjčkou nebo povoleným přístupem | Vlastní přidělené součásti a komplety |
| **Krojárka** | Správci krojů | Přehled, Součásti, Komplety, Zápůjčky, Lidé, Inventury |
| **Správa** | Správce souboru | Členové, Skupiny, Konfigurace |
| **Nastavení** | Každý přihlášený | Vlastní vzhled, výchozí zobrazení, notifikace |

Menu je **dynamické podle skutečných přístupů** a zapnutých modulů. Zobrazovat skupiny, do kterých smí člověk vstoupit, nikoliv mechanicky všechny existující skupiny. V jedné skupině se zobrazí tlačítko pro její správu pouze tomu, kdo má příslušné pověření. U akcí a příspěvků jsou editovací a moderátorské úkony přímo v kontextu jejich detailu.

### 4.1 Správa → Členové

- Seznam a detail evidovaných osob, vytvoření, úprava, ukončení aktivního členství.
- U každého člověka zobrazit skupiny, členství a pověření (správce/spolusprávce).
- Umožnit změny členství a pověření (s respektem ke schvalování soukromých skupin).
- Osobní údaje a přístup k jejich úpravám omezit podle pověření.
- V detailu lze později zobrazit statistiky docházky a účasti; přístup ke statistikám musí odpovídat jejich citlivosti a pověřením.
- Externisté i bývalí členové v systému zůstávají; nesmí se mazat historii návazných kroků nebo zápůjček.

### 4.2 Správa → Skupiny

- Založit skupinu, změnit název, slug, ikonu, popis a nastavení viditelnosti.
- Určit členy, hlavního správce, spolusprávce a zobrazit čekající žádosti/pozvánky.
- Zapnout/vypnout chat a nástěnku; nastavit výchozí záložku skupiny.
- Vidět nutná provozní metadata skupiny bez automatického přístupu k její soukromé komunikaci.
- Změny v detailu osoby a v detailu skupiny musí být **okamžitě konzistentní obousměrně** (jak ukazuje prototyp).

### 4.3 Správa → Konfigurace

- Konfigurace souboru, výchozí volby pro nové osoby/skupiny a moduly.
- Moduly minimálně: **Akce + docházka**, **Kroje + Krojárka**. Skupiny a jejich členství patří do jádra.
- Pravidlo, kdo zakládá skupiny: výchozí `pouze správci souboru`; volitelně `všichni aktivní členové`; budoucí `člen navrhne a správce schválí`.
- Volby komunikace na úrovni skupin (chat/nástěnka/default) nezaměňovat s globálním vypínáním modulu.

### 4.4 Nastavení (osobní)

Oddělená obrazovka dostupná každému přihlášenému. Obsahuje vlastní vzhled, výchozí přehledy, upozornění a preference notifikací. **Nesmí se zaměňovat se Správou souboru.**

---

## 5. Prvotní zavedení („prázdný soubor“)

Na začátku systém obsahuje jediného aktivního uživatele **#1**, který má pověření **Správa souboru**. V menu má nejméně Přehled, Správa a Nastavení. Ostatní moduly mohou být vypnuté, dokud nejsou nastaveny.

1. Uživatel #1 založí další osoby a skupiny.
2. U skupin vyplní název, slug, ikonu, viditelnost, případně chat a nástěnku.
3. Nastaví členství osob ve skupinách.
4. Určí hlavního správce a případné spolusprávce.
5. Příslušné osoby postupně převezmou běžnou správu svých skupin.
6. Uživatel #1 vidí obsah pouze těch soukromých skupin, k nimž má skutečný přístup z členství/explicitního oprávnění.

Správce souboru smí provést inicializační kroky a nastavit odpovědné osoby **bez nutnosti trvalého vlastního členství v každé skupině**. Pokud je dočasným správcem nové skupiny, má jít o transparentně označené přechodné pověření. Nesmí se tím tajně získat právo číst její soukromý obsah.

**Ochrana:** nelze odebrat/deaktivovat posledního správce souboru. Nelze bez náhrady odebrat posledního hlavního správce skupiny; musí se předat odpovědnost.

---

## 6. Vzorová Vonica – výchozí osoby a skupiny

### 6.1 Osoby a souborové funkce

| Osoba | Organizační funkce (informativní) |
|---|---|
| **Kuba D** | Organizační vedoucí; ve vzorovém scénáři má Správu souboru |
| **Aňyčka** | Vedoucí holek |
| **Áďa** | Kronikářka |
| **Tezi** | Umělecká vedoucí |
| **Staňa** | Vedoucí kluků |
| **Lucka Š** | Krojárka (pověření Správa krojů) |
| **Ivoš** | Hlavní vedoucí |
| **Marci** | Vedoucí dětského souboru |
| **Lucka Z** | Ekonomka |
| **Eriček** | Běžný člen |
| **Kačka** | Běžná členka |

Organizační funkce se mohou měnit bez nutnosti programových změn. Například ekonomka nemusí mít nyní žádné zvláštní systémové pověření, pokud zatím není modul Finance.

### 6.2 Skupiny v prvotním simulátoru

| Skupina | Členové | Hlavní správce | Spolusprávci |
|---|---:|---|---|
| **Výbor** | 9 (všichni kromě Erička a Kačky) | Ivoš | Kuba D |
| **Taneční složka** | 10 (všichni kromě Ivoše) | Kuba D | Tezi, Aňyčka, Staňa |
| **Kluci** | 4: Staňa, Ivoš, Kuba D, Eriček | Staňa | Kuba D |
| **Holky** | 7: Aňyčka, Áďa, Tezi, Lucka Š, Marci, Lucka Z, Kačka | Aňyčka | Tezi |

Další skupiny lze vytvářet, např. Muzika, Malá Vonica, Sklad, Propagace. **Počet osob a přiřazení výše je testovací scénář**, nikoliv definitivní personální evidence souboru.

### 6.3 Typické ověření správného modelu

- Kliknu na **Kačku** → vidím, že je členkou Taneční složky a Holek, nikoliv Výboru. Vidí chat a nástěnku vlastních skupin.
- Kliknu na **Aňyčku** → vidím členství ve Výboru, Taneční složce a Holkách a příslušná správcovská pověření.
- Kliknu na **Holky** → vidím sedm členek, Aňyčku jako hlavní správkyni a Tezi jako spolusprávkyni.
- Kliknu na **Kubu D** → vidím pověření Správa souboru a správu skupin Výbor, Taneční složka a Kluci. Soukromý obsah Holek mu není zpřístupněn.
- Při změně členství u osoby se bez rozdílu aktualizuje přehled stejné skupiny; a naopak.
- Pokud se později pozve externista na jedinou akci, nezíská tím členství v aktivních souborových skupinách.

---

## 7. Přijímání lidí do skupin a schvalování

Schvalování členství má chránit soukromí skupin, nikoliv samoúčelně přidávat administrativu. Běžný uživatel nemůže druhého člověka bez vědomí správce a přizvaného tajně zařadit do uzavřené skupiny.

### 7.1 Podporované scénáře

| Kdo zahájí | Tok | Kdo potvrdí |
|---|---|---|
| Člověk žádá o vstup | Žádost → čeká na rozhodnutí → členství | Hlavní správce nebo oprávněný spolusprávce |
| Člen navrhne další osobu | Návrh → schválení správcem → pozvánka → členství | Správce skupiny **a následně pozvaná osoba** |
| Správce pozve osobu | Pozvánka → přijetí → členství | Pozvaná osoba (správce návrh již povolil) |
| Správce odebere člena | Odebrání → zápis do historie → odebrání přístupů | Správce skupiny |
| Člen chce odejít | Opuštění → zápis do historie | Člen, pokud skupina nezůstane bez hlavního správce |

Výjimky (například inicializační hromadný import existujících členů nebo povinné oficiální skupiny) lze vyřešit explicitním oprávněním/konfigurací a auditním záznamem, nikoliv skrytou automatickou změnou.

### 7.2 Stavy, rozhraní a oznámení

- Žádost o přijetí má jasný stav: **čeká / přijato / zamítnuto / zrušeno**.
- Pozvánka má jasný stav: **čeká / přijata / odmítnuta / zrušena**.
- Hlavní správce a spolusprávci vidí čekající žádosti v detailu skupiny a mohou rozhodnout.
- Navržený člen nemusí automaticky získat přístup při pouhém odeslání návrhu či schválení; přístup se aktivuje až dokončením dohodnutého toku.
- Při schválení, přijetí, odebrání nebo změně správce se zapíše, **kdo, kdy a jak změnu provedl**.
- Správce souboru může konfigurovat skupinu a její správce, ale **nemůže obejít soukromí tichým vlastním vstupem**. Mimořádné zásahy musí být viditelné v historii a oznámené dotčeným správcům; konkrétní schvalovací politika se ještě upřesní.

### 7.3 Tři režimy viditelnosti (návrh k potvrzení)

- **Otevřená pro oprávněné publikum:** obsah je přístupný vymezenému okruhu (např. všem přihlášeným), ne nutně veřejnému internetu.
- **Soukromá:** skupina může být dohledatelná, ale chat/nástěnku čtou její členové; lze požádat o vstup.
- **Skrytá:** skupinu běžní nečlenové nevidí v nabídce; vstup na pozvání.

V každém případě platí, že **právo znát název či existenci skupiny není právem číst její obsah**. „Veřejná skupina“ nesmí náhodně publikovat citlivé osobní údaje nebo historii změn členství komukoliv na internetu.

---

## 8. Skupina jako samostatný komunikační prostor

### 8.1 Dva pohledy na komunikaci

Každá skupina může mít:

1. **Chat** – krátké běžné zprávy, okamžitou provozní domluvu a chronologický proud důležité aktivity.
2. **Nástěnku** – tematické příspěvky se samostatnou diskuzí, důležitější a déle dohledatelné informace, připnutí a archivaci.

**Závazně:** Při prvním zavedení chatu se chat zapne **pro všechny existující skupiny dospělé Vonice**, nikoliv pouze pro pilotní skupinu. Chat může mít každá nově založená skupina výchozím nastavením zapnutý.

**Konfigurace:** chat a nástěnku lze v nastavení skupiny nezávisle zapínat a vypínat. Je-li zapnuté obojí, skupina má **konfigurovatelnou výchozí záložku**; některá skupina může upřednostnit chat (např. Muzika), jiná nástěnku (např. Výbor). Pokud je zapnutá pouze jedna část, otevře se přímo ona. V budoucím dětském souboru může být chat vypnutý nebo výrazně omezený.

**Přístup:** Chat i nástěnka respektují oprávnění skupiny. Je třeba oddělit případné odlišné politiky (např. možnost příspěvek číst, ale nemoci komentovat), nikoliv předpokládat neomezený přístup pouze z přítomnosti skupiny v menu.

### 8.2 Co patří do chatu

Ve společné časové ose se zobrazují **tři základní zdroje**:

- **Běžné chatové zprávy** vložené přímo v dané skupině.
- **Aktivita příspěvků nástěnky:** nový příspěvek, nový komentář nebo skupina komentářů, připnutí důležitého postu.
- **Vybrané systémové události:** přijetí/odebrání člena, změna správce, důležitá změna akce či jiná relevantní událost.

Příklad:

```text
16:12 · Marcelka odebrána ze skupiny Holky · provedla Aňyčka
17:22 · Kačka přidána do skupiny Holky · provedla Tezi

19:10 · Kačka
Je tu někdo? Neměly jsme na 19 h sraz?

19:11 · Tezi
Jsme dole na pivu.

Právě teď · Tezi · komentář v příspěvku „Kroje na příští vystoupení“
@Anička Z Ano, vemte si všechny.
[Otevřít diskuzi k příspěvku]
```

Systémové události zobrazovat stručně a neutrálně; citlivé odůvodnění odebrání osoby nepublikovat do chatu. Detailní audit obsahuje i toho, kdo provedl úkon, a musí respektovat příslušná oprávnění.

### 8.3 Komentář má jeden originál a více pohledů

**Závazné pravidlo:** Komentář existuje jako jeden obsahový záznam patřící ke konkrétnímu příspěvku. V chatu se pouze zobrazuje jeho aktivita nebo náhled. Nikdy nevznikají dvě nezávislé kopie, které by se mohly rozejít.

- Komentář napsaný pod příspěvkem se objeví také v časové ose skupiny.
- Kliknutí na komentář v chatu otevře jeho původní příspěvek a správné místo diskuze.
- Odpověď odeslaná přes chatovou kartu se uloží do **téže diskuze příspěvku**, ne jako nová běžná chatová zpráva.
- Pokud autor komentář upraví či je příspěvek skryt/archivován, zobrazení v chatu se tomu musí přizpůsobit.
- Z chatu nelze obejít omezení přístupu k příspěvku ani jeho komentářům.

Komentáře pod příspěvkem tak mohou mít „chatový“ vzhled a průběžné načítání, ale zůstávají **tematickou konverzací svázanou s konkrétním postem**.

### 8.4 Automatické seskupování dlouhých diskuzí – povinné

**Závazné:** Implementovat **automatické seskupování** komentářů z téže diskuze při vyšší aktivitě, aby společný chat nezaplavily desítky zpráv a neztratila se běžná konverzace.

Požadované chování:

1. Jeden samostatný nový komentář se může zobrazit jako jedna karta s ukázkou textu, autorem, časem a názvem příspěvku.
2. Pokud v krátkém úseku přibývá více komentářů pod týmž příspěvkem, zobrazí se **jedna aktualizovaná souhrnná karta**, například: „12 nových komentářů v příspěvku Kroje na příští vystoupení“, s náhledem poslední reakce a odkazem do diskuze.
3. Při dalším přibývání komentářů se počet na této kartě aktualizuje; do chatu se nevloží další nová karta za každou reakci, pokud stále spadá do stejného seskupení.
4. Seskupují se pouze aktivity **téže skupiny a téhož příspěvku**, nikoliv nesouvisející diskuze.
5. Po otevření příspěvku se zobrazí **všechny jednotlivé komentáře** v jejich časovém pořadí. Žádný komentář se seskupováním nemaže ani nepřepisuje.
6. Agregace nesmí rozbít odkazy na jednotlivé komentáře, autory, datumy, možnost moderace ani jejich nepřečtený stav.
7. Počty „nových“ komentářů se počítají podle konkrétního uživatele a jeho stavu přečtení, nikoliv jako jedna globální konstanta pro všechny.

**Navržené výchozí parametry k ověření:** například od **3 nových komentářů pod jedním příspěvkem během 10 minut** zobrazit souhrnnou kartu; další komentáře v rámci pokračující aktivity zahrnout do stejného seskupení. Konkrétní prahy jsou nastavitelným implementačním detailem, lze je upravit po zkoušce se skutečnými daty. Hlavní závazek je **existence automatického seskupování od první verze chatu**.

**Příklad:**

```text
Kačka · 19:10
Je tu někdo?

Tezi · 19:11
Jsme dole na pivu.

💬 Kroje na příští vystoupení
12 nových komentářů · poslední: Aňyčka 19:14
„Ano, vemte si všechny.“
[Otevřít všech 12 komentářů]
```

Pro výchozí pohled není potřeba nabízet ruční „vypnutí seskupování“. Pokud se později objeví potřeba, lze přidat individuální filtr „vše / jen chat / aktivita nástěnky“.

### 8.5 Události z ostatních oblastí

Do chatu se mohou promítat vybrané události s odkazem na zdroj:

- nově publikovaný nebo připnutý příspěvek;
- podstatná změna akce (např. posunutí začátku);
- založení skupinové akce;
- později splnění úkolu, zveřejnění kronikářského zápisu či dokončení inventury.

**Nesmí se stát z chatu nekontrolovaný auditní log.** Je třeba odlišit plnou historii změn od událostí vhodných pro členy. Automaticky zde nepublikovat osobní údaje o zápůjčkách, neveřejnou docházku ani jiné citlivé informace.

---

## 9. Nástěnka, příspěvky a moderace

Nástěnka zůstává strukturovaným úložištěm důležitých sdělení:

- příspěvek má autora, čas vytvoření, obsah, případné připnutí a vlastní diskuzi;
- běžný člen příslušné skupiny může vytvářet příspěvky a komentáře podle pravidel skupiny;
- autor smí upravovat své příspěvky a komentáře a archivovat svůj příspěvek;
- správce skupiny smí připínat, skrývat, archivovat a obnovovat příspěvky, moderovat i cizí komentáře;
- správce **nemá tiše přepisovat cizí obsah jako autor**; moderátorské zásahy se zaznamenají;
- archivované či skryté příspěvky nesmějí zůstat přístupné přes chatové náhledy lidem, kteří k nim už nemají oprávnění;
- příspěvek má samostatný detail s úplnou historií diskuze a odkazy na související akce, bude-li toto propojení dostupné.

### 9.1 Přečtení postu není přečtení chatu

Je třeba oddělit minimálně:

1. **Přečtení samotného příspěvku** (dosavadní statistiky čtenosti).
2. **Přečtení nových komentářů v diskuzi**.
3. **Přečtení běžných chatových zpráv / událostí skupiny**.

Přečtení náhledu komentáře v chatu **nesmí automaticky označit původní příspěvek jako přečtený**, pokud uživatel reálně neotevřel příspěvek. Nové komentáře pod již přečteným postem nejsou totéž co znovu nepřečtený celý post.

Badge skupiny může vyjadřovat nové aktivity, ale má mít jasný a jednotný význam. **Nezaměňovat počet nových chatových událostí s počtem lidí, kteří přečetli post.**

---

## 10. Soukromí, audit a historie

### 10.1 Obsah nepatří automaticky vedení

- Správa účtů nebo konfigurace skupiny **neodemyká** její soukromý chat, nástěnku ani statistiky čtenosti.
- Vedoucí souboru (muž) nemusí mít právo číst diskuze skupiny Holky; totéž platí obousměrně pro všechny soukromé skupiny.
- Ke čtení skupinového obsahu opravňuje členství či jiný výslovně definovaný přístup, nikoliv technická pravomoc měnit metadata.
- Správce souboru se nesmí do soukromé skupiny tajně přidat. Přijetí nebo mimořádná změna členství je auditovaná a transparentní.
- Systém neslibuje absolutní soukromí před provozovatelem s přímým přístupem do infrastruktury/databáze. Je třeba odlišovat aplikační oprávnění od technického nouzového přístupu.

### 10.2 Historie členství a systémové zprávy

Přidání/odebrání člena či změna správce se uchovává v auditní historii, včetně aktéra a času. Vybrané změny se promítnou jako **neutrální systémové události do chatu**; důvody a citlivé interní poznámky zůstávají jen v oprávněné správě.

### 10.3 Historie nově přijatých členů – bezpečný návrh

**Navržený výchozí režim:** nově přijatý člen soukromé skupiny vidí běžný chat **od okamžiku vstupu**, nikoliv automaticky kompletní historii skupinové konverzace. Dříve publikované nástěnkové příspěvky mohou být dostupné podle pravidel nástěnky skupiny.

Pokud se toto pravidlo schválí, musí se konzistentně aplikovat také na **historické náhledy komentářů a systémových událostí v chatu**, vyhledávání i notifikace. Nesmí se stát, že přímé otevření starého odkazu obejde omezení. Historická data přitom zůstávají zachována pro oprávněné osoby.

### 10.4 Dětský soubor

Pro budoucí Malou Vonicu neplatí automaticky stejná komunikační práva jako pro dospělý soubor. Chat může být vypnutý nebo omezený, komunikace může být vedena dospělými a rodičovské účty mají zvláštní pravidla. **Zavedení chatu ve všech dospělých skupinách neznamená povolení neomezeného chatu mezi nezletilými.**

---

## 11. Notifikace a aktivní komunikace

Aplikace má časem nahradit podstatnou část dosavadního Messengeru a WhatsAppu, proto musí upozornění řešit promyšleně.

### 11.1 Minimální preference pro chat

- **Všechny nové zprávy** skupiny.
- **Jen zmínky `@jméno` a důležitá sdělení**.
- **Ztlumit chat skupiny**.

Zvolený režim platí pro daného uživatele/skupinu, ne pro všechny členy. Kriticky důležitá oznámení mohou mít vlastní pravidla, ale nesmí obcházet soukromí ani bezdůvodně spamovat.

### 11.2 Technologicky neutrální požadavek

Chat může v první fázi fungovat nad stávajícím backendem s periodickým načítáním nových událostí. **WebSocket není podmínkou pro spuštění chatu.** Web Push lze realizovat i na běžném PHP hostingu při splnění technických podmínek hostingu; zvolená implementace nemá být pevně navázaná na konkrétní přenosovou technologii.

Zpracování notifikací musí respektovat:

- oprávnění příjemce i v okamžiku odeslání;
- ztlumení skupiny a další preference;
- seskupování opakovaných událostí z jedné diskuze;
- nemožnost zobrazit v upozornění obsah soukromé zprávy člověku, který již ztratil přístup;
- možnost později přejít na realtime transport bez změny uživatelského modelu.

---

## 12. Implementační postup pro vývojovou AI

Doporučené pořadí je rozdělené na malé ověřitelné kroky. **Není cílem vše jedním velkým refaktorem přepsat.** Zachovat existující data, URL a hotové uživatelské scénáře všude, kde to dává smysl.

### Etapa A – pověření, osoby, Správa

1. Zavést rozdíl mezi členstvím ve skupině, organizační funkcí a pověřením s rozsahem.
2. Zajistit backendové kontroly pro všechny citlivé operace.
3. Nahradit uživatelsky sekci Administrace sekcí Správa: Členové, Skupiny, Konfigurace.
4. Přenést zkušenost ze `splk-simulator-opravneni.html`: propojený detail osoby/skupiny, správa hlavního správce a spolusprávců, náhled skutečných přístupů.
5. Zachovat nejméně jednoho aktivního správce souboru.
6. Migrovat dosavadní role a oprávnění **bez nechtěného rozšíření přístupu do soukromých skupin**.
7. V kontextu akce, nástěnky a Krojárky ukazovat příslušné ovládání jen osobám s oprávněním.

### Etapa B – žádosti o členství a audit

1. Žádost o vstup, návrh jiného člena, pozvánka, schválení/odmítnutí.
2. Rozhraní čekajících žádostí pro správce skupiny.
3. Audit změn členství, správce, pověření a moderace.
4. Transparentní zobrazení relevantních změn členům skupiny.

### Etapa C – skupinový chat pro všechny existující skupiny

1. Přidat chat do všech existujících skupin Vonice; skupina dostane záložky Chat a Nástěnka, pokud má obojí zapnuté.
2. Doplnit konfigurovatelnou výchozí záložku a individuální zapínání chatu/nástěnky.
3. Umožnit posílat, načítat a zobrazovat zprávy chronologicky s vhodným mobilním rozhraním.
4. Přidat vybrané systémové zprávy.
5. Připojit **jednotné události o aktivitě** nástěnek: komentář se objeví v chatu, ale zůstane pod původním postem.
6. **Hned v této etapě implementovat automatické seskupování delších komentářových diskuzí**, nikoliv jako pozdější optimalizaci.
7. Podporovat otevření správného příspěvku/komentáře z chatové karty a odpověď v původním kontextu.
8. Udržet korektní stavy přečtení, viditelnost a mobilní použitelnost.

### Etapa D – upozornění, integrace, doladění

1. Notifikace se zohledněním individuálních preferencí, případně Web Push.
2. Propojení skupinového chatu s relevantními změnami akcí.
3. Vyhledávání v povoleném obsahu s filtrací podle skupiny a času.
4. Optimalizace seskupování, stránkování, výkonu a počítání nepřečtených aktivit.

Výše je **návrh pořadí**, nikoli závazné očíslování produktových verzí. Funkce z tohoto dokumentu mohou být uvolňovány postupně, ale při zveřejnění chatové funkcionality se počítá se všemi skupinami a s automatickým seskupováním od začátku.

---

## 13. Akceptační scénáře a testy

### 13.1 Oprávnění a soukromí

- [ ] Kuba D může spravovat osoby a nastavení souboru, aniž by směl číst chat skupiny Holky, pokud není jejím členem.
- [ ] Aňyčka může spravovat Holky a schvalovat jejich členství, ale nemůže měnit nastavení jiné skupiny bez pověření.
- [ ] Tezi může vykonávat spolusprávu Holek i Taneční složky ve vymezeném rozsahu.
- [ ] Lucka Š může spravovat kroje bez všeobecného přístupu ke Správě souboru a cizím soukromým chatům.
- [ ] Správce souboru nemůže jen kvůli svému pověření upravit všechny akce, zaznamenat jakoukoliv docházku nebo vydat kroj.
- [ ] Pokus o přímé volání nepovolené operace přes API je zamítnut, i kdyby klient ručně zobrazil skryté tlačítko.
- [ ] Nelze odebrat posledního správce souboru a nechtěně ponechat skupinu bez hlavního správce.

### 13.2 Osoby a skupiny

- [ ] Detail člověka ukáže všechny jeho skupiny a označí hlavní správu / spolusprávu.
- [ ] Detail skupiny ukáže všechny členy, hlavního správce a spolusprávce.
- [ ] Změna v jednom přehledu se ihned promítne do druhého.
- [ ] Žádost o vstup se stane členstvím až po schválení oprávněným správcem.
- [ ] Návrh přidat někoho dalšího vyžaduje schválení správce a přijetí pozvaným.
- [ ] Nově založenou skupinu lze pojmenovat, nastavit slug, ikonu, chat, nástěnku a výchozí záložku.
- [ ] Odchod ze souboru nesmaže osobu, její historii ani otevřené krojové zápůjčky.

### 13.3 Chat a nástěnka

- [ ] Chat je po nasazení dostupný ve všech existujících skupinách dospělé Vonice, které ho nemají výslovně vypnutý.
- [ ] Skupina může otevřít Chat nebo Nástěnku jako svou výchozí záložku.
- [ ] Běžná chatová zpráva se objeví chronologicky a je viditelná jen oprávněným.
- [ ] Komentář napsaný pod příspěvkem se zobrazí i v chatu, včetně odkazu na post.
- [ ] Odpověď z chatové karty se uloží do původní diskuze, nikoliv jako nezávislá chatová zpráva.
- [ ] Při větším počtu komentářů v krátkém čase vznikne **jedna souhrnná karta**, ne lavina jednotlivých karet.
- [ ] Kliknutí na souhrn zobrazí všechny komentáře; žádná informace se nesmaže seskupováním.
- [ ] Skrytí příspěvku/skupiny nebo odebrání členství znemožní neoprávněný přístup i přes chatovou kartu, přímou URL, vyhledávání a notifikace.
- [ ] Zhlédnutí chatu samo o sobě neoznačí celý příspěvek za přečtený.
- [ ] Historie změn členů vytvoří neutrální systémové zprávy bez zveřejnění citlivých důvodů.
- [ ] Chat je ovladatelný na mobilu, zprávy jsou čitelné a nezakrývá je spodní navigace či klávesnice.

### 13.4 Regrese existujícího SPLK

- [ ] Akce a potvrzování účasti fungují jako před změnami.
- [ ] Evidence skutečné docházky zůstává funkční a přístupná pouze pověřeným.
- [ ] Krojárky mohou spravovat zápůjčky a inventury; běžní členové pouze své kroje.
- [ ] Dosavadní příspěvky, komentáře, jejich autoři a stavy přečtení se migrací neztratí.
- [ ] Nedojde k nechtěnému zpřístupnění dosud soukromého obsahu.

---

## 14. Otevřené otázky pro následné upřesnění

Vývoj lze začít bez definitivní odpovědi na všechny detaily, ale změny je nutné evidovat:

1. Přesné limity pro seskupení komentářů (výchozí návrh 3 komentáře / 10 minut) a zda se kombinují aktivity oddělené delší prodlevou.
2. Které systémové události se v chatu zobrazují členům a které jsou pouze v historii správy.
3. Zda nově přijatý člen skutečně uvidí chat jen od okamžiku vstupu, jak dlouho zůstávají dostupné archivované příspěvky a kdo je může vyhledávat.
4. Zda a jak výjimečně umožnit hlavnímu správci pověřit osobu nečlena technickou správou skupiny bez práva číst obsah.
5. Má zakládání skupin v konfiguraci skutečně nabízet hned režim „všichni aktivní členové“, nebo stačí připravit tuto volbu a zapnout později? Pro Vonici je výchozí režim „Správa souboru“.
6. Jak detailně se liší práva hlavního správce a spolusprávce skupiny a kdo smí pověřovat další osoby.
7. Které osobní údaje a statistik docházky mohou být v kartě člena viditelné správci souboru, organizátorovi a skupinovému vedoucímu.
8. Jak přesně započítávat badge nepřečtené aktivity při souběhu chatu a komentářů k postům, aby se nezapočítávaly duplicitně.
9. Zda je možné některé skupiny vytvořit pouze organizačně bez chatu i nástěnky, s jakým výchozím nastavením a jak přenést již existující obsah při pozdějším vypnutí.

**Tyto otevřené parametry nesmějí být důvodem k přepsání základních bezpečnostních principů.** Nejprve postavit jasná pověření a skupinovou viditelnost, poté sjednocenou komunikaci a související UX.

---

## 15. Stručné zadání pro implementační AI

> V existujícím SPLK postupně nahraď pevnou logiku systémových rolí pověřeními se správným rozsahem (soubor / skupina / akce / modul), bez automatického průniku do soukromé komunikace. Dosavadní „Administraci“ převeď na „Správu“ s obrazovkami Členové, Skupiny a Konfigurace podle UX principů z `splk-simulator-opravneni.html`. Zachovej obousměrně konzistentní správu členství, hlavních správců a spolusprávců, výchozí ochranu proti odebrání posledního správce a možnost schvalovat žádosti o členství. Všechny citlivé operace musí kontrolovat backend.
>
> Následně zaveď skupinový chat **ve všech stávajících skupinách Vonice současně**. Skupina má volitelný chat a nástěnku s konfigurovatelnou výchozí záložkou. Chat zobrazuje běžné zprávy, bezpečné systémové události a aktivitu příspěvků. Komentář pod nástěnkovým příspěvkem má jeden originál, ale zobrazuje se i v chatu; lze z něj přejít do původní diskuze a odpovídat do ní. **Při vyšší aktivitě komentářů stejného příspěvku je automaticky seskup do jedné aktualizované souhrnné karty**. Zachovej oddělené stavy přečtení, soukromí a možnost pozdějších push notifikací. Implementuj po malých ověřitelných blocích bez zbytečného refaktoringu a bez ztráty existujících dat.

---

*Dokument je funkční zadání a doplněk současné projektové dokumentace; neobsahuje návrh databázových tabulek ani kompletní technickou architekturu. Detail implementace musí respektovat stávající stack a již hotové části aplikace.*
