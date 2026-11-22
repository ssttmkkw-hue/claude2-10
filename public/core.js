/* 皇家竞技场 · 核心逻辑（浏览器与 Node 服务器共用，无 DOM 依赖） */
(function (root) {
'use strict';
const COLS = 18, ROWS = 32, SQ = 0.86;          // 18x32 格竞技场，纵向略压缩营造俯视角
const BRIDGES = [3.5, 14.5];

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TAU = Math.PI * 2;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const UD = {
  knight:   { name: '骑士',   hp: 1450, dmg: 165, hs: 1.2, spd: 1.0,  range: 0.6, sight: 5.5, r: 0.42, tgt: 'ground',    size: 1.0,  mass: 6 },
  archer:   { name: '弓箭手', hp: 300,  dmg: 95,  hs: 1.0, spd: 1.0,  range: 5.0, sight: 5.5, r: 0.32, tgt: 'all',       size: 0.88, mass: 3, proj: 'arrow' },
  giant:    { name: '巨人',   hp: 3400, dmg: 210, hs: 1.5, spd: 0.75, range: 0.6, sight: 7.5, r: 0.7,  tgt: 'buildings', size: 1.5,  mass: 18 },
  skeleton: { name: '骷髅',   hp: 81,   dmg: 81,  hs: 1.0, spd: 1.4,  range: 0.4, sight: 5.0, r: 0.24, tgt: 'ground',    size: 0.62, mass: 1 },
  wizard:   { name: '法师',   hp: 640,  dmg: 240, hs: 1.4, spd: 1.0,  range: 5.5, sight: 5.5, r: 0.36, tgt: 'all',       size: 1.0,  mass: 4, proj: 'orb', splash: 1.5 },
  goblin:   { name: '哥布林', hp: 190,  dmg: 115, hs: 1.1, spd: 1.6,  range: 0.4, sight: 5.5, r: 0.3,  tgt: 'ground',    size: 0.8,  mass: 2 },
  dragon:   { name: '飞龙宝宝', hp: 1050, dmg: 150, hs: 1.5, spd: 1.35, range: 3.5, sight: 5.5, r: 0.5, tgt: 'all',      size: 1.05, mass: 5, air: true, proj: 'flame', splash: 1.2 },
  ironman:  { name: '铁甲武士', hp: 1300, dmg: 650, hs: 1.8, spd: 1.0, range: 0.6, sight: 5.0, r: 0.45, tgt: 'ground',  size: 1.12, mass: 7 },
  musketeer:{ name: '火枪手', hp: 600,  dmg: 180, hs: 1.1, spd: 1.0,  range: 6.0, sight: 6.0, r: 0.36, tgt: 'all',       size: 0.95, mass: 4, proj: 'bullet' },
  bomber:   { name: '炸弹兵', hp: 300,  dmg: 225, hs: 1.9, spd: 1.0,  range: 4.5, sight: 5.5, r: 0.32, tgt: 'ground',    size: 0.85, mass: 3, proj: 'bomb', splash: 1.5 },
  bat:      { name: '蝙蝠',   hp: 70,   dmg: 70,  hs: 1.1, spd: 1.6,  range: 0.4, sight: 5.0, r: 0.25, tgt: 'all',       size: 0.6,  mass: 1, air: true },
  lancer:   { name: '枪骑兵', hp: 1500, dmg: 300, hs: 1.4, spd: 1.0,  range: 0.7, sight: 5.5, r: 0.55, tgt: 'ground',    size: 1.1,  mass: 9, charge: true },
  hog:      { name: '野猪骑手', hp: 1400, dmg: 250, hs: 1.6, spd: 1.7, range: 0.5, sight: 9.5, r: 0.5, tgt: 'buildings', size: 1.05, mass: 8, jump: true },
  balloon:  { name: '热气球', hp: 1400, dmg: 700, hs: 3.0, spd: 0.75, range: 0.2, sight: 9.0, r: 0.55, tgt: 'buildings', size: 0.9,  mass: 8, air: true, deathDmg: 250, deathR: 2 },
  valk:     { name: '旋斧战士', hp: 1600, dmg: 220, hs: 1.5, spd: 1.0, range: 0.5, sight: 5.5, r: 0.45, tgt: 'ground',  size: 1.0,  mass: 7, selfSplash: 1.2 },
  cannonB:  { name: '加农炮', hp: 850,  dmg: 200, hs: 0.9, spd: 0, range: 5.5, sight: 5.5, r: 0.7, tgt: 'ground', size: 1.0, mass: 999, building: true, life: 30, proj: 'cannon' },
  tomb:     { name: '墓碑',   hp: 450,  dmg: 0,   hs: 3.5, spd: 0, range: 0,   sight: 0,   r: 0.6, tgt: 'none',   size: 1.0, mass: 999, building: true, life: 40, spawn: 'skeleton', deathSpawn: 4 },
  inferno:  { name: '炼狱塔', hp: 1500, dmg: 25,  hs: 0.4, spd: 0, range: 6.0, sight: 6.0, r: 0.75, tgt: 'all',   size: 1.0, mass: 999, building: true, life: 40, ramp: true },
  mortar:   { name: '迫击炮', hp: 1100, dmg: 230, hs: 5.0, spd: 0, range: 11.5, minRange: 3.0, sight: 11.5, r: 0.7, tgt: 'ground', size: 1.0, mass: 999, building: true, life: 30, proj: 'mortar', splash: 1.3 },
  witch:    { name: '女巫',   hp: 720,  dmg: 110, hs: 1.1, spd: 1.0,  range: 5.0, sight: 5.5, r: 0.36, tgt: 'all',       size: 1.0,  mass: 4, proj: 'hex', splash: 1.0, spawnEvery: 7, spawnN: 3 },
};

const CD = {
  knight:   { name: '骑士',     cost: 3, unit: 'knight',   n: 1,  rar: 'common' },
  archers:  { name: '弓箭手',   cost: 3, unit: 'archer',   n: 2,  rar: 'common' },
  giant:    { name: '巨人',     cost: 5, unit: 'giant',    n: 1,  rar: 'rare' },
  skarmy:   { name: '骷髅军团', cost: 3, unit: 'skeleton', n: 12, rar: 'epic' },
  fireball: { name: '火球',     cost: 4, spell: 'fireball', radius: 2.5, dmg: 580, tower: 0.35, rar: 'rare' },
  wizard:   { name: '法师',     cost: 5, unit: 'wizard',   n: 1,  rar: 'rare' },
  goblins:  { name: '哥布林',   cost: 2, unit: 'goblin',   n: 3,  rar: 'common' },
  dragon:   { name: '飞龙宝宝', cost: 4, unit: 'dragon',   n: 1,  rar: 'epic' },
  ironman:  { name: '铁甲武士', cost: 4, unit: 'ironman',  n: 1,  rar: 'epic' },
  arrows:   { name: '万箭齐发', cost: 3, spell: 'arrows', radius: 4, dmg: 270, tower: 0.35, rar: 'common' },
  musketeer:{ name: '火枪手',   cost: 4, unit: 'musketeer', n: 1, rar: 'rare' },
  bomber:   { name: '炸弹兵',   cost: 2, unit: 'bomber',  n: 1, rar: 'common' },
  bats:     { name: '蝙蝠群',   cost: 2, unit: 'bat',     n: 5, rar: 'common' },
  valk:     { name: '旋斧战士', cost: 4, unit: 'valk',    n: 1, rar: 'rare' },
  hog:      { name: '野猪骑手', cost: 4, unit: 'hog',     n: 1, rar: 'rare' },
  lancer:   { name: '枪骑兵',   cost: 5, unit: 'lancer',  n: 1, rar: 'legendary' },
  balloon:  { name: '热气球',   cost: 5, unit: 'balloon', n: 1, rar: 'epic' },
  cannonB:  { name: '加农炮',   cost: 3, unit: 'cannonB', n: 1, rar: 'common' },
  tomb:     { name: '墓碑',     cost: 3, unit: 'tomb',    n: 1, rar: 'rare' },
  inferno:  { name: '炼狱塔',   cost: 5, unit: 'inferno', n: 1, rar: 'legendary' },
  zap:      { name: '电击术',   cost: 2, spell: 'zap', radius: 2.5, dmg: 160, tower: 0.35, stun: 0.5, rar: 'common' },
  freeze:   { name: '冰冻术',   cost: 4, spell: 'freeze', radius: 3, dmg: 90, tower: 0.35, stun: 4, rar: 'epic' },
  rage:     { name: '狂暴术',   cost: 2, spell: 'rage', radius: 3, dur: 6, dmg: 0, tower: 0, boost: 1.35, rar: 'epic' },
  mortar:   { name: '迫击炮',   cost: 4, unit: 'mortar', n: 1, rar: 'common' },
  witch:    { name: '女巫',     cost: 5, unit: 'witch', n: 1, rar: 'epic' },
};

for (const k in CD) if (CD[k].unit) UD[CD[k].unit].value = CD[k].cost / CD[k].n;
const ALL_CARDS = Object.keys(CD);
const DEFAULT_DECKS = [
  ['knight', 'archers', 'giant', 'skarmy', 'fireball', 'wizard', 'goblins', 'dragon'],
  ['hog', 'musketeer', 'valk', 'cannonB', 'zap', 'fireball', 'bats', 'goblins'],
  ['balloon', 'lancer', 'inferno', 'tomb', 'freeze', 'arrows', 'bomber', 'ironman'],
];
const WINCON = ['giant', 'hog', 'balloon', 'lancer'];
const BIGSPELL = ['fireball', 'arrows', 'freeze'];
const ANTIAIR = ['archers', 'musketeer', 'wizard', 'dragon', 'bats', 'inferno'];
function genDeck() {
  const pick = new Set();
  const r = a => a[Math.floor(Math.random() * a.length)];
  pick.add(r(WINCON)); pick.add(r(BIGSPELL)); pick.add(r(ANTIAIR));
  if (Math.random() < 0.6) pick.add(r(['cannonB', 'tomb', 'inferno']));
  if (Math.random() < 0.6) pick.add(r(['zap', 'arrows']));
  const rest = shuffle(ALL_CARDS.filter(c => !WINCON.includes(c) || Math.random() < 0.25));
  for (const c of rest) { if (pick.size >= 8) break; pick.add(c); }
  return shuffle([...pick].slice(0, 8));
}

function deckOK(d) { return d.length === 8 && d.every(c => c && CD[c]); }
function avgCost(d) { const f = d.filter(Boolean); return f.length ? (f.reduce((s, c) => s + CD[c].cost, 0) / f.length) : 0; }

const DIFF = {
  easy:   { label: '简单', think: 1.6, push: 9.8, elMul: 0.85, smart: 0.55 },
  normal: { label: '普通', think: 0.95, push: 9.0, elMul: 1.0, smart: 0.85 },
  hard:   { label: '困难', think: 0.5, push: 8.0, elMul: 1.15, smart: 1.0 },
};
const TOWER_POS = [
  { team: 0, type: 'king', x: 9, y: 29 }, { team: 0, type: 'princess', x: 3.5, y: 25.5 }, { team: 0, type: 'princess', x: 14.5, y: 25.5 },
  { team: 1, type: 'king', x: 9, y: 3 },  { team: 1, type: 'princess', x: 3.5, y: 6.5 },  { team: 1, type: 'princess', x: 14.5, y: 6.5 },
];


let G = null;
const hooks = { sfx: () => {} };
function sfx(n) { hooks.sfx(n); }
function setG(g) { G = g; }
function getG() { return G; }

function makeTower(p) {
  const k = p.type === 'king';
  return {
    kind: 'tower', ttype: p.type, team: p.team, x: p.x, y: p.y, w: k ? 4 : 3, h: k ? 2.3 : 1.75, r: k ? 2.0 : 1.5,
    hp: k ? 4200 : 2600, maxHp: k ? 4200 : 2600, dmg: k ? 115 : 95, hs: k ? 1.0 : 0.8, range: k ? 7 : 7.5,
    cd: 0, target: null, alive: true, active: !k, aim: p.team ? Math.PI / 2 : -Math.PI / 2, recoil: 0, flash: 0, atk: 0,
    face: 1, lane: p.x < 9 ? 0 : 1, zT: 0, smokeT: 0, rubble: null, stun: 0, frozen: 0,
  };
}
function newGame(diff, deck0, deck1, opts = {}) {
  const g = {
    state: 'countdown', cd: 3.5, time: 180, ot: false, dbl: false, el: [5, 5], crowns: [0, 0],
    units: [], towers: [], projs: [], parts: [], decals: [], texts: [], banners: [], zones: [], shake: 0,
    diff, hand: [[], []], queue: [[], []], ai: { t: 2.5 }, winner: -1, endT: 0, endDelay: 0, elapsed: 0, uid: 1, lastTick: 4,
    barShake: 0, decks: [deck0.slice(), deck1.slice()], pvp: !!opts.pvp,
  };
  for (let i = 0; i < 2; i++) { const d = shuffle(g.decks[i].slice()); g.hand[i] = d.slice(0, 4); g.queue[i] = d.slice(4); }
  for (const p of TOWER_POS) g.towers.push(makeTower(p));
  G = g; return g;
}
function king(team) { return G.towers.find(t => t.team === team && t.ttype === 'king'); }
function laneDead(team, lane) { const t = G.towers.find(t => t.team === team && t.ttype === 'princess' && t.lane === lane); return !t.alive; }
function isBld(e) { return e.kind === 'tower' || !!e.d.building; }

function makeUnit(type, team, x, y, delay) {
  const d = UD[type];
  return {
    kind: 'unit', id: G.uid++, type, d, team, x, y, z: 0, py: y, hp: d.hp, maxHp: d.hp, r: d.r,
    delay, deploy: 1.0, deployMax: 1.0, spawnT: 0, landed: false,
    cd: d.building ? d.hs * 0.5 : d.hs * 0.5, target: null, retarget: 0, alive: true, face: team === 0 ? 1 : -1,
    walk: Math.random() * 6, atk: 0, flash: 0, attacking: false, moving: false, flap: Math.random() * 6,
    stun: 0, frozen: 0, rage: 0, charging: false, chargeDist: 0, ramp: 0, ang: team ? Math.PI / 2 : -Math.PI / 2, spawnCd: 1.5,
  };
}
function formation(n) {
  if (n === 1) return [[0, 0]];
  if (n === 2) return [[-0.6, 0], [0.6, 0]];
  if (n === 3) return [[0, -0.55], [-0.65, 0.4], [0.65, 0.4]];
  if (n === 5) return [[0, 0], [-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]];
  const pts = [];
  for (let i = 0; i < n; i++) {
    if (i < 4) { const a = i * Math.PI / 2 + Math.PI / 4; pts.push([Math.cos(a) * 0.45, Math.sin(a) * 0.45]); }
    else { const a = (i - 4) * TAU / (n - 4); pts.push([Math.cos(a) * 1.1, Math.sin(a) * 1.1]); }
  }
  return pts;
}

// 放置合法性
function onTower(x, y) {
  for (const t of G.towers) { if (!t.alive) continue; if (Math.abs(x - t.x) < t.w / 2 && Math.abs(y - t.y) < t.w / 2) return true; }
  return false;
}
function isBuildingCard(cid) { return !!(CD[cid].unit && UD[CD[cid].unit].building); }
function validPlace(team, cid, x, y) {
  if (x < 0 || x > COLS || y < 0 || y > ROWS) return false;
  if (CD[cid].spell) return true;
  if (y > 15 && y < 17) return false;
  if (onTower(x, y)) return false;
  const lane = x < 9 ? 0 : 1, bld = isBuildingCard(cid);
  if (team === 0) return y >= 17 || (!bld && y >= 10 && laneDead(1, lane));
  return y <= 15 || (!bld && y <= 22 && laneDead(0, lane));
}
// 把触点修正到最近合法位置（玩家友好）
function adjustPlace(team, cid, wx, wy) {
  if (wx < -0.5 || wx > COLS + 0.5 || wy < -0.5 || wy > ROWS + 0.5) return null;
  if (CD[cid].spell) return { x: clamp(wx, 0.5, COLS - 0.5), y: clamp(wy, 0.5, ROWS - 0.5) };
  let x = Math.floor(clamp(wx, 0, COLS - 0.01)) + 0.5, y = Math.floor(clamp(wy, 0, ROWS - 0.01)) + 0.5;
  if (validPlace(team, cid, x, y)) return { x, y };
  const bld = isBuildingCard(cid);
  if (team === 0) {
    const pocket = !bld && laneDead(1, x < 9 ? 0 : 1);
    if (pocket && y < 10) y = 10.5; else if (!pocket || (y > 14.5 && y < 17)) y = Math.max(y, 17.5);
  } else {
    const pocket = !bld && laneDead(0, x < 9 ? 0 : 1);
    if (pocket && y > 22) y = 21.5; else if (!pocket || (y > 15 && y < 17.5)) y = Math.min(y, 14.5);
  }
  if (validPlace(team, cid, x, y)) return { x, y };
  return null;
}

function spawnUnits(type, team, x, y, n, quick) {
  const f = formation(n);
  f.forEach(([ox, oy], i) => {
    const u = makeUnit(type, team, clamp(x + ox, 0.4, COLS - 0.4), clamp(y + (team ? -oy : oy), 0.4, ROWS - 0.4), quick ? 0 : i * (n > 3 ? 0.04 : 0.08));
    if (!u.d.air && u.y > 15 && u.y < 17) u.y = u.y < 16 ? 14.9 : 17.1;
    if (quick) { u.deploy = u.deployMax = 0.4; }
    G.units.push(u);
  });
}
function deploy(team, idx, x, y) {
  const cid = G.hand[team][idx], cd = CD[cid];
  if (G.el[team] < cd.cost) return false;
  G.el[team] -= cd.cost;
  G.queue[team].push(cid); G.hand[team][idx] = G.queue[team].shift();
  if (cd.spell) castSpell(team, cd, x, y);
  else spawnUnits(cd.unit, team, x, y, cd.n, false);
  G.texts.push({ x, y, life: 1.2, max: 1.2, kind: 'elixir', v: cd.cost, team });
  return true;
}

function castSpell(team, cd, x, y) {
  const k = king(team);
  const x0 = k.x, y0 = k.y, z0 = k.h + 0.8;
  if (cd.spell === 'fireball') {
    const d = Math.hypot(x - x0, y - y0);
    G.projs.push(mkProj('fireball', team, x0, y0, z0, x, y, 0, null, Math.max(0.5, d / 11), 2.5, { dmg: cd.dmg, splash: cd.radius, tower: cd.tower }));
    sfx('orb');
  } else if (cd.spell === 'arrows') {
    for (let w = 0; w < 3; w++) {
      const d = Math.hypot(x - x0, y - y0);
      const dur = Math.max(0.5, d / 13);
      G.projs.push(mkProj('arrowsWave', team, x0, y0, z0, x, y, 0, null, dur, 3, { dmg: cd.dmg / 3, splash: cd.radius, tower: cd.tower, delay: w * 0.28 }));
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * cd.radius;
        G.projs.push(mkProj('varrow', team, x0 + rnd(-1, 1), y0 + rnd(-0.6, 0.6), z0, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0, null, dur, 3, { delay: w * 0.28 + rnd(0, 0.12) }));
      }
    }
  } else if (cd.spell === 'zap') {
    areaDamage(team, x, y, cd.radius, cd.dmg, cd.tower);
    applyStun(team, x, y, cd.radius, cd.stun, false);
    for (let i = 0; i < 5; i++) { const a = rnd(0, TAU), rr = rnd(0, cd.radius * 0.8); addP({ type: 'bolt', x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.8, life: 0.3, size: 0.06, seed: Math.floor(Math.random() * 9999) }); }
    addP({ type: 'ring', x, y, life: 0.35, size: 0.4, grow: cd.radius * 2.5, color: '#bfe8ff' });
    for (let i = 0; i < 14; i++) addP({ type: 'spark', x: x + rnd(-cd.radius, cd.radius) * 0.7, y: y + rnd(-cd.radius, cd.radius) * 0.6, z: rnd(0, 1), vx: rnd(-2, 2), vy: rnd(-1, 1), vz: rnd(1, 3), g: 6, life: 0.35, size: 0.08 });
    G.shake = Math.max(G.shake, 0.3); sfx('zap');
  } else if (cd.spell === 'rage') {
    G.zones.push({ team, x, y, r: cd.radius, life: cd.dur, boost: cd.boost });
    G.decals.push({ x, y, r: cd.radius, life: cd.dur, max: cd.dur, rage: true });
    addP({ type: 'ring', x, y, life: 0.5, size: 0.4, grow: cd.radius * 2.2, color: '#e07bff' });
    for (let i = 0; i < 18; i++) { const a = rnd(0, TAU), rr = Math.sqrt(Math.random()) * cd.radius; addP({ type: 'puff', x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr, z: 0.1, vz: rnd(0.5, 1.5), life: rnd(0.5, 0.9), size: rnd(0.12, 0.22), grow: 0.8, color: '#d66bff' }); }
    sfx('rage');
  } else if (cd.spell === 'freeze') {
    areaDamage(team, x, y, cd.radius, cd.dmg, cd.tower);
    applyStun(team, x, y, cd.radius, cd.stun, true);
    G.decals.push({ x, y, r: cd.radius, life: cd.stun, max: cd.stun, ice: true });
    addP({ type: 'ring', x, y, life: 0.5, size: 0.4, grow: cd.radius * 2.2, color: '#e6fbff' });
    for (let i = 0; i < 26; i++) { const a = rnd(0, TAU), rr = Math.sqrt(Math.random()) * cd.radius; addP({ type: 'snow', x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr, z: rnd(0.5, 3), vz: -rnd(0.5, 1.5), life: rnd(0.8, 1.6), size: rnd(0.06, 0.12) }); }
    sfx('freeze');
  }
}
function applyStun(team, x, y, r, time, frozen) {
  for (const e of G.units) {
    if (e.team === team || !e.alive || e.delay > 0) continue;
    if (Math.hypot(e.x - x, e.y - y) <= r + e.r) { e.stun = Math.max(e.stun, time); if (frozen) e.frozen = Math.max(e.frozen, time); e.charging = false; e.chargeDist = 0; e.ramp = 0; }
  }
  for (const t of G.towers) {
    if (t.team === team || !t.alive) continue;
    if (Math.hypot(t.x - x, t.y - y) <= r + t.r) { t.stun = Math.max(t.stun, time); if (frozen) t.frozen = Math.max(t.frozen, time); }
  }
}

function mkProj(kind, team, x0, y0, z0, tx, ty, tz, target, dur, arc, o = {}) {
  return Object.assign({ id: G.uid++, kind, team, x0, y0, z0, x: x0, y: y0, z: z0, px: x0, py: y0, pz: z0, tx, ty, tz, target, t: -(o.delay || 0), dur, arc, dmg: 0, splash: 0, tower: 1, done: false, air: true }, o);
}

// --- 目标选择 ---
function canTarget(tgt, e) {
  if (tgt === 'none') return false;
  if (isBld(e)) return true;
  if (tgt === 'buildings') return false;
  if (e.d.air && tgt !== 'all') return false;
  return true;
}
function edgeDist(a, b) { return dist(a, b) - a.r - b.r; }
function findTarget(u) {
  let best = null, bd = 1e9; const tgt = u.d.tgt;
  for (const e of G.units) {
    if (e.team === u.team || !e.alive || e.delay > 0) continue;
    if (!canTarget(tgt, e)) continue;
    const d = edgeDist(u, e); if ((tgt === 'buildings' || d < u.d.sight) && d < bd) { bd = d; best = e; }
  }
  for (const t of G.towers) {
    if (t.team === u.team || !t.alive) continue;
    const d = edgeDist(u, t); if ((tgt === 'buildings' || d < u.d.sight) && d < bd) { bd = d; best = t; }
  }
  return best;
}
function nearestTower(u) {
  let best = null, bd = 1e9;
  for (const t of G.towers) { if (t.team === u.team || !t.alive) continue; const d = dist(u, t); if (d < bd) { bd = d; best = t; } }
  return best;
}
function onBridge(x) { return Math.abs(x - 3.5) < 1.05 || Math.abs(x - 14.5) < 1.05; }
function nearBridge(x) { return Math.abs(x - 3.5) < Math.abs(x - 14.5) ? 3.5 : 14.5; }
function nav(u, gx, gy) {
  if (u.d.air || u.d.jump) return [gx, gy];
  const inRiver = u.y > 15 && u.y < 17;
  const uTop = u.y < 16, gTop = gy < 16;
  if (!inRiver && uTop === gTop) return [gx, gy];
  const bx = nearBridge(inRiver ? u.x : lerp(u.x, gx, 0.25));
  if (inRiver) return [bx + clamp(u.x - bx, -0.5, 0.5), gTop ? 14.4 : 17.6];
  const entry = uTop ? 14.75 : 17.25;
  if (Math.abs(u.x - bx) > 0.7) return [bx, entry];
  return [bx + clamp(u.x - bx, -0.5, 0.5), gTop ? 14.4 : 17.6];
}

// --- 伤害 ---
function damage(e, amt) {
  if (!e.alive) return;
  e.hp -= amt; e.flash = 0.12;
  if (e.kind === 'tower' && e.ttype === 'king' && !e.active) { e.active = true; }
  if (e.hp <= 0) { e.hp = 0; kill(e); }
}
function areaDamage(team, x, y, r, dmg, towerMul = 1, hitAir = true, hitGround = true) {
  const hit = [];
  for (const e of G.units) {
    if (e.team === team || !e.alive || e.delay > 0) continue;
    if (e.d.air ? !hitAir : !hitGround) continue;
    if (Math.hypot(e.x - x, e.y - y) <= r + e.r) { damage(e, dmg); hit.push(e); }
  }
  if (hitGround) for (const t of G.towers) {
    if (t.team === team || !t.alive) continue;
    if (Math.hypot(t.x - x, t.y - y) <= r + t.r) damage(t, dmg * towerMul);
  }
  return hit;
}
function kill(e) {
  e.alive = false;
  if (e.kind === 'unit') {
    const n = Math.round(4 + e.r * 10);
    for (let i = 0; i < n; i++) addP({ type: 'puff', x: e.x + rnd(-e.r, e.r), y: e.y + rnd(-e.r, e.r) * 0.5, z: (e.d.air ? 1.4 : 0.3) + rnd(0, 0.5), vx: rnd(-0.8, 0.8), vy: rnd(-0.4, 0.4), vz: rnd(0.3, 1.2), life: rnd(0.4, 0.8), size: rnd(0.15, 0.3) * (0.6 + e.r), grow: 1.2, color: e.d.building ? '#c8c0b0' : '#ffffff' });
    if (e.type === 'skeleton') for (let i = 0; i < 4; i++) addP({ type: 'bone', x: e.x, y: e.y, z: 0.4, vx: rnd(-1.5, 1.5), vy: rnd(-1, 1), vz: rnd(2, 4), g: 12, life: 0.7, size: 0.12, vr: rnd(-10, 10) });
    if (e.d.air || e.d.building) for (let i = 0; i < (e.d.building ? 8 : 4); i++) addP({ type: 'debris', color: '#9ea4ae', tc: e.d.building ? null : e.team, x: e.x, y: e.y, z: e.d.air ? 1.4 : 0.5, vx: rnd(-1.5, 1.5), vy: rnd(-1, 1), vz: rnd(0, 3), g: 10, life: 0.9, size: 0.12, vr: rnd(-10, 10) });
    if (e.d.deathDmg) G.projs.push(mkProj('dropbomb', e.team, e.x, e.y, 1.4, e.x, e.y, 0, null, 0.45, 0, { dmg: e.d.deathDmg, splash: e.d.deathR, air: false }));
    if (e.d.deathSpawn) spawnUnits('skeleton', e.team, e.x, e.y + (e.team ? 0.6 : -0.6), e.d.deathSpawn, true);
    sfx('pop');
  } else towerDestroyed(e);
}
function towerDestroyed(t) {
  const other = 1 - t.team;
  t.rubble = [];
  for (let i = 0; i < 9; i++) t.rubble.push({ dx: rnd(-t.w * 0.38, t.w * 0.38), dy: rnd(-t.w * 0.3, t.w * 0.3), r: rnd(0.25, 0.5), c: Math.random() < 0.5 ? '#9ea4ae' : '#7f8692', a: rnd(0, TAU) });
  for (let i = 0; i < 26; i++) addP({ type: 'debris', color: '#9ea4ae', tc: Math.random() < 0.3 ? t.team : null, x: t.x + rnd(-1, 1), y: t.y + rnd(-1, 1), z: rnd(0.5, t.h), vx: rnd(-4, 4), vy: rnd(-3, 3), vz: rnd(3, 8), g: 16, life: rnd(0.9, 1.5), size: rnd(0.12, 0.28), vr: rnd(-8, 8) });
  for (let i = 0; i < 22; i++) addP({ type: 'puff', x: t.x + rnd(-1.5, 1.5), y: t.y + rnd(-1.2, 1.2), z: rnd(0, 1.5), vx: rnd(-1, 1), vy: rnd(-0.5, 0.5), vz: rnd(0.5, 2), life: rnd(0.8, 1.6), size: rnd(0.4, 0.8), grow: 1.5, color: '#d8d2c8' });
  for (let i = 0; i < 14; i++) addP({ type: 'fire', x: t.x + rnd(-1, 1), y: t.y + rnd(-0.8, 0.8), z: rnd(0.3, 1.5), vx: rnd(-1.5, 1.5), vy: rnd(-1, 1), vz: rnd(1, 3), life: rnd(0.4, 0.8), size: rnd(0.3, 0.6), grow: 0.8 });
  G.decals.push({ x: t.x, y: t.y, r: t.r * 1.1, life: 99999, max: 99999 });
  G.shake = Math.max(G.shake, 0.9);
  sfx('tower');
  G.texts.push({ x: t.x, y: t.y, life: 1.8, max: 1.8, kind: 'crown', team: other });
  if (t.ttype === 'king') {
    G.crowns[other] = 3;
    for (const o of G.towers) if (o.team === t.team && o.alive) { o.alive = false; o.hp = 0; o.rubble = t.rubble.map(r => ({ ...r })); }
    endGame(other);
  } else {
    G.crowns[other]++;
    const k = king(t.team); if (k.alive) k.active = true;
    if (G.ot) endGame(other);
  }
}
function endGame(w) {
  if (G.state === 'ending' || G.state === 'end') return;
  G.winner = w; G.state = 'ending'; G.endDelay = 1.6;
}

// =====================================================================
//  更新
// =====================================================================
function addP(o) { o.max = o.life; G.parts.push(Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, size: 0.2, grow: 0, color: '#fff', rot: 0, vr: 0 }, o)); }
function banner(text, sub, color = '#ffd23f', dur = 2) { G.banners.push({ text, sub, color, t: 0, dur }); }

function update(dt) {
  if (!G) return;
  G.shake = Math.max(0, G.shake - dt * 2.5);
  G.barShake = Math.max(0, G.barShake - dt * 3);
  for (const b of G.banners) b.t += dt;
  G.banners = G.banners.filter(b => b.t < b.dur);
  if (G.state === 'menu' || G.state === 'deck' || G.state === 'match') { updateFx(dt); idleTowers(dt); return; }
  if (G.state === 'countdown') {
    const prev = Math.ceil(G.cd); G.cd -= dt; const now = Math.ceil(G.cd);
    if (now !== prev && now > 0 && now <= 3) sfx('tick');
    if (G.cd <= 0) { G.state = 'play'; sfx('go'); }
    updateFx(dt); idleTowers(dt); return;
  }
  if (G.state === 'end') { G.endT += dt; updateFx(dt); return; }
  let sim = dt;
  if (G.state === 'ending') { sim = dt * 0.35; G.endDelay -= dt; if (G.endDelay <= 0) { G.state = 'end'; G.endT = 0; sfx(G.winner === 0 ? 'win' : 'lose'); } }
  if (G.state === 'play') {
    G.time -= dt;
    if (!G.dbl && !G.ot && G.time <= 60) { G.dbl = true; banner('双倍圣水!', '圣水生成速度 ×2', '#ff7af0'); sfx('x2'); }
    if (G.time <= 10 && G.time > 0) { const s = Math.ceil(G.time); if (s !== G.lastTick) { G.lastTick = s; sfx('tick'); } }
    if (G.time <= 0) {
      if (!G.ot) {
        if (G.crowns[0] !== G.crowns[1]) endGame(G.crowns[0] > G.crowns[1] ? 0 : 1);
        else { G.ot = true; G.time = 60; G.dbl = true; banner('加时赛!', '率先摧毁防御塔者获胜', '#ff9b3d'); sfx('x2'); }
      } else {
        G.time = 0;
        const low = tm => Math.min(...G.towers.filter(t => t.team === tm && t.alive).map(t => t.hp));
        const a = low(0), b = low(1);
        if (a === b) { G.winner = -1; G.state = 'ending'; G.endDelay = 1.2; } else endGame(a > b ? 0 : 1);
      }
    }
    const rate = (G.dbl ? 2 : 1) / 2.8;
    G.el[0] = Math.min(10, G.el[0] + dt * rate);
    G.el[1] = Math.min(10, G.el[1] + dt * rate * DIFF[G.diff].elMul);
    if (!G.pvp) aiUpdate(dt);
  }
  G.elapsed += sim;
  for (const z of G.zones) {
    z.life -= sim;
    for (const u of G.units) if (u.team === z.team && u.alive && Math.hypot(u.x - z.x, u.y - z.y) <= z.r + u.r) u.rage = 0.35;
  }
  G.zones = G.zones.filter(z => z.life > 0);
  const cur = G.units.slice();
  for (const u of cur) if (u.alive) updUnit(u, sim);
  separate(sim);
  for (const u of G.units) if (u.alive && u.delay <= 0) constrain(u);
  for (const t of G.towers) updTower(t, sim);
  for (const p of G.projs.slice()) updProj(p, sim);
  G.projs = G.projs.filter(p => !p.done);
  G.units = G.units.filter(u => u.alive);
  updateFx(sim);
}
function idleTowers(dt) {
  for (const t of G.towers) { t.zT += dt; if (t.ttype === 'king' && !t.active && t.zT > 1.4) { t.zT = 0; addP({ type: 'z', x: t.x + 0.7, y: t.y - t.w / 2 + 0.6, z: t.h + 1.1, vx: 0.25, vz: 0.5, life: 1.6, size: 0.35 }); } }
}
function updateFx(dt) {
  for (const p of G.parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt; p.rot += p.vr * dt;
    if (p.z < 0 && p.g > 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; }
    if (p.type === 'snow' && p.z < 0) p.z = 0;
  }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const d of G.decals) d.life -= dt;
  G.decals = G.decals.filter(d => d.life > 0);
  for (const t of G.texts) t.life -= dt;
  G.texts = G.texts.filter(t => t.life > 0);
  for (const t of G.towers) {
    t.flash = Math.max(0, t.flash - dt); t.atk = Math.max(0, t.atk - dt * 2.5); t.recoil = Math.max(0, t.recoil - dt * 4);
    t.frozen = Math.max(0, t.frozen - dt);
    if (t.alive && t.hp < t.maxHp * 0.3) { t.smokeT -= dt; if (t.smokeT <= 0) { t.smokeT = 0.25; addP({ type: 'puff', x: t.x + rnd(-1, 1), y: t.y + rnd(-0.5, 0.5), z: t.h + 0.3, vx: rnd(-0.2, 0.2), vz: 1.2, life: 1.2, size: 0.3, grow: 1.5, color: '#55505a' }); } }
  }
}

function landFx(u) {
  u.landed = true;
  if (!u.d.air) {
    addP({ type: 'ring', x: u.x, y: u.y, life: 0.4, size: u.r * 1.2, grow: 2.5, color: '#ffffff' });
    for (let i = 0; i < 5; i++) addP({ type: 'puff', x: u.x + rnd(-0.4, 0.4), y: u.y + rnd(-0.2, 0.2), z: 0.05, vx: rnd(-1.2, 1.2), vy: rnd(-0.5, 0.5), vz: rnd(0.2, 0.6), life: 0.5, size: 0.18 + u.r * 0.3, grow: 1, color: '#f3ead2' });
  }
  sfx('deploy');
}
function updUnit(u, dt) {
  if (u.delay > 0) { u.delay -= dt; return; }
  u.flash = Math.max(0, u.flash - dt); u.frozen = Math.max(0, u.frozen - dt);
  u.py = u.y;
  if (!u.landed) { u.spawnT += dt; if (u.spawnT >= 0.22) landFx(u); }
  if (u.d.building) { u.hp -= u.maxHp / u.d.life * dt; if (u.hp <= 0) { u.hp = 0; kill(u); return; } }
  if (u.stun > 0) { u.stun -= dt; u.moving = false; return; }
  if (u.rage > 0) { u.rage -= dt; dt *= 1.35; if (Math.random() < 0.12) addP({ type: 'puff', x: u.x + rnd(-0.3, 0.3), y: u.y, z: rnd(0.3, 1), vz: 0.8, life: 0.4, size: 0.08, grow: 0.5, color: '#e07bff' }); }
  u.atk = Math.max(0, u.atk - dt * 2.8);
  u.flap += dt * (u.d.air ? 9 : 0);
  if (u.deploy > 0) { u.deploy -= dt; return; }
  if (u.d.building) { updBuilding(u, dt); return; }
  if (u.d.spawnEvery) {
    u.spawnCd -= dt;
    if (u.spawnCd <= 0) {
      u.spawnCd = u.d.spawnEvery;
      spawnUnits('skeleton', u.team, u.x, u.y + (u.team ? 0.7 : -0.7), u.d.spawnN, true);
      addP({ type: 'ring', x: u.x, y: u.y, life: 0.4, size: 0.3, grow: 2, color: '#b06bff' });
    }
  }
  u.retarget -= dt;
  let tg = u.target;
  if (tg && (!tg.alive || !canTarget(u.d.tgt, tg))) tg = u.target = null;
  const reach = u.d.range + (u.attacking ? 0.35 : 0);
  let inRange = tg && edgeDist(u, tg) <= reach;
  if (!inRange && u.retarget <= 0) { u.retarget = 0.25; tg = u.target = findTarget(u); inRange = tg && edgeDist(u, tg) <= u.d.range; }
  if (inRange) {
    u.attacking = true; u.moving = false;
    if (Math.abs(tg.x - u.x) > 0.1) u.face = tg.x > u.x ? 1 : -1;
    u.cd -= dt * (u.charging ? 3 : 1);
    if (u.cd <= 0) { u.cd = u.d.hs; attack(u, tg); }
    return;
  }
  u.attacking = false;
  u.cd = Math.max(u.cd - dt, u.d.hs * 0.35);
  const goal = tg || nearestTower(u);
  if (!goal) { u.moving = false; return; }
  const [gx, gy] = nav(u, goal.x, goal.y);
  const dx = gx - u.x, dy = gy - u.y, dd = Math.hypot(dx, dy);
  if (dd > 0.02) {
    const spd = u.d.spd * (u.charging ? 2 : 1);
    const m = Math.min(spd * dt, dd);
    u.x += dx / dd * m; u.y += dy / dd * m;
    if (Math.abs(dx) > 0.08) u.face = dx > 0 ? 1 : -1;
    u.walk += dt * 10 * (u.charging ? 1.8 : 1); u.moving = true;
    if (u.d.charge) {
      u.chargeDist += m;
      if (!u.charging && u.chargeDist > 2.5) { u.charging = true; sfx('charge'); }
      if (u.charging && Math.random() < 0.5) addP({ type: 'puff', x: u.x - u.face * 0.4, y: u.y + rnd(-0.2, 0.2), z: 0.05, vx: -u.face * 0.8, vz: 0.3, life: 0.4, size: 0.15, grow: 1, color: '#efe3c4' });
    }
  } else u.moving = false;
}
function updBuilding(u, dt) {
  const d = u.d;
  if (d.spawn) {
    u.spawnCd -= dt;
    if (u.spawnCd <= 0) { u.spawnCd = d.hs; u.atk = 1; spawnUnits(d.spawn, u.team, u.x, u.y + (u.team ? 0.9 : -0.9), 1, true); }
    return;
  }
  let tg = u.target;
  if (tg && (!tg.alive || edgeDist(u, tg) > d.range + 0.3 || tg.delay > 0 || (d.minRange && edgeDist(u, tg) < d.minRange - 0.3))) tg = null;
  if (!tg) {
    let bd = 1e9;
    for (const e of G.units) {
      if (e.team === u.team || !e.alive || e.delay > 0 || e.d.building || !canTarget(d.tgt, e)) continue;
      const dd = edgeDist(u, e); if (dd <= d.range && dd < bd && !(d.minRange && dd < d.minRange)) { bd = dd; tg = e; }
    }
  }
  if (tg !== u.target) u.ramp = 0;
  u.target = tg;
  if (!tg) { u.attacking = false; u.cd = Math.max(u.cd, 0.2); return; }
  u.attacking = true;
  u.ang = Math.atan2((tg.y - u.y) * SQ, tg.x - u.x);
  u.cd -= dt;
  if (d.ramp) u.ramp += dt;
  if (u.cd <= 0) {
    u.cd = d.hs;
    if (d.ramp) {
      const dmg = Math.min(380, d.dmg * Math.pow(1 + u.ramp * 1.1, 2));
      damage(tg, dmg);
      if (Math.random() < 0.6) addP({ type: 'fire', x: tg.x, y: tg.y, z: tg.d.air ? 1.6 : 0.5, vz: 0.6, life: 0.3, size: 0.2 + Math.min(0.3, u.ramp * 0.08), grow: 0.5 });
      sfx('beam');
    } else attack(u, tg);
  }
}
function attack(u, tg) {
  u.atk = 1;
  const d = u.d;
  if (!d.proj) {
    let dmg = d.dmg;
    if (u.charging) { dmg *= 2; u.charging = false; G.shake = Math.max(G.shake, 0.25); }
    u.chargeDist = 0;
    if (d.selfSplash) areaDamage(u.team, u.x, u.y, d.selfSplash + u.r, dmg, 1, false, true);
    else if (d.splash) areaDamage(u.team, tg.x, tg.y, d.splash, dmg);
    else if (u.type === 'balloon') { G.projs.push(mkProj('dropbomb', u.team, u.x, u.y, 1.4, tg.x, tg.y, tg.kind === 'tower' ? tg.h * 0.6 : 0.3, tg, 0.4, 0, { dmg, splash: 0 })); sfx('orb'); return; }
    else damage(tg, dmg);
    const hx = lerp(u.x, tg.x, u.r / (u.r + tg.r)), hy = lerp(u.y, tg.y, u.r / (u.r + tg.r));
    for (let i = 0; i < (dmg > 300 ? 8 : 4); i++) addP({ type: 'spark', x: hx, y: hy, z: u.d.air ? 1.5 : 0.5, vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(1, 3), g: 8, life: 0.25, size: 0.08 });
    if (d.selfSplash) addP({ type: 'ring', x: u.x, y: u.y, life: 0.3, size: 0.4, grow: 2.2, color: '#ffffff' });
    sfx(dmg > 200 ? 'heavy' : 'hit');
    if (dmg > 300) G.shake = Math.max(G.shake, 0.2);
  } else {
    const z0 = d.air ? 1.9 : d.building ? 0.8 : 0.65;
    const tz = tg.kind === 'tower' ? tg.h * 0.6 : (tg.d.air ? 1.8 : 0.45);
    const spd = { arrow: 13, orb: 9, flame: 8, bullet: 22, bomb: 7, cannon: 11, mortar: 5.5, hex: 9 }[d.proj] || 10;
    const dd = Math.max(0.2, dist(u, tg));
    const arc = d.proj === 'arrow' ? dd * 0.12 : d.proj === 'bomb' ? 0.8 + dd * 0.25 : d.proj === 'mortar' ? 3 + dd * 0.25 : d.proj === 'cannon' ? dd * 0.06 : 0.15;
    const ox = d.building ? Math.cos(u.ang) * 0.6 : u.face * 0.25, oy = d.building ? Math.sin(u.ang) * 0.6 / SQ : 0;
    G.projs.push(mkProj(d.proj, u.team, u.x + ox, u.y + oy, z0, tg.x, tg.y, tz, (d.proj === 'bomb' || d.proj === 'mortar') ? null : tg, dd / spd, arc, { dmg: d.dmg, splash: d.splash || 0, air: d.tgt === 'all' }));
    sfx({ arrow: 'arrow', bullet: 'shot', bomb: 'pop', cannon: 'cannon', mortar: 'cannon' }[d.proj] || 'orb');
  }
}
function separate(dt) {
  const us = G.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i]; if (!a.alive || a.delay > 0) continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j]; if (!b.alive || b.delay > 0 || !!a.d.air !== !!b.d.air) continue;
      if (a.d.building && b.d.building) continue;
      let dx = b.x - a.x, dy = b.y - a.y; const min = a.r + b.r; const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      let d = Math.sqrt(d2); if (d < 0.001) { dx = rnd(-1, 1); dy = rnd(-1, 1); d = Math.hypot(dx, dy); }
      const ov = (min - d) * 0.5, nx = dx / d, ny = dy / d;
      const wa = a.d.building ? 0 : b.d.building ? 2 : 2 * b.d.mass / (a.d.mass + b.d.mass), wb = 2 - wa;
      a.x -= nx * ov * wa * 0.5; a.y -= ny * ov * wa * 0.5; b.x += nx * ov * wb * 0.5; b.y += ny * ov * wb * 0.5;
    }
  }
}
function constrain(u) {
  if (u.d.building) return;
  u.x = clamp(u.x, 0.3, COLS - 0.3); u.y = clamp(u.y, 0.3, ROWS - 0.3);
  if (u.d.air) return;
  if (!u.d.jump && u.y > 15 && u.y < 17 && !onBridge(u.x)) {
    if (u.py <= 15) u.y = 15; else if (u.py >= 17) u.y = 17;
    else { const bx = nearBridge(u.x); u.x = clamp(u.x, bx - 1.0, bx + 1.0); }
  }
  for (const t of G.towers) {
    if (!t.alive) continue;
    const dx = u.x - t.x, dy = u.y - t.y, d = Math.hypot(dx, dy), min = t.r + u.r * 0.6;
    if (d < min) { if (d < 0.001) { u.y += t.team ? 0.1 : -0.1; continue; } u.x = t.x + dx / d * min; u.y = t.y + dy / d * min; }
  }
}
function updTower(t, dt) {
  if (!t.alive) return;
  if (t.ttype === 'king' && !t.active) { t.zT += dt; if (t.zT > 1.4) { t.zT = 0; addP({ type: 'z', x: t.x + 0.7, y: t.y - t.w / 2 + 0.6, z: t.h + 1.1, vx: 0.25, vz: 0.5, life: 1.6, size: 0.35 }); } return; }
  if (t.stun > 0) { t.stun -= dt; return; }
  t.cd -= dt;
  let tg = t.target;
  if (tg && (!tg.alive || dist(t, tg) - tg.r > t.range)) tg = null;
  if (!tg) {
    let bd = 1e9;
    for (const u of G.units) {
      if (u.team === t.team || !u.alive || u.delay > 0 || u.d.building) continue;
      const d = dist(t, u) - u.r; if (d <= t.range && d < bd) { bd = d; tg = u; }
    }
  }
  t.target = tg;
  if (!tg) { t.cd = Math.max(t.cd, 0.15); return; }
  t.aim = Math.atan2((tg.y - t.y) * SQ, tg.x - t.x);
  t.face = tg.x >= t.x ? 1 : -1;
  if (t.cd <= 0) {
    t.cd = t.hs; t.atk = 1; t.recoil = 1;
    const tz = tg.d.air ? 1.8 : 0.45, z0 = t.h + (t.ttype === 'king' ? 0.5 : 0.75);
    const d = dist(t, tg);
    if (t.ttype === 'king') { G.projs.push(mkProj('cannon', t.team, t.x + Math.cos(t.aim) * 0.7, t.y + Math.sin(t.aim) * 0.7 / SQ, z0, tg.x, tg.y, tz, tg, d / 10, d * 0.08, { dmg: t.dmg })); sfx('cannon'); }
    else { G.projs.push(mkProj('arrow', t.team, t.x + t.face * 0.3, t.y - 0.2, z0, tg.x, tg.y, tz, tg, d / 14, d * 0.1, { dmg: t.dmg })); sfx('arrow'); }
  }
}
function explodeFx(x, y, z, r, big) {
  for (let i = 0; i < (big ? 16 : 9); i++) addP({ type: 'fire', x: x + rnd(-0.4, 0.4) * r, y: y + rnd(-0.3, 0.3) * r, z, vx: rnd(-1.8, 1.8), vy: rnd(-1.2, 1.2), vz: rnd(0, 1.8), life: rnd(0.25, 0.5), size: rnd(0.22, 0.4) * (big ? 1.3 : 1), grow: 0.5 });
  for (let i = 0; i < (big ? 8 : 4); i++) addP({ type: 'puff', x: x + rnd(-0.5, 0.5) * r, y: y + rnd(-0.4, 0.4) * r, z: z + 0.2, vx: rnd(-0.5, 0.5), vz: rnd(0.6, 1.2), life: rnd(0.6, 1), size: rnd(0.25, 0.45), grow: 1.3, color: '#4a4248' });
  addP({ type: 'ring', x, y, z: z > 1 ? z : 0, life: 0.35, size: 0.3, grow: r * 2.6, color: '#ffcf70' });
}
function updProj(p, dt) {
  p.t += dt; if (p.t < 0) return;
  if (p.target && p.target.alive) { p.tx = p.target.x; p.ty = p.target.y; }
  const k = Math.min(1, p.t / p.dur);
  p.px = p.x; p.py = p.y; p.pz = p.z;
  p.x = lerp(p.x0, p.tx, k); p.y = lerp(p.y0, p.ty, k); p.z = lerp(p.z0, p.tz, k) + p.arc * Math.sin(Math.PI * k);
  if (p.kind === 'fireball' && Math.random() < 0.9) addP({ type: 'fire', x: p.x + rnd(-0.15, 0.15), y: p.y, z: p.z + rnd(-0.15, 0.15), vz: 0.3, life: 0.35, size: rnd(0.25, 0.4), grow: -0.6 });
  if (p.kind === 'orb' && Math.random() < 0.7) addP({ type: 'fire', x: p.x, y: p.y, z: p.z, life: 0.25, size: 0.16, grow: -0.8 });
  if (p.kind === 'flame') addP({ type: 'fire', x: p.x + rnd(-0.1, 0.1), y: p.y, z: p.z, life: 0.25, size: 0.22, grow: -0.5 });
  if (p.kind === 'hex' && Math.random() < 0.7) addP({ type: 'puff', x: p.x, y: p.y, z: p.z, life: 0.25, size: 0.12, grow: -0.5, color: '#c47bff' });
  if ((p.kind === 'bomb' || p.kind === 'mortar') && Math.random() < 0.5) addP({ type: 'spark', x: p.x, y: p.y, z: p.z + 0.15, life: 0.15, size: 0.06 });
  if (k < 1) return;
  p.done = true;
  switch (p.kind) {
    case 'arrow': case 'cannon': case 'bullet':
      if (p.target && p.target.alive) damage(p.target, p.dmg);
      for (let i = 0; i < 3; i++) addP({ type: 'spark', x: p.tx, y: p.ty, z: p.tz, vx: rnd(-2, 2), vy: rnd(-1, 1), vz: rnd(0.5, 2), g: 6, life: 0.2, size: 0.07 });
      if (p.kind === 'cannon') addP({ type: 'puff', x: p.tx, y: p.ty, z: p.tz, life: 0.35, size: 0.25, grow: 1, color: '#e8e0d0' });
      break;
    case 'orb': case 'flame':
      areaDamage(p.team, p.tx, p.ty, p.splash, p.dmg);
      for (let i = 0; i < 8; i++) addP({ type: 'fire', x: p.tx + rnd(-0.4, 0.4), y: p.ty + rnd(-0.3, 0.3), z: p.tz, vx: rnd(-1.5, 1.5), vy: rnd(-1, 1), vz: rnd(0, 1.5), life: rnd(0.25, 0.45), size: rnd(0.2, 0.35), grow: 0.5 });
      addP({ type: 'ring', x: p.tx, y: p.ty, z: p.tz > 1 ? p.tz : 0, life: 0.3, size: 0.3, grow: p.splash * 3, color: '#ffb347' });
      break;
    case 'bomb': case 'mortar':
      areaDamage(p.team, p.tx, p.ty, p.splash, p.dmg, 1, false, true);
      explodeFx(p.tx, p.ty, 0.1, p.splash, p.kind === 'mortar'); sfx(p.kind === 'mortar' ? 'boom' : 'boomS');
      if (p.kind === 'mortar') G.decals.push({ x: p.tx, y: p.ty, r: p.splash * 0.6, life: 2.5, max: 2.5 });
      break;
    case 'hex':
      areaDamage(p.team, p.tx, p.ty, p.splash, p.dmg);
      for (let i = 0; i < 6; i++) addP({ type: 'puff', x: p.tx + rnd(-0.4, 0.4), y: p.ty + rnd(-0.3, 0.3), z: p.tz, vx: rnd(-1, 1), vz: rnd(0.3, 1.2), life: 0.4, size: 0.18, grow: 0.8, color: '#b06bff' });
      addP({ type: 'ring', x: p.tx, y: p.ty, z: p.tz > 1 ? p.tz : 0, life: 0.3, size: 0.3, grow: p.splash * 3, color: '#d08bff' });
      break;
    case 'dropbomb':
      if (p.splash > 0) areaDamage(p.team, p.tx, p.ty, p.splash, p.dmg, 1, false, true);
      else if (p.target && p.target.alive) damage(p.target, p.dmg);
      explodeFx(p.tx, p.ty, p.tz, p.splash || 1, true); G.shake = Math.max(G.shake, 0.35); sfx('boom');
      break;
    case 'fireball': {
      const hit = areaDamage(p.team, p.tx, p.ty, p.splash, p.dmg, p.tower);
      for (const e of hit) if (e.alive && e.d.mass <= 6 && !e.d.air) { const dx = e.x - p.tx, dy = e.y - p.ty, d = Math.hypot(dx, dy) || 1; e.x += dx / d * 0.7; e.y += dy / d * 0.7; }
      for (let i = 0; i < 28; i++) { const a = rnd(0, TAU), s = rnd(1, 5); addP({ type: 'fire', x: p.tx, y: p.ty, z: 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rnd(0.5, 3), life: rnd(0.35, 0.7), size: rnd(0.35, 0.65), grow: 0.6 }); }
      for (let i = 0; i < 12; i++) addP({ type: 'puff', x: p.tx + rnd(-1.5, 1.5), y: p.ty + rnd(-1, 1), z: rnd(0.2, 1), vx: rnd(-0.6, 0.6), vz: rnd(0.8, 1.6), life: rnd(0.8, 1.3), size: rnd(0.35, 0.6), grow: 1.6, color: '#4a4248' });
      addP({ type: 'ring', x: p.tx, y: p.ty, life: 0.45, size: 0.5, grow: p.splash * 2.2, color: '#ffe08a' });
      G.decals.push({ x: p.tx, y: p.ty, r: p.splash * 0.75, life: 4, max: 4 });
      G.shake = Math.max(G.shake, 0.55); sfx('boom');
      break;
    }
    case 'arrowsWave':
      areaDamage(p.team, p.tx, p.ty, p.splash, p.dmg, p.tower);
      sfx('arrow');
      break;
    case 'varrow':
      addP({ type: 'puff', x: p.tx, y: p.ty, z: 0.05, life: 0.3, size: 0.1, grow: 1, color: '#efe3c4' });
      G.decals.push({ x: p.tx, y: p.ty, r: 0.1, life: 0.6, max: 0.6, arrow: true });
      break;
  }
}

// =====================================================================
//  AI 对手
// =====================================================================
function aiTryPlace(cid, x, y) {
  const idx = G.hand[1].indexOf(cid); if (idx < 0) return false;
  if (CD[cid].spell) return deploy(1, idx, clamp(x, 0.5, COLS - 0.5), clamp(y, 0.5, ROWS - 0.5));
  const tries = [[0, 0], [1, 0], [-1, 0], [0, -1], [1, -1], [-1, -1], [0, 1], [2, 0], [-2, 0], [0, -2]];
  for (const [ox, oy] of tries) {
    const px = Math.floor(clamp(x + ox, 0, COLS - 0.01)) + 0.5, py = Math.floor(clamp(y + oy, 0, ROWS - 0.01)) + 0.5;
    if (validPlace(1, cid, px, py)) return deploy(1, idx, px, py);
  }
  return false;
}
function clusterValue(team, x, y, r) {
  let v = 0; for (const u of G.units) if (u.team === team && u.alive && u.delay <= 0 && Math.hypot(u.x - x, u.y - y) <= r + u.r * 0.5) v += u.d.value * (u.hp / u.maxHp);
  return v;
}
const AI_TANKS = ['giant', 'ironman', 'lancer', 'hog', 'balloon', 'valk'];
function aiUpdate(dt) {
  const A = G.ai; A.t -= dt; if (A.t > 0) return;
  const D = DIFF[G.diff]; A.t = D.think * rnd(0.7, 1.3);
  const el = G.el[1], hand = G.hand[1];
  const has = cid => hand.includes(cid) && CD[cid].cost <= el;
  // 1) 火球补刀低血量的塔
  for (const sp of ['fireball', 'arrows', 'zap']) if (has(sp)) {
    for (const t of G.towers) if (t.team === 0 && t.alive && t.hp <= CD[sp].dmg * CD[sp].tower + 5) { if (aiTryPlace(sp, t.x, t.y)) return; }
  }
  // 2) 防守
  const th = G.units.filter(u => u.team === 0 && u.alive && u.delay <= 0 && !u.d.building && u.y < 21.5);
  if (th.length) {
    th.sort((a, b) => a.y - b.y);
    const f = th[0];
    const near = th.filter(u => dist(u, f) < 4);
    const val = near.reduce((s, u) => s + u.d.value * (u.hp / u.maxHp), 0);
    const air = near.some(u => u.d.air), ground = near.some(u => !u.d.air);
    const swarm = near.filter(u => u.maxHp <= 320).length >= 3;
    const tank = near.some(u => u.maxHp >= 1300);
    const bldHunter = near.some(u => u.d.tgt === 'buildings');
    if (f.y > 17.5 && el < 8.5 && val < 4) return;
    if (Math.random() > D.smart && val < 3) return;
    const cx = near.reduce((s, u) => s + u.x, 0) / near.length, cy = near.reduce((s, u) => s + u.y, 0) / near.length;
    const lead = f.d.spd * 0.8;
    if (has('fireball') && clusterValue(0, cx, cy - lead, 2.5) >= 4.5) { if (aiTryPlace('fireball', cx, cy - lead)) return; }
    if (has('arrows') && swarm) { if (aiTryPlace('arrows', cx, cy - lead * 0.6)) return; }
    if (has('zap') && swarm && clusterValue(0, cx, cy, 2.5) >= 1.8) { if (aiTryPlace('zap', cx, cy - lead * 0.4)) return; }
    if (has('freeze') && clusterValue(0, cx, cy, 3) >= 8 && f.y < 12) { if (aiTryPlace('freeze', cx, cy)) return; }
    const score = cid => {
      switch (cid) {
        case 'knight': return !ground ? 0 : tank ? 2.4 : 2.0;
        case 'ironman': return !ground ? 0 : swarm ? 0.4 : tank ? 3.6 : 2.4;
        case 'goblins': return !ground ? 0 : swarm ? 0.4 : tank ? 2.7 : 1.7;
        case 'archers': return air ? 3.0 : swarm ? 1.4 : 1.6;
        case 'wizard': return swarm ? 3.2 : air ? 2.6 : 1.8;
        case 'skarmy': return !ground ? 0 : tank ? 3.0 : 1.2;
        case 'dragon': return swarm ? 2.6 : air ? 2.2 : 1.6;
        case 'musketeer': return air ? 3.1 : tank ? 2.0 : 1.8;
        case 'bomber': return !ground ? 0 : swarm ? 3.0 : 1.2;
        case 'bats': return swarm ? 0.3 : tank ? 2.3 : air ? 1.8 : 1.5;
        case 'valk': return !ground ? 0 : swarm ? 3.4 : 2.0;
        case 'lancer': return !ground ? 0 : tank ? 2.4 : 2.2;
        case 'cannonB': return air || !ground ? 0 : bldHunter ? 3.3 : tank ? 2.6 : 1.6;
        case 'tomb': return !ground ? 0 : bldHunter ? 2.8 : tank ? 2.2 : 1.4;
        case 'inferno': return swarm ? 0.3 : tank ? 3.8 : 1.8;
        case 'witch': return swarm ? 2.6 : air ? 2.2 : tank ? 2.1 : 1.7;
        case 'mortar': return air || !ground ? 0 : swarm ? 2.2 : f.y > 15 ? 1.8 : 0.8;
        default: return 0.1;
      }
    };
    let best = null, bs = 0;
    for (const cid of hand) { if (CD[cid].cost > el || CD[cid].spell) continue; const s = score(cid) + rnd(-0.3, 0.3) * (1.2 - D.smart); if (s > bs) { bs = s; best = cid; } }
    if (best && bs > 0.6) {
      const ud = UD[CD[best].unit];
      const ranged = ud.range > 2;
      let x, y;
      if (ud.building) { x = clamp(lerp(9, f.x, 0.35), 5.5, 12.5); y = bldHunter ? 10.5 : clamp(f.y - 3.5, 8.5, 12.5); }
      else if (f.y > 15.5) { x = nearBridge(f.x) + (ranged ? (f.x < 9 ? 1.5 : -1.5) : 0); y = ranged ? 10.5 : 13.5; }
      else if (ranged) { x = f.x + (f.x < 9 ? 1.5 : -1.5); y = f.y - 4; }
      else { x = f.x; y = f.y - 1.6; }
      y = Math.min(y, !ud.building && laneDead(0, x < 9 ? 0 : 1) ? 21.5 : 14.5); y = Math.max(y, 1);
      if (aiTryPlace(best, x, y)) return;
    }
    if (f.y < 16) return;
  }
  // 3) 进攻 - 支援已有坦克
  const tankU = G.units.find(u => u.team === 1 && u.alive && AI_TANKS.includes(u.type) && u.y > 6 && u.y < 22);
  if (tankU) {
    if (has('rage') && clusterValue(1, tankU.x, tankU.y, 3) >= 5 && G.towers.some(t => t.team === 0 && t.alive && dist(t, tankU) < 5)) { if (aiTryPlace('rage', tankU.x, tankU.y)) return; }
    for (const cid of ['wizard', 'witch', 'musketeer', 'archers', 'bomber', 'goblins', 'bats', 'knight', 'dragon']) {
      if (has(cid) && el >= CD[cid].cost + 0.5) { if (aiTryPlace(cid, tankU.x, Math.min(tankU.y - 2, 14.5))) return; }
    }
    // 冰冻：坦克已经贴塔时冻结防御
    if (has('freeze') && el >= 5) {
      for (const t of G.towers) if (t.team === 0 && t.alive && dist(t, tankU) < 3.5 && clusterValue(1, tankU.x, tankU.y, 3) >= 5) { if (aiTryPlace('freeze', t.x, t.y - 1)) return; }
    }
  }
  // 4) 火球打对方后排高价值
  if (has('fireball')) {
    for (const u of G.units) if (u.team === 0 && u.alive && u.delay <= 0 && clusterValue(0, u.x, u.y, 2.5) >= 5.5) { if (aiTryPlace('fireball', u.x, u.y)) return; }
  }
  // 5) 发起进攻
  if (el >= D.push) {
    const pts = G.towers.filter(t => t.team === 0 && t.ttype === 'princess');
    let lane;
    const dead = pts.find(t => !t.alive);
    if (dead) lane = dead.lane; else lane = pts[0].hp < pts[1].hp ? 0 : pts[0].hp > pts[1].hp ? 1 : (Math.random() < 0.5 ? 0 : 1);
    const lx = lane ? 14.5 : 3.5;
    const wins = { giant: 9.5, balloon: 9.5, ironman: 12.5, lancer: 12.5, hog: 13.5 };
    for (const cid of shuffle(Object.keys(wins))) if (has(cid)) { if (aiTryPlace(cid, lx, wins[cid])) return; }
    const opts = hand.filter(c => !CD[c].spell && CD[c].cost <= el && !isBuildingCard(c));
    if (opts.length) { const cid = opts[Math.floor(Math.random() * opts.length)]; aiTryPlace(cid, lx, UD[CD[cid].unit].range > 2 ? 11.5 : 13.5); }
  }
}


// =====================================================================
//  网络同步编解码
// =====================================================================
const TYPES = Object.keys(UD), TI = Object.fromEntries(TYPES.map((t, i) => [t, i]));
const PKINDS = ['arrow', 'varrow', 'cannon', 'orb', 'flame', 'fireball', 'arrowsWave', 'bullet', 'bomb', 'dropbomb', 'mortar', 'hex'];
const PKI = Object.fromEntries(PKINDS.map((t, i) => [t, i]));
const r2 = v => Math.round(v * 100) / 100;
const PDEF = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, size: 0.2, grow: 0, color: '#fff', rot: 0, vr: 0 };
function packP(p) {
  const o = { type: p.type, life: r2(p.life) };
  for (const k in PDEF) if (p[k] !== PDEF[k] && p[k] !== undefined) o[k] = typeof p[k] === 'number' ? r2(p[k]) : p[k];
  if (p.tc !== undefined && p.tc !== null) o.tc = p.tc;
  if (p.seed !== undefined) o.seed = p.seed;
  return o;
}
// 服务器：生成一帧公共快照，并取走本帧新产生的特效（粒子/贴花/飘字/横幅/音效）
function snapshot(g, sounds) {
  const fx = {
    p: g.parts.splice(0).map(packP),
    d: g.decals.splice(0).map(d => ({ x: r2(d.x), y: r2(d.y), r: r2(d.r), life: r2(d.life), max: r2(d.max), ice: d.ice ? 1 : 0, arrow: d.arrow ? 1 : 0, rage: d.rage ? 1 : 0 })),
    x: g.texts.splice(0).map(t => ({ x: r2(t.x), y: r2(t.y), life: t.life, max: t.max, kind: t.kind, v: t.v, team: t.team })),
    b: g.banners.splice(0).map(b => ({ text: b.text, sub: b.sub, color: b.color, dur: b.dur })),
    s: sounds || [],
  };
  const tid = t => !t ? 0 : t.kind === 'tower' ? -1 - g.towers.indexOf(t) : t.id;
  return {
    t: 's', st: g.state, cd: r2(g.cd), tm: r2(g.time), ot: g.ot ? 1 : 0, db: g.dbl ? 1 : 0,
    el: [r2(g.el[0]), r2(g.el[1])], cr: g.crowns, w: g.winner, sh: r2(g.shake),
    tw: g.towers.map(t => [Math.ceil(t.hp), t.alive ? 1 : 0, t.active ? 1 : 0, r2(t.aim), r2(t.recoil), r2(t.atk), t.face, t.target ? 1 : 0, r2(t.flash), r2(t.frozen), r2(t.stun)]),
    u: g.units.map(u => [u.id, TI[u.type], u.team, r2(u.x), r2(u.y), Math.ceil(u.hp), r2(Math.max(0, u.delay)), u.landed ? 1 : 0, r2(u.spawnT), u.face,
      u.moving ? 1 : 0, r2(u.atk), u.attacking ? 1 : 0, r2(u.flash), r2(u.frozen), r2(u.stun), u.charging ? 1 : 0, u.cd < 1 ? 1 : 0, r2(u.ramp), r2(u.ang),
      r2(Math.max(0, u.deploy)), tid(u.target), u.rage > 0 ? 1 : 0]),
    p: g.projs.filter(p => p.t >= 0 && p.kind !== 'arrowsWave').map(p => [p.id, PKI[p.kind], p.team, r2(p.x), r2(p.y), r2(p.z), r2(p.tx), r2(p.ty), r2(p.splash), r2(Math.min(1, p.t / p.dur))]),
    fx,
  };
}
function validDeck(d) { return Array.isArray(d) && d.length === 8 && new Set(d).size === 8 && d.every(c => typeof c === 'string' && !!CD[c]); }

const Core = {
  COLS, ROWS, SQ, BRIDGES, UD, CD, DIFF, TOWER_POS, ALL_CARDS, DEFAULT_DECKS, TYPES, PKINDS, PDEF,
  clamp, lerp, rnd, dist, TAU, shuffle, genDeck, deckOK, avgCost, validDeck,
  hooks, setG, getG, newGame, makeTower, update, deploy, adjustPlace, validPlace, laneDead, formation, isBuildingCard, endGame, snapshot,
};
if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
