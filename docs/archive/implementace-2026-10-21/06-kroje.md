# 06 – Kroje: Moje kroje a Správa krojů (implementační stav)

Popis **skutečně implementovaného** chování modulu kroje (frontend, mock služby, stav v prohlížeči). Cílová funkční specifikace je `docs/06-specifikace-krojoveho-skladu.md` (dále „cíl dle docs/06“). Kód: `features/costumes/`.

Terminologie: **krojařka** = osoba s pověřením *Správa krojů*; **sklad** = místnost s nezapůjčenými kroji; agenda = **Správa krojů** (`/app/wardrobe`). Osobní pohled člena = **Moje kroje** (`/app/costumes`). Pozůstatek starého názvu: CSV soubory se jmenují `krojarna-sklad.csv` a `krojarna-vypujcky.csv`.

---

## 1. Přehled a architektura

- Dvě oddělené sekce:
  - **Moje kroje** (`/app/costumes`) – každý přihlášený člen, když je zapnutý modul `costumes`; jen čtení vlastních zápůjček + rezervace termínu inventury.
  - **Správa krojů** (`/app/wardrobe/*`) – záložky *Součástky* (`stock`), *Krojové karty* (`cards`), *Výpůjčky* (`loans`), *Inventury* (`inventories`), *Nastavení* (`settings`). `/app/wardrobe` přesměruje na `stock`.
- Vrstvy:
  - `CostumeStoreService` – jediný sdílený `BehaviorSubject<CostumeState>`; perzistence přes `demo-storage` (klíč `costumes`, localStorage; při změně `DEMO_DATA_VERSION` se stav znovu nasype ze seedu). Jediná zápisová cesta je `mutate()`.
  - `CostumesService` – kusy, zápůjčky, úkoly, externisté, nastavení fondu.
  - `InventoryService` – inventury, termíny, návštěvy, kontroly, uzavření.
  - `utils/costume-logic.ts` – čisté odvozené pohledy (popisky, dostupnost, číslování, krojová karta, souhrny).
  - `utils/costume-ops.ts` – čisté **mutující operace nad pracovní kopií** stavu (výdej, vrácení, výměna, kontrola, výchozí kroj); sdílí je běžná práce i inventura → výdej/vrácení/výměna mají jedinou implementaci.
  - `utils/inventory-logic.ts` – čisté funkce inventury (rozsah, pokrytí, rychlé zadání, rekapitulace).
  - Komponenty čtou `state$` přes `toSignal` a odvozují vše funkcemi z `utils`; nikdy nepíší do stavu přímo.
- Integrace mimo feature: navigace (položky *Moje kroje*, *Správa krojů*; „Moje kroje“ se navrhuje do spodní lišty jen tomu, kdo má něco zapůjčeno), Přehled (`dashboard/pending-actions.ts`: „Inventura krojů – vyberte termín“, „Vraťte X č. N“ u zápůjček po termínu), Správa → detail osoby (nastavení výchozího kroje, náhled efektivního přístupu „spravuje / prohlíží / jen vlastní kroje“), mazání osoby (`person-deletion.ts`: osoba s jakoukoli stopou v evidenci krojů nejde trvale smazat; výchozí kroj se při smazání odstraní).

### 1.1 Mechanika `mutate()`

```ts
mutate<T>(change: (draft: CostumeState, ctx: OpContext) => T, opts?: { self?: boolean; profile?: boolean }): Observable<T>
OpContext = { now: ISO, actorId: memberId ?? 0, ensembleId: 1 /* natvrdo */ }
```

1. Kontrola oprávnění (viz kap. 9). Odmítnutí → `AccessDeniedError('Krojový fond mění jen pověřené krojařky.')`.
2. `structuredClone` celého stavu → `change(draft, ctx)`.
3. Výjimka (typicky `CostumeRuleError`) → nic se neuloží, Observable skončí chybou. Jinak `subject.next(draft)` → uložení, vrací klon výsledku se zpožděním 150 ms.
- Tedy každá jednotlivá service metoda je **atomická** (všechno nebo nic). Sekvence více volání z UI (např. kontrola + vrácení) atomická není.
- Chyby v UI: `errorMessage(e)` vrátí text u `CostumeRuleError` a `AccessDeniedError`, jinak „Akci se nepodařilo provést.“ Zobrazuje se v `.error-box` dané obrazovky / panelu.

---

## 2. Datový model

Vše v jednom agregátu `CostumeState` (jeden soubor = `ensembleId` 1; pole `ensembleId` je u entit, ale nikde se nefiltruje).

```ts
CostumeState {
  classification: { ensembleId; genders: Option[]; regions: Option[]; variants: Variant[] }
  partTypes: CostumePartType[]; series: CostumeSeries[]; items: CostumeItem[]
  externals: ExternalPerson[]; loans: CostumeLoan[]; workOrders: CostumeWorkOrder[]
  kitTemplates: CostumeKitTemplate[]; events: CostumeEvent[]
  defaultCostumes: Record<borrowerKey, genderId>   // výchozí kroj osoby
  defaultSlotCapacity: number                      // výchozí kapacita termínu
  inventories; inventorySlots; inventoryVisits; inventoryChecks
}
Option  { id: string /* slug */; label }
Variant extends Option { partTypeIds: number[] }   // pro které druhy varianta dává smysl
```

### 2.1 Klasifikace a druhy součástek

- `genders` (pohlaví kroje, demo: mužské/ženské), `regions` (demo: několik regionů), `variants` (doplňkové rozlišení typu modré/bílé, nové/staré) – konfigurovatelné hodnoty, ne kód.
- `CostumePartType { id; name; genderId? }` – `genderId` chybí = druh pro oba kroje (např. čižmy). **Pohlaví druhu je jen informativní**; pohlaví kusu se vždy odvozuje z řady.
- ID nových možností (`addRegion`, `saveVariant`) = slug z labelu bez diakritiky, při kolizi `-2`, `-3`…; prázdný label → „Vyplňte název.“, duplicitní label (case-insensitive, cs) → „Taková možnost už existuje.“

### 2.2 Evidenční řada (`CostumeSeries`)

```ts
CostumeSeries { id; genderId; regionId; partTypeId; variantId?; allowNumberReuse?; note? }
```
- Řada = konkrétní kombinace klasifikace, např. „Mužské / Region / Košile“. Popisek `seriesLabel` = `"{pohlaví} / {region} / {druh}[ {varianta}]"`.
- **Varianta buď v klíči řady** (`variantId` → vlastní číselná řada, např. „Gatě modré“), **nebo atribut kusu** (`item.variantId` v řadě bez varianty). Rozhoduje se při zakládání řady.
- Unikátnost: kombinace (gender, region, partType, variant|'') → jinak „Řada {label} už existuje.“
- `allowNumberReuse` – výslovné pravidlo, že číslo vyřazeného kusu smí dostat nový kus. Výchozí: nerecyklovat.
- Řadu nelze smazat, přejmenovat ani změnit klíč (žádné API).

### 2.3 Fyzický kus (`CostumeItem`) – základní entita

```ts
CostumeItem {
  id; seriesId; number?            // chybí = zatím bez fyzického čísla
  variantId?                       // jen pokud není ve klíči řady
  size?; description?; note?       // note = dlouhodobá poznámka („povolený šev“)
  condition: 'ok' | 'needs-alteration' | 'damaged'
  issuable: boolean                // nevydatelné (praní, vada…) nezávisle na stavu
  location: 'store' | 'holder' | 'seamstress' | 'repair' | 'unknown'
  locationNote?
  retired?: { at; byMemberId; reason? }
  createdAt
}
```
- Identita pro lidi = **řada + číslo** (`itemLabel` = `"{seriesLabel} č. {n}[ (varianta)]"`, bez čísla „bez čísla“). Stejné číslo v různých řadách je v pořádku. V kódu stabilní `id`.
- Čtyři **nezávislé osy**: stav (`condition`), vydatelnost (`issuable`), fyzické umístění (`location`), držitel v evidenci (otevřená zápůjčka). Nemíchají se do jednoho enumu.
- Popisky: stav – V pořádku / Vyžaduje úpravu / Poškozeno; umístění – Ve skladu / U držitele / U švadleny / V opravě / Neznámé.
- Vyřazený kus zůstává v evidenci i s číslem a historií; nic se nemaže (kusy nemají delete).

#### Odvozená dostupnost (`itemAvailability`, priorita shora)

| hodnota | label | podmínka |
|---|---|---|
| `retired` | Vyřazeno | `item.retired` |
| `on-loan` | Zapůjčeno | existuje otevřená zápůjčka |
| `away` | Mimo sklad | `location !== 'store'` |
| `not-issuable` | Nevydatelné | `!issuable` |
| `available` | K vydání | jinak |

`issueBlocker` mapuje na důvod výdeje: „je vyřazený“ / „je už zapůjčený“ / „není fyzicky ve skladu“ / „je označený jako nevydatelný“.

### 2.4 Číslování

- `isNumberTaken(series, n, exceptId)`: číslo je obsazené, pokud ho v řadě má jiný kus, který je aktivní, **nebo** vyřazený a řada nemá `allowNumberReuse`.
- `nextFreeNumber`: bez recyklace = `max(všech čísel vč. vyřazených) + 1`; s recyklací = nejnižší neobsazené ≥ 1.
- `seriesStats`: `active`, `retired`, `maxNumber`, `unusedNumbers` (1..max, které nikdy žádný kus neměl – **mezera je validní**), `retiredNumbers` (čísla vyřazených, která aktuálně nemá aktivní kus).
- Validace čísla (`assertItemInput`): kladné celé číslo → jinak „Evidenční číslo musí být kladné celé číslo.“; obsazené → „Číslo N měl v řadě X vyřazený kus – řada nepovoluje opětovné použití čísel.“ nebo „Číslo N v řadě X už má jiný kus.“
- Historie starého a nového kusu se stejným číslem se nespojuje (jsou to různá `id`).

### 2.5 Držitel, externista, výchozí kroj

```ts
Borrower = { kind: 'member'; memberId } | { kind: 'external'; externalId }
borrowerKey: 'member-12' | 'external-3'   // i v URL krojové karty
ExternalPerson { id; name; contact?; note?; createdAt }   // bez účtu, bez skupin
```
- Externista krojů (`ExternalPerson`) je **samostatná entita v krojovém stavu**, nezávislá na `Member.isExternal` z modulu Správa (dva různé pojmy „externisty“).
- `borrowerLabel`: člen = `přezdívka (Jméno Příjmení)` (+ „ – bývalý člen“ u neaktivního); externista = `jméno – externista`; nenalezený = `Člen #id` / `Externista #id`.
- **Výchozí kroj** (`defaultCostumes[borrowerKey] = genderId`): jen preference pro řazení nabídky při výdeji, nikdy zákaz. Neurčeno = nabízí se vše. Nastavení: `setDefaultCostume` (neznámé pohlaví → „Neznámé pohlaví kroje.“; prázdné = smazat klíč). Demo seed jej odhaduje z převažujícího pohlaví držených kusů (`inferDefaultCostume`, remíza = neurčeno).

### 2.6 Zápůjčka (`CostumeLoan`)

```ts
CostumeLoan {
  id; itemId; borrower; issuedAt; issuedByMemberId
  dueAt?            // chybí = dlouhodobě
  note?             // poznámka k vydání
  replacesLoanId?   // vydáno jako náhrada při výměně
  inventoryId?; visitId?   // vydáno během inventurní návštěvy
  endedAt?; endedByMemberId?; endReason?: 'returned' | 'exchanged' | 'settled'; endNote?
}
```
- **Jedna zápůjčka = jeden konkrétní kus jednomu držiteli.** Komplet není podmínkou.
- Invariant: kus má nejvýš jednu otevřenou zápůjčku (vynuceno v `issueItem` přes `issueBlocker`).
- Ukončená zápůjčka zůstává v historii. Otevřená = bez `endedAt`.
- Po termínu (`isLoanOverdue`): `dueAt` existuje, zápůjčka otevřená a den `dueAt` < dnešní den (lokální čas, porovnání po dnech).

### 2.7 Pracovní úkol (`CostumeWorkOrder`)

```ts
CostumeWorkOrder { id; itemId; kind: 'alteration'|'repair'|'resewing'; description; status: 'open'|'in-progress'|'done'|'cancelled';
                   assignee? /* volný text */; dueAt?; createdAt; createdByMemberId; inventoryId?; closedAt?; resolution? }
```
- Labely: Úprava / Oprava / Přešití; Otevřený / Rozpracovaný / Hotovo / Zrušeno. Otevřený = `open | in-progress`.
- Dokončení úkolu **nemění** stav ani umístění kusu (v souladu s cílem dle docs/06).

### 2.8 Šablona kompletu (`CostumeKitTemplate`)

```ts
CostumeKitTemplate { id; name; genderId; regionId; partTypeIds: number[]; note? }
```
- Seznam druhů součástek pro kroj daného pohlaví + regionu. Není to sada kusů; slouží jen k upozornění „v kartě chybí: …“. Výdej ji nevynucuje.

### 2.9 Historie (`CostumeEvent`)

```ts
CostumeEvent { id; at; byMemberId; kind; itemId; text; note?; loanId?; inventoryId?; visitId?; workOrderId? }
kind: item-created | item-updated | item-retired | condition | location | issued | returned | exchanged | work-order | inventory-added
```
- Append-only log pohybů a změn kusu s lidsky čitelným `text` (generovaný v okamžiku zápisu, např. „Stav: V pořádku → Poškozeno“, „Umístění: Ve skladu → V opravě“, „Vydáno jako náhrada při výměně“).
- Kontroly inventur se do `events` nepíší (jsou v `inventoryChecks`), kromě změny stavu při kontrole a „nalezeno ve skladu“.
- Nezapisuje se: změna termínu zápůjčky, změny nastavení (řady, druhy, varianty, komplety), externisté, výchozí kroj.

### 2.10 Inventura (model)

```ts
InventoryScope { genderIds: string[]; regionIds: string[]; partTypeIds: number[]; variantIds: string[]; groupIds: number[] } // [] = bez omezení
Inventory {
  id; name; scope; scopeLabel /* zachycený popis filtrů */; startedAt; startedByMemberId
  targetItemIds: number[]        // SNAPSHOT cílových kusů
  holders: Borrower[]            // SNAPSHOT dotčených držitelů při zahájení
  additions: { itemId; at; byMemberId; note }[]   // výslovně přidané kusy
  slotCapacity: number
  closure?: { at; byMemberId; withDiscrepancies; reason?; verified; total; notPresented; unchecked }  // zmrazená rekapitulace
}
InventorySlot  { id; inventoryId; startsAt; endsAt?; capacity; place? }
InventoryVisit { id; inventoryId; borrower; slotId? /* chybí = bez rezervace */; status: 'booked'|'in-progress'|'completed'|'cancelled';
                 bookedAt; bookedByMemberId; completedAt?; completedByMemberId?; note? }
InventoryCheck { id; inventoryId; itemId; at; byMemberId; mode: 'person'|'stock'; presented: boolean;
                 condition? /* jen u předloženého */; note?; visitId?; revokedAt?; revokedByMemberId? }
```
- Labely návštěv: Objednán / Probíhá / Odbaven / Zrušeno; v UI navíc „Neobjednán“.

---

## 3. Stavové automaty

### 3.1 Kus

```
[založen: ok, issuable, store]
  store ──issue──> holder ──return──> store
  store/seamstress/repair/unknown ──setLocation──> store/seamstress/repair/unknown   (ne 'holder')
  holder ──setLocation('unknown')──> unknown (zápůjčka zůstává otevřená; jiné cíle zakázány)
  * ──retire──> retired (konečný; zápůjčka se musí vypořádat)
```
- `holder` vzniká **jen výdejem** („Kus se k držiteli dostane jen výdejem.“).
- Zapůjčený kus: změna umístění kromě `unknown` → „Kus je zapůjčený – nejdřív zapište jeho vrácení.“
- Vyřazený: `updateItem` → „Vyřazenou součástku nelze upravovat.“, `setLocation` → „Vyřazená součástka nemá umístění.“, opakované vyřazení → „Součástka už je vyřazená.“, úkol → „Na vyřazenou součástku nelze zadat úkol.“
- Stav/vydatelnost (`setCondition`) lze měnit kdykoli, nezávisle na umístění (služba ji nezakazuje ani u vyřazeného kusu, UI ji tam nenabízí).

### 3.2 Zápůjčka

```
open ──returnLoan(reason 'returned')──> ended/returned
open ──exchangeItem(originalReturned=true)──> ended/exchanged  (+ nová zápůjčka s replacesLoanId)
open ──exchangeItem(originalReturned=false)──> zůstává open   (+ nová zápůjčka; událost „Výměna bez vrácení…“)
open ──retireItem(settleOpenLoan=true)──> ended/settled (endNote „Vypořádáno vyřazením: důvod“)
ended ──*──> „Zápůjčka je už ukončená.“
```

### 3.3 Pracovní úkol

`open → in-progress → done | cancelled` (UI). Služba `updateWorkOrder` přechody **nevaliduje** (lze i znovu otevřít); `closedAt` se nastaví při přechodu z otevřeného do uzavřeného, smaže při návratu do otevřeného. `resolution` se přepíše jen neprázdnou hodnotou.

### 3.4 Návštěva inventury

```
(žádná) ──bookSlot──> booked ──bookSlot(jiný termín)──> původní cancelled + nová booked
booked ──cancelBooking──> cancelled
booked | (žádná) ──startVisit──> in-progress   (bez rezervace se založí nová visit bez slotId)
booked | in-progress ──completeVisit──> completed
completed ──startVisit──> nová in-progress („Zahájit další návštěvu“)
uzavření inventury: všechny booked → cancelled (in-progress zůstávají)
```
- „Aktuální návštěva“ osoby = poslední nezrušená (`currentVisit`).

### 3.5 Inventura

`open (bez closure) → closed (closure)`. Všechny zápisy do inventury (`addItem`, sloty, rezervace, návštěvy, kontroly, zrušení kontroly, rychlé zadání, uzavření) volají `findOpenInventory` → „Inventura nebyla nalezena.“ / „Inventura je uzavřená.“ Uzavřenou nelze znovu otevřít.

---

## 4. Mutace `CostumesService` – pravidla a hlášky

| metoda | pravidla (CostumeRuleError) | vedlejší efekty |
|---|---|---|
| `createItem(ItemInput)` | řada musí existovat („Vyberte evidenční řadu.“); variantu nelze zadat, je-li v klíči řady („Varianta je už součástí řady.“); číslo dle 2.4 | nový kus `ok/issuable/store`; událost `item-created` |
| `updateItem(id, ItemInput)` | ne vyřazený; jako create (číslo vůči ostatním kusům) | lze změnit i řadu a číslo (i u zapůjčeného kusu); událost „Změněno označení: A → B“ / „Upraveny údaje“ |
| `setCondition(id, cond, issuable, note?)` | – | událost „Stav: …“ (nebo „beze změny“) |
| `setLocation(id, loc, note?)` | viz 3.1 | `locationNote`, událost |
| `retireItem(id, reason, settle)` | ne už vyřazený; důvod povinný („Uveďte důvod vyřazení.“); otevřená zápůjčka bez `settle` → „Součástka je zapůjčená – nejdřív vyjasněte, jak se zápůjčka vypořádá.“ | ukončí zápůjčku jako `settled`; `location` se nemění |
| `issueItems({borrower, itemIds, dueAt?, note?, inventoryId?, visitId?})` | ≥1 kus („Vyberte alespoň jeden kus.“); bez duplicit („Kus je ve výběru dvakrát.“); každý kus bez blokátoru („{label} je už zapůjčený.“ apod.) | per kus nová zápůjčka, `location='holder'`, událost `issued`; celé atomicky |
| `returnLoan(loanId, {note?, condition?, issuable?, reason?, inventoryId?, visitId?})` | zápůjčka existuje a je otevřená | `location='store'`, volitelně stav/vydatelnost; událost `returned` / `exchanged` |
| `exchangeItem({loanId, originalReturned, newItemId, note?, …})` | původní otevřená („Původní zápůjčka je už ukončená.“); jiný kus („Vyberte jiný kus, než který se vyměňuje.“); nový kus vydatelný | viz 3.2; nová zápůjčka přebírá `dueAt` původní |
| `setLoanDue(loanId, dueAt?)` | otevřená | bez události; **UI ji nepoužívá** |
| `createWorkOrder(input)` | kus ne vyřazený; popis povinný („Popište, co je potřeba udělat.“) | událost „Nový úkol: …“ |
| `updateWorkOrder(id, status, resolution?, assignee?)` | úkol existuje | viz 3.3; událost |
| `createExternal / updateExternal` | jméno povinné („Vyplňte jméno.“) | `updateExternal` **nemá UI** |
| `createSeries`, `setSeriesNumberReuse` | unikátnost řady | – |
| `createPartType(name, genderId?)` | název povinný; unikátní (název + pohlaví) | – |
| `addRegion(label)`, `saveVariant({id?, label, partTypeIds})` | slug/duplicita (2.1); varianta musí mít ≥1 druh | `saveVariant` umí i úpravu, UI jen přidává |
| `saveKitTemplate`, `deleteKitTemplate` | název, ≥1 druh | delete bez potvrzení |
| `setDefaultSlotCapacity(n)` | kladné celé číslo | – |
| `setDefaultCostume(borrower, genderId?)` | známé pohlaví | `mutate(..., {profile:true})` |

Chybí API pro: mazání/přejmenování řad, druhů, regionů, variant; editaci pohlaví (`genders`); mazání kusů; zrušení vyřazení; mazání externistů.

---

## 5. Mutace `InventoryService` – pravidla a hlášky

| metoda | pravidla | efekty |
|---|---|---|
| `createInventory({name, scope, scopeLabel, slotCapacity?}, members)` | prázdný rozsah → „Rozsah inventury je prázdný – upravte filtry.“ | snapshot `targetItemIds` + `holders`; prázdný název → „Inventura {datum}“; kapacita z inputu nebo `defaultSlotCapacity` |
| `addItem(invId, itemId, note)` | ne vyřazený; ne už v rozsahu („Kus už do inventury patří.“); důvod povinný („Uveďte, proč se kus do rozsahu přidává.“) | `additions[]` + událost `inventory-added` |
| `addSlot(invId, {startsAt, endsAt?, capacity?, place?})` | začátek povinný; kapacita kladné celé; konec > začátek | – |
| `removeSlot(slotId)` | nezrušené rezervace → „Na termín jsou přihlášení lidé – nejdřív jim rezervaci zrušte.“ | (nekontroluje, zda je inventura otevřená) |
| `bookSlot(invId, slotId, borrower?)` | bez `borrower` = člen za sebe (`self`); termín existuje; člen musí být dotčený („Tato inventura se vás netýká – nemáte zapůjčený žádný kus z jejího rozsahu.“); ne během probíhající návštěvy; ne dvakrát na stejný termín („Na tento termín už jste přihlášeni.“); volná kapacita („Termín je už plně obsazený – vyberte jiný.“) | přeobjednání zruší původní `booked` |
| `cancelBooking(visitId)` | jen `booked` („Zrušit lze jen rezervaci, která ještě neproběhla.“) | člen vlastní rezervaci jako `self`, jinak krojařka |
| `startVisit(invId, borrower)` | otevřená inventura | viz 3.4 (nekontroluje dotčenost osoby) |
| `completeVisit(visitId, note?)` | ne completed / cancelled | lze i s nevyřešenými kusy |
| `recordCheck(CheckOp)` | kus v rozsahu („{label} nepatří do rozsahu inventury – přidejte ho výslovně.“); stav jen u předloženého („Stav lze posoudit jen u předloženého kusu.“) | nová kontrola; liší-li se posouzený stav od `item.condition`, přepíše ho + událost `condition` |
| `revokeCheck(checkId)` | ne už zrušená | `revokedAt` – kontrola zůstává v historii |
| `quickEntry(invId, seriesId, text)` | – | parse + klasifikace; kontroly (`presented, mode 'stock'`, bez stavu) jen pro `verified`; vrací `{results, errors}` |
| `confirmFoundInStore(invId, itemId, note?)` | kus nesmí být zapůjčený („… je zapůjčený – nejdřív zapište vrácení.“) | ověřující kontrola; je-li mimo sklad, `location='store'` + událost „Nalezeno při inventuře ve skladu…“ |
| `closeInventory(invId, {acceptDiscrepancies, reason?})` | neúplné bez souhlasu → „Inventura má nevyřešené nesrovnalosti – lze ji uzavřít jen výslovně s uvedením důvodu.“; bez důvodu → „Uveďte důvod uzavření s nesrovnalostmi.“ | `closure` se zmrazenými čísly; booked → cancelled |

---

## 6. Logika inventury (`inventory-logic.ts`)

### 6.1 Rozsah (`resolveScope`)
- Filtry klasifikace (pohlaví, region, druh, varianta) – v rámci dimenze OR, mezi dimenzemi AND (průnik). Varianta kusu = varianta řady ?? varianta kusu.
- Vyřazené kusy nikdy.
- **Bez skupin:** zapůjčené i nezapůjčené (sklad, oprava, švadlena, neznámé).
- **Se skupinami:** jen kusy s otevřenou zápůjčkou **členovi** některé vybrané skupiny (externisté a skladové zásoby vypadnou). Člen ve více skupinách / kus se nepočítá dvakrát.
- Vrací `itemIds`, `holders` (unikátní držitelé zapůjčených cílových kusů), `loanedCount`, `unloanedCount`.
- `scopeLabel`: `"Ženské / Region"` nebo „Celý fond“, se skupinou `" · zapůjčeno skupině X"`.
- Cílové kusy = `targetItemIds ∪ additions`. Pozdější výměna / výdej / změna skupiny rozsah **nemění**.

### 6.2 Stav kusu v inventuře (`itemInventoryState`)
- Z nezrušených kontrol daného kusu: `verified` = existuje aspoň jedna `presented`. Stav: `verified` › `not-presented` (existuje jen nepředložení) › `unchecked`.
- Fyzicky viděný kus zůstává ověřený i po pozdějším „nepředloženo“ (to je omyl, opravuje se zrušením zápisu).
- `latest` = poslední předložená kontrola (u ověřeného), jinak poslední kontrola.
- Pokrytí se počítá z **unikátních kusů**, ne z počtu kontrol.

### 6.3 Lidé a návštěvy
- **Dotčení** (`affectedBorrowers`) = snapshot `holders` ∪ aktuální držitelé cílových kusů (např. nový držitel po výměně/výdeji v inventuře).
- Rezervovat se smí jen dotčený člen (`isEligibleForBooking`). Externisté se neobjednávají sami (nemají účet); krojařka je odbaví přes „Zahájit návštěvu“.
- `personRows`: pro každého dotčeného status (`not-booked` vč. zrušené, `booked`, `in-progress`, `completed`), slot, `held` = cílové kusy, které **teď** drží, `verified/notPresented/unchecked`.
- `slotFree` = kapacita − nezrušené návštěvy na slotu (booked + in-progress + completed).
- `invitationsFor(memberId)` = otevřené inventury, kde je člen dotčený.

### 6.4 Sklad po řadách (`stockGroups`)
- Cílové kusy, které nejsou vyřazené a **nejsou zapůjčené**, seskupené podle řady, seřazené podle čísla. Kus vrácený během inventury se objeví, nově vydaný zmizí – kontroly jsou společné oběma režimům.

### 6.5 Rychlé zadání čísel
- `parseNumberInput(text)`: oddělovače čárka / středník / mezery; rozsah `a-b` (i en/em pomlčka a mezery kolem pomlčky). Chyby: „„x“ není číslo.“, „Rozsah „9-3“ je obráceně.“, „Rozsah „…“ je příliš velký (najednou nejvýš 200 čísel).“ (limit `MAX_BATCH_NUMBERS = 200` kumulativně v dávce).
- `classifyQuickEntry` – pro každé číslo v pořadí výsledek:

| outcome | zpráva | potvrdí se? |
|---|---|---|
| `repeated` | zadáno v dávce vícekrát | ne |
| `unknown` | v řadě neexistuje | ne |
| `retired` | kus s tímto číslem je vyřazený | ne |
| `out-of-scope` | nepatří do rozsahu inventury | ne |
| `duplicate` | už ověřeno | ne |
| `on-loan` | podle evidence je zapůjčený – kontroluje se u držitele | ne |
| `away` | podle evidence není ve skladu – potvrďte ručně | ne |
| `verified` | ověřeno | **ano** (kontrola bez posouzení stavu) |

### 6.6 Průběh, uzavření, rekapitulace
- `inventoryProgress`: návštěvy (`people`, `booked` = booked+in-progress, `completed`, `notBooked`), pokrytí (`total`, `verified`), nesrovnalosti (`notPresented`, `unchecked`, `damaged`/`needsAlteration` z posledních ověřujících kontrol, `openWorkOrders` na cílových kusech).
- `canCloseCleanly` = `total > 0 && verified === total`. Jinak jen „uzavřít s nesrovnalostmi“ s důvodem; aplikace pak netvrdí úplnost.
- `visitRecap(borrower, visitId)`: kusy osoby v rozsahu (držené + vrácené/vyměněné během inventury) rozdělené na ověřené / poškozené / k úpravě / nepředložené / nezkontrolované; pohyby = události s `visitId`; otevřené úkoly na těchto kusech.
- `exchangeCandidates(original)`: dostupné kusy (ne vyřazené, nezapůjčené, ve skladu, vydatelné) jen **ze stejné řady** (rank 0) nebo **stejného druhu a pohlaví** (rank 1); jiné se nenabízejí.

---

## 7. Obrazovky a uživatelské toky

Společné: všechny stránky Správy krojů mají záložkovou navigaci; zápisové ovládací prvky jsou za `canManageCostumes()`; uživatel s *Náhledem* vidí stejná data jen ke čtení (na Součástkách info „Fond můžete prohlížet; změny zapisují pověřené krojařky.“). Formuláře jsou signal-based bez Reactive Forms; validace hlavně ve službě.

### 7.1 Moje kroje (`/app/costumes`, `MyCostumesPageComponent`)
- Pro přihlášeného člena (`memberId`). Odkaz „Správa krojů →“ jen s náhledem/správou.
- **Inventurní výzvy** (pro každou otevřenou inventuru, kde je dotčený):
  - Text „Přineste prosím na zvolený termín tyto kusy:“ + seznam **dosud neověřených** cílových kusů, které drží (druh + číslo + řada). Po dokončené návštěvě: „Vaše kontrola proběhla {datum}.“ (+ „Ještě je potřeba donést:“).
  - Rezervovaný termín: info box se „Zrušit rezervaci“.
  - Pokud zbývá co přinést a návštěva neprobíhá: seznam **budoucích** termínů s „volno X z Y“; tlačítko „Přihlásit se“ / štítek „Váš termín“ / „Obsazeno“. Bez termínů: „Krojařky zatím nevypsaly žádné termíny.“
  - Volá `bookSlot(inv, slot)` (self) / `cancelBooking`; chyby v error boxu.
- **Krojová karta** (jen čtení): skupiny `cardGroups` („{Region} – mužský/ženský kroj“), u kusu druh + číslo, řada, velikost, od kdy, „vrátit do“ / „dlouhodobě“, štítek „Po termínu“. Prázdná: „Nemáte zapůjčenou žádnou součástku kroje…“. Poznámka o odpovědnosti při neohlášeném předání.
- Upozornění na chybějící druhy z šablony se v Moje kroje nezobrazuje (jen ve Správě krojů).
- Kompaktní widget `app-my-costumes` (na Přehledu): řádky `myCostumeRows` + text „Inventura: X – vyberte si termín v Mých krojích.“
- Cíl dle docs/06 kap. 6/6A: omezený přehled pro bývalé členy a zápůjčky z jiného souboru („Zapůjčeno z Malé Vonice“) – neimplementováno.

### 7.2 Součástky (`/wardrobe/stock`, `WardrobeStockComponent`)
- **Statistiky** (`stockSummary`, bez vyřazených) jako klikací dlaždice nastavující filtr: evidovaných, k vydání, zapůjčeno, mimo sklad, otevřených úkolů; odkazy na Výpůjčky `?filter=overdue` a Inventury.
- Toolbar: „+ Nová součástka“, „Vydat kusy“ (jen krojařka), „Tisk“ (`window.print()`, prvky `.no-print` skryté), „Export CSV“.
- **Filtry** (`StockFilter`): hledání (řada, číslo, velikost, popis, držitel; bez diakritiky), pohlaví, region, druh, dostupnost (výchozí „Evidované (bez vyřazených)“; vyřazené jen výslovným filtrem „Vyřazeno“), stav, umístění, „Jen s otevřeným úkolem“. Query params `?availability=…&workOrders=1` se čtou při načtení. Filtr `seriesId` existuje v utilu, UI ho nemá.
- Výpis seskupený po řadách (řazení: label řady, číslo, id; kusy bez čísla na konec). Řádek: číslo, varianta, velikost, štítky dostupnosti/stavu/„úkol“, umístění + poznámka, držitel, popis. Klik → detail.
- CSV `krojarna-sklad.csv` (UTF-8 BOM, `;`, CRLF): Řada; Číslo; Varianta; Velikost; Dostupnost; Stav; Umístění; Držitel; Poznámka – respektuje aktuální filtr.

### 7.3 Nová / úprava součástky (`/stock/new`, `/stock/:id/edit`, guard krojařka)
- Výběr řady (seřazené podle labelu); pod ním statistika řady: počet kusů, nejvyšší číslo, čísla vyřazených (s informací, zda se smí znovu použít), nepoužitá čísla.
- Číslo: při výběru řady u nového kusu se předvyplní `nextFreeNumber` (+ odkaz „Navržené číslo“); prázdné = „zatím bez čísla“.
- Varianta (atribut kusu) se nabízí jen u řady bez varianty a jen varianty platné pro druh řady.
- Velikost, Popis, Dlouhodobá poznámka. Odkaz „Nová evidenční řada…“ → Nastavení.
- Uložit → `createItem`/`updateItem` → přesměrování na detail; chyby v error boxu. Klientská kontrola jen „Vyberte evidenční řadu.“

### 7.4 Detail součástky (`/stock/:id`)
- Hlavička: label kusu, štítky dostupnost / stav / „Nevydatelné“.
- Tabulka: řada, číslo, klasifikace (varianta „(součást řady)“ při variantě v klíči), velikost, popis, poznámka, umístění + upřesnění, držitel v evidenci (odkaz na kartu, od, vrátit do), **„Naposledy fyzicky viděn“** (`lastSeen`: nejnovější z předložené nezrušené kontroly inventury / výdeje / vrácení – vypořádání se nepočítá), vyřazení.
- Akce krojařky (jen u nevyřazeného): Upravit údaje; Vydat (jen když `available`, → loan form `?item=id`); panely **Stav** (3 tlačítka stavu + „Lze vydat“ + poznámka), **Umístění** (Ve skladu / U švadleny / V opravě / Neznámé + upřesnění; předvybrané `unknown`, pokud je kus u držitele), **+ Úkol** (`WorkOrderForm`), **Vyřadit** (text o osudu čísla dle pravidla řady; u zapůjčeného checkbox „vypořádat zápůjčku vyřazením (ztráta, odkup…)“; důvod povinný).
- Je-li zapůjčen: sekce Zápůjčka s `LoanActions` (vrátit / vyměnit / úkol).
- Sekce **Pracovní úkoly** (vše na kusu, nejnovější první; tlačítka Rozpracováno / Hotovo (`window.prompt` „Jak byl úkol vyřešen?“) / Zrušit úkol), **Historie držení** (všechny zápůjčky; „(výměna)“, důvod ukončení, poznámky), **Inventurní kontroly** (vč. zrušených – šedě „(zrušeno)“), **Změny a pohyby** (události; autor = přezdívka nebo „krojařka“).

### 7.5 Krojové karty (`/wardrobe/cards`)
- Seznam držitelů s otevřenými zápůjčkami (volitelně „I lidé bez zapůjčených kusů“ = všichni aktivní členové + externisté/bývalí s kusy). Hledání podle jména. Řádek: label, počet kusů, názvy skupin kroje, štítky „Po termínu“ a „chybí: {druh}“ ze šablon.
- Sekce **Externisté**: info text, „+ Přidat externistu“ (jméno *, kontakt; poznámku UI neumožňuje) → `createExternal`; seznam všech externistů s odkazem na kartu. Úprava externisty v UI chybí.

### 7.6 Krojová karta držitele (`/wardrobe/cards/:key`, key = `member-N` / `external-N`)
- Hlavička + „+ Vydat kusy“ (`/loans/new?borrower=key`).
- **Výchozí kroj**: select (neurčeno / pohlaví) pro krojařku **nebo Správu souboru**; jinak jen text.
- Skupiny `cardGroups`: seskupení zapůjčených kusů podle region|pohlaví kusu (jen pro čitelnost), v každé skupině upozornění „Podle šablony „X“ v kartě chybí: … (Jen upozornění – komplet není podmínkou výpůjčky.)“ pro šablony stejného pohlaví+regionu. Kusy seřazené podle druhu a čísla; štítky stav ≠ ok, „Po termínu“, „Mimo výchozí kroj“. U každého kusu `LoanActions` (krojařka).
- Historie výpůjček: ukončené zápůjčky držitele (vrácení / „(výměna)“ / „(vypořádáno)“, poznámka k ukončení).

### 7.7 Výpůjčky (`/wardrobe/loans`)
- Segment: Zapůjčeno (výchozí) / Po termínu / Vše včetně historie; `?filter=` v URL při načtení. Hledání v držiteli i kusu.
- Řádek = jedna zápůjčka: kus (odkaz), štítky „Po termínu“ / Vráceno / Vyměněno / Vypořádáno, držitel (odkaz na kartu), vydáno, vrátit do, ukončeno, poznámka. Řazení: držitel, kus, novější výdej.
- CSV `krojarna-vypujcky.csv`: Držitel; Kus; Vydáno; Vrátit do; Ukončeno; Poznámka (dle filtru).

### 7.8 Vydat kusy (`/wardrobe/loans/new`, guard krojařka)
- **Komu**: hledání + listbox aktivních členů a všech externistů krojů (předvyplnění `?borrower=`). Vybraný zůstává v seznamu i při filtrování.
- **Které kusy**: `ItemPicker` (multi) nad všemi `available` kusy; předvyplnění `?item=`.
- „Vrátit do“ (date; prázdné = dlouhodobě), poznámka. Tlačítko „Vydat N ks“ (disabled bez držitele / kusů) → `issueItems` → přesměrování na kartu držitele.

#### `ItemPicker` (sdílený)
- Hledání v labelu kusu a čísle; radio/checkbox.
- S výchozím krojem osoby: nejdřív odpovídající kusy (pohlaví řady = výchozí kroj), ostatní skryté za „Zobrazit všechny kusy (další N)“; vybrané zůstávají vidět vždy; u neodpovídajících „· mimo výchozí kroj“. Nikdy nezakazuje.

### 7.9 `LoanActions` (krojová karta, detail kusu, inventurní návštěva)
Tři režimy nad jednou otevřenou zápůjčkou:
- **Vrátit**: stav při převzetí (předvyplněn aktuální), „Lze znovu vydat“, poznámka. V inventurním kontextu, je-li kus v rozsahu a dosud neověřený: info „vrácení zároveň zapíše jeho ověření“ → nejdřív `recordCheck(presented, condition, mode 'person')`, pak `returnLoan(...)`.
- **Vyměnit**: checkbox „Původní kus byl skutečně předložen a vrácen“ (výchozí ano; při ne varování, že původní zůstane otevřený a neověřený). Výběr náhrady z `exchangeCandidates` s preferencí výchozího kroje. V inventuře: je-li nový kus v rozsahu, checkbox „Nový kus jsem fyzicky zkontrolovala (započítá se do inventury)“, jinak info, že rozsah se nemění. Sekvence: (kontrola původního) → `exchangeItem` → (kontrola nového).
- **+ Úkol**: `WorkOrderForm` (druh, popis *, kdo řeší, do kdy).
- Sekvence volání jsou spojené `concat` – **nejsou atomické** (viz kap. 12).

### 7.10 Inventury – seznam (`/wardrobe/inventories`)
- Otevřené nahoře, pak podle data zahájení. Štítek Probíhá / Uzavřeno / Uzavřeno s nesrovnalostmi; scopeLabel; progress bar ověření; „Fyzicky ověřeno X / Y kusů · odbaveno A / B lidí · nepředloženo N“. „Založit inventuru“ jen krojařka.

### 7.11 Nová inventura (`/inventories/new`, guard krojařka)
- Název (prázdný → automatický), checkboxy pohlaví / region / druh / varianta / skupina členů (ze `GroupsService`), kapacita termínu (výchozí `defaultSlotCapacity`).
- **Živý náhled** `resolveScope`: popis filtrů, kusů celkem, dotčených držitelů, zapůjčených, nezapůjčených; prázdný rozsah = varování + disabled „Zahájit inventuru“. Po zahájení → detail.

### 7.12 Detail inventury (`/inventories/:id`, `?tab=people|stock|slots|issues`)
- Hlavička: název, scope, kdo/kdy zahájil, „rozsah zmrazen na N kusů“ (+ výslovně přidané). Po uzavření box s rekapitulací (s nesrovnalostmi: ověřeno/total/nepředloženo/nezkontrolováno + důvod).
- 4 statistiky: lidé odbaveno / objednáno / neobjednáno; unikátní kusy ověřeno / total (progress); otevřené (nepředloženo + nezkontrolováno); poškozeno / k úpravě / úkoly.
- **Podle lidí**: filtr Všichni / Neobjednaní / Objednaní (vč. probíhajících) / Odbavení s počty, hledání; řádek = osoba, status, „nepředloženo N“, „ověřeno X / Y kusů“, termín → klik na návštěvu.
- **Ve skladu**: řady se nezapůjčenými cílovými kusy, „ověřeno X / Y“ + progress → mřížka řady. Prázdné: „inventura skupiny kontroluje jen zapůjčené“.
- **Termíny**: seznam (čas, obsazenost X / kapacita, místo, jména přihlášených); „Odebrat termín“ jen u termínu bez rezervací; formulář nového termínu (začátek, konec – datetime-local; kapacita – výchozí z inventury; místo – výchozí „Sklad“). Rezervace za jiného člověka ani její zrušení krojařkou v UI **nejsou** (služba `bookSlot(…, borrower)` to umí).
- **Nesrovnalosti a uzavření**: seznamy nepředložené (s poznámkou kontroly), nezkontrolované (s držitelem / „sklad (ve skladu|mimo sklad)“), poškozené / k úpravě / s otevřeným úkolem (podle aktuálního stavu kusu). Krojařka: **výslovné přidání kusu** (hledání mezi nevyřazenými kusy mimo rozsah, max 50, důvod *) + výpis přidaných; **uzavření** – při úplném ověření „Uzavřít – vše ověřeno“, jinak varování + důvod * + checkbox „Beru na vědomí, že N kusů zůstává neověřených“ → „Uzavřít s nesrovnalostmi“. Export CSV `inventura-{id}.csv`: Kus; Držitel / umístění; Výsledek; Stav; Poznámka.

### 7.13 Inventurní návštěva – režim „Podle lidí“ (`/inventories/:id/visit/:key`)
- Hlavička: osoba, status návštěvy, termín, kdo/kdy dokončil, nebo „bez rezervace“.
- Krojařka bez probíhající návštěvy: „Zahájit návštěvu“ / „Zahájit další návštěvu“ (po dokončené) → `startVisit`. Teprve **probíhající** návštěva zpřístupní zápis.
- **Kusy z rozsahu** (cílové kusy, které osoba teď drží): štítek Ověřeno · stav / Nepředloženo / Nezkontrolováno; tlačítka V pořádku / Poškozeno / Vyžaduje úpravu (= předloženo s posouzením stavu) a Nepředloženo; „zrušit zápis“ (poslední relevantní kontrola); poznámka ke kontrole (uloží se s dalším zápisem); `LoanActions` v inventurním kontextu.
- „Během inventury vráceno / vyměněno“: kusy osoby ukončené po zahájení inventury s výsledkem kontroly a aktuálním držitelem.
- Info o počtu dalších kusů mimo rozsah (odkaz na kartu).
- „+ Nově vydat kus“: `ItemPicker` dostupných kusů → `issueItems` s `inventoryId/visitId`.
- **Rekapitulace**: počty ověřeno / poškozeno / k úpravě / nepředloženo / nezkontrolováno, varování se jmény kusů, které zůstanou otevřené, pohyby návštěvy, otevřené úkoly; poznámka k návštěvě; „Potvrdit dokončení návštěvy“ (i s nevyřešenými). Dokončená návštěva ≠ ověřené kusy.

### 7.14 Režim „Ve skladu“ – řada (`/inventories/:id/stock/:seriesId`)
- Hlavička: label řady, „ověřeno X / Y nezapůjčených kusů řady“, počet zapůjčených kusů řady (kontrolují se podle lidí), progress.
- **Rychlé zadání** (krojařka, otevřená inventura): velký input, Enter = potvrdit. Výchozí `inputmode=numeric` („číslo“); přepínač „Dávka a rozsahy (textová klávesnice)“ pro `1, 3, 7, 12-15`. Po odeslání `quickEntry` → nad mřížkou se přidá dávka (posledních 8) s barevnými štítky výsledků a chyb parsování; vstup se vyprázdní a zaostří pro další číslo.
- **Číselná mřížka**: buňka = kus (číslo, `?` bez čísla); barvy ověřeno (plná) / nenalezeno (obrys) / čeká; čárkovaný okraj = vedeno mimo sklad (s popiskem umístění); „!“ = stav ≠ ok. Vyřazená čísla se nezobrazují a nejsou „chybějící“.
- **Panel vybraného kusu**: umístění, stav, výsledek. Je-li kus vedený mimo sklad a neověřený → varování + „Je tady – potvrdit“ (`confirmFoundInStore`, vrátí do skladu). Jinak tlačítka V pořádku / Poškozeno / Vyžaduje úpravu / Nenalezeno; poznámka; „zrušit poslední zápis“; „+ Úkol“; odkaz na detail kusu.

### 7.15 Nastavení (`/wardrobe/settings`, náhled pro čtení, zápis krojařka)
- **Klasifikace**: výpis pohlaví a regionů; „Přidat region“. Varianty: výpis s druhy; přidání varianty (název + checkboxy druhů).
- **Druhy součástek**: výpis (s pohlavím); přidání (název + „mužský i ženský“ / pohlaví).
- **Evidenční řady**: tabulka řada / kusů / nejvyšší č. / nepoužitá / vyřazená čísla / checkbox „smí se znovu použít“ (okamžitě `setSeriesNumberReuse`). Nová řada: pohlaví, region, druh, „Varianta v klíči řady“ (výchozí ne). Klientská hláška „Vyberte pohlaví, region a druh.“ Kombinaci druh × pohlaví (např. ženská řada s mužským druhem) nic nekontroluje.
- **Komplety (šablony)**: výpis, upravit / smazat (bez potvrzení); formulář název, pohlaví, region (předvolené první hodnoty demo dat natvrdo), checkboxy druhů.
- **Inventury**: výchozí kapacita termínu (uloží se na `change`).

---

## 8. Krojová karta a šablony – detail logiky
- `holdingsOf(borrower)` = otevřené zápůjčky držitele + kus. Odpovědnost = oficiální evidence; předání mezi členy se eviduje jen vrácením a novým výdejem (žádná operace „převod“).
- `cardGroups`: klíč `regionId|genderId` kusu, titulek „{Region} – {pohlaví → mužský/ženský} kroj“ (převod koncovky „é“→„ý“). `missing` = pro každou šablonu se stejným pohlavím+regionem druhy, které v **této skupině** nejsou. Šablona se vztahuje ke skupině drženého kroje, ne k výchozímu kroji osoby (cíl dle docs/06 kap. 5.1a: chybějící druhy řídit i výchozím krojem).

---

## 9. Oprávnění

| subjekt | Moje kroje | Správa krojů – čtení | zápis fondu | výchozí kroj | rezervace termínu |
|---|---|---|---|---|---|
| člen (modul zapnut) | ano, vlastní | ne (guard → `/app/costumes`) | ne | ne | za sebe, je-li dotčený |
| Náhled do správy krojů (`costumes-view`) | ano | ano (vše vč. historie, exportů) | ne | ne | za sebe |
| Správa krojů (`costumes`, krojařka) | ano | ano | ano | ano | za sebe i za jiné (jen API) |
| Správa souboru (`ensemble-admin`) | ano | jen s jedním z pověření výše | ne | **ano** (karta, detail osoby) | za sebe |

- Guardy: `costumeStockGuard` (modul + `canViewCostumeStock`) na všech stránkách Správy krojů; `costumeManagerGuard` (modul + `canManageCostumes`, jinak → `/app/wardrobe`) na `stock/new`, `stock/:id/edit`, `loans/new`, `inventories/new`. Moje kroje: `moduleGuard('costumes')`.
- **Vynucení ve službě** (`mutate`): výchozí = `canManageCostumes`; `profile:true` (výchozí kroj, mazání preference při smazání osoby) = navíc `isEnsembleAdmin`; `self:true` (vlastní rezervace / zrušení vlastní rezervace) = jakýkoli přihlášený (`memberId !== null`) – obsahové omezení (dotčenost, vlastní visit) řeší logika operace.
- **Čtení není omezené ve službě**: `state$` vrací celý fond každému, kdo službu injektuje (Moje kroje si odfiltruje vlastní data až v komponentě). Na backendu bude nutné filtrovat podle oprávnění.
- Uzavřít inventuru (i s nesrovnalostmi) smí každá krojařka.

---

## 10. Tisk a export
- Tisk: jen tlačítko na Součástkách (`window.print()`); ostatní stránky lze tisknout prohlížečem, `.no-print` skrývá ovládání. Žádné speciální tiskové sestavy.
- CSV (UTF-8 s BOM, středník, CRLF; `downloadCsv`): Součástky (filtrovaný sklad), Výpůjčky (filtrovaný výpis), Inventura (výsledky všech cílových kusů).
- Cíl dle docs/06 kap. 10: samostatné přehledy vyřazených kusů a „kusy v opravě + otevřené úkoly“ – pokryto jen filtry Součástek (dostupnost Vyřazeno, umístění V opravě, „Jen s otevřeným úkolem“); globální seznam úkolů neexistuje.

---

## 11. Demo data a testy

### 11.1 Seed (`data/mock-costumes.ts`)
- ~23 řad (mužské i ženské, více regionů), nesouvislá čísla, vyřazené kusy, varianta v klíči řady i jako atribut kusu, kus bez čísla, kusy v opravě / u švadleny / nevydatelný.
- Držitelé vybraní podle skupin (funguje i s lokálně importovanými členy): víc rozdílně očíslovaných kusů z více regionů, historická výměna, jeden externista.
- Inventury: uzavřená loňská celková, probíhající „ženské/region“ s termíny (jeden plný), skupinová „kroje muzikantů“ s dokončenými návštěvami a nepředloženým kusem. Pět šablon kompletů, pracovní úkoly. Data relativní k dnešku.

### 11.2 Testy (Karma + Jasmine)
- `utils/costume-logic.spec.ts`: identita řada+číslo, varianta v klíči/atributem, mezery a nerecyklace čísel, recyklace s pravidlem, krojová karta + chybějící druhy, `lastSeen`, výchozí kroj (pohlaví z řady, shoda, nastavení/zrušení pro člena i externistu, odhad, demo data).
- `utils/inventory-logic.spec.ts`: `resolveScope` (celý fond bez vyřazených, průnik, skupina jen zapůjčené, skupina × klasifikace, bez dvojího započtení), `parseNumberInput`, `classifyQuickEntry` (všechny výsledky, mimo rozsah), pokrytí (opakované kontroly, nepředložení neodznačí ověření), skupinová inventura (dokončené návštěvy, ale nepředložený kus brání čistému uzavření), `stockGroups`, oprávněnost rezervace.
- `inventory.service.spec.ts` (TestBed, mock `AccessService`, `fakeAsync`): odmítnutí zápisu bez pověření; výchozí kroj Správou souboru ano / členem ne / výdej Správou souboru ne; nerecyklace čísla; dvojí zápůjčka; výměna s/bez předložení; výměna nemění snapshot; self-rezervace a kapacita; rychlé zadání; dokončení návštěvy s nepředloženým; výslovné přidání; uzavření s nesrovnalostmi; zmrazení a prázdný rozsah.
- **Netestováno**: komponenty (žádné `*.component.spec.ts`), `setLocation`, `retireItem` (vč. vypořádání), `updateItem`, `updateWorkOrder`, nastavení fondu (řady, druhy, varianty, šablony), `confirmFoundInStore`, `revokeCheck`, `cancelBooking`, `removeSlot`, guardy, `stock.utils`, sekvence v `LoanActions`.

---

## 12. Pozorování a technický dluh

1. **Neatomické složené akce v UI.** `LoanActions` řetězí 2–3 samostatné mutace (kontrola → vrácení/výměna → kontrola nového). Selže-li prostřední krok (např. náhradní kus mezitím vydán), zůstane zapsaná inventurní kontrola bez vrácení. Na backendu by mělo jít o jednu transakční operaci (např. `returnLoan` s volbou „zapsat kontrolu“).
2. **Dvojí zápis stavu při vrácení v inventuře**: `recordCheck` s posouzeným stavem přepíše `item.condition` a založí událost, `returnLoan` stav nastaví znovu – redundantní a v historii nekonzistentní (událost změny stavu má kontext inventury, vrácení ne).
3. **Vyřazení kusu během inventury** – kus zůstane v `targetItemIds`, zmizí z mřížky skladu (`stockGroups` ho přeskočí), ale v `inventoryProgress.total` se počítá jako nezkontrolovaný → inventuru pak nejde uzavřít „čistě“, i když fyzicky nelze nic ověřit. Chybí pravidlo (vyloučit vyřazené z pokrytí, nebo je vést jako vyřešené).
4. **Kontrola v režimu „Podle lidí“ neověřuje držitele**: `recordCheck` s `visitId` přijme jakýkoli cílový kus; `startVisit` nekontroluje, zda je osoba dotčená. Logika spoléhá na UI.
5. **`updateWorkOrder` nevaliduje přechody** (lze znovu otevřít hotový / zrušený) a nekontroluje vyřazený kus; `setCondition` jde zavolat i na vyřazený kus. `retireItem` ponechá `location` (u vypořádaného kusu zůstane `holder`).
6. **Služby bez UI**: `setLoanDue` (změna termínu vrácení), `updateExternal` (oprava údajů externisty), `bookSlot(…, borrower)` / `cancelBooking` krojařkou, úprava varianty (`saveVariant` s `id`). Termín s rezervacemi proto nejde v UI odebrat ani přeplánovat.
7. **Chybí správa číselníků**: nelze mazat/přejmenovat řady, druhy, regiony, varianty; pohlaví kroje jsou neměnná; šablona kompletu se maže bez potvrzení; ve formuláři šablony jsou výchozí pohlaví/region natvrdo z demo dat.
8. **Nastavení nevaliduje konzistenci**: řada může kombinovat pohlaví s druhem opačného pohlaví; varianta přiřazená kusu se neověřuje proti `variant.partTypeIds` (UI ji omezuje, služba ne).
9. **Výchozí kroj vs. druhy pro oba kroje**: picker porovnává pohlaví řady, ne pohlaví druhu → např. čižmy vedené v mužské řadě se ženě s výchozím ženským krojem schovají, ačkoli cíl dle docs/06 kap. 5.1a chce „druhy použitelné v obou krojích“ nabízet. Šablony kompletů výchozí kroj nezohledňují.
10. **Výměna nabízí jen stejnou řadu nebo stejný druh + pohlaví**; jiný kus (např. jiný region) nejde vybrat jako náhradu – nutné vrátit a vydat zvlášť (ztratí se vazba `replacesLoanId`).
11. **Rezervace bez časových pravidel**: služba přijme rezervaci i do minulého termínu (Moje kroje je jen skrývá); uzavření inventury ruší `booked`, ale probíhající návštěvy nechá `in-progress`; `completeVisit` lze i na `booked` bez zahájení.
12. **Čtení bez filtrace**: celý krojový stav (všechny zápůjčky, jména externistů a jejich kontakty) je v prohlížeči každého člena; omezení je jen v komponentách. Backend musí vracet data podle pověření (člen jen vlastní holdings + své inventurní výzvy).
13. **Dva pojmy „externista“**: `ExternalPerson` v krojích vs. `Member.isExternal` ve Správě. Výdej nabízí aktivní členy (patrně včetně `isExternal`) i krojové externisty – riziko duplicitní evidence téže osoby. Cíl dle docs/06 kap. 6A (globální osoba, zápůjčky napříč soubory) i 6B (dočasný příjem cizích krojů, vlastník vs. evidující sklad) nejsou v modelu vůbec.
14. **Bývalý člen** se jako držitel zobrazuje („– bývalý člen“), ale nemá žádný vlastní přehled nevrácených krojů (cíl dle docs/06 kap. 6). Výdej bývalému členovi není možný (nabízí jen aktivní).
15. **Výkon a škálování mocku**: každá mutace klonuje celý stav (`structuredClone`) a ukládá ho do localStorage; `events` a `inventoryChecks` rostou neomezeně. Odvozené pohledy jsou O(n·m) (např. `itemAvailability` volá `openLoanFor` lineárně pro každý kus; mřížky a souhrny se přepočítávají při každé změně). Pro stovky kusů OK, pro tisíce ne.
16. **`ensembleId` natvrdo 1** v `OpContext` a seedu; multi-soubor (Vonica / Malá Vonica) bude vyžadovat filtrování ve všech dotazech.
17. **Historie je neúplná**: změna termínu vrácení, změny řad/šablon/klasifikace, zrušení kontroly a změny externistů se do `events` nezapisují. Texty událostí jsou předformátované v češtině (při přejmenování řady zůstane starý label – to je záměr pro audit, ale znemožňuje strukturované dotazy).
18. **`lastSeen` počítá i výdej** jako fyzické spatření kusu – to odpovídá praxi (kus prošel rukama krojařky), ale cíl dle docs/06 kap. 7.4 mluví o inventurních kontrolách; vhodné rozlišit v UI.
19. **UI drobnosti**: `window.prompt` pro řešení úkolu; formulář Nová řada se po uložení neresetuje; CSV soubory nesou starý název „krojarna-*“; tiskové sestavy nejsou připravené (jen `window.print()` stránky).
20. **Testy**: dobré pokrytí čistých funkcí a hlavních pravidel služby, žádné testy komponent ani guardů; chybí testy vyřazení s vypořádáním, umístění, `confirmFoundInStore`, `revokeCheck` a sekvencí `LoanActions` – přesně míst, kde jsou výše uvedené mezery.
