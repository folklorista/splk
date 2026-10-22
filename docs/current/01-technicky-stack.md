# Technický stack a architektonický směr

## Aktuální plánovaný stack

První verze bude postavená na dostupné infrastruktuře:

- Angular frontend,
- PHP REST API,
- MySQL databáze,
- běžný placený PHP hosting,
- bez WebSocketu,
- realtime chování zatím přes polling.

Angular aplikace bude buildovaná jako statický frontend a nahraná na hosting jako zkompilované soubory.

PHP backend bude poskytovat REST API nad MySQL databází.

## Ověřené možnosti produkčního hostingu (17. 10. 2026)

Následující skutečnosti byly ověřeny na produkčním hostingu pro `vonica.cz` / subdoménu `moje`:

- PHP **8.5.10** s aktivním rozšířením **Sodium** a knihovnou **libsodium 1.0.18**.
- Šifrování **XChaCha20-Poly1305** prošlo testem zašifrování, dešifrování i odmítnutí poškozeného ciphertextu.
- K dispozici je `password_hash(..., PASSWORD_ARGON2ID)` pro bezpečné hashování hesel.
- K dispozici je Sodium **secretstream** pro případné šifrování větších souborů po částech.
- Adresář **`/vonica.cz/home`** leží mimo webově dostupnou část hostingu. PHP proces subdomény `moje` k němu má oprávnění číst a zapisovat.
- Ve vyzkoušeném rozložení souborů odpovídá cestě výraz `dirname(__DIR__, 2) . '/home'`; při implementaci je nutné ověřit jeho výsledek vůči skutečnému `__DIR__` a cestu centrálně konfigurovat.
- Hosting **nepředává vlastní proměnné prostředí do PHP**. Tajné údaje se proto ukládají do chráněných souborů mimo webroot: šifrovací klíče a přístupy do databáze odděleně, nikoliv do Gitu nebo Angular buildu.
- **CRON je dostupný**. Administrace hostingu umožňuje vytvořit úlohu typu „Spuštění PHP 8.5 souboru“, nastavit CRON výraz a zvolit skript. Z doloženého formuláře nelze odvodit, zda se PHP vykonává jako lokální CLI, nebo přes HTTP URL, ani že už konkrétní úloha běží; před nasazením je třeba způsob volání ověřit.

Praktické využití CRONu: pravidelná údržba a automatické upozorňování/mazání neaktivních soukromých **skupinových** konverzací. Doporučený rytmus pro tuto údržbu je **jednou denně**; časy a způsob zabezpečení se určí až při vytvoření jobu.

Serverové šifrování DM a jeho oprávnění jsou popsány v `09-soukrome-zpravy-dm-a-sifrovani.md`. Půjde o **server-side encryption**, nikoliv end-to-end: produkční PHP služba dešifruje zprávy pouze oprávněným účastníkům a klíč je mimo databázi. Systémový správce souboru ani organizační skupiny nemá oprávnění číst cizí soukromé zprávy.

## Autentizace a více souborů – cílový návrh (18. 10. 2026)

- Globální identita: **osoba (`person`) ≠ přihlašovací účet (`user`) ≠ členství v souboru (`ensemble_membership`) ≠ pověření ≠ relace**. Jeden účet může mít různé pravomoci ve více folklorních souborech; přepnutí kontextu není nové přihlášení.
- Dlouhodobé, serverově odvolatelné přihlašovací relace; uživatel může v nastavení spravovat svá přihlášená zařízení/prohlížeče (omezeně IP, user-agent, poslední aktivita). Důvěryhodný prohlížeč je něco jiného než platná relace. Konkrétní 2FA, doba důvěry a ochrana přepínání více účtů na jednom sdíleném profilu prohlížeče zůstávají k návrhu.
- Rodinné zastupování je **delegovaný úkon z účtu rodiče za osobu dítěte**, nikoliv přihlášení rodiče do dětského účtu. Audit zápisu eviduje aktéra i zastupovanou osobu; nezpřístupňuje automaticky DM dítěte.
- Veškerá serverová autorizace musí počítat s `ensemble_id` a ověřením konkrétního předmětu přístupu. Výjimkou je úzce vymezené osobní API pro **vlastní zápůjčky ze skladu jiného souboru**, bez jeho prohlížení nebo členství.

## Omezené offline prohlížení – odsouhlasená politika

- Angular aplikace je **online-first PWA**; její shell může fungovat bez spojení. Strukturovaná aktivní **textová data a metadata** se uchovávají lokálně v IndexedDB, odděleně podle uživatelského účtu a souborového kontextu. Archivované záznamy se aktivně nepřipravují; obrázky, audio a video se pro offline provoz nepřednačítají.
- Cache se při aktivním online používání kontroluje **přibližně každých 10 minut**, při otevření detailu, úspěšném zápisu a návratu do aplikace podle potřeby ihned. Časovače **neběží spolehlivě na pozadí** mobilního prohlížeče: není zaručen refresh, je-li aplikace zavřená.
- Upřednostněny jsou **aktuální snímky jednotlivých datových sad s HTTP `ETag` / `If-None-Match` a `304 Not Modified`**. Změněný snímek se validuje a nahradí **atomicky**. Nezavádíme obecný kurzorový synchronizační deník ani pravidelnou odlišnou „plnou“ synchronizaci; každá aktualizovaná sada je úplným srovnáním.
- Backend musí `ETag` počítat pro **obsah dostupný konkrétnímu přihlášenému účtu** včetně oprávnění. Odepřený/archivovaný/smazaný obsah se při příštím kontaktu odstraní z lokální cache. Lokální kopii na zařízení, které je trvale offline, nelze vzdáleně okamžitě odvolat; proto neukládat DM ani citlivá administrativní data offline.
- Při výpadku API zobrazit varování a poslední čas aktualizace a **zakázat všechny zápisy**. Neexistuje fronta pozdějšího odeslání. Pokud request vypadne uprostřed ukládání, nelze bez potvrzení serveru zobrazit „uloženo“. Po návratu spojení zjistit aktuální stav.

## Zálohy – provozní rozhodnutí, ne hotová implementace

- Hosting zálohuje **MySQL a soubory jednou denně**, uchovává nejvýše **14 dní**; podle poskytovatele mohou být databáze **nad 2 GB zálohovány pouze týdně**.
- Akceptujeme denní poskytovatelskou obnovu jako základ a plánujeme **vlastní týdenní šifrovanou zálohu SQL + nahraných příloh mimo hosting**, například Google Drive. Výpadek celého poskytovatele může znamenat až přibližně **7 dní ztracených změn**; původně probírané hodinové RPO již není cílem tohoto kompromisu.
- Hosting umí spustit PHP skript nebo URL přes CRON, ale **`mysqldump` na hostingu není ověřen / předpokládá se nedostupný**. Prověřit exportní API poskytovatele; alternativou je konzistentní PHP export MySQL s reálným testem obnovy (schema, data, referenční integrita). Nedávat celý export do PHP paměti.
- Týdenní archiv **zašifrovat před odesláním**, uchovávat nezávisle klíče nutné pro obnovu serverově šifrovaných DM, sledovat úspěch zálohy, oznamovat selhání a testovat obnovu v odděleném prostředí. Konkrétní retence externích archivů, cílové úložiště a autentizace přenosu jsou implementační úkoly.

## Počítačové soubory a přílohy – společná služba

- `file` = fyzicky uložená data; `attachment`/odkaz = jejich použití v chatu, příspěvku na nástěnce (např. příspěvek choreografie s materiály v repertoárové skupině) apod. Jeden obsah může být odkázán více místy.
- Autor může měnit přílohu s jediným použitím. Jakmile obsah začne využívat více míst, **uzamkne se proti přepsání**; oprava vytvoří nový soubor a jednotlivé odkazy se podle oprávnění přepojí. Při odstranění chatu/skupiny zachovat soubor dále používaný jinde (např. v příspěvku choreografie jiné skupiny).
- Přístup ke stažení kontrolovat podle oprávněného **kontextu odkazu**, ne podle znalosti URL; zveřejnění do širšího prostoru vyžaduje pověření. Zálohování a bezpečný úklid osiřelých souborů se řeší samostatně.

## Proč zatím bez WebSocketu

Běžný PHP hosting typicky neumožňuje pohodlně provozovat vlastní WebSocket server, protože WebSocket potřebuje dlouho běžící proces, správu portů a často i reverse proxy.

Proto první verze nebude stavět na WebSocketu. Pro aktualizace dat se použije polling:

- periodické načítání novinek (stejná odpověď nese i aktuálně nasazenou verzi aplikace, aby šlo uživatele upozornit na novou verzi – viz docs/03 „Hlídání nové verze přes backend“),
- ruční refresh,
- později případně push notifikace nebo externí realtime služba.

## Budoucí cílový stack

Do budoucna se počítá s možností migrace na robustnější infrastrukturu:

- Node.js / TypeScript backend,
- PostgreSQL,
- WebSocket nebo Socket.IO,
- Docker / Docker Compose,
- VPS nebo jiný server, kde lze provozovat vlastní služby,
- reverse proxy přes Nginx nebo Caddy.

Možná budoucí architektura:

```text
Angular frontend
Node.js / TypeScript API
PostgreSQL
WebSocket / Socket.IO
Docker Compose
VPS
```

## Zásady pro frontend

Angular frontend má být připravený tak, aby budoucí změna backendu nebyla bolestivá.

Komponenty nemají volat HTTP API přímo. Mají používat aplikační services.

Doporučená struktura volání:

```text
Angular komponenta
↓
feature service
↓
API service / mock service
↓
PHP REST API nebo mock data
```

Příklad:

```ts
this.eventsService.getEvents();
```

Místo přímého volání:

```ts
this.http.get('/api/events');
```

Díky tomu půjde později vyměnit PHP REST API za Node.js backend bez zásadních zásahů do komponent.

## Mock data v první fázi

První fáze může fungovat bez reálného backendu:

- modely budou v TypeScriptu,
- services budou vracet mock data,
- UI bude možné testovat a připomínkovat,
- později se mock implementace nahradí HTTP voláním.

Příklad:

```ts
getEvents(): Observable<AppEvent[]> {
  return of(MOCK_EVENTS).pipe(delay(300));
}
```

Později:

```ts
getEvents(): Observable<AppEvent[]> {
  return this.http.get<AppEvent[]>('/api/events');
}
```

## Doporučená struktura Angular aplikace

```text
src/app/core/
  auth/
  api/
  layout/
  models/
  services/

src/app/shared/
  components/
  pipes/
  utils/

src/app/features/
  dashboard/
  posts/
  events/
  attendance/
  members/
  costumes/
  documents/
  settings/
```

## Doporučený přístup k databázi

Databáze má mít pevnou strukturu pro jádro a hlavní moduly.

Nedoporučuje se:

- generovat API automaticky nad libovolnou tabulkou,
- stavět celý frontend jako univerzální renderer databázových tabulek,
- snažit se pokrýt všechny budoucí scénáře přes plně dynamický model.

Doporučuje se:

- pevné tabulky pro jádro aplikace,
- pevné tabulky pro hlavní moduly,
- konfigurovatelnost přes skupiny, moduly a nastavení,
- rozšiřující atributy pouze tam, kde dávají smysl.

Příklad oblasti, kde může dávat smysl flexibilita:

- doplňkové atributy krojových dílů,
- nastavení modulu,
- volitelná metadata.

Příklad oblasti, kde má být model pevný:

- uživatelé,
- členství v souboru,
- skupiny,
- akce,
- docházka,
- příspěvky,
- základní oprávnění.
