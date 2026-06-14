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

console.log('PURE LOGIC: ' + passed + ' assertions passed');
