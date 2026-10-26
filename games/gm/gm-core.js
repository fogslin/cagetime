// GM Mode game logic (no DOM). Shared world + fight engine + rematch rules.
import { TIERS, TOP, MAX_BELTS, GYMS, DIVISIONS, STRAT_KEYS, adjacentDivs, weekLabel } from '../shared/data.js?v=20261026a';
import { createWorld, advanceWeek, offersFor, recordFight, rankOf, rankings, tierStanding, eventName, bookCheck, rngFor, saveRng, divName, activeIn, addFighter, beltsOf, isChamp, capOk, capInfo, defenseConflict, undefended, vacate, moveFighter, touch, hasDiv, upOptions, downOptions, qualifies, news, yearOf } from '../shared/world.js?v=20261026a';
import { quickFight, aiStrategy, methodLabel } from '../shared/fight.js?v=20261026a';
import { ovr, ageOneYear, fullName, recStr } from '../shared/fighter.js?v=20261026a';
import { series, pairKey, REASONS } from '../shared/rematch.js?v=20261026a';
import { clamp } from '../shared/rng.js?v=20261026a';

export const RIVALS = [
  { id: 'r1', name: 'Kessler & Vane Management', short: 'Kessler & Vane', col: '#6aa8ff' },
  { id: 'r2', name: 'Ironsight Sports Group', short: 'Ironsight', col: '#46d39a' },
  { id: 'r3', name: 'Redline Fight Agency', short: 'Redline', col: '#ff8a3d' },
  { id: 'r4', name: 'Mosaic Athlete Partners', short: 'Mosaic', col: '#b06cff' },
];
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const R = (save) => rngFor(save.world);
export const clients = (save) => save.g.clients.map(id => save.world.f[id]).filter(Boolean);
function log(save, txt, kind = '') { save.g.log.unshift({ wk: save.world.wk, txt, kind }); if (save.g.log.length > 80) save.g.log.length = 80; }

export function newGM({ name = 'Your Agency', seed } = {}) {
  seed = seed ?? Math.floor(Math.random() * 1e9);
  const world = createWorld({ seed, gender: 'all' });
  world.logMax = 20;
  const r = rngFor(world);
  const g = {
    name, money: 60000, rep: 12, clients: [], pool: [], offers: [], events: [], fights: [], log: [], trophies: [], seasons: [],
    rivals: RIVALS.map(x => ({ ...x, rep: r.int(25, 55), heat: r.int(0, 20) })), season: { wins: 0, losses: 0, titles: 0, earned: 0, fights: 0 },
    seenAwards: 0, started: Date.now(), nextOfferWk: 0, totalEarned: 0, beltsWon: 0,
  };
  // rivals manage a slice of the existing world
  for (const f of Object.values(world.f)) if (r.chance(0.28)) f.mgr = r.pick(RIVALS).id;
  saveRng(world, r);
  const save = { v: 2, world, g };
  world.protect = [];
  world.mt = {};
  // two starter clients: a decent regional prospect and a raw kid
  const vet = activeIn(world, 'LW', 1).filter(f => !f.mgr && f.age <= 29).sort((a, b) => ovr(b.attrs) - ovr(a.attrs))[3];
  const kid = activeIn(world, 'WFLW', 0).filter(f => !f.mgr).sort((a, b) => (b.pot - ovr(b.attrs)) - (a.pot - ovr(a.attrs)))[0];
  sign(save, vet.id, 20, 0, true);
  sign(save, kid.id, 20, 0, true);
  refreshPool(save);
  weeklyOffers(save, true);
  log(save, `${name} opens its doors with two fighters and ${fmt(g.money)} in the bank.`);
  return save;
}
function sign(save, id, cut, bonus, force) {
  const f = save.world.f[id], g = save.g;
  f.lock = 1; f.mgr = 'you'; f.mc = { wk: save.world.wk + 104, cut }; f.mor = 70; f.loy = 60; f.gym = 'garage'; f.plan = 'auto'; f.bk = null; f.scout = 3;
  g.money -= bonus;
  if (!g.clients.includes(id)) g.clients.push(id);
  save.world.protect = g.clients.slice();
  g.pool = g.pool.filter(p => p.id !== id);
  if (!force) log(save, `✍️ Signed ${fullName(f)} (${recStr(f)}) at a ${cut}% cut${bonus ? ' with a ' + fmt(bonus) + ' signing bonus' : ''}.`, 'good');
}
// ---- scouting ----
export function refreshPool(save) {
  const w = save.world, g = save.g, r = R(save);
  g.pool = g.pool.filter(p => w.f[p.id] && w.f[p.id].act && !w.f[p.id].lock);
  const cand = Object.values(w.f).filter(f => f.act && !f.lock && !f.mgr && TIERS[f.tier].lvl <= 1 && f.age <= 27 && !g.pool.some(p => p.id === f.id));
  r.shuffle(cand);
  while (g.pool.length < 8 && cand.length) { const f = cand.pop(); g.pool.push({ id: f.id, lv: 0, interest: r.chance(0.35) ? r.pick(RIVALS).id : null, noise: r.int(-12, 12) }); }
  // a couple of established free agents in the big league (pricey, but a faster road to gold)
  if (!g.pool.some(p => w.f[p.id] && TIERS[w.f[p.id].tier].lvl === 2)) {
    const fa = Object.values(w.f).filter(f => f.act && !f.lock && !f.mgr && TIERS[f.tier].lvl === 2 && f.age <= 32 && !g.pool.some(p => p.id === f.id) && !isChamp(w, f.id));
    r.shuffle(fa); for (const f of fa.slice(0, 2)) g.pool.push({ id: f.id, lv: 1, interest: r.chance(0.5) ? r.pick(RIVALS).id : null, noise: r.int(-6, 6), fa: 1 });
  }
  saveRng(w, r);
}
export function potEstimate(save, p) {
  const f = save.world.f[p.id];
  const spread = [14, 8, 4, 1][p.lv];
  const mid = clamp(f.pot + Math.round(p.noise * [1, 0.5, 0.2, 0][p.lv]), 30, 99);
  return { lo: clamp(mid - spread, 30, 99), hi: clamp(mid + spread, 30, 99), ovr: ovr(f.attrs) + (p.lv ? 0 : Math.round(p.noise / 3)) };
}
export const SCOUT_COST = [1500, 3000, 6000];
export function scout(save, id) {
  const p = save.g.pool.find(x => x.id === id); if (!p || p.lv >= 3) return 'Fully scouted.';
  const cost = SCOUT_COST[p.lv]; if (save.g.money < cost) return 'Not enough money to scout.';
  save.g.money -= cost; p.lv++;
  const e = potEstimate(save, p);
  return `Scouting report: potential ${e.lo}${e.hi !== e.lo ? '–' + e.hi : ''}.`;
}
export function signChance(save, id, cut, bonus) {
  const f = save.world.f[id], g = save.g, p = g.pool.find(x => x.id === id);
  let c = 0.45 + g.rep / 200 - (cut - 15) * 0.03 + bonus / (4000 + TIERS[f.tier].lvl * 12000 + f.tier * 1000) * 0.25 - f.hype / 400;
  if (p && p.interest) c -= 0.15;
  return clamp(c, 0.03, 0.95);
}
export function trySign(save, id, cut, bonus) {
  const g = save.g, w = save.world, r = R(save);
  if (g.money < bonus) return { ok: false, msg: 'Not enough money for that bonus.' };
  if (g.clients.length >= 8) return { ok: false, msg: 'Your stable is full (8 fighters). Release someone first.' };
  const ch = signChance(save, id, cut, bonus);
  const ok = r.chance(ch); saveRng(w, r);
  const p = g.pool.find(x => x.id === id); const f = w.f[id];
  if (ok) { sign(save, id, cut, bonus); return { ok: true, msg: `${fullName(f)} signs with ${g.name}!` }; }
  if (p && p.interest) { const rv = g.rivals.find(x => x.id === p.interest); f.mgr = rv.id; rv.heat = clamp(rv.heat + 10, 0, 100); g.pool = g.pool.filter(x => x.id !== id); return { ok: false, msg: `${fullName(f)} signs with ${rv.name} instead.` }; }
  return { ok: false, msg: `${fullName(f)} turns you down. Maybe sweeten the deal.` };
}
// ---- offers & bookings ----
function purse(save, f, of) {
  const T = TIERS[f.tier];
  let m = 1 + f.hype / 130 + f.pop / 150;
  const rk = rankOf(save.world, f.id);
  if (rk === 0) m *= 2.4; else if (rk && rk <= 5) m *= 1.5; else if (rk) m *= 1.2;
  if (of.title) m *= 1.8; if (of.short) m *= 1.4; if (of.reason === 'grudge' || of.stable) m *= 1.3; if (of.reason === 'trilogy') m *= 1.25;
  return { show: Math.round(T.basePurse * m / 500) * 500, win: Math.round(T.winBonus * m / 500) * 500 };
}
export function weeklyOffers(save, force) {
  const w = save.world, g = save.g, r = R(save);
  g.offers = g.offers.filter(o => o.exp >= w.wk && w.f[o.opp] && !w.f[o.opp].bk && w.f[o.fid] && !w.f[o.fid].bk);
  for (const f of clients(save)) {
    if (f.bk || f.inj > 0 || !f.act || !capOk(w, f)) continue;
    if (g.offers.some(o => o.fid === f.id)) continue;
    const idle = w.wk - f.lw;
    if (!force && idle < 5) continue;
    if (!force && !r.chance(0.35 + Math.min(0.4, idle / 60))) continue;
    saveRng(w, r);
    const list = offersFor(w, f.id, { n: 2, rng: r }).slice(0, 2);
    for (const of of list) {
      const o = w.f[of.opp];
      of.stable = o.mgr && o.mgr !== 'you' ? o.mgr : null;
      Object.assign(of, purse(save, f, of), { fid: f.id, exp: w.wk + 2, id: 'o' + w.wk + '_' + f.id + '_' + of.opp });
      g.offers.push(of);
    }
  }
  saveRng(w, r);
}
// belt rules for a client: max 2 belts, and a second defense needs the other belt defended this year
export function offerNeeds(save, oid) {
  const w = save.world, of = save.g.offers.find(o => o.id === oid); if (!of || !of.title) return null;
  const f = w.f[of.fid]; const mine = beltsOf(w, f.id).filter(b => b.pid === f.tier).map(b => b.div);
  let v = of.vacate || null;
  if (!v && mine.includes(of.div)) { const cf = defenseConflict(w, f.id, f.tier, of.div); if (cf) v = cf.div; }
  if (!v && !mine.includes(of.div) && mine.length >= MAX_BELTS) v = mine.find(d => d !== of.div);
  if (!v) return null;
  return { vacate: v, text: mine.includes(of.div) ? `Defending ${f.last}'s ${divName(of.div)} title again means vacating the ${divName(v)} title (a double champ defends each belt once a year).` : `${f.last} can hold at most ${MAX_BELTS} belts. Fighting for the ${divName(of.div)} title means vacating the ${divName(v)} title first.` };
}
export function acceptOffer(save, oid, ask = 0, { confirmVacate = false } = {}) {
  const g = save.g, w = save.world, r = R(save);
  const of = g.offers.find(o => o.id === oid); if (!of) return { ok: false, msg: 'Offer expired.' };
  const f = w.f[of.fid], o = w.f[of.opp];
  if (!o || o.bk || !o.act || f.bk || !capOk(w, f)) { g.offers = g.offers.filter(x => x !== of); return { ok: false, msg: 'That fight fell through.' }; }
  const need = offerNeeds(save, oid);
  if (need && !confirmVacate) return { ok: false, needVacate: need.vacate, msg: need.text };
  if (need) { vacate(w, f.tier, need.vacate, `{name} vacates the {promo} ${divName(need.vacate)} title.`); log(save, `${f.last} vacates the ${divName(need.vacate)} title.`, 'bad'); }
  if (ask) {
    const p = clamp(0.35 + g.rep / 200 + f.hype / 300 - (ask - 1) * 0.25, 0.05, 0.9);
    if (!r.chance(p)) {
      saveRng(w, r);
      if (r.chance(0.4)) { g.offers = g.offers.filter(x => x !== of); return { ok: false, msg: `The promotion pulls the offer. ${f.last} is not thrilled.`, mor: -5 }; }
      return { ok: false, msg: 'They refuse to raise it. The offer stands.' };
    }
    const m = ask === 1 ? 1.2 : 1.45; of.show = Math.round(of.show * m / 500) * 500; of.win = Math.round(of.win * m / 500) * 500;
  }
  saveRng(w, r);
  f.bk = o.id; o.bk = f.id;
  const wk = w.wk + of.weeks;
  g.bookings = g.bookings || [];
  const ci = capInfo(w, f);
  g.bookings.push({ ...of, cap: { n: ci.n, cap: ci.cap }, wk, ev: eventName(w, f.tier, wk) });
  g.offers = g.offers.filter(x => x.fid !== f.id);
  f.mor = clamp(f.mor + (of.title ? 10 : 3), 0, 100);
  return { ok: true, msg: `Booked: ${fullName(f)} vs ${fullName(o)}, ${weekLabel(wk)}${ask ? ` at ${fmt(of.show)} + ${fmt(of.win)}` : ''}.` };
}
export function declineOffer(save, oid) {
  const g = save.g, of = g.offers.find(o => o.id === oid); if (!of) return '';
  const f = save.world.f[of.fid];
  g.offers = g.offers.filter(x => x !== of);
  const hit = of.title ? 15 : of.type === 'step-up' ? 4 : 2;
  f.mor = clamp(f.mor - hit, 0, 100);
  return of.title ? `${f.last} is furious you turned down a title shot.` : `Declined. ${f.last}'s morale dips a little.`;
}
// request a specific fight for a client
export function fightTargets(save, fid) {
  const w = save.world, f = w.f[fid];
  const all = activeIn(w, f.div, f.tier).sort((a, b) => b.rp - a.rp);
  const me = all.indexOf(f);
  return all.filter((o, i) => o.id !== fid && Math.abs(i - me) <= 6).map(o => {
    const bc = bookCheck(w, fid, o.id);
    const busy = o.bk || o.lock || o.avail > w.wk + 6 || !capOk(w, o, w.wk + 8) || !capOk(w, f);
    return { o, ok: bc.ok && !busy, why: !capOk(w, f) ? 'Yearly fight limit reached' : busy ? 'Not available' : bc.ok ? (bc.reason ? REASONS[bc.reason].label : 'Available') : bc.why, reason: bc.reason, ctx: bc.ctx, gap: all.indexOf(o) - me };
  });
}
export function requestFight(save, fid, oid) {
  const w = save.world, g = save.g, r = R(save), f = w.f[fid];
  const t = fightTargets(save, fid).find(x => x.o.id === oid);
  if (!t || !t.ok) return { ok: false, msg: t ? t.why : 'Not possible.' };
  const p = clamp(0.55 + g.rep / 250 + (t.gap > 0 ? 0.2 : t.gap * 0.06) + (t.reason ? 0.1 : 0), 0.1, 0.95);
  const ok = r.chance(p); saveRng(w, r);
  if (!ok) return { ok: false, msg: `The matchmaker passes on ${fullName(f)} vs ${fullName(t.o)} for now.` };
  const of = { opp: oid, type: 'request', title: false, pid: f.tier, div: f.div, reason: t.reason, ctx: t.ctx, weeks: 8, short: false, fid, exp: w.wk + 2, id: 'rq' + w.wk + fid };
  of.stable = t.o.mgr && t.o.mgr !== 'you' ? t.o.mgr : null;
  Object.assign(of, purse(save, f, of));
  g.offers.push(of);
  return acceptOffer(save, of.id);
}
// ---- the weekly loop ----
export function advance(save) {
  const w = save.world, g = save.g;
  const out = { results: [], events: [] };
  const r0 = R(save);
  advanceWeek(w);
  // client fights this week
  g.bookings = g.bookings || [];
  for (const b of g.bookings.filter(b => b.wk <= w.wk)) {
    g.bookings = g.bookings.filter(x => x !== b);
    const f = w.f[b.fid], o = w.f[b.opp];
    if (!f || !o || !o.act) { if (f) f.bk = null; continue; }
    out.results.push(runClientFight(save, b));
  }
  // morale, activity, injuries, contracts
  const r = R(save);
  let overhead = 400 + g.clients.length * 120;
  g.money -= overhead;
  for (const f of clients(save)) {
    if (f.inj > 0) f.inj--;
    const idle = w.wk - f.lw;
    if (!f.bk && idle > 18) f.mor = clamp(f.mor - 1.5, 0, 100);
    f.loy = clamp(f.loy + (f.mor - 55) / 60, 0, 100);
    if (f.mc.wk - w.wk === 8) out.events.push(addEvent(save, { k: 'expiring', fid: f.id }));
    if (f.mc.wk <= w.wk) out.events.push(contractEnd(save, f));
  }
  if (g.money < -40000) { g.money += 75000; g.rep = clamp(g.rep - 6, 0, 100); log(save, '🏦 An investor bails the agency out with $75,000, but your reputation takes a hit.', 'bad'); out.events.push(addEvent(save, { k: 'bailout' })); }
  if (w.wk % 52 === 0) yearEnd(save, out);
  if (w.wk % 3 === 0) refreshPool(save);
  saveRng(w, r);
  randomEvents(save, out);
  weeklyOffers(save);
  promotions(save, out);
  out.events = out.events.filter(Boolean);
  return out;
}
const PLAN_NAMES = { auto: 'Let the corner decide', pressure: 'Pressure', counter: 'Counter', wrestle: 'Wrestle', finish: 'Go for the finish', safe: 'Play it safe' };
export { PLAN_NAMES };
function runClientFight(save, b) {
  const w = save.world, g = save.g, r = R(save);
  const f = w.f[b.fid], o = w.f[b.opp];
  const gym = GYMS.find(x => x.id === f.gym) || GYMS[0];
  const camp = Math.min(gym.cost * (b.short ? 0.5 : 1), Math.max(0, g.money));
  g.money -= camp;
  const rounds = b.title ? 5 : 3;
  const stratA = f.plan && f.plan !== 'auto' ? (fs) => (r.chance(0.7) ? f.plan : aiStrategy(fs, fs.A, fs.B)) : null;
  // camp quality and morale matter: an elite camp and a happy fighter show up sharper
  const edge = Math.round((camp >= gym.cost ? (gym.q - 1) * 1.3 : 0) + (f.mor - 50) / 15);
  const add = {}; for (const k in f.attrs) add[k] = edge;
  b.edge = edge;
  const fs = quickFight(f, o, { rng: r, rounds, title: b.title, verbose: true, modsA: { plan: gym.q * 0.35, gasStart: b.short ? 0.9 : 1, add }, modsB: { plan: o.mgr ? 0.6 : 0.3 }, stratA });
  saveRng(w, r);
  const prev = (w.h2h[pairKey(f.id, o.id)] || []).map(x => ({ ...x }));
  const rankBefore = rankOf(w, o.id);
  const rec = recordFight(w, f.id, o.id, fs, { title: b.title, div: b.div, pid: f.tier, reason: b.reason, ctx: b.ctx, ev: b.ev, heat: b.stable ? 5 : 0 });
  const res = fs.result, won = res.winner === 'A';
  const fin = ['KO', 'TKO', 'SUB'].includes(res.method);
  const purseTot = b.show + (won ? b.win : 0) + (won && fin && r.chance(0.5) ? TIERS[f.tier].bonus : 0);
  const cut = Math.round(purseTot * f.mc.cut / 100);
  g.money += cut; g.totalEarned += cut; g.season.earned += cut; g.season.fights++;
  if (won) g.season.wins++; else if (res.winner) g.season.losses++;
  f.mor = clamp(f.mor + (won ? 8 : -8) + (fin && won ? 4 : 0) + (camp > 0 ? 2 : 0), 0, 100);
  // growth from the camp
  if (f.age <= 30) for (const k in f.attrs) if (r.chance(0.3 + gym.q * 0.08)) f.attrs[k] = clamp(f.attrs[k] + (ovr(f.attrs) < f.pot ? 1 : 0), 20, 99);
  g.rep = clamp(g.rep + (won ? 0.35 + (b.title ? 4 : 0) + (TIERS[f.tier].lvl * 0.3) + (f.tier === TOP ? 0.2 : 0) : -0.4), 0, 100);
  if (rec.titleNote === 'new' || rec.titleNote === 'vacant') { g.season.titles++; g.beltsWon++; g.trophies.unshift({ wk: w.wk, txt: `${fullName(f)} wins the ${TIERS[f.tier].short} ${divName(b.div)} title`, kind: 'belt' }); }
  if (b.stable && won) { const rv = g.rivals.find(x => x.id === b.stable); if (rv) { rv.rep = clamp(rv.rep - 1, 0, 100); rv.heat = clamp(rv.heat + 8, 0, 100); } }
  const highlight = highlightOf(fs, f, o);
  const entry = { cap: b.cap, pid: f.tier, div: b.div, edge: b.edge, id: 'x' + w.wk + f.id, wk: w.wk, fid: f.id, fn: fullName(f), on: fullName(o), oc: o.cc, res: won ? 'W' : res.winner ? 'L' : res.method === 'NC' ? 'NC' : 'D', m: methodLabel(res), r: res.round, t: res.time, title: b.title, tn: rec.titleNote, reason: b.reason, ev: b.ev, cut, highlight, log: fs.roundLogs.map(l => l.map(x => [x.t, x.txt, x.cls])), cards: res.totals || null, prev, ctx: b.ctx, opp: o.id, orank: rankBefore };
  g.fights.unshift(entry); if (g.fights.length > 14) { for (const x of g.fights.slice(10)) x.log = null; g.fights.length = Math.min(g.fights.length, 40); }
  log(save, `${entry.res === 'W' ? '✅' : entry.res === 'L' ? '❌' : '➖'} ${f.last} ${entry.res === 'W' ? 'def.' : entry.res === 'L' ? 'lost to' : 'vs'} ${o.last}: ${entry.m}, R${res.round}. Your cut: ${fmt(cut)}.`, entry.res === 'W' ? 'good' : 'bad');
  return entry;
}
function highlightOf(fs, f, o) {
  const all = fs.roundLogs.flat();
  const big = all.filter(x => x.cls === 'big' || x.cls === 'warn' || x.cls === 'end');
  return (big.length ? big : all).slice(-3).map(x => x.txt);
}
function contractEnd(save, f) { return addEvent(save, { k: 'renew', fid: f.id }); }
function promotions(save, out) {
  const w = save.world, g = save.g;
  for (const f of clients(save)) {
    if (f.bk || g.events.some(e => e.fid === f.id && (e.k === 'promo' || e.k === 'release'))) continue;
    const recentW = f.recent.slice(-4).filter(x => x === 'W').length;
    const pct = f.w / ((f.w + f.l) || 1);
    const hot = f.streak >= 3 || (recentW >= 3 && tierStanding(w, f.id) <= 4);
    const want = upOptions(f.tier).filter(u => u === TOP && f.tier === 3 ? ((rankOf(w, f.id) ?? 99) <= 5 && f.streak >= 2) || isChamp(w, f.id) : TIERS[u].lvl === 2 ? hot && pct >= 0.62 : hot);
    if (want.length && f.tier !== TOP && !(f.promoWk > w.wk)) out.events.push(addEvent(save, { k: 'promo', fid: f.id, opts: want }));
    else if (f.tier > 0 && (f.recent.slice(-3).join('') === 'LLL') && !isChamp(w, f.id)) out.events.push(addEvent(save, { k: 'release', fid: f.id, opts: downOptions(f.tier).slice(0, 2) }));
  }
}
function moveTier(save, f, t) {
  moveFighter(save.world, f, t);
  f.rp = TIERS[t].lvl === 2 ? 940 : 980; f.streak = 0; touch(save.world);
  save.world.news.unshift({ wk: save.world.wk, txt: `✍️ ${fullName(f)} (${save.g.name}) signs with ${TIERS[t].name}.`, kind: 'sign' });
}
// ---- events ----
function addEvent(save, e) {
  const g = save.g;
  if (g.events.some(x => x.k === e.k && x.fid === e.fid)) return null;
  e.id = 'e' + save.world.wk + '_' + e.k + '_' + (e.fid || '') + '_' + Math.floor(R(save)() * 1e6);
  e.wk = save.world.wk;
  g.events.push(e);
  return e;
}
function randomEvents(save, out) {
  const w = save.world, g = save.g, r = R(save);
  const cl = clients(save);
  if (!cl.length) return;
  if (r.chance(0.06)) { const f = r.pick(cl); out.events.push(addEvent(save, { k: 'viral', fid: f.id })); }
  if (r.chance(0.035)) { const f = r.pick(cl.filter(x => x.loy < 60) || cl); if (f) out.events.push(addEvent(save, { k: 'poach', fid: f.id, rv: r.pick(g.rivals).id })); }
  if (r.chance(0.04)) { const f = r.pick(cl.filter(x => !x.bk)); if (f) out.events.push(addEvent(save, { k: 'injury', fid: f.id })); }
  if (r.chance(0.03)) { const rv = r.pick(g.rivals); out.events.push(addEvent(save, { k: 'trash', rv: rv.id })); }
  if (r.chance(0.035)) { const f = r.pick(cl); out.events.push(addEvent(save, { k: 'dispute', fid: f.id })); }
  if (r.chance(0.025)) { const f = r.pick(cl.filter(x => x.tier >= 1)); if (f) out.events.push(addEvent(save, { k: 'sponsor', fid: f.id, amt: Math.round((2000 + f.pop * 300 + TIERS[f.tier].lvl * 6000) / 500) * 500 })); }
  if (w.wk % 52 === 40) for (const f of cl) for (const b of undefended(w, f.id)) log(save, `⏳ ${f.last} must defend the ${TIERS[b.pid].short} ${divName(b.div)} title before the year ends, or vacate it.`, 'bad');
  saveRng(w, r);
}
export function eventView(save, e) {
  const w = save.world, g = save.g, f = e.fid ? w.f[e.fid] : null, rv = e.rv ? g.rivals.find(x => x.id === e.rv) : null;
  const nm = f ? fullName(f) : '';
  switch (e.k) {
    case 'viral': return { title: 'Viral moment', text: `${nm}'s training clip blows up online.`, choices: [['Push it everywhere', '+Hype, +Popularity']] };
    case 'poach': return { title: 'Poaching attempt', text: `${rv.name} is whispering in ${nm}'s ear (loyalty ${Math.round(f.loy)}).`, choices: [['Pay a loyalty bonus (' + fmt(3000 + TIERS[f.tier].lvl * 8000) + ')', 'Keeps them, +Loyalty'], ['Cut your fee by 3%', '+Loyalty, smaller cut'], ['Call their bluff', 'Free. Low loyalty means they may walk.']] };
    case 'injury': return { title: 'Training injury', text: `${nm} hurts a hand in sparring. Doctors say 8 weeks.`, choices: [['Rest', 'Out 8 weeks'], ['Pay for sports science (' + fmt(2500 + TIERS[f.tier].lvl * 4000) + ')', 'Out 3 weeks']] };
    case 'trash': return { title: 'Rival manager trash talk', text: `The head of ${rv.name} says your agency "builds paper champions."`, choices: [['Fire back publicly', '+Rivalry heat, +Reputation if your fighters keep winning'], ['Take the high road', '+Reputation, a little']] };
    case 'dispute': return { title: 'Contract dispute', text: `${nm} thinks your ${f.mc.cut}% cut is too high.`, choices: [['Lower to ' + Math.max(8, f.mc.cut - 4) + '%', '+Morale, +Loyalty'], ['Hold firm', '-Morale, -Loyalty']] };
    case 'sponsor': return { title: 'Sponsor deal', text: `A brand wants ${nm}: ${fmt(e.amt)} up front, and your agency takes 20%.`, choices: [['Close the deal', '+Money, +Morale']] };
    case 'expiring': return { title: 'Contract expiring soon', text: `${nm}'s management deal ends in 8 weeks (loyalty ${Math.round(f.loy)}). Extend early?`, choices: [['Extend 2 years at ' + f.mc.cut + '%', 'Works if loyalty is decent'], ['Extend at ' + Math.max(8, f.mc.cut - 5) + '%', 'Very likely to work'], ['Wait', 'Decide when it expires']] };
    case 'renew': return { title: 'Contract up', text: `${nm}'s deal has expired. Loyalty ${Math.round(f.loy)}, morale ${Math.round(f.mor)}.`, choices: [['Re-sign at ' + f.mc.cut + '%', 'May refuse if unhappy'], ['Re-sign at ' + Math.max(8, f.mc.cut - 5) + '%', 'Likely'], ['Let them go', 'They leave the stable']] };
    case 'promo': { const o = e.opts || [f.tier + 1]; return { title: o.length > 1 ? 'Bidding war' : 'Promotion interest', text: `${o.map(t => TIERS[t].name).join(' and ')} want${o.length > 1 ? '' : 's'} to sign ${nm} (${recStr(f)}).${isChamp(w, f.id) ? ' Leaving vacates their belt.' : ''}`, choices: [...o.map(t => ['Sign with ' + TIERS[t].short, TIERS[t].style]), ['Stay one more fight', 'Keep building where they are']] }; }
    case 'release': { const o = e.opts || [f.tier - 1]; return { title: 'Released', text: `${TIERS[f.tier].name} releases ${nm} after three straight losses.`, choices: o.map(t => ['Rebuild on ' + TIERS[t].short, TIERS[t].style]) }; }
    case 'bailout': return { title: 'Investor bailout', text: 'You ran out of money. An investor covered your debts for a stake in the agency. Spend carefully: cheaper camps, fewer scouting trips.', choices: [['Understood', '']] };
    case 'retire': return { title: 'Retirement', text: `${nm} (${recStr(f)}, age ${f.age}) is thinking about hanging up the gloves.`, choices: [['Wish them well', 'They retire'], ['Talk them into one more run', 'Keeps fighting, -Morale']] };
  }
  return { title: e.k, text: '', choices: [['OK', '']] };
}
export function resolveEvent(save, id, i) {
  const w = save.world, g = save.g, r = R(save);
  const e = g.events.find(x => x.id === id); if (!e) return '';
  g.events = g.events.filter(x => x !== e);
  const f = e.fid ? w.f[e.fid] : null, rv = e.rv ? g.rivals.find(x => x.id === e.rv) : null;
  let msg = '';
  if (f && !g.clients.includes(f.id) && e.k !== 'trash') return 'No longer relevant.';
  switch (e.k) {
    case 'viral': f.hype = clamp(f.hype + 8, 0, 100); f.pop = clamp(f.pop + 5, 0, 100); g.rep = clamp(g.rep + 1, 0, 100); msg = `${f.last} is trending.`; break;
    case 'poach': {
      if (i === 0) { const c = 3000 + TIERS[f.tier].lvl * 8000; g.money -= c; f.loy = clamp(f.loy + 20, 0, 100); msg = `${f.last} stays. Loyalty bonus paid.`; }
      else if (i === 1) { f.mc.cut = Math.max(8, f.mc.cut - 3); f.loy = clamp(f.loy + 15, 0, 100); msg = `${f.last} appreciates it.`; }
      else if (r.chance(f.loy / 100 + 0.2)) { f.loy = clamp(f.loy + 5, 0, 100); msg = `${f.last} tells ${rv.short} no.`; }
      else { leave(save, f, rv.id); msg = `${f.last} leaves for ${rv.name}!`; }
      break;
    }
    case 'injury': if (i === 1) { g.money -= 2500 + TIERS[f.tier].lvl * 4000; f.inj = 3; } else f.inj = 8; f.avail = w.wk + f.inj; msg = `${f.last} is out ${f.inj} weeks.`; g.offers = g.offers.filter(o => o.fid !== f.id); break;
    case 'trash': if (i === 0) { rv.heat = clamp(rv.heat + 20, 0, 100); g.rep = clamp(g.rep + 1, 0, 100); msg = `The ${rv.short} feud heats up. Fights against their fighters pay more now.`; } else { g.rep = clamp(g.rep + 0.5, 0, 100); msg = 'Classy.'; } break;
    case 'dispute': if (i === 0) { f.mc.cut = Math.max(8, f.mc.cut - 4); f.mor = clamp(f.mor + 8, 0, 100); f.loy = clamp(f.loy + 10, 0, 100); msg = 'Happy fighter.'; } else { f.mor = clamp(f.mor - 10, 0, 100); f.loy = clamp(f.loy - 12, 0, 100); msg = `${f.last} is unhappy.`; } break;
    case 'sponsor': g.money += Math.round(e.amt * 0.2); f.mor = clamp(f.mor + 5, 0, 100); f.pop = clamp(f.pop + 2, 0, 100); msg = `Deal done. Your 20%: ${fmt(e.amt * 0.2)}.`; break;
    case 'expiring': case 'renew': {
      if (i === 2) { if (e.k === 'renew') { leave(save, f, null); msg = `${f.last} leaves the stable.`; } else msg = 'You will revisit it.'; break; }
      const cut = i === 0 ? f.mc.cut : Math.max(8, f.mc.cut - 5);
      const p = clamp(f.loy / 100 + (i === 1 ? 0.35 : 0.05) + (f.mor - 50) / 200, 0.05, 0.97);
      if (r.chance(p)) { f.mc = { wk: w.wk + 104, cut }; f.loy = clamp(f.loy + 5, 0, 100); msg = `${f.last} re-signs for two years at ${cut}%.`; }
      else if (e.k === 'renew') { const rvl = r.pick(g.rivals); leave(save, f, rvl.id); msg = `${f.last} refuses and signs with ${rvl.name}.`; }
      else msg = `${f.last} wants to wait.`;
      break;
    }
    case 'promo': { const o = e.opts || [f.tier + 1]; if (i < o.length) { moveTier(save, f, o[i]); f.mor = clamp(f.mor + 10, 0, 100); g.rep = clamp(g.rep + 2, 0, 100); msg = `${f.last} signs with ${TIERS[f.tier].name}!`; } else { f.promoWk = w.wk + 8; msg = `${f.last} stays put for now.`; } break; }
    case 'release': { const o = e.opts || [f.tier - 1]; moveTier(save, f, o[Math.min(i, o.length - 1)]); f.mor = clamp(f.mor - 10, 0, 100); msg = `${f.last} signs with ${TIERS[f.tier].name} to rebuild.`; break; }
    case 'retire': if (i === 0) { retireClient(save, f); msg = `${f.last} retires. Thanks for the memories.`; } else { f.mor = clamp(f.mor - 15, 0, 100); msg = `${f.last} agrees to one more run.`; } break;
  }
  saveRng(w, r);
  return msg;
}
function leave(save, f, rvId) {
  const g = save.g;
  g.clients = g.clients.filter(x => x !== f.id);
  save.world.protect = g.clients.slice();
  f.lock = 0; f.mgr = rvId; f.mc = null;
  if (f.bk) { const o = save.world.f[f.bk]; if (o) o.bk = null; f.bk = null; }
  g.bookings = (g.bookings || []).filter(b => b.fid !== f.id);
  g.offers = g.offers.filter(o => o.fid !== f.id);
  log(save, `👋 ${fullName(f)} leaves ${g.name}${rvId ? ' for ' + g.rivals.find(x => x.id === rvId).name : ''}.`, 'bad');
}
export function retireClientNow(save, fid) { const f = save.world.f[fid]; if (!f || !save.g.clients.includes(fid)) return ''; retireClient(save, f); return `${f.last} retires at ${recStr(f)}. Thanks for the memories.`; }
export function releaseClient(save, fid) { const f = save.world.f[fid]; if (!f) return ''; save.g.rep = clamp(save.g.rep - 1, 0, 100); leave(save, f, null); return `${f.last} released.`; }
function retireClient(save, f) {
  const g = save.g;
  g.trophies.unshift({ wk: save.world.wk, txt: `${fullName(f)} retires at ${recStr(f)}`, kind: 'ret' });
  for (const b of beltsOf(save.world, f.id)) vacate(save.world, b.pid, b.div, `{name} retires as {promo} ${divName(b.div)} champion.`);
  leave(save, f, null); f.act = 0; f.retWk = save.world.wk; touch(save.world);
}
export function setGym(save, fid, gym) { const f = save.world.f[fid]; f.gym = gym; }
export function setPlan(save, fid, plan) { const f = save.world.f[fid]; f.plan = plan; }
export function moveDivision(save, fid, to) {
  const f = save.world.f[fid], w = save.world;
  if (f.bk) return 'Wait until after the booked fight.';
  if (!hasDiv(w, to)) return 'Not available.';
  for (const b of beltsOf(w, f.id)) if (b.div === f.div) vacate(w, b.pid, b.div, `{name} vacates the {promo} ${divName(b.div)} title.`);
  f.div = to; touch(w); f.rp -= 30; f.mor = clamp(f.mor + 3, 0, 100);
  g_offersClear(save, fid);
  return `${f.last} moves to ${divName(to)}.`;
}
function g_offersClear(save, fid) { save.g.offers = save.g.offers.filter(o => o.fid !== fid); }
function yearEnd(save, out) {
  const w = save.world, g = save.g, r = R(save);
  for (const f of clients(save)) {
    const gq = (GYMS.find(x => x.id === f.gym) || GYMS[0]).q;
    if (gq >= 4 && f.age <= 29) f.pot = clamp(f.pot + 1, 0, 97);
    ageOneYear(r, f, gq * 0.3);
    if (f.age >= 35 && r.chance(0.15 + (f.age - 35) * 0.12)) out.events.push(addEvent(save, { k: 'retire', fid: f.id }));
  }
  // manager of the year
  // Manager of the Year: results per fighter managed, so a small stable can beat a big one
  const mt = w.mt || {};
  const score = (t, n) => 30 * ((t.w || 0) - 0.5 * (t.l || 0)) / Math.max(5, n) + 25 * (t.t || 0) + 2 * (t.t2 || 0) / Math.max(1, n / 6);
  const mine = score(mt.you || {}, g.clients.length);
  const rivalsScore = g.rivals.map(rv => {
    const n = Object.values(w.f).filter(f => f.mgr === rv.id && f.act).length;
    const s = score(mt[rv.id] || {}, n) + r.range(0, 6);
    rv.rep = clamp(Math.round(rv.rep * 0.7 + clamp(s * 2, 0, 100) * 0.3), 0, 100);
    return { rv, s };
  });
  w.mt = {};
  const best = rivalsScore.sort((a, b) => b.s - a.s)[0];
  g.lastScores = { mine: Math.round(mine), best: Math.round(best.s) };
  const yr = 2026 + Math.round(w.wk / 52);
  const belts = g.clients.flatMap(id => beltsOf(w, id));
  const aw = w.awards[0] && w.awards[0].year === yr ? w.awards[0] : null;
  const myFoy = aw && aw.foy && g.clients.includes(aw.foy.id);
  const mgrWin = mine >= best.s;
  const sum = { year: yr, ...g.season, belts: belts.length, mgr: mgrWin ? g.name : best.rv.name, foy: aw && aw.foy ? aw.foy.name : '—', myFoy, rep: Math.round(g.rep) };
  g.seasons.unshift(sum);
  if (mgrWin) { g.trophies.unshift({ wk: w.wk, txt: `${yr} Manager of the Year`, kind: 'award' }); g.rep = clamp(g.rep + 6, 0, 100); }
  if (myFoy) g.trophies.unshift({ wk: w.wk, txt: `${yr} Fighter of the Year: ${aw.foy.name}`, kind: 'award' });
  g.season = { wins: 0, losses: 0, titles: 0, earned: 0, fights: 0 };
  out.season = sum;
  saveRng(w, r);
}
export function clientBelts(save) { return save.g.clients.flatMap(id => beltsOf(save.world, id).map(b => ({ ...b, id }))); }
export { capInfo, beltsOf, undefended, TIERS };
export function needsAttention(save) { return save.g.events.length > 0 || save.g.offers.length > 0; }
export function nextFightWk(save) { const b = (save.g.bookings || []).map(x => x.wk); return b.length ? Math.min(...b) : null; }
export { rankOf, rankings, divName, fullName, recStr, ovr, tierStanding, activeIn, series, REASONS, adjacentDivs };
