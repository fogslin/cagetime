// Living world: divisions, tiers, rankings, AI vs AI fights, prospects, retirements.
import { DIVISIONS, TIERS, adjacentDivs, CITIES } from './data.js';
import { genFighter, ovr, ageOneYear, retireChance, fullName, TIER_BASE } from './fighter.js';
import { quickFight } from './fight.js';
import { canBook, pairKey, series } from './rematch.js';
import { makeRng, clamp } from './rng.js';

export function rngFor(world) { const r = makeRng(1); r.setState(world.rs); return r; }
export function saveRng(world, r) { world.rs = r.state(); }

export function createWorld({ seed = Date.now() % 1e9, gender = 'm', divs } = {}) {
  const rng = makeRng(seed);
  const list = divs || DIVISIONS.filter(d => gender === 'all' || d.g === gender).map(d => d.id);
  const world = { v: 1, seed, rs: 0, wk: 0, nid: 1, f: {}, divs: list, div: {}, h2h: {}, heat: {}, news: [], year: [], awards: [], used: [], log: [] };
  const used = new Set();
  for (const div of list) {
    world.div[div] = { champ: null, since: 0, def: 0, lastTitle: -30, hist: [] };
    for (const t of TIERS) for (let i = 0; i < t.size; i++) addFighter(world, rng, { div, tier: t.id, used });
    // crown the best top-tier fighter
    const top = activeIn(world, div, 2).sort((a, b) => ovr(b.attrs) - ovr(a.attrs))[0];
    world.div[div].champ = top.id; top.rp += 120; top.hype = Math.max(top.hype, 70); top.pop = Math.max(top.pop, 60);
    world.div[div].hist.push({ wk: 0, id: top.id, name: fullName(top) });
  }
  world.used = [...used].slice(-1500);
  saveRng(world, rng);
  return world;
}
export function addFighter(world, rng, opts) {
  const used = opts.used || new Set(world.used);
  const id = 'f' + world.nid++;
  const f = genFighter(rng, { ...opts, used, id });
  if (!opts.used) world.used.push(f.first + ' ' + f.last);
  f.fc = f.w + f.l + f.d;
  world.f[id] = f;
  return f;
}
export const activeIn = (world, div, tier) => Object.values(world.f).filter(f => f.act && f.div === div && f.tier === tier);
export function rankings(world, div) {
  const champ = world.div[div].champ;
  return activeIn(world, div, 2).filter(f => f.id !== champ && !f.away).sort((a, b) => b.rp - a.rp).slice(0, 15).map(f => f.id);
}
export function rankOf(world, id) {
  const f = world.f[id]; if (!f) return null;
  for (const d of world.divs) if (world.div[d].champ === id) return 0;
  if (f.tier !== 2) return null;
  const r = rankings(world, f.div).indexOf(id);
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
  if (tier === 2) return (wk % 2 ? 'Stormvale Fight Night ' + (120 + (wk >> 1)) : 'Stormvale ' + (240 + (wk >> 1))) + ' · ' + city;
  return t.event + ' ' + ((tier ? 60 : 20) + Math.floor(wk / 2)) + ' · ' + city;
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
function news(world, txt, kind = '') { world.news.unshift({ wk: world.wk, txt, kind }); if (world.news.length > 80) world.news.length = 80; }
const elo = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));

// Apply a finished fight (fs from fight.js) to the world. Returns the record.
export function recordFight(world, aId, bId, fs, meta = {}) {
  const rng = rngFor(world);
  const A = world.f[aId], B = world.f[bId], res = fs.result;
  const prev = (world.h2h[pairKey(aId, bId)] || []).map(m => ({ ...m }));
  const wId = res.winner === 'A' ? aId : res.winner === 'B' ? bId : null;
  const W = wId ? world.f[wId] : null, L = wId ? (wId === aId ? B : A) : null;
  const finish = res.method === 'KO' || res.method === 'TKO' || res.method === 'SUB';
  // records
  for (const [f, side] of [[A, 'A'], [B, 'B']]) {
    f.fc = (f.fc || 0) + 1; f.lw = world.wk;
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
  // ratings
  if (A.tier === B.tier) {
    const ea = elo(A.rp, B.rp);
    const sa = wId === aId ? 1 : wId === bId ? 0 : 0.5;
    const k = 44 + (finish ? 10 : 0) + (meta.title ? 20 : 0);
    if (res.method !== 'NC') { A.rp = Math.round(A.rp + k * (sa - ea)); B.rp = Math.round(B.rp + k * ((1 - sa) - (1 - ea))); }
  }
  if (W) {
    W.hype = clamp(W.hype + 4 + (finish ? 5 : 0) + (meta.title ? 10 : 0), 0, 100); W.pop = clamp(W.pop + 2 + (finish ? 2 : 0) + (meta.title ? 6 : 0), 0, 100);
    L.hype = clamp(L.hype - 6, 0, 100);
  }
  // per-manager tallies (GM mode season awards)
  if (world.mt) for (const f of [A, B]) if (f.mgr) { const t = world.mt[f.mgr] = world.mt[f.mgr] || { w: 0, l: 0, t: 0, t2: 0 }; if (f.id === wId) { t.w++; if (f.tier === 2) t.t2++; if (meta.title && world.div[meta.div].champ !== wId) t.t++; } else if (wId) t.l++; }
  // h2h + heat
  const key = pairKey(aId, bId);
  const entry = { wk: world.wk, m: res.method, fc: key.startsWith(aId + '|') ? [A.fc, B.fc] : [B.fc, A.fc] };
  if (wId) entry.w = wId; if (res.close) entry.close = 1; if (res.contro) entry.contro = 1; if (meta.title) entry.title = 1;
  (world.h2h[key] = world.h2h[key] || []).push(entry);
  const h = Math.round(clamp((world.heat[key] || 0) * 0.6 + (res.contro ? 30 : 0) + (meta.heat || 0), 0, 100));
  if (h >= 5) world.heat[key] = h; else delete world.heat[key];
  // titles
  let titleNote = '';
  if (meta.title) {
    const D = world.div[meta.div];
    D.lastTitle = world.wk;
    if (wId && D.champ !== wId) {
      titleNote = D.champ ? 'new' : 'vacant';
      D.champ = wId; D.since = world.wk; D.def = 0; D.hist.push({ wk: world.wk, id: wId, name: fullName(W) });
      news(world, `👑 ${fullName(W)} wins the ${divName(meta.div)} title${titleNote === 'new' ? ' and dethrones ' + fullName(L) : ''}!`, 'title');
    } else if (wId) { D.def++; titleNote = 'defense'; news(world, `🏆 ${fullName(W)} defends the ${divName(meta.div)} title against ${fullName(L)}.`, 'title'); }
  } else if (W && A.tier === 2 && B.tier === 2 && L.rp - W.rp > 120) news(world, `⚡ Upset! ${fullName(W)} beats ${fullName(L)} by ${res.method === 'DEC' ? 'decision' : res.method}.`, 'upset');
  const rec = { wk: world.wk, a: aId, b: bId, w: wId, m: res.method, det: res.detail, r: res.round, t: res.time, title: !!meta.title, reason: meta.reason || null, ctx: meta.ctx || null, prev, div: meta.div, ev: meta.ev || eventName(world, A.tier), tier: A.tier, titleNote, an: fullName(A), bn: fullName(B), up: W ? Math.round(L.rp - W.rp) : 0 };
  world.year.push({ a: aId, b: bId, w: wId, m: res.method, title: rec.title, div: meta.div, up: rec.up, kd: fs.A.st.kd + fs.B.st.kd, sig: fs.A.st.sig + fs.B.st.sig, close: entry.close, an: rec.an, bn: rec.bn, r: res.round, tier: A.tier });
  if (world.log) { world.log.push(rec); if (world.log.length > (world.logMax || 60)) world.log.shift(); }
  saveRng(world, rng);
  return rec;
}
export const divName = (id) => (DIVISIONS.find(d => d.id === id) || {}).name || id;

function aiFight(world, rng, a, b, meta) {
  const fs = quickFight(a, b, { rng, rounds: meta.title ? 5 : 3, title: meta.title });
  saveRng(world, rng);
  const rec = recordFight(world, a.id, b.id, fs, meta);
  rng.setState(world.rs);
  if (world.onAiFight) world.onAiFight(rec, fs);
  return rec;
}
const free = (world, f) => f.act && !f.lock && !f.bk && f.avail <= world.wk && !f.away;

export function advanceWeek(world) {
  const rng = rngFor(world);
  world.wk++;
  for (const div of world.divs) {
    const D = world.div[div];
    for (let tier = 0; tier < 3; tier++) {
      const pool = activeIn(world, div, tier).filter(f => free(world, f)).sort((x, y) => y.rp - x.rp);
      const taken = new Set();
      if (tier === 2) {
        const champ = D.champ ? world.f[D.champ] : null;
        if (champ && !champ.act) { D.champ = null; }
        // hold the champion for a hot player-controlled contender (career player / GM client) for a while
        if (D.champ && !(D.resv > world.wk)) {
          const rk = rankings(world, div).slice(0, 3).map(id => world.f[id]);
          const hot = rk.find(f => f.lock && f.streak >= 1 && !f.bk);
          if (hot && D.resvFor !== hot.id + ':' + hot.fc) { D.resv = world.wk + 10; D.resvFor = hot.id + ':' + hot.fc; }
        }
        if (D.champ && free(world, champ) && world.wk - D.lastTitle >= 16 && !(D.resv > world.wk) && rng.chance(0.5)) {
          const ranks = rankings(world, div);
          for (let i = 0; i < Math.min(6, ranks.length); i++) {
            const c = world.f[ranks[i]];
            if (!free(world, c)) continue;
            const bc = bookCheck(world, champ.id, c.id, { title: true, champ: champ.id, challengerRank: i + 1 });
            if (bc.ok) { taken.add(champ.id); taken.add(c.id); aiFight(world, rng, champ, c, { title: true, div, reason: bc.reason, ctx: bc.ctx }); break; }
          }
        } else if (!D.champ) {
          const ranks = rankings(world, div).map(id => world.f[id]).filter(f => free(world, f));
          outer: for (let i = 0; i < Math.min(4, ranks.length); i++) for (let j = i + 1; j < Math.min(5, ranks.length); j++) {
            const bc = bookCheck(world, ranks[i].id, ranks[j].id, { title: true, champ: null });
            if (bc.ok) { taken.add(ranks[i].id); taken.add(ranks[j].id); news(world, `Vacant ${divName(div)} title: ${fullName(ranks[i])} vs ${fullName(ranks[j])}.`, 'title'); aiFight(world, rng, ranks[i], ranks[j], { title: true, div, reason: bc.reason, ctx: bc.ctx }); break outer; }
          }
        }
      }
      for (let i = 0; i < pool.length; i++) {
        const a = pool[i];
        if (taken.has(a.id) || a.id === D.champ || !rng.chance(0.4)) continue;
        for (let j = i + 1; j < Math.min(pool.length, i + 7); j++) {
          const b = pool[j];
          if (taken.has(b.id) || b.id === D.champ) continue;
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
  if (world.wk % 52 === 0) yearly(world, rng);
  if (world.wk % 4 === 0) for (const k in world.heat) { world.heat[k] = Math.round(world.heat[k] * 0.97); if (world.heat[k] < 5) delete world.heat[k]; }
  saveRng(world, rng);
}
function move(world, f, tier, why) {
  const old = f.tier; f.tier = tier;
  f.rp = Math.round(1000 + (ovr(f.attrs) - TIER_BASE[tier]) * 8 + (tier > old ? 20 : -20));
  f.streak = 0;
  if (tier === 2 && tier > old && why) news(world, `✍️ ${fullName(f)} (${f.w}-${f.l}) signs with Stormvale ${why}.`, 'sign');
}
function monthly(world, rng) {
  for (const div of world.divs) {
    for (let t = 0; t < 2; t++) {
      const lower = activeIn(world, div, t).filter(f => !f.lock).sort((a, b) => b.rp - a.rp);
      const upper = activeIn(world, div, t + 1);
      let slots = TIERS[t + 1].size + 2 - upper.length;
      for (const f of lower) {
        if (slots <= 0) break;
        const hot = f.streak >= 3 || (f.streak >= 2 && lower.indexOf(f) < 3);
        if (hot || (upper.length < TIERS[t + 1].size - 2 && lower.indexOf(f) < 2)) { move(world, f, t + 1, 'after a ' + Math.max(f.streak, 1) + '-fight win streak'); slots--; }
      }
    }
    for (let t = 2; t > 0; t--) {
      const list = activeIn(world, div, t).filter(f => !f.lock && world.div[div].champ !== f.id).sort((a, b) => a.rp - b.rp);
      let excess = list.length - TIERS[t].size;
      for (const f of list) {
        const losing = f.recent.slice(-3).join('') === 'LLL' || (f.recent.slice(-4).filter(r => r === 'L').length >= 3);
        if (losing || (excess > 3 && f.streak < 0)) { move(world, f, t - 1); excess--; if (t === 2) news(world, `${fullName(f)} is released by Stormvale after a rough run.`, 'cut'); }
      }
    }
    const t0 = activeIn(world, div, 0).length;
    for (let i = t0; i < TIERS[0].size; i++) addFighter(world, rng, { div, tier: 0, age: rng.int(19, 24) });
  }
}
function yearly(world, rng) {
  const protect = new Set(world.protect || []);
  awards(world);
  for (const f of Object.values(world.f)) {
    if (!f.act) continue;
    if (!f.lock) ageOneYear(rng, f);
    if (!f.lock && rng() < retireChance(f) * (Object.values(world.div).some(d => d.champ === f.id) ? 0.4 : 1)) {
      f.act = 0; f.retWk = world.wk;
      for (const d of world.divs) if (world.div[d].champ === f.id) { world.div[d].champ = null; news(world, `${fullName(f)} retires as ${divName(d)} champion. The title is vacant.`, 'title'); }
      if (f.tier === 2 && (f.w > 15 || f.hype > 60)) news(world, `👋 ${fullName(f)} (${f.w}-${f.l}) announces retirement.`, 'ret');
    } else if (!f.lock && f.tier >= 1 && rng() < 0.035) {
      const adj = adjacentDivs(f.div); const to = (f.age > 30 ? adj.up : rng.chance(0.5) ? adj.down : adj.up) || adj.up || adj.down;
      if (to && world.div[to] && world.div[f.div].champ !== f.id) { if (f.tier === 2) news(world, `↕️ ${fullName(f)} moves to ${divName(to)}.`, 'move'); f.div = to; f.rp -= 40; }
    }
  }
  // fresh blood: new prospects every year, some blue-chippers straight into the middle tier
  for (const div of world.divs) {
    for (let i = 0; i < 4; i++) addFighter(world, rng, { div, tier: 0, age: rng.int(19, 23) });
    if (rng.chance(0.6)) { const f = addFighter(world, rng, { div, tier: 1, age: rng.int(21, 24) }); f.pot = clamp(f.pot + 8, 0, 97); }
  }
  // prune retired fighters nobody needs any more
  const keep = protect;
  for (const id in world.f) { const f = world.f[id]; if (!f.act && !keep.has(id) && world.wk - f.retWk > 0) delete world.f[id]; }
  for (const k in world.h2h) { const [a, b] = k.split('|'); if (!keep.has(a) && !keep.has(b) && (!world.f[a] || !world.f[b])) delete world.h2h[k]; }
  if (world.used.length > 1500) world.used = world.used.slice(-1500);
}
function awards(world) {
  const y = world.year; world.year = [];
  if (!y.length) return;
  const yr = 2026 + Math.round(world.wk / 52);
  const wins = {};
  for (const r of y) if (r.w && r.tier === 2) wins[r.w] = (wins[r.w] || 0) + 1 + (r.title ? 2 : 0) + (r.m !== 'DEC' ? 0.5 : 0);
  const foy = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  const top = y.filter(r => r.tier === 2);
  const ko = top.filter(r => r.m === 'KO').sort((a, b) => (b.up + (b.title ? 200 : 0)) - (a.up + (a.title ? 200 : 0)))[0];
  const fotn = top.slice().sort((a, b) => (b.kd * 30 + b.sig + (b.close ? 40 : 0) + b.r * 10) - (a.kd * 30 + a.sig + (a.close ? 40 : 0) + a.r * 10))[0];
  const upset = top.filter(r => r.w).sort((a, b) => b.up - a.up)[0];
  const nm = (id) => world.f[id] ? fullName(world.f[id]) : '—';
  const a = { year: yr, foy: foy ? { id: foy[0], name: nm(foy[0]) } : null, koy: ko ? { id: ko.w, name: nm(ko.w), txt: `${ko.an} vs ${ko.bn}` } : null, fotn: fotn ? { txt: `${fotn.an} vs ${fotn.bn}` } : null, upset: upset ? { id: upset.w, name: nm(upset.w), txt: `${upset.an} vs ${upset.bn}` } : null };
  world.awards.unshift(a); if (world.awards.length > 30) world.awards.length = 30;
  if (world.onAwards) world.onAwards(a, y);
}

// Fight offers for a locked fighter (the career player or a GM client).
export function offersFor(world, id, { n = 3, rng, champBelts = [] } = {}) {
  const f = world.f[id]; const out = [];
  const tier = f.tier;
  const pool = activeIn(world, f.div, tier).filter(o => o.id !== id && !o.lock && !o.bk && o.avail <= world.wk + 6 && !o.away).sort((a, b) => b.rp - a.rp);
  const all = activeIn(world, f.div, tier).sort((a, b) => b.rp - a.rp);
  const me = all.findIndex(o => o.id === id);
  const D = world.div[f.div];
  const myRank = rankOf(world, id);
  const used = new Set();
  const push = (o, type, extra = {}) => {
    if (used.has(o.id)) return false;
    const bc = bookCheck(world, id, o.id, extra);
    if (!bc.ok) return false;
    used.add(o.id);
    out.push({ opp: o.id, type, title: !!extra.title, div: extra.div || f.div, reason: bc.reason, ctx: bc.ctx, weeks: type === 'short' ? rng.int(2, 3) : rng.int(6, 10), short: type === 'short' });
    return true;
  };
  // title shots / defenses
  if (tier === 2) {
    for (const bd of champBelts.length ? champBelts : (D.champ === id ? [f.div] : [])) {
      const ranks = rankings(world, bd).map(x => world.f[x]).filter(o => pool.includes(o) || (o.div === bd && o.act && !o.lock && !o.bk && o.avail <= world.wk + 6));
      for (let i = 0; i < Math.min(6, ranks.length); i++) if (push(ranks[i], 'defense', { title: true, champ: id, challengerRank: i + 1, div: bd })) break;
    }
    if (D.champ !== id && myRank && ((myRank <= 5 && f.streak >= 3) || (myRank <= 3 && f.streak >= 1) || myRank === 1)) {
      const c = D.champ && world.f[D.champ];
      if (c && !c.lock && !c.bk && c.avail <= world.wk + 8) push(c, 'title', { title: true, champ: c.id, challengerRank: myRank });
      else if (!D.champ) { const r = rankings(world, f.div).map(x => world.f[x]).find(o => o.id !== id && pool.includes(o)); if (r) push(r, 'title', { title: true, champ: null }); }
    }
    // double-champ superfight
    if (D.champ === id) {
      const adj = adjacentDivs(f.div);
      for (const d2 of [adj.up, adj.down]) {
        if (!d2 || !world.div[d2]) continue;
        const c2 = world.div[d2].champ && world.f[world.div[d2].champ];
        if (c2 && !c2.lock && !c2.bk && c2.avail <= world.wk + 8 && rng.chance(0.5)) push(c2, 'superfight', { title: true, champ: c2.id, challengerRank: 1, div: d2 });
      }
    }
  }
  // rematches with a narrative reason
  for (const k in world.h2h) {
    if (out.length >= n + 1) break;
    if (!k.split('|').includes(id)) continue;
    const oid = k.split('|').find(x => x !== id); const o = world.f[oid];
    if (!o || !pool.includes(o)) continue;
    const bc = bookCheck(world, id, oid);
    if (bc.ok && bc.reason) push(o, 'rematch');
  }
  // regular fights near my standing, one step-up, one short-notice
  const cand = pool.map(o => ({ o, d: all.indexOf(o) - me })).filter(x => Math.abs(x.d) <= 8);
  rng.shuffle(cand);
  const up = cand.filter(x => x.d < 0).sort((a, b) => a.d - b.d);
  if (up.length) push(rng.pick(up.slice(0, 4)).o, 'step-up');
  for (const x of cand) { if (out.length >= n) break; push(x.o, Math.abs(x.d) <= 2 ? 'even' : x.d > 0 ? 'tune-up' : 'step-up'); }
  if (rng.chance(0.35)) { const s = cand.filter(x => x.d < 3 && !used.has(x.o.id)); if (s.length) push(rng.pick(s).o, 'short'); }
  if (!out.length) {
    // fall back to any legal opponent in the division (never a dead end)
    for (const o of rng.shuffle(pool.slice())) if (push(o, 'even')) break;
  }
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
