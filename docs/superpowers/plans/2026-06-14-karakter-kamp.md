# Karakter-kamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing 100-card reference page into a game — a 52-card Top Trumps deck with 4 stats, a Trumf-dyst (battle) mode and a Tidslinje (timeline) mode — built into `Kortspil_religion-historie.html`.

**Architecture:** All game logic lives in one **pure, DOM-free block** (`alderScore`, `resolveRound`, `applyRound`, `timelineCorrect`, `validateGameData`, …) inside the page's `<script>`, fenced by markers so a Node test harness can extract and unit-test it. A separate **UI layer** reads/writes game state and renders the DOM. Card data stays in the single `D` array; the 52 game cards are tagged via a name-keyed `GAMESTATS` map.

**Tech Stack:** Single-file HTML, vanilla JS/CSS (Anton + Bricolage Grotesque). Tests: Node built-in `assert` + `vm` (no test framework). Browser verification via Chrome.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `Kortspil_religion-historie.html` | The whole app: data, pure logic, UI, print | Modify |
| `tests/karakter-kamp.test.js` | Node unit tests for the pure-logic block + data | Create |
| `index.html` | Landing page card description | Modify (Task 7) |
| `README.md` | Repo description | Modify (Task 7) |

**Conventions for testability (apply throughout):**
- The pure-logic block is fenced with `/* ==PURE-LOGIC-START== */` … `/* ==PURE-LOGIC-END== */`.
- The data block is fenced with `/* ==DATA-START== */` … `/* ==DATA-END== */`.
- Inside those blocks, declare functions as `function name(){}` and shared constants as `var` so they attach to the vm context global during testing.
- Pure functions take dependencies (e.g. `oldest`) as **parameters** — no reliance on module globals — so they are testable in isolation.

---

## Task 1: Pure game-logic block + unit tests

**Files:**
- Modify: `Kortspil_religion-historie.html` (add fenced block inside `<script>`, right after the `D` array's closing `];` is fine, but it must NOT reference `D`)
- Test: `tests/karakter-kamp.test.js`

- [ ] **Step 1: Write the pure-logic block into the page**

Insert this block inside `<script>`, after the existing `const D=[…];` declaration and before the existing `const grid=…` line:

```js
/* ==PURE-LOGIC-START== */
var STATS = [
  {key:'alder', label:'Alder',       icon:'⏳'},
  {key:'i',     label:'Indflydelse', icon:'🌍'},
  {key:'u',     label:'Udbredelse',  icon:'👥'},
  {key:'e',     label:'Eftermæle', icon:'⭐'}
];

function alderScore(y, oldest, now){
  now = now || 2026;
  var v = Math.round((now - y) / (now - oldest) * 99) + 1;
  return Math.max(1, Math.min(100, v));
}

function statValue(card, key, oldest){
  var g = card[6];
  if(key === 'alder') return alderScore(g.y, oldest);
  return g[key];
}

function shuffle(arr, rng){
  rng = rng || Math.random;
  var a = arr.slice();
  for(var i = a.length - 1; i > 0; i--){
    var j = Math.floor(rng() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function splitDeck(deck){
  var half = Math.floor(deck.length / 2);
  return [deck.slice(0, half), deck.slice(half)];
}

function resolveRound(cardA, cardB, key, oldest){
  var va = statValue(cardA, key, oldest);
  var vb = statValue(cardB, key, oldest);
  if(va > vb) return {winner:'A', va:va, vb:vb};
  if(vb > va) return {winner:'B', va:va, vb:vb};
  return {winner:'tie', va:va, vb:vb};
}

function createGame(gameCards, rng){
  var deck = shuffle(gameCards, rng);
  var parts = splitDeck(deck);
  return {p1:parts[0], p2:parts[1], pot:[], turn:1, over:false, winner:null, last:null};
}

function applyRound(state, key, oldest){
  if(state.over) return state;
  var s = {p1:state.p1.slice(), p2:state.p2.slice(), pot:state.pot.slice(),
           turn:state.turn, over:false, winner:null, last:null};
  var ca = s.p1[0], cb = s.p2[0];
  s.p1 = s.p1.slice(1); s.p2 = s.p2.slice(1);
  var res = resolveRound(ca, cb, key, oldest);
  if(res.winner === 'tie'){
    s.pot.push(ca, cb);
  } else {
    var won = [ca, cb].concat(s.pot);
    s.pot = [];
    if(res.winner === 'A'){ s.p1 = s.p1.concat(won); s.turn = 1; }
    else { s.p2 = s.p2.concat(won); s.turn = 2; }
  }
  if(s.pot.length === 0){
    if(s.p1.length === 0 && s.p2.length === 0){ s.over = true; s.winner = 0; }
    else if(s.p1.length === 0){ s.over = true; s.winner = 2; }
    else if(s.p2.length === 0){ s.over = true; s.winner = 1; }
  } else if(s.p1.length === 0 || s.p2.length === 0){
    s.over = true;
    s.winner = s.p1.length > s.p2.length ? 1 : (s.p2.length > s.p1.length ? 2 : 0);
  }
  s.last = {a:ca, b:cb, key:key, va:res.va, vb:res.vb, winner:res.winner};
  return s;
}

function leader(state){
  if(state.p1.length > state.p2.length) return 1;
  if(state.p2.length > state.p1.length) return 2;
  return 0;
}

function timelineCorrect(boardYears, insertIndex, year){
  var left  = insertIndex > 0 ? boardYears[insertIndex - 1] : -Infinity;
  var right = insertIndex < boardYears.length ? boardYears[insertIndex] : Infinity;
  return year >= left && year <= right;
}

function validateGameData(D){
  var errors = [];
  var game = D.filter(function(c){ return c[6]; });
  if(game.length !== 52) errors.push('forventede 52 spilkort, fik ' + game.length);
  var names = {};
  game.forEach(function(c){
    var g = c[6];
    if(typeof g.y !== 'number') errors.push(c[0] + ': mangler/ugyldigt år');
    ['i','u','e'].forEach(function(k){
      if(typeof g[k] !== 'number' || g[k] < 1 || g[k] > 100)
        errors.push(c[0] + ': ' + k + ' uden for 1-100');
    });
    if(names[c[0]]) errors.push('dublet: ' + c[0]);
    names[c[0]] = 1;
  });
  return {ok: errors.length === 0, errors: errors};
}
/* ==PURE-LOGIC-END== */
```

- [ ] **Step 2: Write the failing test harness + pure-logic tests**

Create `tests/karakter-kamp.test.js`:

```js
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'Kortspil_religion-historie.html'), 'utf8');

function extract(startTag, endTag){
  const i = HTML.indexOf(startTag), j = HTML.indexOf(endTag);
  if(i < 0 || j < 0) throw new Error('marker not found: ' + startTag);
  return HTML.slice(i + startTag.length, j);
}

const ctx = { Math: Math, console: console, Infinity: Infinity };
vm.createContext(ctx);
vm.runInContext(extract('/* ==PURE-LOGIC-START== */', '/* ==PURE-LOGIC-END== */'), ctx);

let passed = 0;
function ok(name, cond){ assert.ok(cond, 'FAIL: ' + name); passed++; }

// alderScore: oldest -> 100, range 1..100
ok('alder oldest=100', ctx.alderScore(-1800, -1800) === 100);
ok('alder modern small', ctx.alderScore(1960, -1800) >= 1 && ctx.alderScore(1960, -1800) < 10);
ok('alder clamped', ctx.alderScore(3000, -1800) === 1);

// shuffle deterministic with seeded rng + preserves elements
function seedRng(seed){ return function(){ seed = (seed*1103515245+12345) & 0x7fffffff; return seed/0x7fffffff; }; }
const base = [1,2,3,4,5,6,7,8];
const sh = ctx.shuffle(base, seedRng(42));
ok('shuffle keeps all', sh.slice().sort((a,b)=>a-b).join(',') === '1,2,3,4,5,6,7,8');
ok('shuffle no mutate', base.join(',') === '1,2,3,4,5,6,7,8');

// splitDeck 52 -> 26/26
const sp = ctx.splitDeck(new Array(52).fill(0));
ok('split 26/26', sp[0].length === 26 && sp[1].length === 26);

// resolveRound A/B/tie (alder via oldest=-1800)
const cA = ['A','H','', '','','', {y:-100, i:50, u:50, e:50}];
const cB = ['B','H','', '','','', {y:1900, i:90, u:50, e:10}];
ok('A wins alder', ctx.resolveRound(cA, cB, 'alder', -1800).winner === 'A');
ok('B wins i',     ctx.resolveRound(cA, cB, 'i', -1800).winner === 'B');
ok('tie u',        ctx.resolveRound(cA, cB, 'u', -1800).winner === 'tie');

// applyRound: A wins i -> A gains both, turn=1
let st = {p1:[cA], p2:[cB], pot:[], turn:2, over:false, winner:null, last:null};
let r = ctx.applyRound(st, 'i', -1800);
ok('B wins -> p2 has 2', r.p2.length === 2 && r.p1.length === 0 && r.turn === 2);
ok('B wins -> over winner 2', r.over === true && r.winner === 2);

// applyRound tie -> pot grows, turn unchanged, not over (cards remain)
let st2 = {p1:[cA, cA], p2:[cB, cB], pot:[], turn:1, over:false, winner:null, last:null};
let r2 = ctx.applyRound(st2, 'u', -1800);
ok('tie -> pot 2', r2.pot.length === 2 && r2.turn === 1 && r2.over === false);

// timelineCorrect
ok('tl correct middle', ctx.timelineCorrect([-100, 1500], 1, 800) === true);
ok('tl wrong middle', ctx.timelineCorrect([-100, 1500], 1, 1600) === false);
ok('tl end ok', ctx.timelineCorrect([-100, 1500], 2, 2000) === true);

// validateGameData on a fixture
const good = [['x','H','','','','',{y:1,i:1,u:1,e:1}]];
while(good.length < 52) good.push(['c'+good.length,'H','','','','',{y:good.length,i:50,u:50,e:50}]);
ok('validate ok', ctx.validateGameData(good).ok === true);
const bad = good.slice(0, 51);
ok('validate wrong count', ctx.validateGameData(bad).ok === false);

console.log('PURE LOGIC: ' + passed + ' assertions passed');
```

- [ ] **Step 3: Run the test — verify it passes**

Run: `node tests/karakter-kamp.test.js`
Expected: `PURE LOGIC: 17 assertions passed` (no AssertionError).

- [ ] **Step 4: Commit**

```bash
git add Kortspil_religion-historie.html tests/karakter-kamp.test.js
git commit -m "feat(kortkamp): add pure game-logic block with unit tests"
```

---

## Task 2: Add the 52-card game data + validate against real D

**Files:**
- Modify: `Kortspil_religion-historie.html` (add `GAMESTATS` map + attach loop, fenced as the data block; place it immediately after the `/* ==PURE-LOGIC-END== */` line)
- Test: `tests/karakter-kamp.test.js` (extend)

- [ ] **Step 1: Add the GAMESTATS map and attach loop**

Insert after `/* ==PURE-LOGIC-END== */`. **Names must match `D` exactly** (a typo means <52 matches → the validation test fails):

```js
/* ==DATA-START== */
var GAMESTATS = {
  "Jesus fra Nazaret":{y:5,i:99,u:98,e:97},
  "Muhammad":{y:610,i:96,u:95,e:94},
  "Buddha (Siddhartha Gautama)":{y:-500,i:90,u:82,e:88},
  "Moses":{y:-1250,i:84,u:80,e:82},
  "Abraham":{y:-1800,i:82,u:85,e:78},
  "Martin Luther":{y:1483,i:88,u:70,e:80},
  "Moder Teresa":{y:1910,i:62,u:55,e:85},
  "Dalai Lama (den 14.)":{y:1935,i:58,u:50,e:80},
  "Konfutse (Confucius)":{y:-551,i:85,u:78,e:82},
  "Guru Nanak":{y:1469,i:66,u:58,e:64},
  "Mahatma Gandhi":{y:1869,i:85,u:72,e:90},
  "Martin Luther King Jr.":{y:1929,i:80,u:65,e:88},
  "N.F.S. Grundtvig":{y:1783,i:60,u:45,e:70},
  "Søren Kierkegaard":{y:1813,i:68,u:48,e:78},
  "Jeanne d'Arc":{y:1412,i:58,u:50,e:80},
  "Saladin":{y:1137,i:70,u:62,e:72},
  "Mansa Musa":{y:1280,i:60,u:55,e:66},
  "Adolf Hitler":{y:1889,i:95,u:90,e:90},
  "Winston Churchill":{y:1874,i:84,u:78,e:86},
  "Josef Stalin":{y:1878,i:90,u:85,e:84},
  "Franklin D. Roosevelt":{y:1882,i:85,u:80,e:82},
  "Anne Frank":{y:1929,i:55,u:60,e:88},
  "Erik Scavenius":{y:1877,i:45,u:30,e:50},
  "Harald Blåtand":{y:935,i:66,u:45,e:78},
  "Gorm den Gamle":{y:900,i:50,u:30,e:58},
  "Margrete 1.":{y:1353,i:64,u:48,e:70},
  "Christian 4.":{y:1577,i:58,u:42,e:74},
  "Tycho Brahe":{y:1546,i:70,u:55,e:72},
  "H.C. Andersen":{y:1805,i:72,u:80,e:88},
  "Niels Bohr":{y:1885,i:82,u:68,e:80},
  "Dronning Margrethe 2.":{y:1940,i:50,u:40,e:72},
  "Karen Blixen":{y:1885,i:58,u:55,e:70},
  "Isaac Newton":{y:1643,i:94,u:80,e:90},
  "Albert Einstein":{y:1879,i:95,u:85,e:95},
  "Charles Darwin":{y:1809,i:92,u:78,e:88},
  "Marie Curie":{y:1867,i:82,u:70,e:86},
  "Galileo Galilei":{y:1564,i:86,u:72,e:84},
  "Nicolaus Copernicus":{y:1473,i:84,u:68,e:78},
  "Aristoteles":{y:-384,i:92,u:82,e:88},
  "Sokrates":{y:-470,i:86,u:75,e:86},
  "Pythagoras":{y:-570,i:80,u:72,e:84},
  "Alan Turing":{y:1912,i:84,u:70,e:82},
  "Leonardo da Vinci":{y:1452,i:88,u:78,e:92},
  "Johannes Gutenberg":{y:1400,i:90,u:82,e:80},
  "Napoleon Bonaparte":{y:1769,i:86,u:78,e:86},
  "Julius Cæsar":{y:-100,i:88,u:80,e:88},
  "Cleopatra":{y:-69,i:68,u:60,e:84},
  "Alexander den Store":{y:-356,i:88,u:78,e:86},
  "Christofer Columbus":{y:1451,i:82,u:75,e:80},
  "Karl den Store":{y:742,i:80,u:68,e:74},
  "Nelson Mandela":{y:1918,i:80,u:68,e:88},
  "William Shakespeare":{y:1564,i:82,u:80,e:92}
};
D.forEach(function(c){ if(GAMESTATS[c[0]]) c[6] = GAMESTATS[c[0]]; });
var GAME = D.filter(function(c){ return c[6]; });
var OLDEST = Math.min.apply(null, GAME.map(function(c){ return c[6].y; }));
/* ==DATA-END== */
```

- [ ] **Step 2: Extend the test with real-data validation + a full-playthrough invariant**

Append to `tests/karakter-kamp.test.js` before the final `console.log`:

```js
// --- Real data: eval D + data block in the same ctx ---
const dataCtx = { Math: Math, console: console, Infinity: Infinity };
vm.createContext(dataCtx);
vm.runInContext(extract('/* ==PURE-LOGIC-START== */', '/* ==PURE-LOGIC-END== */'), dataCtx);
const dMatch = HTML.match(/const D=(\[[\s\S]*?\n\];)/);
if(!dMatch) throw new Error('D array not found');
vm.runInContext('var D=' + dMatch[1], dataCtx);
vm.runInContext(extract('/* ==DATA-START== */', '/* ==DATA-END== */'), dataCtx);

const v = dataCtx.validateGameData(dataCtx.D);
ok('real data valid: ' + JSON.stringify(v.errors), v.ok === true);
ok('GAME has 52', dataCtx.GAME.length === 52);
ok('OLDEST is Abraham -1800', dataCtx.OLDEST === -1800);

// Full random playthrough: cards conserved (==52), terminates, winner decided
function playOnce(seedStart){
  let seed = seedStart;
  const rng = function(){ seed = (seed*1103515245+12345) & 0x7fffffff; return seed/0x7fffffff; };
  let g = dataCtx.createGame(dataCtx.GAME, rng);
  for(let n = 0; n < 100000 && !g.over; n++){
    const total = g.p1.length + g.p2.length + g.pot.length;
    if(total !== 52) return 'card count drifted to ' + total;
    const key = STATSKEYS[Math.floor(rng()*STATSKEYS.length)];
    g = dataCtx.applyRound(g, key, dataCtx.OLDEST);
  }
  if(!g.over) return 'did not terminate';
  if(![0,1,2].includes(g.winner)) return 'bad winner';
  return 'ok';
}
const STATSKEYS = dataCtx.STATS.map(s => s.key);
for(let s = 1; s <= 20; s++) ok('playthrough seed ' + s, playOnce(s) === 'ok');
```

- [ ] **Step 3: Run tests — verify pass**

Run: `node tests/karakter-kamp.test.js`
Expected: `PURE LOGIC: 41 assertions passed` (17 + 24 new), no AssertionError. If `real data valid` fails, the printed `errors` array names the offending card (likely a name mismatch in `GAMESTATS`).

- [ ] **Step 4: Commit**

```bash
git add Kortspil_religion-historie.html tests/karakter-kamp.test.js
git commit -m "feat(kortkamp): add 52-card game data + data/playthrough tests"
```

---

## Task 3: Mode switcher (Kort / Trumf-dyst / Tidslinje)

**Files:**
- Modify: `Kortspil_religion-historie.html` (HTML structure, CSS, JS nav)

- [ ] **Step 1: Add the mode-nav markup + wrap existing content**

In the `.wrap`, immediately after the `</p>` that closes the `.lead` intro paragraph (the one ending "Spil-idéer nederst."), insert the nav:

```html
<div class="modenav" id="modenav">
  <button class="mbtn on" data-m="kort">📇 Kort</button>
  <button class="mbtn" data-m="dyst">⚔️ Trumf-dyst</button>
  <button class="mbtn" data-m="tid">⏳ Tidslinje</button>
</div>
```

Wrap the existing Kort-mode UI (the `.bar`, the `.meta`, the `.printhelp`, the `#grid`, the `#empty` paragraph, and the "Spil-idéer" paragraph) in a container:

```html
<div id="mode-kort">
  ... existing .bar / .meta / .printhelp / #grid / #empty / spil-idéer ...
</div>
<div id="mode-dyst" hidden></div>
<div id="mode-tid" hidden></div>
```

- [ ] **Step 2: Add CSS for the nav (in the screen `<style>`, before `@media print`)**

```css
.modenav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
.mbtn{cursor:pointer;font-family:"Anton",sans-serif;letter-spacing:.03em;font-size:16px;
  text-transform:uppercase;color:var(--ink);background:rgba(255,255,255,.06);
  border:1px solid var(--line);border-radius:12px;padding:10px 18px;transition:.15s}
.mbtn:hover{border-color:var(--gold)}
.mbtn.on{background:linear-gradient(180deg,var(--gold-soft),var(--gold));color:#3a2a02;border-color:transparent}
```

Add to `@media print`: hide the nav and the two game modes:
```css
.modenav,#mode-dyst,#mode-tid{display:none!important}
```

- [ ] **Step 3: Add the mode-switch JS (after the existing `render(); buildPrint();` lines)**

```js
var MODES = ['kort','dyst','tid'];
function showMode(m){
  MODES.forEach(function(x){
    document.getElementById('mode-' + x).hidden = (x !== m);
  });
  document.querySelectorAll('.mbtn').forEach(function(b){
    b.classList.toggle('on', b.dataset.m === m);
  });
  if(m === 'dyst') initDyst();
  if(m === 'tid')  initTid();
}
document.getElementById('modenav').addEventListener('click', function(e){
  var b = e.target.closest('.mbtn'); if(!b) return;
  showMode(b.dataset.m);
});
// stubs (replaced in later tasks)
function initDyst(){}
function initTid(){}
```

- [ ] **Step 4: Browser-verify the nav switches sections**

Start a local server and load the page, then confirm the three buttons toggle the three containers (only one visible at a time). Verification commands are in Task 7's harness; for now: serve the folder, navigate to the page, click each `.mbtn`, assert the matching `#mode-*` is visible and the others `hidden`.

- [ ] **Step 5: Commit**

```bash
git add Kortspil_religion-historie.html
git commit -m "feat(kortkamp): add mode switcher (Kort/Trumf-dyst/Tidslinje)"
```

---

## Task 4: Trumf-dyst UI + state + persistence

**Files:**
- Modify: `Kortspil_religion-historie.html` (CSS, `initDyst` + render/handlers, localStorage)

- [ ] **Step 1: Add Trumf-dyst CSS (screen `<style>`)**

```css
.dyst{max-width:560px;margin:0 auto;text-align:center}
.dyst .turn{font-family:"Anton";font-size:22px;color:var(--gold);text-transform:uppercase;margin:0 0 4px}
.dyst .score{color:var(--muted);font-size:15px;margin:0 0 14px}
.dyst .score b{color:var(--gold-soft)}
.dyst .note{color:var(--muted);font-size:12.5px;margin:6px 0 16px;font-style:italic}
.dcard{background:linear-gradient(170deg,#172263,#0c1340);border:1px solid var(--line);
  border-radius:18px;padding:18px;margin:0 auto}
.dcard .dnm{font-family:"Anton";font-size:22px;color:var(--gold);text-transform:uppercase;line-height:1.05}
.dcard .dera{color:var(--muted);font-size:13px;margin-bottom:10px}
.statline{display:flex;justify-content:space-between;align-items:center;gap:10px;
  border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:7px 0;
  font-size:16px;cursor:pointer;background:rgba(255,255,255,.04);transition:.13s}
.statline:hover{border-color:var(--gold);background:rgba(247,201,72,.10)}
.statline .sv{font-family:"Anton";font-size:20px;color:var(--gold-soft)}
.statline.win{background:rgba(123,211,137,.18);border-color:var(--rel)}
.statline.lose{opacity:.55}
.statline.pick{pointer-events:none}
.reveal{display:flex;gap:12px;justify-content:center;align-items:stretch;flex-wrap:wrap}
.reveal .dcard{flex:1 1 220px}
.dmsg{font-family:"Anton";font-size:20px;text-transform:uppercase;margin:12px 0;min-height:24px}
.dmsg.win1,.dmsg.win2{color:var(--rel)} .dmsg.tie{color:var(--beg)}
.dbtns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px}
.dbtns button{cursor:pointer;font-family:inherit;font-weight:700;font-size:14px;border-radius:10px;
  padding:10px 16px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--ink)}
.dbtns button.primary{background:linear-gradient(180deg,var(--gold-soft),var(--gold));color:#3a2a02;border-color:transparent}
.facedown{display:flex;align-items:center;justify-content:center;font-size:40px;color:var(--muted);
  background:repeating-linear-gradient(45deg,#0c1340,#0c1340 8px,#101a52 8px,#101a52 16px);
  border:1px solid var(--line);border-radius:18px;min-height:160px}
```

- [ ] **Step 2: Implement `initDyst` + rendering + handlers (replace the `initDyst(){}` stub)**

```js
var DKEY = 'uge25_kortkamp_v1';
var dgame = null, dphase = 'pick'; // 'pick' | 'reveal'

function initDyst(){
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(DKEY)); } catch(e){}
  dgame = saved && saved.p1 ? saved : createGame(GAME);
  dphase = 'pick';
  renderDyst();
}
function saveDyst(){ try { localStorage.setItem(DKEY, JSON.stringify(dgame)); } catch(e){} }

function statRow(card, key, cls){
  var s = STATS.filter(function(x){return x.key===key;})[0];
  return '<div class="statline ' + (cls||'') + '" data-key="' + key + '">' +
         '<span>' + s.icon + ' ' + s.label + '</span>' +
         '<span class="sv">' + statValue(card, key, OLDEST) + '</span></div>';
}
function cardHTML(card, showStats){
  var h = '<div class="dcard"><div class="dnm">' + esc(card[0]) + '</div>' +
          '<div class="dera">' + esc(card[2]) + '</div>';
  if(showStats) STATS.forEach(function(s){ h += statRow(card, s.key, ''); });
  return h + '</div>';
}

function renderDyst(){
  var m = document.getElementById('mode-dyst');
  if(dgame.over){
    var w = dgame.winner;
    m.innerHTML = '<div class="dyst"><p class="turn">' +
      (w === 0 ? 'Uafgjort!' : 'Spiller ' + w + ' vandt! 🏆') + '</p>' +
      '<p class="score">Slut: 🟦 ' + dgame.p1.length + ' — ' + dgame.p2.length + ' 🟥</p>' +
      '<div class="dbtns"><button class="primary" id="dnew">Nyt spil</button></div></div>';
    document.getElementById('dnew').onclick = function(){ dgame = createGame(GAME); dphase='pick'; saveDyst(); renderDyst(); };
    saveDyst();
    return;
  }
  var active = dgame.turn;
  var myTop = active === 1 ? dgame.p1[0] : dgame.p2[0];
  if(dphase === 'pick'){
    m.innerHTML = '<div class="dyst">' +
      '<p class="turn">Din tur — Spiller ' + active + '</p>' +
      '<p class="score">🟦 <b>' + dgame.p1.length + '</b> — <b>' + dgame.p2.length + '</b> 🟥' +
        (dgame.pot.length ? ' · pulje: ' + dgame.pot.length : '') + '</p>' +
      '<p class="note">Høje tal = stor historisk betydning — ikke at personen var „god“.</p>' +
      cardHTML(myTop, true) +
      '<div class="dbtns"><button id="dstop">Stop &amp; tæl op</button>' +
      '<button id="dnew2">Nyt spil</button></div></div>';
    m.querySelectorAll('.statline').forEach(function(el){
      el.onclick = function(){ pickStat(el.dataset.key); };
    });
  } else { // reveal
    var a = dgame.last.a, b = dgame.last.b, key = dgame.last.key, res = dgame.last.winner;
    var cls1 = res === 'A' ? 'win' : (res === 'B' ? 'lose' : '');
    var cls2 = res === 'B' ? 'win' : (res === 'A' ? 'lose' : '');
    function reveal(card, winCls){
      var h = '<div class="dcard"><div class="dnm">' + esc(card[0]) + '</div><div class="dera">' + esc(card[2]) + '</div>';
      STATS.forEach(function(s){
        var extra = s.key === key ? (' ' + winCls) : ''; h += statRow(card, s.key, (s.key===key?'pick':'') + extra);
      });
      return h + '</div>';
    }
    var msg = res === 'tie' ? 'Uafgjort — til puljen!' : 'Spiller ' + (res==='A'?1:2) + ' vinder runden!';
    m.innerHTML = '<div class="dyst">' +
      '<p class="score">🟦 <b>' + dgame.p1.length + '</b> — <b>' + dgame.p2.length + '</b> 🟥' +
        (dgame.pot.length ? ' · pulje: ' + dgame.pot.length : '') + '</p>' +
      '<div class="reveal">' + reveal(a, cls1) + reveal(b, cls2) + '</div>' +
      '<p class="dmsg ' + (res==='tie'?'tie':(res==='A'?'win1':'win2')) + '">' + msg + '</p>' +
      '<div class="dbtns"><button class="primary" id="dnext">Næste runde</button></div></div>';
    document.getElementById('dnext').onclick = function(){ dphase = 'pick'; renderDyst(); };
  }
  var stop = document.getElementById('dstop'); if(stop) stop.onclick = stopCount;
  var nw = document.getElementById('dnew2'); if(nw) nw.onclick = function(){ dgame = createGame(GAME); dphase='pick'; saveDyst(); renderDyst(); };
}

function pickStat(key){
  dgame = applyRound(dgame, key, OLDEST);
  dphase = 'reveal';
  saveDyst();
  renderDyst();
}
function stopCount(){
  var w = leader(dgame);
  dgame.over = true; dgame.winner = w;
  saveDyst(); renderDyst();
}
```

- [ ] **Step 3: Browser-verify a full round**

Serve + load, switch to Trumf-dyst, click a stat → reveal shows both cards with the chosen stat highlighted and a winner message; click "Næste runde" → back to pick with updated counts (sum still 52). Reload the page, switch to Trumf-dyst → the in-progress game is restored from localStorage. Click "Nyt spil" → fresh 26/26.

- [ ] **Step 4: Commit**

```bash
git add Kortspil_religion-historie.html
git commit -m "feat(kortkamp): Trumf-dyst UI, scoring, reveal, persistence"
```

---

## Task 5: Tidslinje UI

**Files:**
- Modify: `Kortspil_religion-historie.html` (CSS, `initTid` + handlers)

- [ ] **Step 1: Add Tidslinje CSS (screen `<style>`)**

```css
.tid{max-width:720px;margin:0 auto;text-align:center}
.tid .turn{font-family:"Anton";font-size:20px;color:var(--gold);text-transform:uppercase;margin:0 0 4px}
.tid .score{color:var(--muted);font-size:14px;margin:0 0 12px}
.tboard{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch;justify-content:center;margin:14px 0}
.tslot{min-width:26px;border:1px dashed var(--line);border-radius:8px;cursor:pointer;
  display:flex;align-items:center;color:var(--muted);font-size:18px;padding:0 8px;transition:.13s}
.tslot:hover{border-color:var(--gold);color:var(--gold)}
.tcard{background:linear-gradient(170deg,#172263,#0c1340);border:1px solid var(--line);
  border-radius:10px;padding:8px 10px;min-width:120px;max-width:150px;font-size:12px}
.tcard .tn{font-family:"Anton";font-size:13px;color:var(--gold);text-transform:uppercase;line-height:1.05}
.tcard .ty{color:var(--gold-soft);font-weight:700;margin-top:3px}
.tcur{background:linear-gradient(170deg,#22305f,#101a52);border:1px solid var(--gold);
  border-radius:12px;padding:12px;max-width:260px;margin:0 auto 6px}
.tcur .tn{font-family:"Anton";font-size:18px;color:var(--gold);text-transform:uppercase}
.tfeed{font-family:"Anton";font-size:18px;text-transform:uppercase;min-height:22px;margin:10px 0}
.tfeed.good{color:var(--rel)} .tfeed.bad{color:#ff8a8a}
```

- [ ] **Step 2: Implement `initTid` (replace the `initTid(){}` stub)**

```js
var tdeck = [], tboard = [], tcur = null, tscore = 0, tdrawn = 0, TROUNDS = 16;

function fmtYear(y){ return y < 0 ? Math.abs(y) + ' f.v.t.' : '' + y; }

function initTid(){
  tdeck = shuffle(GAME).slice(0, TROUNDS);
  tboard = [ tdeck.shift() ];      // first card placed free
  tscore = 0; tdrawn = 1;
  drawTid();
}
function drawTid(){
  tcur = tdeck.shift() || null;
  renderTid('');
}
function renderTid(feed){
  var m = document.getElementById('mode-tid');
  if(!tcur){
    m.innerHTML = '<div class="tid"><p class="turn">Færdig! 🏆</p>' +
      '<p class="score">Du placerede <b>' + tscore + '</b> af ' + (tdrawn-1) + ' rigtigt.</p>' +
      '<div class="dbtns"><button class="primary" id="tnew">Spil igen</button></div></div>';
    document.getElementById('tnew').onclick = initTid;
    return;
  }
  // board sorted left->right by y already (we insert in correct spot on success)
  var slots = '<span class="tslot" data-i="0">◀</span>';
  tboard.forEach(function(c, i){
    slots += '<div class="tcard"><div class="tn">' + esc(c[0]) + '</div><div class="ty">' + fmtYear(c[6].y) + '</div></div>';
    slots += '<span class="tslot" data-i="' + (i+1) + '">▼</span>';
  });
  m.innerHTML = '<div class="tid">' +
    '<p class="turn">Tidslinje</p>' +
    '<p class="score">Point: <b>' + tscore + '</b> · kort ' + tdrawn + '/' + TROUNDS + '</p>' +
    '<div class="tcur"><div class="tn">' + esc(tcur[0]) + '</div><div style="color:var(--muted);font-size:12px">' + esc(tcur[2]) + '</div></div>' +
    '<p class="score">Klik hvor kortet skal ind på tidslinjen (ældst til venstre):</p>' +
    '<div class="tboard">' + slots + '</div>' +
    '<p class="tfeed ' + (feed?(feed.ok?'good':'bad'):'') + '">' + (feed ? feed.msg : '') + '</p></div>';
  m.querySelectorAll('.tslot').forEach(function(el){
    el.onclick = function(){ placeTid(parseInt(el.dataset.i, 10)); };
  });
}
function placeTid(idx){
  var years = tboard.map(function(c){ return c[6].y; });
  var correct = timelineCorrect(years, idx, tcur[6].y);
  var msg;
  // Always insert into the true sorted position so the board stays ordered.
  var truePos = years.filter(function(y){ return y <= tcur[6].y; }).length;
  tboard.splice(truePos, 0, tcur);
  if(correct){ tscore++; msg = {ok:true, msg:'Rigtigt! (' + fmtYear(tcur[6].y) + ')'}; }
  else { msg = {ok:false, msg:'Forbi — kortet hører til ' + fmtYear(tcur[6].y)}; }
  tdrawn++;
  tcur = tdeck.shift() || null;
  renderTid(msg);
}
```

- [ ] **Step 3: Browser-verify**

Switch to Tidslinje: a first card is on the board; the current card shows; clicking a slot inserts it (board stays sorted oldest→left), score increments on a correct slot, feedback line shows the year; after 16 cards the end screen shows `X af 15 rigtigt`; "Spil igen" restarts.

- [ ] **Step 4: Commit**

```bash
git add Kortspil_religion-historie.html
git commit -m "feat(kortkamp): Tidslinje (timeline) mode"
```

---

## Task 6: Print synergy — stats on game-card fronts + deck toggle

**Files:**
- Modify: `Kortspil_religion-historie.html` (print CSS, `frontCell`, `buildPrint`, print help UI)

- [ ] **Step 1: Add print CSS for the front stat box (inside `@media print`)**

```css
.pf .pstats{margin-top:2mm;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:.5mm 3mm;
  font-size:8.5px;text-align:left}
.pf .pstats .s{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:.3mm 0}
.pf .pstats .s b{font-weight:700}
```

- [ ] **Step 2: Make `frontCell` render stats when the card is a game card**

Replace the existing `frontCell` function body so it appends a stat box for cards that have `c[6]`:

```js
function frontCell(it){
  var d=document.createElement("div"); d.className="pc pf";
  var html=pcCorner(it.c,it.i)+
    `<span class="pico">${ICON[it.c[1]]}</span>`+
    `<span class="pnm">${esc(it.c[0])}</span>`+
    `<span class="pera">${esc(it.c[2])}</span>`;
  if(it.c[6]){
    html += '<div class="pstats">' + STATS.map(function(s){
      return '<div class="s"><span>'+s.icon+' '+s.label+'</span><b>'+statValue(it.c,s.key,OLDEST)+'</b></div>';
    }).join('') + '</div>';
  }
  d.innerHTML=html; return d;
}
```

- [ ] **Step 3: Let `buildPrint` accept a card set + add the toggle UI**

Change `buildPrint` to take an optional deck and default to all 100:

```js
function buildPrint(deck){
  var area=document.getElementById("printArea"); area.innerHTML="";
  var src = deck || D;
  var all=src.map(function(c){ return {c:c, i:D.indexOf(c)}; });
  for(let p=0;p<all.length;p+=PER){
    const page=all.slice(p,p+PER);
    const fs=document.createElement("div"); fs.className="sheet front-sheet";
    for(let k=0;k<PER;k++) fs.appendChild(page[k]?frontCell(page[k]):emptyCell());
    area.appendChild(fs);
    const bs=document.createElement("div"); bs.className="sheet back-sheet";
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const it=page[r*COLS+(COLS-1-c)];
      bs.appendChild(it?backCell(it):emptyCell());
    }
    area.appendChild(bs);
  }
}
```

Replace the existing print link line in `.meta` with two print options:

```html
<div class="meta"><span id="count"></span> ·
  <span class="print" id="printAll">🖖 Print alle 100</span> ·
  <span class="print" id="printDeck">⚔️ Print spildækket (52)</span></div>
```

And wire them (after `render(); buildPrint();`):

```js
document.getElementById('printAll').onclick = function(){ buildPrint(D); window.print(); };
document.getElementById('printDeck').onclick = function(){ buildPrint(GAME); window.print(); };
```

- [ ] **Step 4: Re-verify duplex alignment for the 52-deck (Node)**

Append to `tests/karakter-kamp.test.js`:

```js
// 52-card deck paginates to 6 front + 6 back sheets (ceil(52/9)=6 pairs)
ok('deck pages', Math.ceil(52/9) === 6);
```
Run: `node tests/karakter-kamp.test.js` → `... assertions passed`.

- [ ] **Step 5: Browser-verify both print outputs**

In Kort mode, reveal `#printArea` (as in the existing preview technique): "Print spildækket (52)" builds 12 sheets (6 front/back pairs) where each game-card front shows the 4 stats; "Print alle 100" builds 24 sheets. Confirm 0 back-cell text overflow on the deck and that the stat box fits the front cell.

- [ ] **Step 6: Commit**

```bash
git add Kortspil_religion-historie.html tests/karakter-kamp.test.js
git commit -m "feat(kortkamp): printable Top Trumps deck with stats on fronts"
```

---

## Task 7: Final verification + landing-page/README copy

**Files:**
- Modify: `index.html`, `README.md`
- Test: full Node suite + browser end-to-end

- [ ] **Step 1: Update the Karakter-kortspil card on `index.html`**

Change its `<p>` text to mention the game:

```html
<p>100 kort med religiøse og historiske personer. Blæd og lær — eller spil
   <b>Trumf-dyst</b> og <b>Tidslinje</b> med et 52-korts spildæk (hver person har point).</p>
```

- [ ] **Step 2: Update `README.md` line for the card game**

Replace the Kortspil bullet with:

```markdown
- **Kortspil_religion-historie.html** — 100 karakter-kort + spil: Trumf-dyst (Top Trumps) og Tidslinje med et 52-korts spildæk (point pr. person).
```

- [ ] **Step 3: Run the full Node test suite**

Run: `node tests/karakter-kamp.test.js`
Expected: final line `PURE LOGIC: N assertions passed`, no AssertionError.

- [ ] **Step 4: Browser end-to-end**

Serve the folder; in one session: (a) Kort mode still blades/searches/flips; (b) Trumf-dyst: play 3 rounds, counts stay summing to 52, persistence survives reload; (c) Tidslinje: place all cards to the end screen; (d) both print outputs render. Use `read_console_messages` to confirm no JS errors.

- [ ] **Step 5: Commit**

```bash
git add index.html README.md
git commit -m "docs(kortkamp): mention card game on landing page and README"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** §2 mode switch → T3; §3 data model + stats + sensitivity note → T2, T4 (note rendered in Trumf-dyst); §4 Trumf-dyst rules (tie/pot/stop) → T1 logic + T4 UI; §5 Tidslinje → T1 logic + T5 UI; §6 persistence → T4; §7 print synergy + deck toggle → T6; §8 aesthetic → T3–T6 CSS; §9 testing → T1/T2 Node + browser steps; §11 the 52 cards → T2 data. No gaps.

**Placeholder scan:** All code blocks are complete; data fully specified; the only deferred items are explicitly out of scope (§10). The `initDyst`/`initTid` stubs in T3 are intentional and replaced in T4/T5.

**Type consistency:** State shape `{p1,p2,pot,turn,over,winner,last}` is identical across `createGame`/`applyRound`/UI. `statValue(card,key,oldest)` signature consistent in tests, UI, and print. `STATS` (objects with `key/label/icon`) used the same way in logic, UI, and print. `buildPrint(deck)` callers updated in T6.
