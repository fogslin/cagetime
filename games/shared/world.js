// Living world: five promotions, divisions, rankings, AI vs AI fights, prospects, retirements,
// yearly fight caps and the champion rules (max 2 belts, double champs defend each belt yearly).
import { DIVISIONS, TIERS, TOP, BELT_PROMOS, CHAMP_CAP, MAX_BELTS, adjacentDivs, CITIES } from './data.js?v=20261026a';
import { genFighter, ovr, ageOneYear, retireChance, fullName, TIER_BASE } from './fighter.js?v=20261026a';
import { quickFight, fastFight } from './fight.js?v=20261026a';
import { canBook, pairKey, series } from './rematch.js?v=20261026a';
import { makeRng, clamp } from './rng.js?v=20261026a';

export const WORLD_VERSION = 2;
export function rngFor(world) { const r = makeRng(1); r.setState(world.rs); return r; }
export function saveRng(world, r) { world.rs = r.state(); }
// runtime-only caches (never saved)
function hid(world, k, v) { Object.defineProperty(world, k, { value: v, writable: true, enumerable: false, configurable: true }); return v; }
export function touch(world) { hid(world, '_ix', null); hid(world, '_rk', null); }

export const yearOf = (wk) => Math.floor(wk / 52);
export function yearFights(f, y) { return f.fy && f.fy[0] === y ? f.fy[1] : 0; }
export function beltsOf(world, id) {
  const out = [];
  for (const pid of BELT_PROMOS) for (const div of world.divs) if (world.T[pid][div].champ === id) out.push({ pid, div });
  return out;
}
export const isChamp = (world, id) => beltsOf(world, id).length > 0;
export function capOf(world, f) { return isChamp(world, f.id) ? CHAMP_CAP : TIERS[f.tier].cap; }
// may this fighter be booked for a fight that happens in week wk?
export function capOk(world, f, wk = world.wk) { return yearFights(f, yearOf(wk)) < capOf(world, f); }
export function capInfo(world, f) {
  const y = yearOf(world.wk), n = yearFights(f, y), cap = capOf(world, f);
  return { n, cap, left: Math.max(0, cap - n), hit: n >= cap, champ: isChamp(world, f.id), year: y, nextWk: (y + 1) * 52 };
}
export const belt = (world, div, pid = TOP) => world.T[pid][div];
export const hasDiv = (world, d) => world.divs.includes(d);

export function createWorld({ seed = Date.now() % 1e9, gender = 'm', divs } = {}) {
  const rng = makeRng(seed);
  const list = divs || DIVISIONS.filter(d => gender === 'all' || d.g === gender).map(d => d.id);
  const world = { v: WORLD_VERSION, seed, rs: 0, wk: 0, nid: 1, f: {}, divs: list, T: {}, h2h: {}, heat: {}, news: [], year: [], awards: [], used: [], log: [] };
  for (const pid of BELT_PROMOS) world.T[pid] = {};
  const used = new Set();
  for (const div of list) {
    for (const t of TIERS) for (let i = 0; i < t.size; i++) addFighter(world, rng, { div, tier: t.id, used });
    for (const pid of BELT_PROMOS) {
      world.T[pid][div] = { champ: null, since: 0, def: 0, lastTitle: -30, hist: [], ty: 0 };
      // crown the best proven fighter
      const top = activeIn(world, div, pid).filter(qualifies).sort((a, b) => ovr(b.attrs) - ovr(a.attrs))[0] || activeIn(world, div, pid)[0];
      const D = world.T[pid][div];
      D.champ = top.id; top.rp += 120; top.hype = Math.max(top.hype, pid === TOP ? 70 : 55); top.pop = Math.max(top.pop, pid === TOP ? 60 : 45);
      D.hist.push({ wk: 0, id: top.id, name: fullName(top) });
    }
  }
  world.used = [...used].slice(-1500);
  saveRng(world, rng);
  touch(world);
  return world;
}
export function addFighter(world, rng, opts) {
  const used = opts.used || new Set(world.used);
  const id = 'f' + world.nid++;
  const f = genFighter(rng, { ...opts, used, id });
  if (!opts.used) world.used.push(f.first + ' ' + f.last);
  f.fc = f.w + f.l + f.d;
  world.f[id] = f;
  if (world._ix) { const k = f.div + ':' + f.tier; (world._ix.get(k) || world._ix.set(k, []).get(k)).push(f); }
  return f;
}
function index(world) {
  if (world._ix) return world._ix;
  const m = new Map();
  for (const id in world.f) { const f = world.f[id]; if (!f.act) continue; const k = f.div + ':' + f.tier; let a = m.get(k); if (!a) m.set(k, a = []); a.push(f); }
  return hid(world, '_ix', m);
}
export const activeIn = (world, div, tier) => (index(world).get(div + ':' + tier) || []).filter(f => f.act && f.div === div && f.tier === tier);

// ---- rankings: only proven fighters, weighted by record quality, recent form and opponent quality ----
export function qualifies(f) {
  const n = f.w + f.l;
  return f.w >= 7 && f.w / (n || 1) >= 0.65 && f.w - f.l >= 5 && f.recent.slice(-4).filter(r => r === 'L').length < 3;
}
const soft = (f) => f.w >= 6 && f.w / ((f.w + f.l) || 1) >= 0.6 && f.w - f.l >= 3 && f.recent.slice(-3).join('') !== 'LLL';
export function rankScore(f) {
  const rec = f.recent.slice(-5);
  const rw = rec.filter(r => r === 'W').length, rl = rec.filter(r => r === 'L').length;
  return f.rp + 14 * rw - 18 * rl + 8 * clamp(f.streak, -3, 5) + 140 * (f.w / ((f.w + f.l) || 1)) + 6 * Math.min(f.qw || 0, 12);
}
export function rankings(world, div, pid = TOP) {
  if (!TIERS[pid] || !TIERS[pid].belts || !world.T[pid] || !world.T[pid][div]) return [];
  const cache = world._rk || hid(world, '_rk', {});
  const key = div + ':' + pid;
  if (cache[key]) return cache[key];
  const champ = world.T[pid][div].champ;
  const pool = activeIn(world, div, pid).filter(f => f.id !== champ && !f.away);
  const sc = new Map(pool.map(f => [f.id, rankScore(f)]));
  const by = (a, b) => sc.get(b.id) - sc.get(a.id);
  let list = pool.filter(qualifies).sort(by);
  if (list.length < 15) list = list.concat(pool.filter(f => !qualifies(f) && soft(f)).sort(by));
  return (cache[key] = list.slice(0, 15).map(f => f.id));
}
export function rankOf(world, id) {
  const f = world.f[id]; if (!f) return null;
  if (!TIERS[f.tier].belts) return null;
  if (beltsOf(world, id).some(b => b.pid === f.tier)) return 0;
  const r = rankings(world, f.div, f.tier).indexOf(id);
  return r < 0 ? null : r + 1;
}
export function tierStanding(world, id) {
  const f = world.f[id];
  const list = activeIn(world, f.div, f.tier).sort((a, b) => b.rp - a.rp);
  return list.findIndex(x => x.id === id) + 1;
}
export function eventName(world, tier, wk = world.wk) {
  const t = TIERS[tier];
  const city = CITIES[(wk * 7 + tier * 3) % CITIES.length];
  if (t.lvl === 2) return (wk % 2 ? t.short + ' Fight Night ' + (t.evn / 2 + (wk >> 1)) : t.event + ' ' + (t.evn + (wk >> 1))) + ' · ' + city;
  return t.event + ' ' + (t.evn + Math.floor(wk / 2)) + ' · ' + city;
}
export function ctxFor(world, a, b, extra = {}) {
  const s = series(world.h2h, a, b);
  const fa = world.f[a], fb = world.f[b];
  const key = pairKey(a, b);
  const since = (f, m) => (m && f ? Math.max(0, f.fc - m.fc[key.startsWith(f.id + '|') ? 0 : 1]) : 0);
  const heat = world.heat[key] || 0;
  const money = fa && fb && fa.pop + fb.pop >= 90 ? 1 : 0;
  return { wk: world.wk, sinceA: since(fa, s.last), sinceB: since(fb, s.last), heat, money, ...extra };
}
export function bookCheck(world, a, b, extra = {}) {
  const ctx = ctxFor(world, a, b, extra);
  const r = canBook(world.h2h, a, b, ctx);
  return { ...r, ctx };
}
export function news(world, txt, kind = '') { world.news.unshift({ wk: world.wk, txt, kind }); if (world.news.length > 120) world.news.length = 120; }
const elo = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));

// ---- champion rules ----
export function vacate(world, pid, div, why) {
  const D = world.T[pid][div]; const f = D.champ && world.f[D.champ];
  if (!f) return;
  D.champ = null; D.def = 0; if (world._rk) world._rk = null;
  if (why) news(world, why.replace('{name}', fullName(f)).replace('{div}', divName(div)).replace('{promo}', TIERS[pid].short), 'title');
}
// A double champ who has already defended (or won) belt `div` this calendar year must vacate the other
// belt first if that one has not been defended yet. Returns the belt that would have to go, or null.
export function defenseConflict(world, id, pid, div) {
  const mine = beltsOf(world, id).filter(b => b.pid === pid);
  if (mine.length < 2 || !mine.some(b => b.div === div)) return null;
  const y = yearOf(world.wk);
  const other = mine.find(b => b.div !== div);
  if (world.T[pid][div].ty === y && world.T[pid][other.div].ty !== y) return other;
  return null;
}
// belts a double champ still has to defend this calendar year
export function undefended(world, id) {
  const mine = beltsOf(world, id); if (mine.length < 2) return [];
  const y = yearOf(world.wk);
  return mine.filter(b => world.T[b.pid][b.div].ty !== y);
}

// Apply a finished fight (fs from fight.js) to the world. Returns the record.
export function recordFight(world, aId, bId, fs, meta = {}) {
  const rng = rngFor(world);
  const A = world.f[aId], B = world.f[bId], res = fs.result;
  const prev = (world.h2h[pairKey(aId, bId)] || []).map(m => ({ ...m }));
  const wId = res.winner === 'A' ? aId : res.winner === 'B' ? bId : null;
  const W = wId ? world.f[wId] : null, L = wId ? (wId === aId ? B : A) : null;
  const finish = res.method === 'KO' || res.method === 'TKO' || res.method === 'SUB';
  const y = yearOf(world.wk);
  const lRpBefore = L ? L.rp : 0;
  for (const [f, side] of [[A, 'A'], [B, 'B']]) {
    f.fc = (f.fc || 0) + 1; f.lw = world.wk;
    f.fy = [y, yearFights(f, y) + 1];
    if (res.method === 'NC') { f.nc++; f.recent.push('N'); }
    else if (!wId) { f.d++; f.recent.push('D'); f.streak = 0; }
    else if (f.id === wId) {
      f.w++; f.streak = Math.max(1, f.streak + 1); f.recent.push('W');
      if (res.method === 'KO' || res.method === 'TKO') f.ko++; if (res.method === 'SUB') f.sub++;
    } else {
      f.l++; f.streak = Math.min(-1, f.streak - 1); f.recent.push('L');
      if (res.method === 'KO' || res.method === 'TKO') f.kol++;
    }
    if (f.recent.length > 8) f.recent.shift();
    const s = fs[side];
    const injP = clamp(0.06 + (100 - s.hp) / 220 + (res.method === 'KO' && f.id !== wId ? 0.25 : 0), 0, 0.7);
    f.inj = rng() < injP ? rng.int(3, 18) : 0;
    f.avail = world.wk + f.rest + f.inj + (res.method === 'KO' && f.id !== wId ? 8 : 0);
    f.bk = null;
  }
  if (A.tier === B.tier && res.method !== 'NC') {
    const ea = elo(A.rp, B.rp);
    const sa = wId === aId ? 1 : wId === bId ? 0 : 0.5;
    const k = 44 + (finish ? 10 : 0) + (meta.title ? 20 : 0);
    A.rp = Math.round(A.rp + k * (sa - ea)); B.rp = Math.round(B.rp + k * ((1 - sa) - (1 - ea)));
  }
  if (W) {
    // a quality win: beating someone rated well above the promotion's middle
    if (lRpBefore >= 1060 || isChamp(world, L.id)) W.qw = (W.qw || 0) + 1;
    W.hype = clamp(W.hype + 4 + (finish ? 5 : 0) + (meta.title ? 10 : 0), 0, 100); W.pop = clamp(W.pop + 2 + (finish ? 2 : 0) + (meta.title ? 6 : 0), 0, 100);
    L.hype = clamp(L.hype - 6, 0, 100);
  }
  if (world.mt) for (const f of [A, B]) if (f.mgr) { const t = world.mt[f.mgr] = world.mt[f.mgr] || { w: 0, l: 0, t: 0, t2: 0 }; if (f.id === wId) { t.w++; if (TIERS[f.tier].lvl === 2) t.t2++; if (meta.title && belt(world, meta.div, meta.pid ?? A.tier).champ !== wId) t.t++; } else if (wId) t.l++; }
  const key = pairKey(aId, bId);
  const entry = { wk: world.wk, m: res.method, fc: key.startsWith(aId + '|') ? [A.fc, B.fc] : [B.fc, A.fc] };
  if (wId) entry.w = wId; if (res.close) entry.close = 1; if (res.contro) entry.contro = 1; if (meta.title) entry.title = 1;
  (world.h2h[key] = world.h2h[key] || []).push(entry);
  const h = Math.round(clamp((world.heat[key] || 0) * 0.6 + (res.contro ? 30 : 0) + (meta.heat || 0), 0, 100));
  if (h >= 5) world.heat[key] = h; else delete world.heat[key];
  let titleNote = '';
  const pid = meta.pid ?? A.tier;
  if (meta.title) {
    const D = belt(world, meta.div, pid);
    D.lastTitle = world.wk; D.ty = y;
    const promo = TIERS[pid].short;
    if (wId && D.champ !== wId) {
      titleNote = D.champ ? 'new' : 'vacant';
      D.champ = wId; D.since = world.wk; D.def = 0; D.hist.push({ wk: world.wk, id: wId, name: fullName(W) }); if (D.hist.length > 12) D.hist.shift();
      news(world, `👑 ${fullName(W)} wins the ${promo} ${divName(meta.div)} title${titleNote === 'new' ? ' and dethrones ' + fullName(L) : ''}!`, 'title');
    } else if (wId) { D.def++; titleNote = 'defense'; news(world, `🏆 ${fullName(W)} defends the ${promo} ${divName(meta.div)} title against ${fullName(L)}.`, 'title'); }
  } else if (W && TIERS[A.tier].lvl === 2 && lRpBefore - W.rp > 120) news(world, `⚡ Upset in ${TIERS[A.tier].short}! ${fullName(W)} beats ${fullName(L)} by ${res.method === 'DEC' ? 'decision' : res.method}.`, 'upset');
  const rec = { wk: world.wk, a: aId, b: bId, w: wId, m: res.method, det: res.detail, r: res.round, t: res.time, title: !!meta.title, pid, reason: meta.reason || null, ctx: meta.ctx || null, prev, div: meta.div, ev: meta.ev || eventName(world, A.tier), tier: A.tier, titleNote, an: fullName(A), bn: fullName(B), up: W ? Math.round(lRpBefore - W.rp) : 0 };
  if (TIERS[A.tier].lvl === 2) world.year.push({ a: aId, b: bId, w: wId, m: res.method, title: rec.title, div: meta.div, up: rec.up, kd: fs.A.st.kd + fs.B.st.kd, sig: fs.A.st.sig + fs.B.st.sig, close: entry.close, an: rec.an, bn: rec.bn, r: res.round, tier: A.tier });
  if (world.log) { world.log.push(rec); if (world.log.length > (world.logMax || 60)) world.log.shift(); }
  hid(world, '_rk', null);
  saveRng(world, rng);
  return rec;
}
export const divName = (id) => (DIVISIONS.find(d => d.id === id) || {}).name || id;

function aiFight(world, rng, a, b, meta) {
  const full = TIERS[a.tier].lvl === 2 || meta.title;
  const fs = full ? quickFight(a, b, { rng, rounds: meta.title ? 5 : 3, title: meta.title }) : fastFight(a, b, { rng });
  saveRng(world, rng);
  const capA = { n: yearFights(a, yearOf(world.wk)), cap: capOf(world, a) }, capB = { n: yearFights(b, yearOf(world.wk)), cap: capOf(world, b) };
  const rec = recordFight(world, a.id, b.id, fs, meta);
  rec.caps = [capA, capB];
  rng.setState(world.rs);
  if (world.onAiFight) world.onAiFight(rec, fs);
  return rec;
}
const free = (world, f) => f.act && !f.lock && !f.bk && f.avail <= world.wk && !f.away && capOk(world, f);

export function advanceWeek(world) {
  const rng = rngFor(world);
  world.wk++;
  touch(world);
  if (world.wk % 52 === 0) yearly(world, rng);
  for (const div of world.divs) {
    for (let tier = 0; tier < TIERS.length; tier++) {
      const pool = activeIn(world, div, tier).filter(f => free(world, f)).sort((x, y) => y.rp - x.rp);
      const taken = new Set();
      let D = null;
      if (TIERS[tier].belts) {
        D = world.T[tier][div];
        const champ = D.champ ? world.f[D.champ] : null;
        if (champ && (!champ.act || champ.tier !== tier)) { D.champ = null; }
        // hold the champion for a hot player-controlled contender (career player / GM client) for a while
        if (D.champ && !(D.resv > world.wk)) {
          const rk = rankings(world, div, tier).slice(0, 3).map(id => world.f[id]);
          const hot = rk.find(f => f.lock && f.streak >= 1 && !f.bk);
          if (hot && D.resvFor !== hot.id + ':' + hot.fc) { D.resv = world.wk + 10; D.resvFor = hot.id + ':' + hot.fc; }
        }
        if (D.champ && free(world, champ) && world.wk - D.lastTitle >= 16 && !(D.resv > world.wk) && rng.chance(0.5)) {
          const ranks = rankings(world, div, tier);
          for (let i = 0; i < Math.min(6, ranks.length); i++) {
            const c = world.f[ranks[i]];
            if (!free(world, c)) continue;
            const bc = bookCheck(world, champ.id, c.id, { title: true, champ: champ.id, challengerRank: i + 1 });
            if (bc.ok) { taken.add(champ.id); taken.add(c.id); aiFight(world, rng, champ, c, { title: true, div, pid: tier, reason: bc.reason, ctx: bc.ctx }); break; }
          }
        } else if (!D.champ) {
          const ranks = rankings(world, div, tier).map(id => world.f[id]).filter(f => free(world, f));
          outer: for (let i = 0; i < Math.min(4, ranks.length); i++) for (let j = i + 1; j < Math.min(5, ranks.length); j++) {
            const bc = bookCheck(world, ranks[i].id, ranks[j].id, { title: true, champ: null });
            if (bc.ok) { taken.add(ranks[i].id); taken.add(ranks[j].id); news(world, `Vacant ${TIERS[tier].short} ${divName(div)} title: ${fullName(ranks[i])} vs ${fullName(ranks[j])}.`, 'title'); aiFight(world, rng, ranks[i], ranks[j], { title: true, div, pid: tier, reason: bc.reason, ctx: bc.ctx }); break outer; }
          }
        }
      }
      const champId = D ? D.champ : null;
      for (let i = 0; i < pool.length; i++) {
        const a = pool[i];
        if (taken.has(a.id) || a.id === champId || !rng.chance(0.4)) continue;
        for (let j = i + 1; j < Math.min(pool.length, i + 7); j++) {
          const b = pool[j];
          if (taken.has(b.id) || b.id === champId) continue;
          const bc = bookCheck(world, a.id, b.id);
          if (!bc.ok || (bc.reason && !rng.chance(0.5))) continue;
          taken.add(a.id); taken.add(b.id);
          aiFight(world, rng, a, b, { div, reason: bc.reason, ctx: bc.ctx });
          break;
        }
      }
    }
  }
  if (world.wk % 4 === 0) monthly(world, rng);
  if (world.wk % 52 === 40) {
    // early warning for double champs: defend both belts before the year is out
    for (const pid of BELT_PROMOS) for (const div of world.divs) {
      const id = world.T[pid][div].champ; if (!id) continue;
      for (const b of undefended(world, id)) if (b.div === div && b.pid === pid) news(world, `⏳ ${fullName(world.f[id])} must defend the ${TIERS[pid].short} ${divName(div)} title before the end of the year or vacate it.`, 'title');
    }
  }
  if (world.wk % 4 === 0) for (const k in world.heat) { world.heat[k] = Math.round(world.heat[k] * 0.97); if (world.heat[k] < 5) delete world.heat[k]; }
  saveRng(world, rng);
}
export function moveFighter(world, f, tier, why) {
  const old = f.tier; f.tier = tier;
  for (const b of beltsOf(world, f.id)) if (b.pid !== tier) vacate(world, b.pid, b.div, `{name} leaves {promo} and vacates the ${divName(b.div)} title.`);
  f.rp = Math.round(1000 + (ovr(f.attrs) - TIER_BASE[tier]) * 8 + (TIERS[tier].lvl > TIERS[old].lvl ? 20 : -20));
  f.streak = Math.min(f.streak, 2);
  touch(world);
  if (tier === TOP && why && f.w >= 12) news(world, `✍️ ${fullName(f)} (${f.w}-${f.l}) signs with ${TIERS[tier].short} ${why}.`, 'sign');
}
// where a fighter can go up / down the ladder
const UP = { 0: [1, 2], 1: [3, 4], 2: [3, 4], 3: [4] };
const DOWN = { 4: [3, 1, 2], 3: [1, 2], 2: [0, 1], 1: [0] };
export const upOptions = (tier) => UP[tier] || [];
export const downOptions = (tier) => DOWN[tier] || [];
function room(world, div, t) { return TIERS[t].size + 2 - activeIn(world, div, t).length; }
// who each promotion signs from when it has open spots (best prospects first)
const FEED = { 4: [3, 1, 2], 3: [1, 2], 2: [0, 1], 1: [0, 2] };
function monthly(world, rng) {
  for (const div of world.divs) {
    // releases first: losing runs, poor records in the majors, bloated rosters
    for (const t of [4, 3, 2, 1]) {
      const list = activeIn(world, div, t).filter(f => !f.lock && !isChamp(world, f.id)).sort((a, b) => a.rp - b.rp);
      let excess = list.length - TIERS[t].size;
      for (const f of list) {
        const losing = f.recent.slice(-3).join('') === 'LLL' || (f.recent.slice(-4).filter(r => r === 'L').length >= 3);
        const poor = TIERS[t].lvl === 2 && f.fc > 12 && f.w / ((f.w + f.l) || 1) < 0.58;
        const n = TIERS[t].size + excess;
        if ((losing && n > TIERS[t].size * (TIERS[t].lvl === 2 ? 0.8 : 0.95)) || (poor && excess > (t === 3 ? 0 : -4)) || (excess > 3 && f.streak < 0)) {
          const opts = DOWN[t]; const to = opts.find(d => room(world, div, d) > 0) ?? opts[0];
          moveFighter(world, f, to); excess--;
          if (TIERS[t].lvl === 2) news(world, `${fullName(f)} is released by ${TIERS[t].short} after a rough run.`, 'cut');
        }
      }
    }
    // signings, top-down: hot streaks always get a call; open spots are filled with the best available
    for (const t of [4, 3, 2, 1]) {
      const src = FEED[t].flatMap(s => activeIn(world, div, s).map(f => ({ f, s, st: 0 })));
      const bySrc = {};
      for (const x of src) (bySrc[x.s] = bySrc[x.s] || []).push(x);
      for (const s in bySrc) bySrc[s].sort((a, b) => b.f.rp - a.f.rp).forEach((x, i) => { x.st = i; });
      const ok = (f) => !f.lock && !isChamp(world, f.id) && f.act && (TIERS[t].lvl < 2 || (f.w > f.l + 2 && f.w / ((f.w + f.l) || 1) >= (t === TOP ? 0.62 : 0.57)));
      const cand = src.filter(x => ok(x.f) && (TIERS[x.s].lvl === TIERS[t].lvl - 1 ? (x.f.streak >= 1 || x.st < 4) : (x.f.streak >= 2 && x.st < 6))).sort((a, b) => (b.f.streak >= 3) - (a.f.streak >= 3) || rankScore(b.f) - rankScore(a.f));
      let open = TIERS[t].size - activeIn(world, div, t).length;
      let moves = 0;
      const maxMoves = open > TIERS[t].size * 0.08 ? 6 : 2;
      for (const x of cand) {
        if (moves >= maxMoves) break;
        const hot = x.f.streak >= 3 || (x.f.streak >= 2 && x.st < 3);
        if (TIERS[x.s].lvl === TIERS[t].lvl && open <= 0) continue;
        if (open > 0 || (hot && room(world, div, t) > 0)) { moveFighter(world, x.f, t, 'after a ' + Math.max(x.f.streak, 1) + '-fight win streak'); open--; moves++; }
      }
    }
    // the regional scene: new hopefuls replace anyone who left; journeymen drift out of the sport
    const reg = activeIn(world, div, 0);
    for (let i = reg.length; i < TIERS[0].size; i++) addFighter(world, rng, { div, tier: 0, age: rng.int(19, 24) });
    if (reg.length > TIERS[0].size * 1.15) {
      const out = reg.filter(f => !f.lock && f.age >= 27 && f.l >= f.w).sort((a, b) => (a.w - a.l) - (b.w - b.l)).slice(0, reg.length - Math.round(TIERS[0].size * 1.1));
      for (const f of out) { f.act = 0; f.retWk = world.wk; }
      if (out.length) touch(world);
    }
  }
  hid(world, '_rk', null);
}
function yearly(world, rng) {
  const protect = new Set(world.protect || []);
  const prevY = yearOf(world.wk) - 1;
  // double champs must have defended (or won) each belt during the year that just ended
  for (const pid of BELT_PROMOS) for (const div of world.divs) {
    const D = world.T[pid][div]; if (!D.champ) continue;
    const mine = beltsOf(world, D.champ);
    if (mine.length >= 2 && D.ty !== prevY) vacate(world, pid, div, `🚫 {name} is stripped of the {promo} ${divName(div)} title: a double champ must defend each belt every year.`);
  }
  if (world.onYearEnd) world.onYearEnd(prevY);
  awards(world);
  const rets = [], moves = [];
  for (const f of Object.values(world.f)) {
    if (!f.act) continue;
    if (!f.lock) ageOneYear(rng, f);
    const champ = isChamp(world, f.id);
    if (!f.lock && rng() < retireChance(f) * (champ ? 0.4 : 1)) {
      f.act = 0; f.retWk = world.wk;
      for (const b of beltsOf(world, f.id)) vacate(world, b.pid, b.div, `{name} retires as {promo} ${divName(b.div)} champion. The title is vacant.`);
      if (f.tier === TOP) rets.push(f);
    } else if (!f.lock && f.tier >= 1 && !champ && rng() < 0.035) {
      const adj = adjacentDivs(f.div); const to = (f.age > 30 ? adj.up : rng.chance(0.5) ? adj.down : adj.up) || adj.up || adj.down;
      if (to && hasDiv(world, to)) { if (f.tier === TOP) moves.push([f, to]); f.div = to; f.rp -= 40; }
    }
  }
  // only the notable ones make the news
  for (const f of rets.sort((a, b) => (b.w + b.hype / 5) - (a.w + a.hype / 5)).slice(0, 4)) news(world, `👋 ${fullName(f)} (${f.w}-${f.l}) announces retirement.`, 'ret');
  for (const [f, to] of moves.slice(0, 3)) news(world, `↕️ ${fullName(f)} moves to ${divName(to)} in ${TIERS[f.tier].short}.`, 'move');
  touch(world);
  // fresh blood: new prospects every year, some blue-chippers straight into the national leagues
  for (const div of world.divs) {
    for (let i = 0; i < 8; i++) addFighter(world, rng, { div, tier: 0, age: rng.int(19, 23) });
    for (const t of [1, 1, 2, 2]) if (rng.chance(0.7)) { const f = addFighter(world, rng, { div, tier: t, age: rng.int(21, 24) }); f.pot = clamp(f.pot + 8, 0, 97); }
  }
  for (const id in world.f) { const f = world.f[id]; if (!f.act && !protect.has(id) && world.wk - f.retWk > 0) delete world.f[id]; }
  for (const k in world.h2h) { const [a, b] = k.split('|'); if (!protect.has(a) && !protect.has(b) && (!world.f[a] || !world.f[b])) delete world.h2h[k]; }
  for (const k in world.heat) { const [a, b] = k.split('|'); if (!world.f[a] || !world.f[b]) delete world.heat[k]; }
  if (world.used.length > 1500) world.used = world.used.slice(-1500);
  touch(world);
}
function awards(world) {
  const y = world.year; world.year = [];
  if (!y.length) return;
  const yr = 2026 + Math.round(world.wk / 52);
  const wins = {};
  for (const r of y) if (r.w && r.tier === TOP) wins[r.w] = (wins[r.w] || 0) + 1 + (r.title ? 2 : 0) + (r.m !== 'DEC' ? 0.5 : 0);
  const foy = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  const top = y.filter(r => r.tier === TOP);
  const ko = top.filter(r => r.m === 'KO').sort((a, b) => (b.up + (b.title ? 200 : 0)) - (a.up + (a.title ? 200 : 0)))[0];
  const fotn = y.slice().sort((a, b) => (b.kd * 30 + b.sig + (b.close ? 40 : 0) + b.r * 10) - (a.kd * 30 + a.sig + (a.close ? 40 : 0) + a.r * 10))[0];
  const upset = y.filter(r => r.w).sort((a, b) => b.up - a.up)[0];
  const nm = (id) => world.f[id] ? fullName(world.f[id]) : '—';
  const a = { year: yr, foy: foy ? { id: foy[0], name: nm(foy[0]) } : null, koy: ko ? { id: ko.w, name: nm(ko.w), txt: `${ko.an} vs ${ko.bn}` } : null, fotn: fotn ? { txt: `${fotn.an} vs ${fotn.bn}` } : null, upset: upset ? { id: upset.w, name: nm(upset.w), txt: `${upset.an} vs ${upset.bn}` } : null };
  world.awards.unshift(a); if (world.awards.length > 30) world.awards.length = 30;
  if (world.onAwards) world.onAwards(a, y);
}

// Fight offers for a locked fighter (the career player or a GM client).
// Returns [] when the yearly cap is reached (callers show the cap message + skip-to-next-year).
export function offersFor(world, id, { n = 3, rng } = {}) {
  const f = world.f[id]; const out = [];
  const tier = f.tier, T = TIERS[tier];
  if (!capOk(world, f)) return out;
  const avail = (o) => o.act && !o.lock && !o.bk && o.avail <= world.wk + 6 && !o.away;
  const pool = activeIn(world, f.div, tier).filter(o => o.id !== id && avail(o)).sort((a, b) => b.rp - a.rp);
  const all = activeIn(world, f.div, tier).sort((a, b) => b.rp - a.rp);
  const me = all.findIndex(o => o.id === id);
  const myBelts = beltsOf(world, id).filter(b => b.pid === tier);
  const myRank = rankOf(world, id);
  const used = new Set();
  const push = (o, type, extra = {}) => {
    if (used.has(o.id)) return false;
    const weeks = type === 'short' ? rng.int(2, 3) : rng.int(6, 10);
    if (!capOk(world, o, world.wk + weeks)) return false;
    const bc = bookCheck(world, id, o.id, extra);
    if (!bc.ok) return false;
    used.add(o.id);
    const of = { opp: o.id, type, title: !!extra.title, pid: tier, div: extra.div || f.div, reason: bc.reason, ctx: bc.ctx, weeks, short: type === 'short' };
    if (extra.vacate) of.vacate = extra.vacate;
    if (of.title && extra.champ === id) { const cf = defenseConflict(world, id, tier, of.div); if (cf) of.vacate = cf.div; }
    out.push(of);
    return true;
  };
  if (T.belts) {
    for (const b of myBelts) {
      const ranks = rankings(world, b.div, tier).map(x => world.f[x]).filter(o => avail(o) && o.div === b.div);
      for (let i = 0; i < Math.min(6, ranks.length); i++) if (push(ranks[i], 'defense', { title: true, champ: id, challengerRank: i + 1, div: b.div })) break;
    }
    const D = world.T[tier][f.div];
    if (D.champ !== id && myRank && ((myRank <= 5 && f.streak >= 3) || (myRank <= 3 && f.streak >= 1) || myRank === 1)) {
      const c = D.champ && world.f[D.champ];
      if (c && !c.lock && !c.bk && c.avail <= world.wk + 8) push(c, 'title', { title: true, champ: c.id, challengerRank: myRank, ...(myBelts.length >= MAX_BELTS ? { vacate: myBelts[0].div } : {}) });
      else if (!D.champ) { const r = rankings(world, f.div, tier).map(x => world.f[x]).find(o => o.id !== id && pool.includes(o)); if (r) push(r, 'title', { title: true, champ: null }); }
    }
    // champ-vs-champ superfight for another belt. Max 2 belts: with two already, one must be vacated first.
    if (myBelts.length) {
      for (const b of myBelts) {
        const adj = adjacentDivs(b.div);
        for (const d2 of [adj.up, adj.down]) {
          if (!d2 || !hasDiv(world, d2) || myBelts.some(x => x.div === d2)) continue;
          const c2 = world.T[tier][d2].champ && world.f[world.T[tier][d2].champ];
          if (c2 && !c2.lock && !c2.bk && c2.avail <= world.wk + 8 && rng.chance(0.5)) {
            const extra = { title: true, champ: c2.id, challengerRank: 1, div: d2 };
            if (myBelts.length >= MAX_BELTS) extra.vacate = myBelts.find(x => x.div !== b.div)?.div || myBelts[0].div;
            push(c2, 'superfight', extra);
          }
        }
      }
    }
  }
  for (const k in world.h2h) {
    if (out.length >= n + 1) break;
    if (!k.split('|').includes(id)) continue;
    const oid = k.split('|').find(x => x !== id); const o = world.f[oid];
    if (!o || !pool.includes(o)) continue;
    const bc = bookCheck(world, id, oid);
    if (bc.ok && bc.reason) push(o, 'rematch');
  }
  const cand = pool.map(o => ({ o, d: all.indexOf(o) - me })).filter(x => Math.abs(x.d) <= 10);
  rng.shuffle(cand);
  const up = cand.filter(x => x.d < 0).sort((a, b) => a.d - b.d);
  if (up.length) push(rng.pick(up.slice(0, 4)).o, 'step-up');
  for (const x of cand) { if (out.length >= n) break; push(x.o, Math.abs(x.d) <= 2 ? 'even' : x.d > 0 ? 'tune-up' : 'step-up'); }
  if (rng.chance(0.35)) { const s = cand.filter(x => x.d < 3 && !used.has(x.o.id)); if (s.length) push(rng.pick(s).o, 'short'); }
  if (!out.length) for (const o of rng.shuffle(pool.slice())) if (push(o, 'even')) break;
  return out;
}
export function purseFor(world, f, offer) {
  const t = TIERS[f.tier];
  const r = rankOf(world, f.id);
  let mult = 1 + f.hype / 120 + f.pop / 90;
  if (r === 0) mult *= 2.6; else if (r && r <= 5) mult *= 1.6; else if (r) mult *= 1.25;
  if (offer.title) mult *= 1.8; if (offer.type === 'superfight') mult *= 1.5; if (offer.short) mult *= 1.4;
  if (offer.reason === 'grudge') mult *= 1.4;
  return { show: Math.round(t.basePurse * mult / 500) * 500, win: Math.round(t.winBonus * mult / 500) * 500 };
}
export { canBook, series, pairKey };
