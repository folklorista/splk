# 07 – Správa souboru, členové, historie, profil, nastavení, přehled

Popisuje **skutečně implementované** chování (stav kódu k 2026-10-21, větev `design/identity-03`). Frontend-only: všechny services jsou mock s perzistencí do `localStorage` (viz kap. 14). Oprávnění podrobně v 03, akce v 04, skupiny/chat v 05, kroje v 06.

Pokryté oblasti: `features/manage`, `features/members`, `features/mandates` (stručně), `features/audit`, `features/ensemble`, `features/profile`, `features/settings`, `features/dashboard`, `features/more`, `features/changelog`, `features/login`, `core/services/demo-data.service`.

---

## 1. Osoba (`Member`) a její stavy

```ts
interface Member {
  id: number; ensembleId: number /* vždy 1 */; userId: number /* = id */;
  firstName: string; lastName: string;
  nickname: string;           // veřejné jméno, unikátní (bez diakritiky/velikosti písmen)
  email?: string; phone?: string;
  groupIds: number[];         // aktuální členství ve skupinách
  groupIntervals?: Record<groupId, { from: string; to?: string }[]>; // historie členství (pro viditelnost chatu „od vstupu“)
  avatar?: { icon: IconName; color: string };  // chybí = iniciály na barvě odvozené z id
  functionTitle?: string;     // „souborová funkce“ – jen popisek, nic neopravňuje
  isExternal?: boolean;       // externista – není člen souboru
  isActive: boolean;          // false = bývalý člen / vyřazený externista
  createdAt: string;          // YYYY-MM-DD
}
```

| Stav | `isActive` | `isExternal` | Přístup | Pozn. |
| --- | --- | --- | --- | --- |
| Aktivní člen | true | – | dle skupin a pověření | běžný stav |
| Externista | true | true | jen akce, kam je pozván, a skupiny, kam byl přijat | nemůže zakládat skupiny ani vstupovat do otevřených |
| Bývalý člen | false | – | žádný (subject má prázdné `groupIds` i `mandates`) | zůstává kvůli historii, docházce, zápůjčkám |
| Vyřazený externista | false | true | žádný | skryt z nabídek (výdej krojů, hosté akcí) |

- Celé jméno (`getFullName`) je chápáno jako údaj pro Správu; ostatním se ukazuje přezdívka.
- Osoba se **nemaže** při odchodu – jen `isActive=false`. Trvalé smazání jen „čisté“ osoby (kap. 5.4).

## 2. `MembersService` (features/members)

- Živý stav `members: Signal<Member[]>` + modulová cache `membersCache`; každá změna `commit()` → signal + `saveDemoData('members')`.
- Seed: `MOCK_MEMBERS` (11 vymyšlených osob, 1 externista, admin id 3) + doplnění `functionTitle` z `DEMO_FUNCTION_TITLES` (mapa přezdívka → funkce).
- Asynchronní API (Observable, umělé `delay(300)`): `getMembers`, `getActiveMembers`, `getMember`, `getMemberByUserId`, `createMember`, `updateMember`.
- Synchronní API pro `MembershipService` / `PersonDeletionService`: `findMember`, `insert`, `replace`, `setGroupMembership`, `setActive`, `remove`, `resetCache`.
- Pravidla:
  - **Unikátní přezdívka**: `nicknameKey` (NFD bez diakritiky, lowercase, trim). Kolize → `NicknameTakenError("Přezdívku „X“ už má někdo jiný.")` v `insert`, `replace`, `updateMember`. Vlastní přezdívku lze ponechat.
  - Nové id = `max(id)+1`, `userId = id`.
  - `setGroupMembership`: vstup otevře nový interval `{from}`, odchod uzavře poslední otevřený (`to`); když otevřený chybí, vloží `{from: epoch, to}`. Staré intervaly zůstávají.
  - E-mail **není** unikátní ani validovaný na úrovni service.
- Oprávnění service **nekontroluje** – hlídá je `MembershipService` (groups) a `PersonDeletionService`. Profil a avatar ale volají `updateMember` přímo (kap. 8, 9).

### 2.1 `demo-authors.ts`
Deterministický výběr autorů ukázkového obsahu podle skupin (ne pevná ID), aby demo fungovalo s vymyšlenými i importovanými členy:
- `demoMember(groupIds, nth, excludeIds)` – n-tý aktivní člen ve všech skupinách → fallback poslední skupina → kdokoli aktivní; jinak throw.
- `otherDemoMember(...)` – jen z poslední skupiny (nástěnka), jinak `undefined` (komentář se vynechá).

## 3. Import reálných členů (`scripts/import-members.mjs`)

- Vstup: lokální, gitem ignorovaný TSV (`dev/local/clenove.tsv` nebo cesta v argumentu), UTF-8 (BOM odstraněn), 1. řádek hlavička (case-insensitive).
- Výstup: `features/members/data/mock-members.local.ts` (gitignored), exportuje `MOCK_MEMBERS` a `MOCK_ENSEMBLE_ADMIN_IDS`. Do buildu se dostane jen konfigurací `demo` (Angular `fileReplacements` nahradí `mock-members.ts`).
- Sloupce:

| Sloupec | Povinný | Význam |
| --- | --- | --- |
| `jméno`, `příjmení` | ano | příjmení se **maskuje** na iniciálu + `*****` (pevná délka, aby neunikla délka) |
| `nickname` | ano | prázdné → „jméno + maskované příjmení“ |
| `datum přidání` | ano | `createdAt`; prázdné → dnešek |
| `administrátor` | ano | `ANO` → id do `MOCK_ENSEMBLE_ADMIN_IDS` (→ pověření Správa souboru + Organizace akcí) |
| `externista` | ano | `ANO` → `isExternal: true` |
| `bývalý` | ne | `ANO` → `isActive: false` |
| `výbor`, `taneční`, `muzika`, `kluci`, `holky`, `malá vonica`, `sklad` | ano | `ANO` → členství ve skupině s pevným id 1–7 |

- Id = pořadí řádku. E-mail/telefon se neimportují (demo login pak jde jen přes výběr profilu).
- Duplicitní přezdívky (dle `nicknameKey`) → výpis řádků a exit 1.

## 4. Pověření – úložiště (features/mandates, stručně)

- `MandatesService`: signal `mandates`, `add` (id = max+1), `remove`, `update`, `resetCache`; perzistence `mandates`. Bez kontrol – ty dělá `MembershipService` (`grantMandate`, `revokeMandate`, ochrana posledního správce; detail v 03).
- `seedMandates(members, adminIds)` – převod dřívějších rolí na pověření:
  - admin → `ensemble-admin` + `events`;
  - hlavní správce / spolusprávci skupin podle seznamu přezdívek (fallback: první aktivní člen skupiny);
  - člen Výboru → `attendance`; člen skupiny Sklad → `costumes`; jinak Výbor nebo admin → `costumes-view`.
- `Mandate` (výběr polí): `memberId, kind, groupId?, eventId?, grantedAt, grantedById?, temporary?`.

---

## 5. Správa (`/app/manage`, features/manage)

- Route `manage` chráněna `ensembleAdminGuard` (jen UI pohodlí, bez oprávnění redirect na Přehled). `admin/**` → redirect na `manage`.
- Layout: nadpis „Správa“ + záložky **Členové | Skupiny | Konfigurace | Historie**; výchozí `members`.
- Princip: Správa souboru **nedává přístup k obsahu soukromých skupin** (chat, nástěnka); spravuje metadata, členství a pověření.
- Všechny zápisy jdou přes services (`MembershipService`, `PersonDeletionService`, `EnsembleSettingsService`); UI zobrazuje chybu/úspěch přes `ActionFeedback` (`error`, `success` na 2,5 s, `busy`). Chyby jsou `AccessDeniedError` / `RuleViolationError` s českou hláškou.

### 5.1 Členové – seznam (`/manage/members`)
- Hledání (přes `nicknameKey`) v „přezdívka + celé jméno + funkce“.
- Filtr stavu: **Aktivní členové** (výchozí; aktivní a ne externí) | Externisté (aktivní) | Bývalí (všichni neaktivní vč. vyřazených externistů) | Všichni.
- Řazení podle přezdívky (`cs` locale). Počet osob.
- Řádek: přezdívka + celé jméno; odznaky `bývalý člen` / `vyřazený externista` / `externista`; odznaky souborových pověření (bez `group-owner/deputy`, deduplikované); meta: funkce · názvy skupin nebo „bez skupiny“.
- Tlačítko „+ Přidat osobu“ → `/manage/members/new`.

### 5.2 Detail / založení osoby (`/manage/members/:id`, `/new`)
Sekce (u nové osoby jen první):
1. **Osobní údaje** (rozbalené jen u nové): jméno*, příjmení, přezdívka*, e-mail, telefon, souborová funkce (hint: nic neopravňuje), checkbox Externista. Uložení → `MembershipService.createPerson` (admin; `groupIds: []`, `isActive: true`, audit `person-created`, pak navigace na detail) nebo `updatePerson` (audit `person-updated`, i bez změny). Prázdné řetězce → `undefined`. Kolize přezdívky → chyba z `NicknameTakenError`.
2. **Kroje** (jen když je zapnutý modul Kroje a existují `genders`): výchozí kroj osoby (`CostumesService.setDefaultCostume`), jen preference pro krojařku při výdeji.
3. **Skupiny**: řádky, kde je osoba členem **nebo** je spravuje bez členství (odznak „nečlen – jen technická správa“); role hlavní správce / spolusprávce. „Odebrat“ → nativní `prompt()` na nepovinný důvod (jde do `note` v historii) → `removeMember`. U aktivní osoby select „Přidat do skupiny“ → `addMember` (audit `member-added`, případně `extraordinary`). Sám sebe admin přidat nemůže (hint + chyba ze service), pokud skupinu nespravuje.
4. **Pověření**: seznam s rozsahem (celý soubor / akce skupiny X / akce Y), odznak „přechodně“ (`temporary`), datum. Odebrání přes potvrzovací dialog → `revokeMandate` (u group rolí deleguje na `setGroupRole`). Přidělení (jen aktivní osoba): `GRANTABLE = ensemble-admin, events, attendance, costumes, costumes-view`; u `events`/`attendance` volba rozsahu: celý soubor | akce pořádané skupinou | jedna akce (nejbližších 40 nekončících akcí). Group role se přidělují jen v detailu skupiny.
5. **Náhled skutečných přístupů** (`accessOverview`): čte chat/nástěnku (skupiny), spravuje bez přístupu k obsahu, Správa souboru ano/ne, Akce/Docházka (ne | celý soubor | vybrané skupiny/akce), Kroje (spravuje | prohlíží | jen vlastní). Neaktivní: „nepřihlásí se a nemá žádné přístupy“.
6. **Členství v souboru / Evidence externisty** (kap. 5.3).
7. **Trvalé smazání** (kap. 5.4).

Změny se okamžitě promítají i do detailu skupiny (sdílené signály).

### 5.3 Ukončení / obnovení členství, externisté
- Dialog texty z `personActiveQuestion(member, active)` (testováno):
  - člen: „Ukončit aktivní členství – X?“ (danger) / „Obnovit aktivní členství – X?“;
  - externista: „Vyřadit externistu X z evidence?“ (danger, zmínka že historie i zápůjčky zůstanou) / „Vrátit X do evidence externistů?“.
- `MembershipService.setPersonActive(id, active)` (jen admin, idempotentní):
  - deaktivace: `deactivationProblem` blokuje **posledního aktivního správce souboru** a **jediného hlavního správce** některé skupiny („Nejdřív předejte hlavní správu skupin: …“);
  - smaže všechna pověření osoby (bez audit záznamů `mandate-revoked`), odebere ze všech skupin (každá → audit `member-removed`, uzavře interval);
  - `setActive`, audit `person-deactivated` / `person-reactivated` (u externisty `details: 'externista'` → jiný text v historii).
- Obnovení **nevrací** skupiny ani pověření.

### 5.4 Trvalé smazání osoby („bez stopy v evidenci“)
Účel: smazat osobu založenou omylem. Osobu, o které evidence něco ví, smazat nelze – zbývá ukončení členství / vyřazení.

`PersonDeletionService.footprint(memberId)` → `PersonFootprint`; blokátory v pevném pořadí (text v UI):

| Klíč | Zdroj | Text |
| --- | --- | --- |
| self | přihlášený = osoba | jde o váš vlastní účet |
| responses | `AttendanceService.hasResponses` (stav ≠ pending) | odpověděla na akce |
| actualAttendance | `ActualAttendanceService.hasRecords` | má zapsanou docházku |
| posts | `PostsService.hasAuthored` | napsala příspěvky |
| comments | `CommentsService.isAuthor` | napsala komentáře |
| chat | skupinový chat nebo chat akce | psala do chatu |
| mentions | zmínky v příspěvcích/komentářích/chatech | je zmíněna v obsahu ostatních |
| eventGuest | `EventsService.isGuest` | je pozvaná na akci jako host |
| costumes | `costumeReferencesMember(state)` | má záznamy v evidenci krojů |
| history | `hasOwnHistory(audit)` | má vlastní činnost v historii |

- `costumeReferencesMember`: rekurzivně projde celý `CostumeState` **kromě** `defaultCostumes` a hledá klíče `memberId` / `*MemberId` (hodnota = id) a `memberIds` / `*MemberIds` (pole obsahuje id). Generické → nová pole v evidenci krojů se chytí automaticky, pokud dodrží konvenci názvů.
- `hasOwnHistory`: osoba je `actorId` jakéhokoli záznamu, **nebo** `memberId` záznamu, který není správní. Správní (nebrání): `person-created/updated`, `member-added/removed`, `mandate-granted/revoked`, `invitation-created/cancelled`, `proposal-created`. Např. `person-deactivated` nebo `request-created` brání.
- `deletePerson(id)` (Observable přes `defer`):
  1. aktér musí mít Správu souboru (`AccessDeniedError`), osoba musí existovat;
  2. blokátory → `RuleViolationError("Osobu nelze smazat: …")`;
  3. `deactivationProblem` (poslední admin / jediný hlavní správce skupiny);
  4. smaže: všechna pověření, žádosti/pozvánky osoby (`removeForMember`), nedostupnosti (`availability.removeAllFor`), výchozí kroj (`defaultCostumes['member-<id>']`), osobu samotnou;
  5. audit `person-deleted` s `details: "přezdívka (celé jméno)"` (jméno se uloží, protože osoba už nebude dohledatelná).
- UI: při blokátorech seznam důvodů + doporučení (ukončit členství / vyřadit externistu); jinak tlačítko „Smazat osobu trvale“ → potvrzení → navigace na seznam.
- Cíl dle docs/08 kap. 4.1: „externisté i bývalí členové zůstávají, historie a zápůjčky se nemažou“ – implementace to respektuje přes blokátory.

### 5.5 Skupiny (`/manage/groups`, `/manage/groups/:id`, `/new`)
- **Seznam**: všechny skupiny vč. archivovaných; ikona, název; odznaky viditelnost (Soukromá/Otevřená/Skrytá), „Archivovaná“, „N čeká“ (nevyřízené žádosti), „bez správce“ (řádek zvýrazněn jako vyžadující akci). Meta: počet aktivních členů · správce · spolusprávci · komunikace (chat + nástěnka / jen organizační). „+ Založit skupinu“ jen při `canCreateGroup`.
- **Nová skupina**: název*, slug* (auto `slugify` – bez diakritiky, `[^a-z0-9]+`→`-` – dokud ho uživatel nepřepíše), ikona z `GROUP_ICON_OPTIONS`. Admin volí hlavního správce (aktivní ne-externí) nebo „Zatím já (přechodně, bez přístupu k obsahu)“ → pověření `temporary`, admin se nestává členem. Ne-admin (režim „zakládají všichni“) se stává členem i hlavním správcem. Výchozí nastavení z Konfigurace (viditelnost, chat, nástěnka, výchozí záložka, historie chatu). Slug musí být unikátní. Audit `group-created` + `mandate-granted(group-owner)`.
- **Detail**: „Otevřít skupinu“ jen když smí číst obsah; jinak hint „spravujete technicky“. Vložený `GroupAdminPanelComponent` (sdílený se skupinou, popsán v 05: nastavení, členové, žádosti, správci, archivace, historie skupiny). „Smazat skupinu“ jen admin a jen **archivovaná** skupina: smaže příspěvky, komentáře, chat, žádosti, členství (uzavře intervaly), pověření ke skupině; akce, docházka a kroje zůstávají; audit `group-deleted`.
- Stejná komponenta je i na `/app/groups/new` (guard `groupCreateGuard`) pro režim „zakládají členové“.

### 5.6 Konfigurace (`/manage/config`)
Formulář nad kopií (`linkedSignal` + `structuredClone`) `EnsembleSettings`:
- **Název souboru** (prázdný → „Soubor“).
- **Moduly**: `events` (Akce a docházka), `costumes` (Kroje). Vypnutí skryje modul z menu všem (guardy `moduleGuard`), data zůstávají; skupiny/členství vypnout nejdou.
- **Kdo zakládá skupiny**: `admins` (výchozí) | `members` (všichni aktivní ne-externí). Režim „návrh a schválení“ není implementován.
- **Výchozí nastavení nové skupiny**: viditelnost, výchozí záložka (chat/nástěnka), chat on/off, nástěnka on/off, historie chatu pro nové členy (`CHAT_HISTORY_LABELS`).
- **Seskupování komentářů v chatu**: `minComments` (≥2, default 3), `windowMinutes` (≥1, default 10) – souhrnná karta v chatu (05).
- Uložení: jen pokud `isEnsembleAdmin` (jinak tiché `return`), audit `settings-updated` (bez `details`, i když se nic nezměnilo), hláška „Uloženo“.

### 5.7 Historie (`/manage/history`)
- Zdroj `AuditService.entries()`, **bez** `post-*` a `event-*` (moderace obsahu a změny akcí patří do historie skupiny – Správa nečte obsah). Nejnovější nahoře, bez stránkování.
- Filtry: Vše | Členství, žádosti, pozvánky (`member-*`, `request-*`, `invitation-*`, `proposal-created`) | Pověření | Skupiny a konfigurace | Osoby (`person-*`) | Mimořádné zásahy (`extraordinary`).
- Řádek: text z `auditText`, datum a čas, aktér (přezdívka, jinak „neznámá osoba“), příp. „mimořádný zásah“ (zvýraznění) a „Interní poznámka: …“.
- Smazaná skupina → „smazaná skupina“, smazaná osoba → „neznámá osoba“ (u `person-deleted` je jméno v `details`).

---

## 6. Audit (features/audit)

```ts
interface AuditEntry {
  id: number; at: string; actorId: number; action: AuditAction;
  groupIds: number[];          // dotčené skupiny (u akcí cílové + pořádající)
  memberId?; postId?; eventId?; mandateKind?;
  details?: string;            // neutrální popis (co se změnilo; u person-deleted jméno; 'externista' příznak)
  note?: string;               // interní poznámka – jen pro oprávněnou správu, nikdy do chatu
  extraordinary?: boolean;     // zásah Správy souboru ve skupině, kterou nespravuje
}
```

- `AuditService`: append-only (`record` doplní id = max+1 a `at`), signal `entries`, perzistence `audit`. `resetCache` = prázdná historie (testy). Seed `seedAudit()` – dva ukázkové záznamy (přidání/vstup do skupiny), aby chat ukazoval systémové události.
- Kdo co zapisuje:

| Zdroj | Akce |
| --- | --- |
| `MembershipService` | `member-added/removed/left/joined`, `request-created/approved/rejected/cancelled`, `invitation-created/declined/cancelled`, `proposal-created`, `mandate-granted/revoked`, `group-created/updated(details = změněná pole)/archived/restored/deleted`, `person-created/updated/deactivated/reactivated` |
| `PersonDeletionService` | `person-deleted` |
| `ManageConfigComponent` (!) | `settings-updated` – zapisuje komponenta, ne service |
| `PostsService` | `post-published/pinned/unpinned/hidden/unhidden/archived/restored` |
| `EventsService` | `event-created`, `series-created`, `event-updated` (details = popis změny) |

- `extraordinary` nastavuje `MembershipService` u `addMember`, schválení žádosti (`member-joined`) a `invite`, když aktér je admin a skupinu nespravuje. Panel skupiny na to předem upozorní.
- `auditText(entry, ctx)` – česká věta pro každou akci (rod „přidán/a“), rozsah pověření „(skupina)“ nebo „(akce X)“. Kontext dodává resolvery jmen (`memberName`, `groupName`, `eventTitle`).
- Promítání do chatu skupiny: `isChatSystemEvent` – jen `member-added/removed/left/joined`, `post-pinned`, `event-created`, `series-created`, `event-updated` a `mandate-*` u group rolí; žádosti, zamítnutí ani poznámky ne. `chatSystemText` – krátká verze s aktérem („· provedl/a X“).
- Historie se zobrazuje: Správa → Historie (kap. 5.7), historie v panelu správy skupiny (05), chat skupiny (systémové zprávy).

## 7. Konfigurace souboru (`EnsembleSettingsService`, features/ensemble)

```ts
interface EnsembleSettings {
  name: string;                                   // 'Vonica'
  modules: { events: boolean; costumes: boolean }; // obě true
  groupCreation: 'admins' | 'members';            // 'admins'
  newGroupDefaults: { visibility; chatEnabled; boardEnabled; defaultTab; chatHistory? }; // private, true, true, 'chat', 'open'
  chatGrouping: { minComments: number; windowMinutes: number }; // 3, 10
}
```
- Signal `settings`; načtení = `{...DEFAULT, ...uložené}` (mělký merge); `save` bez kontroly oprávnění (hlídá volající komponenta); perzistence `ensemble-settings`.
- Čte ji `AccessService` (`modules`, `canCreateGroup`), detail/založení skupiny, chat.

---

## 8. Můj profil (`/app/profile`, features/profile)

- Jméno a příjmení jen ke čtení („změnit může jen administrátor“).
- Reactive form: **přezdívka** (required), **e-mail** (`Validators.email`, smí být prázdný), **telefon**. Tlačítko Uložit aktivní jen při změně a validním formuláři.
- Uložení: `MembersService.updateMember` **přímo** (ne přes `MembershipService` → žádný audit, žádná kontrola, že upravuji sebe). Kolize přezdívky → hláška z `NicknameTakenError`. Po úspěchu `auth.refreshFromMember` (aktualizuje uloženého uživatele).
- Pod formulářem `MyUnavailabilityComponent` (moje nedostupnosti – modul availability, viz 04) a tlačítko **Odhlásit se** (`auth.logout` → `/login`).
- Pozor: e-mail je zároveň přihlašovací identifikátor (kap. 13).

## 9. Nastavení (`/app/settings`, features/settings)

Osobní chování aplikace **jen v tomto zařízení** (`SettingsService`, klíč `splk.settings`, nemaže ho reset dema, není vázáno na uživatele).

```ts
interface AppSettings {
  theme: 'auto'|'light'|'dark'; fontSize: 'normal'|'larger'|'largest';
  eventsView: 'list'|'calendar'; reduceMotion: boolean | null /* null = systém */;
  bottomBar: string[] | null /* null = automatický návrh */;
  sidebarMenu: { order; hidden } | null; sidebarCompact: boolean;
  calendarExport: { types: string[]; skippedAsNotice: boolean } | null;
}
```
Projeví se atributy na `<html>` (`data-theme`, `data-font-size`, `data-reduce-motion`).

Sekce stránky:
1. **Vzhled** – režim, velikost písma (segmented), omezit animace (checkbox, „podle systému“ dokud `null`).
2. **Profilová ikonka** (`AvatarSettingsComponent`) – výjimka: ukládá se do `Member.avatar` (vidí ostatní). 14 ikon × 8 barev; klik na ikonu uloží hned; změna barvy bez ikony vybere první ikonu; „Použít iniciály“ = `avatar: undefined`. Zápis přímo `updateMember` (bez auditu).
3. **Spodní lišta** (mobil, `#spodni-lista`) – Přehled vždy první, max 4 místa (`BAR_SLOTS`); víc → první 3 + „Více“. Náhled textem, řazení šipkami ↑↓ (přístupné bez drag&drop), Odebrat/Přidat, čára „od sem dál pod Více“, „Obnovit výchozí“ (`null` = automatický návrh `defaultBarKeys`: Akce → skupiny → agendy se zápisem → Moje kroje → ostatní; běžný člen bez agend dostane skupiny přímo, jinak sloučené „Skupiny“).
4. **Boční menu** (desktop, `#bocni-menu`) – pevné položky (Přehled, hlavní, sekce Soubor) jen zobrazené; v sekcích **Moje skupiny** a **Agendy** řazení ↑↓ a Skrýt/Zobrazit (skryté pod „Další“). Nezávislé na liště. Nedostupné klíče se v konfiguraci ponechají (po návratu přístupu platí).
5. **Akce** – výchozí zobrazení seznam/kalendář.
6. **Kalendář** (`CalendarExportComponent`) – jednorázový export .ics (typy akcí, vynechané termíny jako „NENÍ …“); detail v 04. Odběr URL s tokenem až s backendem.
7. **Upozornění** – stav Notification API (nepodporováno / povoleno / zablokováno / tlačítko Povolit); pro každou moji skupinu režim `GroupNotificationsService`: Vše | Jen důležité (zmínky a oznámení) | Jen když mě někdo zmíní | Vypnuto (u posledních dvou se nepřečtené chatu nepočítají do odznaku).

## 10. Přehled (`/app/dashboard`, features/dashboard)

Pořadí bloků: **Čeká na vás** → **Nejbližší akce** → **Připnutá oznámení**.

### 10.1 Čeká na vás (`pending-actions.ts`)
Computed z živých zdrojů; blok se skryje, když je prázdný. Každá oblast je čistá funkce → `PendingAction { key, kind, title, detail?, link, queryParams?, sortAt, eventId? }`; řazení `sortAt` vzestupně (nejbližší termín první).

| Kind | Podmínka | Odkaz | Modul |
| --- | --- | --- | --- |
| `event-change` | nadcházející akce, kde jsem v publiku a `changeAcknowledgement` vyžaduje otevření/potvrzení důležité změny | detail akce | events |
| `event-response` | `needsResponse(event, můjStav)` (výzva v předstihu, bez odpovědi) + tlačítka **Přijdu / Nepřijdu** | detail akce | events |
| `group-invitation` | pozvánka `awaiting-member` pro mě | `/app/boards` | jádro |
| `group-requests` | žádosti `awaiting-manager` ve skupinách, které spravuji, **seskupené po skupině** („3 žádosti o vstup…“) | skupina `?tab=manage` | jádro |
| `inventory-booking` | výzva k inventuře krojů bez rezervovaného termínu | `/app/costumes` | costumes |
| `loan-overdue` | moje výpůjčka po termínu („Vraťte <část> <číslo>“) | `/app/costumes` | costumes |
| `attendance-record` | akce skončila před ≤14 dny (`ATTENDANCE_REMINDER_DAYS`), není zrušená/vynechaná, nemá žádný záznam docházky a smím ji evidovat | detail akce | events |

- Vypnutý modul → jeho položky se nepočítají.
- Cíl dle docs/10 kap. 7.2: položky má dodávat každý modul přes feature service; implementace má logiku modulů v `dashboard/pending-actions.ts`.

### 10.2 Nejbližší akce
- `getEvents()` stream (s `takeUntilDestroyed`); filtr `isEventAudience(member, e)`, začátek ≥ teď, řazení, max **5** (`DASHBOARD_EVENT_LIMIT`).
- Řádek `EventRsvpRowComponent` (04) s mým stavem (default `pending`); změna → optimistický update řádku + `AttendanceService.setStatus`. Odkaz „Všechny akce v kalendáři →“ (`?view=calendar`).
### 10.3 Připnutá oznámení
- Příspěvky `isPinned`, ne archivované/skryté, ze skupin, kde jsem členem **a** smím číst obsah (Správa souboru tedy nevidí cizí); nejnovější první. Nepřečtené (`post.readers` neobsahuje mě) → zvýraznění + odznak „Nepřečteno“.
- Načítání: `getMembers` → najde člena podle `userId` → posts + events; „Načítání…“ do načtení obojího.

## 11. Více (`/app/more`)
- „Z vaší lišty“ = místa přetékající z lišty (`resolvedBar().overflow`); „Další místa“ = ostatní dostupná místa (`orderedPlaces` mimo lištu); „Osobní“: Můj profil, Nastavení, Novinky. Dlaždice s odznaky. Odkaz „Upravit spodní lištu →“ (`/settings#spodni-lista`).
- Dostupná i z ikony Více v mobilní hlavičce (Moje místa na Přehledu byla odebrána, docs/10 kap. 7.4).

## 12. Novinky (`/app/changelog`)
- `ChangelogService.getChangelog()` = `HttpClient.get('changelog.json')` (soubor v `public/`, zapisuje `scripts/release.mjs`), chyba → `[]`. Jediné místo v této oblasti s reálným HTTP.
- `ChangelogEntry { version, releasedAt, dance: { codename, title, url }, changes: string[] }` – každá verze nese kódové jméno lidového tance s odkazem.
- Stránka: aktuální verze (`BuildInfoService`, `versionLabel`) + datum sestavení, pak seznam vydání (nejnovější první); stavy načítání / prázdno.

## 13. Přihlášení (`/login`, mock)
- `AuthService` (core): uživatel v signalu + `localStorage` (zapamatované přihlášení). Už přihlášený je z loginu přesměrován.
- **E-mail + heslo**: obě povinná („Zadejte email a heslo.“), **heslo se neověřuje**; hledá se aktivní člen s e-mailem (case-insensitive). Nenalezen → „Uživatel nebyl nalezen.“
- **Demo profily**: select všech aktivních členů (vč. externistů) seřazených podle přezdívky; popisek „přezdívka (funkce, Správa souboru | Správa krojů)“; „Přihlásit“ → `loginAsMember(id)`. Slouží i jako přepínání osob (odhlásit → vybrat jinou).
- `safeReturnUrl(returnUrl)` – jen cesty začínající `/app`, jinak `/app/dashboard` (ochrana proti open redirect).
- Neaktivní člen se přihlásit nemůže; už přihlášený a poté deaktivovaný zůstává přihlášen, jen bez přístupů (subject má prázdné skupiny a pověření).

## 14. Demo data a reset
- `core/data/demo-storage`: `loadDemoData(name, seed)` / `saveDemoData` pod prefixem `splk.demo.`; verze `DEMO_DATA_VERSION = 9` – nesoulad verze smaže všechna demo data (změna tvaru mock dat). Nedostupné úložiště → data jen v paměti.
- `DemoBannerComponent`: „Demo verze – změny vidíš jen ty v tomto prohlížeči“ + „Obnovit demo data“ (potvrzení) → `DemoDataService.reset()` = `clearDemoData()` + `window.location.reload()`. Přihlášení i osobní Nastavení zůstávají.

---

## 15. Testy (Karma + Jasmine)

| Spec | Pokrývá |
| --- | --- |
| `manage/person-deletion.spec` (6) | správní vs. vlastní historie, krojové reference (zápůjčka/vydávající ano, výchozí kroj ne), pořadí důvodů; service: smazání čisté osoby + audit, blokace po odpovědi na akci, `AccessDeniedError` bez pověření, blokátor „vlastní účet“ |
| `manage/person-active-question.spec` (3) | texty dialogů člen vs. externista |
| `members/members.service.spec` (13) | CRUD, kopie pole, aktivní filtr, intervaly členství (vstup/odchod/návrat), `setActive` bez smazání, unikátní přezdívka bez diakritiky, vlastní přezdívka |
| `members/data/demo-authors.spec` (4) | výběr autora, fallback, n-tý/vyloučení, determinismus |
| `audit/audit-text.spec` (2) | texty ukončení/obnovení u externisty a člena |
| `dashboard/pending-actions.spec` (6) | výzva k účasti, pozvánky + seskupené žádosti, inventura + vrácení po termínu, docházka do 14 dnů jen pro pověřené, řazení, důležitá změna (otevření / potvrzení) |
| `dashboard/dashboard.component.spec` (6) | viditelnost akcí dle skupin, limit 5 a řazení, převzetí stavu účasti, rychlé potvrzení, připnuté jen ze skupin, kde smím číst (i pro Správu souboru) |
| `profile/profile.component.spec` (4) | předvyplnění, uložení kontaktů, prázdný e-mail OK / prázdná přezdívka ne, neplatný e-mail |
| `login/login.component.spec` (6) | prázdný formulář, login + navigace, demo login, returnUrl, už přihlášený, `safeReturnUrl` |
| `settings/settings.component.spec` (1), `changelog.service.spec` (2), `demo-data.service.spec` (1) | předání změn, načtení/chyba JSON, reset |

Bez testů: komponenty Správy (seznam, filtry, detail osoby, konfigurace, historie), `MandatesService`, `EnsembleSettingsService`, `AuditService`, avatar/lišta/sidebar komponenty (logika lišty a sidebaru je testovaná v `core/layout`). Pravidla `setPersonActive`/`deactivationProblem` jsou testovaná v `membership.service.spec` a `mandate-rules.spec` (03).

---

## Pozorování a technický dluh

1. **Recyklace id po smazání osoby.** `MembersService.insert` používá `max(id)+1`. Smaže-li se osoba s nejvyšším id a založí nová, dostane stejné id (i `userId`). Na staré id přitom dál odkazují: správní audit záznamy (`person-created`, `member-added`, `mandate-granted`…), záznamy `AttendanceRecord` se stavem `pending` a `firstViewedAt` (z `markViewed`), `post.readers`, režimy upozornění (`memberId:groupId`), žádosti, kde byla `createdById`. Historie by pak novou osobu ukazovala jako aktéra/předmět cizích událostí. Řešení: monotónní sekvence (backend autoincrement) nebo úklid i těchto referencí.
2. **„Bez stopy“ není úplně bez stopy.** Smazání neuklidí výše zmíněné sirotky (zobrazení akcí, přečtení příspěvků, notifikační preference, správní audit). A `person-deleted.details` uloží přezdívku i celé jméno natrvalo do historie – rozpor s cílem úplného výmazu (GDPR); zvážit jen přezdívku nebo anonymizaci.
3. **Profil a avatar obcházejí `MembershipService`.** Volají `MembersService.updateMember` přímo: bez auditu, bez kontroly, že osoba upravuje sama sebe. Navíc mění e-mail = přihlašovací identifikátor, a e-mail není unikátní → při duplicitě se přihlásí první nalezený. Pro backend je potřeba endpoint „můj profil“ s kontrolou a unikátním e-mailem.
4. **Zakládání skupiny ne-adminem je rozbité.** V režimu `groupCreation: 'members'` vede `/app/groups/new` na `ManageGroupComponent`, který po založení naviguje na `/app/manage/groups/:id` a odkaz zpět míří na `/app/manage/groups`. Obojí chrání `ensembleAdminGuard` → uživatel skončí na Přehledu. Výchozí režim `admins` problém skrývá.
5. **`settings-updated` zapisuje komponenta** (`ManageConfigComponent`), ne service, a to vždy, i bez změny a bez `details`. Porušuje pravidlo „data přes services“ a historii zaplňuje prázdnými záznamy. `EnsembleSettingsService.save` oprávnění nekontroluje, ne-admin dostane tiché nic.
6. **Ukončení členství nezapisuje odebraná pověření.** `setPersonActive(false)` smaže pověření bez záznamů `mandate-revoked` (odebrání ze skupin zapisuje). Ze samotné historie pak nejde zjistit, o jaká pověření osoba přišla. Obnovení členství je nevrací.
7. **Externista a pověření.** Přepnout `isExternal` lze u existující osoby bez úklidu skupin a pověření a `grantMandate` externistu nevylučuje. Správa souboru tak může dát externistovi např. Správu krojů. Ověřit proti docs/08, případně doplnit pravidlo.
8. **Přihlášený bývalý člen.** Deaktivace neodhlásí uloženou session: uživatel zůstane v aplikaci s prázdnými přístupy místo odhlášení s vysvětlením. Backend musí session/token zneplatnit.
9. **Demo login odhaluje seznam členů.** Výběr profilů na veřejné login stránce ukazuje přezdívky a funkce všech aktivních členů (u buildu `demo` jde o reálné osoby, příjmení jsou sice maskovaná). Heslo se neověřuje. Pro demo to stačí, pro produkci to musí zmizet.
10. **Přehled – prázdný stav oznámení.** `@if (pinnedPosts(); as posts)` je pro prázdné pole pravdivé, takže text „Žádná důležitá oznámení.“ se nikdy neukáže, jen prázdný seznam. „Nejbližší akce“ se zobrazují i s vypnutým modulem Akce (filtr modulu je jen u „Čeká na vás“). Vnořené subscribe (`getMembers` → `getPosts`) a `posts` bez živé aktualizace: přečtení nebo připnutí se projeví až po znovuotevření stránky.
11. **Dashboard vs. docs/10 kap. 7.3.** Dokumentace uvádí blok „Moje kroje ✅ – jen když má člen výpůjčku“, v `dashboard.component.html` takový blok není (krojové věci jsou jen v „Čeká na vás“). Nesoulad dokumentace a kódu.
12. **Logika „Čeká na vás“ je v dashboardu**, ne v modulech (rozpor s docs/10 kap. 7.2). Dashboard importuje vnitřní utility krojů, akcí i skupin. Pro badge na Přehledu nebo push notifikace by se hodilo rozhraní „feature service → pending items“.
13. **Nastavení je per zařízení, ne per uživatel.** `splk.settings` (lišta, sidebar, téma, export kalendáře) sdílí všichni, kdo se na zařízení přepínají (demo profily). Lišta navíc při jakékoli úpravě uloží jen aktuálně dostupné klíče (nedostupné zahodí), sidebar je ponechává – nekonzistentní chování.
14. **Mělký merge uložené konfigurace.** `EnsembleSettingsService` (`{...DEFAULT, ...stored}`) ani `SettingsService` nedoplní nové vnořené klíče (např. nový modul v `modules`). Chrání jen bump `DEMO_DATA_VERSION`, a ten pro `splk.settings` neplatí.
15. **UI drobnosti v detailu osoby.** Odebrání ze skupiny používá nativní `prompt()` (jinde je `ConfirmService`). V „Přidat do skupiny“ jsou i archivované skupiny (service pak odmítne). `personId` se čte ze snapshotu, takže přechod mezi osobami ve stejné instanci komponenty se nepřenačte. Blokátory smazání se počítají v šabloně při každé změně detekce (`deletionBlockers(m.id)`) a pokaždé procházejí celou evidenci krojů i audit.
16. **Historie bez stránkování a hledání.** Audit je append-only pole v `localStorage` a Správa → Historie ho celý filtruje a renderuje. S backendem bude potřeba stránkování, filtr podle osoby a skupiny a odkaz z detailu osoby na její historii (zatím chybí).
17. **Testové mezery.** Komponenty Správy (zejména filtry seznamu a historie, konfigurace s normalizací `chatGrouping`, flow založení skupiny) nemají testy. Bod 4 by test navigace odhalil.
