# 09 – Soukromé zprávy (DM), konverzace a serverové šifrování

> **Status:** odloženo – schválený cíl pro `moje.vonica.cz` (D-25). Zmínky o „samostatných souborech“ a `ensemble_id` čti podle modelu se složkami (D-06); databáze je PostgreSQL (D-11).

**Projekt:** Souborový systém (SPLK) – Vonica  
**Typ:** Funkční a bezpečnostní specifikace / podklad pro implementaci  
**Verze dokumentu:** 0.1  
**Datum:** 17. 10. 2026  
**Stav:** Přijatá produktová a architektonická rozhodnutí; implementační detaily a otevřené otázky jsou výslovně označeny

> **Hlavní pravidlo:** Soukromé zprávy mohou v aplikaci číst pouze oprávnění účastníci konkrétní konverzace. Správce souboru ani správce organizační skupiny nezískává právo číst DM samotným výkonem svého pověření. Obsah DM bude před uložením do databáze serverově šifrován, nikoliv end-to-end.

---

## 1. Účel a návaznost

Tento dokument popisuje soukromé konverzace dvou osob (DM 1:1), soukromé skupinové konverzace, jejich správu, pravidla historie a uchování, šifrování zpráv na serveru a provozní požadavky hostingu.

- Navazuje na `08-skupiny-opravneni-a-komunikace.md`, zejména na oddělení oprávnění spravovat od práva číst obsah.
- **Nezaměňovat** soukromou skupinovou konverzaci s organizační skupinou (`groups`) ani s jejím skupinovým chatem či nástěnkou popsanými v dokumentu 08. Organizační skupinový chat může zobrazovat události nástěnky a obsah podle pravidel organizační skupiny; DM má vlastní účastníky, přístupová pravidla a šifrované zprávy.
- Zůstává zachováno pravidlo dokumentu 08: ani správa organizační skupiny nesmí sama zpřístupnit její neveřejný obsah. Tento dokument jej pro **DM** zpřísňuje a konkretizuje.
- Dokument doplňuje `01-technicky-stack.md` o kryptografii a ověřené možnosti produkčního hostingu.
- Jde o zadání pro následné rozšíření existující aplikace, nikoli tvrzení, že DM je již implementováno.

### 1.1 Rozsah

**Zahrnuto:** textové zprávy, účastníci, správcovství soukromé konverzace, oprávnění, životní cyklus, šifrování, správa klíčů, CRON a testy.  
**Zatím mimo rozsah:** šifrované přílohy, hovory, E2EE, serverový fulltext zpráv, složitá moderace, archivace na žádost právních orgánů a pravidla pro dětský soubor.

## 2. Závazné principy soukromí a oprávnění

1. Obsah a historii DM čtou výhradně oprávnění **aktuální účastníci** dané konverzace, vždy se zohledněním pravidel zpřístupněné historie.
2. Pověření **Správa souboru**, správa **organizační skupiny** ani jiné organizační postavení samo o sobě nezpřístupňuje cizí DM.
3. Aplikace nebude mít běžné „administrátorské zobrazení všech DM“ ani skrytý bypass práv pro správce.
4. Přidání do organizační skupiny automaticky neznamená přidání do soukromé konverzace. A naopak.
5. Backend ověřuje oprávnění k **jednotlivému objektu** při každém načtení, odeslání, úpravě členství i správě konverzace. Skrytí ovládacího prvku ve frontendu nestačí.
6. V multi-tenant modelu musí souhlasit také příslušný soubor (`ensemble_id`) a oprávnění uživatele v něm. Odlišné `ensemble_id` nesmí být obejitelné změnou ID požadavku.
7. Operace se změnami členství, správců a zánikem konverzace mají auditní stopu bez ukládání textového obsahu zpráv.
8. Technická možnost provozovatele dešifrovat zprávy není aplikačním oprávněním ani oprávněním správce souboru.

### 2.1 Technické hranice soukromí

Toto řešení je **server-side encryption**, nikoli E2EE:

- v MySQL je uložen nečitelný šifrovaný obsah zpráv;
- PHP dešifruje zprávy až po úspěšné kontrole oprávnění a vrátí čitelný text oprávněnému klientovi přes HTTPS;
- člověk pouze s výpisem databáze a bez klíče obsah běžně nepřečte;
- provozovatel s přístupem ke klíči a dostatečnými serverovými právy **technicky** dešifrování provést může;
- kompromitace backendu či účtu s právem měnit databázi může umožnit aktivní útok na oprávnění; šifrování DB nenahrazuje ochranu hostingu, databáze, API a audit;
- metadata (účastníci, odesílatel, čas, přibližná délka) šifrována tímto návrhem nejsou.

Zásady se musí uživatelům komunikovat pravdivě: **„Zprávy jsou v databázi šifrované; nejsou end-to-end šifrované.“**

### Konfigurovatelná pravidla pro děti a možnost nahlášení (rozhodnutí 18. 10. 2026)

**Není jediná globální politika DM pro všechny folklorní soubory.** Dospělá Vonica a Malá Vonica jsou dva samostatné organizační kontexty se společnou identitou. Každý soubor může mít vlastní profily samostatnosti dítěte a komunikační politiku (DM vypnuté, omezení okruhu adresátů, případné omezení komunikace nezletilý ↔ dospělý). Případné nastavení skupiny smí jen **zpřísnit** pravidla souboru. Před povolením konverzace musí server vyhodnotit oprávnění **obou stran**.

Předškoláci jednají přes zástupce, u 1. stupně ZŠ je chat dětského účtu vypnutý, u 2. stupně lze chat umožnit s požadovaným rodičovským účtem, středoškoláci mohou mít plné funkce s volitelnou vazbou rodiče. Nejde o tvrdý věkový automat, nýbrž **konfigurovatelné profily**. **Zastupování dítěte rodičem není oprávněním automaticky číst jeho soukromé zprávy.**

**Možnost nahlásit zprávu je schválena pro všechny členy, včetně dospělých.** Uživatel vědomě vybere zprávu (a podle konkrétního procesu omezený potřebný kontext) a může doplnit důvod. Samostatně pověřená osoba smí vidět **pouze hlášený obsah v nutném rozsahu**, nikoliv celou cizí DM historii. Nahlášení samo nevede k automatickému trestu. Role příjemce hlášení, ochrana při střetu zájmů, evidence a retence hlášení i postup při riziku pro nezletilé **ještě nejsou schválené** a musí být dořešeny před povolením dětských DM.

Nahlášení **není tichý administrátorský bypass**. Kryptografická služba musí umožnit zpřístupnit oprávněně nahlášený obsah bez obecné funkce „číst všechny zprávy“.

## 3. Typy konverzací

### 3.1 Přímá konverzace 1:1 (`direct`)

- Má dva rovnocenné účastníky.
- **Nemá roli správce konverzace.** Nikdo z dvojice nemá nadřazené oprávnění.
- Jeden z účastníků **nesmí jednostranně smazat společnou historii druhému**.
- Každý může konverzaci skrýt ze svého přehledu nebo opustit / ukončit svůj přístup podle implementovaného uživatelského toku; taková operace nesmí vymazat zprávy druhému.
- Přesná pravidla mazání jednotlivých vlastních zpráv a obnovení přístupu po opuštění zůstávají otevřena (viz § 12).
- Obecné časové mazání se může vztahovat také na 1:1, **ale nelze jej spravovat jednostranným oprávněním neexistujícího správce**. Politika zachování a upozornění pro 1:1 je zatím otevřená; neimplementovat bez rozhodnutí.

### 3.2 Soukromá skupinová konverzace (`group`)

- Zakladatel je automaticky prvním **správcem konverzace**.
- Správce konverzace může přidávat a odebírat účastníky, jmenovat další správce a odnímat jim toto pověření.
- Správců může být libovolný počet včetně všech účastníků; po předání jsou správci rovnocenní a zakladatel nemá trvalé nadřazené právo.
- Jen správce konverzace smí **smazat celou skupinovou konverzaci pro všechny**. Smazání je destruktivní a vyžaduje potvrzení.
- Běžný účastník smí konverzaci opustit nebo skrýt pouze pro sebe, nikoli ji odstranit ostatním.
- Při běžné správě nesmí aktivní skupinová konverzace s účastníky zůstat bez alespoň jednoho správce: poslední správce před odchodem musí správu předat.
- Pokud je poslední správce administrativně deaktivován nebo odstraněn, systém přidělí správu nejdéle přítomnému aktivnímu účastníkovi; zásah se auditně zaznamená. Není-li vhodný účastník, výjimku je třeba řešit explicitním stavem konverzace, ne tichým přidáním správce souboru ke čtení obsahu.
- Správce organizační skupiny ani souboru se **nemůže sám tiše přidat** jako správce nebo účastník soukromé konverzace jen díky svému organizačnímu pověření.

### 3.3 Přidání, odebrání a historie

- Nově přidaný člen skupinové konverzace **nevidí zprávy před svým vstupem**.
- Po odebrání nebo opuštění přestává server vydávat obsah konverzace, včetně její předchozí historie, dokud člověk nemá nové aktivní oprávnění.
- Při opětovném přidání je výchozí přístup až ke zprávám od **nového** přidání; nepovoluje se automatické opětovné načtení staré historie.
- Pravidlo se vztahuje i na přímé odkazy, vyhledávání, notifikace a případné exporty – nikoli jen na zobrazení seznamu.
- Dříve již získané kopie zpráv, screenshoty ani klientskou cache nelze zpětně technicky vymazat s absolutní zárukou.
- Pro deterministické hranice přístupu se doporučuje používat pořadové číslo zprávy v rámci konverzace (`seq`) a uchovávat **intervaly členství**, ne pouze jediný aktuální `joined_at`.

## 4. Operace, které nezaměňovat

| Operace | Oprávnění | Důsledek |
| --- | --- | --- |
| Skrýt ve vlastním seznamu | Každý účastník | Jen osobní prezentace, data zůstávají. |
| Opustit konverzaci | Každý účastník s výhradou posledního správce skupiny | Odebere vlastní serverový přístup; ostatní pokračují. |
| Přidat či odebrat účastníka ve skupinové konverzaci | Správce této konverzace | Mění okruh oprávněných osob, bez zpřístupnění staré historie novému členovi. |
| Přidat či odebrat správce skupinové konverzace | Správce této konverzace | Změna správcovství; musí zůstat alespoň jeden správce. |
| Smazat skupinovou konverzaci pro všechny | Správce této konverzace | Destruktivní smazání všech zpráv a konverzace. |
| Smazat přímou konverzaci pro oba | Žádné jednostranné oprávnění | Není standardní akce jednoho účastníka. |
| Automaticky odstranit neaktivní skupinovou konverzaci | Serverový úkol po splnění retenčních podmínek | Stejná definitivní operace jako schválené smazání celé konverzace. |

Smazání z produkční databáze není automaticky okamžité vymazání historických **záloh**. Pro ně musí existovat samostatná retenční politika.

## 5. Životní cyklus a retence skupinových konverzací

**Přijatá pravidla:**

1. Po **12 kalendářních měsících** bez relevantní aktivity přejde konverzace do varovného režimu.
2. Všem aktuálním správcům konverzace se zobrazí upozornění: „Tato konverzace je dlouho neaktivní (12 měsíců). Bez další aktivity bude za 60 dní automaticky smazána. Chcete ji zachovat?“
3. Správce může zvolit **„Ano, zachovat“**. Tím se obnoví čas aktivity a začne nové 12měsíční období, aniž by bylo třeba odeslat falešnou zprávu.
4. Volba **„Ne“** není okamžité smazání; bez jiné aktivity doběhne původní 60denní lhůta. Ruční smazání je samostatná explicitní akce správce.
5. Nová skutečná zpráva od aktuálního účastníka v ochranné lhůtě varování zruší a obnoví počítadlo.
6. Po uplynutí **dalších 60 dní** bez obnovující aktivity serverový úkol konverzaci a zprávy automaticky smaže.
7. Je-li více správců, **zachování jediným z nich stačí**. Upozornění obdrží všichni.

### 5.1 Co je aktivita pro retenci

| Událost | Obnoví 12měsíční období? |
| --- | --- |
| Odeslání nové zprávy | **Ano** |
| Správce zvolí „Zachovat“ | **Ano** |
| Otevření a přečtení konverzace | Ne |
| Zobrazení staré zprávy | Ne |
| Přejmenování konverzace | Ne |
| Přidání nebo odebrání účastníka | Ne |

Doporučený interní údaj `retention_activity_at` je **oddělen** od `last_message_at`. U dosud prázdné konverzace začne lhůta jejím založením.

### 5.2 Vlastnosti mazací úlohy

- Zpracování probíhá na serveru; nemusí být právě přihlášen žádný uživatel.
- Práh je **12 měsíců + 60 dní**, nikoli 12 měsíců včetně ochranné lhůty.
- Mazání musí být **idempotentní**, dávkované, s bezpečným opakováním a se správným ošetřením souběhu mezi CRONem, zprávou a kliknutím „Zachovat“; poslední kontrola termínu se provede v transakci.
- Výsledek se loguje jako technická událost bez textu zpráv.
- Po selhání CRONu se může mazání opozdit, nikdy však nesmí být provedeno před splněním lhůty.
- Před smazáním se ukončí navázané přístupy / odkazy, odstraní šifrovaný obsah a vyřeší se závislá data; audit o samotném smazání lze zachovat v minimálním rozsahu.
- Volba kanálu upozornění (v aplikaci, případně e-mailem bez obsahu DM) se dopracuje při implementaci.

**Pozor:** Uživatelské pravidlo „Zachovat“ zde platí pro **správce skupinové konverzace**. U konverzace 1:1 neexistuje správce, proto je způsob varování a zachování 1:1 otevřený a musí se rozhodnout zvlášť.

## 6. Kryptografie – přijatá volba

### 6.1 Algoritmus a hranice

- **XChaCha20-Poly1305 (AEAD)** přes PHP Sodium / libsodium.
- **256bitový (32B) symetrický klíč** náhodně generovaný kryptograficky bezpečným generátorem.
- **Unikátní 24B nonce pro každé zašifrování** (náhodně generované, nikdy znovu nepoužívat se stejným klíčem).
- Ukládat binární `ciphertext` včetně autentizační značky do MySQL BLOB, `nonce` jako 24B binární hodnotu a identifikátor/verzi klíče.
- Na vstupu se srozumitelně validují velikost zprávy a kódování; API nevrací interní detaily kryptografických chyb.
- Používat stabilní **AAD** zahrnující doménový kontext/verzi, `ensemble_id`, `conversation_id`, `message_id` a `sender_user_id`. Příslušná ID musí být přidělena před šifrováním a v DB se nesmí potichu měnit bez nového šifrování.
- Jednoznačné typované/kánonické sestavení AAD musí být zdokumentováno pro budoucí interoperabilitu s Node.js. Nevhodné je nejednoznačné spojování volných řetězců.
- Po zamítnutí přístupu se zpráva **nedešifruje**; po selhání ověření značky se plaintext nikdy nevrátí.

### 6.2 Kolik klíčů?

**Pro první verzi jediný aktivní aplikační klíč pro šifrování všech DM** (nikoli klíč pro každou konverzaci). Zprávy mají vlastní nonce. Každý záznam nese `encryption_key_id` pro pozdější rotaci. Lze případně přejít na samostatné klíče konverzací, ale nyní nepřidávat správu klíčů bez potřeby.

Riziko volby: kompromitace jednoho aktivního klíče může odkrýt obsah více konverzací. Jde o vědomý kompromis jednoduchosti, nikoli o izolaci konverzací kryptografickými klíči.

### 6.3 Šifrovací tok

```text
Odeslání:
Angular (plaintext) --HTTPS--> PHP API
  → ověření aktuálního účastníka a práv
  → přidělení ID zprávy / pořadového čísla
  → MessageEncryptionService.encrypt(text, AAD, aktivní klíč, náhodné nonce)
  → MySQL uloží ciphertext, nonce, key_id a metadata

Čtení:
Angular --HTTPS--> PHP API
  → ověření aktuálního účastníka, období členství a rozsahu historie
  → načtení šifrovaných řádků
  → MessageEncryptionService.decrypt(ciphertext, AAD, nonce, key_id)
  → odpověď jen oprávněnému uživateli
```

**Neprovádět** plaintextový fulltext zpráv v MySQL ani ukládání obsahů či náhledů DM do pomocných nešifrovaných tabulek. Je-li potřeba indexovat délku či typ, počítat s únikem metadat.

## 7. Správa a uložení klíčů

### 7.1 Ověřené možnosti produkce

Pro produkční hosting bylo ověřeno:

- PHP **8.5.10** se zapnutým rozšířením `sodium` a knihovnou **libsodium 1.0.18**;
- úspěšné zašifrování a dešifrování testovací zprávy XChaCha20-Poly1305, odmítnutí poškozeného ciphertextu;
- dostupnost `password_hash(..., PASSWORD_ARGON2ID)` pro hesla členů;
- dostupnost `secretstream` pro případné pozdější šifrování větších souborů po částech;
- bezpečný **neveřejný adresář `/vonica.cz/home`** přístupný PHP procesu subdomény `moje` ke čtení i zápisu;
- vlastní environment proměnné hosting PHP aplikaci nepředává; konfigurační soubory a klíče proto budou uloženy mimo webroot;
- dostupné je vytváření **CRON úloh pro spouštění souborů PHP 8.5**, doložené administračním formulářem hostingu. Na obrázku není prokázáno založení konkrétní aktivní úlohy.

V konkrétním ověřeném rozložení cest odpovídá soukromému adresáři výraz `dirname(__DIR__, 2) . '/home'`. **Před použitím ověřit umístění volajícího PHP souboru**; relativní výpočet se liší podle adresářové struktury. Cestu konfigurovat centrálně, ne kopírovat v různých službách.

### 7.2 Zásady pro tajné údaje

1. Klíč získat bezpečným generátorem (`sodium_crypto_aead_xchacha20poly1305_ietf_keygen()`), nesestavovat jej z hesla či názvu souboru.
2. Keyring držet v samostatném souboru v `/vonica.cz/home` mimo webroot. Databázové přihlašovací údaje mohou být ve stejném **neveřejném adresáři**, ale **v jiném souboru**.
3. Přístup omezit na účty/procesy, které ho skutečně potřebují; běžné API klíč pouze čte. Upravovat klíče jen servisní operací, ne při každém requestu.
4. Klíče **nesmí být v Git repozitáři, buildu Angularu, DB, logu, debug výpisu, chybové zprávě ani příloze e-mailu**.
5. Klíč se nesmí přepsat při deploymentu. Oddělit konfiguraci od vydávaného kódu.
6. Je nutná **bezpečná oddělená záloha klíčů** a periodický test skutečné obnovy databáze a dešifrování testovací zprávy.
7. Ztráta poslední kopie potřebného klíče znamená **neobnovitelnou ztrátu čitelnosti zpráv**, přestože databáze zůstane dostupná.
8. Vnitřní přístup PHP procesu ke klíči je očekávaný, proto ochrana proti kompromitaci stejného procesu/serveru není zaručena.

### 7.3 Rotace klíčů

- Keyring obsahuje **jeden aktivní klíč pro šifrování** a případně starší klíče pouze pro dešifrování, každý se stabilním `key_id`.
- Nové zprávy se po rotaci vždy šifrují novým klíčem; staré zprávy lze dočasně číst původním.
- Volitelná dávková migrace starých zpráv: dešifrovat starým klíčem, zašifrovat novým klíčem **s novým nonce**, uložit šifrovaný obsah, nonce a `key_id` atomicky.
- Starý klíč lze odstranit pouze po ověření, že jej již nepotřebují ani živé zprávy, ani zálohy, které chceme obnovovat.
- Plán pro únik klíče musí zohlednit, že přešifrování historie neodstraní riziko již odcizených historických kopií DB a klíče.

## 8. CRON na hostingu

**Stav:** CRON je na hostingu dostupný. Administrační formulář nabízí typ úlohy **„Spuštění PHP 8.5 souboru“**, výraz opakování a výběr PHP souboru. Na snímku je předvyplněný výraz `*/2 * * * *`, **nejde o schválenou frekvenci ani potvrzení, že je úloha již aktivní**.

**Doporučená implementace (zatím návrh):**

- Spouštět údržbu konverzací **jednou denně** v době nižší zátěže, nikoliv každé 2 minuty.
- Jeden serverový job může: (a) vyhledat konverzace po 12 měsících, nastavit výstrahu a její 60denní termín, (b) zrušit výstrahy po nové aktivitě a (c) mazat pouze konverzace s uplynulým termínem.
- Nastavit časovou zónu a testy kalendářních měsíců, 60 dnů, letního času a souběžných požadavků.
- Při každém běhu logovat souhrn (počty varování/smazání/chyb), ne obsah DM; chyby umožnit bezpečně opakovat.
- **Před nasazením ověřit způsob spouštění:** formulář pracuje s polem „PHP soubor“ a URL (`http://`), takže není zatím prokázáno, zda hosting spouští skript lokálně jako CLI nebo jej vyvolává přes HTTP. Preferovat neveřejný CLI skript, pokud je podporován. Pokud musí být endpoint dostupný přes HTTP, chránit jej silnou autentizací, HTTPS a omezením přístupu; nesmí jít o veřejnou neautentizovanou mazací URL.
- Při vyšší zátěži používat lock/sériové zpracování a limitované dávky.

## 9. Doporučený datový model (implementační návrh)

Nejde o finální SQL migraci. Konkrétní názvy cizích klíčů, indexy a fyzické mazání upřesníme při implementaci existující DB.

```text
conversations
  id
  ensemble_id
  type                      -- direct | group
  name                      -- group; 1:1 může být NULL
  created_by
  created_at
  last_message_at
  retention_activity_at
  deletion_warning_at
  deletion_due_at

conversation_participants   -- aktuální členství / atributy aktuálního stavu
  id
  conversation_id
  user_id
  role                      -- member | admin (jen group)
  joined_at
  left_at
  joined_from_seq
  hidden_at                 -- osobní skrytí

conversation_memberships    -- historické intervaly vstupu/odchodu, nebo ekvivalent
  id
  conversation_id
  user_id
  joined_at
  left_at
  joined_from_seq

messages
  id
  conversation_id
  seq                       -- unikátní pořadí v konverzaci
  sender_user_id
  ciphertext                -- BLOB
  nonce                     -- BINARY(24)
  encryption_key_id
  encryption_version
  created_at
  edited_at
  deleted_at

conversation_audit
  id
  conversation_id
  actor_user_id             -- může být NULL při automatické operaci
  operation                 -- membership/role/retain/delete/...
  created_at
  metadata_without_plaintext
```

Doporučení:

- Při založení direct konverzace nedovolit duplicitní aktivní konverzaci stejné dvojice v témže souboru, pokud produkt později nestanoví jinak.
- Role `admin` se aplikuje **jen na skupinové konverzace**.
- Sekvenční číslo přidělovat atomicky kvůli hranicím historie a současně odeslaným zprávám.
- Indexovat `conversation_id`, `seq`, aktivní účastníky a data retention jobu.
- Neukládat `plaintext`, `message_preview`, obsah upozornění ani nešifrovanou kopii těla zprávy.
- Přesný model úprav/mazání zpráv je otevřený: úprava by vyžadovala nové nonce a nové šifrování.

## 10. API a bezpečnostní požadavky

Předběžný tvar API (názvy lze sladit s existujícími REST službami):

```text
GET    /conversations
POST   /conversations
GET    /conversations/{id}/messages
POST   /conversations/{id}/messages
POST   /conversations/{id}/participants
DELETE /conversations/{id}/participants/{userId}
PATCH  /conversations/{id}/participants/{userId}/role
POST   /conversations/{id}/retain
DELETE /conversations/{id}             -- jen group admin / explicitní pravidlo
```

- U každého endpointu zkontrolovat aktivní účet, příslušnost souboru, členství a konkrétní akci.
- Všechny ID v URL jsou nedůvěryhodné; odpověď pro neoprávněnou osobu nesmí vracet data ani náhledy cizí konverzace.
- Účastníka není možné přidat tajně organizačním oprávněním; běžné přidání provádí jen admin dané soukromé group konverzace.
- Žádné zprávy v plaintextu do aplikačních/access/error logů, analytiky, e-mailů, push payloadů ani debug dumpů.
- Vyřešit HTTPS, session cookies, CSRF (podle typu autentizace), XSS a bezpečné vykreslování obsahu.
- Notifikace pro DM v základní verzi např. pouze „Máte novou zprávu“ bez textu či náhledu.
- Přílohy jsou samostatné budoucí zadání: nesmí se ukládat veřejně a nešifrovaně jako obchvat pravidel DM; případně využít Sodium secretstream.
- Hesla uživatelů **hashovat**, nikoli šifrovat: pro nově vytvořené hashe použít Argon2id (`password_hash`); existující hesla převádět bezpečným migračním postupem.

## 11. Minimální testy před nasazením

### Funkční a autorizační

- [ ] Dva účastníci direct konverzace čtou svou historii; třetí osoba nikoliv.
- [ ] Správce souboru a správce libovolné organizační skupiny nemají žádný bypass pro cizí DM.
- [ ] Změna `conversation_id`/`message_id` nebo `ensemble_id` nepřekročí autorizační hranici.
- [ ] Zakladatel group konverzace je admin a může jmenovat další adminy.
- [ ] Každý admin je rovnocenný; zakladatel nemá trvalé privilegium.
- [ ] Poslední admin nemůže odejít bez náhrady; nucená deaktivace má auditovaný postup.
- [ ] Nový člen nevidí starší zprávy ani přes přímou URL / API / notifikace.
- [ ] Odebraný člen nezíská přístup ke staré ani nové historii; při opětovném přijetí začíná nové období.
- [ ] Jeden účastník 1:1 neumí vymazat společnou historii druhému.
- [ ] Skrýt a opustit neznamená totéž co smazat všem.

### Šifrování a provoz

- [ ] DB obsahuje ciphertext a nonce, nikoliv plaintext; důvěrný text není ani v doplňkových tabulkách/logu.
- [ ] XChaCha20-Poly1305 roundtrip funguje; změna ciphertextu, nonce nebo AAD způsobí selhání.
- [ ] Každá operace šifrování používá nové nonce.
- [ ] Rotace klíče zachová čitelnost starých dat; obnova DB + odděleného keyringu funguje.
- [ ] Nasazení aplikace nepřepíše klíč v `/vonica.cz/home`.
- [ ] Cron po 12 měsících vyvolá varování a po dalších 60 dnech smaže pouze neobnovenou group konverzaci.
- [ ] Zpráva během ochranné lhůty nebo „Zachovat“ resetuje časovač.
- [ ] Současný doběh CRONu a odesílání zprávy nesmaže aktivní konverzaci.
- [ ] Opakované nebo neúspěšné spuštění CRONu nezpůsobí předčasné či dvojité mazání.

### Další provozní vazby potvrzené produktovou diskusí

- Zrušení členství ve folklorním souboru (dobrovolně či vyloučením) odebere přístup k jeho interní komunikaci, **nikoliv nutně globální přihlášení**, je-li člověk aktivní jinde. Historie běžných příspěvků ani soukromé konverzace druhé strany se **automaticky nemažou** kvůli odchodu odesílatele; DM podléhají zvláštním retenčním pravidlům tohoto dokumentu.
- Úmrtí: účet a relace se zablokují, ale **rodič, pozůstalí ani správce souboru automaticky nezískávají přístup k DM**. Zachování nebo mazání dat se řídí výslovnou politikou, ne obecnou deaktivací uživatele.
- Texty DM se **nepřednačítají do trvalé offline cache**. Plánované offline prohlížení ostatních aktivních textů využije IndexedDB a ETag, nicméně soukromé DM zůstávají online-only.
- Záloha DM vyžaduje nejen SQL dump, ale bezpečnou oddělenou zálohu všech potřebných **generací klíčů**, jinak záznamy nemusí jít obnovit. Provozní kompromis: denní zálohy poskytovatele (14 dní) plus plánovaný týdenní šifrovaný externí archiv; viz `01`.

## 12. Otevřené otázky před implementací

1. **Retence 1:1:** má stejná hranice 12 měsíců + 60 dní platit i pro direct, a smí ji zachovat jeden nebo oba účastníci? Uživatelské rozhodnutí dosud výslovně upravuje správce **skupinových** konverzací.
2. **Vlastní jednotlivé zprávy:** bude možné smazat/upravit vlastní zprávu, pro koho se změna projeví a jak dlouho po odeslání?
3. **Přijímání pozvánek do soukromých skupinových konverzací:** automatické členství po přidání správcem, nebo až přijetím pozvánky?
4. **Přílohy:** rozsah, limity, šifrování a odstraňování navázaných souborů.
5. **Upozornění:** pouze interní UI, nebo navíc e-mailové výstrahy při 12 měsících a případně opakování před smazáním?
6. **Smazání a zálohy:** přesná retenční doba záloh, pravidla žádostí o odstranění a zachování minimálního auditu.
7. **Provozní nouzové zásahy:** kdo smí manipulovat se serverovými klíči, jak se schvalují a auditují, bez aplikací poskytovaného „čtení všeho“.
8. **CRON transport:** hosting má doložené spouštění PHP skriptu nebo volání URL přes `wget`; je třeba ověřit režim vykonávání konkrétního jobu, zabezpečení vstupního bodu a denní rozvrh.
9. **Bezpečnostní hlášení a politika nezletilých:** nahlášení zpráv pro všechny je rozhodnuto; zbývá detailní proces oprávněného přístupu k hlášenému obsahu, bezpečné výchozí politiky DM, řešení střetu zájmů a případného omezení komunikace konkrétní osoby.

Tyto otázky **nebrání** vytvoření architektury DM ani kryptografické služby. Nemají být v implementaci vyřešeny náhodným defaultem bez dohody.

---

## 13. Shrnutí architektonického rozhodnutí (ADR)

**Rozhodnutí:** Pro soukromé zprávy použít server-side šifrování **XChaCha20-Poly1305** v PHP přes libsodium, s klíčem bezpečně uloženým mimo databázi a webroot. Oprávnění je založeno na účasti v konkrétní konverzaci, nikoliv na organizačním pověření. Direct 1:1 má dva rovnocenné účastníky; soukromý group chat má jednoho či více správců odvozených výhradně z jeho vlastních účastníků. Neaktivní group chat se po 12 měsících upozorní a po dalších 60 dnech může automaticky smazat, pokud správce konverzaci nezachová či nepřibude zpráva.

**Důsledky:** DB dump není prostým seznamem čitelných soukromých zpráv; provozovatel s přístupem k serverovému klíči je však může technicky dešifrovat. Zálohování klíčů je kritické; fulltext v DB a E2EE nejsou součástí první implementace. Údržbové úlohy jsou na produkčním hostingu technicky možné prostřednictvím CRONu.

**Postup vývoje:** Implementovat postupně přes samostatnou doménovou službu a testovatelné API; zachovat architektonické oddělení Angular services od PHP backendu a možnost budoucího přechodu na Node.js/PostgreSQL. Pro Node.js je třeba zajistit kompatibilní implementaci XChaCha20-Poly1305 (např. vhodnou libsodium knihovnu), algoritmus nelze automaticky zaměnit za jiný bez migračního plánu.
