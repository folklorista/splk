# Postup vývoje

## Aktuální stav (2026-09-18)

Hotovo:

- **Fáze 1 (Angular shell)** – kompletní.
- **Fáze 2 (mock modely a API services)** – kompletní, včetně feature services pro všechny níže uvedené moduly.
- **Fáze 3 (klikací prototyp)** – obrazovky Login, Dashboard, Nástěnka + detail, Akce + detail s potvrzením účasti, Skupiny, hrubý placeholder Krojové databáze (stránka Členové byla později zrušena, viz Nástěnky po skupinách) jsou hotové a proklikatelné s mock daty.
- Navíc oproti původnímu plánu: rozpracovaná administrace (CRUD obrazovky pro příspěvky, akce, členy a skupiny) – nad rámec Fáze 3, ale využívá stejné feature services jako běžné obrazovky.

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
- push notifikace,
- platby,
- rodiče a zákonné zástupce,
- složitý workflow půjčování krojů,
- univerzální dynamický REST framework.

## Doporučené MVP

První použitelné MVP by mohlo obsahovat:

1. Přihlášení.
2. Dashboard.
3. Členové.
4. Nástěnka.
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

## Naplánované úpravy (zatím neimplementovat)

- **Označení příspěvku s novou zmínkou**: příspěvek, ve kterém byl přihlášený člen nově zmíněn (@mention v komentáři), označit ve výpisu nástěnky obdobně jako „Nepřečteno“ (např. štítek „Zmínka“). Badge nástěnky v menu už neviděné zmínky započítává (`getBoardBadgeCount`), chybí jen vyznačení u samotného příspěvku.
- **Profil přes jméno uživatele místo položky v menu**: zrušit položku „Můj profil“ (v sidebaru sekce Správa, na mobilu „Profil“ v bottom nav). Na `/app/profile` se uživatel dostane kliknutím na své jméno – na desktopu v patičce sidebaru, na mobilu v headeru.
- **Nástěnky přímo v bottom nav na mobilu**: na místo uvolněné po „Profil“ a místo rozcestníku „Nástěnky“ vypsat v bottom nav jednotlivé nástěnky, jichž je přihlášený členem a které mají nástěnku povolenou (každá s vlastním badge). Otevřené body: `Group` zatím nemá příznak „nástěnka povolena“ – bude potřeba ho doplnit (model, mock data, administrace skupin); vyřešit, co u administrátora (vidí všechny nástěnky, ale v bottom nav jen ty, kde je členem?) a co při větším počtu nástěnek (místo na šířku). Rozcestník `/app/boards` může zůstat jako cíl pro případ přetečení.
- **Administrace v bottom nav pro administrátora**: na mobilu přidat administrátorovi položku „Administrace“ (`/app/admin`), běžní členové ji nevidí.
- **RSVP select na úzkých displejích**: v `event-rsvp-row` na úzkém displeji nahradit tři tlačítka (Ano / Možná / Ne) jedním selectem s prázdnou volbou (= neodpovězeno) a volbami Ano / Možná / Ne, aby zůstalo místo na čas a název akce.
- **Kompaktní seznam akcí**: v seznamu akcí (`/app/events`) použít stejný kompaktní `event-rsvp-row` jako pod kalendářem a na přehledu – bez detailního popisu akce a počtů přihlášených.
- **Filtry v seznamu akcí**: v seznamu akcí filtrovat podle typu (`EventType` – nácvik, vystoupení, soustředění, schůzka, ostatní) a podle mé odpovědi (potvrzené / nepotvrzené mnou). Filtry lze kombinovat.
- **Tooltip dne v kalendáři**: při hoveru na den v měsíčním kalendáři zobrazit akce toho dne s časem začátku („18:00 – Nácvik“). Jen pro zařízení s hoverem; na mobilu stačí stávající výpis akcí vybraného dne.
- **Poznámky k účasti viditelné pro všechny**: poznámka k účasti se teď ukládá, ale vidí ji jen autor. V sekci „Účast“ v detailu akce u jména člověka s poznámkou zobrazit příznak (ikonka komentáře); text poznámky se ukáže v tooltipu při hoveru, na mobilu po kliknutí na jméno.
- **Zmínky při psaní přes „@“ a vyznačené v textu komentáře**: zmínka se teď vybírá zvlášť (select „@ Zmínit“) a ukládá jen do `mentionedMemberIds`, v textu komentáře není vyznačená. Nově:
  - Po napsání „@“ v textarea komentáře vyskočí nabídka členů, které lze na nástěnce zmínit. Text psaný za „@“ (až po kurzor) nabídku filtruje, bez ohledu na diakritiku a velikost písmen. Ovládání myší i klávesnicí (šipky, Enter vybere, Esc zavře). Select „@ Zmínit“ odpadne.
  - Po výběru se rozepsané „@Jak“ nahradí „@Jakub Hoza“ a komponenta si pamatuje vybrané členy. Při odeslání se v textu tato jména převedou na token (např. `@[member:1]`). Když uživatel jméno v textu mezitím přepíše nebo smaže, zmínka se neuloží.
  - `mentionedMemberIds` se odvodí z tokenů v textu.
  - Při vykreslení se token nahradí graficky odlišeným jménem člena. Text se rozparsuje na segmenty v šabloně, ne přes `innerHTML` (XSS). Mock data komentářů upravit na nový formát.
  - Bez nové knihovny: obyčejná textarea + vlastní nabídka pod ní (ne `contenteditable`).
- **Administrace až po členské části**: administrace bude potřebovat ještě řadu úprav (doplnit vše, co se v ní má spravovat). Priorita je nejdřív dotáhnout části viditelné běžným členům, administraci projít a doplnit až potom.
- **Řazení příspěvků a archiv na nástěnce**: příspěvky na nástěnce řadit od nejnovějších (nahoře) po nejstarší (dole). Pod nimi oddělovač s tlačítkem „Zobrazit archivované“, po kliknutí se pod ním vypíšou i archivované příspěvky (také od nejnovějších).
- **Přímý odkaz na příspěvek (i archivovaný) nesmí odhlásit**: detail archivovaného příspěvku sám o sobě funguje (`getPost` archiv nefiltruje). Odhlášení způsobuje to, že `AuthService` drží přihlášeného uživatele jen v paměti. Jakékoli otevření URL přímo (vložení do adresního řádku, reload, odkaz z notifikace) proto ztratí přihlášení a `authGuard` přesměruje na `/login`. U archivovaného příspěvku se to projeví nejvíc, protože z výpisu na něj zatím nevede odkaz. Řešení: přihlášení si pamatovat i po reloadu (v mock režimu např. v `localStorage`, později podle skutečné autentizace backendu). Po přihlášení vrátit uživatele na původně požadovanou URL. Souvisí s tím, že ani archivace (a další změny příspěvků v `postsCache`) zatím reload nepřežije – zvážit perzistenci mock příspěvků v `localStorage` podobně jako u komentářů.
- **Nepotvrzené akce v záhlaví seznamu akcí**: upozornění „N akcí čeká na tvoji odpověď“ přesunout z `/app/profile` do záhlaví stránky Akce (seznam akcí). Kliknutí na něj může rovnou zapnout filtr „nepotvrzené“.
- **Stránky Profil a Nastavení vedle sebe**: vedle `/app/profile` vytvořit `/app/settings`. V patičce sidebaru (na mobilu v headeru) přibude vedle tlačítka „Odhlásit se“ ikonka ozubeného kolečka vedoucí na Nastavení. Na profil se jde kliknutím na jméno (viz výše). Obě stránky budou časem přibývat o další položky. Rozdělení: **Profil** = údaje o mně (vidí je ostatní nebo vedení souboru), **Nastavení** = jak se mi aplikace chová.
- **Rozšířený profil**:
  - Zobrazované jméno / přezdívka (např. „Mrož“ místo „Michal Musil“). Bude se zobrazovat v aplikaci místo celého jména. Celé jméno zůstane pro administraci a seznamy (zájezdy). Zmínky přes „@“ mají hledat podle přezdívky i celého jména.
  - Nepovinně číslo pasu a datum konce jeho platnosti (pro seznamy členů na zahraniční zájezdy). Citlivý osobní údaj: vidí ho jen člen sám a administrátor, ne ostatní členové. Upozornit, pokud pas brzy vyprší (např. do 6 měsíců).
- **Nastavení – notifikace**: zapínání notifikací přesunout z `/app/profile` do `/app/settings`. Rozšířit o výběr skupin, ze kterých chci notifikace dostávat (odběr po nástěnkách). Otevřený bod: zmínky přes „@“ by měly upozornit vždy, bez ohledu na odběr skupiny.
- **Nastavení – vzhled**: přepínač režimu světlý / tmavý / automatický (podle systému). Barvy přes CSS proměnné, volba uložená v zařízení.
- **Nastavení – další návrhy**:
  - Velikost písma (normální / větší / největší) – přístupnost pro starší členy.
  - Výchozí zobrazení stránky Akce (seznam / kalendář).
  - Omezit animace (výchozí podle systému, `prefers-reduced-motion`).
  - Volbu fontu nedoporučuji – víc fontů komplikuje vzhled a velikost písma pokryje hlavní potřebu (čitelnost).
