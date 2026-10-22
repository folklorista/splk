# Kontext organizací

Tato složka popisuje **organizační realitu**: jak Vonica a Vonička skutečně fungují. **Nejsou to technická rozhodnutí.** Ta jsou v [`../decisions.md`](../decisions.md).

Rozlišujeme tři věci:

1. **Organizační realita** – kdo co v organizaci dělá (zdroje níže).
2. **Produktové požadavky** – co od aplikace potřebují (`current/`, `decisions.md`).
3. **Technická řešení** – jak to postavíme (`current/`, `decisions.md`).

## Podrobné popisy (mimo Git)

| Soubor | Obsah | Stav |
|---|---|---|
| `dev/local/vonica.md` | Slovácký soubor Vonica: složky, výbor a funkce, členství, nácviky, vystoupení, kroje, průběh roku | stav k říjnu 2026 |
| `dev/local/vonicka.md` | Vonička Zlín, z. s.: spolek a formální členství, skupiny I–III, rodiče, příspěvky, hospodaření, kroje | podle zápisu z členské schůze 28. 7. 2026 |

Soubory jsou v Gitem ignorované složce `dev/local/`. Obsahují skutečná jména a citlivé údaje o lidech a podle README se reálná data souboru do Gitu nedávají. **Neupravují se podle technické dokumentace.** Nejasnosti se zapisují do `open-questions.md`. Pokud je potřebuješ a nemáš je, požádej vlastníka projektu.

## Fakta potvrzená vlastníkem projektu 22. 10. 2026

- **Vonica** je jedna organizace (úroveň 1) se složkami (úroveň 2): dospělá složka, Malá Vonica, Děvčice z Vonice, muzika.
- **Vonička** je samostatná organizace (úroveň 1) se složkami Vonička I, II, III.
- **„Člen souboru“** = člen dospělé složky Vonice.
- **Výbor Vonice**: statutární zástupce (Ivoš), organizační vedoucí (Kuba D), umělecká vedoucí (Tezi), vedoucí kluků (Staňa), vedoucí holek (Aňyčka), vedoucí Malé Vonice (Marci), kronikářka (Áďa), hospodářka (Lucka Š), pokladník (Lucka Z), vedoucí propagace (Anytka). Ivoš funkci statutárního zástupce předá Kubovi D.
- **Krojařky:**
  - Vonica: Lucka Š (dospělá složka, s pomocnicemi Aničkou Z a Terkou P), Danča (Malá Vonica), Broňa (Děvčice). Muzika si půjčuje od dospělé složky.
  - Vonička: Gabča (I), Anuška (II a III).
  - Krojařky různých složek vidí jen seznamy lidí, ne cizí evidenci. Pomocnice mají v aplikaci stejná práva.

Výčet osob odpovídá stavu k říjnu 2026. Vzorová data v `current/moje/08` kap. 6 jsou ilustrační.

## Možné nesoulady s ostatními podklady

- vonicka.md uvádí jeden společný krojový fond I–III, krojařky jsou ale rozdělené podle složek → Q-01.
- vonica.md: „přijatý člen“ nemá žádná práva navíc; identity-model-v2 z něj dělá podmínku funkce ve výboru → Q-07.
- vonica.md řadí muzikanty mezi členy dospělé složky, rozhodnutí 22. 10. vede muziku jako samostatnou složku → Q-08.
