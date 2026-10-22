# 01 – Architektura a průřezová infrastruktura

> Popis **skutečného stavu kódu** (větev `design/identity-03` vč. necommitnutých změn, 2026-10-21). Doménové modely a pověření → 02, akce/docházka → 04, příspěvky/nástěnky/skupiny/chat/hledání → 05, kroje → 06, Správa/členové/profil/nastavení/přehled → 07.

## 1. Shrnutí v kostce

- **Frontend-only SPA/PWA** v Angular 19 (standalone komponenty, žádné NgModules), čeština jako jediný jazyk UI.
- **Žádný backend.** Všechna data jsou mock data v TS souborech; změny se ukládají do `localStorage` prohlížeče (per-zařízení, per-prohlížeč). Každý uživatel vidí jen své změny („Demo verze“ banner).
- Cílový backend (dle docs/01): PHP 8.5 REST API + MySQL/MariaDB na sdíleném hostingu, bez WebSocketu, polling. Zatím **žádná HTTP vrstva pro doménová data** – `HttpClient` se používá jen pro statické `build-info.json` a `changelog.json`.
- Produkce: `https://moje.vonica.cz` (statické soubory přes SFTP, Apache `.htaccess`, volitelně Basic Auth na celý web).
- Rozsah kódu: ~19 100 řádků TS (bez speců), 73 spec souborů / 493 testů (všechny zelené), ~3 500 řádků globálního SCSS.

## 2. Stack a verze

| Oblast | Stav |
|---|---|
| Framework | Angular `^19.2` (core, common, router, forms, platform-browser, service-worker), `zone.js ~0.15` (zoneful, `provideZoneChangeDetection({ eventCoalescing: true })`) |
| Jazyk | TypeScript `~5.7`, RxJS `~7.8` |
| Builder | `@angular-devkit/build-angular:application` (esbuild), Karma builder pro testy |
| Testy | Karma 6 + Jasmine 5 + ChromeHeadless, karma-coverage |
| UI knihovny | **žádné** (žádný Material/CDK/Tailwind/ikonové fonty). Vlastní ikony, vlastní dialog, vlastní formulářové styly. |
| Kořenový `package.json` | jen skripty + devDependency `ssh2-sftp-client` (deploy). Verze `2026.10.5` (zapisuje `release.mjs`). |
| Node pro Docker | `node:20-alpine` (build stage) |

### angular.json – podstatné
- Výchozí konfigurace buildu `production`; serve výchozí `development`.
- Schematics: SCSS, `skipTests: true` pro všechny generátory (testy se píší ručně).
- **Budgets (production):** initial 500 kB warn / 1 MB error; `anyComponentStyle` 4 kB warn / 8 kB error.
- `production`: `outputHashing: all`, `serviceWorker: ngsw-config.json`.
- **`demo` konfigurace** (build, serve i test): `fileReplacements` `features/members/data/mock-members.ts` → `mock-members.local.ts` (generovaný z reálného seznamu členů, git-ignored, maskovaná příjmení). Kombinuje se: `production,demo`, serve `development,demo`.
- Assets: celý `frontend/public/` (vč. `.htaccess`, `manifest.webmanifest`, `icons/`, `identity/`, generovaných `build-info.json` a `changelog.json`).

### Service worker (`ngsw-config.json`)
- `app` asset group: `prefetch` – `index.html`, `index.csr.html`, manifest, `/*.css`, `/*.js`, favicon.
- `assets` group: `lazy` install / `prefetch` update – obrázky a fonty.
- Žádné `dataGroups` (není API k cachování). Registrace `registerWhenStable:30000`, jen mimo dev mód.

## 3. Struktura repozitáře

```
/                      kořen – npm skripty, Dockerfile, docker-compose.yml, .env(.example), CLAUDE.md, LICENSE
├─ frontend/           Angular aplikace (vlastní package.json, angular.json, ngsw-config.json)
│  ├─ public/          statické soubory (.htaccess, manifest, ikony PWA, identity/ loga + ornament masky)
│  └─ src/
│     ├─ main.ts, index.html (lang="cs", theme-color light/dark, manifest crossorigin=use-credentials)
│     ├─ styles.scss + styles/ (_variables, _reset, _form-ui, _chat, _identity)
│     └─ app/  core/ · shared/ · features/ · testing/
├─ scripts/            Node .mjs skripty (build, release, deploy, import členů, ikony)
├─ docs/               schválená CÍLOVÁ specifikace (00–10), ne popis implementace
├─ dev/                dev/local/ (git-ignored: reálný seznam členů TSV), dev/docs/ (tato dokumentace)
├─ identity/           zdrojové podklady vizuální identity (výšivkové mřížky 16×16 a 12×12, logo SVG, náhledy, generátor)
├─ data/release-dances.json   seznam lidových tanců (url, title, codename, slug) pro kódová jména verzí
└─ public/changelog.json      zdrojový changelog (kopíruje se do frontend/public)
```

- `.claude/skills/deploy` – versionovaný projektový skill pro nasazení (obal kolem `deploy.mjs`).
- Docker (`Dockerfile`, `docker-compose.yml`) je **jen lokální napodobenina produkce**: build stage (node) → `php:8.5-apache` s `mod_rewrite`, `mod_headers`, `pdo_mysql`; compose přidává `mariadb:11.4` (port 3307) a `adminer` (8081). Aplikace na 8080. PHP ani DB zatím nic nepoužívá.

## 4. Skripty (`scripts/`) a verzování

| Skript (npm) | Co dělá |
|---|---|
| `sync-public.mjs` (`sync-public`) | Kopíruje `public/changelog.json` → `frontend/public/changelog.json`. |
| `build-info.mjs` (`build-info`) | Z gitu sestaví `frontend/public/build-info.json`: `{ version, tag, dance, branch, commit, dirty, builtAt }`. Release tag hledá na HEAD (`vRRRR.M.N-<slug>`), tanec dohledá v changelogu. `--branch` override pro detached worktree. |
| `build.mjs` (`build`, `frontend:build[:demo]`) | sync-public → (demo: import-members) → build-info → `ng build -c production[,demo]` → vloží `<meta name="app-version|app-revision|app-built-at">` do `index.html` → **přegeneruje `ngsw.json`** (`ngsw-config`), protože se změnil hash index.html. |
| `import-members.mjs` (`members:import`) | `dev/local/clenove.tsv` → `mock-members.local.ts` (+ `MOCK_ENSEMBLE_ADMIN_IDS`). Sloupce: jméno, příjmení, nickname, datum přidání, administrátor, externista, (bývalý), sloupce skupin (výbor…sklad → group id 1–7). Příjmení maskuje na `X*****`. Kontroluje unikátnost přezdívek (bez diakritiky/velikosti). |
| `release.mjs` (`release -- [--dry-run] "změna" …`) | Spočítá další verzi `vRRRR.M.N` (N od 0 v každém měsíci), přidělí první nepoužitý tanec z `data/release-dances.json`, předřadí záznam do `public/changelog.json`, zapíše verzi do kořenového `package.json`, commit `chore: release vX codename` + tag `vX-slug`. (Verzování spouští výhradně vlastník.) |
| `deploy.mjs` (`deploy`) | Build + upload přes SFTP, viz níže. |
| `generate-stitch-icons.mjs` (`icons:generate`) | Z `identity/identity-02-12x12/ikony-12x12.json` (mřížka 12×12 znaků `.`/`X`/`R`) generuje `shared/icon/stitch-icons.data.ts` a ornamentové masky `frontend/public/identity/ornaments/*.svg`. |
| `lib/apr1.mjs` | APR1-MD5 hash pro `.htpasswd` (ekvivalent `openssl passwd -apr1`). |

Ostatní npm skripty: `frontend:start` (build-info + `ng serve`), `frontend:start:demo` (import členů + serve s `demo`).

### Verze v UI
- `versionLabel(info)`: release bez dirty → **kódové jméno tance** (např. „boršická“); tag bez tance → tag; jinak `branch@commit` (+`*` při dirty); bez `build-info.json` → „vývojová verze“.
- `VersionLabelComponent` vede na `/app/changelog` (ChangelogService čte `changelog.json`).

### Deploy flow (`deploy.mjs`)
- Konfigurace z kořenového `.env` (SFTP host/port/user/password/remote dir, `SITE_URL`, `SITE_ROOT_PATH`, `BASIC_AUTH_USER/PASSWORD`).
- Zdroj: `--source working` (default, pracovní kopie vč. necommitnutých změn → revize `+dirty`), `commit` (HEAD v čistém dočasném `git worktree`), `tag` (poslední `v*` na master), `--ref <tag|prefix|branch|commit>`. Worktree si symlinkuje `frontend/node_modules`.
- `--demo` (reální členové) **odmítne deploy bez Basic Auth**. `--dry-run`, `--yes`, `--status` (jen přečte meta tagy z produkčního index.html).
- Pořadí uploadu: (1) nejdřív `.htpasswd` + `.htaccess` (Basic Auth hlavička předřazená aplikačnímu `.htaccess`), (2) změněné soubory – hashované `*-XXXXXXXX.js|css` již přítomné se přeskočí, `ngsw.json` a `index.html` **až nakonec**, (3) smazání zastaralých souborů/adresářů (kromě `.htaccess`/`.htpasswd`).
- Ověření: bez hesla musí vrátit 401 (je-li Basic Auth), s heslem musí `index.html` hlásit očekávanou `app-revision`.
- Aplikační `.htaccess`: SPA fallback na `index.html`, `Cache-Control: no-cache` pro index/ngsw/manifest/build-info/changelog, `X-Robots-Tag: noindex`, zákaz čtení `.ht*`.

## 5. Bootstrap a kořen aplikace

- `main.ts`: `bootstrapApplication(AppComponent, appConfig)`.
- `app.config.ts` providers: `provideZoneChangeDetection({eventCoalescing})`, `provideRouter(routes)` (bez features jako `withComponentInputBinding`/preloading), `provideHttpClient(withFetch())`, `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`. Žádné interceptory, žádné `APP_INITIALIZER`, žádné DI tokeny.
- `AppComponent`: šablona `<app-update-banner /><router-outlet /><app-confirm-dialog />`; v konstruktoru injektuje `SettingsService`, aby se při startu aplikovalo téma/písmo/animace.

## 6. Routing

Všechny stránky jsou **lazy `loadComponent`** (žádné lazy route soubory). Guardy jsou funkcionální `CanActivateFn`. Žádné resolvery, žádná `data` na routách, žádné titulky (`title`).

| Cesta | Komponenta | Guard |
|---|---|---|
| `/login` | LoginComponent | – |
| `/app` | MainLayoutComponent (shell) | `authGuard` |
| `/app/dashboard` | Dashboard | – |
| `/app/boards` | BoardsComponent (rozcestník Skupiny) | – |
| `/app/boards/:slug` | GroupSpaceComponent (záložky nástěnka/chat/akce/členové) | – (přístup řeší komponenta) |
| `/app/boards/:slug/new` | PostForm | `boardGuard` |
| `/app/posts/:id`, `/app/posts/:id/edit` | PostDetail, PostForm | – |
| `/app/events` | Events (seznam/kalendář) | `moduleGuard('events')` |
| `/app/events/new` | EventForm | `eventCreateGuard` |
| `/app/events/:id`, `/:id/edit` | EventDetail, EventForm | `moduleGuard('events')` (edit oprávnění řeší komponenta/služba) |
| `/app/attendance` | AttendanceReport | `attendanceGuard` |
| `/app/search`, `/app/more`, `/app/settings`, `/app/changelog`, `/app/profile` | … | – |
| `/app/groups/new` | ManageGroupComponent (zakládání mimo Správu) | `groupCreateGuard` |
| `/app/costumes` | MyCostumesPage („Moje kroje“) | `moduleGuard('costumes')` |
| `/app/wardrobe` → `wardrobe/stock` | redirect | – |
| `/app/wardrobe/{stock, stock/:id, cards, cards/:key, loans, inventories, inventories/:id, inventories/:id/visit/:key, inventories/:id/stock/:seriesId, settings}` | Správa krojů – čtení | `costumeStockGuard` |
| `/app/wardrobe/{stock/new, stock/:id/edit, loans/new, inventories/new}` | Správa krojů – zápis | `costumeManagerGuard` |
| `/app/admin/**` | redirect → `manage` (legacy) | – |
| `/app/manage` (+ children `members`, `members/new`, `members/:id`, `groups`, `groups/new`, `groups/:id`, `config`, `history`; `''` → `members`) | ManageLayout + podstránky | `ensembleAdminGuard` (jen na rodiči) |
| `/app` → `dashboard`; `''` → `/app/dashboard`; `**` → `/login` | redirecty | |

### Guardy
- `authGuard` – `AuthService.isLoggedIn()`; jinak `/login?returnUrl=<url>` (login komponenta returnUrl sanitizuje funkcí `safeReturnUrl`).
- `core/access/access.guards.ts` – fabrika `accessGuard(predicate)` nad `AccessService`, při zamítnutí redirect na `/app/dashboard`. Komentář výslovně: **„Jen pohodlí UI, ne bezpečnost.“**
  - `ensembleAdminGuard` = pověření Správa souboru; `attendanceGuard` = modul events + Evidence docházky; `eventCreateGuard` = modul events + Organizace akcí; `moduleGuard(m)` = modul zapnutý v nastavení souboru; `groupCreateGuard` = `canCreateGroup` (dle politiky `groupCreation`).
- `boardGuard` (features/boards) – async (Observable): skupina dle slug existuje, `canPostInGroup` a uživatel je členem; jinak `/app/boards`.
- `costumeStockGuard` – modul costumes + (Správa krojů | Náhled do správy krojů); jinak `/app/costumes`. `costumeManagerGuard` – modul costumes + Správa krojů; jinak `/app/wardrobe`.
- Neexistuje `leaderGuard` ani guard na `posts/:id/edit` / `events/:id/edit` – kontrola je v komponentě/službě.

## 7. `core/`

### 7.1 Auth (`core/auth`)
```ts
interface User { id: number /* = Member.userId */; name: string /* nickname */; email: string }
```
- `AuthService` (signals): `currentUser` (readonly signal), `isLoggedIn` (computed). Persistuje do `localStorage['splk.auth.user']` (mimo demo prefix → reset demo dat ho nesmaže).
- **Mock login:** `login(email, password)` – heslo se nekontroluje (jen neprázdné), hledá aktivního člena podle e-mailu. `loginAsMember(id)` – rychlé přihlášení z demo seznamu (`getDemoMembers()` = aktivní členové seřazení dle přezdívky, `localeCompare 'cs'`). `refreshFromMember()` po úpravě vlastního profilu. `logout()`.
- User nese jen identitu; členství/pověření se čtou **živě** přes `AccessService` (změna ve Správě platí okamžitě).

### 7.2 Access (`core/access`) – podrobně v 02
- `access.utils.ts` (čisté funkce: `toAccessSubject`, `isEnsembleAdmin`, `canManageCostumes`, `isGroupMember`, `canPostInGroup`, `isEventAudience`…), `mandate-rules.ts`.
- `AccessService`: computed signály nad `AuthService` + `MembersService` + `MandatesService` + `GroupsService` + `EnsembleSettingsService` (`currentMember`, `subject`, `memberId`, `isEnsembleAdmin`, `canManageCostumes`, `canViewCostumeStock`, `canViewAttendanceReport`, `canCreateEvents`, `canCreateGroup`, `modules`, `myGroups`, `managedGroups`), `can(check, ...args)`.

### 7.3 Build info (`core/build`)
- `BuildInfo` typ + `versionLabel()`; `BuildInfoService` – `HttpClient.get('build-info.json')`, `catchError → null`, `shareReplay(1)`.

### 7.4 Data (`core/data`)
- `demo-storage.ts` – **jediný perzistenční mechanismus**:
  - klíče `splk.demo.<name>`, verze schématu `DEMO_DATA_VERSION = 9` v `splk.demo.version`; při neshodě se smažou všechna demo data a vrátí se seed.
  - `loadDemoData<T>(name, seed)`, `saveDemoData(name, value)` (celý dataset jako jeden JSON), `clearDemoData()`; vše v try/catch → bez úložiště běží jen v paměti.
  - Použité datasety: `members, groups, mandates, posts, comments, chat-messages, chat-read, event-chat, events, attendance, actual-attendance, costumes, join-requests, audit, unavailability, ensemble-settings, group-notify`.
- `mock-groups.ts` – 7 výchozích skupin (Výbor, Taneční, Muzika, Kluci, Holky, Malá Vonica, Krojařky) + `GROUP_IDS`. Malá Vonica má chat vypnutý.

### 7.5 Layout (`core/layout`)
- `MainLayoutComponent` – shell: `app-sidebar` (desktop), mobilní hlavička (logo, Hledat, menu ⋮: profil, Všechna místa, Nastavení, verze, Odhlásit), `<main>` s `app-demo-banner` + `router-outlet`, `app-bottom-nav` (mobil). Zavírá menu na `NavigationStart`/Escape/klik mimo. V `ngOnInit` načte členy, spustí **hlídání nových zmínek** (diff množiny neviděných zmínek → `NotificationService.notify`) a `ActivityNotifierService.start()`.
- Přepínání mobil/desktop **čistě CSS** na breakpointu **768 px** (sidebar `display:none` < 768, bottom-nav a mobilní hlavička `display:none` ≥ 768). Obě navigace jsou v DOM vždy.
- `NavigationService` – jediný zdroj menu pro sidebar, spodní lištu, stránku Více a „Moje místa“ na Přehledu:
  - `places` (computed): Akce, skupiny kde je členem (s nástěnkou nebo chatem, nearchivované), hub „Skupiny“, Docházka, Moje kroje, Správa krojů, Správa, Hledat – podle modulů a pověření.
  - Badge: skupina = nepřečtené příspěvky + neviděné zmínky (nástěnka) + nepřečtené zprávy chatu (ztlumený chat se nepočítá); hub Skupiny = součet + čekající žádosti/pozvánky; Akce = počet akcí čekajících na odpověď.
  - `start()/stop()` s ref-countem: odběr `EventsService.getEvents()` + **polling nástěnkových badge každé 2 s** (`BoardsService.getBoardBadges()` = forkJoin boards+posts+comments).
  - `bottomItems`, `sections` (sidebar), `orderedPlaces`, `resolvedBar`.
- `bottom-bar.ts` (čisté funkce): Přehled pevně + max. 4 pozice; při > 4 vybraných 3 + „Více“. `defaultBarKeys` automatický návrh (Akce → skupiny → agendy se zápisem → Moje kroje (jen s výpůjčkou) → ostatní; při přetečení skupiny sloučí do hubu). `resolveBar`, `orderPlaces`, `moveKey`. Uživatelská volba v `AppSettings.bottomBar`.
- `sidebar-menu.ts` (čisté funkce): sekce `main` / `groups` „Moje skupiny“ / `agendas` „Agendy“ / `ensemble` „Soubor“; řadit a skrývat (pod „Další“) lze jen v groups a agendas; nedostupné uložené klíče se ignorují, ale ponechají.
- `SidebarComponent` – sekce, skryté položky rozbalitelné, sbalený režim na ikony (`sidebarCompact`, tooltip s `position: fixed`), patička se jménem → profil, verze, odhlášení. `BottomNavComponent` – `bottomItems`.
- `DemoBannerComponent` – „Demo verze – změny vidíš jen ty v tomto prohlížeči“ + „Obnovit demo data“ (ConfirmService → `DemoDataService.reset()`).
- `UpdateBannerComponent` – při `AppUpdateService.updateReady()` nabídne „Obnovit“.

### 7.6 Notifikace (`core/notifications`) – pravidla skupin podrobně v 05
- `NotificationService` – obal Web Notifications API: `permission` signal, `requestPermission()`, `notify(title, body)` přes `ServiceWorkerRegistration.showNotification` (fallback `new Notification`). Jen když je aplikace otevřená – **žádný push**.
- `group-notifications.ts` – `GroupNotifyMode = 'all' | 'mentions' | 'muted' | 'off'`, `shouldNotify(activity, viewerId, canRead, mode)`, `isChatSilenced`.
- `GroupNotificationsService` – předvolby `memberId:groupId → mode` (signal, demo storage `group-notify`, default `all`).
- `ActivityNotifierService` – během běhu aplikace: `effect` nad `ChatService.messages()`, **polling příspěvků každých 5 s**, odběr `comments$`. Prvním průchodem si „naučí“ existující id (neupozorňuje na staré), pak hlásí nové položky dle `shouldNotify` a čitelnosti skupiny (archivovaná skupina mlčí). Zmínky v komentářích přeskakuje (hlásí MainLayout). Text upozornění neobsahuje obsah zprávy.

### 7.7 Services (`core/services`)
- `AppUpdateService` – `SwUpdate.versionUpdates` → `VERSION_READY` → `updateReady` signal; `checkForUpdate()` každých 15 min a při návratu do viditelného okna; `applyUpdate()` = `activateUpdate()` + reload.
- `DemoDataService.reset()` – `clearDemoData()` + `window.location.reload()` (přihlášení a nastavení zůstávají).

### 7.8 Settings (`core/settings`) – UI v 07
```ts
interface AppSettings {
  theme: 'light'|'dark'|'auto'; fontSize: 'normal'|'larger'|'largest'; eventsView: 'list'|'calendar';
  reduceMotion: boolean|null /* null = dle systému */; bottomBar: string[]|null; sidebarMenu: SidebarMenuConfig|null;
  sidebarCompact: boolean; calendarExport: { types: string[]; skippedAsNotice: boolean }|null;
}
```
- `localStorage['splk.settings']` (per zařízení, reset demo dat ho nemaže). Signal + `effect` zapisuje na `<html>` atributy `data-theme`, `data-font-size`, `data-reduce-motion`; sleduje `prefers-color-scheme` a `prefers-reduced-motion`.
- Pozn.: nastavení souboru (moduly, politika zakládání skupin, výchozí hodnoty nových skupin, seskupování komentářů v chatu) je zvlášť – `EnsembleSettingsService` (features/ensemble, demo storage).

### 7.9 Utils (`core/utils`)
- `member.utils` – `getFullName` (plné jméno jen pro Správu, jinde přezdívka), `memberToUser`, `nicknameKey` (normalizace bez diakritiky).
- `visibility.utils` – `hasBoard`/`hasChat` (default true), `getBoardBadgeCount`, `getUnconfirmedEventsCount`, `getNewCommentsCount`, `getUnseenMentionsCount` (část s parametry `any[]`).
- `download.utils` – `downloadTextFile` (Blob + dočasný `<a download>`).

### 7.10 Modely (`core/models`)
`member`, `group`, `mandate`, `ensemble-settings` – sdílené modely jádra (detail v 02). Feature-specifické modely jsou ve `features/*/models`.

## 8. `shared/`

| Prvek | Popis |
|---|---|
| `avatar` | `app-avatar` (signal inputs `name`, `memberId`, `avatar`, `size`): vlastní ikona na zvolené barvě, jinak iniciály; `AVATAR_COLORS` (8), `AVATAR_ICONS` (14), `defaultAvatarColor(id)`. |
| `dialog` | `ConfirmService.confirm(opts): Promise<boolean>` (signal s jedním požadavkem, nový nahradí starý jako zrušený) + `ConfirmDialogComponent` vykreslený jednou v `AppComponent`; volba `danger`. Nahrazuje `window.confirm`. |
| `export` | `toCsv` / `downloadCsv` (středník + BOM kvůli Excelu), `printPage()` (`window.print`, `.no-print` + `@media print`), `formatDate`. |
| `icon` | `app-icon` (`name: IconName`, `size` default 20) – **křížkové (cross-stitch) SVG ikony** z mřížky 12×12; nit 1 = `currentColor`, nit 2 = `--stitch-accent` (červená). 48 názvů ikon; `GROUP_ICON_OPTIONS`. `stitch-icons.data.ts` generuje skript. |
| `logo` | `app-logo` (`variant: 'full'|'mark'`, `height`) – obě barevné varianty v DOM, CSS dle `data-theme` zobrazí čitelnou. |
| `mention-input` | Textarea s našeptávačem `@` (členové) a `#` (akce, jen viditelné autorovi), klávesnice ↑↓/Enter/Tab/Esc, převod čitelného textu na tokeny při odeslání; režim bez tlačítka s `valueChange`; `sendOnEnter` pro chat. Bez `contenteditable`/`innerHTML`. |
| `pipes` | `relativeTime` (impure) – „právě teď“, „před 5 min“, „před 3 h“, „před 2 d“, měsíce, roky (české tvary). |
| `rich-text` | Vykreslí tokenizovaný text: `@zmínka` zvýrazněná, `#akce` jako odkaz (nečitelná akce → jen „akce“). Bez `innerHTML` → bez XSS. |
| `targeting` | `app-targeting-editor` – výběr cílových skupin (checkboxy); cílení na jednotlivce záměrně není. Používá starší `@Input/@Output` API. |
| `ui/form-ui` | `errorMessage(err)`, `ActionFeedback` (signály `error`/`success`/`busy`, `run(observable, done, successText)` s 2,5 s potvrzením). Styly `cs-*` globálně v `_form-ui.scss`. |
| `version-label` | Odkaz s `versionLabel()` na `/app/changelog`. |

## 9. Features – přehled (detail v 02–07)

`attendance` (plánovaná účast + skutečná docházka, report), `audit` (historie změn), `availability` (nedostupnost člena), `boards` (rozcestník skupin, badge), `changelog`, `chat` (skupinový chat), `costumes` (Moje kroje + Správa krojů: fond, karty, zápůjčky, inventury), `dashboard` (+ `pending-actions`), `ensemble` (nastavení souboru), `events` (+ event-chat, série, kalendář, ICS export), `groups` (prostor skupiny, členství, žádosti/pozvánky, správa skupiny), `login`, `manage` (Správa: členové, skupiny, konfigurace, historie, mazání osoby), `mandates` (pověření), `members`, `more`, `posts` (+ komentáře, zmínky), `profile`, `search`, `settings`.

Konvence uvnitř feature: `*.service.ts`, `data/mock-*.ts` (seed), `models/`, `utils/` (čisté funkce, typicky s vlastním specem), komponenty v podsložkách.

## 10. Vzor správy stavu a „zaměnitelnost“ mock/HTTP

### Skutečný stav
- **Neexistuje abstrakce** (žádné abstraktní třídy, `InjectionToken`, rozhraní repozitářů, `useClass` přepínání). Každá feature služba je **konkrétní mock implementace** `@Injectable({ providedIn: 'root' })`, která drží data sama.
- Zaměnitelnost je jen na úrovni **tvaru API**: veřejné metody většinou vracejí `Observable<T>` s umělým `delay(300)` (47 výskytů), aby komponenty počítaly s asynchronností. Přechod na HTTP = přepsat tělo služeb; komponenty volají jen služby (pravidlo z CLAUDE.md dodržováno – žádný `HttpClient` ani `localStorage` v komponentách).
- Tři styly držení stavu vedle sebe:
  1. **Modulová proměnná + signal** (`let xCache = loadDemoData(...)` na úrovni souboru, `signal` ve službě, `commit(next)` = cache + signal + save): Members, Groups, Mandates, JoinRequests, Audit, Posts (bez signálu, jen cache).
  2. **Signal ve službě**: Chat, EventChat, Availability, EnsembleSettings, GroupNotifications, Settings, Auth.
  3. **BehaviorSubject** + `subscribe(save)`: Events, Attendance, ActualAttendance, Comments, CostumeStore.
- Synchronní čtení přes signály (`members()`, `groups()`, `mandates()`) je nutné pro `AccessService` (computed) a guardy; asynchronní `get*()` Observables pro komponenty.
- **Validace a pravidla v mock službách**: zápisové metody kontrolují pověření a doménová pravidla a vracejí `throwError` (např. CostumesService ~31, Inventory ~23, Membership ~21 výskytů `throw`/`throwError`). Tj. „serverová“ logika dnes žije ve frontend službách.
- **Křížové závislosti služeb** (zdroje pravdy): `MembershipService` závisí na 9 službách, `PersonDeletionService` na 15 (projde všechny datasety, zda osoba nemá stopu). `CostumeStoreService` je sdílený stav pro `CostumesService` a `InventoryService`. `EventsService` spojuje akce s `AttendanceService` (účast se do `events` neukládá, mapuje se zvlášť).
- **Synchronizace mezi záložkami**: jen `ChatService` a `CommentsService` poslouchají `window 'storage'` event; ostatní data se mezi záložkami nesynchronizují.
- **Polling** (simulace budoucího backendu): navigační badge 2 s, ActivityNotifier 5 s (příspěvky), group-chat komponenta periodicky načítá příspěvky (`interval`), AppUpdate 15 min.

### Persistence a reset
- `splk.demo.*` (data, verzováno `DEMO_DATA_VERSION`) – maže „Obnovit demo data“ i změna verze.
- `splk.auth.user`, `splk.settings` – přežijí reset.
- Datasety se ukládají vždy celé (přepis JSON při každé změně).

## 11. Styling a identita

- **Globální SCSS** (`styles.scss` ~2 260 ř. + partials) + inline `styles` v 43 komponentách (žádné `styleUrl`). `WARDROBE_STYLES` – sdílený řetězec stylů pro stránky krojů.
- `_variables.scss`: CSS custom properties na `:root` – barvy (primární folklorní červená `#c73732`, lněné povrchy, status palety ok/warn/danger/neutral/info), radius, spacing, rozměry layoutu (sidebar 240/68 px, bottom-nav a header 56 px), písma (UI `system-ui`, nadpisy patkové `Iowan Old Style`/Palatino/Georgia – žádné webfonty).
- **Tmavý režim**: `:root[data-theme='dark']` přepisuje tokeny; `data-font-size='larger'|'largest'` zvětší škálu; `data-reduce-motion='true'` vypne animace/přechody. `index.html` má `theme-color` pro light/dark.
- `_identity.scss` (načten `meta.load-css` na konci): logo světlé/tmavé, bordura pod logem v sidebaru, křížkové ornamenty jako CSS masky (`/identity/ornaments/*.svg`, barva přes `background` → funguje v obou tématech), pravidla intenzity dekorace (výrazná: hlavička, navigace, titulky; jemná: chipy, karty, hlavní tlačítka; žádná: formuláře, tabulky, chat, inventury), sjednocené chipy/badge (24 px), 4 druhy tlačítek (+ mapování historických tříd `cs-btn`, `toolbar__btn`, `attendance-btn`, `btn-demo`), `view-toggle`, `rsvp-btn`, `:focus-visible`, formulářová pole přes `:where()` (nulová specifičnost), `.sr-only`.
- **Necommitnutá změna (WIP)**: `.status-count--action` (součet účasti jako tlačítko rychlé odpovědi v detailu akce) a `.status-count--mine` (inverzní barvy pro vlastní stav) – souvisí se změnami v `event-detail` (viz 04).
- Responsivita: mobile-first, jediný hlavní breakpoint 768 px (+ lokální 420/479 px), `@media print` skrývá navigaci.
- `identity/` – zdrojové podklady (16×16 a 12×12 výšivkové sady, logo, „vyšívací dílna“ HTML náhledy); do aplikace se dostávají jen přes generátor ikon a ručně kopírované soubory v `frontend/public/identity/`.

## 12. PWA, i18n, přístupnost

- **PWA**: `manifest.webmanifest` (`display: standalone`, theme/background `#fef7e7`, ikony 72–512 px `maskable any`; name je generické „Folklorní soubor“/„Soubor“), manifest načítán s `crossorigin="use-credentials"` kvůli Basic Auth. Service worker jen v produkčním buildu. Update flow: SW stáhne novou verzi → banner „Je dostupná nová verze“ → `activateUpdate` + reload. Build přegeneruje `ngsw.json` po vložení meta tagů; deploy nahrává `ngsw.json`/`index.html` poslední; `.htaccess` zakazuje cache těchto souborů.
- Offline: SW cachuje shell; data jsou stejně lokální (localStorage). Cílová offline politika (IndexedDB, ETag, zákaz zápisů offline) dle docs/01 není implementována.
- **i18n**: jen čeština, texty natvrdo v šablonách/TS (žádné `$localize`, žádný i18n framework), `<html lang="cs">`, řazení `localeCompare(…, 'cs')`.
- **Přístupnost** (viditelné v kódu): ARIA atributy hojně (≈ 90 výskytů `aria-*`, ≈ 60 `role=`), menu s `aria-expanded/haspopup/controls`, `role="menu|menuitem|listbox|option|status|note"`, `.sr-only`, viditelný `:focus-visible`, volby velikosti písma a omezení animací, ikony se `title`/`aria-label`. Neexistují automatizované a11y testy.

## 13. Testování

- Spuštění: `npm --prefix frontend test` (Karma, watch) nebo `npx ng test --watch=false --browsers=ChromeHeadless` ve `frontend/`. Poslední běh: **493 testů, 0 selhání**.
- 73 spec souborů: core 18 (auth, guard, access utils, mandate-rules, build-info, demo-storage, layout/navigace/sidebar/bottom-bar, notifikace, app-update, demo-data, settings, utils), shared 7, features: events 11, posts 8, groups 4, attendance 3, chat 3, costumes 3 (logika: costume-logic, inventory-logic, inventory.service), dashboard 2, boards 2, manage 2, members 2, ostatní po 1. Bez specu: `ensemble`, `mandates` (služby), `more`, `audit.service`, `costumes.service`, většina wardrobe komponent.
- Zaměření: čisté funkce (`utils/*`) a služby; komponentní testy jen u klíčových stránek (login, dashboard, posts, event-detail, profile, settings, layout).
- `testing/global-setup.spec.ts` – globální `beforeEach`: smaže demo storage, auth a settings, resetuje modulové cache (`resetCache()` na Members/Mandates/JoinRequests/Audit/Groups, `resetPostsCache()`). `testing/access.testing.ts` – továrny `testMember`, `testMandate` a nastavení přístupového kontextu pro testy.
- Žádné e2e testy, žádné CI konfigurace v repu.

## Pozorování a technický dluh

- **Bez abstrakce datové vrstvy.** CLAUDE.md požaduje zaměnitelné mock/HTTP implementace, ale není žádný token/rozhraní; mock služby jsou zároveň „backend“ (validace pověření, doménová pravidla, audit, kaskády). Přechod na PHP API znamená přepsat ~20 služeb a přesunout jejich pravidla na server; frontendová kontrola zůstane jen jako UX.
- **Veškeré vynucení oprávnění je frontendové.** Guardy jsou deklarovaně „jen pohodlí UI“; `posts/:id/edit`, `events/:id/edit` a `boards/:slug` nemají guard (řeší komponenta). Login nekontroluje heslo. Bezpečnost produkce dnes stojí jen na Basic Auth celého webu.
- **Tři různé vzory stavu** (modulová `let` cache + signal / signal / BehaviorSubject) a dva styly DI (`constructor` vs `inject()`), staré i nové input API (`@Input` vs `input()`). Modulové cache vyžadují ruční `resetCache()` v testech a žijí mimo DI (nejde je izolovat pro více instancí/kontextů).
- **Monolitická perzistence**: každá změna přepisuje celý dataset do `localStorage` (limit ~5 MB, synchronní JSON.stringify). Při reálném objemu (chat, audit) hrozí zaplnění – `saveDemoData` chybu tiše spolkne a změna se po reloadu ztratí bez upozornění uživatele.
- **Synchronizace mezi záložkami nejednotná** – jen chat a komentáře reagují na `storage` event; akce, účast, kroje, členové se v jiné záložce neaktualizují.
- **Polling bez backendu**: navigační badge každé 2 s dělají `forkJoin` nad všemi příspěvky a komentáři (plus `delay(300)`), ActivityNotifier každých 5 s znovu stahuje všechny příspěvky. `NavigationService.start()` volá sidebar i bottom-nav, které jsou v DOM vždy (skryté jen CSS) – ref-count to zvládne, ale polling běží neustále. S HTTP backendem by to bylo nákladné; cíl dle docs/01 je ETag/304 snapshoty.
- **Životní cyklus notifikací**: `ActivityNotifierService` se nikde nezastavuje (`stop()` není volán, `started` zůstává `true`, `effect` bez cleanupu) – po odhlášení a přihlášení jiného uživatele ve stejném běhu pokračuje původní instance; hlídání zmínek v MainLayout pracuje se snapshotem členů z času přihlášení. Upozornění fungují jen při otevřené aplikaci (žádný push).
- **Mrtvý kód v NavigationService**: `mainItems`, `moduleItems`, `manageItems`, `groupItems` používají jen specy, ne šablony. Komentář v `BottomNavComponent` („lišta se dá posouvat prstem“) odporuje implementaci (lišta se neposouvá, přetečení jde pod „Více“).
- **`visibility.utils` s `any[]`** – badge funkce bez typů; snadno se rozejdou s modely.
- **Globální CSS ~2 260 řádků** v jednom `styles.scss` + 43 komponent s inline styly + historické třídy mapované v `_identity.scss` (`cs-btn`, `toolbar__btn`, `btn-demo`…) – rostoucí riziko kolizí; budget `anyComponentStyle` 4/8 kB tlačí styly do globálu.
- **Přihlášený neaktivní člen** zůstane přihlášen (uložený `User` se při startu neověřuje proti `isActive`); `AccessService` mu jen vynuluje skupiny a pověření.
- **Velké komponenty**: event-form (~510 ř.), event-detail (~500), group-admin-panel (~480), manage-person (~440) – kandidáti na rozdělení.
- **Mezery v testech**: `EnsembleSettingsService`, `MandatesService`, `AuditService`, `CostumesService` (31 pravidel) a většina wardrobe komponent nemají vlastní spec; žádné e2e/a11y testy, žádné CI.
- **Demo build s reálnými členy** se spoléhá na maskování příjmení a Basic Auth; import z TSV e-maily nepřenáší, takže v demo buildu funguje jen rychlé přihlášení výběrem člena (login e-mailem jen u fiktivních mock členů).
- **Manifest PWA** má generický název („Folklorní soubor“) na rozdíl od `<title>` „Vonica – folklorní soubor“ a identity v UI.
- **Docker/MariaDB připraveno, ale nevyužito** – žádné PHP soubory, migrace ani API kontrakt v repu; budoucí API tvar je implicitní v signaturách mock služeb.
