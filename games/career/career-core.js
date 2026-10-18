// Career Mode game logic (no DOM). Used by the UI and by the headless tests.
import { TIERS, GYMS, CAMP_FOCUS, STYLES, ARCHETYPES, ATTR_KEYS, SPONSORS, DIVISIONS, COUNTRIES, adjacentDivs } from '../shared/data.js';
import { createWorld, advanceWeek, offersFor, recordFight, rankOf, rankings, tierStanding, eventName, bookCheck, rngFor, saveRng, divName, activeIn } from '../shared/world.js';
import { createFight, simRound, aiStrategy } from '../shared/fight.js';
import { ovr, ageOneYear, fullName, recStr } from '../shared/fighter.js';
import { pairKey, series, REASONS } from '../shared/rematch.js';
import { clamp, makeRng } from '../shared/rng.js';

export const START_POINTS = 40;
export const ATTR_MIN = 30, ATTR_MAX_START = 72;
export function baseAttrs(style, arch) {
  const a = {};
  for (const k of ATTR_KEYS) a[k] = clamp(42 + (STYLES[style].b[k] || 0) + ((arch && ARCHETYPES.find(x => x.id === arch)?.b[k]) || 0), ATTR_MIN, ATTR_MAX_START);
  return a;
}
export function newCareer(o) {
  const seed = o.seed ?? (Math.floor(Math.random() * 1e9));
  const d = DIVISIONS.find(x => x.id === o.div);
  const world = createWorld({ seed, gender: d.g });
  const c = COUNTRIES.find(x => x.cc === o.cc) || COUNTRIES[0];
  const p = {
    id: 'p1', first: o.first || 'Rookie', last: o.last || 'Fighter', nick: o.nick || '', cc: c.cc, country: c.name, g: d.g, div: o.div,
    style: o.style, arch: o.arch || null, age: o.age || 22, attrs: { ...o.attrs }, pot: 0, tier: 0,
    w: 0, l: 0, d: 0, nc: 0, ko: 0, sub: 0, streak: 0, rp: 960, hype: 8, pop: 4, act: 1, inj: 0, avail: 0, lw: -99, recent: [], kol: 0,
    col: o.col || ['#e5132b', '#f6c343'], rest: 0, fc: 0, lock: 1, isP: 1,
  };
  // natural ceiling: younger debut = more room to grow. Training can push a little past it.
  p.pot = clamp(Math.round(ovr(p.attrs) + 29 + (23 - p.age) * 1.5), 78, 93);
  world.f.p1 = p; world.protect = ['p1'];
  const c0 = {
    pid: 'p1', money: 3000, gym: 'garage', contract: { tier: 0, left: 3, show: 2500, win: 2500 }, sponsors: [], booked: null, offers: [], phase: 'hub',
    recs: [], titleWins: 0, defenses: 0, peakRank: null, earned: 0, retired: false, pending: null, callout: null, tierW: 0, tierF: 0, startAge: p.age,
    belts: [], doubleChamp: false, lastEventWk: 0, log: [], promoOffered: false, created: Date.now(), lastPlayed: Date.now(), legacy: null,
  };
  const save = { v: 1, world, c: c0 };
  world.logMax = 30;
  refreshOffers(save);
  pushLog(save, `${fullName(p)} turns pro on the ${TIERS[0].name}. Three-fight deal, ${fmt(2500)} to show, ${fmt(2500)} to win.`);
  return save;
}
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
export function player(save) { return save.world.f[save.c.pid]; }
export function beltsOf(save) { const w = save.world; return w.divs.filter(d => w.div[d].champ === save.c.pid); }
function pushLog(save, txt) { save.c.log.unshift({ wk: save.world.wk, txt }); if (save.c.log.length > 60) save.c.log.length = 60; }
function rng(save) { return rngFor(save.world); }

export function refreshOffers(save) {
  const w = save.world, c = save.c, p = player(save), r = rng(save);
  if (c.retired) { c.offers = []; return; }
  const belts = beltsOf(save);
  let list = offersFor(w, p.id, { n: 3, rng: r, champBelts: belts });
  // a callout target answers the call
  if (c.callout && w.f[c.callout]) {
    const o = w.f[c.callout];
    if (o.act && !o.bk && o.avail <= w.wk + 6 && o.div === p.div && o.tier === p.tier && !list.some(x => x.opp === o.id)) {
      const bc = bookCheck(w, p.id, o.id);
      if (bc.ok) list.unshift({ opp: o.id, type: 'callout', title: false, div: p.div, reason: bc.reason, ctx: bc.ctx, weeks: r.int(6, 9), short: false });
    }
    c.callout = null;
  }
  list = list.slice(0, 5);
  for (const of of list) Object.assign(of, purse(save, of));
  saveRng(w, r);
  c.offers = list;
}
export function purse(save, of) {
  const c = save.c, p = player(save);
  let m = 1 + p.hype / 160 + p.pop / 200;
  if (of.title) m *= 2; if (of.type === 'superfight') m *= 1.6; if (of.short) m *= 1.45; if (of.reason === 'grudge') m *= 1.5;
  if (of.reason === 'trilogy') m *= 1.3; if (beltsOf(save).length) m *= 1.6;
  return { show: Math.round(c.contract.show * m / 100) * 100, win: Math.round(c.contract.win * m / 100) * 100 };
}
export function advanceWeeks(save, n) {
  const w = save.world, c = save.c, p = player(save);
  for (let i = 0; i < n; i++) {
    advanceWeek(w);
    if (p.inj > 0) p.inj--;
    if (w.wk % 52 === 0) {
      const r = rng(save); ageOneYear(r, p); saveRng(w, r);
      pushLog(save, `Happy birthday! ${p.first} turns ${p.age}.` + (p.age >= 33 ? ' Father Time is starting to show.' : ''));
    }
    // champions must stay active or get stripped
    for (const d of beltsOf(save)) {
      const D = w.div[d];
      if (w.wk - Math.max(D.lastTitle, D.since) > 56 && !(c.booked && c.booked.title && c.booked.div === d)) {
        D.champ = null; pushLog(save, `You were stripped of the ${divName(d)} title for inactivity.`);
        w.news.unshift({ wk: w.wk, txt: `${fullName(p)} is stripped of the ${divName(d)} title for inactivity.`, kind: 'title' });
      }
    }
  }
  c.sponsors = c.sponsors.filter(s => s.left > 0);
}
export function acceptOffer(save, i) {
  const c = save.c, w = save.world, of = c.offers[i];
  if (!of) return null;
  const o = w.f[of.opp];
  if (!o || o.bk || !o.act) { refreshOffers(save); return null; }
  o.bk = c.pid;
  c.booked = { ...of, wk: w.wk + of.weeks, ev: eventName(w, of.title || of.type === 'superfight' ? 2 : player(save).tier, w.wk + of.weeks) };
  c.offers = []; c.phase = 'camp';
  return c.booked;
}
export function declineOffers(save, weeks = 2) {
  const p = player(save);
  advanceWeeks(save, weeks);
  p.hype = clamp(p.hype - 1, 0, 100);
  refreshOffers(save);
  return maybeEvent(save, 0.3);
}
export function rest(save, weeks = 4) { const p = player(save); advanceWeeks(save, weeks); p.inj = Math.max(0, p.inj - weeks); refreshOffers(save); return maybeEvent(save, 0.35); }

export const INTENSITY = {
  light: { name: 'Light', gain: 0.6, inj: 0.45, tip: 'Stay fresh and healthy. Smaller gains.' },
  normal: { name: 'Normal', gain: 1, inj: 1, tip: 'A standard eight-week camp.' },
  hard: { name: 'Hard', gain: 1.5, inj: 2.2, tip: 'Max gains, real injury risk.' },
};
export const CUTS = {
  easy: { name: 'Easy cut', tip: 'Walk in light. A little smaller, no risks.', miss: 0, bad: 0, add: { pow: -2, wre: -1 } },
  normal: { name: 'Normal cut', tip: 'Standard water cut.', miss: 0.03, bad: 0.04, add: {} },
  hard: { name: 'Aggressive cut', tip: 'Rehydrate much bigger (+power, +wrestling) but you risk missing weight or a drained gas tank.', miss: 0.12, bad: 0.14, add: { pow: 3, chin: 2, wre: 2 } },
};
export function gymById(id) { return GYMS.find(g => g.id === id) || GYMS[0]; }
export function gymAllowed(save, g) { const p = player(save); return g.q <= 2 + p.tier + (beltsOf(save).length ? 1 : 0) && save.c.money >= g.cost; }
// Training camp. ch = { focus, intensity, spar, cut, gym }
export function runCamp(save, ch) {
  const c = save.c, p = player(save), w = save.world, b = c.booked, r = rng(save);
  let gym = gymById(ch.gym || c.gym);
  const rep = { gains: {}, lines: [], injury: null, pulled: false };
  if (c.money < gym.cost * (b.short ? 0.5 : 1) * (c.gymDiscount ? 0.5 : 1)) { rep.lines.push(`You can't afford ${gym.name} this time, so you train at ${GYMS[0].name}.`); gym = GYMS[0]; }
  if (gym.id !== c.gym) { rep.lines.push(`You move your camp to ${gym.name}.`); c.gym = gym.id; }
  const cost = Math.round(gym.cost * (b.short ? 0.5 : 1) * (c.gymDiscount ? 0.5 : 1)); c.gymDiscount = false;
  c.money -= cost; rep.cost = cost;
  const I = INTENSITY[ch.intensity] || INTENSITY.normal;
  const ageF = p.age <= 27 ? 1.15 : p.age <= 31 ? 1 : p.age <= 34 ? 0.6 : 0.35;
  const weeksF = b.short ? 0.45 : 1;
  const focus = CAMP_FOCUS[ch.focus] || CAMP_FOCUS.striking;
  const grow = (k, g) => {
    const room = clamp((96 - p.attrs[k]) / 45, 0.04, 1) * (p.attrs[k] > 82 ? 0.6 : 1);
    const v = Math.round(g * room * (ovr(p.attrs) >= p.pot ? 0.35 : 1) * 10) / 10;
    p.attrs[k] = clamp(Math.round((p.attrs[k] + v) * 10) / 10, 20, 99);
    rep.gains[k] = Math.round(((rep.gains[k] || 0) + v) * 10) / 10;
  };
  const base = (1.1 + gym.q * 0.4) * I.gain * ageF * weeksF * (ch.spar ? 1.25 : 1);
  for (const k of focus.attrs) grow(k, base * r.range(0.8, 1.3));
  if (gym.focus && !focus.attrs.includes(gym.focus)) grow(gym.focus, base * 0.35);
  // small all-round gains from a good room
  if (gym.q >= 3) for (const k of ATTR_KEYS) if (!focus.attrs.includes(k) && r.chance(0.25)) grow(k, 0.5);
  // injuries
  const injP = 0.05 * I.inj * (ch.spar ? 1.7 : 1) * gym.inj * (p.age >= 32 ? 1.35 : 1);
  if (r.chance(injP)) {
    if (r.chance(0.3)) {
      const wks = r.int(6, 14);
      rep.injury = `You tear something in sparring and have to pull out. Out ${wks} weeks.`; rep.pulled = true;
      const o = w.f[b.opp]; if (o) o.bk = null;
      c.booked = null; p.inj = wks; p.hype = clamp(p.hype - 4, 0, 100); c.phase = 'hub';
      pushLog(save, `Pulled out of the ${fullName(o)} fight with an injury.`);
      saveRng(w, r);
      advanceWeeks(save, 2); refreshOffers(save);
      return rep;
    }
    rep.injury = 'You tweak your knee late in camp. You will fight, but you are not 100%.';
    c.campMods = { tweak: true };
  } else c.campMods = {};
  // opponent withdraws: a short-notice replacement steps in (never a dead end)
  if (r.chance(0.06)) {
    const old = w.f[b.opp];
    const repl = activeIn(w, p.div, p.tier).filter(o => o.id !== p.id && o.id !== old.id && !o.lock && !o.bk && o.avail <= b.wk && Math.abs(o.rp - old.rp) < 160 && !b.title)
      .map(o => ({ o, bc: bookCheck(w, p.id, o.id) })).filter(x => x.bc.ok && !x.bc.reason)[0];
    if (repl) {
      old.bk = null; repl.o.bk = p.id;
      Object.assign(b, { opp: repl.o.id, reason: null, ctx: repl.bc.ctx, type: 'short' });
      rep.lines.push(`${fullName(old)} withdraws injured! ${fullName(repl.o)} (${recStr(repl.o)}) steps in on short notice. Your film study is wasted, but the purse stays.`);
      if (ch.focus === 'gameplan') ch.focus = 'cardio';
    }
  }
  // weight cut
  const cut = CUTS[ch.cut] || CUTS.normal;
  const mods = { add: { ...cut.add }, gasStart: b.short ? 0.88 : 1, plan: ch.focus === 'gameplan' ? 1.5 : 0, home: 0 };
  if (c.campMods.tweak) { mods.add.spd = (mods.add.spd || 0) - 4; mods.add.cardio = (mods.add.cardio || 0) - 4; }
  if (r.chance(cut.bad)) { mods.gasStart *= 0.8; rep.lines.push('The cut was brutal. You feel drained at weigh-ins.'); }
  if (r.chance(cut.miss)) { rep.missed = true; rep.lines.push('You MISS WEIGHT. 20% of your purse goes to your opponent, and the fans are not impressed.'); p.hype = clamp(p.hype - 4, 0, 100); }
  if (p.cc === (w.f[b.opp] || {}).cc) mods.home = 0; else if (r.chance(0.2)) { mods.home = 1; rep.lines.push('The card lands in your home country. The crowd will be on your side!'); }
  c.camp = { focus: ch.focus, mods, missed: !!rep.missed };
  rep.lines.unshift(`${b.short ? 'Short-notice' : b.weeks + '-week'} camp at ${gym.name}${cost ? ' (' + fmt(cost) + ')' : ''}.`);
  saveRng(w, r);
  advanceWeeks(save, Math.max(0, b.wk - w.wk));
  c.phase = 'media';
  return rep;
}
export const MEDIA = {
  respect: { name: 'Stay respectful', tip: 'Fans like a humble fighter. Small popularity boost.' },
  hype: { name: 'Sell the fight', tip: 'Bold predictions. More hype.' },
  trash: { name: 'Trash talk', tip: 'Big hype and bad blood (heat). Can backfire and fire your opponent up.' },
  callout: { name: 'Call out the champ', tip: 'Only for ranked fighters. Builds heat with the champion and pushes you toward a title shot.' },
};
export function media(save, choice) {
  const c = save.c, p = player(save), w = save.world, r = rng(save), b = c.booked, o = w.f[b.opp];
  const key = pairKey(p.id, o.id); const out = [];
  c.oppMods = { plan: 0 };
  if (choice === 'respect') { p.pop = clamp(p.pop + 2, 0, 100); out.push(`You praise ${o.last} and promise a great fight. Fans appreciate the class.`); }
  if (choice === 'hype') { p.hype = clamp(p.hype + 3, 0, 100); out.push(`"I'm finishing ${o.last} inside two rounds." The clip gets picked up everywhere.`); }
  if (choice === 'trash') {
    p.hype = clamp(p.hype + 6, 0, 100); w.heat[key] = clamp((w.heat[key] || 0) + 25, 0, 100);
    if (r.chance(0.3)) { p.pop = clamp(p.pop - 4, 0, 100); c.oppMods.plan = 1.5; out.push(`The trash talk crosses a line. ${o.last} is furious and motivated, and some fans turn on you.`); }
    else out.push(`Your face-off with ${o.last} goes viral. Real bad blood now.`);
  }
  if (choice === 'callout') {
    const d = w.div[p.div]; const ch = d.champ && w.f[d.champ];
    if (ch && ch.id !== p.id) { const k2 = pairKey(p.id, ch.id); w.heat[k2] = clamp((w.heat[k2] || 0) + 35, 0, 100); p.hype = clamp(p.hype + 5, 0, 100); out.push(`You look into the camera: "${ch.first} ${ch.last}, you're next." The champ responds on social media.`); c.callout = ch.id; }
    else out.push('There is no champion to call out right now. You promise to take the belt anyway.');
  }
  saveRng(w, r);
  c.phase = 'fight';
  return out;
}
export function startFight(save) {
  const c = save.c, w = save.world, b = c.booked, p = player(save), o = w.f[b.opp], r = rng(save);
  const rounds = b.title || (p.tier === 2 && (rankOf(w, p.id) || 99) <= 5 && (rankOf(w, o.id) || 99) <= 8) ? 5 : 3;
  const oppMods = { plan: (c.oppMods && c.oppMods.plan) || (r.chance(0.3) ? 1 : 0), gasStart: 1, add: {} };
  const fs = createFight(p, o, { rng: r, rounds, title: b.title, modsA: (c.camp && c.camp.mods) || {}, modsB: oppMods, verbose: true });
  return fs;
}
export function playRound(save, fs, strat) { simRound(fs, strat, aiStrategy(fs, fs.B, fs.A)); saveRng(save.world, fs.rng); }

export function finishFight(save, fs) {
  const c = save.c, w = save.world, b = c.booked, p = player(save), o = w.f[b.opp];
  saveRng(w, fs.rng);
  const rankBefore = rankOf(w, o.id);
  const prevMeet = series(w.h2h, p.id, o.id).n;
  const orec = recStr(o);
  const rec = recordFight(w, p.id, o.id, fs, { title: b.title, div: b.div, reason: b.reason, ctx: b.ctx, ev: b.ev, heat: b.reason === 'grudge' ? 0 : 0 });
  const r = rng(save);
  const res = fs.result, won = res.winner === 'A', lost = res.winner === 'B';
  const fin = ['KO', 'TKO', 'SUB'].includes(res.method);
  // money
  let show = b.show, win = won ? b.win : 0, bonus = 0;
  const bonusAmt = [1500, 6000, 50000][p.tier];
  const lines = [];
  if (won && fin && r.chance(0.55)) { bonus += bonusAmt; lines.push(`Performance of the Night bonus: ${fmt(bonusAmt)}!`); }
  if (res.method === 'DEC' && res.close && fs.r >= 3 && r.chance(0.4)) { bonus += bonusAmt; lines.push(`Fight of the Night bonus: ${fmt(bonusAmt)}!`); }
  let sponsor = 0;
  for (const s of c.sponsors) { sponsor += s.per + (won && fin ? s.fin || 0 : 0); s.left--; }
  let fine = c.camp && c.camp.missed ? Math.round((show + win) * 0.2) : 0;
  const gross = show + win + bonus + sponsor - fine;
  const mgr = Math.round((show + win) * 0.1);
  const medical = res.method === 'KO' && lost ? 3000 : p.inj > 0 ? 1500 : 0;
  const net = gross - mgr - medical;
  c.money += net; c.earned += net;
  // career bookkeeping
  const beltsNow = beltsOf(save);
  if (b.title && won) { if (rec.titleNote === 'defense') c.defenses++; else c.titleWins++; }
  if (beltsNow.length >= 2 && !c.doubleChamp) { c.doubleChamp = true; lines.push('👑👑 DOUBLE CHAMP! You hold two belts at the same time.'); }
  c.tierF++; if (won) c.tierW++;
  c.contract.left--;
  const rnk = rankOf(w, p.id);
  if (rnk != null && (c.peakRank == null || rnk < c.peakRank)) c.peakRank = rnk;
  if (won && fin) { p.hype = clamp(p.hype + 3, 0, 100); }
  if (won && rankBefore != null && rankBefore <= 15) p.pop = clamp(p.pop + 3, 0, 100);
  const recEntry = {
    wk: w.wk, ev: b.ev, opp: o.id, on: fullName(o), cc: o.cc, orec, ores: o.style, res: won ? 'W' : lost ? 'L' : res.method === 'NC' ? 'NC' : 'D',
    m: res.method, det: res.detail, r: res.round, t: res.time, title: !!b.title, tn: rec.titleNote, reason: b.reason || null, div: b.div, tier: p.tier,
    purse: net, cards: res.totals || null, orank: rankBefore, meet: prevMeet + 1, short: !!b.short, type: b.type,
    st: { sig: fs.A.st.sig, osig: fs.B.st.sig, td: fs.A.st.td, kd: fs.A.st.kd, sub: fs.A.st.sub },
  };
  c.recs.push(recEntry);
  pushLog(save, `${recEntry.res === 'W' ? 'Beat' : recEntry.res === 'L' ? 'Lost to' : 'Fought'} ${recEntry.on} by ${res.method === 'DEC' ? res.detail + ' decision' : res.method} (R${res.round}).${b.title ? (won ? ' 🏆' : '') : ''}`);
  c.booked = null; c.camp = null; c.oppMods = null;
  p.avail = 0; p.bk = null;
  p.rest = 0;
  const recover = p.inj;
  c.phase = 'post';
  saveRng(w, r);
  // post-fight downtime
  advanceWeeks(save, 2 + Math.min(recover, 6));
  const contract = checkContract(save);
  refreshOffers(save);
  const ev = contract ? null : maybeEvent(save, 0.45);
  return { rec: recEntry, money: { show, win, bonus, sponsor, fine, mgr, medical, net }, lines, contract, event: ev };
}

// ---- contracts & promotion ----
export function checkContract(save) {
  const c = save.c, p = player(save), w = save.world;
  if (c.pending) return c.pending;
  const t = p.tier;
  const recent = p.recent.slice(-4);
  const eligibleUp = t < 2 && c.tierW >= 3 && (p.streak >= 3 || tierStanding(w, p.id) <= 4 || (p.streak >= 2 && c.tierW >= 4));
  const released = t > 0 && (p.recent.slice(-3).join('') === 'LLL' || recent.filter(x => x === 'L').length >= 3) && !beltsOf(save).length;
  const offers = [];
  if (released) {
    offers.push(mkContract(save, t - 1, 'Released. A ' + TIERS[t - 1].short + ' deal to rebuild'));
    c.pending = { kind: 'release', offers, text: `After a rough run, ${TIERS[t].name} releases you. ${TIERS[t - 1].name} wants you.` };
  } else if (eligibleUp && !c.promoOffered) {
    offers.push(mkContract(save, t + 1, `${TIERS[t + 1].name} contract`));
    offers.push(mkContract(save, t, `Stay and re-sign with ${TIERS[t].short}`, 1.35));
    c.promoOffered = true;
    c.pending = { kind: 'promotion', offers, text: `Your run has turned heads. ${TIERS[t + 1].name} is offering you a deal!` };
  } else if (c.contract.left <= 0) {
    offers.push(mkContract(save, t, `Re-sign with ${TIERS[t].short}`, 1 + (c.contract.left <= 0 ? 0.1 : 0) + (p.streak > 0 ? 0.15 : 0)));
    if (t < 2 && c.tierW >= 2 && tierStanding(w, p.id) <= 6) offers.push(mkContract(save, t + 1, `${TIERS[t + 1].name} (prove-it deal)`, 0.85));
    c.pending = { kind: 'renewal', offers, text: 'Your contract is up. Time to negotiate.' };
  }
  return c.pending;
}
function mkContract(save, tier, label, mult = 1) {
  const p = player(save), T = TIERS[tier];
  const star = 1 + p.hype / 140 + p.pop / 160 + (beltsOf(save).length ? 1.2 : 0);
  const show = Math.round(T.basePurse * star * mult / 500) * 500;
  return { tier, fights: tier === 2 ? 4 : 3, show, win: show, label };
}
// ask: 0 accept as is, 1 ask for +25%, 2 ask for +60%
export function negotiate(save, i, ask) {
  const c = save.c, p = player(save), w = save.world, r = rng(save);
  const pend = c.pending; if (!pend) return null;
  const of = { ...pend.offers[i] };
  let msg;
  const pA = [1, 0.5 + p.hype / 220 + (beltsOf(save).length ? 0.2 : 0), 0.18 + p.hype / 180 + (beltsOf(save).length ? 0.25 : 0)][ask];
  if (r.chance(pA)) {
    const m = [1, 1.25, 1.6][ask]; of.show = Math.round(of.show * m / 100) * 100; of.win = Math.round(of.win * m / 100) * 100;
    msg = ask ? `They agree! ${fmt(of.show)} to show, ${fmt(of.win)} to win.` : `Deal signed: ${fmt(of.show)} to show, ${fmt(of.win)} to win.`;
  } else if (ask === 2 && of.tier > p.tier && r.chance(0.5)) {
    // they pull the bigger offer; fall back to the safest option so there's never a dead end
    const keep = pend.offers.find(x => x.tier <= p.tier) || mkContract(save, p.tier, 'Fallback', 0.9);
    Object.assign(of, keep);
    msg = `They walk away from the table. You fall back to: ${keep.label}.`;
  } else { msg = 'They refuse to budge, but the original offer stands. You sign it.'; }
  if (of.tier !== p.tier) {
    const up = of.tier > p.tier;
    p.tier = of.tier; p.rp = up ? (of.tier === 2 ? 930 : 950) : 1010; p.streak = Math.max(0, p.streak);
    c.tierW = 0; c.tierF = 0; c.promoOffered = false;
    if (up) { p.hype = clamp(p.hype + 8, 0, 100); p.pop = clamp(p.pop + 6, 0, 100); }
    w.news.unshift({ wk: w.wk, txt: up ? `✍️ ${fullName(p)} signs with ${TIERS[of.tier].name}.` : `${fullName(p)} drops to ${TIERS[of.tier].name}.`, kind: 'sign' });
    pushLog(save, up ? `Signed with ${TIERS[of.tier].name}!` : `Back on ${TIERS[of.tier].name} to rebuild.`);
  }
  c.contract = { tier: of.tier, left: of.fights, show: of.show, win: of.win };
  c.pending = null;
  saveRng(w, r);
  refreshOffers(save);
  return msg;
}

// ---- random events ----
const EVENTS = {
  viral: { title: 'You went viral', when: () => true, text: () => 'A clip of you doing pad work to a 90s hip-hop beat has millions of views overnight.', choices: [{ label: 'Ride the wave', tip: '+Hype, +Popularity', fx: (s) => { const p = player(s); p.hype = clamp(p.hype + 7, 0, 100); p.pop = clamp(p.pop + 6, 0, 100); return 'Your follower count explodes.'; } }] },
  sponsor: {
    title: 'Sponsor offer', when: (s) => s.c.sponsors.length < 3, text: (s, d) => `${d.name} wants you as an ambassador: ${fmt(d.per)} per fight for 3 fights, plus ${fmt(d.fin)} for every finish.`,
    data: (s, r) => { const p = player(s); const per = Math.round((400 + p.pop * 120 + p.tier * 2500) / 100) * 100; return { name: r.pick(SPONSORS.filter(n => !s.c.sponsors.some(x => x.name === n))), per, fin: Math.round(per * 0.5 / 100) * 100 }; },
    choices: [
      { label: 'Sign the deal', tip: 'Guaranteed money each fight.', fx: (s, d) => { s.c.sponsors.push({ name: d.name, per: d.per, fin: d.fin, left: 3 }); return `You are now a ${d.name} athlete.`; } },
      { label: 'Hold out for more', tip: 'Higher hype makes this more likely to work.', fx: (s, d, r) => { const p = player(s); if (r.chance(0.3 + p.hype / 200)) { s.c.sponsors.push({ name: d.name, per: Math.round(d.per * 1.5), fin: d.fin, left: 3 }); return `${d.name} caves: ${fmt(Math.round(d.per * 1.5))} per fight!`; } return `${d.name} signs someone else.`; } },
    ],
  },
  callout: {
    title: 'Called out!', when: (s) => !!rivalCandidate(s), data: (s) => ({ id: rivalCandidate(s) }), text: (s, d) => { const o = s.world.f[d.id]; return `${fullName(o)} (${recStr(o)}) calls you out in a post-fight interview: "${player(s).last} is all hype. I want that fight next."`; },
    choices: [
      { label: 'Fire back', tip: 'Big heat with this fighter, more hype, and they will likely appear in your offers.', fx: (s, d) => { const p = player(s); const k = pairKey(p.id, d.id); s.world.heat[k] = clamp((s.world.heat[k] || 0) + 40, 0, 100); p.hype = clamp(p.hype + 4, 0, 100); s.c.callout = d.id; refreshOffers(s); return 'The internet loses its mind. A fight between you two feels inevitable.'; } },
      { label: 'Ignore it', tip: 'No heat, a little less hype.', fx: (s) => { const p = player(s); p.hype = clamp(p.hype - 2, 0, 100); return 'You stay focused on your own path.'; } },
    ],
  },
  injury: {
    title: 'Training injury', when: (s) => !s.c.booked, text: () => 'You hurt your shoulder drilling takedowns. The doctor says 6 weeks.',
    choices: [
      { label: 'Rest it out', tip: 'Free, lose 6 weeks.', fx: (s) => { player(s).inj = 6; return 'You ice it and wait.'; } },
      { label: 'Pay for sports science', tip: 'Costs money, back in 2 weeks.', fx: (s) => { const cost = 1500 + player(s).tier * 4000; s.c.money -= cost; player(s).inj = 2; return `Top-tier rehab (${fmt(cost)}). You will be back fast.`; } },
    ],
  },
  dispute: {
    title: 'Contract dispute', when: (s) => s.c.contract.left > 1, text: (s) => `${TIERS[player(s).tier].short} says budgets are tight and wants to cut your show money by 15%.`,
    choices: [
      { label: 'Accept the cut', tip: 'Lose 15% show money, keep the peace.', fx: (s) => { s.c.contract.show = Math.round(s.c.contract.show * 0.85 / 100) * 100; return 'You sign the amended deal.'; } },
      { label: 'Push back publicly', tip: 'Hype helps. Win: +10% pay. Lose: sit out 4 weeks.', fx: (s, d, r) => { const p = player(s); if (r.chance(0.35 + p.hype / 180)) { s.c.contract.show = Math.round(s.c.contract.show * 1.1 / 100) * 100; s.c.contract.win = Math.round(s.c.contract.win * 1.1 / 100) * 100; return 'The fans back you. They give you a 10% raise instead!'; } advanceWeeks(s, 4); refreshOffers(s); return 'They freeze you out for a month before backing down.'; } },
    ],
  },
  gym: {
    title: 'Elite gym invite', when: (s) => player(s).tier >= 1 && s.c.gym !== 'northfield' && s.c.gym !== 'summit', text: () => 'Northfield Combat Lab invites you to camp with them at half price for your next fight.',
    choices: [
      { label: 'Join Northfield', tip: 'Switch gyms, next camp at 50%.', fx: (s) => { s.c.gym = 'northfield'; s.c.gymDiscount = true; return 'Welcome to the big room.'; } },
      { label: 'Stay loyal', tip: 'Your coach appreciates it. +Popularity.', fx: (s) => { player(s).pop = clamp(player(s).pop + 2, 0, 100); return 'Loyalty noted.'; } },
    ],
  },
  podcast: {
    title: 'Podcast invite', when: () => true, text: () => 'A huge MMA podcast wants you on. The host loves a spicy take.',
    choices: [
      { label: 'Go full heel', tip: '+Hype, -Popularity', fx: (s) => { const p = player(s); p.hype = clamp(p.hype + 6, 0, 100); p.pop = clamp(p.pop - 3, 0, 100); return 'Two hours of controversy. Everyone is talking about you.'; } },
      { label: 'Tell your story', tip: '+Popularity', fx: (s) => { const p = player(s); p.pop = clamp(p.pop + 4, 0, 100); return 'Fans connect with your journey.'; } },
    ],
  },
  expense: { title: 'Life happens', when: (s) => s.c.money > 5000, text: () => 'Your car dies and your landlord raises the rent.', choices: [{ label: 'Pay up', tip: 'Lose some money.', fx: (s) => { const c = Math.round(Math.min(s.c.money * 0.08, 8000)); s.c.money -= c; return `That cost you ${fmt(c)}.`; } }] },
};
function rivalCandidate(s) {
  const p = player(s), w = s.world;
  const pool = activeIn(w, p.div, p.tier).filter(o => o.id !== p.id && !o.bk && Math.abs(o.rp - p.rp) < 150 && bookCheck(w, p.id, o.id).ok);
  return pool.length ? pool[Math.floor(rng(s)() * pool.length)].id : null;
}
export function maybeEvent(save, p) {
  const c = save.c, r = rng(save);
  if (c.pending || c.retired || !r.chance(p)) { saveRng(save.world, r); return null; }
  const keys = Object.keys(EVENTS).filter(k => EVENTS[k].when(save));
  const k = r.pick(keys); const E = EVENTS[k];
  const data = E.data ? E.data(save, r) : {};
  saveRng(save.world, r);
  if (k === 'callout' && !data.id) return null;
  c.event = { k, data };
  return eventView(save);
}
export function eventView(save) {
  const e = save.c.event; if (!e) return null; const E = EVENTS[e.k];
  return { title: E.title, text: E.text(save, e.data), choices: E.choices.map(x => ({ label: x.label, tip: x.tip })) };
}
export function resolveEvent(save, i) {
  const e = save.c.event; if (!e) return '';
  const E = EVENTS[e.k], r = rng(save);
  const ch = E.choices[i] || E.choices[0];
  save.c.event = null;
  const out = ch.fx(save, e.data, r);
  saveRng(save.world, r);
  return out;
}
export function callout(save, oid) {
  const p = player(save), w = save.world, r = rng(save);
  const k = pairKey(p.id, oid);
  w.heat[k] = clamp((w.heat[k] || 0) + 30, 0, 100);
  p.hype = clamp(p.hype + 2, 0, 100);
  const o = w.f[oid];
  const answered = r.chance(0.55 + p.hype / 300);
  saveRng(w, r);
  if (answered) { save.c.callout = oid; refreshOffers(save); return `${o.first} ${o.last} accepts the challenge! Check your fight offers.`; }
  return `${o.first} ${o.last} laughs it off: "Get a few more wins, kid."`;
}
export function changeDivision(save, to) {
  const p = player(save), w = save.world;
  if (!w.div[to]) return 'That division is not available.';
  for (const d of beltsOf(save)) if (d === p.div) { w.div[d].champ = null; w.news.unshift({ wk: w.wk, txt: `${fullName(p)} vacates the ${divName(d)} title to move to ${divName(to)}.`, kind: 'title' }); }
  const up = DIVISIONS.findIndex(d => d.id === to) > DIVISIONS.findIndex(d => d.id === p.div);
  p.div = to; p.rp -= 30;
  if (up) { p.attrs.pow = clamp(p.attrs.pow + 1, 20, 99); p.attrs.spd = clamp(p.attrs.spd - 2, 20, 99); p.attrs.chin = clamp(p.attrs.chin - 1, 20, 99); }
  else { p.attrs.spd = clamp(p.attrs.spd + 2, 20, 99); p.attrs.cardio = clamp(p.attrs.cardio - 3, 20, 99); }
  pushLog(save, `Moved ${up ? 'up' : 'down'} to ${divName(to)}.`);
  refreshOffers(save);
  return `Welcome to ${divName(to)}.` + (up ? ' More power, a little slower.' : ' Faster, but the cut will hurt your gas tank.');
}
// ---- legacy ----
export function legacy(save) {
  const c = save.c, p = player(save);
  const wins = c.recs.filter(r => r.res === 'W');
  const fin = wins.filter(r => r.m !== 'DEC').length;
  const ranked = wins.filter(r => r.orank != null).length;
  const champWins = wins.filter(r => r.orank === 0).length;
  const parts = [
    ['Wins', wins.length * 10], ['Finishes', fin * 5], ['Wins over ranked fighters', ranked * 12], ['Wins over champions', champWins * 30],
    ['Title wins', c.titleWins * 70], ['Title defenses', c.defenses * 45], ['Double champ', c.doubleChamp ? 150 : 0],
    ['Peak popularity', Math.round(p.pop * 1.5)], ['Losses', -c.recs.filter(r => r.res === 'L').length * 4],
  ];
  const score = Math.max(0, parts.reduce((s, x) => s + x[1], 0));
  const tier = score >= 1700 ? 'GOAT candidate' : score >= 1050 ? 'Hall of Famer' : score >= 650 ? 'Champion-level career' : score >= 350 ? 'Contender' : score >= 150 ? 'Fan favorite' : 'Journeyman';
  return { score, tier, parts, hof: score >= 1050 };
}
export function retire(save) {
  const c = save.c, p = player(save), w = save.world;
  c.retired = true; c.phase = 'retired'; c.offers = []; p.act = 0;
  for (const d of beltsOf(save)) { w.div[d].champ = null; w.news.unshift({ wk: w.wk, txt: `${fullName(p)} retires as ${divName(d)} champion.`, kind: 'title' }); }
  if (c.booked) { const o = w.f[c.booked.opp]; if (o) o.bk = null; c.booked = null; }
  c.legacy = legacy(save);
  pushLog(save, `Retired at ${p.age} with a record of ${recStr(p)}. Legacy: ${c.legacy.score} (${c.legacy.tier}).`);
  return c.legacy;
}
export function mustRetire(save) { const p = player(save); return p.age >= 43; }
export { REASONS, divName, rankings, rankOf, tierStanding, fullName, recStr, ovr, makeRng };
