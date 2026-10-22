# 08 – Souhrn zjištění (průřezově, podle priority)

> Deduplikovaný výtah ze sekcí „Pozorování a technický dluh“ kapitol 01–07. Odkaz `[04]` = kapitola, kde je detail. Priorita: **P1** = blokuje backend nebo produkci s reálnými daty, **P2** = chyba nebo nekonzistence viditelná uživateli, **P3** = dluh a údržba.

## P1 – architektura a bezpečnost před backendem

1. **Chybí abstrakce datové vrstvy.** Mezi mock a HTTP implementací není rozhraní ani DI token. Mock services jsou de facto backend: validace, pověření, audit, kaskády. Přechod na PHP znamená přepsat ~20 services a přesunout pravidla na server. API kontrakt existuje jen implicitně v signaturách services. [01]
2. **Oprávnění se vynucují jen v prohlížeči a ne všude ani tam.** Guardy jsou „pohodlí UI“. Část services kontroly nemá: zápis skutečné docházky, `updateAttendance` s libovolným `memberId`, `updateMember` (libovolná pole včetně `groupIds` a `isActive`), uložení konfigurace souboru, veřejné `GroupsService.create/update/delete` a `MandatesService.add/remove`. Login neověřuje heslo, produkci chrání jen Basic Auth. [01][03]
3. **Čtecí API vrací všechno**: příspěvky, komentáře, chat, akce + všechny RSVP, osoby včetně kontaktů a celý krojový fond. Filtrují až komponenty, a to různými způsoby. Backend musí filtrovat na serveru a vracet agregace. [03][04][05][06]
4. **Datový model se přímo nehodí pro relační DB:**
   - `Member` = osoba + účet + členství; chybí entity Účet a Soubor, `ensembleId = 1` je napevno;
   - místo vazebních tabulek pole ID (`groupIds`, `readers`, `lastVisitedAt`, `targetGroupIds`…), stav přečtení je uložen v entitě;
   - polymorfní `Borrower`, krojový stav jako jeden JSON blob;
   - série akcí nemá entitu, `importantChange` drží jen poslední změnu. [02][06]
5. **Chybí referenční integrita a úklid při mazání:**
   - smazání akce nechá RSVP, docházku i chat (a dialog přitom tvrdí opak), a tyto sirotky pak blokují smazání osoby;
   - smazání skupiny nechá reference v akcích;
   - ID se přiděluje jako `max+1`, takže po smazání osoby s nejvyšším ID dostane nová osoba stejné ID i cizí historii. [02][04][07]
6. **Session bez revalidace:** deaktivovaný člen zůstane přihlášen. `canReadGroupContent` (otevřené skupiny) a `canSeeEvent` nekontrolují `isActive`, takže bývalý člen dál čte obsah. [03][07]
7. **Ochrana osobních údajů:**
   - „smazání bez stopy“ uloží do auditu přezdívku i celé jméno;
   - demo login veřejně ukazuje přezdívky a funkce členů;
   - e-mail (přihlašovací identifikátor) není unikátní a profil ho mění bez kontroly. [07]
8. **Perzistence a výkon mocku:**
   - každá změna přepisuje celý dataset v `localStorage`;
   - chyba zápisu (plné úložiště) se tiše spolkne;
   - polling (badge 2 s přes všechny příspěvky a komentáře, notifier 5 s) běží stále a notifier se nezastaví ani po odhlášení. [01][05]

## P2 – chyby a nekonzistence chování

**Akce a docházka [04]**
- Série kopíruje absolutní `responseDeadline` do všech výskytů, takže pozdější výskyty mají uzávěrku hned po termínu.
- Seznam, kalendář a tlačítko „potvrzuji důležitou změnu“ neověřují publikum akce: organizátor mimo cílové skupiny vidí RSVP a banner nesedí s badgem.
- `setStatus` uloží i neuložený koncept poznámky. Platí to i pro rychlou odpověď klikem na součty (necommitnutá změna).
- Přehled docházky ukazuje vynechané termíny série. Organizátor s pověřením jen pro akci se přes odkaz „Přehled docházky“ nedostane přes guard.
- RSVP ani docházka nemají historii změn a organizátor může přepsat odpověď člena i po akci (cíl docs/07 kap. 18–19).
- Časy jsou bez časové zóny a porovnávají se směsicí `Date.parse` a porovnání řetězců.

**Komunikace [05]**
- `updatePost` zahodí `mentionedMemberIds`.
- Surové tokeny `@[member:ID]` se ukazují v perexu nástěnky, v kartě chatu i v hledání; hledání proto nenajde zmíněné jméno.
- Tři různé modely zmínek. Ztlumený chat skryje i zmínky. Režim „Vypnuto“ neplatí pro zmínky v komentářích.
- Archivace se vynucuje nekonzistentně: archivovaný příspěvek jde komentovat a v archivované skupině lze mazat, odebírat a odcházet.

**Kroje [06]**
- Složené akce zápůjčky (kontrola → vrácení/výměna → kontrola) nejsou atomické.
- Kus vyřazený během inventury blokuje její čisté uzavření.
- Kontrola „podle lidí“ neověřuje držitele. `updateWorkOrder` nevaliduje přechody stavů.
- Části services chybí UI: změna termínu vrácení, oprava externisty, správa rezervací krojařkou. Číselníky nejde mazat ani přejmenovat.

**Správa a Přehled [07]**
- Založení skupiny ne-adminem (režim `members`) skončí přesměrováním pryč.
- Ukončení členství smaže pověření bez záznamu v auditu. Externistovi lze přidělit libovolné pověření.
- Přehled: prázdný stav oznámení se nikdy nezobrazí, „Nejbližší akce“ ignorují vypnutý modul a blok „Moje kroje“ z docs/10 chybí.
- Nastavení se ukládá per zařízení, ne per uživatel. Mělký merge konfigurace nedoplní nové vnořené klíče.

## P3 – údržba a kvalita kódu

- **Tři vzory stavu** (modulová cache + signal / signal / BehaviorSubject), dva styly DI a dvě input API. [01]
- **Velké komponenty** (event-form, event-detail, group-admin-panel, manage-person: 440–510 řádků). „Čeká na vás“ se skládá v dashboardu z vnitřních utils modulů, ne přes rozhraní feature services. [01][07]
- **Duplicity:** popisky typů akcí 4×, popisky stavů RSVP 2× s jiným textem, dvojí výpočet počtů odpovědí, `toDateKey` 2×. [04]
- **Mrtvý kód:** `EventCategory`, `requiresAction` (akce i příspěvky), `markRestAbsent`, audit `post-published`, `TargetingEditorComponent`, položky menu v `NavigationService`. [01][04][05]
- **Globální SCSS** ~2 260 řádků vedle inline stylů ve 43 komponentách; historické třídy mapované v `_identity.scss`. [01]
- **Nativní `prompt()`** místo `ConfirmService` (žádost, odebrání člena, řešení úkolu). [05][06][07]
- **Dva pojmy „externista“** (`Member.isExternal` vs. krojový `ExternalPerson`) bez převodu mezi nimi. [02][06]
- **Testy:** 493 zelených, převážně čistá logika a services. Bez testů jsou komponenty (chat, správa skupiny, Správa, Správa krojů), guardy a `CostumesService`, `MandatesService`, `AuditService`, `EnsembleSettingsService`. Chybí e2e, a11y testy i CI. [01]

## Rozpracované (necommitnuté) změny k 2026-10-21

- Detail akce: rychlá odpověď klikem na součty odpovědí (vlastní stav zvýrazněn, zrušení odpovědi s potvrzením), 6 nových testů, styly `status-count--action/--mine` v `_identity.scss`. [04][01]
