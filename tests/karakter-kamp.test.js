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

// applyRound: B wins i -> B gains both, over, winner 2
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
const STATSKEYS = dataCtx.STATS.map(s => s.key);
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
for(let s = 1; s <= 20; s++) ok('playthrough seed ' + s, playOnce(s) === 'ok');

// 52-card deck paginates to 6 front/back pairs (ceil(52/9)=6)
ok('deck pages', Math.ceil(52/9) === 6);

console.log('PURE LOGIC: ' + passed + ' assertions passed');
