# 03 – Model oprávnění (skutečný stav implementace)

Popis toho, jak aplikace SPLK skutečně vyhodnocuje přístup: pověření, rozsahy, role ve skupinách, viditelnost, místa vynucení a ochranná pravidla.
Cesty relativní k `frontend/src/app`. Odkazy na `docs/08` jen u odchylek.

## 1. Principy

- **Žádné systémové role.** Oprávnění = **pověření** (`Mandate`) přidělené osobě v rozsahu soubor / skupina / akce. Souborová funkce (`Member.functionTitle`) ani název skupiny nic neopravňují.
- **Členství ve skupině ≠ správa skupiny.** Číst obsah skupiny opravňuje členství (u otevřené skupiny i členství v souboru). Správa souboru ani technická správa skupiny obsah **neodemyká**.
- **Pravidla jsou čisté funkce** v `core/access/access.utils.ts` nad `AccessSubject`; komponenty, guardy i mock služby volají stejné funkce. Při pochybnosti se nepovolí (`null` subject → `false`).
- **Živé vyhodnocení**: `User` v přihlášení nese jen identitu; členství a pověření se čtou živě ze signálů (`MembersService`, `MandatesService`) → změna ve Správě platí okamžitě.
- Mock služby mají **simulovat backend**: většina zápisových operací znovu ověřuje oprávnění a hází `AccessDeniedError` / `RuleViolationError` (`core/access/mandate-rules.ts`). Výjimky viz kap. 7.

## 2. Pověření (`core/models/mandate.model.ts`)

| `MandateKind` | Label v UI | Rozsah | Kdo přiděluje | Co dává |
|---|---|---|---|---|
| `ensemble-admin` | Správa souboru | soubor (bez groupId/eventId) | Správa souboru | osoby, skupiny (metadata, archivace, mazání), pověření, konfigurace, historie; **ne** čtení obsahu skupin, akce, docházku, kroje |
| `group-owner` | Hlavní správce skupiny | `groupId` (povinně) | Správa souboru, hlavní správce | vše co spolusprávce + metadata, viditelnost, archivace skupiny, jmenování správců |
| `group-deputy` | Spolusprávce skupiny | `groupId` (povinně), musí být členem | Správa souboru, hlavní správce | členství (žádosti, pozvánky, přidání, odebrání), komunikační volby, moderace (pokud čte obsah), statistiky čtenosti, historie skupiny |
| `events` | Organizace akcí | soubor / skupina (`groupId`) / akce (`eventId`) | Správa souboru | zakládání (soubor nebo skupina), úprava a mazání akcí v rozsahu; u rozsahu akce i zápis docházky |
| `attendance` | Evidence docházky | soubor / skupina / akce | Správa souboru | zápis skutečné docházky v rozsahu, přehled docházky |
| `costumes` | Správa krojů | soubor | Správa souboru | zápis do krojového fondu (krojařka) |
| `costumes-view` | Náhled do správy krojů | soubor | Správa souboru | prohlížení Správy krojů bez zápisu |

- `SCOPED_MANDATE_KINDS = ['events','attendance']` – UI Správy (detail osoby) nabízí rozsah „celý soubor / skupina / akce“ jen pro tyto dva druhy.
- `GROUP_MANDATE_KINDS` se nepřidělují přes `grantMandate()` (→ `RuleViolationError`), ale přes `setGroupRole()` v panelu správy skupiny.
- `temporary` – přechodné pověření (Správa souboru, která zakládá skupinu bez určeného správce, se stane jejím dočasným hlavním správcem bez členství). V UI štítek „přechodně“. Při předání hlavní správy se dočasný vlastník **nestává** spolusprávcem.
- **Neaktivní osoba** nemá žádná platná pověření ani členství: `toAccessSubject()` vrací `mandates: []`, `groupIds: []` (data zůstávají uložená až do `setPersonActive(false)`, které pověření fyzicky odebere).

### 2.1 Vyhodnocení rozsahu (`inEventScope`)

Pověření `events`/`attendance` platí pro akci, pokud:
- nemá `groupId` ani `eventId` (celý soubor), nebo
- `eventId === event.id`, nebo
- `groupId` je v relevantních skupinách akce:
  - `events` → jen `organizerGroupIds` (cílení na skupinu nestačí),
  - `attendance` → `organizerGroupIds` ∪ `targetGroupIds`.

Speciality:
- `canCreateEvents` = existuje pověření `events` **bez** `eventId` (rozsah akce zakládat nedovolí).
- `eventOrganizerScope` → `{ ensembleWide, groupIds }`; se skupinovým rozsahem musí nová akce mít v `organizerGroupIds` aspoň jednu skupinu z rozsahu (kontrola ve službě i nabídka ve formuláři).
- Pověření `events` s `eventId` dává i zápis skutečné docházky té akce.

## 3. Subjekt a vrstvy (`core/access`)

```ts
interface AccessSubject { memberId: number; groupIds: number[]; isExternal: boolean; mandates: Mandate[] }
interface EventScope   { id; targetGroupIds; guestMemberIds?; organizerGroupIds? }
type GroupRole = 'owner' | 'deputy';  // odvozené z pověření pro danou skupinu
```

- `access.utils.ts` – čisté predikáty (kap. 4) + `accessOverview()` (souhrn pro Správu → detail osoby: čitelné skupiny, „spravuje bez přístupu k obsahu“, rozsah akcí/docházky `none|ensemble|scoped`, kroje `none|view|manage`).
- `access.service.ts` (`AccessService`, root) – signály `currentMember` (podle `userId` přihlášeného), `subject`, `memberId`, `isEnsembleAdmin`, `canManageCostumes`, `canViewCostumeStock`, `canViewAttendanceReport`, `canCreateEvents`, `canCreateGroup`, `modules`, `myGroups` (kde je členem), `managedGroups` (kde má owner/deputy); obecné `can(check, ...args)`.
- `access.guards.ts` – `ensembleAdminGuard`, `attendanceGuard` (modul akcí + jakékoli `attendance`), `eventCreateGuard` (modul akcí + `canCreateEvents`), `moduleGuard(module)`, `groupCreateGuard`. Při zamítnutí redirect na `/app/dashboard`. Dále `features/boards/board.guard.ts` (nový příspěvek jen člen nearchivované skupiny) a `features/costumes/costumes.guard.ts` (`costumeStockGuard` → jinak `/app/costumes`, `costumeManagerGuard` → jinak `/app/wardrobe`). `authGuard` jen kontroluje přihlášení.
- `mandate-rules.ts` – chybové třídy a ochranná pravidla (kap. 6).
- `features/mandates/mandates.service.ts` – jen úložiště (`add/remove/update`, signál `mandates`), **bez kontrol**; veškeré přidělování/odebírání jde přes `MembershipService`.
- `features/groups/membership.service.ts` – jediné místo pro změny skupin, členství, žádostí, správců, pověření a osob; každá operace: `actor()` → `require(predikát)` → pravidla → zápis → audit.

## 4. Predikáty (`access.utils.ts`)

Skupiny:
- `isGroupMember(s, g)` = `g ∈ s.groupIds`
- `groupRole(s, g)` = `'owner' | 'deputy' | null` podle pověření; `isGroupManager` = role ≠ null
- `canSeeGroup(s, group)` = člen ∨ správce ∨ Správa souboru ∨ (viditelnost ≠ `hidden` ∧ ¬externista)
- `canReadGroupContent(s, group)` = člen ∨ (visibility = `open` ∧ ¬externista)
- `canPostInGroup` = člen ∧ ¬archivovaná
- `canModerateGroup` = správce skupiny ∧ `canReadGroupContent` ∧ ¬archivovaná; `canSeeReadStats` = totéž
- `canManageGroupMembership`, `canEditGroupCommunication` = Správa souboru ∨ správce skupiny
- `canEditGroupMetadata`, `canAssignGroupManagers`, `canArchiveGroup` = Správa souboru ∨ hlavní správce
- `canDeleteGroup` = Správa souboru ∧ skupina archivovaná
- `canJoinDirectly` = ¬externista ∧ `open` ∧ ¬člen ∧ ¬archivovaná
- `canRequestToJoin` = ¬externista ∧ `private` (default) ∧ ¬člen ∧ ¬archivovaná
- `canProposeMember` = člen ∧ ¬archivovaná
- `canCreateGroup(s, settings)` = Správa souboru ∨ (`groupCreation = 'members'` ∧ ¬externista)

Akce:
- `isEventAudience(member, event)` = aktivní ∧ (host ∨ (bez cílení ∧ ¬externista) ∨ člen cílové skupiny)
- `canSeeEvent` = host ∨ `canEditEvent` ∨ `canRecordAttendance` ∨ (bez cílení ∧ ¬externista) ∨ člen cílové skupiny
- `canCreateEvents`, `eventOrganizerScope`, `canEditEvent` (pověření `events` v rozsahu pořadatele)
- `canRecordAttendance` = `attendance` v rozsahu (pořadatel ∪ cíl) ∨ `events` s `eventId` této akce
- `canSeeEventResponses` = `canEditEvent` ∨ `canRecordAttendance`
- `canViewAttendanceReport` = jakékoli pověření `attendance`

Kroje: `canManageCostumes` = `costumes`; `canViewCostumeStock` = `costumes` ∨ `costumes-view`.

## 5. Viditelnost obsahu

### 5.1 Skupiny (`GroupVisibility`)

| | existence (seznam „Ostatní skupiny“) | čtení chatu/nástěnky | vstup |
|---|---|---|---|
| `open` | všichni neexterní | všichni neexterní přihlášení | rovnou (`joinOpenGroup`) |
| `private` (default) | všichni neexterní | jen členové | žádost → správce |
| `hidden` | jen členové, správci, Správa souboru | jen členové | jen pozvánka |

- Externista vidí jen skupiny, kde je členem.
- Archivovaná skupina: čtou ji ti, kdo smějí číst obsah (sekce „Archivované“), nikdo nepíše ani nemoderuje; členství, nastavení i správci se nemění (`activeGroup()` → `RuleViolationError`); archivace/obnova/smazání ano.
- Menu „Moje skupiny“ = jen skupiny s členstvím (`myGroups`), otevřenou skupinu lze číst přes seznam skupin.

### 5.2 Historie chatu (`features/chat/utils/chat-history.ts`)

`chatVisibility(group, viewer)(at)` = režim platný v čase `at` (z `chatHistoryLog`) je `open` ∨ viewer byl v čase `at` členem (`groupIntervals`; bez intervalů = člen od počátku). Aplikováno v komponentě chatu (zprávy, karty komentářů, systémové události) a ve vyhledávání. `ChatService.messagesFor()` filtruje jen `canReadGroupContent`, ne historii.

### 5.3 Příspěvky

- Skrytý příspěvek (`hiddenAt`) vidí jen autor a moderátoři skupiny (nástěnka, detail, hledání, badge); v chatu se nezobrazuje nikomu.
- Archivované příspěvky v samostatném seznamu; v chatu se nezobrazují.
- Statistiky čtenosti (`readers`) – jen `canSeeReadStats` (moderátor, který obsah čte).

### 5.4 Ostatní

- Akce: seznam, kalendář, skupinová záložka Akce, odkazy `#akce`, hledání a ICS export filtrují `canSeeEvent` / `isEventAudience`. Počty odpovědí a „kdo viděl“ jen `canSeeEventResponses`.
- Plné jméno osoby (`firstName lastName`) zobrazuje jen Správa (seznam osob, detail osoby, v panelu skupiny jen pro Správu souboru) a krojová evidence (jméno držitele). Ostatní vidí přezdívku.
- Nedostupnost člena: vlastní vidí člen; u akce jen `canEditEvent ∨ canRecordAttendance`; při plánování jen `canCreateEvents`.
- Notifikace (`shouldNotify`): nikdy bez práva číst obsah v okamžiku odeslání, nikdy pro archivovanou skupinu, nikdy vlastní aktivita.
- Navigace: „Správa“ jen Správa souboru; „Docházka“ jen s `attendance` a modulem akcí; „Správa krojů“ jen `canViewCostumeStock`; vypnutý modul skryt i v menu i guardem.

## 6. Ochranná pravidla (`mandate-rules.ts`, `MembershipService`)

- **Poslední aktivní Správa souboru**: nelze odebrat pověření (`mandateRevocationProblem`), deaktivovat (`deactivationProblem`) ani trvale smazat osobu.
- **Jediný hlavní správce skupiny**: nelze odebrat roli (`setGroupRole(null)` / `revokeMandate`), nelze odejít ani být odebrán ze skupiny (`groupLeaveProblem`), nelze deaktivovat ani smazat osobu (vypíše skupiny, které je nutné předat).
- **Předání hlavní správy** (`setGroupRole(..., 'owner')`): všechna dosavadní `group-owner` pověření skupiny se odeberou; dosavadní vlastník se stane spolusprávcem, pokud je členem a nebyl `temporary`. Skupina má tak vždy max. jednoho hlavního správce.
- **Spolusprávce musí být členem** skupiny; při odchodu/odebrání ze skupiny pověření `group-deputy` automaticky zaniká (audit `mandate-revoked`).
- **Hlavního správce** může odebrat ze skupiny jen Správa souboru nebo hlavní správce (spolusprávce ne).
- **Sám sebe do skupiny nepřidá** nikdo, kdo není jejím správcem (ani Správa souboru) – jen žádostí.
- **Neaktivní osoba**: nelze přidat do skupiny, pozvat, jmenovat správcem ani přidělit pověření.
- **Jedna nevyřízená žádost/pozvánka** na dvojici osoba × skupina; slug skupiny unikátní; přezdívka unikátní (`NicknameTakenError`).
- **Deaktivace osoby** odebere všechna její pověření a členství (s auditem `member-removed`).
- **Smazání skupiny** jen archivované; odebere i pověření vázaná na skupinu.
- **Trvalé smazání osoby** jen bez stop v evidenci a ne sebe sama (`PersonFootprint`, viz `02`).
- **Mimořádný zásah**: přidání člena, schválení žádosti a přímá pozvánka provedené Správou souboru ve skupině, kterou sama nespravuje → `AuditEntry.extraordinary = true`, zvýrazněno v historii Správy i skupiny a předem upozorněno v panelu.
- **Auditováno** v `MembershipService`: všechny změny členství, žádostí, pověření, skupin a osob; v `PostsService` moderace a archivace; v `EventsService` založení, série, podstatné změny akce; konfigurace souboru (z komponenty).

## 7. Kde se kontroly vynucují

Legenda: **G** route guard, **C** komponenta (skrytí/disable/redirect), **S** mock služba (výjimka), **–** nevynuceno.

| Oblast / operace | G | C | S | Pozn. |
|---|---|---|---|---|
| Správa (osoby, skupiny, konfigurace, historie) | ✔ | ✔ | částečně | osoby, pověření, skupiny: S ✔; uložení konfigurace souboru: S **–** (`EnsembleSettingsService.save` bez kontroly) |
| Čtení obsahu skupiny | – | ✔ | ✔ | `BoardsService.getBoardBySlug/ById`, `ChatService.messagesFor`; `PostsService.getPosts()` a `CommentsService` vrací vše (filtruje komponenta/BoardsService) |
| Psaní příspěvku / chatu / komentáře | ✔ (nový příspěvek) | ✔ | ✔ | autor musí být přihlášený |
| Úprava příspěvku | – | ✔ | ✔ autor | bez kontroly členství a archivace |
| Úprava / smazání chatu | – | ✔ | ✔ | úprava jen autor (bez kontroly archivace), smazání autor ∨ moderátor |
| Moderace (pin, hide, archive) | – | ✔ | ✔ | archivace/obnova i autor |
| `markAsRead` / `markVisited` / `markSeen` | – | ✔ | – | libovolné `memberId` |
| Členství, žádosti, správci, pověření, osoby | – | ✔ | ✔ | `MembershipService`, `PersonDeletionService` |
| Vlastní profil (přezdívka, kontakt, avatar) | – | ✔ | – | `MembersService.updateMember` bez kontroly |
| Zobrazení akce | – | ✔ | částečně | `EventsService.getEvents()` vrací vše; S jen u chatu akce a `linkableEvents` |
| Založení / úprava / smazání akce | ✔ (založení) | ✔ | ✔ | |
| Vlastní odpověď na akci | – | ✔ | částečně | S hlídá jen „akce skončila“ pro vlastní záznam; nekontroluje, že jde o publikum ani o vlastní `memberId` |
| Zápis odpovědi za jiné (formulář akce) | – | ✔ | – | |
| Skutečná docházka | – | ✔ | – | `ActualAttendanceService` bez kontroly; C: `canRecordAttendance` ∧ akce začala |
| Přehled docházky | ✔ | ✔ | – | report filtruje akce `canRecordAttendance` |
| Chat akce | – | ✔ | ✔ | |
| Nedostupnost | – | ✔ | ✔ | |
| Krojový fond – zápis | ✔ | ✔ | ✔ | `CostumeStoreService.mutate` (výjimky `self`, `profile`) |
| Krojový fond – čtení | ✔ | ✔ | – | `getState()` vrací celý fond každému |
| Moduly (akce, kroje) | ✔ | ✔ | – | služby modul nekontrolují |

## 8. Matice oprávnění (akce × pověření/role)

Sloupce: **Č** = aktivní člen souboru (bez pověření), **ČS** = člen dané skupiny, **Ext** = externista, **SpS** = spolusprávce skupiny, **HS** = hlavní správce skupiny, **SS** = Správa souboru (bez dalších pověření), **OA** = Organizace akcí (v rozsahu), **ED** = Evidence docházky (v rozsahu), **SK** = Správa krojů, **NK** = Náhled krojů.
✔ ano · ✘ ne · ◐ podmíněně (viz pozn.). Pověření se sčítají; sloupec ukazuje, co dává samo o sobě (+ ČS u správců, kde to pravidlo vyžaduje).

### 8.1 Skupiny

| Akce | Č | ČS | Ext | SpS | HS | SS | Pozn. |
|---|---|---|---|---|---|---|---|
| Vidět existenci skupiny | ◐ | ✔ | ◐ | ✔ | ✔ | ✔ | Č: ne `hidden`; Ext: jen kde je členem |
| Číst chat / nástěnku | ◐ | ✔ | ◐ | ◐ | ◐ | ◐ | jen `open` (Č, SS), jinak jen ČS; Ext jen jako ČS; správa obsah neodemyká |
| Psát příspěvek, chat, komentář | ✘ | ✔ | ◐ | ◐ | ◐ | ✘ | jen člen, ne archivovaná |
| Upravit vlastní příspěvek / zprávu | – | ✔ | ◐ | ✔ | ✔ | – | jen autor |
| Archivovat / obnovit vlastní příspěvek | – | ✔ | ◐ | ✔ | ✔ | – | autor |
| Připnout, skrýt, archivovat cizí, smazat cizí zprávu | ✘ | ✘ | ✘ | ◐ | ◐ | ✘ | správce, který obsah čte; ne archivovaná |
| Statistiky čtenosti | ✘ | ✘ | ✘ | ◐ | ◐ | ✘ | jako moderace |
| Vstoupit do otevřené skupiny | ✔ | – | ✘ | – | – | ✔ | |
| Požádat o vstup (soukromá) | ✔ | – | ✘ | – | – | ✔ | |
| Navrhnout nového člena | ✘ | ✔ | ◐ | ✔ | ✔ | ✘ | Ext jen jako ČS; návrh čeká na správce |
| Pozvat přímo, přidat člena | ✘ | ✘ | ✘ | ✔ | ✔ | ✔ | SS mimo své skupiny = mimořádný zásah; sám sebe jen správce |
| Schválit / zamítnout žádost či návrh | ✘ | ✘ | ✘ | ✔ | ✔ | ✔ | |
| Zrušit žádost/pozvánku | ◐ | ◐ | ◐ | ✔ | ✔ | ✔ | tvůrce může vždy |
| Přijmout / odmítnout pozvánku | ◐ | – | ◐ | – | – | ◐ | jen pozvaný |
| Odebrat člena | ✘ | ✘ | ✘ | ◐ | ✔ | ✔ | SpS ne hlavního správce; jediný HS nejde odebrat |
| Odejít ze skupiny | – | ✔ | ✔ | ✔ | ◐ | – | jediný HS ne |
| Chat/nástěnka/výchozí záložka/historie chatu | ✘ | ✘ | ✘ | ✔ | ✔ | ✔ | |
| Název, slug, ikona, popis, viditelnost | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ | |
| Jmenovat spolusprávce, předat hlavní správu | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ | spolusprávce musí být členem |
| Archivovat / obnovit skupinu | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ | |
| Smazat skupinu | ✘ | ✘ | ✘ | ✘ | ✘ | ◐ | jen archivovanou |
| Založit skupinu | ◐ | ◐ | ✘ | ◐ | ◐ | ✔ | Č: jen při `groupCreation='members'` → stane se členem a HS |
| Historie skupiny (panel) | ✘ | ✘ | ✘ | ✔ | ✔ | ✔ | vč. interních poznámek |

### 8.2 Osoby, pověření, konfigurace

| Akce | Č | SS | Pozn. |
|---|---|---|---|
| Upravit vlastní přezdívku, e-mail, telefon, ikonku | ✔ | ✔ | jméno a příjmení jen SS |
| Založit / upravit osobu (vč. externisty) | ✘ | ✔ | |
| Ukončit / obnovit aktivní členství | ✘ | ✔ | ochrana posledního SS a jediných HS |
| Trvale smazat osobu | ✘ | ◐ | jen bez stop v evidenci, ne sebe |
| Přidělit / odebrat pověření (ne skupinová) | ✘ | ✔ | ochrana posledního SS |
| Konfigurace souboru (moduly, zakládání skupin, výchozí hodnoty, seskupování chatu) | ✘ | ✔ | |
| Celková historie (audit) | ✘ | ✔ | filtr „Mimořádné zásahy“ |
| Náhled skutečných přístupů osoby | ✘ | ✔ | `accessOverview` |
| Nastavit výchozí kroj osoby | ✘ | ✔ | i SK |

### 8.3 Akce a docházka

| Akce | Č (publikum) | Ext | OA | ED | SS | Pozn. |
|---|---|---|---|---|---|---|
| Vidět akci | ◐ | ◐ | ✔ | ✔ | ◐ | publikum = celý soubor / cílové skupiny / hosté; SS nemá výjimku |
| Odpovědět (Přijdu / Možná / Nepřijdu) | ✔ | ◐ | ◐ | ◐ | ◐ | jen publikum; po skončení akce ne |
| Založit akci | ✘ | ✘ | ◐ | ✘ | ✘ | rozsah soubor, nebo pořadatel ve skupině z rozsahu; ne rozsah akce |
| Upravit / smazat akci, zapsat odpovědi za ostatní | ✘ | ✘ | ✔ | ✘ | ✘ | rozsah = pořádající skupina / akce / soubor |
| Vidět počty odpovědí, kdo viděl, potvrzení | ✘ | ✘ | ✔ | ✔ | ✘ | |
| Zapsat skutečnou docházku | ✘ | ✘ | ◐ | ✔ | ✘ | OA jen s rozsahem této akce; ED i pro cílové skupiny; až od začátku akce |
| Přehled docházky | ✘ | ✘ | ✘ | ◐ | ✘ | jakékoli ED; obsah jen akce v rozsahu |
| Číst chat akce | ✔ | ◐ | ✔ | ✔ | ◐ | kdo akci vidí |
| Psát do chatu akce | ✔ | ◐ | ✔ | ✘ | ✘ | publikum ∨ OA; chat zapnutý, ne vynechaný výskyt |
| Smazat cizí zprávu chatu akce | ✘ | ✘ | ✔ | ✘ | ✘ | |
| Vidět nedostupnost ostatních | ✘ | ✘ | ✔ | ✔ | ✘ | u existující akce v rozsahu; při plánování jen kdo smí zakládat |

### 8.4 Kroje

| Akce | Č | SK | NK | SS | Pozn. |
|---|---|---|---|---|---|
| Moje kroje (vlastní zápůjčky, rezervace inventury) | ✔ | ✔ | ✔ | ✔ | modul zapnutý |
| Rezervovat / zrušit vlastní termín inventury | ✔ | ✔ | ✔ | ✔ | `self` výjimka v `mutate` |
| Prohlížet Správu krojů (sklad, karty, zápůjčky, inventury, nastavení) | ✘ | ✔ | ✔ | ✘ | |
| Vydat, vrátit, vyměnit, evidovat kusy, úkoly, inventury, externí držitele | ✘ | ✔ | ✘ | ✘ | |
| Nastavit výchozí kroj osoby | ✘ | ✔ | ✘ | ✔ | `profile` výjimka |

## 9. Seed pověření (demo, `features/mandates/data/mock-mandates.ts`)

`seedMandates(members, adminIds)` převádí dřívější pevné role:
- ID z `MOCK_ENSEMBLE_ADMIN_IDS` → `ensemble-admin` + `events` (celý soubor).
- Tabulka přezdívek pro každou ze 7 skupin → `group-owner` (první nalezený, jinak první aktivní člen skupiny) + `group-deputy` (jen nalezení členové).
- Člen Výboru → `attendance` (celý soubor); člen skupiny Krojařky → `costumes`; jinak člen Výboru nebo admin → `costumes-view`.
- Nikdo nemá `events`/`attendance` se skupinovým nebo akčním rozsahem → tyto větve se v demu bez ručního přidělení neprojeví.

## 10. Odchylky od `docs/08`

- `docs/08` kap. 10.1 (správce souboru se nesmí tajně přidat): přímé přidání sebe je blokováno, ale SS může sám sebe jmenovat hlavním správcem (`setGroupRole` u `owner` nevyžaduje členství) a pak se jako správce přidat – oba kroky jsou auditované a v chatu skupiny se zobrazí jako systémové události, ale **nejsou** označené jako mimořádný zásah.
- `AuditEntry.extraordinary` – komentář v modelu slibuje oznámení správcům skupiny; implementováno jen zvýraznění v historii.
- `docs/08` kap. 3.2 (spolusprávce spravuje nástěnku a moderuje): splněno jen pokud spolusprávce obsah čte – vynuceno pravidlem „spolusprávce musí být členem“. Hlavní správce může být nečlen (jen technická správa).

## Pozorování a technický dluh

- **Nečlen jako hlavní správce nemá UI**: panel správy skupiny je jen v záložce „Správa“ prostoru skupiny (vyžaduje `canReadGroupContent`) a ve Správě (jen SS). Hlavní správce, který není členem soukromé skupiny a nemá SS, skupinu prakticky spravovat nemůže, přestože mu to pravidla dovolují. Vzniká např. když SS při založení skupiny určí jiného vlastníka (`createGroup(data, ownerId)` vlastníka do skupiny nepřidá).
- **Spolusprávce se nemůže vzdát role** jinak než odchodem ze skupiny (`setGroupRole(self, null)` vyžaduje `canAssignGroupManagers`).
- **Neaktivní osoba s uloženým přihlášením** zůstává přihlášená (`splk.auth.user` se při deaktivaci neruší, `authGuard` kontroluje jen existenci uživatele). Její subjekt nemá skupiny ani pověření, ale `canReadGroupContent` u `open` skupin a `canSeeEvent` u akcí celého souboru nekontrolují `isActive` → bývalý člen dál čte otevřené skupiny a vidí akce souboru; `canCreateGroup` v režimu `members` mu také projde.
- **Služby bez kontroly** (mezery proti principu „backend kontroluje“): `ActualAttendanceService` (zápis docházky komukoli), `AttendanceService.updateAttendance` (libovolné `memberId`, bez kontroly publika/organizátora), `MembersService.updateMember` (libovolná osoba, libovolná pole vč. `groupIds`, `isActive`), `EnsembleSettingsService.save`, `PostsService.markAsRead/markVisited`, `CommentsService.markSeen`, `GroupsService.createGroup/updateGroup/deleteGroup` a `MandatesService.add/remove` (veřejné, bez kontrol – obcházejí `MembershipService`).
- **Čtecí API vrací vše**: `PostsService.getPosts`, `CommentsService.getAllComments`, `EventsService.getEvents`, `MembersService.getMembers` (vč. e-mailů, telefonů, plných jmen), `CostumeStoreService.state$` (celý fond vč. cizích zápůjček). Filtrování je v komponentách – pro HTTP API bude nutné přenést do backendu.
- **Archivace není konzistentně vynucena**: autor může upravit příspěvek i chatovou zprávu v archivované skupině nebo ve skupině, kde už není členem; `removeMember` a `reject` archivovanou skupinu nekontrolují (na rozdíl od `addMember`/`approve`).
- **Mimořádný zásah se nepočítá u odebrání** člena Správou souboru (jen přidání/schválení/pozvánka).
- **Moduly se kontrolují jen v UI** (guard, menu); služby akcí a krojů zápis při vypnutém modulu nezakážou.
- **`attendance` se skupinovým rozsahem zahrnuje i cílové skupiny**, kdežto `events` jen pořádající – asymetrie je záměrná (komentář v kódu), ale snadno přehlédnutelná.
- **Unikátnost pověření** se hlídá jen v `grantSync`; seed i `MandatesService.add` duplicity připustí.
- **Hlavní správce je max. jeden** (předání odebere všechny ostatní `group-owner`), ale model (`Mandate[]`) i `groupOwnerIds()` počítají s více vlastníky – pravidla „jediný hlavní správce“ jsou tak v praxi „vždy jediný“.
- **`actorId: 0`** v auditu, pokud služba nezná přihlášeného (`memberId() ?? 0`) – audit pak ukazuje neexistujícího aktéra.
- **Guardy nechrání detail akce/příspěvku podle oprávnění** – řeší to komponenta (not found); přímé URL na `events/:id/edit` hlídá jen `moduleGuard`, oprávnění k úpravě kontroluje formulář a služba.
