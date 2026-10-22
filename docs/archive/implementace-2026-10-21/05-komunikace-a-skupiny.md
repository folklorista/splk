# 05 – Komunikace a skupiny (nástěnka, příspěvky, chat, členství, hledání, upozornění)

Popis **skutečně implementovaného** chování (Angular 19, standalone, mock services persistované do `localStorage` přes `core/data/demo-storage`). Oprávnění jen stručně – detail viz 02/03. Cesty relativně k `frontend/src/app`.

## 1. Přehled a mapa

- **Skupina** = jediná komunikační i organizační jednotka. Má volitelně **chat** a **nástěnku** (obojí default zapnuto). Bez obou = „organizační skupina“ (cílení akcí, pověření).
- **Prostor skupiny** `/app/boards/:slug` – záložky `chat | board | events | members | manage`, záložka v `?tab=`.
- **Rozcestník** `/app/boards` – moje skupiny, pozvánky, další skupiny (vstup/žádost), archivované.
- **Příspěvek** `/app/posts/:id` (detail + komentáře), `/app/posts/:id/edit`, nový `/app/boards/:slug/new` (guard `boardGuard`).
- **Hledání** `/app/search`.
- Datové toky: komponenta → feature service (`PostsService`, `CommentsService`, `ChatService`, `MembershipService`, `BoardsService`) → in-memory cache + `localStorage`. Žádné HTTP.

| Service | Úložiště (demo klíč) | Reaktivita |
|---|---|---|
| `PostsService` | `posts` | modulová proměnná, `Observable` s `delay(300)`; **bez** živého streamu (konzumenti pollují) |
| `CommentsService` | `comments` | `BehaviorSubject` + `storage` event (sync mezi záložkami) |
| `ChatService` | `chat-messages`, `chat-read` | `signal` + `storage` event |
| `GroupsService` | `groups` | `signal` (čisté úložiště, bez kontrol) |
| `JoinRequestsService` | `join-requests` | `signal` (čisté úložiště) |
| `MembershipService` | – | všechny mutace skupin/členství/pověření s kontrolou oprávnění + audit |
| `GroupNotificationsService` | `group-notify` | `signal` |

## 2. Datové modely (zkráceně)

```ts
Post { id; ensembleId; title; body /*s tokeny*/; authorId; groupId /*nástěnka*/;
  publishedAt; updatedAt; isPinned; requiresAction?; mentionedMemberIds?;
  readers?: number[];                       // kdo příspěvek otevřel
  lastVisitedAt?: Record<memberId, ISO>;    // pro „nové komentáře“
  archivedAt?; hiddenAt?; hiddenById? }

PostComment { id; postId; authorId; body; createdAt;
  mentionedMemberIds: number[]; seenByMemberIds: number[] }   // seen = jen pro zmínky

ChatMessage { id; groupId; authorId; body; mentionedMemberIds; createdAt;
  editedAt?; deletedAt?; deletedById? }     // smazání = soft, body se vyprázdní

Group { id; ensembleId; name; slug; icon?; description?;
  visibility?: 'open'|'private'|'hidden'   // default private
  boardEnabled?; chatEnabled?;              // default true
  defaultTab?: 'chat'|'board';              // default board
  chatHistory?: 'open'|'from-join';         // default open
  chatHistoryLog?: {from, mode}[]; archivedAt? }

JoinRequest { id; groupId; memberId; kind: 'request'|'invitation';
  status: 'awaiting-manager'|'awaiting-member'|'accepted'|'rejected'|'declined'|'cancelled';
  createdById; createdAt; approvedById?; decidedAt?; decidedById?; message? }

Member.groupIntervals?: Record<groupId, {from, to?}[]>   // pro historii chatu
ChatReadState = Record<"memberId:groupId", ISO>          // poslední zobrazení chatu
GroupNotifyMode = 'all'|'mentions'|'muted'|'off'         // per člen × skupina, default 'all'
EnsembleSettings.chatGrouping = { minComments: 3, windowMinutes: 10 }
```

- Nová ID = `max(id)+1`. Časy ISO stringy, porovnání `Date.parse` nebo lexikograficky.
- `requiresAction` je v modelu a editaci, ale formulář ho nenastavuje (viz dluh).

## 3. Odkazy v textu: zmínky `@` a akce `#` (`features/posts/utils/mentions.ts`)

Společné pro příspěvek, komentář i chat.

- **Uložený formát**: tokeny `@[member:ID]`, `#[event:ID]`. Jméno/název se vykreslí z aktuálních dat → přejmenování odkaz nerozbije.
- **Psaní** (`shared/mention-input`): `<textarea>` (bez contenteditable/innerHTML), uživatel vidí `@Přezdívka` / `#Název · d. M.` (mimo letošek `· d. M. RRRR`).
  - Spouštěč: `@` nebo `#` na začátku nebo po bílém znaku, dotaz bez `\n`, max 40 znaků (`activeMentionQuery`). E-mail tedy nespouští.
  - Členové: filtr bez diakritiky/velikosti (`nicknameKey`), nejdřív prefixové shody, limit 6.
  - Akce (`parseEventQuery`): volný text + datum v řadě formátů (`15.1.`, `15. 1. 2027`, `15/1`, měsíc slovem nominativ/genitiv, samostatný rok). Pořadí: nadcházející (nejbližší první), pak proběhlé (nejnovější první), limit 10.
  - Klávesy: ↑/↓, Enter/Tab vybere, Esc zavře; v chatu `sendOnEnter` (Shift+Enter = nový řádek, respektuje IME `isComposing`).
  - Kandidáti: aktivní členové skupiny nástěnky/chatu **kromě sebe**; akce = `EventsService.linkableEvents` (jen ty, které autor smí vidět).
- **Odeslání** `encodeMentions`: nahradí `@Přezdívka` jen u **vybraných** z nabídky (delší přezdívky první, aby „@Jan D“ nepřebil „@Jan“). Ručně napsané nebo po výběru přepsané jméno se neuloží jako zmínka. `mentionedMemberIds` = jen skutečně nalezení.
- **Úprava** `decodeMentions`: tokeny zpět na čitelný text, obnoví seznam vybraných (jen dokud uživatel nezačne psát – `touched`).
- **Režimy komponenty**: s tlačítkem (`submitted`, po odeslání se vyprázdní) / formulářový `showSubmit=false` (průběžně `valueChange` se zakódovaným textem).
- **Vykreslení** `shared/rich-text`: `parseCommentBody` → segmenty; zmínka = `<span class="mention">@nick</span>` (neznámý člen → „člen“), akce = `routerLink` na `/app/events/ID`; akce, kterou čtenář nesmí vidět, se zobrazí jen jako „akce“ bez názvu. `white-space: pre-line`. Žádné HTML → bez XSS.
- `plainText()` = čistý text pro náhledy/hledání/upozornění.

## 4. Nástěnka a příspěvky

### 4.1 Seznam (`PostsComponent`, záložka `board`)
- Načte všechny příspěvky (`getPosts`) + členy jednorázově (`forkJoin`), komentáře jako živý stream (`takeUntilDestroyed`).
- Filtr: `groupId === board.id`; **skrytý** příspěvek jen pro autora a moderátora.
- Řazení (`sortBoardPosts`): připnuté nahoře, pak `publishedAt` desc. Archivované v rozbalovacím oddílu „Zobrazit archivované (N)“, řazené podle `archivedAt` desc.
- Odznaky položky: `Zmínka` (neviděná zmínka v komentářích), `Nepřečteno` (nejsem v `readers`, jen nearchivované), `N nových komentářů` (skloňování 1 / 2–4 / 5+), `Skryto moderátorem`, `Archiv` nebo `Připnuto`. Zvýraznění položky = nepřečteno nebo zmínka.
- Meta: datum, autor (`nickname`), pro moderátora `Přečteno X z Y` (Y = aktivní členové skupiny).
- Tlačítko „+ Nový příspěvek“ jen pro `canPostInGroup` (člen + skupina nearchivovaná).

### 4.2 Detail (`PostDetailComponent`)
Načítací řetěz: aktuální uživatel → člen → příspěvek → `BoardsService.getBoardById` (vrací skupinu jen při `canReadGroupContent`). „Příspěvek nebyl nalezen“ když: nepřihlášen, neexistuje, nemá přístup ke skupině, nebo je skrytý a čtenář není autor ani moderátor.

Po zobrazení:
1. `markVisited(postId, memberId)` – zapíše `lastVisitedAt[member] = now`. **Znovu i v `ngOnDestroy`**, aby komentáře přibylé během čtení nebyly potom „nové“.
2. `markAsRead` – přidá do `readers` (jen jednou, `updatedAt` se nemění). Probíhá i u nečlena otevřené skupiny.
3. Komentáře jako živý stream; všechny komentáře se zmínkou čtenáře, které ještě neviděl → `markSeen`.
4. Fragment `#comment-ID` (odkaz z chatu/hledání) → jednorázový `scrollIntoView` a zvýraznění cíle.

UI:
- Meta: autor, vytvořeno (abs. + relativní), „Aktualizováno“ jen když `updatedAt ≠ publishedAt`. Připnutý má štítek „Důležité“.
- Akce: **Upravit** (jen autor), **Připnout/Odepnout** (moderátor, ne u archivovaného), **Skrýt/Znovu zobrazit** (moderátor, skrytí s potvrzovacím dialogem), **Archivovat/Obnovit z archivu** (autor nebo moderátor; archivace s potvrzením). Chyby přes `actionError`.
- **Statistika čtenosti** (jen moderátor, ne Správa souboru): rozbalovací „Přečteno X z Y“ se sloupci Přečetlo / Nepřečetlo. Y = všichni členové skupiny (`groupIds` obsahuje skupinu – zde **včetně neaktivních**, na rozdíl od seznamu).
- **Komentáře**: plochý chronologický seznam (bez vláken, bez editace/mazání komentářů). Formulář jen pro `canPostInGroup` (nečlen otevřené skupiny jen čte). Odeslaný komentář se slučuje idempotentně (stream ho doručí také).

### 4.3 Formulář (`PostFormComponent`)
- Pole: Nadpis*, Obsah* (`app-mention-input` bez tlačítka). Žádné přílohy, obrázky, cílení ani `requiresAction`.
- Nový: nástěnka ze `slug`; přístup hlídá `boardGuard` (člen, nearchivovaná, `getBoardBySlug` ok; jinak redirect `/app/boards`). Vytvoří `readers: []`, `isPinned: false`, `ensembleId: 1` (natvrdo). Po uložení → detail (ten autora označí jako čtenáře).
- Úprava: jen autor (ani správce skupiny cizí obsah nepřepisuje) → jinak „Tento příspěvek nemůžete upravit.“ Mění se `title`, `body`, `requiresAction`, `updatedAt`; `publishedAt`, `readers`, `isPinned` se zachovají (editace nespouští „nepřečteno“ znovu).
- Chyba → obecná hláška „Nepodařilo se …“ (bez rozlišení typu chyby).

### 4.4 Stavové přechody příspěvku (`PostsService`)

| Akce | Kdo | Efekt | Audit |
|---|---|---|---|
| `createPost` | člen skupiny, za sebe, skupina nearchivovaná | nový | – (`post-published` existuje v modelu, ale nezapisuje se) |
| `updatePost` | autor | title/body/requiresAction | – |
| `setPinned(true/false)` | moderátor | `isPinned` | `post-pinned` / `post-unpinned` |
| `setHidden(true/false)` | moderátor | `hiddenAt/hiddenById` | `post-hidden` / `post-unhidden` |
| `archivePost` | autor nebo moderátor | `archivedAt`, **odepne** | `post-archived` |
| `restorePost` | autor nebo moderátor | smaže `archivedAt` (připnutí se nevrací) | `post-restored` |
| `purgeGroup` | volá `MembershipService.deleteGroup` | fyzické smazání | – |

- Moderátor = `canModerateGroup`: správce skupiny (owner/deputy), který je zároveň čtenářem obsahu a skupina není archivovaná. Správa souboru bez členství nemoderuje.
- Audit nese `groupIds:[groupId]`, `postId`, `memberId: authorId` → zobrazuje se v historii skupiny; do chatu jde jen `post-pinned`.
- Nečtená data: `readers` (otevření), `lastVisitedAt` (nové komentáře), `seenByMemberIds` (zmínky). Tři nezávislé mechanismy.

## 5. Komentáře (`CommentsService`)

- `addComment(postId, authorId, body, mentionedMemberIds)`: povoleno jen když `authorId === přihlášený` a `canPostInGroup` pro skupinu příspěvku. **Nekontroluje** archivaci/skrytí samotného příspěvku → lze komentovat archivovaný příspěvek.
- Sync mezi záložkami: zápis do `localStorage`, `storage` event v ostatních záložkách nahradí stav (jediná „realtime“ náhrada; spoléhá i notifikace zmínek).
- `markSeen` idempotentní. `purgePosts` při mazání skupiny.
- `isAuthor`/`mentions(memberId)` – pomocné dotazy pro „trvalé smazání osoby bez stop“ (viz 07).
- Čtecí API (`getComments`, `getAllComments`) **nefiltruje oprávnění** – filtrují komponenty.

## 6. Chat skupiny

### 6.1 `ChatService`
- `messagesFor(groupId)` – prázdné bez `canReadGroupContent`.
- `send`: člen + nearchivovaná (`canPostInGroup`), `hasChat`, neprázdný trim, max **2000 znaků**; po odeslání autorovi `markRead`.
- `edit`: jen autor, ne smazaná zpráva; nastaví `editedAt`. **V UI není tlačítko Upravit** – metoda je jen v service a testech.
- `remove`: autor, nebo moderátor; soft-delete (`body=''`, `mentionedMemberIds=[]`, `deletedAt`, `deletedById`). V UI stopa „Zpráva byla odstraněna (moderátorem).“ Nekontroluje archivaci skupiny u autora.
- Read state: `markRead(groupId)` uloží `now` pod `memberId:groupId`. Přečtení chatu **neoznačuje** příspěvky ani komentáře.
- Bez WebSocketu: chatové zprávy reaktivně přes signal (v rámci záložky) a `storage` event; příspěvky v chatu pollují každé **2 s**.

### 6.2 Časová osa (`chat-timeline.ts`, `buildGroupTimeline`)
Jedna chronologická osa (vzestupně) z:
- `message` – běžné zprávy skupiny (včetně smazaných – jako stopa),
- `system` – neutrální systémové události z auditu (`isChatSystemEvent`): `member-added/removed/left/joined`, `post-pinned`, `event-created`, `series-created`, `event-updated`, a `mandate-granted/revoked` jen pro `group-owner/deputy`. Žádosti, zamítnutí ani interní poznámky do chatu nejdou.
- `post` – karta „nový příspěvek na nástěnce“ (náhled 140 znaků),
- `comment` / `comment-group` – aktivita komentářů; **originál zůstává pod příspěvkem**, v chatu jen odkaz.

Pravidla:
- Do chatu se promítají jen příspěvky viditelné všem (`isPostInChat`: ne skryté, ne archivované) – včetně jejich komentářů.
- **Automatické seskupení komentářů**: komentáře jednoho příspěvku se rozdělí na shluky souvislé aktivity (mezera mezi sousedy ≤ `windowMinutes`=10). Shluk s ≥ `minComments`=3 → jedna souhrnná karta „N komentáře/ů“ s časem posledního, náhledem posledního a `N nových`; menší shluk → samostatné karty. Nastavitelné v konfiguraci souboru.
- „Nový komentář“ (`isNewComment`) = cizí a novější než `post.lastVisitedAt[viewer]` (bez návštěvy = všechny cizí).
- Akce na kartě: „Otevřít diskuzi / Otevřít všech N komentářů“ (odkaz s fragmentem na komentář), **Odpovědět** – inline pole, odpověď se uloží jako **komentář příspěvku**, ne chatová zpráva.

### 6.3 Historie chatu pro nové členy (`chat-history.ts`)
- Režim `open` (default) nebo `from-join`. Změna se zapisuje do `chatHistoryLog` → každé období zůstává pod pravidlem, kdy vzniklo (přepnutí na `open` zpětně nic neodkryje; zpřísnění platí jen dopředu).
- Viditelnost položky v čase `at`: režim v `at` je `open`, NEBO čtenář byl v `at` členem (`groupIntervals`; člen bez intervalů = člen od počátku). Mezera mezi dvěma členstvími zůstane skrytá. Nečlen otevřené skupiny období `from-join` nevidí.
- Intervaly vznikají v `MembersService.setGroupMembership` (vstup otevře, odchod uzavře).
- Predikát se aplikuje na zprávy, systémové události, příspěvky i komentáře v chatu, na nepřečtené a na hledání.

### 6.4 `GroupChatComponent` – UX
- Den odděluje štítek (Dnes / Včera / „pondělí 3. 2.“).
- Hranice **„Nové“** = první cizí zpráva po `lastReadAt` zafixovaném **při otevření** (během čtení neposkakuje); počítají se jen `message`, ne karty.
- Auto-scroll jen při skutečném přírůstku položek a jen když je čtenář u konce (tolerance 80 px) nebo při prvním zobrazení – pak i `markRead`. Jinak tlačítko „Nové zprávy ↓“; doscrollování/klik → `markRead`. `markRead` také v `ngOnDestroy`.
- Zpráva se zmínkou čtenáře zvýrazněna (`chat-msg--mention`), vlastní zprávy stylované jako `--own`, „· upraveno“ při `editedAt`.
- Nečlen otevřené skupiny: „Chat čtete jako nečlen otevřené skupiny – psát mohou jen členové.“ Archivovaná skupina: composer skrytý (stejná hláška – nepřesná).

## 7. Skupiny – rozcestník, prostor, správa

### 7.1 Viditelnost a přístup (shrnutí chování)
| Viditelnost | Nečlen vidí v rozcestníku | Čte obsah | Vstup |
|---|---|---|---|
| `open` | ano | ano (ne externista) | hned („Vstoupit“) |
| `private` (default) | ano | ne | žádost správci |
| `hidden` | ne | ne | jen pozvánka |

- Správa souboru ani technická správa obsah neodemyká. Externista nevidí cizí ani otevřené skupiny a nemůže žádat/vstupovat.
- Archivovaná skupina: jen ke čtení, nikdo nepíše ani nemoderuje, žádné změny členství/nastavení, žádná upozornění, mimo menu a badge.

### 7.2 Rozcestník `/app/boards` (`BoardsComponent`)
Sekce:
1. **Pozvánky pro vás** (`awaiting-member` pro mě): Přijmout / Odmítnout, „Pozval/a X“.
2. Upozornění „Ve skupinách, které spravujete, čekají žádosti…“ s počtem `awaiting-manager`.
3. **Moje skupiny** (nearchivované) s badge nepřečteného (stejný zdroj jako menu).
4. **Další skupiny**: nečlenské, viditelné, ne skryté; tlačítka `Číst` (open), `Vstoupit` (open), `Požádat o vstup` (private; vzkaz přes nativní `prompt()`), u čekající vlastní žádosti „žádost čeká“ + `Zrušit žádost`.
5. **Archivované skupiny**, které smím číst – „jen ke čtení“.
- „+ Založit skupinu“ jen při `canCreateGroup` (Správa souboru, případně člen dle nastavení souboru) → admin `/app/manage/groups/new`, jinak `/app/groups/new`.
- Výsledek akcí přes `ActionFeedback` (error/success hlášky).

### 7.3 Prostor skupiny (`GroupSpaceComponent`)
- Skupina dle slug, jen při `canReadGroupContent`; jinak „Skupina nebyla nalezena nebo do ní nemáte přístup.“
- Záložky (`groupTabs`): `chat` (je-li zapnut), `board` (je-li zapnuta), `events` (zapnutý modul Akce), `members` vždy, `manage` jen pro `canManageGroupMembership || canEditGroupCommunication`.
- Výchozí (`defaultGroupTab`): má-li chat i nástěnku → `defaultTab ?? 'board'`; jinak ta jediná; jinak `members`. Neplatný `?tab=` → výchozí.
- Badge na záložkách: `chat` (skrytý, pokud je chat právě otevřen) a `board` – ze stejného zdroje jako menu.
- Nečlen: štítek „Otevřená skupina – jen čtení“. Člen: výběr **úrovně upozornění** (🔔 select, viz kap. 9).
- **Členové** (`GroupMembersComponent`): dlaždice aktivních členů (avatar, přezdívka, funkce, štítek hlavní správce/spolusprávce; řazení role → přezdívka cs). Zvlášť „Technická správa bez přístupu k obsahu: …“ (správci, kteří nejsou členy). Běžný člen může **navrhnout** nového člena (select všech aktivních nečlenů). „Opustit skupinu“ s potvrzením → redirect na rozcestník.
- **Akce** (`GroupEventsComponent`): akce, které skupina pořádá (`organizerGroupIds`) nebo pro ni jsou (`targetGroupIds`), filtr `canSeeEvent`; nadcházející/proběhlé podle `endsAt`; lze odpovídat na účast (detail v 04).

### 7.4 Správa skupiny (`GroupAdminPanelComponent`)
Sdílí ji záložka `manage` i Správa → Skupiny. Neukazuje obsah (chat, příspěvky).
- **Nastavení** (draft přes `linkedSignal`, uložení jedním `updateGroup`):
  - metadata (název, slug `[a-z0-9-]+` unikátní, popis, ikona, viditelnost s nápovědou) – hlavní správce / Správa souboru;
  - komunikace (chat, nástěnka, výchozí záložka jen když obojí, historie chatu) – i spolusprávce.
  - Audit `group-updated` se seznamem změněných polí.
- **Hlavní správce**: zobrazení (štítky „nečlen – jen technická správa“, „přechodně“); „Skupina nemá hlavního správce“ jako chyba. **Předat hlavní správu** (select aktivních neexterních; nečlen jen technická správa) s potvrzením.
- **Členové**: role Člen/Spolusprávce (jen hlavní správce/Správa souboru), **Odebrat** (správce; ne sebe; hlavního správce jen ten, kdo smí určovat správce). Důvod přes `prompt()` → jen v historii jako interní poznámka.
- **Přidat nebo pozvat** (správci): „Pozvat“ (čeká na pozvaného) / „Přidat hned“ (zakázáno pro sebe). Upozornění, že zásah Správy souboru do nespravované skupiny bude v historii zvýrazněn.
- **Čekající žádosti a pozvánky**: Schválit/Zamítnout (`awaiting-manager`), Zrušit pozvánku (`awaiting-member`), štítky „žádost o vstup / pozval/a X / návrh od X“, vzkaz.
- **Historie skupiny**: audit záznamy s `groupIds` obsahující skupinu, nejnovější první, mimořádné zásahy zvýrazněny, interní poznámky.
- **Archivovat** (s potvrzením) / v archivovaném stavu jen banner + „Obnovit skupinu“ (historie i ostatní sekce se v archivu nezobrazují).

### 7.5 Toky členství (`MembershipService`)
Všechny metody vrací `defer`-Observable; chyby `AccessDeniedError` / `RuleViolationError`. Každý krok audituje.

```
Žádost (private):   requestToJoin ─► awaiting-manager ─approve─► accepted (+členství, member-joined)
                                                     └reject──► rejected
                                                     └cancel──► cancelled (autor nebo správce)
Pozvánka správce:   invite(manages) ─► awaiting-member ─acceptInvitation─► accepted (+členství)
                                                       └declineInvitation─► declined
                                                       └cancel───────────► cancelled
Návrh člena:        invite(!manages) ─► awaiting-manager ─approve─► awaiting-member (invitation-created) ─► …
Open skupina:       joinOpenGroup ─► členství (member-joined)
Přímé přidání:      addMember (správce) ─► členství (member-added, extraordinary pro Správu souboru mimo své skupiny)
Odchod:             leaveGroup / removeMember(self) ─► member-left
Odebrání:           removeMember (správce, note) ─► member-removed
```
Pravidla:
- Max. jedna nevyřízená žádost/pozvánka na (skupina, osoba) (`assertNoPending`). Při vstupu se všechny nevyřízené pro tuto dvojici uzavřou jako `accepted`.
- Nelze pozvat/přidat neaktivního ani stávajícího člena. Sám sebe nikdo nepřidá přímo (ani Správa souboru) – jen žádostí; výjimka: správce skupiny.
- Žádné změny v archivované skupině (`activeGroup`) – kromě `removeMember`/`leaveGroup`/`reject`/`cancel`/`declineInvitation`, které archivaci **nekontrolují** (UI je ale v archivu nenabízí).
- Odchod/odebrání: blokuje `groupLeaveProblem` (poslední hlavní správce nemůže odejít ani být odebrán). Spolusprávci zaniká pověření (`mandate-revoked`) – „nemůže moderovat obsah, který nečte“.
- Spolusprávce neodebírá hlavního správce.
- **Role** `setGroupRole(groupId, memberId, 'owner'|'deputy'|null)`: jen hlavní správce/Správa souboru. Spolusprávce musí být člen. Předání `owner`: dosavadní hlavní správci → spolusprávci (jen pokud jsou členy a jejich pověření nebylo `temporary`). Odebrání posledního ownera blokuje `mandateRevocationProblem`.
- **Založení skupiny** `createGroup`: zakladatel-člen se stane členem i hlavním správcem; Správa souboru může určit ownera, jinak je ownerem sama s `temporary: true` (bez členství, bez obsahu).
- **Archivace / obnova**: hlavní správce nebo Správa souboru (idempotentní).
- **Smazání** `deleteGroup`: jen Správa souboru a jen archivovaná skupina → smaže příspěvky, komentáře, chat, žádosti, členství, pověření skupiny; akce, docházka a krojová evidence zůstávají. Audit `group-deleted`.
- Systémové události v chatu vznikají z auditu automaticky (kap. 6.2).

## 8. Nepřečtené a badge

Jediný zdroj: `NavigationService.groupBadgeParts` → `{board, chat}` per moje nearchivovaná skupina; používá ho menu (položka skupiny), spodní lišta, rozcestník i záložky prostoru.

- **board** (`BoardsService.getBoardBadges` → `getBoardBadgeCount`, přepočet periodicky `BADGE_REFRESH_MS`):
  - nepřečtené nearchivované příspěvky (nejsem v `readers`), bez cizích skrytých,
  - \+ neviděné zmínky v komentářích k příspěvkům nástěnky (i archivovaným).
  - Nové komentáře se do badge **nepočítají** (jen štítek v seznamu a v chatu).
- **chat** (`unreadChatCount`): cizí nesmazané zprávy po `lastReadAt`, jen viditelné dle historie chatu. **Ztlumený/vypnutý** chat (`muted`/`off`) → 0.
- Komentářová aktivita v chatu se nezapočítává podruhé (je v nástěnce).
- **Skupiny (hub)** = součet všech skupin + čekající žádosti (`awaiting-manager` ve skupinách, které spravuji, a `awaiting-member` pro mě).
- Stavové zdroje: `post.readers`, `post.lastVisitedAt`, `comment.seenByMemberIds`, `chat-read` – vše uloženo v datech (u příspěvků/komentářů přímo v entitě → sdílené pro všechny uživatele demo prohlížeče).

## 9. Upozornění (`core/notifications`)

- **Úroveň per skupina** (`GroupNotifyMode`, default `all`), volba v hlavičce prostoru skupiny:

| Režim | Popisek | Zmínka | Nový příspěvek | Zpráva chatu / komentář | Chat v badge |
|---|---|---|---|---|---|
| `all` | Vše | ano | ano | ano | ano |
| `mentions` | Jen důležité (zmínky a oznámení) | ano | ano | ne | ano |
| `muted` | Jen když mě někdo zmíní | ano | ne | ne | **ne** |
| `off` | Vypnuto | ne | ne | ne | **ne** |

- `shouldNotify`: nikdy vlastní aktivita; nikdy bez práva číst (v okamžiku zpracování); archivovaná skupina neupozorňuje.
- **`ActivityNotifierService`** (spouští `MainLayoutComponent` po přihlášení): sleduje chat (signal effect), příspěvky (poll 5 s, jen `isPostInChat`) a komentáře (stream). První dávka jen „naučí“ známá ID (`primed`) → upozorňuje se jen na aktivitu vzniklou **za běhu** aplikace. Text bez obsahu zprávy: „X: zpráva ve skupině Y“, „Nový příspěvek ve skupině Y: titulek“, „X komentoval/a příspěvek T“.
- **Zmínky v komentářích** hlásí zvlášť `MainLayoutComponent.watchForNewMentions` („Nová zmínka – X vás zmínil(a) v komentáři“); notifier je proto u komentářů vynechává. Tato cesta **nerespektuje** režim skupiny ani archivaci.
- Doručení: `NotificationService.notify` → Web Notifications API přes service worker registraci (PWA), jinak `new Notification`; bez povolení nic. Žádný push ze serveru (cíl dle docs/08: push/WebSocket – neimplementováno).

## 10. Hledání (`features/search`)

- `/app/search`: text (min. 2 znaky, bez diakritiky/velikosti), filtr skupiny (všechny čitelné, vč. archivovaných), období od–do (porovnání `YYYY-MM-DD`). Výsledky sestupně podle času, štítek typu, snippet ~120 znaků kolem shody.
- `searchContent` prohledává jen čitelné:
  - **příspěvky** (title + body) skupin s `canReadGroupContent`; skryté jen autor/moderátor; archivované **ano**;
  - **komentáře** těchto příspěvků (plain text) → odkaz s `#comment-ID`;
  - **chat** – nesmazané, viditelné dle historie chatu → odkaz na `?tab=chat` (bez skoku na zprávu);
  - **akce** (je-li modul) dle `canSeeEvent`; title/description/location; filtr skupiny přes target/organizer.
- Vše počítáno v prohlížeči nad celými datovými sadami (computed signal).

## 11. `TargetingEditorComponent` (`shared/targeting`)

- Checkboxy všech skupin (`GroupsService.getGroups`), „Nic nevybráno = viditelné pro všechny“, `selectedGroupIds` in/out. Cílení na jednotlivce záměrně ne.
- **Aktuálně není nikde použit** (ani v příspěvcích, ani v akcích) – mrtvý kód s testy. Příspěvky cílí výhradně tím, na jaké nástěnce (skupině) visí.

## 12. Testy (Karma + Jasmine)

Pokryto (počet `it`): `posts.service` 18, `post-detail` 17, `membership.service` 15, `mentions` 14, `chat-timeline` 10, `comments.service` 9, `groups.service` 9, `posts.component` 8, `boards.service` 7, `chat-history` 6, `chat.service` 5, `search.utils` 5, `group-notifications` 5, `post-form` 5, `board.guard` 3, `board-posts` 3, `notification.service` 3, dále `group-tabs`, `group-events`, `mention-input`, `rich-text`, `targeting-editor`, `demo-content` (konzistence mock dat: autoři jsou členy skupin, nikdo nezmiňuje sám sebe) po 2.

Klíčové scénáře: tok žádost/návrh/pozvánka, poslední správce, deputy jen člen, archiv jen ke čtení, mazání skupiny čistí obsah; moderace vs. autorství; read/visit/seen; sync komentářů přes `storage` event; seskupení komentářů, skryté období chatu, nepřečtené; viditelnost ve vyhledávání; úrovně upozornění.

Nepokryto: `GroupChatComponent` (scroll, „Nové“, odpověď z karty), `GroupAdminPanelComponent`, `BoardsComponent`, `GroupSpaceComponent`, `GroupMembersComponent`, `SearchComponent`, `ActivityNotifierService`, `NavigationService` badge složení skupin (částečně v navigation spec), `MainLayout` mention notifikace (jen základ).

## Pozorování a technický dluh

**Chyby / nekonzistence**
- `PostsService.updatePost` **neukládá `mentionedMemberIds`** (formulář je posílá, service je zahodí) → zmínky přidané při úpravě se neuloží; odebrané zůstanou.
- Zmínky **v příspěvku** nemají „seen“ stav ani badge – upozorní jen notifier při vzniku příspěvku (a jen pokud je aplikace právě spuštěná). Zmínky v komentářích a chatu fungují jinak → tři různé modely zmínek.
- Surové tokeny `@[member:ID]` / `#[event:ID]` se zobrazí uživateli: perex v seznamu nástěnky (`{{ post.body }}`), náhled příspěvkové karty v chatu (`preview(post.body)` bez `plainText`), hledání v příspěvcích (match i snippet nad raw `body` → hledání jména zmíněného člena v příspěvku nenajde nic).
- Inline „Odpovědět“ v chatu nepředává `[events]` → `#` odkazy na akce tam nefungují.
- Ztlumení chatu (`muted`) vynuluje celý chat badge **včetně zpráv se zmínkou** – mention v chatu pak nemá žádný trvalý indikátor (jen jednorázová notifikace).
- Notifikace zmínek v komentářích (`MainLayout`) ignorují režim `off` i archivaci skupiny – rozpor s popiskem „Vypnuto“.
- `ActivityNotifierService.stop()` nezastaví `effect` chatu a nenastaví `started=false`; `known/primed` se neresetují při odhlášení/přepnutí uživatele ve stejném běhu.
- Komentovat lze **archivovaný příspěvek**; autor může smazat chatovou zprávu a archivovat/obnovit vlastní příspěvek i v **archivované skupině** (service tyto případy nekontroluje).
- `removeMember`/`leaveGroup` nekontrolují archivaci skupiny (tvrzení „členství se v archivu nemění“ platí jen díky UI).
- Statistika čtenosti v detailu počítá i neaktivní členy, v seznamu jen aktivní → „Přečteno X z Y“ se může lišit.
- `markAsRead` zapisuje i nečleny otevřené skupiny do `readers` (neškodné pro statistiku, ale data rostou).
- Audit akce `post-published` je definovaná, ale nikdy se nezapisuje.
- `restorePost` nevrací připnutí (archivace odepíná) – možná záměr, ale nedokumentováno v UI.

**Architektura / backend-readiness**
- Čtecí API (`getPosts`, `getComments`, `getAllComments`, `chat.messages`) vrací vše bez kontroly přístupu; filtrování je v komponentách/utils. Pro HTTP backend nutno přesunout na server (jinak únik dat).
- Stav čtení (`readers`, `lastVisitedAt`, `seenByMemberIds`) je uložen v entitě příspěvku/komentáře → na backendu lépe samostatná tabulka per (member, item); `lastVisitedAt` jako mapa v JSON neškáluje.
- Tři různé reaktivní modely (Observable+delay bez streamu u příspěvků, BehaviorSubject u komentářů, signal u chatu/skupin) + různé polly (chat 2 s, notifier 5 s, badge interval). Příspěvky nemají `storage` sync → změny z jiné záložky se projeví až pollem/reloadem.
- `ensembleId: 1` natvrdo (post-form, createGroup, createPerson).
- `prompt()` pro vzkaz k žádosti a důvod odebrání – nekonzistentní s `ConfirmService` dialogy, špatně na mobilu/PWA.
- `TargetingEditorComponent` je nepoužitý.
- `Post.requiresAction` existuje v modelu (a CSS třídě), ale formulář ho nenastavuje a nikde se nevyhodnocuje.
- Chybí UI pro úpravu chatové zprávy (service umí), úpravu/mazání komentářů, přílohy, reakce, vlákna.
- Hledání v chatu nevede přímo na zprávu (jen na záložku chat); výsledky bez stránkování, nad celými daty.
- `visibility.utils` (`getBoardBadgeCount`, `getNewCommentsCount`) pracuje s `any` – slabá typová kontrola.
- Komponenty prostoru skupiny, chatu a správy skupiny nemají testy, přestože obsahují netriviální logiku (scroll/markRead, sestavení patchů nastavení, oprávnění tlačítek).
