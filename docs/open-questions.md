# Otevřené otázky

Co ještě musíme rozhodnout (úroveň **B**). Každá otázka uvádí, odkud pochází, jaké jsou varianty a co blokuje. Po rozhodnutí se otázka přesune do [`decisions.md`](decisions.md) jako nové D-xx a tady se označí *rozhodnuto → D-xx*.

Čísla otázek se nepřečíslovávají; mezery v řadě jsou otázky sloučené do jiných.

**Blokuje Krojařku** = bez odpovědi nelze dokončit demo nebo API Krojařky.

---

## Blokuje Krojařku

### Q-01 Vonička: jeden společný krojový fond, nebo fondy po složkách?

- `context/vonicka.md`: „jeden společný krojový fond pro skupiny I, II a III“.
- Uživatel 2026-10-22: Gabča je krojařkou Voničky I, Anuška Voničky II a III; složkami úrovně 2 jsou Vonička I–III.

Varianty:

- (a) jeden fond organizace a pověření krojařek omezené na držitele z určitých složek;
- (b) každá složka má vlastní fond (pak je vonicka.md k aktualizaci).

U Vonice je fond po složkách jasný (D-21). Krojařku pro Vonicu to neblokuje, model fondu ano.

### Q-02 Omezení půjčování krojů podle skupiny nebo kategorie

**Vysvětlení rozporu R8 z auditu:**

- Původní nástřel (`archive/00-prehled.md` „Poučení z krojové databáze“ a `archive/02-core-a-moduly.md`, tabulka `costume_category_allowed_groups`) počítal s **pravidlem v systému**: např. členovi ve skupině „kluci“ jde vydat jen kus z kategorie „chlapecké kroje“. Jiný výdej by aplikace **nedovolila**.
- Novější `current/06` kap. 5.1a (výchozí kroj osoby) a `context/vonica.md` („klukovi se málokdy půjčuje holčičí kroj, ale stát se to může – maska na obchůzku, kroj pro sestru“) říkají opak: aplikace jen **seřadí nabídku** podle výchozího kroje osoby a nikdy výdej nezakáže.

**Doporučení:** žádný zákaz, jen řazení nabídky (stav v `06` v0.5). Pravidlo z `02` je archivované. Potvrď prosím, nebo uveď situaci, kdy zákaz potřebuješ.

### Q-03 Rozsah základní finanční evidence v Krojařce (k D-23)

Z podkladů:

- vonica.md (TODO): přehled příjmů a výdajů pokladny, proplácené účtenky a k jaké akci patří; krojařky řeší s pokladníkem výdaje za kroje;
- vonicka.md: majetek, nákupy a opravy krojů, oceněné součástky v inventární knize.

Je potřeba určit:

- jde o evidenci **výdajů za kroje** (nákup, oprava, čištění), o **pořizovací cenu a hodnotu kusu**, o **pokladnu** složky, nebo o kombinaci;
- kdo ji vidí (krojařka, pokladník, hospodář) a jaké pověření k tomu slouží.

**Žádná funkční specifikace zatím neexistuje.**

### Q-04 Komplety – podrobnosti k D-19

1. Mají komplety **vlastní evidenční řady a čísla** oddělené od řad součástek (např. „Záleský komplet Z12“), nebo sdílejí řady součástek?
2. Jsou **nečíslované zaměnitelné doplňky** jen v kompletech, nebo i volně ve skladu nebo u osoby?
3. Je **šablona kompletu** (seznam druhů, upozornění „co chybí“) ještě potřeba? Dnes je v demu.
4. Pravidla částečně vydaného kompletu: výdej kompletu bez součásti, která je půjčená jinde. `archive/06-…-v0.3` kap. 4.2, 5.2–5.3 to popisuje. Potvrdit s krojařkou.
5. Navigace: komplety v katalogu **Součástky**, nebo samostatná položka menu? Uživatel to připouští, pokud to pomůže ovládání.

### Q-05 Otevřené body pro krojařky

- `current/06` kap. 13: seznam řad, varianty (modré a bílé gatě), uzavření inventury s nesrovnalostmi, výchozí kroj, stavy pracovních úkolů, termíny inventury, tiskové sestavy.
- `current/krojarka/frontend-demo-specifikace.md` kap. 10: převod papírových karet, počet a čitelnost skenů, retence skenů.
- `current/krojarka/krojovy-katalog-vonica.md`: 6 otázek k číselníku (Velická / Nová Lhota, Slovensko, obuv, souhrnné a duplicitní řádky, kufry).
- vonica.md: osoba s **vlastním krojem nebo součástkou** (poznámka „má vlastní krpce“). V `06` zatím chybí.

`06` je stále **podklad ke schválení krojařkami**. Zaškrtávací seznam v kap. 14 je nevyplněný.

### Q-17 Menu Krojařky – co se nevešlo do D-22

Zadání Krojařky má obrazovky, které schválené menu výslovně nezmiňuje:

- archiv dokumentů a skenů (K23);
- přehledy, tisk a export (K25);
- seznam osob **bez výpůjček** (papírová evidence, převod osoby, K03–K07) – „Krojové karty“ jsou definované jako lidé s výpůjčkami;
- podoba **mobilní** spodní lišty.

Návrh k posouzení: osoby bez výpůjček jako filtr v Krojových kartách, dokumenty u osoby nebo kompletu a souhrnný archiv v Nastavení, exporty v kontextu jednotlivých seznamů.

### Q-10 API v1 a monorepo

Je potřeba určit:

- rozvržení monorepa (Angular workspace s projekty `krojarka`, později `moje` a `demo`; sdílená knihovna; adresář s PHP API);
- co z dnešního `/wardrobe` převzít;
- rozsah API v1 pro Krojařku (osoby, katalog, kusy, komplety, výpůjčky, inventury, přílohy, finance);
- migrace schématu.

Kód dema `/wardrobe` stojí na modelu `06` v0.4 (šablony místo fyzických kompletů). Přehled technického dluhu před backendem je v `archive/implementace-2026-10-21/08-souhrn-zjisteni.md` (P1).

### Q-11 Hosting a provoz (z `current/hosting-postgresql-api-auth.md` kap. 9–10)

- TLS mezi PHP a PostgreSQL (privátní síť bez TLS) – ověřit u Websupportu a vědomě přijmout; hodnota `PG_SSLMODE`.
- Kde budou přístupové údaje k databázi pro PHP na `api` (`vonica.cz/home` z `api` zatím neověřeno).
- Jeden databázový účet pro migrace i aplikaci.
- Test zápisu do databáze, zapnutí `opcache`, HSTS, práva souborů 0666 → 644/755, SPA fallback pro chybějící assety.
- Ověření v Safari/iOS a Firefoxu.
- `docker-compose.yml` sjednotit na PostgreSQL 18.
- **Zálohy PostgreSQL** u poskytovatele (D-16 vznikl pro MySQL).

### Q-14 Přihlašování do Krojařky a citlivé skeny

- Kdo dostane účet: jen krojařky, nebo i další role pro čtení (např. Náhled do evidence pro výbor)?
- Retence a přístup k naskenovaným osobním kartám (GDPR).
- Odstraňování polohových EXIF dat.

## Neblokuje Krojařku

### Q-07 „Přijatý člen“ jako podmínka funkce ve výboru

- `current/identity-model-v2.md` kap. 2.1 uvádí jako „potvrzené pravidlo“: funkce ve výboru vyžaduje aktivního a přijatého člena.
- `context/vonica.md`: přijatý člen „nemá aktuálně žádná práva navíc“ a označení „nemá pro organizaci vlastně žádný vliv“.

Který zdroj platí?

### Q-08 Muzikanti

Členství a hlasovací právo přidružené muziky (identity-model-v2 kap. 10.1). Vonica.md počítá muzikanty mezi členy dospělé složky. Uživatel 2026-10-22 uvádí muziku jako samostatnou složku úrovně 2.

### Q-09 Rodičovské zastupování

Rozsah práv rodiče, ověření a ukončení zastupování, přístup k platbám (identity-model-v2 kap. 10.3). Týká se hlavně Voničky.

### Q-12 Plán architektonického experimentu

`proposals/plan-architektonickeho-experimentu.md` předpokládá pořadí „identita → mock testy → frontend → DB/API“ a uvádí se jako „schválený postup prací“. Schválení není doloženo. Model identity je teď rozhodnut (D-06, D-07) a prioritou je Krojařka (D-02).

Zůstává plán v platnosti, nebo se identita bude dělat rovnou v rámci API Krojařky?

### Q-13 Přesun dema z `moje` na `demo.vonica.cz` – *vyřešeno 2026-10-22*

Přesun je dokončen; `moje.vonica.cz` je prázdná a vyhrazená budoucí aplikaci. Původní znění:


Kroky A–D jsou provedené. Kroky E (přepnutí nasazovací konfigurace) a F (uvolnění `moje`, odregistrace service workeru) čekají na schválení (`current/hosting-postgresql-api-auth.md` kap. 12).

### Q-15 Chybějící podklady

Dokumenty se na ně odvolávají, ale v repozitáři nejsou:

- dokument „`11` – historický podklad rozhodování“ (zmíněný ve verzi `07` mimo Git);
- `Zápis z členské schůze 2026.doc` (Vonička);
- `skladova-karta-chlapci (2).xls`, `skladova-karta-holky (2).xls`;
- `krojovy-katalog-vonica.csv`;
- `vonica(1).md` „verze 2“ – není jisté, zda odpovídá `dev/local/vonica.md`;
- výsledek oponentury (`archive/implementace-2026-10-21/09-zadani-oponentury.md`).

### Q-16 Odložené otázky pro `moje`

Neřeší se, dokud se vývoj `moje` neobnoví. Seznamy zůstávají v původních dokumentech:

- `archive/03-postup-vyvoje.md` „Nevyřešené před implementací“ (2FA, retence, ICS…) a „Rozhodnutí ke schválení“ (kroje v demu);
- `current/moje/08` kap. 14;
- `current/moje/09` kap. 12;
- `current/moje/10` kap. 11;
- `current/moje/07` kap. XIII.
