# 04 – Akce, účast (RSVP), docházka, nedostupnost, export kalendáře

Popisuje **skutečně implementované** chování (včetně necommitnutých změn v `features/events/event-detail` – rychlá odpověď klikem na součty). Cílové chování je v `docs/07` kap. 17–19, `docs/10` kap. 4.11. Pověření a rozsahy (`Mandate` kind `events` / `attendance`, rozsah soubor / skupina / akce) viz 02/03; chat a historie skupin viz 05; Přehled (dashboard) viz 07.

Vše běží jen ve frontendu: mock služby v `providedIn: 'root'`, stav v `BehaviorSubject`/`signal`, perzistence do browser storage přes `loadDemoData/saveDemoData` (klíče `events`, `attendance`, `actual-attendance`, `unavailability`, `event-chat`). Většina metod vrací `Observable` s umělým `delay(300)`.

## 1. Datový model

```ts
type EventType = 'rehearsal'|'performance'|'camp'|'meeting'|'other'; // Zkouška, Vystoupení, Soustředění, Schůzka, Jiné

interface AppEvent {
  id; ensembleId; title; type: EventType;
  startsAt: string; endsAt: string;        // lokální ISO bez TZ ("YYYY-MM-DDTHH:mm[:ss]") z <input datetime-local>
  location: string; description?;
  targetGroupIds: number[];                // Pro koho; [] = všichni (neexterní) aktivní členové souboru
  guestMemberIds?: number[];               // pozvaní jednotlivci (hosté, externisté)
  organizerGroupIds?: number[];            // Pořádá – oddělené od cílení; správu dává až pověření
  requiresAction?: boolean;                // jen v mocku, logika ho nepoužívá
  reminderLeadDays?: number;               // předstih výzvy; chybí = podle typu; clamp 0–365
  responseDeadline?: string;               // měkká uzávěrka definitivní odpovědi
  chatEnabled?: boolean;                   // chybí = povolen
  seriesId?: number;                       // výskyt série
  skippedReason?: string;                  // vynechaný termín série (informační, bez RSVP)
  importantChange?: { at; note; requiresConfirmation? }; // jen POSLEDNÍ důležitá změna
  attendance?: AttendanceRecord[];         // připojeno za běhu, neukládá se s akcí
}

type AttendanceStatus = 'yes'|'no'|'maybe'|'pending';
interface AttendanceRecord {               // nahlášená účast, 1 záznam na osobu × akci
  eventId; memberId; status; note?;
  firstViewedAt?; lastViewedAt?;           // otevření detailu
  confirmedAt?;                            // výslovné potvrzení důležité změny
}

interface ActualAttendance {               // skutečná docházka, oddělená od RSVP
  eventId; memberId; present: boolean; recordedByMemberId; recordedAt;
}

interface Unavailability {                 // dlouhodobá nedostupnost
  id; ensembleId /* natvrdo 1 */; memberId; from; to /* YYYY-MM-DD včetně */; note?; createdAt; createdById;
}
```

- `EventCategory` (model + `mock-event-categories.ts`, s `defaultLocation`, `defaultTime`, `requiresConfirmation`…) **nikde používán** – mrtvý kód.
- Mock akce: generované relativně k dnešku (pravidelné nácviky út/pá ±8 týdnů, id od 100) + jednotlivé akce. Generované nácviky nemají `seriesId`.
- Chybějící `AttendanceRecord` = `pending`. Záznam s `pending` může vzniknout jen zobrazením detailu (`markViewed`) nebo potvrzením změny.

## 2. Kdo co smí (čisté funkce v `core/access/access.utils.ts`)

| Funkce | Pravidlo |
|---|---|
| `isEventAudience(member, event)` | jen aktivní; host (`guestMemberIds`) vždy; `targetGroupIds=[]` → každý neexterní; jinak průnik skupin |
| `canSeeEvent` | host ∨ `canEditEvent` ∨ `canRecordAttendance` ∨ (bez cílení a neexterní) ∨ člen cílové skupiny. Pozn.: členství v *pořádající* skupině samo viditelnost nedává |
| `canCreateEvents` | pověření `events` bez `eventId` (soubor nebo skupina) |
| `eventOrganizerScope` | `{ensembleWide, groupIds}` z pověření `events` |
| `canEditEvent` | pověření `events`: celosouborové ∨ `eventId === event.id` ∨ `groupId ∈ organizerGroupIds` |
| `canRecordAttendance` | pověření `attendance` celosouborové / pro akci / pro skupinu ∈ (organizer ∪ target) ∨ pověření `events` pro tuto konkrétní akci |
| `canSeeEventResponses` | `canEditEvent ∨ canRecordAttendance` |
| `canViewAttendanceReport` | jakékoli pověření `attendance` |

Routy: `/app/events` (moduleGuard events), `/app/events/new` (`eventCreateGuard` = modul ∧ `canCreateEvents`), `/app/events/:id` a `/:id/edit` (moduleGuard; oprávnění řeší komponenta), `/app/attendance` (`attendanceGuard` = modul ∧ `canViewAttendanceReport`).

Vynucení na úrovni služeb (simulace serveru):
- `EventsService.createEvent/createSeries`: celosouborový rozsah, nebo `organizerGroupIds` ∩ rozsah ≠ ∅, jinak `AccessDeniedError`.
- `updateEvent/deleteEvent`: `canEditEvent`, jinak `AccessDeniedError`.
- `AttendanceService.updateAttendance`: odmítne (`RuleViolationError`) jen **vlastní** změnu po skončení akce. Jiná oprávnění nekontroluje (viz dluh).
- `ActualAttendanceService`: **žádná** kontrola oprávnění ani času.
- `AvailabilityService`: add jen přihlášený za sebe, remove jen vlastní; `forEvent` jen `canEditEvent ∨ canRecordAttendance`; `forPlanning` jen `canCreateEvents`.
- `EventChatService`: čte `canSeeEvent`; píše oslovený ∨ `canEditEvent` (a chat povolen); maže vlastní, cizí jen `canEditEvent` (soft delete).

## 3. Výzvy k odpovědi, uzávěrky, uzavření (`utils/event-reminders.ts`)

- Výchozí předstih: rehearsal 7, performance 14, camp 14, meeting 7, other 7 dní; `reminderLeadDays` clamp 0–365.
- `isReminderActive`: `startsAt − lead ≤ now < startsAt`.
- `isSoftDeadlinePassed`: `responseDeadline` existuje a `now ≥ deadline`.
- `isDecided`: yes/no definitivní; maybe/pending ne.
- `needsResponse(event, status)`: false u vynechaného termínu nebo mimo okno výzvy; jinak `pending` → true; `maybe` → true jen po měkké uzávěrce.
- `isResponseClosed`: `now ≥ endsAt` – člen pak nemění odpověď ani poznámku. (Probíhající akce = ještě lze měnit.)
- Odpovědět lze kdykoli před koncem akce, i mimo okno výzvy (okno řídí jen zvýraznění/badge).

Kde se `needsResponse` používá (stejná funkce, 4 různé obaly):
1. banner „N akcí čeká na tvoji odpověď“ + filtr „Čeká na odpověď“ v seznamu akcí (`filterEvents`),
2. badge v navigaci (`core/utils/visibility.utils.ts → getUnconfirmedEventsCount`, filtruje audience),
3. Přehled „Čeká na vás“ (`dashboard/pending-actions.ts → eventResponseActions`, filtruje audience, s tlačítky Přijdu/Nepřijdu),
4. detail (zvýraznění textu uzávěrky).

## 4. Zobrazení a důležité změny (`utils/event-views.ts`)

- `markViewed` při každém otevření detailu osobou z audience: `firstViewedAt ??= now`, `lastViewedAt = now` (zakládá `pending` záznam, pokud chybí). Rychlá odpověď ze seznamu zobrazení nezapisuje. V detailu se zapíše jen jednou za otevření (stream akce se znovu vysílá při každé změně účasti – ošetřeno flagem, pokryto testem).
- `viewedSinceChange`: bez změny stačí jakékoli otevření; se změnou jen `lastViewedAt ≥ importantChange.at`.
- `confirmedChange`: `confirmedAt ≥ importantChange.at`.
- `changeAcknowledgement` → `'confirm'` (vyžaduje potvrzení a nepotvrzeno) | `'view'` (neotevřel po změně) | `null`.
- Přehled „Čeká na vás“ (`eventChangeActions`): jen nadcházející akce (`startsAt ≥ now`), pro audience.
- Ukládá se jen poslední `importantChange` – předchozí změny se přepíší (žádná historie změn akce kromě auditu, viz 6.3).

## 5. Seznam akcí `/app/events` (`events.component`)

- Data: `EventsService.getEvents()` = `combineLatest(events, attendance.records$)` → každé akci připojí všechny její RSVP záznamy. Filtr `canSeeEvent`.
- Přepínač **Seznam / Kalendář**; výchozí z uživatelského nastavení `settings.eventsView`, přebíjí query `?view=`; při přepnutí se `view` zapíše do URL jen pokud se liší od nastavení.
- Hlavička: odkaz „Docházka“ (`canViewAttendanceReport`), „+ Nová akce“ (`canCreateEvents`).
- Banner `pendingCount` (akce s `needsResponse` z nadcházejících) → klik nastaví filtr `response=pending` a přepne na seznam. Query `?response=pending` filtr zapne rovnou.

### 5.1 Seznam
- Nadcházející = `endsAt ≥ now` (tj. i probíhající), vzestupně; filtry **Typ** a **Moje odpověď** (`all` | `pending` = `needsResponse` | `answered` = status ≠ pending, v UI popsáno „Potvrzené“ i pro maybe/no).
- Uplynulé = `endsAt < now`, sestupně, ve sbaleném `<details>` „Uplynulé (N)“, uplatní se jen filtr typu.
- `event-list.component` (sdílí i záložka Akce ve skupině – akce, kde skupina pořádá nebo je cílová) seskupuje po měsících (`groupByMonth`, rok jen mimo aktuální rok).
- Řádek `event-rsvp-row`: den v týdnu + datum, název (+ „Vynecháno – důvod“), čas · místo, počty `✓ ? ✗` jen pro `canSeeEventResponses` (počty jen z aktuální audience). Tlačítka Ano/Možná/Ne: skryta u vynechaných, `disabled` po skončení; klik na už zvolený stav nic neemituje. **Z řádku nelze odpověď zrušit (zpět na pending).** Řádek bez odpovědi je zvýrazněn (`rsvp-row--pending`) bez ohledu na okno výzvy.
- Rychlá odpověď: optimistická změna lokálního pole + `AttendanceService.setStatus` (zachová poznámku a zobrazení). Chyba se ignoruje (prázdný `subscribe()`), bez rollbacku.

### 5.2 Kalendář
- Mřížka měsíce Po–Ne (`buildMonthGrid`, doplněné dny sousedních měsíců, bez prázdného týdne navíc). Šipky měsíc ±1, „Dnes“.
- Den: tečka za každou akci obarvená **mým** stavem (`data-status`), legenda Ano/Možná/Ne/Nezadáno; tooltip „HH:mm – název“ (slice z ISO stringu); vícedenní akce v každém svém dni.
- Výběr dne → pod mřížkou seznam `event-rsvp-row` bez data. Klik na den mimo měsíc přepne měsíc. Při přepnutí měsíce se vybere dnešek (je-li v měsíci) jinak 1. den.
- Kalendář ukazuje všechny viditelné akce včetně minulých (bez filtrů).

## 6. Detail akce `/app/events/:id` (`event-detail.component`)

Načtení: aktuální uživatel → člen (`members.userId`), jinak „Akce nebyla nalezena“. Akce bez `canSeeEvent` se tváří jako neexistující (i přímá URL). Živé proudy s `takeUntilDestroyed`.

Hlavička: název + zkrácený termín (`formatEventRange`: „23. 10. 17:00 – 18:30“, přes více dní s datem u konce), „Upravit“ pro `canEditEvent`. Pruh „Vynecháno – důvod…“ u vynechaných. Pruh „Důležitá změna (datum): text“ + u `requiresConfirmation` tlačítko **„Potvrzuji, že jsem si to přečetl/a“** (→ `confirmImportantChange`, nastaví `confirmedAt`, `lastViewedAt` nejméně na teď) nebo „✓ Potvrzeno“.

Záložky (query `?tab=`, neplatná/nedostupná → `detail`):

| Tab | Kdy |
|---|---|
| `detail` (Detail) | vždy |
| `attendance` (Účast) | ne u vynechaného termínu |
| `chat` (Chat) | `chatEnabled !== false` ∧ nevynecháno |
| `actual` (Docházka) | `canRecordAttendance` ∧ akce začala (`startsAt ≤ now`, vyhodnoceno při výpočtu, ne časovačem) |
| `views` (Zobrazení) | `canSeeEventResponses` |

### 6.1 Tab Detail
- Typ (badge), „Do kalendáře“ (.ics jedné akce, ne u vynechané), začátek, konec, místo, Pořádá (skupiny), Hosté (přezdívky), Pro skupiny (s ikonami), popis.
- Sekce **Účast** (ne u vynechaných): 4 součty `[ikona | ornament | počet]` v pořadí Přijde / Možná / Nepřijde / Bez odpovědi, počítané z aktuální audience (aktivní členové; chybějící záznam = pending). Vidí je **každý, kdo vidí akci** (na rozdíl od seznamu).
- **Nové (working tree) – rychlá odpověď v součtech:**
  - `summaryCounts[]` = `{status, label, icon, count, mine, quick}`; `mine` = součet, do kterého spadá přihlášený (u audience bez záznamu → „Bez odpovědi“); `quick` = přihlášený je audience ∧ odpověď není uzavřena.
  - `quick` → součty jsou `<button aria-pressed=mine>` s title „Moje odpověď: …“ / „Odpovědět: Přijdu…“ / „Zrušit odpověď“; jinak `<span>`, „mine“ zvýrazněn i tak (+ sr-only „(moje odpověď)“). Styl `status-count--action/--mine` v `styles/_identity.scss`.
  - `quickRespond(status)`: no-op po skončení akce nebo při kliku na už zvolený stav. yes/maybe/no → `setStatus` (zachová poznámku z `noteValue`, zobrazení i potvrzení). Klik na „Bez odpovědi“ → confirm dialog „Opravdu zrušit odpověď?“ (zpráva „Smaže se i poznámka k účasti.“ jen pokud poznámka existuje; tlačítka „Zrušit odpověď“/„Ponechat“) → `clearStatus` (status pending, poznámka smazána).
  - Odstraněn dřívější řádek „Moje odpověď: X · změnit / zobrazit účast“ (odkaz na tab Účast).
  - Testy: 6 nových (zvýraznění mine, klik zachová poznámku, zrušení s potvrzením / bez potvrzení, opakovaný klik nic neodešle, po skončení neklikací).

### 6.2 Tab Účast
- **Moje účast** (jen audience, ne vynechaná):
  - po skončení: „Akce proběhla – odpověď už nelze měnit. Vaše odpověď: X · poznámka“;
  - jinak text uzávěrky (jen má-li `responseDeadline` a akce nezačala): před ní „Odpovězte prosím definitivně (Přijdu / Nepřijdu) do …“, po ní „Termín … uplynul – odpověď lze stále změnit.“, zvýrazněno při `needsResponse`;
  - tlačítka Přijdu / Nepřijdu / Možná (aktivní stav), „Zrušit odpověď“ (bez potvrzení, maže i poznámku) když status ≠ pending;
  - poznámka: náhled + Upravit / textarea + Uložit/Zrušit / „+ Přidat poznámku“; hint „Poznámku uvidí všichni, kdo vidí tuto akci.“ Uložení poznámky nemění status (bez odpovědi zůstane pending). Rozepsaná poznámka se nepřepisuje novými daty ze streamu (`noteLoaded`). Změna statusu ukládá i aktuální `noteValue` (tedy i neuložený koncept).
- **Odpovědi členů** (všem, kdo akci vidí): 4 sloupce Přijdu / Nepřijdu / Možná / Neodpovědělo s přezdívkami; jméno s poznámkou = tlačítko (title + rozbalení na mobilu); u organizátorů/evidence badge „nedostupný d. m. – d. m.“ (title = důvod) z `AvailabilityService.forEvent`.

### 6.3 Tab Docházka (skutečná)
- Řádky = audience (`visibleMembers`) × {rsvp, present: true|false|null}. Souhrn Přítomno / Nepřítomno / Nevyplněno.
- Filtr čipy „Všichni“ + nearchivované skupiny, do kterých patří aspoň jeden oslovený (jen když >1 skupina). Pohlaví se neeviduje – dělení Kluci/Holky přes skupiny.
- Nevyplnění nahoře v sekcích podle RSVP (Přijdu, Možná, Nepřijdu, Bez odpovědi), každá s „Všichni přítomni“ / „Všichni nepřítomni“ (hromadně jen zobrazené řádky sekce dle filtru); pod tím „Vyplněno (N)“.
- Řádek: přezdívka + štítek nahlášené účasti, přepínač Přítomen/Nepřítomen; opětovné klepnutí na aktivní stav záznam smaže (`clear` → nezkontrolováno).
- Zapisuje se `recordedByMemberId` = přihlášený, `recordedAt` = teď; přepis je upsert (bez historie oprav). RSVP se nikdy nemění.
- `markRestAbsent()` existuje (testováno), v šabloně se už nepoužívá (nahrazeno hromadnými tlačítky sekcí).
- Odkaz „Přehled docházky“ → `/app/attendance` (může skončit na guardu, viz dluh).
- Okno: od začátku akce, bez horní hranice. Přehled „Čeká na vás“ (`attendanceRecordActions`) připomíná akce skončené ≤ 14 dní, nevynechané, v rozsahu `canRecordAttendance`, kde **není zapsán nikdo**.

### 6.4 Tab Zobrazení
- Pro `canSeeEventResponses`. Dva sloupce: (Ne)zobrazili / (Ne)otevřeli po změně (dle `viewedSinceChange`) přes audience; u `requiresConfirmation` „Potvrdilo přečtení: X z N“.

### 6.5 Tab Chat
- `event-chat.component` + `EventChatService` (detail viz 05): log zpráv (rich text, zmínky @člen, #akce), soft delete („Zpráva byla odstraněna.“), odeslání Enterem; moderace = `canEditEvent`. Žádné notifikace, žádné real-time.

## 7. Formulář akce `/app/events/new`, `/app/events/:id/edit` (`event-form.component`)

Přístup: nová = `canCreateEvents`; úprava = `canEditEvent(original)`; jinak hláška „Tuto akci nemůžete upravovat…“.

Pole: Název*, Typ*, Začátek*, Konec* (datetime-local), Místo*, Popis, (u výskytu série) „Tento termín se nekoná“ + Důvod*, Chat k akci (checkbox), (u úpravy) **Druh změny**, (u nové) **Opakování** (series planner), **Výzva k odpovědi** (Vyzvat dní předem – prázdné = default typu; Odpovědět definitivně do), **Pořádá** (checkboxy skupin), **Pro koho** (checkboxy všech skupin; nic = celý soubor), **Hosté** (select aktivních osob, externisté první; Odebrat), (u úpravy) **Odpovědi za členy**.

Validace (`valid()` → disabled submit; nic dalšího):
- název, začátek, konec, místo neprázdné; `endsAt ≥ startsAt` (stringové porovnání);
- pořadatel: ensembleWide, nebo úprava, nebo ≥1 pořádající skupina v rozsahu (nová akce skupinového organizátora má předvyplněnou první skupinu z rozsahu);
- druh změny ≠ minor ⇒ „Co se změnilo*“ vyplněno; vynecháno ⇒ důvod vyplněn.
- Nevaliduje se: `responseDeadline` vs. začátek, rozsah `reminderLeadDays` (jen tichý clamp 0–365, nečíslo → default), délka textů, kolize termínů.
- `organizerOptions`: skupiny v rozsahu pověření + již nastavení pořadatelé (nelze je „ztratit“ z výběru).

Nedostupnost při plánování: pod termínem varování „V tomto termínu je nedostupných N oslovených členů: přezdívka (rozsah, poznámka)“ – `forPlanning(startsAt, endsAt, audience)`; jen informace, neblokuje.

Druh změny (jen úprava):
- `minor` – „Drobná úprava – bez upozornění“: `importantChange` zůstane původní;
- `important` – nový `importantChange {at: now, note}` → nové sledování zobrazení;
- `confirm` – navíc `requiresConfirmation: true`.
- Automaticky: výskyt série nově označený jako vynechaný (dosud nevynechaný, budoucí) při `minor` dostane `importantChange` „Termín se nekoná – důvod“ (= aktivní upozornění dle docs/07 kap. 17).

Uložení:
- `updateEvent` → audit `event-updated` jen při podstatné změně (`describeEventChange`: posun začátku „začátek 23. 10. 18:00 → …“, jinak změna konce, místo, název) pro `targetGroupIds ∪ organizerGroupIds` → promítá se do historie/chatu skupin (05). Popis, cílení, hosté se neauditují. Pak `saveStatuses` (Odpovědi za členy).
- `createEvent` → audit `event-created`; navigace na detail.
- `chatEnabled` true se ukládá jako `undefined`; `organizerGroupIds/guestMemberIds` prázdné → `undefined`.
- **Odpovědi za členy** (úprava, audience dle aktuálně zvolených skupin/hostů): select pending/yes/no/maybe + „viděl/a před X“ / „nezobrazeno“ (z `firstViewedAt`, ne `lastViewedAt`). Ukládá jen změněné, `forkJoin(updateAttendance)`, zachová poznámku. Funguje i po skončení akce (zákaz platí jen pro vlastní záznam).
- **Smazat akci**: confirm „Smaže se i nahlášená účast. Akci nelze obnovit.“ → `deleteEvent` (viz dluh – účast se ve skutečnosti nemaže).
- Úprava výskytu série platí jen pro ten výskyt (série nemá hromadnou úpravu ani smazání).

## 8. Série a svátky (`series-planner.component`, `utils/event-series.ts`)

Jen při zakládání. Checkbox „Opakovaná série“ → pravidlo:
- `from` = datum začátku z formuláře, „Opakovat do*“ (`min` = from), interval každý / každý druhý týden, dny v týdnu (default = den v týdnu začátku).
- `generateSeriesDates`: den po dni od `from` do `to`, týdenní index od pondělí týdne `from`, `weekIndex % interval === 0` ∧ den ∈ weekdays; max **120** výskytů (hint při dosažení). Výpočty v UTC poledne (bez DST chyb).
- Výjimky (předvyplní se, v náhledu upravitelné):
  - „Státní svátky“ (default zapnuto): `czechPublicHolidays(year)` – 11 pevných + Velký pátek, Velikonoční pondělí (`easterSunday` anonymní gregoriánský algoritmus);
  - „Vánoční a velikonoční prázdniny“ (default zapnuto): `nationwideSchoolHolidays` – 23. 12.–2. 1. (pevně) a velikonoční čtvrtek;
  - vlastní rozsahy (název, od, do) – podzimní/pololetní/jarní dle okresu zadá organizátor;
  - „Vynechat celý týden, ve kterém jsou prázdniny“ (týdenní granularita jen pro rozsahy, ne pro svátky).
  - Důvod: název svátku, jinak label rozsahu, prázdný label → „Prázdniny“.
- Náhled: „N termínů, z toho M vynecháno“, řádek = den + datum + (koná se | input důvodu) + Vynechat/Konat. Ruční zásahy v mapě `date → reason|null` přežijí změnu pravidla. Ručně vynechaný bez důvodu → „Vynecháno“.
- Uložení (`EventFormComponent.seriesOccurrences`): čas začátku a délka z prvního termínu formuláře; každé datum → samostatná `AppEvent` se společným `seriesId` (max+1), vynechané se `skippedReason`. `createSeries`: oprávnění jako create, prázdná série → chyba „Série nemá žádný termín.“, jeden audit `series-created` („N termínů, z toho M vynecháno“) navázaný na první konaný výskyt. Navigace na seznam akcí.
- Datum v poli „Začátek“ se samo vytvoří jen pokud odpovídá pravidlu (zvolené dny).
- Pozdější změna pravidel sérii nepřepočítává (není ani UI).
- Vynechaný výskyt: bez tabu Účast, bez chatu, bez RSVP tlačítek, `needsResponse=false`, nepřipomíná docházku, v ICS volitelně jako „NENÍ …“.

## 9. Přehled docházky `/app/attendance` (`attendance-report`)

- Filtry: Od / Do (default poslední 3 měsíce do dneška), Typ akce.
- Akce: `canRecordAttendance` přihlášeného ∧ začaté (`startsAt ≤ now`) ∧ den začátku v období ∧ typ; řazení od nejstarší. **Vynechané termíny se nevyřazují.**
- Řádky: členové očekávaní na ≥1 akci (aktuální `isEventAudience` – podle dnešního členství, ne historického) ∪ kdokoli se zápisem v období; řazení dle přezdívky (cs).
- Buňka: ✓ přítomen / ✗ nepřítomen / – nezapsáno (očekáván, bez záznamu) / prázdno (akce pro člena nebyla).
- Celkem: `present/recorded` + `%` = round(present/recorded·100), nezapsané se nepočítají; bez zápisu „–“.
- Záhlaví sloupce = odkaz na detail akce (datum + typ).
- **Export CSV** (`dochazka_<od>_<do>.csv`): `;` oddělovač, BOM, `\r\n`, hlavička `Člen; <d. m. yyyy> <název>…; Přítomen; Zapsáno; Účast %`, buňky `ano`/`ne`/prázdné, escapování `;"\r\n`. Jen přezdívka (žádné jméno/ID). Tlačítko disabled bez řádků.

## 10. Nedostupnost (`features/availability`)

- Profil → „Moje nedostupnost“ (`my-unavailability.component`): seznam aktuálních a budoucích (`to ≥ dnes`), přidání Od/Do/Poznámka, smazání (bez potvrzení). Bez úpravy záznamu.
- Validace ve službě: přihlášen; obě data; `to ≥ from`. Poznámka trim → prázdná = undefined.
- Překryv s akcí po dnech včetně krajů (`overlapsRange`).
- Zobrazení: detail akce (tab Účast, badge u jména) pro `canEditEvent ∨ canRecordAttendance`; formulář akce (varování) pro `canCreateEvents`. Nenahrazuje RSVP, nic neomlouvá automaticky.
- Při trvalém smazání osoby (Správa, 07) se nedostupnosti smažou (`removeAllFor`); existence RSVP / docházky / chatu / hostování naopak trvalé smazání blokuje (`hasResponses`, `hasRecords`, `isAuthor`, `isGuest`).

## 11. Export do kalendáře (ICS, `utils/ics.ts`)

- Jednorázové stažení, žádný odběr (cíl dle docs/07 kap. 17: odběr URL s tokenem, kombinace více souborů/dětí – až s backendem).
- **Nastavení → Kalendář** (`settings/calendar-export.component`): checkboxy typů (default vše kromě `rehearsal`), „Vynechané termíny … jako ‚NENÍ VONICA – důvod‘“ (default vypnuto); volby v uživatelském nastavení `calendarExport`. Exportuje akce, kde jsem audience, s `endsAt ≥ now − 30 dní`; tlačítko „Stáhnout .ics (N akcí)“ → `akce.ics`.
- `selectIcsEvents`: vynechaný termín jen při `skippedAsNotice` (bez ohledu na filtr typu), ostatní dle typů.
- `buildIcs`: VCALENDAR 2.0, `PRODID:-//<soubor>//Souborovy system//CS`, `METHOD:PUBLISH`; VEVENT `UID:event-<id>@moje.vonica.cz`, `DTSTAMP`, `DTSTART/DTEND` v UTC (`…Z`, převod z lokálního času prohlížeče), `SUMMARY`, `LOCATION`, `DESCRIPTION`; vynechaný: `SUMMARY:NENÍ <SOUBOR> – důvod`, `TRANSP:TRANSPARENT`, bez místa/popisu (ne `STATUS:CANCELLED`). Escapování `\ ; , \n`, zalamování po 75 znacích (počítá UTF-16 znaky, ne oktety), CRLF.
- Detail akce: „Do kalendáře“ → `akce-<id>.ics` s jedinou akcí.
- Chybí `SEQUENCE`/`LAST-MODIFIED` → změněná akce se při opětovném importu nemusí aktualizovat; smazaná akce v kalendáři zůstane.

## 12. Rychlá odpověď mimo detail

- Přehled (dashboard): sekce nadcházejících akcí (audience, `startsAt ≥ now`, limit `DASHBOARD_EVENT_LIMIT`) s `event-rsvp-row` → `AttendanceService.setStatus` (optimisticky); „Čeká na vás“ položky `event-response` s tlačítky Přijdu / Nepřijdu (bez Možná).
- Záložka Akce ve skupině: `event-list` + `setStatus`.
- Seznam/kalendář akcí: viz 5.
- Všechna místa volají `setStatus` (zachová poznámku, `firstViewedAt`, `lastViewedAt`, `confirmedAt`) a nezapisují zobrazení.

## 13. Testy (Karma/Jasmine)

| Soubor | Pokrývá |
|---|---|
| `events.service.spec` (16) | CRUD, kopie mock dat, napojení účasti, zákaz odpovědi po skončení, oprávnění create/update, skupinový organizátor, audit podstatné změny, série (seriesId, skipped, 1 audit) |
| `attendance.service.spec` (12) | get/update/upsert, `markViewed` first/last, `setStatus` zachová poznámku, potvrzení odděleně |
| `actual-attendance.service.spec` (7) | mark/upsert/markMany/clear, izolace akcí, RSVP nedotčeno |
| `actual-attendance.utils.spec` | expectedMembers, hasEventStarted, defaultPeriod, filterPeriodEvents, summarizeMember, buildAttendanceReport (4 stavy buňky, host se zápisem), CSV (BOM, `;`, ne) |
| `event-detail.component.spec` (~28) | souhrny (pending, mimo cíl, neaktivní), rychlá odpověď v součtech (6, nové), viewed, poznámky, docházka (sekce, hromadně, toggle-clear, filtr skupin), záložky, skrytí cizí akce, host, editace, uzavření odpovědi, jediné markViewed |
| `events.component.spec` (10) | počty jen pro oprávněné, nadcházející, kalendář (query, výběr dne, tooltip), rychlé potvrzení, banner + filtr |
| utils specs | event-reminders, event-filters, event-views, event-series (generování, interval, Velikonoce, výjimky, celý týden), ics, calendar.utils, event-format |
| `availability.service.spec` (3), `event-chat.service.spec` (3) | vlastní add/remove + validace, viditelnost jen organizátorům, překryv; chat povolení, psaní, viditelnost |

Netestováno: `event-form.component` (validace, druh změny, auto-importantChange při vynechání, saveStatuses, seriesOccurrences), `series-planner.component` (overrides), `attendance-report.component`, `calendar-export.component`, `event-rsvp-row`, `event-list`, `my-unavailability`.

## Pozorování a technický dluh

**Pravděpodobné chyby**
1. **Smazání akce nemaže závislá data**, ač dialog tvrdí „Smaže se i nahlášená účast“: `AttendanceRecord`, `ActualAttendance`, zprávy chatu zůstanou osiřelé ve storage; žádný audit smazání. Osiřelé záznamy navíc blokují trvalé smazání osoby (`hasResponses/hasRecords`).
2. **Série kopíruje absolutní `responseDeadline` do všech výskytů** → u pozdějších výskytů je uzávěrka dávno pryč, takže `maybe` se hned při otevření okna výzvy počítá jako „čeká na odpověď“. Měla by být relativní (např. dny před začátkem) nebo se u série vynechat.
3. **Seznam/kalendář akcí neověřuje audience**: `visibleEvents` = `canSeeEvent` (zahrnuje organizátory a evidenci mimo cílové skupiny), `filterEvents`/`pendingCount` audience nekontrolují → organizátor mimo cíl vidí RSVP tlačítka, je mu započítán banner „čeká na odpověď“ a kliknutím vytvoří záznam účasti, který se nikde nepočítá. Badge v navigaci (`getUnconfirmedEventsCount`) audience filtruje → nesoulad čísel banneru a badge.
4. Tlačítko „Potvrzuji, že jsem si to přečetl/a“ (`needsConfirmation`) není podmíněno `isAudience` – zobrazí se i neoslovenému organizátorovi a klik vytvoří `pending` záznam.
5. `setStatus` v detailu (včetně nové rychlé odpovědi v tabu Detail) ukládá aktuální `noteValue` – neuložený koncept poznámky z tabu Účast se tak uloží „mimochodem“, ač komentář tvrdí, že poznámka se mění jen v tabu Účast.
6. Přehled docházky obsahuje **vynechané termíny série** jako sloupce (vše „–“), protože `filterPeriodEvents` nefiltruje `skippedReason` (Přehled „Čeká na vás“ je naopak vyřazuje).
7. Odkaz „Přehled docházky“ v tabu Docházka vidí i organizátor s pověřením `events` pro konkrétní akci (ten smí zapisovat), ale `attendanceGuard` vyžaduje pověření `attendance` → přesměrování.
8. Filtr „Moje odpověď: Potvrzené“ zahrnuje i Možná/Nepřijdu (= „odpovězeno“).
9. Chyby rychlých odpovědí (`subscribe()` bez error handleru) se tiše ztratí a optimistický stav zůstane; při `updateEvent` + `saveStatuses` může akce uložit a odpovědi selhat (neatomické, organizátor-audience po skončení akce dostane chybu až po uložení akce).
10. Tab Docházka a `actualRecords` se vyhodnotí při načtení; když akce začne během otevřené stránky, tab se neobjeví bez reloadu (a záznamy se nenačtou, i kdyby se tab objevil).

**Nesoulad s cílem / nejasná pravidla**
- Počty i jmenné seznamy odpovědí (včetně poznámek) v detailu vidí každý, kdo akci vidí, zatímco v seznamu jsou počty jen pro organizátory/evidenci. docs/07 kap. 17 chce běžného člena seznamy neobtěžovat – rozhodnutí o viditelnosti je nekonzistentní.
- RSVP nemá historii (cíl docs/07 kap. 18: „pozdější změny jsou dohledatelné“); přepisuje se jediný záznam. Organizátor přes „Odpovědi za členy“ může přepsat odpověď člena **i po skončení akce** bez stopy (docs/07 kap. 19: původní odpověď se nesmí bez historie nahradit). Skutečná docházka je také upsert bez historie oprav.
- `importantChange` drží jen poslední změnu; audit podstatných změn (`describeEventChange`) je oddělený mechanismus a neví o „důležité změně“ ani o vynechání termínu.
- Notifikace neexistují (jen badge/„Čeká na vás“); důležitá změna „upozorní“ jen pasivně.
- `rsvp-row` neumí odpověď zrušit, detail ano (tlačítko v Účasti bez potvrzení, v součtech s potvrzením) – tři různé UX pro totéž.

**Vynucení jen ve frontendu / port na backend**
- `AttendanceService.updateAttendance` nekontroluje, zda zapisující je osoba sama nebo organizátor (`canEditEvent`), zda je osoba v audience, ani vynechaný termín; `ActualAttendanceService` nekontroluje `canRecordAttendance` ani začátek akce. Backend musí doplnit vše.
- Časy: `startsAt/endsAt/responseDeadline` jsou lokální stringy bez časové zóny; porovnání mixuje `Date.parse` (lokální) a stringové porovnání (`endsAt ≥ startsAt`, `day()` slice). Pro PHP/MySQL nutno rozhodnout TZ (Europe/Prague) a formát.
- ID = `max+1` (akce, série, nedostupnost, chat) – na serveru autoincrement; `seriesId` bez vlastní entity (pravidlo série se neukládá, nelze ho později zobrazit ani upravit).
- `EventsService.getEvents()` vždy vrací všechny akce + všechny RSVP záznamy, filtrace oprávnění probíhá v komponentách (různě: list `canSeeEvent`, report `canRecordAttendance`, export audience). API bude muset filtrovat server-side a poskytovat agregované počty.
- `ensembleId` natvrdo `1` ve formuláři i nedostupnosti.

**Duplicity a složitost**
- `EVENT_TYPE_LABELS` definováno 4× (events, detail, report, form `EVENT_TYPE_OPTIONS`) + `TYPE_LABELS` v exportu; `STATUS_LABELS` 2× s různými texty (Přijdu vs. Přijde, „Nezadáno“ vs. „Bez odpovědi“/„Neodpovědělo“).
- Výpočet počtů odpovědí 2× (seznam `attendanceCounts`, detail `membersByStatus`); „najdi člena podle `userId`“ v každé komponentě zvlášť místo `AccessService.currentMember`.
- `toDateKey` duplicitně v `calendar.utils` a `actual-attendance.utils`; `formatEventDate` vs. `formatEventRange`.
- `event-detail.component.ts` ~500 řádků (5 tabů, RSVP, poznámky, docházka, zobrazení, ICS) – kandidát na rozdělení na podkomponenty; `event-form` ~500 řádků s inline šablonou.
- Mrtvý kód: `EventCategory` + mock, `AppEvent.requiresAction`, `markRestAbsent`, `getMemberAttendance`.
- `CalendarExport` filtruje „moje akce“ jen přes audience – akce, kterou organizuji, ale nejsem cílem, se neexportuje.
