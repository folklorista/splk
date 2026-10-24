# Registr rozhodnutí

Platná rozhodnutí projektu (úroveň **A**). Každé má datum, zdroj a dokumenty, kterých se týká. Pokud podrobný dokument s registrem nesouhlasí, **platí registr** a dokument je třeba opravit.

Nerozhodnuté věci jsou v [`open-questions.md`](open-questions.md). Historické a překonané návrhy jsou v [`archive/`](archive/).

Pravidla registru:

- Rozhodnutí se nepřepisuje. Když se změní, staré se označí *nahrazeno D-xx* a přidá se nové.
- Zdroj „uživatel 2026-10-22“ znamená výslovné rozhodnutí vlastníka produktu při konsolidaci dokumentace 22. 10. 2026. Důvody, které nebyly uvedeny, se nedoplňují.

---

## Produkt a rozsah

### D-01 Konkrétní aplikace, ne univerzální framework

Pevné doménové moduly, žádné dynamické REST API nad libovolnou tabulkou ani univerzální renderer formulářů. Konfigurovat jen to, co se mezi organizacemi opravdu liší.
**Zdroj:** `archive/00-prehled.md` (2026-06-23), `current/04-styl-prace.md`, poučení z předchozí krojové databáze.

### D-02 Rozdělení na aplikace; Krojařka je jediná priorita

| Adresa | Účel | Stav |
|---|---|---|
| `krojarka.vonica.cz` | Samostatná aplikace **Krojařka** pro správu krojového fondu | **jediná současná priorita** |
| `api.vonica.cz` | Společný PHP REST backend; postupně slouží všem frontendům | vzniká spolu s Krojařkou |
| `moje.vonica.cz` | Budoucí členský informační systém | **vývoj odložen** |
| `demo.vonica.cz` | Dosavadní prototyp (Angular, data v prohlížeči) | demo/prototyp, ne cílová architektura ani grafika |

Pojem **„V1.0“ se nepoužívá**, protože byl nejednoznačný (`07` jím myslí první ostrý provoz, `08` vydané demo). Starší roadmapy a pořadí vývoje (`archive/03`, `current/moje/07` kap. XII) jsou historické.
**Zdroj:** uživatel 2026-10-22; `current/hosting-postgresql-api-auth.md` (domény).

### D-03 Monorepo s více aplikacemi

Krojařka, API a později `moje` budou v jednom repozitáři jako samostatně nasaditelné aplikace. Konkrétní rozvržení a hranice sdíleného kódu viz Q-10.
**Zdroj:** uživatel 2026-10-22.

### D-04 Nejdřív stávající model; digitalizace je nepovinná

Nový modul, entita nebo položka menu potřebuje konkrétní důvod (strukturované hledání, výpočet, kontrola). Aplikace nenahrazuje osobní domluvy.
**Zdroj:** `current/04-styl-prace.md`, `current/moje/07` kap. 7 a 40 (2026-10-18).

### D-05 Krojová evidence je autoritativní, docházka orientační

Krojový sklad musí zachytit skutečné předání a odpovědnost. Docházka slouží k organizaci, ne k sankcím.
**Zdroj:** `current/moje/05`, `current/moje/07` kap. 7 (2026-10-18).

## Organizace, identita a oprávnění

### D-06 Model se složkami; jedna instalace = jedna organizace

- **Úroveň 1 = organizace = jedna instalace** s vlastní databází, přihlášením a konfigurací.
- **Úroveň 2 = složky** (`Unit`) uvnitř instalace.

| Instalace (úroveň 1) | Složky (úroveň 2) |
|---|---|
| Slovácký soubor **Vonica** | dospělá složka (Vonica), Malá Vonica, Děvčice z Vonice, muzika |
| **Vonička** Zlín, z. s. | Vonička I, Vonička II, Vonička III |

Mezi instalacemi se nesdílí účty ani osoby.

Model z 18. 10. 2026, kde jsou dospělá a Malá Vonica samostatné soubory se společnou globální identitou a přepínačem kontextu, se **nepoužívá**. `ensemble_id` může v modelu zůstat jen jako rezerva pro případný budoucí multi-tenant provoz.
**Zdroj:** uživatel 2026-10-22; `context/` (vonica.md, vonicka.md); `current/identity-model-v2.md`.
**Nahrazuje:** cílový model více souborů v `archive/00`, `archive/02`, `current/01`, `current/moje/07` kap. 15/52/55 a `current/moje/10` kap. 4.1a.

### D-07 Identita: osoba ≠ účet ≠ příslušnost ≠ pověření

Implementovat podle `current/identity-model-v2.md`:

- `Person`, `UserAccount` (0..1 na osobu);
- `UnitAffiliation` (zájemce / aktivní, s historií);
- `GroupMembership` s historií;
- `Representation` (zastupování dítěte);
- `PositionAssignment` (funkce s historií);
- **formální členství ve spolku** (Vonička);
- **„přijatý člen“** (Vonica).

Jde o konceptuální model, ne o schválené databázové schéma. Otevřené detaily jsou Q-08 a Q-09; „přijatý člen“ viz D-30.
**Zdroj:** uživatel 2026-10-22.

### D-08 „Člen souboru“ = člen dospělé složky

V terminologii Vonice „člen souboru“ znamená člena dospělé taneční složky. Obecný „člen celé Vonice“ v praxi neexistuje. Viz [`context/glossary.md`](context/glossary.md).
**Zdroj:** uživatel 2026-10-22; vonica.md.

### D-09 Oprávnění = pověření; bez superadministrátora

- Organizační funkce nejsou systémové role. Pravomoc vzniká jen **pověřením** s vymezeným rozsahem.
- Správa (osob, skupin, konfigurace) nedává právo číst obsah.
- **Role superadministrátora neexistuje.** Nouzový zásah je možný jen přímo v databázi, mimo aplikaci.

**Zdroj:** `current/moje/08` kap. 1.1 a 3 (2026-10-16, implementováno v demu); uživatel 2026-10-22 (bez superadmina).
**Nahrazuje:** role host / člen / vedoucí / administrátor / superadministrátor v `current/moje/07` kap. 9 a 10.

### D-10 Rozsahy pověření

**soubor (organizace) / složka / skupina / akce / modul.** Ne každý druh pověření musí podporovat každý rozsah.
**Zdroj:** uživatel 2026-10-22. **Rozšiřuje:** `current/moje/08` kap. 3 (soubor / skupina / akce / modul).

## Technologie a provoz

### D-11 Backend: PHP 8.5 REST API + PostgreSQL 18

Hosting Websupport, `api.vonica.cz`. Databáze **PostgreSQL 18** (UTF-8, `cs_CZ` collation), přístup přes PDO s nativními prepared statements.
**Zdroj:** uživatel 2026-10-22; ověřeno v `current/hosting-postgresql-api-auth.md`.
**Nahrazuje:** „PHP + MySQL“ v `current/01`, README a `archive/03`. Lokální `docker-compose.yml` používá od 2026-10-22 také PostgreSQL 18 (port 5433).

### D-12 Autentizace: serverové sessions v PostgreSQL

- Host-only cookie `__Host-…` na `api.vonica.cz` (`Secure`, `HttpOnly`, `SameSite=Lax`).
- V databázi se ukládá jen hash tokenu.
- CSRF token v hlavičce `X-CSRF-Token`, allowlist originů, pouze JSON.
- Bez JWT, bez tokenů v `localStorage`, bez sdílené cookie `.vonica.cz`.
- Hesla Argon2id.

**Zdroj:** `current/hosting-postgresql-api-auth.md` kap. 6–8 (ověřeno v Chrome 2026-10-22); uživatel 2026-10-22 („řešeno“).

### D-13 Veřejný přístup k databázi omezit na IP

**Zdroj:** `current/hosting-postgresql-api-auth.md` kap. 10 (rozhodnuto 2026-10-22). **Provedeno 2026-10-23:** povolena domácí IP vývojáře (dynamická – při změně aktualizovat v administraci). Ověřeno, že API na hostingu se připojuje dál a spojení z povolené IP běží přes TLS 1.2.

### D-14 Polling, ne WebSocket

**Zdroj:** `current/01`, `current/moje/08` kap. 11.2.

### D-15 Architektura frontendu

`komponenta → feature service → API service / mock service`. Mock a HTTP implementace musí být zaměnitelné. Angular standalone, bez NgModules.
**Zdroj:** `CLAUDE.md`, `current/01`.

### D-16 Zálohy: provozní kompromis

Denní záloha u poskytovatele (14 dní) a vlastní týdenní šifrovaný export mimo hosting s testem obnovy.
**Zdroj:** `current/01` (2026-10-18). **Platí i pro PostgreSQL (2026-10-23):** hosting zálohuje každou databázi jednou za 24 h, zálohy drží nejvýše 14 dní, umožňuje ruční zálohu, databáze nad 2 GB zálohuje jen týdně. Pro delší uchování doporučuje stáhnout zálohu jako `.sql`. Vlastní týdenní export a test obnovy zůstávají úkolem.

## Kroje a aplikace Krojařka

### D-17 Terminologie

| Pojem | Význam |
|---|---|
| **Krojařka** (velké K) | název aplikace na `krojarka.vonica.cz` |
| **krojařka** | osoba s pověřením ke krojům; pomocnice jsou také krojařky |
| **sklad** | místnost s nezapůjčenými kroji |
| **Správa krojů** | agenda v budoucí `moje` |

Nepoužívat „krojárna“ ani „krojárka“. Adresu `krojarka.vonica.cz` bez diakritiky lze ponechat.
**Zdroj:** `CLAUDE.md`, `current/moje/10` kap. 11.1 (2026-10-18); uživatel 2026-10-22 (název aplikace a doména).

### D-18 Základ krojové evidence

- Základem je fyzický kus se stabilní identitou.
- Evidenční řady jsou samostatné; identita kusu ≠ evidenční číslo.
- Evidenci mění jen krojařky.
- Držiteli mohou být i externisté a bývalí členové.
- Odpovědnost se řídí oficiální evidencí.
- „Nezkontrolováno“ ≠ „nepředloženo“ ≠ „chybí“.
- Inventuru s nesrovnalostmi lze uzavřít jen výslovně a s důvodem.

**Zdroj:** `current/06` v0.4 i `archive/06-…-v0.3` shodně.

### D-19 Fyzické komplety

- Komplet je **fyzická jednotka**: taška nebo ramínka v jednom obalu s lístkem, na kterém je výčet součástek.
- **Nemá pevnou strukturu.** Komplety téže řady se mohou lišit složením.
- Může obsahovat i **nečíslované zaměnitelné doplňky evidované počtem** (např. 2 mašle).
- Sklad eviduje výpůjčky kompletu. Lze **vydat celý komplet**. Inventura umí **kontrolu kompletu**.

**Zdroj:** uživatel 2026-10-22.
**Nahrazuje:** „komplet = šablona druhů“ a odklad množstevních položek v `06` v0.4. Navazuje na model v0.3 (`archive/06-…-v0.3.md`). Detaily viz Q-04.

### D-20 Opakované použití evidenčních čísel

Ve výchozím nastavení **povoleno** u všech řad. U konkrétní řady ho lze konfigurací **zakázat**. Historie starého a nového kusu se nikdy nespojí.
**Zdroj:** uživatel 2026-10-22. **Nahrazuje:** výchozí „nepovolovat“ v `06` v0.4 kap. 13.2.

### D-21 Krojový fond a pověření podle složky

- Krojařka pracuje jen v rozsahu svého pověření (složka).
- Krojařky různých složek si **navzájem nevidí do evidence**, jen do seznamů lidí.
- Pomocnice jsou v Krojařce **rovnocenné** hlavní krojařce. Rozdíly existují jen mimo aplikaci, např. hlasování ve výboru.
- Muzika vlastní krojařku nemá a půjčuje si od dospělé složky.

| Instalace | Krojařky (stav 2026-10) |
|---|---|
| Vonica | Lucka Š (dospělá složka; pomocnice Anička Z, Terka P), Danča (Malá Vonica), Broňa (Děvčice) |
| Vonička | Gabča (Vonička I), Anuška (Vonička II a III) – fondy jsou rozdělené po složkách (D-29) |

**Zdroj:** uživatel 2026-10-22; vonica.md (pomocnice).

### D-22 Navigace Krojařky (boční menu)

**Přehled · Součástky · Krojové karty · Lidé · Výpůjčky · Inventury · Dokumenty · Přehledy · Hledat · Nastavení · Můj účet**

- **Součástky:** katalog podle evidenčních řad, včetně kompletů.
- **Krojové karty:** lidé s výpůjčkami.
- **Lidé:** všechny osoby evidence, i bez výpůjček (papírová karta, převod na digitální evidenci).
- **Výpůjčky:** skladové pohyby od nejnovějších.
- **Dokumenty:** archiv skenů a podkladů (osobní karty, karty a lístky kompletů, kniha zápůjček).
- **Přehledy:** tisk a export.

Zda komplety vyčlenit do samostatné položky, je Q-04. Podoba mobilní lišty je Q-17.
**Rozšíření 2026-10-23:** položky Lidé, Dokumenty a Přehledy doplněny podle Q-17 (uživatel).
**Zdroj:** uživatel 2026-10-22. **Nahrazuje:** menu v `current/krojarka/frontend-demo-specifikace.md` kap. 3.1 (Přehled / Lidé / Sklad / Inventury…).

### D-23 Základní finanční evidence je součástí Krojařky

Minimálně základní evidence financí patří do základu aplikace Krojařka.

**Rozsah (2026-10-23, Q-03):** evidovat **náklady na kroje**, hlavně pořízení nových součástek, aby je pokladník mohl souhrnně předložit v účetnictví a vyúčtovat proti dotaci na provoz. Nejde o pokladnu ani o účetnictví. Konkrétní údaje (doklad, datum, částka, dodavatel, vazba na kusy, účel nebo dotace) a přístup pokladníka se navrhnou spolu s obrazovkami.
**Zdroj:** uživatel 2026-10-22 a 2026-10-23; vonica.md (TODO pokladna, výdaje za kroje).

### D-29 Krojové fondy Voničky jsou rozdělené po složkách

Stejně jako u Vonice má každá složka Voničky (I, II, III) vlastní krojový fond. Krojařka spravuje fondy složek, ke kterým má pověření (Anuška II i III).
**Zdroj:** uživatel 2026-10-23 (Q-01). Údaj „jeden společný krojový fond“ ve vonicka.md je zastaralý a vonicka.md je k aktualizaci.

## Identita (doplnění)

### D-30 „Přijatý člen“ nemá v aplikaci žádná práva navíc

Je to jen evidovaná historická skutečnost (rok, kmotr nebo kmotra). Není podmínkou funkce ani pověření. Funkce ve výboru vzniká volbou na schůzi, ne v aplikaci.
**Zdroj:** uživatel 2026-10-23 (Q-07); vonica.md. **Nahrazuje:** „potvrzené pravidlo“ v `current/identity-model-v2.md` kap. 2.1.

## Postup vývoje (doplnění 2026-10-22)

### D-31 Krojařka nepřebírá kód z dema

Krojařka vzniká jako nová aplikace s vlastním UI. Z dema (`frontend/`, `/app/wardrobe`) se **nepřebírají** komponenty, services, modely ani testy. Doménová pravidla se berou ze specifikací (`current/06` v0.5, zadání Krojařky), ne z kódu dema.
**Zdroj:** uživatel 2026-10-22. **Nahrazuje:** „Demo využije jako východisko existující implementaci Správy krojů“ v `current/krojarka/frontend-demo-specifikace.md` kap. 1.1 a požadavek na znovupoužití krojového modulu ve starším zadání migrace.

### D-32 Plán architektonického experimentu se nepoužívá

Pořadí „identita na mock datech → frontend → DB/API“ neplatí. Model identity (D-06, D-07) se implementuje rovnou v API a v Krojařce. Plán je archivovaný v `archive/plan-architektonickeho-experimentu.md`.
**Zdroj:** uživatel 2026-10-22 (Q-12).

### D-33 Demo se nekonzervuje

Pro demo se nezakládá archivní větev ani tag. Demo zůstává na `demo.vonica.cz` a jeho kód v repozitáři, ale dál se nerozvíjí.
**Zdroj:** uživatel 2026-10-22.

## Krojařka (doplnění 2026-10-23)

### D-34 Výchozí filtr nabídky podle výchozího kroje osoby

Výdej není nikdy omezen skupinou ani pohlavím. Při výdeji se ve výchozím stavu nabízejí součástky odpovídající výchozímu kroji osoby (kluk → klučičí kroje). Volitelný přepínač **„nabízet krojové součástky pro opačné pohlaví“** zpřístupní ostatní kusy (masopustní maska, půjčení v rodině).
**Zdroj:** uživatel 2026-10-23 (Q-02). **Nahrazuje:** „řazení nabídky“ v `06` kap. 5.1a a pravidlo `costume_category_allowed_groups` v `archive/02`.

### D-35 Komplety mají vlastní řady; nečíslované doplňky i mimo komplet; žádné šablony

- Komplety mají **vlastní evidenční řady a čísla**.
- Nečíslované součástky lze **evidovat a půjčovat i mimo komplet**.
- **Šablony kompletů se nepoužívají.**

**Zdroj:** uživatel 2026-10-23 (Q-04). **Doplňuje:** D-19.

### D-36 Účty jen pro čtení

Krojařka umožní účty s přístupem **jen pro čtení** (pověření Náhled do správy krojů), např. pro audit práce krojařek.
**Zdroj:** uživatel 2026-10-23 (Q-14).

## Krojařka – odpovědi krojařky (2026-10-23, Q-05)

### D-37 Číselník a řady

- Řady vycházejí z číselníku `current/krojarka/krojovy-katalog-vonica.md` / `.json` (verze `navrh-2`).
- **Nečíslované** součásti: kytička, korále, mašle barevné, mašle bílá. Kufry a tašky se **neevidují**.
- Varianta **může** mít vlastní číslování (košile Velická / Novolhotská), ale **nemusí** (červené / žluté rukávce).
- **Slovensko** se dělí na oblasti Zemplín a Moravské Lieskové; mohou přibýt další. K Moravskému Lieskovému patří zatím jen košile Moravské Lieskové, všechny ostatní slovenské součástky k Zemplínu.
- **Obuv:** některá patří jen k jednomu regionu (horňácké tvrdé čižmy). „Univerzální“ měkké boty (Zemplín, Moravské Lieskové) lze vydat jako náhradu.
- „Šátek bílý, jatelinka, červený“ jsou tři druhy. „Klobouk+bambulky“ je jedna součástka; chybějící bambulky jdou do poznámky.
- Slovenská košile × slovenská košile stuhová, kopanická × zemplínská spodnica, kopanická × zemplínská čelenka jsou **různé řady**.
- U žádné řady Vonice se zatím nezakazuje opakované použití čísla (možnost zůstává pro jiné instalace, D-20).

### D-38 Provozní pravidla

- Neúplný komplet se vydává s poznámkou. (Na papír se dnes zapisuje jen číslo kompletu a nesoulad do poznámky.)
- Inventuru s nesrovnalostmi smí uzavřít **každá krojařka**, vždy s důvodem.
- Výchozí kroj osoby: mužský / ženský / neurčeno.
- Pracovní úkoly: otevřený / rozpracovaný / hotovo / zrušeno, bez schvalování. **Stavy musí jít později doplnit** bez přestavby.
- Termíny inventurních návštěv jsou samostatné, nenavázané na kalendář.
- Vlastní součástka člena (např. krpce) = poznámka na krojové kartě osoby.

### D-39 Přehledy a soupisy

Soupis podle řady, podle člověka, současný a historický soupis konkrétní součástky a filtrované dotazy (potřebuje opravu, zapůjčeno externistům, pořízeno mezi daty…). Podrobně `current/06` kap. 10.

### D-40 Papírové karty a skeny

- Při převodu osoby stačí **poslední fotka** karty.
- Převod smí být dokončen i s nesrovnalostmi.
- Jeden sken na krojovou kartu, **bez OCR**.
- Skeny slouží jen k digitalizaci. Potom se **zazipují, uloží do souborového digiarchivu mimo aplikaci a z aplikace se odstraní**.

**Zdroj D-37 až D-40:** uživatel za krojařku 2026-10-23 (Q-05).

## Repozitář a nástroje (2026-10-23, Q-10)

### D-41 Rozvržení monorepa

- `apps/` – frontendové aplikace (`krojarka`, později `moje`, případně `pokladna`, `kronika`, `admin`…), každá samostatně sestavitelná a nasaditelná.
- `packages/` – sdílené TS knihovny: `api-contracts` (DTO a typy API), `domain` (čisté TS modely a pravidla), `ui` (identita, ikony, styly, případně komponenty). Sdílí se jen to, co má jasné použití.
- `api/` v kořeni – jedna společná serverová aplikace.
- Demo zůstává ve `frontend/` a **nepřesouvá se** (2026-10-23).

Podrobný strom a hranice: `current/monorepo-struktura.md` (schváleno). API a schéma: `current/api-v1-a-schema.md` (D-57).
**Zdroj:** uživatel 2026-10-23. **Upřesňuje:** D-03.

### D-42 Angular pro Krojařku: aktuální stabilní verze

Krojařka používá aktuální podporovaný stabilní Angular (2026-10-23: **22.2.x**, TypeScript 6.0, Node ^22.22.3 / ^24.15). Demo zůstává na Angularu 19.
**Zdroj:** uživatel 2026-10-23; ověřeno `npm view`.

### D-43 PHP bez velkého frameworku

Čisté PHP 8.5, Composer, PSR-4 autoloading (jmenný prostor `Splk\Api\`, moduly `Domain\{Identity, Units, Costumes, Costs, Attachments}`), malé osvědčené knihovny podle potřeby.
**Zdroj:** uživatel 2026-10-23.

### D-44 Testy API: PHPUnit

Hlavně testy autorizace, datové integrity a doménových operací.
**Zdroj:** uživatel 2026-10-23.

### D-45 Migrace: Phinx

Migrace nesmí běžet při běžném HTTP požadavku. Před produkční migrací musí jít vytvořit zálohu. **Spouštějí se z vývojového stroje** proti produkční DB přes TLS: stav → záloha `pg_dump` → migrace → nahrání kódu → ověření (`current/monorepo-struktura.md` kap. 5).
**Zdroj:** uživatel 2026-10-23.

### D-47 Node.js 24 LTS

Pro celý repozitář (Krojařka s Angularem 22 i demo s Angularem 19). Node běží jen při vývoji a buildu.
**Zdroj:** uživatel 2026-10-23.

### D-58 Testy Krojařky: Vitest

Krojařka používá výchozí test runner Angularu 22 – **Vitest** (jsdom). Demo zůstává na Karma + Jasmine. Testy jsou zaměřené na logiku (přihlášení, guardy, interceptory, datové adaptéry), ne na vzhled.
**Zdroj:** uživatel 2026-10-23. **Upřesňuje:** CLAUDE.md (Testování).

### D-59 Krok 3: složky Vonice, výchozí katalog a správa pověření

- Seed založí složky Vonica, Malá Vonica, Děvčice z Vonice (s krojovým fondem) a Muziku (bez fondu, D-21).
- Výchozí katalog ze skladových karet (D-37) dostane **jen fond dospělé Vonice**. Ostatní fondy si regiony, druhy a řady založí v Nastavení.
- Obrazovka **Nastavení → Uživatelé a pověření** (D-48) vzniká už v kroku 3: osoby, pozvánka k účtu e-mailem (odkaz platí 7 dní), zablokování účtu, přidělení a odebrání pověření.
- Pověření se neodebírá smazáním, ale příznakem `revoked_at` (historie zůstává). Poslední použitelnou správu organizace nelze odebrat.
- Regiony, druhy a řady se nemažou, archivují se (`archived_at`). Druh a typ součástky řady se po založení nemění.

**Zdroj:** uživatel 2026-10-24 (dvě volby před krokem 3); technické body [N] podle `current/api-v1-a-schema.md` kap. 2.1.

### D-60 Kontakty osob jsou společné krojařkám, krojové poznámky zůstávají po fondech

- Kontakty osob jsou společné všem krojařkám, tedy osobám s platným `costumes.manage` pro některý krojový fond; vztahuje se i na externisty bez příslušnosti ke složce.
- Krojové poznámky a stav papírové karty zůstávají po fondech v `costume_holder_profiles`; sdílení kontaktu nezpřístupňuje cizí výpůjčky, fondové poznámky ani náklady.
- Tím se výslovně doplňuje seznam sdílených údajů z D-21 o kontakt. Pověření jen pro čtení tím nezískává nový přístup ke společným kontaktům; správa organizace má nadále vlastní rozhraní pro osobní údaje (D-48).

**Zdroj:** uživatel 2026-10-24 (odpověď na Q-18: „Kontakty sdílet všem krojařkám; poznámky ke krojům zůstávají po fondech.“). Vymezení technických pověření navazuje na D-18, D-21 a D-36.

## API v1 (2026-10-23, `current/api-v1-a-schema.md` kap. 7)

### D-48 Správa organizace v Krojařce

Účty, osoby, skupiny a pověření spravuje osoba s pověřením `organization.admin` (bez přístupu do krojových fondů) na obrazovce Nastavení → Uživatelé a pověření. První účet vytvoří seed.

### D-49 Obnova hesla e-mailem; pokladník a náklady

- Zapomenuté heslo se obnovuje **odkazem e-mailem** už ve v1. Odesílá se přes SMTP Websupportu (ověřeno na jiném projektu).
- Pokladník (`costs.view`) čte náklady na kroje všech fondů **včetně kusů, ke kterým se náklad váže**.

### D-50 Výchozí kroj je jeden u osoby

Platí pro všechny fondy.

### D-51 Skupiny už ve v1

Kvůli rozsahu inventury podle skupiny („kroje muzikantů“, 06 kap. 7.1).

### D-52 Výdej jiné složce už ve v1

Například 10 kompletů z Malé Vonice dospělé Vonici (06 kap. 6B). Dočasný příjem od cizích organizací zůstává mimo v1.

### D-53 Přihlášení e-mailem

**Zdroj D-48 až D-53:** uživatel 2026-10-23.

## Hosting (ověřeno 2026-10-23)

### D-46 Spojení API → PostgreSQL a PHP prostředí

- Z PHP na hostingu vede spojení na `localhost` / `127.0.0.1` (sem se překládá i `PG_HOST`) přes lokální proxy do databázového serveru v privátní síti, **bez TLS**.
- Unixový socket neexistuje.
- `host=localhost` tedy **nic nezmění**. Šifrování na privátní síti závisí jen na poskytovateli.
- opcache je zapnutý v režimu **jen souborové cache** (`file_cache_only=1`) a nastavit ho nelze.
- `display_errors` je na `api` vypnuté.
- HTTP cache poskytovatele je na `demo` a `krojarka` během vývoje vypnutá.

**Zdroj:** test na `api.vonica.cz` 2026-10-23 (dočasný skript, po testu odstraněn); uživatel 2026-10-23.

### D-54 Webroot `api` je `public/`; konfigurace a přílohy mimo web

V administraci hostingu je u `api.vonica.cz` nastaven vlastní kořenový adresář `/vonica.cz/sub/api/public`. SFTP účet API vidí i nadřazený adresář:

- `config/` – přístupové údaje k DB, SMTP;
- `storage/` – soubory příloh;
- `src/`, `vendor/`.

Nic z toho není z webu dostupné. Ověřeno testem 2026-10-23.
**Zdroj:** uživatel 2026-10-23 (nastavení); `current/api-v1-a-schema.md` kap. 8.

### D-55 Odesílání e-mailů ze schránky `krojarka@vonica.cz`

- API posílá e-maily (obnova hesla, pozvánky) přes SMTP `smtp.websupport.cz:465` (SSL) ze schránky `krojarka@vonica.cz`.
- Přístupové údaje: `.env` `KROJARKA_EMAIL_*`, na serveru `config/` (D-54).
- Nastavení schránky: POP3 vypnout, IMAP ponechat, GEO ochrana Česko + Slovensko, **bez filtru podle IP** (odchozí adresa hostingu je privátní a veřejná se nedá zjistit).
- Přihlášení ze serveru `api` ověřeno 2026-10-23, zatím bez odeslání zprávy.
- Doména má SPF s `include:_spf.websupport.cz`. DMARC nastaven 2026-10-23: `_dmarc.vonica.cz TXT "v=DMARC1; p=none; rua=mailto:krojarka@vonica.cz"` (jen sledování, platí pro celou doménu včetně `vonica@vonica.cz`). Zkušební e-mail 2026-10-23 dorazil. **DKIM ověřen 2026-10-23:** Websupport podepisuje selektorem `mail` (`d=vonica.cz`, rsa-sha256, relaxed/relaxed); veřejný klíč přidán u web4u jako `mail._domainkey.vonica.cz TXT`; podpis druhého zkušebního e-mailu ověřen proti klíči v DNS (shoda otisku těla i podpisu).

Pozor: hodnoty v `.env` obsahující `#` musí být v uvozovkách, jinak se useknou.
**Zdroj:** uživatel 2026-10-23; test na `api.vonica.cz`.

### D-56 E-mailová knihovna: PHPMailer

**Zdroj:** uživatel 2026-10-23.

### D-57 Schválení API v1 a schématu

Návrh `current/api-v1-a-schema.md` je schválen jako základ implementace Krojařky a API, včetně pořadí kroků v kap. 6.
**Zdroj:** uživatel 2026-10-23.

## Odložené, ale schválené cíle pro `moje.vonica.cz`

Platí jako cílové chování pro dobu, kdy se vývoj `moje` obnoví. Teď se nevyvíjejí. Pokud odporují D-06 (model se složkami), platí D-06.

| # | Rozhodnutí | Zdroj |
|---|---|---|
| D-24 | Offline jen pro čtení (IndexedDB, ETag, bez offline zápisů) | `current/01` |
| D-25 | DM: serverové šifrování XChaCha20-Poly1305, oprávnění podle účastníka konverzace | `current/moje/09` kap. 13 (ADR) |
| D-26 | Skupina: aktivní → archivovaná → smazaná; historie chatu otevřená / od vstupu | `current/moje/08` kap. 10.3 a 10.5 |
| D-27 | Skupinový chat ve všech skupinách s automatickým seskupováním komentářů | `current/moje/08` kap. 1.1 |
| D-28 | Navigace: osobní spodní lišta (Přehled + 4 místa + Více) | `current/moje/10` kap. 6 |
