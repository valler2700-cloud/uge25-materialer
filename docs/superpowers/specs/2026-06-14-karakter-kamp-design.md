# Karakter-kamp — designspec

**Dato:** 2026-06-14
**Projekt:** Uge25-materialer (8B & 8D, religion/historie/matematik)
**Bygger ovenpå:** `Kortspil_religion-historie.html` (100 karakter-kort)

## 1. Formål

Gøre de eksisterende 100 karakter-kort til et **spil**, hvor eleverne spiller mod
hinanden. Personerne får talværdier (stats), så man kan dyste kort mod kort
(Top Trumps-stil). Et **kurateret dæk på 52 kort** udgør spildækket; de øvrige
kort beholdes til at blade i og printe som faktakort/flashcards.

To spiltilstande:
- ⚔️ **Trumf-dyst** (hovedspil) — Top Trumps med 4 stats.
- ⏳ **Tidslinje** (ekstra) — placér kort kronologisk.

Målgruppe: 8. klasse, smartboard eller én delt skærm/enhed (hot-seat, to spillere).

## 2. Arkitektur & filplacering

Alt bygges **ind i den eksisterende `Kortspil_religion-historie.html`** — én
selvstændig HTML-fil (vanilla JS/CSS), samme guld/navy-stil og fonte (Anton +
Bricolage Grotesque). Én kilde til kortdata.

Øverst på siden tilføjes en **tilstands-vælger** (tre knapper):

- 📇 **Kort** — den nuværende visning: blade, søg, filtrér, vend, print (uændret).
- ⚔️ **Trumf-dyst** — spiltilstand 1.
- ⏳ **Tidslinje** — spiltilstand 2.

Hver tilstand er en selvstændig "sektion" i DOM'en; kun den aktive vises.
Skift af tilstand nulstiller ikke et igangværende spil (se §6 persistens).

### Komponenter (logiske enheder i scriptet)

| Enhed | Ansvar | Afhænger af |
|---|---|---|
| `D` (data) | De 100 kort + spil-data på de 52 | — |
| `GAME` (afledt) | `D.filter(c=>c[6])` → de 52 spilkort | `D` |
| `alderScore(year)` | Beregner ⏳ Alder-stat (1–100) fra år | — |
| Kort-tilstand | Eksisterende blade/print/flip | `D` |
| Trumf-dyst | Spil-loop, runder, bunker, vinder | `GAME`, `alderScore` |
| Tidslinje | Placeringsspil, kronologi-tjek | `GAME`, `alderScore` |
| Persistens | Gem/hent igangværende dyst i localStorage | — |

## 3. Datamodel

Hvert kort i `D` er i dag et array:
`[navn, kategori(R/H/B), hvornår, hvem, hvad, konsekvens]`

De **52 spilkort** får ét ekstra element (indeks 6) — et objekt:

```js
// 7. element, KUN på de 52 spilkort (de øvrige 48 har det ikke)
{ y: <år:int>, i: <indflydelse 1-100>, u: <udbredelse 1-100>, e: <eftermæle 1-100> }
```

- `D.filter(c => c[6])` giver præcis de 52 spilkort.
- Ikke-spilkort har `c[6] === undefined` og indgår ikke i spillet.

### De fire stats

| Stat | Felt | Skala | Kilde |
|---|---|---|---|
| ⏳ **Alder** | beregnes fra `y` | 1–100 | **Objektiv** (formel) |
| 🌍 **Indflydelse** | `i` | 1–100 | Tildelt (hvor meget personen ændrede historien — på godt **og** ondt) |
| 👥 **Udbredelse** | `u` | 1–100 | Tildelt (hvor mange mennesker berørt / tilhængere) |
| ⭐ **Eftermæle** | `e` | 1–100 | Tildelt (hvor kendt/vigtig i dag) |

**Alder-formel** (objektiv, driver også Tidslinjen):

```
alderScore(y) = clamp( round( (NU - y) / (NU - ÆLDSTE) * 99 ) + 1, 1, 100 )
// NU = 2026; ÆLDSTE = mindste y blandt de 52 (ældste kort) → får 100
// negative y = f.v.t. (fx Hammurabi y ≈ -1780, Jesus y ≈ 5, Mandela y ≈ 1960)
```

`y` (kanonisk sorteringsår) sættes pr. kort: fødselsår, centralt begivenhedsår
eller midtpunkt af en epoke. For "1. årh. e.v.t." bruges ca. 50; for "ca. 1800
f.v.t." bruges -1800 osv. Værdien skal kun give **korrekt rækkefølge** på
tidslinjen og en rimelig Alder-stat.

### Stat-tildeling (de 3 tildelte stats)

Claude udfylder alle 3 × 52 = 156 værdier ud fra historisk/religiøs betydning.
Værdierne er **redigerbare** (ligger åbent i `D`); læreren kan rette frit.
Mål: spredning så uafgjort er sjældent; ingen kunstig "alle på 100".

### Følsomhed

Stats måler **historisk betydning, ikke moral**. Fx kan Hitler have høj
Indflydelse/Udbredelse — det er historisk korrekt, ikke en bedømmelse af
personen. Spillet viser en kort note:
> "Høje tal = stor historisk betydning — ikke at personen var 'god'. Tal om det i klassen."

## 4. Spiltilstand 1 — ⚔️ Trumf-dyst (Top Trumps)

**Spillere:** 2 (hot-seat ved samme skærm).
**Dæk:** de 52 spilkort, blandet, delt **26/26**.

### Runde-loop

1. Den **aktive** spiller ser kun sit eget øverste kort (4 stats). Modstanderens
   øverste kort ligger med bagsiden op (skjult — fair på delt skærm).
2. Aktiv spiller vælger en stat.
3. Begge øverste kort vendes. **Højeste værdi vinder** begge kort **samt et evt.
   puljefelt** fra en tidligere uafgjort runde; alt lægges nederst i vinderens bunke.
4. **Uafgjort:** begge kort (plus et evt. eksisterende puljefelt) lægges i "puljen";
   næste runde spilles, og vinderen af næste afgørende runde tager hele puljen (jf. punkt 3).
5. Vinderen af runden bliver **aktiv** spiller i næste runde. (Ved uafgjort
   beholder den hidtil aktive spiller turen.)

### Spilslut

- En spiller har **alle kort** → vinder. **Eller**
- Knappen **"Stop & tæl op"** afslutter når som helst → **flest kort vinder**
  (så spillet passer i en lektion). Uafgjort på antal = uafgjort.

### Skærm (skitse)

```
┌─ DIN TUR (Spiller 1) ─────────── 🟦 27   |   🟥 23 ─┐
│   #1  JESUS FRA NAZARET   🕊️                        │
│   ⏳ Alder        86   ▶ klik for at vælge           │
│   🌍 Indflydelse  98   ▶                              │
│   👥 Udbredelse   95   ▶          [ modstander ]      │
│   ⭐ Eftermæle    90   ▶            🂠 skjult          │
│                                                      │
│   [ Stop & tæl op ]                  [ Nyt spil ]    │
└──────────────────────────────────────────────────────┘
```

Efter valg: begge kort vises side om side, den valgte stat fremhæves, vinderen
markeres, kort lille animation, derefter "Næste runde".

## 5. Spiltilstand 2 — ⏳ Tidslinje (ekstra)

**Spillere:** 2 (eller hold/co-op).
**Dæk:** de 52 spilkort (eller en delmængde, fx 12–20 trukket tilfældigt — gør
spillet kortere). Standard: træk 16 tilfældige.

### Loop

1. En fælles, voksende tidslinje vises (tom til at starte; første kort lægges
   gratis).
2. På skift trækkes ét kort. Spilleren vælger **hvor** det skal ind i forhold til
   de allerede placerede kort (før/imellem/efter).
3. Tjek mod kortets `y`: korrekt placering → kortet bliver liggende + **1 point**.
   Forkert → kortet fjernes (eller lægges på rette plads og vises som "ramt forbi",
   ingen point).
4. Spillet slutter når trukne kort er brugt op. **Flest point vinder.**

Tidslinjen bruger udelukkende `y` (samme felt som Alder), så rækkefølgen tjekkes
deterministisk. **Reglen for korrekt placering:** kortets `y` skal ligge mellem
venstre nabos `y` og højre nabos `y` på den valgte plads (≤ og ≥, så to kort med
samme `y` accepteres i begge rækkefølger).

## 6. Persistens

`localStorage` (egen nøgle, fx `uge25_kortkamp_v1`) husker en **igangværende
Trumf-dyst** (begge bunker + pulje + hvis tur), så man kan skifte væk til
Kort-tilstand og tilbage uden at miste spillet. "Nyt spil" rydder. Tidslinje er
kort og gemmes ikke.

## 7. Print-synergi

De 4 stats kommer **også med på kortenes forside i print**, så de printede kort
bliver rigtige, spilbare Top Trumps-kort:

- **Forside (print):** nr., kategori, ikon, navn, epoke **+ en lille stat-boks**
  (⏳/🌍/👥/⭐ med tal). Kun for de 52 spilkort; de øvrige 48 printes som i dag.
- **Bagside (print):** uændret — hvornår/hvem/hvad/konsekvens (faktalæring).
- Det eksisterende dobbeltsidede print-system (3×3, lang-kant-spejling, #-tjek)
  genbruges. Et nyt valg: **"Print kun spildækket (52)"** vs. **"Print alle 100"**.

## 8. Æstetik

Samme univers som resten af pakken: mørk navy baggrund, guld-accent, Anton til
overskrifter/navne, Bricolage Grotesque til brødtekst. Spil-skærmene skal føles
som et "game show"/samlekort — tydelige knapper, store tal, sjove men hurtige
overgange. Tilgængeligt på smartboard (store klikflader, læsbart på afstand).

## 9. Test & verifikation

- **Spil-logik (kode-simulering):** Trumf-dyst spilles automatisk til ende N gange
  → kontroller: ingen kort forsvinder/duplikeres (sum altid 52), uafgjort-pulje
  håndteres, vinder bestemmes korrekt, "Stop & tæl op" tæller rigtigt.
- **Alder/Tidslinje:** sortér de 52 på `y` → manuelt øjekast på at rækkefølgen er
  historisk rimelig; tjek `alderScore` giver 1..100 og ældste = 100.
- **Data-validering:** præcis 52 kort har `c[6]`; alle har `y,i,u,e`; alle stats i
  1–100; ingen dubletter.
- **Browser:** gennemspil begge tilstande i Chrome (klik en runde i Trumf-dyst,
  placér et par kort på tidslinjen), samt visuelt tjek af print-spildækket.
- **JS-syntaks:** valider med Node `vm` før browsertest.

## 10. Uden for scope (YAGNI)

- AI-modstander (kun menneske mod menneske i denne version).
- Online/netværks-multiplayer.
- Mere end 2 spillere/hold-administration ud over simpel pointtælling.
- Redigering af stats i UI (rettes i koden).

## 11. De 52 spilkort (godkendt)

**Religionernes nøglepersoner (10):** Jesus · Muhammad · Buddha · Moses ·
Abraham · Martin Luther · Moder Teresa · Dalai Lama · Konfutse · Guru Nanak

**På tværs / idéer & bevægelser (7):** Gandhi · Martin Luther King Jr. ·
N.F.S. Grundtvig · Søren Kierkegaard · Jeanne d'Arc · Saladin · Mansa Musa

**2. verdenskrig — pensum (6):** Adolf Hitler · Winston Churchill · Josef Stalin ·
Franklin D. Roosevelt · Anne Frank · Erik Scavenius

**Danmarkshistorie — pensum (9):** Harald Blåtand · Gorm den Gamle · Margrete 1. ·
Christian 4. · Tycho Brahe · H.C. Andersen · Niels Bohr · Dronning Margrethe 2. ·
Karen Blixen

**Videnskab & tænkere (12):** Newton · Einstein · Darwin · Marie Curie · Galileo ·
Copernicus · Aristoteles · Sokrates · Pythagoras · Alan Turing · Leonardo da Vinci ·
Gutenberg

**Ledere, imperier & opdagere (6):** Napoleon · Julius Cæsar · Cleopatra ·
Alexander den Store · Christofer Columbus · Karl den Store

**Moderne forandring & kultur (2):** Nelson Mandela · William Shakespeare

**I alt: 52.** Balance: 17 med religiøs vinkel (10 R + 7 B), 35 historiske;
8 kvinder; spredning fra oldtid (Hammurabi-æra) til nutid.
