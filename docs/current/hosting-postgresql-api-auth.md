# Infrastrukturní experiment: PostgreSQL 18, API, autentizace a migrace dema

> **Status:** platná ověřená fakta o hostingu (2026-10-22). Doporučení z kap. 6–8 jsou přijatá jako D-11 až D-13 (`docs/decisions.md`). Otevřené body z kap. 9–10 jsou v `docs/open-questions.md` Q-11; přesun dema (kap. 12) je dokončen (Q-13).

Provedeno 2026-10-22. Cíl: ověřit hosting Websupport pro rozdělení aplikací Vonica
(`krojarka.vonica.cz`, `api.vonica.cz`, `demo.vonica.cz`, později `moje.vonica.cz`) nad společným PHP REST API
a PostgreSQL 18 s autentizací pomocí cookies.

Značení důkazů:

- **[HTTP]** – ověřeno skriptem nebo `curl` na úrovni HTTP, bez prohlížeče.
- **[Chrome]** – ověřeno ve skutečném prohlížeči (Google Chrome 156, headless, čistý profil), stránka spuštěná
  přímo z dané domény a volající API přes `fetch(…, { credentials: 'include' })`.
- **[SFTP]** – ověřeno přes SFTP účet dané domény.

Na `moje.vonica.cz` proběhly jen read-only kontroly (DNS, HTTPS, výpis webrootu, `--status`). Nic tam nebylo
změněno ani nahráno.

## Shrnutí a odpověď

**Lze provozovat `krojarka.vonica.cz` a později `moje.vonica.cz` nad společným PHP REST API a PostgreSQL 18
se spolehlivou autentizací pomocí cookies? – ANO**, za těchto podmínek:

1. Session cookie bude **host-only na `api.vonica.cz`** (`__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`).
   Frontendy a API jsou *same-site* (`vonica.cz`), takže prohlížeč cookie posílá i při blokování cookies
   třetích stran. Sdílená cookie `.vonica.cz` není potřeba.
2. Sessions nebudou ve výchozím úložišti hostingu (memcache). Na něm nefunguje `session.use_strict_mode`.
   Ukládat se budou do PostgreSQL (vlastní tabulka).
3. Zápisové požadavky budou chráněné allowlistem originů, povinným JSON tělem a CSRF tokenem.
4. Spojení PHP → PostgreSQL na hostingu je nešifrované. Vede ale privátní sítí poskytovatele. Je potřeba to
   vědomě přijmout a ověřit u Websupportu (viz rizika).

Všechny klíčové scénáře přihlášení, udržení session, CSRF a odhlášení prošly ve skutečném prohlížeči z obou
frontendových domén.

## 1. Výsledky testů podle domény

### Společné pro všechny domény

| Test | Výsledek | Důkaz |
|---|---|---|
| DNS A/AAAA (všechny 4 domény → stejný server, IPv4 i IPv6) | PASS | [HTTP] |
| HTTPS, TLS 1.3, platný certifikát Let's Encrypt (SAN pokrývá api/demo/krojarka/moje/www; platí do 2027-01-20) | PASS | [HTTP] |
| HTTP → HTTPS přesměrování (301) | PASS | [HTTP] |
| Hlavička `Strict-Transport-Security` | FAIL – hosting ji neposílá (lze doplnit v `.htaccess`) | [HTTP] |

### demo.vonica.cz, api.vonica.cz, krojarka.vonica.cz

| Test | demo | api | krojarka |
|---|---|---|---|
| SFTP připojení vlastním účtem | PASS | PASS | PASS |
| Webroot = kořen SFTP (`/`), účet zavřený ve `vonica.cz/sub/<doména>` | PASS | PASS | PASS |
| Výchozí obsah | jen `index.php` (placeholder Websupportu, 6550 B) | totéž | totéž |
| Zápis: nahrání izolovaného souboru | PASS | PASS | PASS |
| Smazání vlastního testovacího souboru | PASS | PASS | PASS |
| Existující obsah po celou dobu nedotčen (velikost + čas změny) | PASS | PASS | PASS |
| Statické HTML/JS/JSON/TXT (správný `Content-Type`, brotli, ETag) | PASS | PASS | PASS |
| PHP (verze 8.5.12, FPM) | PASS | PASS | PASS |
| `.htaccess`: `mod_rewrite`, `mod_headers`, `Options`, `Files` | PASS | PASS | PASS |
| URL rewriting (`v1/echo` → `api.php?action=echo`) | – | PASS | – |
| SPA fallback: přímé načtení vnořené URL vrátí `index.html` | PASS [HTTP+Chrome] | – | PASS [HTTP+Chrome] |
| `<base href>` + JS modul se načtou i z vnořené URL | PASS [Chrome] | – | PASS [Chrome] |
| Basic Auth (vlastní `.htpasswd`, 401 bez hesla / 200 s heslem) | PASS [HTTP+Chrome] | – | – |
| `.htaccess` / `.htpasswd` nejsou stažitelné | PASS (466 / 403) | PASS | PASS |
| Adresář bez lomítka → 301 na URL s lomítkem | PASS | PASS | PASS |
| Neexistující soubor → 404 | PASS (mimo SPA fallback) | PASS | PASS (mimo SPA fallback) |

Poznámka k SPA fallbacku: s pravidlem z repozitáře vrátí i chybějící asset (`missing.png`) `200 text/html`.
Pro aplikaci to nevadí, ale ztěžuje to diagnostiku. Doporučení je v kap. 9.

### moje.vonica.cz (jen read-only)

| Test | Výsledek | Důkaz |
|---|---|---|
| DNS, HTTPS, HTTP→HTTPS | PASS | [HTTP] |
| Basic Auth aktivní (realm „SPLK“, 401 bez hesla) | PASS | [HTTP] |
| SFTP připojení a výpis webrootu (Angular build + `.htaccess` + `.htpasswd`) | PASS | [SFTP] |
| Nasazená verze | `design/identity-03@ce20f01+dirty`, build 2026-10-20 | `deploy --target moje --status` |
| Zápisové testy | NOT TESTED – záměrně, zákaz změn | – |
| CORS z `https://moje.vonica.cz` (serverová strana) | PASS | [HTTP] |

## 2. Skutečné verze

| Komponenta | Verze / hodnota |
|---|---|
| PHP | **8.5.12**, SAPI `fpm-fcgi`, Linux, Apache za proxy `openresty` |
| PHP rozšíření | `pdo`, `pdo_pgsql`, `pgsql`, `sodium`, `openssl`, `mbstring`, `intl`, `curl`, `zip`, `gd`, `fileinfo`, `apcu` – ano; `opcache` – **ne** |
| libpq (klientská knihovna PostgreSQL v PHP) | **14.24** |
| OpenSSL | 3.0.2 |
| PostgreSQL server | **PostgreSQL 18.6** (Ubuntu 18.6-1.pgdg22.04+2), `server_version_num` 180006 |
| Kódování DB | `UTF8`, collation a ctype `cs_CZ.utf8` (české řazení funguje: `hrad` < `chata`) |

## 3. Možnosti a omezení hostingu

### Ověřená fakta

- Každá doména má vlastní SFTP účet zavřený ve svém webrootu (`…/vonica.cz/sub/<doména>`). Nad webroot se
  vlastním účtem nedostane. Hlavní účet `VONICA_*` vidí všechny subdomény.
- SFTP i FTPS (FTP přes TLS) používají server s certifikátem `*.r4.websupport.sk`, ne `*.vonica.cz`.
- Nahrané soubory dostávají práva **0666** (`rw-rw-rw-`).
- PHP: `memory_limit` 512M, `max_execution_time` 600, `post_max_size` 512M, `upload_max_filesize` 256M,
  `date.timezone` `Europe/Bratislava`, `default_charset` UTF-8, `open_basedir` nastaven, `disable_functions` prázdné.
- **`display_errors = 1`** – výchozí hodnota hostingu. Produkční API ji musí vypnout.
- **Sessions: `session.save_handler = memcache`**, `gc_maxlifetime` 6 h. Výchozí cookie atributy jsou nebezpečné
  (`cookie_secure=0`, `cookie_httponly=0`, `samesite` prázdné, `use_strict_mode=0`).
- `$_SERVER['HTTPS'] = on`, `X-Forwarded-Proto: https` – PHP ví, že běží pod HTTPS.
- `.htaccess` funguje včetně `RewriteRule`, `Header`, `Options -Indexes`, `AuthType Basic`.
- Proxy přidává `Vary: Accept-Encoding` a komprimuje brotli. Neviděl jsem známky cachování odpovědí API
  (žádné `X-Cache`, odpovědi s `Cache-Control: no-store` se chovaly správně).

### PostgreSQL 18 (fáze C)

Test proběhl z PHP na `api.vonica.cz` a pro srovnání také z PHP na lokálním stroji (internet).

| Test | Z `api.vonica.cz` | Z internetu |
|---|---|---|
| `PDO` + `pdo_pgsql` | PASS | PASS (lokální PHP 8.3) |
| Navázání spojení | PASS (8 ms) | PASS (~220 ms) |
| `SELECT version()` | PostgreSQL 18.6 | PostgreSQL 18.6 |
| `SELECT 1` | PASS (průměr 0,2 ms na dotaz) | PASS |
| Parametrizovaný SELECT (nativní prepared statements, `ATTR_EMULATE_PREPARES=false`) | PASS, včetně řetězce s `'; DROP TABLE …` | PASS |
| UTF-8 roundtrip (`Příliš žluťoučký kůň úpěl ďábelské ódy`) | PASS | PASS |
| TLS se `sslmode=require` | **FAIL** – „server does not support SSL“ | PASS (TLS 1.2) |
| Spojení bez TLS (`sslmode=disable`) | připojí se | **připojí se** |
| `sslmode=verify-full` | FAIL (server TLS nenabízí; libpq 14 navíc nezná `sslrootcert=system`) | FAIL (certifikát nesedí na `PG_HOST`) |
| Klientská adresa z pohledu DB | privátní síť | veřejná |
| Oprávnění účtu (jen čtení katalogu) | není superuser, nesmí vytvářet DB ani role, smí `CREATE` v DB a ve schématu `public` (vlastník) | totéž |
| Tabulky v DB | 0 | 0 |
| Nastavení serveru | `ssl=off`, `password_encryption=scram-sha-256`, `max_connections=500`, `statement_timeout=0`, `TimeZone=localtime` | totéž |
| Dostupná rozšíření (neinstalována) | `pgcrypto`, `citext`, `unaccent`, `pg_trgm`, `uuid-ossp` | – |

Interpretace: samotný PostgreSQL má TLS vypnuté. Hosting se k němu připojuje přímo privátní sítí, a to
nešifrovaně. Z internetu je databáze dostupná přes další vrstvu, která TLS nabízí, ale nevynucuje. Certifikát
této vrstvy (Let's Encrypt, stejný jako u FTP serveru) nezní na `PG_HOST`. Hesla chrání SCRAM-SHA-256, takže se
neposílají v čitelné podobě ani bez TLS. Data dotazů ale ano.

Nebyly vytvořeny, změněny ani smazány žádné tabulky. Test zápisu neproběhl (NOT TESTED – vyžaduje schválení).

## 4. CORS (fáze D)

Testovací endpoint s explicitním allowlistem `https://krojarka.vonica.cz`, `https://demo.vonica.cz`,
`https://moje.vonica.cz`.

| Scénář | Výsledek | Důkaz |
|---|---|---|
| Preflight `OPTIONS` z povoleného originu → 204, `Access-Control-Allow-Origin: <origin>`, `-Credentials: true`, `-Methods`, `-Headers: Content-Type, X-CSRF-Token`, `-Max-Age: 600`, `Vary: Origin` | PASS (všechny 3 originy) | [HTTP] |
| `GET`/`POST` JSON z povoleného originu → 200 + CORS hlavičky | PASS | [HTTP], [Chrome] krojarka + demo |
| Nepovolené originy `https://evil.example`, `https://krojarka.vonica.cz.evil.example`, `http://krojarka.vonica.cz`, `null` → 403, bez CORS hlaviček | PASS | [HTTP] |
| Nepovolený origin v prohlížeči (`http://localhost:8765`) → prohlížeč zablokuje všechna volání | PASS | [Chrome] |
| Žádný wildcard `*` | PASS | [HTTP] |
| `Vary: Origin` u všech odpovědí | PASS | [HTTP] |
| `POST` s `text/plain` (simulace formuláře) → 415 | PASS | [HTTP] |
| Nepovolená metoda → 405 + `Allow` | PASS | [HTTP] |
| Neplatný JSON → 400, neznámá akce → 404 | PASS | [HTTP] |
| `moje.vonica.cz` – serverová připravenost CORS | PASS (Angular aplikace na `moje` nezměněna) | [HTTP] |

## 5. Cookies a session (fáze E, F)

**Cross-origin vs. cross-site.** `krojarka.vonica.cz` → `api.vonica.cz` je *cross-origin* (jiný host, platí
CORS), ale *same-site* (stejná registrovatelná doména `vonica.cz`). Prohlížeč to potvrdil hlavičkou
`Sec-Fetch-Site: same-site` [Chrome]. Proto se `SameSite=Lax` cookie posílá i u `fetch` z frontendu a na API se
nevztahuje blokování cookies třetích stran. Cross-site by byl například `localhost` nebo cizí doména. Tam
prohlížeč volání zablokoval už v CORS.

| Scénář | host-only `__Host-vtest` | sdílená `vtest_shared; Domain=.vonica.cz` | Důkaz |
|---|---|---|---|
| `Set-Cookie` s `Secure; HttpOnly; SameSite=Lax; Path=/` | PASS | PASS (+ `domain=.vonica.cz`) | [HTTP] |
| Session nastavená po přihlášení, ID regenerováno | PASS | PASS | [HTTP], [Chrome] krojarka + demo |
| Opakovaný požadavek se stejnou session, stav zachován (počítadlo 1 → 2) | PASS | PASS | [HTTP], [Chrome] krojarka + demo |
| Cookie nečitelná z JS frontendu (`document.cookie`) | PASS | PASS | [Chrome] |
| Zápis bez CSRF tokenu / se špatným tokenem → 403 | PASS | PASS | [HTTP], [Chrome] |
| Zápis se správným CSRF tokenem → 200 | PASS | PASS | [HTTP], [Chrome] |
| Odhlášení: session zničena, cookie smazána | PASS | PASS | [HTTP], [Chrome] |
| Stará (ukradená) cookie po odhlášení → 401 | PASS | PASS | [HTTP] |
| `fetch` s `credentials: 'include'` z `krojarka.vonica.cz` (22/22 kroků) | PASS | PASS | [Chrome] |
| `fetch` s `credentials: 'include'` z `demo.vonica.cz` bez Basic Auth (22/22) | PASS | PASS | [Chrome] |
| Totéž z `demo.vonica.cz` za Basic Auth (22/22) | PASS | PASS | [Chrome] |
| Session fixation: podvržené ID přijato serverem | **FAIL** – PHP ID převezme i se `use_strict_mode=1` (memcache handler strict mode nepodporuje) | totéž | [HTTP] |
| Session fixation: po přihlášení útočníkovo ID neplatí (`session_regenerate_id(true)`) | PASS | PASS | [HTTP] |

Basic Auth na `demo` volání API neovlivňuje. Přihlašovací údaje Basic Auth jsou vázané na origin `demo` a
k `api` se neposílají. API za Basic Auth být nesmí, protože preflight `OPTIONS` se posílá bez přihlašovacích
údajů a selhal by.

Basic Auth v testu používala jednorázové testové přihlašovací údaje (ne `DEMO_BASIC_AUTH_*`). Skutečná
`demo.vonica.cz` zatím Basic Auth nemá (kořen vrací 200).

Srovnání host-only vs. `.vonica.cz`: obě varianty technicky fungují stejně. Sdílená cookie se ale posílá na
**všechny** subdomény `vonica.cz` (včetně `www`, `katerinky` a budoucích webů na stejném hostingu). Každý z nich
by ji dostal a mohl by ji přepsat (cookie tossing). Host-only cookie s prefixem `__Host-` prohlížeč nedovolí
nastavit z jiné subdomény ani s atributem `Domain`. **Doporučení: host-only.**

### Co nebylo ověřeno v prohlížeči

- Safari (ITP), Firefox a mobilní prohlížeče – NOT TESTED. Protože jde o same-site požadavky, neočekávám
  problém, ale před ostrým provozem je to potřeba ověřit ručně (iPhone/Safari je u členů souboru pravděpodobný).
- Skutečný Angular build – použita minimální testovací SPA (`<base href>`, ES modul, vnořené routy, `fetch`).
  Angular service worker a `HttpClient` nebyly testovány.

## 6. Doporučená autentizace pro API v1

**Serverové sessions v PostgreSQL + host-only HttpOnly cookie na `api.vonica.cz`.** Bez JWT, bez tokenů
v `localStorage` a bez sdílené cookie.

- Cookie `__Host-vonica_sid`: `Secure; HttpOnly; SameSite=Lax; Path=/`, bez `Domain`, bez `Expires` (session
  cookie) nebo s rozumnou platností (např. 30 dní pro „zůstat přihlášen“).
- Hodnota: náhodný token o 256 bitech (`random_bytes(32)`). Do DB se ukládá jen jeho hash (SHA-256), takže
  únik tabulky neumožní převzít session.
- Tabulka `sessions` (`token_hash`, `user_id`, `csrf_token`, `created_at`, `last_seen_at`, `expires_at`,
  `user_agent`): umožní odhlášení ze všech zařízení, přehled přihlášení a nezávisí na memcache hostingu (ten
  se může vyprázdnit, nepodporuje strict mode a je sdílený).
- Alternativou je PHP `session_*` s vlastním `SessionHandlerInterface` nad PostgreSQL včetně `validateId`
  (strict mode). Je to ale víc kódu se stejným výsledkem, vlastní tabulka je jednodušší a průhlednější.
- Hesla: `password_hash(…, PASSWORD_ARGON2ID)` (sodium je k dispozici).
- Absolutní expirace a nečinnost (např. 30 dní / 14 dní), obnova `last_seen_at` nejvýše jednou za pár minut.
- Rate limiting přihlášení (podle účtu a IP) v DB.

## 7. Zabezpečení a CSRF ochrana

Vrstvy (všechny ověřené v experimentu, kromě explicitně označených):

1. **Allowlist originů** pro CORS i pro všechny nečtecí metody: požadavek s `Origin` mimo allowlist → 403.
   V produkci zápisový požadavek **bez** `Origin` odmítnout. Prohlížeče `Origin` u `POST`/`fetch` posílají
   vždy. *(Varianta bez `Origin` – NOT TESTED, je to návrh.)*
2. **`Sec-Fetch-Site`**: odmítnout `cross-site`, povolit `same-site` a `same-origin`. *(Návrh, hlavička
   ověřena v Chrome.)*
3. **Pouze JSON** (`Content-Type: application/json`, jinak 415): HTML formulář z cizí stránky ho neumí poslat
   a `fetch` musí projít preflightem.
4. **CSRF token (synchronizer token)**: generuje se při přihlášení, je uložený v session a vrací se
   v odpovědi `login` a `GET /auth/me`. Frontend ho drží v paměti a posílá v `X-CSRF-Token`, server porovnává
   přes `hash_equals`.
5. **`SameSite=Lax`**: cookie se nepošle z cizích webů. Nechrání ale před sesterskými subdoménami
   (`www.vonica.cz`, `katerinky.vonica.cz` jsou *same-site*). Proto jsou nutné vrstvy 1–4.

**Session fixation:** při přihlášení vždy vytvořit novou session (ověřeno, že tím útočníkovo ID ztratí
platnost). Neznámý token v cookie nikdy nepřijímat jako nový. Vlastní tabulka sessions to splňuje
z principu, PHP sessions na memcache ne.

**Další:**

- `display_errors=0`, `log_errors=1` (přes `ini_set` na začátku front controlleru nebo `.user.ini`;
  `.user.ini` NOT TESTED).
- Hlavičky API: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`.
- DB: nativní prepared statements (`ATTR_EMULATE_PREPARES=false`), `ERRMODE_EXCEPTION`, na začátku spojení
  `SET TIME ZONE 'Europe/Prague'` a `SET statement_timeout`. Ukládat `timestamptz`.
- Přístupové údaje k DB se nesmí dostat do webrootu ve stažitelné podobě (viz otevřené otázky).

## 8. Doporučené nastavení Angular HTTP klienta

- `provideHttpClient(withFetch(), withInterceptors([apiCredentialsInterceptor, csrfInterceptor, authErrorInterceptor]))`.
- Základní URL API v `environment` (`https://api.vonica.cz/v1`). Rozlišení mock / HTTP services zůstává podle
  architektonických pravidel projektu (komponenty volají jen feature services).
- `apiCredentialsInterceptor`: `withCredentials: true` **jen** pro požadavky na základní URL API, nikdy pro
  cizí URL.
- `csrfInterceptor`: vestavěné `withXsrfConfiguration` **nepoužívat**. Čte cookie z vlastního originu, ale
  cookie API je na jiném hostu a je HttpOnly. Místo toho interceptor přidá `X-CSRF-Token` z paměti (token
  z `GET /auth/me` / `login`) ke všem ne-GET požadavkům na API.
- `authErrorInterceptor`: 401 → stav „odhlášen“ a přesměrování na přihlášení. 403 `csrf` → jednou obnovit
  token (`/auth/me`) a požadavek zopakovat.
- Při startu aplikace `GET /auth/me` (APP_INITIALIZER nebo guard) – nic o přihlášení se neukládá do
  `localStorage`.
- Service worker (`ngsw`) nesmí cachovat odpovědi API. Do `dataGroups` API nepřidávat; volání na jiný origin
  `ngsw` ve výchozím stavu necachuje.

## 9. Problémy nasazování a úpravy skriptů

### Provedeno (fáze A)

- `scripts/deploy.mjs`:
  - povinný `--target demo|moje`, žádný výchozí cíl; `api` a `krojarka` se odmítnou (zatím pro ně v repu není
    nasaditelná aplikace);
  - čte jen proměnné `<PREFIX>_*` zvoleného cíle a vypíše názvy chybějících proměnných;
  - doména cíle je pevně ve skriptu (`*_SITE_URL` musí odpovídat);
  - odmítne SFTP účet sdílený s jinou doménou;
  - odmítne Basic Auth s `*_SITE_ROOT_PATH`, který neodpovídá cílové subdoméně;
  - odmítne deploy bez `<PREFIX>_BASIC_AUTH_*` na cíl, který je dnes za Basic Auth (jinak by přepsaný
    `.htaccess` web zveřejnil);
  - odmítne přepsat webroot s cizím obsahem (bez `build-info.json`, např. placeholder Websupportu), dokud se
    nepoužije `--allow-foreign-content`.
- `.env.example`: proměnné `MOJE_/DEMO_/API_/KROJARKA_*` včetně `*_SFTP_REMOTE_DIR`, `MOJE_BASIC_AUTH_*`,
  `DEMO_BASIC_AUTH_*` a `PG_*`, bez hodnot.
- `.claude/skills/deploy/SKILL.md`: nové názvy proměnných a `--target moje`.
- Ověřeno, že `.env` není verzovaný ani v historii Gitu. Konfigurace leží v kořenovém `.env`, ne
  v `scripts/.env`. Skripty ho tam vždy hledaly, druhý soubor nevznikl.

### Zjištěné problémy a navržené úpravy (zatím neprovedeno)

1. **Práva souborů 0666** – deploy by měl po nahrání nastavit `chmod 644` (soubory) / `755` (adresáře).
2. **`PG_SSLMODE`** – hodnota `require` funguje z lokálního stroje, ale na hostingu se API nepřipojí. Pro
   hosting bude potřeba `disable`/`prefer` (podle odpovědi Websupportu), pro přístup z internetu `require`.
3. **Přístupové údaje DB pro PHP** – hosting nepředává vlastní proměnné prostředí a účet `API_*` nevidí mimo
   webroot. Možnosti: konfigurační soubor v `vonica.cz/home` (nahraný jednorázově hlavním účtem `VONICA_*`;
   čtení z PHP `moje` bylo ověřeno 2026-10-17, z `api` NOT TESTED), nebo podadresář ve webrootu
   s `Require all denied`.
4. **SPA fallback** – vylučovat požadavky na assety (`\.(js|css|png|svg|ico|json|webmanifest|woff2?)$`), aby
   chybějící soubor vracel 404.
5. **HSTS** – doplnit do `.htaccess` aplikací i API.
6. **`opcache` vypnutý** – zjistit u Websupportu, zda jde zapnout (výkon API).
7. Deploy pro budoucí Krojařku (`--target krojarka`) a API (`api`) – až budou v repu nasaditelné části.

## 10. Rizika a otevřené otázky

**Rizika**

- Databáze je dostupná z internetu jen s heslem a přijme i nešifrované spojení. **Rozhodnutí (2026-10-22):
  veřejný přístup omezit na IP** – nastavuje se u Websupportu (administrace / podpora), zatím neprovedeno.
  Po omezení půjde z vývojového stroje k DB jen z povolené IP; API na hostingu jde privátní sítí.
- Spojení API → DB na hostingu je nešifrované (privátní síť poskytovatele). Pro data souboru (jména, kontakty
  členů) je to obvyklý kompromis sdíleného hostingu, ale je to rozhodnutí, ne výchozí stav.
- Sdílený server: DB vidí i jinou databázi (1), `max_connections` 500 je sdíleno.
- Hlavní účet `VONICA_*` a ostatní weby na `vonica.cz` jsou *same-site* s API. Kompromitace kteréhokoli z nich
  oslabí `SameSite`, proto jsou povinné CSRF token a kontrola originu.
- `display_errors=1` ve výchozím stavu může prozradit cesty a dotazy.
- Testovací session z posledního testu fixace zůstala v memcache hostingu bez obsahu citlivých dat. Vyprší
  sama do 6 h (`gc_maxlifetime`).

**Otevřené otázky**

- Ověření v Safari/iOS a Firefoxu před ostrým provozem.
- Jeden DB účet: účet nemůže vytvářet role, takže migrace i aplikace poběží pod stejným uživatelem. Je to
  přijatelné?
- `docker-compose.yml` pro lokální vývoj stále používá MariaDB a proměnné `DB_*` – sjednotit na PostgreSQL 18.
- Test zápisu do DB (vytvoření a smazání testovací tabulky) – vyžaduje schválení.

## 11. Úklid

Všechny testovací soubory byly v jediném adresáři `_vonica-hosting-test-<náhodný token>/` na `demo`, `api` a
`krojarka` (na `moje` nic). Po testech byly smazány skriptem podle manifestu nahraných souborů.

| Kontrola | demo | api | krojarka |
|---|---|---|---|
| Testovací adresář odstraněn | PASS | PASS | PASS |
| Kořen webrootu shodný se stavem před experimentem (`index.php`, velikost + čas změny) | PASS | PASS | PASS |
| Všechny testovací URL (HTML, JS, PHP, vnořené routy, `auth/`) vrací 404 | PASS | PASS | PASS |
| Kořen domény dál vrací placeholder (200) | PASS | PASS | PASS |

V DB nevzniklo nic. Na `moje.vonica.cz` nebylo nic změněno.

## 12. Plán přesunu dema `moje.vonica.cz` → `demo.vonica.cz` (fáze H – jen plán)

### Výchozí fakta

- `moje` běží `design/identity-03@ce20f01+dirty` (build 2026-10-20): **obsahuje necommitnuté změny**, které jsou
  dnes v pracovní kopii (`event-detail`, `_identity.scss`). Z repozitáře tedy produkční obsah reprodukovatelný
  **není**, dokud se tyto změny necommitnou.
- Demo build (`--demo`) potřebuje `dev/local/clenove.tsv` se skutečnými členy (ignorovaný gitem, jen na tomto
  počítači).
- Aplikace je relativní (`<base href="/">`, manifest `start_url`/`scope` `./`). Jediný natvrdo zapsaný host je
  `moje.vonica.cz` v UID exportu kalendáře (`ics.ts`). UID má jen zajistit jedinečnost a může zůstat.
- Basic Auth na `moje` je generovaná deploy skriptem (`.htpasswd` + `AuthUserFile` s absolutní cestou webrootu
  `moje`), na `demo` ji deploy vygeneruje znovu z `DEMO_BASIC_AUTH_*` a `DEMO_SITE_ROOT_PATH`.
- **Data dema jsou v `localStorage` prohlížeče** (`splk.auth.user`, `splk.settings`, demo data – příspěvky,
  komentáře, položky…). `localStorage` je vázaný na origin. Na `demo.vonica.cz` uvidí každý uživatel čistá
  výchozí demo data a změny provedené na `moje` se nepřenesou.
- Na `moje` je registrovaný Angular service worker. Klientům bude dál servírovat uloženou aplikaci, dokud
  nezjistí změnu `ngsw.json`.

### Kroky

**A. Záloha `moje` (read-only)** – stáhnout celý webroot `moje` přes SFTP (včetně `.htaccess`, `.htpasswd`) do
`dev/local/backup-moje-<datum>/` (mimo Git) a uložit seznam souborů se SHA-256.

**B. Reprodukovatelný build** – rozhodnutí uživatele: commitnout současné změny na `design/identity-03`, aby šlo
nasadit `--ref` místo `working`. Bez toho lze nasadit `--source working` (opět `+dirty`).

**C. Kopírování aplikace na `demo`** (vyžaduje schválení):

```bash
npm run deploy -- --target demo --ref design/identity-03 --demo --dry-run
npm run deploy -- --target demo --ref design/identity-03 --demo --allow-foreign-content --yes
```

Deploy nahraje nejdřív `.htpasswd` + `.htaccess` s Basic Auth pro webroot `demo`, pak aplikaci. Placeholder
`index.php` Websupportu odstraní jako zastaralý soubor (proto `--allow-foreign-content`). Na `moje` se v tomto
kroku nic nemění.

Alternativa: 1:1 kopie souborů ze zálohy A (bajtově shodná, včetně `+dirty`). `.htaccess` by ale bylo nutné
ručně přepsat na cestu `demo` a `.htpasswd` na `DEMO_BASIC_AUTH_*`. Doporučuji variantu s buildem z repozitáře.

**D. Ověření `demo`** – 401 bez hesla, 200 s heslem; vnořené routy (`/app/dashboard`, `/app/costumes`,
`/app/events/…`); `build-info.json` a `deploy --target demo --status` odpovídají nasazené revizi; registrace
service workeru; kontrolní průchod hlavních obrazovek.

**E. Změna nasazovací konfigurace** – skill `/deploy` a dokumentace přepnout na `--target demo` pro demo.
`moje` zůstane vyhrazená budoucí produkci.

**F. Uvolnění `moje`** (samostatné schválení, až po D):

1. Informovat výbor: nová adresa, případně nové heslo Basic Auth (`DEMO_BASIC_AUTH_*` se může lišit od
   současného hesla na `moje`), ztráta lokálních změn dat dema.
2. Na `moje` nahradit aplikaci jednoduchou stránkou nebo přesměrováním na `https://demo.vonica.cz/`
   (přesměrování = změna, kterou zadání zatím zakazuje; vyžaduje souhlas).
3. Odstavit service worker: na adrese `ngsw-worker.js` po přechodnou dobu servírovat `safety-worker.js`
   (je součástí Angular buildu), případně nechat `ngsw.json` vracet 404. Angular SW se pak sám odregistruje
   a klienti uvidí nový obsah `moje`.
4. Původní instalaci smazat až po přechodném období. Záloha A zůstává.

**Rollback**

- Do kroku F je `moje` nedotčená, takže rollback = nic nedělat (případně smazat obsah `demo`).
- Po kroku F: nahrát zálohu A zpět na `moje` (SFTP, včetně `.htaccess`/`.htpasswd`).

### Provedení (2026-10-22, schváleno uživatelem)

- **A – záloha:** celý webroot `moje` (126 souborů, 1,4 MB, včetně `.htaccess`/`.htpasswd`) v
  `dev/local/backup-moje-2026-10-22/` se `SHA256SUMS`.
- **B:** uživatel zvolil nasadit současný HEAD `design/identity-03@ce20f01` (čistý, bez necommitnutých změn
  počítadel rychlé odpovědi, které běží na `moje` jako `+dirty`).
- **C – deploy:** `npm run deploy -- --target demo --source commit --demo --allow-foreign-content --yes` –
  124 souborů nahráno, placeholder `index.php` odstraněn, Basic Auth z `DEMO_BASIC_AUTH_*`.
- **D – ověření [HTTP]:** `/`, `/app/dashboard`, `/app/costumes`, `/app/events`, `/app/wardrobe`,
  `/app/groups` → 200 s heslem, 401 bez hesla; `.htaccess` 466, `.htpasswd` 403; `build-info.json` =
  `design/identity-03@ce20f01`, `dirty: false`; všech 121 souborů z `ngsw.json` má správný hash.
  Vizuální kontrola v prohlížeči – uživatel.
- **E, F** – čekají na potvrzení po vizuální kontrole.

Rozlišení:

- **kopírování aplikace** = krok C (jen `demo`);
- **změna nasazovací konfigurace** = krok E (skripty/skill);
- **odstranění původní instalace** = krok F (jen `moje`, samostatné schválení).
