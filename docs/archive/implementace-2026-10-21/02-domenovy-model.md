# 02 – Doménový model (skutečný stav implementace)

Katalog všech entit, typů a výčtů aplikace SPLK (frontend Angular 19, mock služby s perzistencí v `localStorage`).
Popisuje **implementovaný** stav kódu (vč. necommitnutých změn), ne cílovou specifikaci v `docs/`.
Cesty jsou relativní k `frontend/src/app`. Krojový fond je zde jen stručně – detail viz `06`.

## 0. Konvence napříč modelem

- **ID**: číselná `number`, přidělovaná mock službou jako `max(id)+1` nad aktuální kolekcí (žádné UUID, žádná sekvence). Výjimky: klasifikace krojů (`ClassificationOption.id: string` – stabilní textový klíč), kompozitní klíče (viz níže).
- **Časy**: ISO řetězce. Smíšené formáty:
  - `new Date().toISOString()` (UTC se `Z`) – createdAt, grantedAt, audit `at`, chat, komentáře…
  - lokální čas bez zóny `YYYY-MM-DDTHH:mm:00` – `AppEvent.startsAt/endsAt`, `Post.publishedAt` v seedu.
  - pouze datum `YYYY-MM-DD` – `Unavailability.from/to`, `Member.createdAt` (u nově zakládaných osob `toISOString().slice(0,10)`).
- **`ensembleId`**: na většině entit, vždy `1`. Entita „Soubor“ neexistuje; jediný soubor = `EnsembleSettings` (singleton).
- **Volitelná pole s významovým defaultem**: chybějící hodnota má sémantiku (např. `Group.visibility` chybí = `private`, `chatEnabled` chybí = zapnuto). Defaulty se dopočítávají ve funkcích, ne při uložení.
- **Měkké mazání** jen u některých entit (`archivedAt`, `hiddenAt`, `deletedAt`, `retired`, `isActive=false`); jinde tvrdé mazání z pole.
- **Zmínky a odkazy v textu**: tokeny `@[member:ID]` a `#[event:ID]` uložené v `body`; zmínky navíc denormalizovaně v `mentionedMemberIds[]`. Jméno/název se vykresluje z aktuálních dat.
- **Výchozí labely** jsou konstanty `Record<Enum, string>` vedle typů (např. `MANDATE_LABELS`, `GROUP_VISIBILITY_LABELS`, `JOIN_STATUS_LABELS`, `CONDITION_LABELS`…).

## 1. Osoby, účty, členství

### 1.1 Member (`core/models/member.model.ts`) – centrální entita osoby

```ts
interface Member {
  id: number;
  ensembleId: number;
  userId: number;            // „účet“; v seedu i při založení = id (insert: userId ?? newId)
  firstName: string;         // plné jméno vidí a mění jen Správa souboru
  lastName: string;
  nickname: string;          // veřejné jméno; unikátní (porovnání bez diakritiky/velikosti, nicknameKey); mění i člen sám
  email?: string;            // přihlašovací identifikátor v mocku
  phone?: string;
  groupIds: number[];        // AKTUÁLNÍ členství ve skupinách (zdroj pravdy pro přístup)
  groupIntervals?: Record<number /*groupId*/, MembershipInterval[]>; // historie členství; chybí = člen od počátku
  avatar?: { icon: IconName; color: string }; // nastavuje si člen; chybí = iniciály na barvě z id
  functionTitle?: string;    // souborová funkce (kronikářka, ekonomka…) – jen popisek, nic neopravňuje
  isExternal?: boolean;      // externista – není člen souboru
  isActive: boolean;         // false = bývalý člen / vyřazený externista; zůstává v evidenci
  createdAt: string;         // datum (YYYY-MM-DD)
}
interface MembershipInterval { from: string; to?: string /* chybí = trvá */ }
```

- **Osoba vs. účet vs. člen**: neexistuje samostatná tabulka účtů. Jedna `Member` = osoba + (implicitní) účet + členství v souboru.
  - `User` (`core/auth/models/user.model.ts`) = `{ id /*=Member.userId*/, name /*=nickname*/, email }` – jen identita přihlášení, odvozená `memberToUser()`. Uložená v `localStorage` `splk.auth.user`.
  - Aktuální člen se dohledává `members.find(m => m.userId === user.id)` (`AccessService.currentMember`).
  - Heslo se nekontroluje; přihlášení e‑mailem nebo rychlou volbou z aktivních členů. Přihlásit se může jen `isActive`.
- **Stavy osoby**: aktivní člen (`isActive && !isExternal`), bývalý člen (`!isActive`), aktivní externista (`isActive && isExternal`), vyřazený externista (`!isActive && isExternal`). Trvale smazaná osoba zmizí z pole (jen „čistá“ osoba bez stop – viz 1.4).
- **Externista** (`isExternal`): nemůže se sám přidat/žádat do skupin, nevidí akce celého souboru (jen pozvání jako host nebo akce cílené na skupiny, kam byl přijat), nevidí existenci skupin (kromě vlastních). Pozn.: jde o jiný koncept než krojový `ExternalPerson` (1.5).
- **Členství ve skupině** je uloženo duplicitně: `groupIds` (aktuální) + `groupIntervals` (historie). Jediný zápis přes `MembersService.setGroupMembership()` – vstup otevře interval `{from: now}`, odchod uzavře poslední otevřený (`to: now`); pokud otevřený chybí (seed bez intervalů), vloží `{from: epoch, to: now}`. Intervaly řídí viditelnost chatu v režimu „od vstupu“.
- **Deaktivace** (`MembershipService.setPersonActive(false)`): odebere všechna pověření, vyjme ze všech skupin (uzavře intervaly), nastaví `isActive=false`; data (odpovědi, docházka, zápůjčky, obsah) zůstávají.
- `toAccessSubject()` pro neaktivní osobu vrací prázdné `groupIds` i `mandates` (bez ohledu na uložená data).

### 1.2 Mandate – pověření (`core/models/mandate.model.ts`)

```ts
type MandateKind = 'ensemble-admin' | 'group-owner' | 'group-deputy' | 'events' | 'attendance' | 'costumes' | 'costumes-view';
interface Mandate {
  id: number;
  memberId: number;
  kind: MandateKind;
  groupId?: number;   // rozsah: skupina (u group-owner/deputy povinně; u events/attendance volitelně)
  eventId?: number;   // rozsah: jedna akce (jen events/attendance)
  grantedAt: string;
  grantedById?: number;
  temporary?: boolean; // přechodné (Správa souboru dočasně spravuje novou skupinu); v UI štítek „přechodně“
}
SCOPED_MANDATE_KINDS = ['events','attendance'];   // rozsah soubor | skupina | akce
GROUP_MANDATE_KINDS  = ['group-owner','group-deputy'];
```

- Role správce skupiny **nejsou atributem skupiny ani členství**, ale pověřením (`group-owner`/`group-deputy` + `groupId`).
- Bez `groupId` a `eventId` = rozsah celý soubor. Unikátnost (memberId, kind, groupId, eventId) hlídá jen `grantSync()` (vrátí existující).
- Detail sémantiky a pravidel viz `03-opravneni.md`.

### 1.3 JoinRequest – žádost / pozvánka / návrh (`features/groups/models/join-request.model.ts`)

```ts
type JoinRequestKind = 'request' | 'invitation';
type JoinRequestStatus = 'awaiting-manager' | 'awaiting-member' | 'accepted' | 'rejected' | 'declined' | 'cancelled';
interface JoinRequest {
  id; groupId; memberId /*koho se týká*/; kind; status;
  createdById: number; createdAt: string;
  approvedById?: number;   // kdo schválil správcovsky (u pozvánky od správce = tvůrce)
  decidedAt?: string; decidedById?: number;
  message?: string;
}
```

Životní cyklus:

- `request` (podá člověk sám): `awaiting-manager` → `accepted` (správce schválí → členství) | `rejected` | `cancelled`.
- `invitation` od správce: `awaiting-member` → `accepted` | `declined` | `cancelled`.
- `invitation` jako **návrh běžného člena**: `awaiting-manager` → (správce schválí) `awaiting-member` → `accepted`/`declined`; nebo `rejected`/`cancelled`.
- „Pending“ = `awaiting-manager | awaiting-member` (`isPendingJoinRequest`). Max. jedna pending pro (groupId, memberId).
- Jakékoli přidání do skupiny uzavře pending záznamy této dvojice stavem `accepted`.
- Seed: prázdné pole.

### 1.4 Trvalé smazání osoby (`features/manage/person-deletion.ts`)

`PersonFootprint` (odvozené, neukládá se) = `{ self, responses, actualAttendance, posts, comments, chat, mentions, eventGuest, costumes, history }` – každý `true` blokuje smazání. `costumes` se zjišťuje rekurzivním průchodem `CostumeState` přes klíče `memberId|*MemberId|memberIds|*MemberIds` (bez `defaultCostumes`). `history` = osoba je aktérem auditu nebo předmětem nesprávní akce. Smazání odstraní: pověření, žádosti, nedostupnosti, výchozí kroj, osobu; do auditu zapíše `person-deleted` s přezdívkou a jménem v `details` (osoba už nebude dohledatelná).

### 1.5 ExternalPerson (krojový externí držitel, `costumes/models/costume.model.ts`)

```ts
interface ExternalPerson { id; name: string; contact?: string; note?: string; createdAt }
type Borrower = { kind: 'member'; memberId: number } | { kind: 'external'; externalId: number };
```

Externí držitel krojů bez účtu – samostatná kolekce v `CostumeState.externals`, nesouvisí s `Member.isExternal`. Polymorfní odkaz `Borrower` se používá v zápůjčkách, inventurách a návštěvách; v `defaultCostumes` jako textový klíč `member-<id>` / `external-<id>`.

## 2. Skupiny a konfigurace souboru

### 2.1 Group (`core/models/group.model.ts`)

```ts
type GroupVisibility = 'open' | 'private' | 'hidden';
type GroupTab = 'chat' | 'board';
type ChatHistoryMode = 'open' | 'from-join';
interface Group {
  id; ensembleId;
  name: string;
  slug: string;            // unikátní (kontrola v MembershipService), použitý v URL /app/boards/:slug
  icon?: IconName;
  description?: string;
  visibility?: GroupVisibility;   // chybí = 'private'
  boardEnabled?: boolean;         // chybí = true (nástěnka)
  chatEnabled?: boolean;          // chybí = true
  defaultTab?: GroupTab;          // chybí = 'board'
  chatHistory?: ChatHistoryMode;  // chybí = 'open'
  chatHistoryLog?: { from: string; mode: ChatHistoryMode }[]; // od kdy platil který režim
  archivedAt?: string;            // archivovaná = jen ke čtení
}
```

- **Viditelnost**: `open` – obsah čtou všichni nearchivovaní, neexterní přihlášení; `private` – existence viditelná, obsah jen členové, lze žádat o vstup; `hidden` – nečlenové nevidí, vstup jen na pozvání.
- **Historie chatu**: změna režimu přidá záznam do `chatHistoryLog` (první změna doplní výchozí záznam `{from: epoch, mode: původní}`). Viditelnost zprávy = režim platný v čase jejího vzniku je `open` NEBO čtenář byl v tu chvíli členem (`groupIntervals`). Přepnutí zpětně nic neodkryje.
- **Životní cyklus**: aktivní → archivovaná (`archivedAt`) ↔ obnovená → smazaná (jen archivovaná, jen Správa souboru). Smazání odstraní příspěvky + jejich komentáře, chat, žádosti, členství (`groupIds`), pověření s `groupId` a skupinu; akce, docházka, krojová evidence a audit zůstávají (s visícím `groupId`).
- **Konstanty**: `CHAT_HISTORY_LABELS`, `GROUP_VISIBILITY_LABELS`, `GROUP_ICON_OPTIONS`.
- Seed (`core/data/mock-groups.ts`): 7 skupin, `GROUP_IDS = { vybor:1, tanecni:2, muzika:3, kluci:4, holky:5, malaVonica:6, sklad:7 /*Krojařky*/ }`. Všechny `private`; Výbor má `chatHistory:'from-join'`; Malá Vonica `chatEnabled:false`; `defaultTab` podle povahy skupiny.

### 2.2 EnsembleSettings (`core/models/ensemble-settings.model.ts`) – singleton „Konfigurace souboru“

```ts
type GroupCreationPolicy = 'admins' | 'members';
interface EnsembleSettings {
  name: string;                                   // default 'Vonica'
  modules: { events: boolean; costumes: boolean }; // volitelné moduly; skupiny/členství jsou jádro
  groupCreation: GroupCreationPolicy;             // default 'admins'
  newGroupDefaults: { visibility; chatEnabled; boardEnabled; defaultTab; chatHistory? };
  chatGrouping: { minComments: number /*3*/; windowMinutes: number /*10*/ }; // seskupování komentářů v chatu
}
```

Ukládá `EnsembleSettingsService.save()` (klíč `ensemble-settings`); při načtení mělký merge s defaulty (vnořené objekty se nemergují).

### 2.3 Osobní nastavení (per zařízení, ne per účet)

- `AppSettings` (`core/settings/settings.service.ts`, klíč `splk.settings`, mimo demo prefix): `theme: 'light'|'dark'|'auto'`, `fontSize: 'normal'|'larger'|'largest'`, `eventsView: 'list'|'calendar'`, `reduceMotion: boolean|null`, `bottomBar: string[]|null` (klíče míst spodní lišty), `sidebarMenu: SidebarMenuConfig|null`, `sidebarCompact`, `calendarExport: { types: string[]; skippedAsNotice }|null`. Není vázané na přihlášeného uživatele.
- `GroupNotifyMode = 'all'|'mentions'|'muted'|'off'` – mapa `"memberId:groupId" → mode` (klíč `group-notify`), default `all`.
- `ChatReadState` – mapa `"memberId:groupId" → ISO čas posledního zobrazení chatu` (klíč `chat-read`).

## 3. Komunikace

### 3.1 Post – příspěvek nástěnky (`features/posts/models/post.model.ts`)

```ts
interface Post {
  id; ensembleId;
  title: string; body: string;          // body s tokeny zmínek/odkazů
  authorId: number;
  groupId: number;                      // nástěnka = skupina (1 příspěvek = 1 skupina)
  publishedAt: string; updatedAt: string;
  isPinned: boolean;
  requiresAction?: boolean;
  mentionedMemberIds?: number[];
  readers?: number[];                   // kdo příspěvek otevřel (stav přečtení vložený do entity)
  lastVisitedAt?: Record<number /*memberId*/, string>; // pro výpočet „nových komentářů“
  archivedAt?: string;                  // archiv (vratný, autor i moderátor); archivace zruší připnutí
  hiddenAt?: string; hiddenById?: number; // skrytí moderátorem: vidí jen autor + moderátoři, mimo chat
}
```

Stavy: publikovaný → (připnutý) → archivovaný ↔ obnovený; nezávisle skrytý ↔ zobrazený. Mazání příspěvku neexistuje (jen purge při smazání skupiny).

### 3.2 PostComment (`features/posts/models/comment.model.ts`)

```ts
interface PostComment { id; postId; authorId; body; createdAt; mentionedMemberIds: number[]; seenByMemberIds: number[] }
```

Bez editace a mazání. `seenByMemberIds` = kdo viděl zmínku/komentář (badge). Komentář má jediný originál pod příspěvkem; chat skupiny na něj jen odkazuje.

### 3.3 ChatMessage – skupinový chat (`features/chat/models/chat-message.model.ts`)

```ts
interface ChatMessage { id; groupId; authorId; body; mentionedMemberIds: number[]; createdAt; editedAt?; deletedAt?; deletedById? }
```

Smazání = měkké (vyprázdní `body` a zmínky, nastaví `deletedAt`), v chatu zůstane neutrální stopa. Max. délka 2000 znaků.

### 3.4 EventChatMessage – chat akce (`features/events/event-chat/event-chat.service.ts`)

```ts
interface EventChatMessage { id; eventId; authorId; body; mentionedMemberIds; createdAt; deletedAt?; deletedById? }
```

Typ je definován ve službě (ne v `models/`). Bez editace. Chat akce je povolen, pokud `event.chatEnabled !== false && !event.skippedReason`. Seed prázdný.

### 3.5 Časová osa chatu skupiny (odvozená, `features/chat/utils/chat-timeline.ts`)

`TimelineItem = message | system (AuditEntry) | post | comment | comment-group` – skládá se při zobrazení z `ChatMessage`, `Post` (bez skrytých/archivovaných), `PostComment` (shluky podle `chatGrouping`) a `AuditEntry` (jen neutrální akce: `member-added/removed/left/joined`, `post-pinned`, `event-created`, `series-created`, `event-updated`, a `mandate-granted/revoked` pro `group-owner/deputy`). Filtrováno predikátem `chatVisibility()`.

### 3.6 Notifikace (odvozené, `core/notifications`)

`GroupActivity { kind: 'chat-message'|'post'|'comment'; groupId; authorId; mentionedMemberIds }` + `shouldNotify(activity, viewerId, canRead, mode)`. Nic se neukládá, upozornění jsou lokální (bez push).

## 4. Akce, účast, docházka, nedostupnost

### 4.1 AppEvent (`features/events/models/event.model.ts`)

```ts
type EventType = 'rehearsal' | 'performance' | 'camp' | 'meeting' | 'other';
interface AppEvent {
  id; ensembleId;
  title: string; type: EventType;
  startsAt: string; endsAt: string;   // lokální čas bez zóny
  location: string; description?: string;
  targetGroupIds: number[];           // komu je určena; [] = celý soubor (bez externistů)
  guestMemberIds?: number[];          // jednotliví hosté (i externisté)
  organizerGroupIds?: number[];       // kdo pořádá – určuje rozsah skupinových pověření 'events'
  requiresAction?: boolean;
  reminderLeadDays?: number;          // předstih výzvy; chybí = podle typu (nácvik 7, vystoupení 14), max 365
  responseDeadline?: string;          // měkká uzávěrka – výzva se zopakuje nerozhodnutým
  chatEnabled?: boolean;              // chybí = true
  seriesId?: number;                  // výskyt série; každý výskyt je samostatná akce
  skippedReason?: string;             // vynechaný výskyt série (jen informační, nečeká na odpověď)
  importantChange?: { at: string; note: string; requiresConfirmation?: boolean }; // jen POSLEDNÍ důležitá změna
  attendance?: AttendanceRecord[];    // ODVOZENÉ – připojuje EventsService, při ukládání se odstraní
}
```

- **Série** nemá vlastní entitu: jen sdílené `seriesId` (`max(seriesId)+1`). Pravidla generování (`SeriesRule`, `HolidayRange`, `SeriesOccurrence`, max. 120 výskytů) jsou jen vstup formuláře, neukládají se.
- **Cílení vs. pořádání vs. správa** jsou oddělené: `targetGroupIds`/`guestMemberIds` (publikum, `isEventAudience`), `organizerGroupIds` (pořadatel), pověření `events` (kdo smí upravovat).
- Smazání akce je tvrdé; účast/docházka/chat akce s daným `eventId` zůstávají (osiřelé).
- `EventCategory` (`events/models/event-category.model.ts`: `id, ensembleId, name, slug, color?, defaultLocation?, defaultTime?, targetGroupIds?, requiresConfirmation`) + `MOCK_EVENT_CATEGORIES` existují, ale **nikde se nepoužívají** (mrtvý model).

### 4.2 AttendanceRecord – nahlášená účast (`features/attendance/models/attendance.model.ts`)

```ts
type AttendanceStatus = 'yes' | 'no' | 'maybe' | 'pending';
interface AttendanceRecord {
  eventId: number; memberId: number;   // kompozitní klíč, bez vlastního id
  status: AttendanceStatus;            // 'pending' = bez odpovědi (záznam může existovat jen kvůli zobrazení)
  note?: string;
  firstViewedAt?: string;              // první otevření detailu akce
  lastViewedAt?: string;               // poslední otevření detailu (rychlá odpověď ze seznamu ho nemění)
  confirmedAt?: string;                // výslovné potvrzení důležité změny
}
```

Jeden záznam osoba × akce kombinuje odpověď a sledování zobrazení. Po skončení akce (`isResponseClosed`) člen svou odpověď měnit nemůže (kontrola ve službě jen pro vlastní záznam). Organizátor může ve formuláři akce zapsat stav za jiné členy. Necommitnutá změna: v detailu akce lze odpovědět klikem na součtové počty (`quickRespond`), „Bez odpovědi“ po potvrzení odpověď zruší (vč. poznámky).

### 4.3 ActualAttendance – skutečná docházka (`features/attendance/models/actual-attendance.model.ts`)

```ts
interface ActualAttendance { eventId; memberId; present: boolean; recordedByMemberId: number; recordedAt: string }
```

Kompozitní klíč (eventId, memberId). Oddělená od nahlášené účasti (ta se nikdy nepřepisuje). „Nezkontrolovaný“ = záznam neexistuje (`clear` ho smaže). Odvozené typy reportu: `AttendanceCell = boolean|null|undefined`, `MemberAttendanceSummary`, `AttendanceReportRow`, `AttendanceReport`, `AttendancePeriodFilter` (`attendance/utils/actual-attendance.utils.ts`).

### 4.4 Unavailability – dlouhodobá nedostupnost (`features/availability/unavailability.model.ts`)

```ts
interface Unavailability { id; ensembleId; memberId; from: string /*YYYY-MM-DD*/; to: string; note?: string; createdAt; createdById }
interface UnavailabilityInput { from; to; note? }
```

Spravuje jen člen sám (přidat/smazat, editace neexistuje). Důvod (`note`) a překryv s akcí vidí jen organizátoři s právem upravit akci / evidovat docházku, resp. zakládat akce (při plánování). Není omluvenkou ani odpovědí.

## 5. Audit (`features/audit/audit.model.ts`)

```ts
type AuditAction =
  | 'member-added'|'member-removed'|'member-left'|'member-joined'
  | 'request-created'|'request-approved'|'request-rejected'|'request-cancelled'
  | 'invitation-created'|'invitation-declined'|'invitation-cancelled'|'proposal-created'
  | 'mandate-granted'|'mandate-revoked'
  | 'group-created'|'group-updated'|'group-archived'|'group-restored'|'group-deleted'
  | 'person-created'|'person-updated'|'person-deactivated'|'person-reactivated'|'person-deleted'
  | 'post-published'|'post-pinned'|'post-unpinned'|'post-hidden'|'post-unhidden'|'post-archived'|'post-restored'
  | 'event-created'|'series-created'|'event-updated'|'settings-updated';
interface AuditEntry {
  id; at: string; actorId: number;
  action: AuditAction;
  groupIds: number[];          // dotčené skupiny (u akce cílové + pořádající)
  memberId?; postId?; eventId?;
  mandateKind?: MandateKind;
  details?: string;            // neutrální popis (změny akce, změněná pole skupiny, 'externista', jméno smazané osoby)
  note?: string;               // interní poznámka (jen ve správě)
  extraordinary?: boolean;     // zásah Správy souboru do skupiny, kterou nespravuje
}
```

- Append-only (`AuditService.record`). Slouží zároveň jako zdroj systémových zpráv v chatu a jako blokátor trvalého smazání osoby.
- Nezapisuje se: `post-published` (definováno, nikde se nevolá), smazání akce, změny docházky/účasti, krojové operace (ty mají vlastní `CostumeEvent`), chat.
- `actorId` může být `0`, když služba nezná přihlášeného (`memberId() ?? 0`).

## 6. Kroje (stručně, detail v `06`)

`CostumeState` je **jeden agregát** uložený pod klíčem `costumes`:

```ts
interface CostumeState {
  classification: { ensembleId; genders: ClassificationOption[]; regions: ClassificationOption[]; variants: CostumeVariant[] };
  partTypes: CostumePartType[];     // druh součástky {id, name, genderId?}
  series: CostumeSeries[];          // evidenční řada {id, genderId, regionId, partTypeId, variantId?, allowNumberReuse?, note?}
  items: CostumeItem[];             // fyzický kus {id, seriesId, number?, variantId?, size?, condition, issuable, location, retired?, …}
  externals: ExternalPerson[];
  loans: CostumeLoan[];             // {id, itemId, borrower: Borrower, issuedAt, dueAt?, replacesLoanId?, inventoryId?, visitId?, endedAt?, endReason?}
  workOrders: CostumeWorkOrder[];   // úprava/oprava/přešití {kind, status, assignee?: string, …}
  kitTemplates: CostumeKitTemplate[]; // komplet jako šablona (genderId, regionId, partTypeIds)
  events: CostumeEvent[];           // historie kusu {kind, itemId, text, loanId?, inventoryId?, visitId?, workOrderId?}
  defaultCostumes: Record<string /*'member-1'|'external-2'*/, string /*genderId*/>;
  defaultSlotCapacity: number;
  inventories: Inventory[];         // {scope: InventoryScope, scopeLabel, targetItemIds (snapshot), holders: Borrower[], additions, slotCapacity, closure?}
  inventorySlots: InventorySlot[];  // termín {inventoryId, startsAt, endsAt?, capacity, place?}
  inventoryVisits: InventoryVisit[]; // {inventoryId, borrower, slotId?, status: VisitStatus, …}
  inventoryChecks: InventoryCheck[]; // {inventoryId, itemId, mode: 'person'|'stock', presented, condition?, …}
}
```

Výčty: `ItemCondition = 'ok'|'needs-alteration'|'damaged'`, `ItemLocation = 'store'|'holder'|'seamstress'|'repair'|'unknown'`, `LoanEndReason = 'returned'|'exchanged'|'settled'`, `WorkOrderKind = 'alteration'|'repair'|'resewing'`, `WorkOrderStatus = 'open'|'in-progress'|'done'|'cancelled'`, `VisitStatus = 'booked'|'in-progress'|'completed'|'cancelled'`, `CheckMode = 'person'|'stock'`, `CostumeEventKind` (10 hodnot). Stav kusu, umístění, zápůjčka a pracovní úkol jsou záměrně ortogonální. Odvozené: `ItemAvailability = 'available'|'on-loan'|'away'|'not-issuable'|'retired'`, `Holding`, `SeriesStats`, `ItemCheckState`, `PersonInventoryStatus`, `QuickEntryOutcome` aj. (`costumes/utils`).

## 7. ER přehled (vztahy)

- Member 1:N Mandate (`memberId`); Mandate N:1 Group (`groupId`, volitelně); Mandate N:1 AppEvent (`eventId`, volitelně)
- Member M:N Group přes `Member.groupIds[]` (+ historie `groupIntervals`) – bez spojovací entity
- Group 1:N JoinRequest; Member 1:N JoinRequest (`memberId`, `createdById`, `approvedById`, `decidedById`)
- Group 1:N Post; Member 1:N Post (`authorId`); Post 1:N PostComment; Member 1:N PostComment
- Post M:N Member: `readers[]`, `lastVisitedAt{}`, `mentionedMemberIds[]`; PostComment M:N Member: `mentionedMemberIds[]`, `seenByMemberIds[]`
- Group 1:N ChatMessage; Member 1:N ChatMessage (`authorId`, `deletedById`)
- AppEvent M:N Group: `targetGroupIds[]`, `organizerGroupIds[]`; AppEvent M:N Member: `guestMemberIds[]`
- AppEvent 1:N AttendanceRecord N:1 Member (kompozitní klíč); AppEvent 1:N ActualAttendance N:1 Member
- AppEvent 1:N EventChatMessage
- AppEvent N:1 „série“ přes `seriesId` (bez entity)
- Member 1:N Unavailability
- AuditEntry N:1 Member (`actorId`, `memberId`), M:N Group (`groupIds[]`), N:1 Post/AppEvent
- CostumeItem N:1 CostumeSeries N:1 CostumePartType; CostumeLoan N:1 CostumeItem, N:1 Borrower (Member | ExternalPerson); Inventory 1:N InventorySlot/Visit/Check
- EnsembleSettings – singleton; AppSettings – per zařízení; GroupNotify/ChatRead – mapy podle `memberId:groupId`

## 8. Uložená vs. odvozená data

Uložená redundance:
- `Member.groupIds` vs. `groupIntervals` (aktuální stav = poslední otevřený interval).
- `Group.chatHistory` vs. poslední záznam `chatHistoryLog`.
- `mentionedMemberIds` vs. tokeny v `body`.
- `Inventory.scopeLabel`, `targetItemIds`, `holders`, `closure.{verified,total,…}` – snapshoty v okamžiku zahájení/uzavření.
- `AuditEntry.details` u `person-deleted` – kopie jména.

Odvozené (nepersistují):
- `AppEvent.attendance` (join z AttendanceService; při ukládání se odstraní).
- Rozsah přístupu (`AccessSubject`, `AccessOverview`), badge nepřečtených (`visibility.utils`), časová osa chatu, `PendingAction` (dashboard: `event-response|event-change|group-invitation|group-requests|inventory-booking|loan-overdue|attendance-record`), `PersonFootprint`, výsledky hledání (`SearchHit: post|comment|message|event`), reporty docházky, krojové přehledy.
- Výchozí hodnoty volitelných polí (viz 0).

## 9. Perzistence a seed mock dat

### 9.1 Úložiště

- `core/data/demo-storage.ts`: `loadDemoData(name, seed)` / `saveDemoData(name, value)`, klíče `splk.demo.<name>`, verze `splk.demo.version = 9` (`DEMO_DATA_VERSION`). Nesoulad verze → smazání všech demo klíčů a nový seed. Nedostupné úložiště → jen paměť.
- Kolekce (každá = jeden JSON blob celé kolekce): `members`, `groups`, `mandates`, `join-requests`, `audit`, `posts`, `comments`, `chat-messages`, `chat-read`, `event-chat`, `events` (bez `attendance`), `attendance`, `actual-attendance`, `unavailability`, `ensemble-settings`, `group-notify`, `costumes` (celý `CostumeState`).
- Mimo demo prefix: `splk.auth.user`, `splk.settings` (reset dema je nemaže).
- Synchronizace mezi záložkami přes událost `storage` jen u `comments`, `chat-messages`, `chat-read`.
- `DemoDataService.reset()` = smazat demo klíče + reload. Služby mají `resetCache()` (testy).
- Mock služby simulují latenci `delay(300)` (kroje 150 ms), část API je synchronní (signály, `find*`).

### 9.2 Seed (`features/*/data/mock-*.ts`)

- **Členové** (`members/data/mock-members.ts`): ~11 vymyšlených osob (vč. 1 externisty a 1 neaktivní), `MOCK_ENSEMBLE_ADMIN_IDS`. Konfigurace buildu `demo` přes `fileReplacements` podstaví `mock-members.local.ts` (lokálně generovaný import reálných členů skriptem, mimo git). Všechny ostatní seedy proto **nepoužívají pevná ID osob**, ale vybírají je podle skupin/přezdívek.
- **Funkce osob** (`DEMO_FUNCTION_TITLES`, přezdívka → popisek) se doplní při seedu členů.
- **Pověření** (`seedMandates`): z ID adminů → `ensemble-admin` + `events` (celý soubor); hlavní správce a spolusprávci skupin podle tabulky přezdívek, fallback = první aktivní člen skupiny; členové Výboru → `attendance` (celý soubor); členové skupiny Krojařky → `costumes`; ostatní členové Výboru a admini → `costumes-view`. `grantedAt` pevné datum.
- **Autoři obsahu** (`members/data/demo-authors.ts`): `demoMember(groupIds, nth, exclude)` / `otherDemoMember(...)` – deterministicky n‑tý aktivní člen dané skupiny.
- **Akce** (`events/data/mock-events.ts`): `relativeDate(daysOffset, h, m)` od dneška; generované nácviky (úterý tanečníci, pátek celý soubor) ±8 týdnů, ID od `FIRST_REHEARSAL_ID = 100`; + ruční akce s ID od 1 (vystoupení, soustředění, schůze; ukázky hostů, pořadatelů, série, vynechání, důležité změny).
- **Účast** (`mock-attendance.ts`): deterministická pseudonáhoda `(eventId*7 + memberId*13) % 10` pro publikum akce (`isEventAudience`); proběhlé akce mají odpověď od všech, budoucí od části. **Skutečná docházka**: proběhlé nácviky kromě posledního, zapisovatel = první aktivní člen Výboru.
- **Příspěvky/komentáře/chat**: `daysAgo()` / `minutesAgo()` relativně k teď; ~12 příspěvků, ~12 komentářů, desítky chatových zpráv; zmínky vkládané tokeny.
- **Audit** (`seedAudit`): pár ukázkových členských událostí (hodiny zpět) pro systémové zprávy v chatu.
- **Nedostupnost**: 2 záznamy s pevnými memberId (4, 7) relativně k dnešku.
- **Kroje** (`seedCostumeState(members)`): řady, kusy s nesouvislými čísly a vyřazenými kusy, zápůjčky držitelům vybraným podle skupin, rozběhnutá i uzavřené inventury, vše relativně k dnešku.

## Pozorování a technický dluh

- **Žádná entita účtu**: `Member.userId` je v praxi rovno `id`; přihlášení, osoba a členství v souboru jsou jedna řádka. Pro backend (registrace, více souborů, rodiče/děti) bude nutné rozdělit Person/Account/Membership.
- **Neexistuje entita Soubor**: `ensembleId: 1` je natvrdo ve službách (`createPerson`, `createGroup`, nedostupnost, kroje); `EnsembleSettings` nemá id. Malá Vonica je modelována jen jako skupina.
- **Pole ID místo vazebních tabulek**: `Member.groupIds`, `Post.readers`, `Post.lastVisitedAt` (mapa), `mentionedMemberIds`, `seenByMemberIds`, `targetGroupIds`, `organizerGroupIds`, `guestMemberIds`, `AuditEntry.groupIds`, `Inventory.targetItemIds/holders`. Pro relační DB nutné převést na M:N tabulky; stav přečtení uvnitř příspěvku (`readers`, `lastVisitedAt`) roste s počtem členů a při každém přečtení přepisuje celý záznam.
- **Polymorfní reference**: `Borrower` (member | external) a textové klíče `member-<id>`/`external-<id>` v `defaultCostumes` – v SQL nutná dvojice nullable FK nebo diskriminátor.
- **Dva koncepty „externí osoby“**: `Member.isExternal` (externista s účtem) vs. krojový `ExternalPerson` (bez účtu). Snadno zaměnitelné; žádný převod mezi nimi.
- **Kompozitní klíče bez id**: `AttendanceRecord`, `ActualAttendance` – OK pro SQL, ale `AttendanceRecord` míchá odpověď a telemetrii zobrazení (`firstViewedAt/lastViewedAt/confirmedAt`); záznam se `status:'pending'` vzniká i jen otevřením detailu.
- **Série akcí bez entity** (`seriesId` = max+1, pravidlo opakování se neukládá) – nelze hromadně upravit sérii ani zjistit její pravidlo.
- **`importantChange` drží jen poslední změnu** – potvrzení předchozích změn se ztrácí; `confirmedAt` v AttendanceRecord nerozlišuje, kterou změnu potvrzuje.
- **Smíšené formáty času** (UTC `Z` vs. lokální bez zóny vs. datum) – porovnávání řetězců (`event.startsAt < now` v seedu) míchá zóny; backend bude potřebovat jednotnou konvenci.
- **Osiřelé reference**: smazání akce nechá účast, docházku, chat akce, pověření s `eventId` a audit; smazání skupiny nechá `targetGroupIds/organizerGroupIds` akcí a audit. Žádná referenční integrita.
- **Redundance bez transakce**: `groupIds` vs. `groupIntervals`, `chatHistory` vs. `chatHistoryLog`, tokeny vs. `mentionedMemberIds` – konzistenci drží jen jediná zapisující metoda.
- **`CostumeState` jako jeden JSON blob** – každá operace klonuje a ukládá celý fond (`structuredClone`); pro DB rozpad na ~15 tabulek.
- **Mrtvý kód**: `EventCategory` + `MOCK_EVENT_CATEGORIES` nepoužité; `AuditAction 'post-published'` se nikdy nezapisuje; `GroupsService.createGroup/updateGroup/deleteGroup` (bez kontrol) obcházené přes `MembershipService`.
- **Přidělování ID `max+1`** v klientu – při souběhu (dvě záložky) kolize; po smazání posledního záznamu se ID recykluje.
- **Profil ukládá celou kopii osoby** (`updateMember(id, {...staráKopie, ...změny})`) – může přepsat souběžné změny `groupIds`/`isActive` provedené mezitím Správou.
- **Mělký merge `EnsembleSettings`** s defaulty – nově přidaný vnořený klíč (např. v `modules`) se u uložené konfigurace nedoplní.
- **Osobní nastavení per zařízení** (`splk.settings`), ne per účet; notifikační předvolby a stav přečtení chatu jsou per účet jen díky klíči `memberId:groupId` v témže prohlížeči.
