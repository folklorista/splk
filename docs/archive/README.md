# Archiv – nezávazné

**Nic v této složce není závazné.** Dokumenty slouží k dohledání historie a původu rozhodnutí. Co platí dnes, je v [`../decisions.md`](../decisions.md) a [`../current/`](../current/).

| Dokument | Proč je v archivu | Co z něj dál žije |
|---|---|---|
| [`00-prehled.md`](00-prehled.md) | Původní nástřel produktu (2026-06-23) a konsolidace z 18. 10. s modelem více samostatných souborů a globální identity, který byl nahrazen modelem se složkami (D-06) | principy → D-01, D-04, D-05; poučení z krojové databáze → `current/04` |
| [`02-core-a-moduly.md`](02-core-a-moduly.md) | Logické entity jádra (`ensembles`, `ensemble_memberships`, `parent_child_links`…) a první moduly, překonané modelem identity v2 (D-07) a specifikací `06`. Pravidlo `costume_category_allowed_groups` (zákaz výdeje podle skupiny) se nepoužívá (Q-02) | princip „skupiny jako základ viditelnosti“ → `current/moje/08` |
| [`03-postup-vyvoje.md`](03-postup-vyvoje.md) | Deník vývoje dema do 19. 10. 2026: fáze 1–6, MVP, vlny 1–5, ověření hostingu 14. a 17. 10., otevřené body. Pořadí vývoje nahradilo D-02 | aktuální stav → `current/03-stav-vyvoje.md`; otevřené body → Q-16; ověření hostingu → `current/01` |
| [`03-prubeh-api-v1-2026-10-24.md`](03-prubeh-api-v1-2026-10-24.md) | Zachovaný průběžný deník kroků 1–7 API a Krojařky před konsolidací; obsahuje i již překonané blokace a mezivýsledky testů | jediný aktuální souhrn → `current/03-stav-vyvoje.md` |
| [`03-prubeh-api-v1-kroky-8-10-2026-10-24.md`](03-prubeh-api-v1-kroky-8-10-2026-10-24.md) | Snímek před závěrečným dokončením kroku 10, se závěrečnými výsledky kroků 7–9 a tehdejšími etapami nákladů; mezistavy nejsou současná blokace | aktuální souhrn → `current/03-stav-vyvoje.md` |
| [`06-specifikace-krojoveho-skladu-v0.3.md`](06-specifikace-krojoveho-skladu-v0.3.md) | Verze 0.3 (15. 10., s doplňkem 6A/6B z 18. 10., ještě s pojmem „krojárka“). Ve verzi 0.4 ji nahradil model šablon, ve verzi 0.5 se fyzické komplety vrátily (D-19) | popis fyzických kompletů, částečného vrácení a neočíslovaných doplňků – zdroj pro `current/06` v0.5 |
| [`plan-architektonickeho-experimentu.md`](plan-architektonickeho-experimentu.md) | Plán identitního experimentu (22. 10.), nepoužívá se (D-32) | model identity → `current/identity-model-v2.md` (D-06, D-07) |
| [`implementace-2026-10-21/`](implementace-2026-10-21/00-index.md) | Popis **skutečného stavu kódu dema** k 21. 10. 2026 (větev `design/identity-03`), připravený pro externí oponenturu. Datovaný snímek, nebude se aktualizovat | `08-souhrn-zjisteni.md` = technický dluh P1 před backendem (Q-10) |

## Soubory, které už jsou jen v historii Gitu

Zobrazení: `git show <commit>:<cesta>`.

| Soubor | Kde najít | Poznámka |
|---|---|---|
| `docs/splk-simulator-opravneni.html` | `git show 84b2fd8^:docs/splk-simulator-opravneni.html` | Interaktivní prototyp oprávnění; nahradila ho sekce Správa v demu |
| `docs/zadani-pro-robota-krojarna-inventury.md` | `git show 84b2fd8^:docs/zadani-pro-robota-krojarna-inventury.md` | Implementační zadání modelu v0.4 (zapracované do `06` v0.4) |
| `docs/README-ZMENY.md` | `git show 84b2fd8^:docs/README-ZMENY.md` | Souhrn konsolidace 18. 10. (otevřené otázky přesunuty do `03`) |
| `docs/06…` verze 0.3 bez doplňku 6A/6B | `git show b118f05:docs/06-specifikace-krojoveho-skladu.md` | – |
| původní umístění `docs/00–10` | historie před uspořádáním 2026-10-22 | soubory přesunuté přes `git mv`, takže `git log --follow` funguje |

## Chybějící podklady

Seznam zdrojů, na které se dokumenty odvolávají, ale v repozitáři nejsou, je v Q-15 (`../open-questions.md`).
