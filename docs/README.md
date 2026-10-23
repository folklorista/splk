# Dokumentace projektu SPLK / Souborový systém Vonica

**Jediný vstupní bod dokumentace.** Uspořádáno 22. 10. 2026. Původní stav lze dohledat v historii Gitu před tímto datem.

## O projektu

Webové aplikace pro skutečné folklorní organizace: **Slovácký soubor Vonica** a do budoucna samostatně **Vonička Zlín**. Nejde o univerzální framework. Mobil je hlavní zařízení. Jeden vývojář s AI asistentem.

| Aplikace | Stav |
|---|---|
| **Krojařka** – `krojarka.vonica.cz` | **jediná současná priorita**: krojový fond, výpůjčky, inventury, papírové karty, základní finance |
| **API** – `api.vonica.cz` | PHP 8.5 REST + PostgreSQL 18, vzniká s Krojařkou |
| **moje.vonica.cz** | budoucí členský systém, **vývoj odložen** |
| **demo.vonica.cz** | dosavadní prototyp (Angular, data jen v prohlížeči), přesunutý sem z `moje` 22. 10. 2026; není cílovou architekturou ani grafikou |

## Čtyři otázky – kam se podívat

| Otázka | Dokument |
|---|---|
| **Co jsme se už rozhodli?** | [`decisions.md`](decisions.md) – registr rozhodnutí D-xx |
| **Co ještě musíme rozhodnout?** | [`open-questions.md`](open-questions.md) – Q-xx, nahoře ty, které blokují Krojařku |
| **Co jsme zvažovali, ale už neplatí?** | [`archive/`](archive/) – viz [`archive/README.md`](archive/README.md) |
| **Podle čeho teď vyvíjet?** | `decisions.md` a níže uvedené dokumenty v `current/` |

**Při rozporu platí `decisions.md`** a podrobný dokument je třeba opravit.

## Struktura

```text
docs/
├── README.md, decisions.md, open-questions.md
├── context/     realita organizací (fakta, ne technická rozhodnutí) + slovníček
├── current/     platné specifikace; každá má v hlavičce svůj status
│   ├── krojarka/   aplikace Krojařka (priorita)
│   └── moje/       odložený členský systém (schválené cíle, nevyvíjí se)
├── proposals/   návrhy čekající na rozhodnutí (api-v1-a-schema.md)
└── archive/     historické a překonané dokumenty, snímky stavu kódu
```

## Platné dokumenty (`current/`)

### Pro Krojařku a API – vyvíjí se teď

| Dokument | Obsah | Status |
|---|---|---|
| [`06-specifikace-krojoveho-skladu.md`](current/06-specifikace-krojoveho-skladu.md) | Doménová pravidla krojové evidence (kusy, řady, komplety, výpůjčky, inventura) | v0.5, platná; ke schválení krojařkami |
| [`krojarka/frontend-demo-specifikace.md`](current/krojarka/frontend-demo-specifikace.md) | Obrazovky, UX, skeny papírových karet, demo scénáře | pracovní návrh; menu podle D-22 |
| [`krojarka/krojovy-katalog-vonica.md`](current/krojarka/krojovy-katalog-vonica.md) + `.json` | Návrh číselníku 83 druhů součástí ze skladových karet | data k ověření |
| [`identity-model-v2.md`](current/identity-model-v2.md) | Osoba, účet, složky, zastupování, funkce, pověření | směr schválen (D-06, D-07); rozhraní konceptuální |
| [`monorepo-struktura.md`](current/monorepo-struktura.md) | Struktura repozitáře: `apps/`, `packages/`, `api/`, verze nástrojů, migrace | schváleno (D-41 až D-47) |
| [`hosting-postgresql-api-auth.md`](current/hosting-postgresql-api-auth.md) | Ověření hostingu, PostgreSQL 18, CORS, cookies, CSRF, přesun dema | ověřená fakta + doporučení přijatá v D-11 až D-13 |
| [`01-technicky-stack.md`](current/01-technicky-stack.md) | Hosting, šifrování, offline, zálohy, přílohy, zásady frontendu | platný; část pro více souborů a MySQL je překonaná |
| [`04-styl-prace.md`](current/04-styl-prace.md) | Rozhodovací pravidla a styl práce | platný |
| [`03-stav-vyvoje.md`](current/03-stav-vyvoje.md) | Co je hotové a co se právě dělá | průběžně aktualizovat |

### Pro `moje.vonica.cz` – odloženo

Schválené cíle, které se teď nevyvíjejí. Kde odporují modelu se složkami (D-06), platí D-06.

| Dokument | Obsah |
|---|---|
| [`moje/05-motivace-a-vize.md`](current/moje/05-motivace-a-vize.md) | Motivační text pro členy |
| [`moje/07-souborovy-system-vize-funkce-roadmapa.md`](current/moje/07-souborovy-system-vize-funkce-roadmapa.md) | Produktová vize, funkce, náměty (roadmapa je historická) |
| [`moje/08-skupiny-opravneni-a-komunikace.md`](current/moje/08-skupiny-opravneni-a-komunikace.md) | Pověření, skupiny, členství, chat (implementováno v demu) |
| [`moje/09-soukrome-zpravy-dm-a-sifrovani.md`](current/moje/09-soukrome-zpravy-dm-a-sifrovani.md) | DM a serverové šifrování (ADR) |
| [`moje/10-navigace-a-struktura-menu.md`](current/moje/10-navigace-a-struktura-menu.md) | Navigace a menu `moje`; značky ✅ = stav dema k 18. 10. |

**Čísla `06`, `07`, `08` a `10` jsou stabilní identifikátory.** Komentáře v kódu na ně odkazují jako `docs/08 kap. 3` apod. (přes 60 odkazů). Soubory proto nepřejmenovávat a kapitoly nepřečíslovávat.

## Kontext organizací (`context/`)

Viz [`context/README.md`](context/README.md). Podrobné popisy `vonica.md` a `vonicka.md` jsou **mimo Git** v `dev/local/`, protože obsahují osobní údaje. Pojmy jsou v [`context/glossary.md`](context/glossary.md).

## Otevřené otázky, které teď blokují Krojařku

Q-02 omezení výdeje · **Q-03 rozsah financí** · **Q-04 detaily kompletů** · Q-05 body pro krojařky · **Q-10 API v1 a monorepo** · Q-11 hosting · Q-14 přihlašování a skeny · Q-17 mobilní lišta. Podrobně v [`open-questions.md`](open-questions.md).

## Závazná pravidla pro vývojáře a AI asistenty

1. [`../CLAUDE.md`](../CLAUDE.md) – jazyk, pracovní styl, architektonická pravidla, commity, testy.
2. [`decisions.md`](decisions.md) – co platí.
3. `current/` podle statusu v hlavičce dokumentu. „Pracovní návrh“ a „ke schválení“ nejsou hotové zadání. U nejasností se zeptat a nic nedomýšlet.
4. Nic z `proposals/` ani z `archive/` není závazné.
5. Nové rozhodnutí zapsat do `decisions.md`, novou otázku do `open-questions.md`, stav do `current/03-stav-vyvoje.md`.

Provozní postupy (spuštění, testy, nasazení) jsou v kořenovém [`README.md`](../README.md) a ve skillu `/deploy`.
