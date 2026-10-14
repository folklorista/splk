# Postup vývoje

## Aktuální stav (2026-10-15)

Hotovo:

- **Fáze 1 (Angular shell)** – kompletní.
- **Fáze 2 (mock modely a API services)** – kompletní, včetně feature services pro všechny níže uvedené moduly.
- **Fáze 3 (klikací prototyp)** – obrazovky Login, Dashboard, Nástěnka + detail, Akce + detail s potvrzením účasti, Skupiny, hrubý placeholder Krojové databáze (stránka Členové byla později zrušena, viz Nástěnky po skupinách) jsou hotové a proklikatelné s mock daty.
- Navíc oproti původnímu plánu: rozpracovaná administrace (CRUD obrazovky pro příspěvky, akce, členy a skupiny) – nad rámec Fáze 3, ale využívá stejné feature services jako běžné obrazovky.
- Nástěnky po skupinách, model členů s přezdívkou, demo data s reálnými členy, kalendář akcí a rychlé potvrzení účasti – viz sekce „(hotovo)“ níže.
- Další postup: vlny úprav a první nasazení demo verze pro výbor – viz „Plán úprav a první nasazení“.

Zatím neproběhlo:

- **Fáze 4** – konzultace s vedoucím souboru.
- **Fáze 5 a 6** – reálný PHP/MySQL backend, nahrazování mock dat.

Poznatek z ladění mock vrstvy: pokud stejná data (např. účast na akci) potřebuje víc feature services, musí mít **jeden sdílený zdroj pravdy** (reaktivní stav, ne kopie pole při startu), jinak se snadno rozjedou do nekonzistence. Mock data s pevně zapsaným datem/časem navíc časem zestárnou (přestanou být „v budoucnu“) – kde na tom závisí logika (např. nadcházející akce), je lepší počítat data relativně k aktuálnímu datu.

## Základní strategie

Vývoj má probíhat iterativně a po malých celcích.

Nejprve vznikne frontendový prototyp s mock daty, poté se budou postupně nahrazovat mock data reálným PHP REST API a MySQL databází.

Důležitá zásada:

> Nejdřív ověřit uživatelský tok a obrazovky, ale už od začátku držet rozumné modely a services.

## Fáze 1 – Angular shell

Cílem je vytvořit základní aplikaci, která půjde spustit, proklikat a ukázat vedoucímu.

Obsah:

1. Angular projekt.
2. Routing.
3. Přihlašovací obrazovka.
4. Mock AuthService.
5. Základní layout po přihlášení.
6. Mobilní spodní navigace.
7. Desktop sidebar/header.
8. Dashboard placeholder.
9. Základní routes pro hlavní moduly.

## Fáze 2 – Mock modely a API services

Cílem je zavést typy a služby tak, aby se později daly přepojit na reálný backend.

Obsah:

1. TypeScript modely pro core entity.
2. TypeScript modely pro první moduly.
3. Mock data.
4. Feature services.
5. Základní loading/error/empty states.

Důležité pravidlo:

- komponenty nesmí být pevně navázané na mock data,
- data mají získávat přes services.

## Fáze 3 – První obrazovky pro připomínkování

Cílem je mít klikací prototyp pro schůzku s vedoucím.

Doporučené obrazovky:

1. Login.
2. Dashboard.
3. Seznam akcí.
4. Detail akce.
5. Potvrzení účasti.
6. Nástěnka.
7. Detail příspěvku.
8. Seznam členů.
9. Hrubý placeholder krojové databáze.

## Fáze 4 – Konzultace s vedoucím

Na schůzce se nemá řešit databáze ani technologie. Má se řešit realita provozu souboru.

Hlavní otázky:

1. Co dnes nejvíc bolí v komunikaci?
2. Jaké informace se nejčastěji ztrácí?
3. Co musí člen zvládnout na mobilu během několika sekund?
4. Jak vedoucí vytváří akce?
5. Jak se dnes potvrzuje účast?
6. Jaké skupiny členů reálně používáte?
7. Co má vidět každý a co jen vybraní?
8. Kdo může vytvářet oznámení?
9. Kdo může upravovat akce?
10. Má krojová databáze sloužit jen jako evidence, nebo i jako půjčovna?

## Fáze 5 – První vertikální řez

Po odsouhlasení prvního modulu se vytvoří první reálný backendový řez.

Doporučený první modul: akce.

Vertikální řez:

```text
Angular seznam akcí
Angular detail akce
Angular potvrzení účasti
PHP GET /events
PHP GET /events/{id}
PHP POST /events/{id}/attendance
MySQL tabulky events a event_attendance
```

Cílem je ověřit:

- deploy frontendu,
- deploy PHP API,
- připojení k MySQL,
- autentizaci nebo její první náhradu,
- tvar API,
- error handling,
- strukturu služeb ve frontendu.

## Fáze 6 – Postupné nahrazování mock dat

Po prvním řezu se budou mock data nahrazovat reálnými endpointy po modulech:

1. Akce.
2. Docházka.
3. Nástěnka.
4. Členové.
5. Krojová databáze.
6. Dokumenty.

## Co zatím nedělat

Před první konzultací není vhodné napevno implementovat:

- komplexní databázovou strukturu,
- finální role a oprávnění,
- složitou registraci,
- WebSocket,
- push notifikace ze serveru (lokální notifikace přes service worker u zmínek v komentářích už existují),
- platby,
- rodiče a zákonné zástupce,
- složitý workflow půjčování krojů,
- univerzální dynamický REST framework.

## Doporučené MVP

První použitelné MVP by mohlo obsahovat:

1. Přihlášení.
2. Dashboard.
3. Nástěnky skupin.
4. Kalendář a seznam akcí.
5. Akce.
6. Potvrzení účasti.
7. Základní krojová databáze jako katalog.

Pozdější rozšíření:

- dokumenty,
- push notifikace (in-app notifikace u zmínek v komentářích už existují),
- pokročilá půjčovna krojů,
- dětský soubor,
- rodiče/zástupci,
- platby,
- mobilní aplikace přes Capacitor,
- WebSocket realtime backend,
- univerzální komponenta pro výpis seznamu členů (filtrování podle skupin, řazení podle atributů) – nahradila by ad-hoc seznamy v administraci (účast na akci, členové skupiny apod.),
- ~~skupinové nástěnky~~ – hotovo, viz „Nástěnky po skupinách“ níže.

## Nástěnky po skupinách (hotovo)

- Každá skupina má **jednu vlastní nástěnku** (`/app/boards/:slug`), společná nástěnka zanikla. Příspěvek patří právě jedné nástěnce (`Post.groupId`).
- Nástěnku vidí, píšou na ni a zmínit na ní lze jen **členy skupiny** (podle `Member.groupIds`). **Administrátor vidí všechny nástěnky.**
- Menu: Přehled – Akce – nástěnky skupin přihlášeného – Kroje; sekce Správa: Můj profil, Administrace (jen admin, chráněno `adminGuard`). Na mobilu místo jednotlivých nástěnek položka „Nástěnky“ (rozcestník `/app/boards`).
- Stránka **Členové** byla zrušena.
- **Můj profil** umožňuje upravit e-mail a telefon; příslušnost ke skupinám a role se nezobrazují.
- Ve výpisu nástěnky se u příspěvku zobrazuje počet nových komentářů od poslední návštěvy (`Post.lastVisitedAt`, zapisuje se při otevření i opuštění detailu). Do badge v menu se nepočítají – ten zahrnuje jen nepřečtené příspěvky a zmínky přihlášeného.
- Cílení na konkrétní jednotlivce bylo zrušeno (příspěvky i akce). Pro jednorázovou příležitost se založí vlastní skupina (např. „Velikonoce 2027 – kluci“) a po skončení se zruší nebo skryje.

## Členové, skupiny a demo data (hotovo)

- **Skupiny** (výchozí): Výbor, Taneční, Muzika, Kluci, Holky, Malá Vonica, Sklad (`core/data/mock-groups.ts`). Každá má zatím nástěnku.
- **Člen** (`Member`) má `firstName`, `lastName`, `nickname`, `createdAt` (datum přidání do souboru), `isAdmin`; e-mail je nepovinný.
  - Běžní členové vidí všude jen **přezdívku**; plné jméno je jen v administraci (`getFullName` v `core/utils/member.utils.ts`).
  - Přezdívku si člen mění sám na profilu, jméno a příjmení jen administrátor.
- **Role** se odvozují z člena (`memberToUser`): `admin` = příznak `isAdmin`, `leader` = člen skupiny Výbor (`LEADERSHIP_GROUP_ID`).
- **Mock přihlášení** hledá aktivního člena podle e-mailu; na login obrazovce je výběr demo profilu ze seznamu členů (podle přezdívky).
- **Reálná data souboru se nesmí dostat do gitu.** Seznam členů je lokálně v `dev/local/clenove.tsv` (ignorováno). `npm run members:import` z něj vygeneruje `frontend/src/app/features/members/data/mock-members.local.ts` (ignorováno přes `*.local.ts`), který v konfiguraci `demo` nahradí vymyšlené členy (`fileReplacements` v `angular.json`).
  - `npm run frontend:start:demo` – import + dev server s reálnými členy.
  - `npm run frontend:build:demo` – import + produkční build s reálnými členy. Pozor: jména jsou pak v JavaScriptu stažitelném z webu a přihlášení je zatím jen mock – nasazovat jen tam, kam nemá přístup veřejnost.
  - Běžný `start`/`build` a testy používají vymyšlené členy ve stejném formátu.
  - Až bude backend (Fáze 5), nahradí to neverzovaný SQL seed (např. `data/seed.local.sql`).

## Kalendář a rychlé potvrzení účasti (hotovo)

- **Přehled** ukazuje 5 nejbližších akcí (`DASHBOARD_EVENT_LIMIT`) v kompaktních řádcích (`event-rsvp-row`) s tlačítky Ano / Možná / Ne; klik na řádek otevře detail.
- **Akce** mají přepínač Seznam / Kalendář (`?view=calendar`). Měsíční mřížka od pondělí, tečky podle mé účasti, pod mřížkou akce vybraného dne s rychlým potvrzením. Vícedenní akce se zobrazí v každém svém dni. Seznam ukazuje jen nadcházející akce, historie je v kalendáři.
- `AttendanceService.setStatus` mění jen stav, poznámku a `firstViewedAt` zachová.
- Mock data: pravidelné nácviky každé úterý a pátek ±8 týdnů od dneška, počítané relativně.
- Počet nepotvrzených akcí (badge) zahrnuje jen nadcházející akce.

## Plán úprav a první nasazení

Rozhodnuto 2026-10-15. První nasazení je **demo pro výbor** (odpovídá Fázi 4), ne ostrý provoz: bez backendu se data nesdílí mezi lidmi. Pořadí: merge `feature/admin-crud-prototype` do `master`, vlna 1, nasazení, pak další vlny na krátkých větvích podle zpětné vazby.

### Vlna 1 – před prvním nasazením

- **Přihlášení přežije reload**: v mock režimu uložit přihlášeného člena do `localStorage`, později podle autentizace backendu. Po přihlášení vrátit uživatele na původně požadovanou URL (reload, odkaz z notifikace, přímá URL).
- **Perzistence demo dat v prohlížeči**: účast, příspěvky (vč. archivace) a další změny uložit do `localStorage` podobně jako komentáře. Tlačítko „Obnovit demo data“.
- **Pruh „Demo verze“**: viditelné upozornění, že data vidí jen uživatel sám v tomto prohlížeči.
- **Maskování příjmení v demo buildu**: `import-members.mjs` zapíše příjmení jako iniciálu + pevný počet hvězdiček („Pavel H*****“), aby se neprozradila délka. Maskovat i náhradní přezdívku (dnes se při chybějící přezdívce skládá z plného jména). Plné příjmení se do buildu nesmí dostat. Přezdívky musí být unikátní – import duplicitu ohlásí jako chybu.
- **Ochrana webu**: aplikace poběží na `moje.vonica.cz`. Celý web za HTTP Basic Auth (jeden společný účet pro soubor) v `.htaccess`, HTTPS (zajišťuje hosting), `X-Robots-Tag: noindex`. `.htpasswd` generuje deploy skript z `.env`, do gitu nejde. Manifest načítat s `crossorigin="use-credentials"`, jinak se PWA za Basic Auth nenainstaluje. Spoléhat na tajnou URL nestačí (adresa je veřejně v certificate transparency logu). Ověřeno, viz deploy skript níže.
- **Upozornění na novou verzi**: přes `SwUpdate` nabídnout „Je dostupná nová verze – obnovit“, jinak service worker servíruje starou verzi z cache.
- **Deploy skript (build + nahrání přes SFTP, port 22)**. Navazuje na `scripts/release.mjs` (verze `vRRRR.M.N`, tag `vRRRR.M.N-<slug tance>`, `public/changelog.json`, jména tanců v `data/release-dances.json`). Rozdělit do více commitů (env/konfigurace, deploy skript, informace o buildu, changelog stránka).
  - **Přístupy** přesunout z `dev/local/ftp-splk.txt` do `.env` v kořeni (ignorovaný gitem), do repa jen `.env.example` s prázdnými klíči (`SFTP_HOST`, `SFTP_PORT`, `SFTP_USER`, `SFTP_PASSWORD`, `SFTP_REMOTE_DIR`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`…).
  - **Volba zdroje buildu**:
    1. aktuální pracovní kopie aktuální branche (včetně necommitnutých změn) – povoleno, ale s výrazným varováním a s příznakem v označení verze,
    2. poslední commit aktuální branche (build z čistého checkoutu, např. `git worktree` do dočasné složky),
    3. poslední tag z `master` (stejně přes dočasný checkout).
  - Nahrávat obsah `frontend/dist/frontend/browser/` včetně `.htaccess` a odstranit soubory, které na serveru zbyly ze starší verze. Knihovna: `ssh2-sftp-client` (viz ověření níže).
  - Před nahráním vypsat shrnutí (zdroj, verze/commit, cílový server) a vyžádat potvrzení.
  - **Ověřeno na hostingu (Websupport, 2026-10-14)**:
    - SFTP (port 22) funguje, SSH shell ne (`exec` odmítnut) → `rsync`/`scp` nelze, nahrávat přes `ssh2-sftp-client` (závislost schválena místo `basic-ftp`).
    - Kořen SFTP je přímo webový adresář `moje.vonica.cz` (na disku `/data/1/f/…/vonica.cz/sub/moje`). Mimo web root přístup není, `.htpasswd` proto musí ležet ve web rootu a `.htaccess` ho blokuje (`<Files ".ht*"> Require all denied` → ověřeno 403). Absolutní cestu pro `AuthUserFile` držet v `.env`, ne v repu.
    - Basic Auth v `.htaccess` funguje (401 bez hesla / se špatným heslem, 200 se správným), hash APR1 (`openssl passwd -apr1`) Apache přijímá. `Header ... X-Robots-Tag` funguje (mod_headers).
    - HTTPS s platným certifikátem a přesměrování HTTP → HTTPS už zajišťuje hosting (proxy openresty před Apache), v `.htaccess` ho není potřeba řešit.
    - PHP 8.5 (FPM) je k dispozici – pro Fázi 5.
    - Na webu teď běží starší build ze 7. 10. bez hesla (jen vymyšlení členové). V rootu je navíc `_index.php` (výchozí stránka hostingu) – deploy ho smí smazat.
    - Pořadí při prvním nasazení s reálnými jmény: nejdřív nahrát `.htpasswd` a `.htaccess` s Basic Auth, teprve potom soubory aplikace, aby nebyl ani krátký okamžik, kdy jsou jména veřejně.
- **Označení verze v aplikaci**:
  - Codename tance malými písmeny (např. „klátková“), bez vlajky. Na PC v patičce sidebaru, na mobilu v headeru. Odkaz vede na stránku changelogu.
  - Do `<head>` při buildu vložit meta informace: tag / číslo verze, případně revize (branch + commit, příznak necommitnutých změn) a datum buildu. Build-info generovat skriptem do souboru, který aplikace načte (podobně jako `sync-public`).
  - Build, který není z tagu, se místo tance označí jako branch + krátký hash commitu (např. `feature/admin-crud-prototype@0feedfc`), u necommitnutých změn s příznakem.
- **Changelog stránka**: výpis verzí z `changelog.json` (verze, datum, tanec s odkazem, seznam změn). Změny jen česky (pole řetězců jako dnes), dvojjazyčnost až při potřebě.

### Vlna 2 – úpravy pro členy (po prvním nasazení, podle zpětné vazby)

- **Kompaktní seznam akcí**: v seznamu akcí (`/app/events`) použít `event-rsvp-row` bez detailního popisu. Počty odpovědí („12 ✓ · 3 ✗ · 5 ?“) vidí jen výbor; když se do řádku nevejdou, ukázat je až při hoveru, na mobilu vůbec.
- **Filtry v seznamu akcí**: podle typu (`EventType`) a podle mé odpovědi (potvrzené / nepotvrzené). Filtry lze kombinovat.
- **Nepotvrzené akce v záhlaví seznamu akcí**: upozornění „N akcí čeká na tvoji odpověď“ přesunout z `/app/profile` do záhlaví stránky Akce; kliknutí zapne filtr „nepotvrzené“.
- **RSVP na úzkých displejích**: v `event-rsvp-row` místo textových tlačítek tři malá ikonová (✓ ? ✗), aby zůstalo místo na čas a název akce. Jedno klepnutí zůstává.
- **Tooltip dne v kalendáři**: při hoveru na den zobrazit akce toho dne s časem začátku („18:00 – Nácvik“). Jen pro zařízení s hoverem.
- **Poznámky k účasti viditelné pro všechny členy**: v sekci „Účast“ v detailu akce u jména s poznámkou ikonka komentáře, text v tooltipu (na mobilu po kliknutí na jméno). U políčka poznámky upozornění, že ji uvidí ostatní.
- **Označení příspěvku s novou zmínkou**: štítek „Zmínka“ ve výpisu nástěnky obdobně jako „Nepřečteno“ (badge v menu už zmínky započítává).
- **Řazení příspěvků a archiv na nástěnce**: připnuté nahoře, pak od nejnovějších po nejstarší. Pod nimi oddělovač s tlačítkem „Zobrazit archivované“ (také od nejnovějších).
- **Profil přes jméno uživatele**: zrušit položku „Můj profil“ (sidebar, mobilní „Profil“). Na `/app/profile` se jde kliknutím na své jméno – na desktopu v patičce sidebaru, na mobilu v headeru.
- **Nástěnky přímo v bottom nav na mobilu**: místo rozcestníku „Nástěnky“ vypsat jednotlivé nástěnky přihlášeného (každá s badge). Při přetečení se bottom nav dá prstem posouvat do strany (horizontální scroll). `Group` dostane příznak „nástěnka povolena“ (model, mock data, administrace skupin). Administrátor má v bottom nav jen nástěnky, kde je členem; ostatní najde v rozcestníku `/app/boards`.
- **Administrace v bottom nav pro administrátora** (`/app/admin`), běžní členové ji nevidí.
- **Unikátní přezdívky**: při změně přezdívky na profilu (a v administraci) ověřit, že ji nemá nikdo jiný – jinak by se zmínky nedaly rozlišit.

### Vlna 3

- **Zmínky při psaní přes „@“ a vyznačené v textu komentáře**: zmínka se teď vybírá zvlášť (select „@ Zmínit“) a ukládá jen do `mentionedMemberIds`, v textu komentáře není vyznačená. Nově:
  - Po napsání „@“ v textarea komentáře vyskočí nabídka členů, které lze na nástěnce zmínit (podle přezdívky). Text psaný za „@“ (až po kurzor) nabídku filtruje, bez ohledu na diakritiku a velikost písmen. Ovládání myší i klávesnicí (šipky, Enter vybere, Esc zavře). Select „@ Zmínit“ odpadne.
  - Po výběru se rozepsané „@Jak“ nahradí „@Jakub“ a komponenta si pamatuje vybrané členy. Při odeslání se v textu tato jména převedou na token (např. `@[member:1]`). Když uživatel jméno v textu mezitím přepíše nebo smaže, zmínka se neuloží.
  - `mentionedMemberIds` se odvodí z tokenů v textu.
  - Při vykreslení se token nahradí graficky odlišeným jménem člena. Text se rozparsuje na segmenty v šabloně, ne přes `innerHTML` (XSS). Mock data komentářů upravit na nový formát.
  - Bez nové knihovny: obyčejná textarea + vlastní nabídka pod ní (ne `contenteditable`).
- **Stránky Profil a Nastavení vedle sebe**: vedle `/app/profile` vytvořit `/app/settings`. V patičce sidebaru (na mobilu v headeru) vedle „Odhlásit se“ ikonka ozubeného kolečka. **Profil** = údaje o mně, **Nastavení** = jak se mi aplikace chová.
- **Nastavení – notifikace**: zapínání notifikací přesunout z `/app/profile` do `/app/settings`.
- **Nastavení – vzhled**: světlý / tmavý / automatický režim. Barvy přes CSS proměnné, volba uložená v zařízení.
- **Nastavení – další**: velikost písma (normální / větší / největší), výchozí zobrazení stránky Akce (seznam / kalendář), omezení animací (`prefers-reduced-motion`). Volbu fontu nedoporučuji.

### Potom

- **Administrace**: projít a doplnit vše, co se v ní má spravovat – až po dotažení členské části.

### Odloženo na backend (Fáze 5+)

- **Číslo pasu a jeho platnost** v profilu (pro zahraniční zájezdy): citlivý osobní údaj (GDPR), vidí jen člen sám a administrátor, upozornění na blížící se konec platnosti. V mock/demo verzi bez skutečného přihlášení nemá co dělat.
- **Odběr notifikací po nástěnkách**: vyžaduje server (push). Zmínky přes „@“ mají upozornit vždy, bez ohledu na odběr.
