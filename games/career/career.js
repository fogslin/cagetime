// Career Mode UI
import * as C from './career-core.js';
import { STYLES, STYLE_KEYS, ARCHETYPES, ATTRS, ATTR_KEYS, COUNTRIES, DIVISIONS, TIERS, GYMS, CAMP_FOCUS, STRATEGIES, STRAT_KEYS, weekLabel, flag, adjacentDivs } from '../shared/data.js';
import { $, $$, esc, avatar, fl, tip, toast, modal, closeModal, initTips, bar, store } from '../shared/ui.js';
import { fmtMoney } from '../shared/rng.js';
import { bookCheck, activeIn } from '../shared/world.js';
import { series, REASONS } from '../shared/rematch.js';
import { methodLabel, cornerAdvice } from '../shared/fight.js';

const app = $('#app');
const SLOTS = [1, 2, 3];
const KEY = (n) => 'ct-career-slot-' + n;
const META = 'ct-career-meta', HOF = 'ct-career-hof';
let slot = null, save = null, tab = 'home', fs = null, strat = 'pressure', post = null, campRep = null, mediaOut = null, rkDiv = null;
const COLS = ['#e5132b', '#f6c343', '#46d39a', '#6aa8ff', '#b06cff', '#ff8a3d', '#ff5fa2', '#3dd6d0', '#e8e8f0', '#8bd346'];

function persist() {
  if (!save || !slot) return;
  save.c.lastPlayed = Date.now();
  const p = C.player(save);
  if (store.set(KEY(slot), save)) {
    const meta = store.get(META, {});
    meta[slot] = { name: C.fullName(p), rec: C.recStr(p), age: p.age, div: C.divName(p.div), tier: TIERS[p.tier].short, belts: C.beltsOf(save).length, retired: save.c.retired, when: weekLabel(save.world.wk), col: p.col, first: p.first, last: p.last };
    store.set(META, meta);
  }
}
const rankTxt = (id) => { const r = C.rankOf(save.world, id); return r === 0 ? '<span class="belt">Champion</span>' : r ? `<span class="tag gold">#${r}</span>` : ''; };
const reasonTag = (r) => r ? `<span class="tag blue">${esc(REASONS[r].label)}</span>${tip(REASONS[r].tip)}` : '';
function fighterLine(f, sub = '') {
  return `<div class="who">${avatar(f, 40, f.isP ? 'you' : '')}<div><div class="nm">${fl(f.cc)} ${esc(f.first)} ${f.nick ? '<span class="gx-dim">"' + esc(f.nick) + '"</span> ' : ''}${esc(f.last)}</div><div class="sub">${esc(C.recStr(f))} · ${esc(STYLES[f.style].name)}${sub ? ' · ' + sub : ''}</div></div></div>`;
}

// ---------- title / slots ----------
function renderTitle() {
  save = null; slot = null; fs = null;
  document.body.classList.remove('ingame');
  const meta = store.get(META, {});
  const hof = store.get(HOF, []);
  app.innerHTML = `
  <div class="gx-grid three">${SLOTS.map(n => {
    const m = meta[n];
    return `<div class="gx-card slot">${m ? `<p class="gx-label">Slot ${n}${m.retired ? ' · retired' : ''}</p>
      <div class="who">${avatar(m, 44)}<div><div class="nm">${esc(m.name)}</div><div class="sub">${esc(m.rec)} · ${esc(m.div)} · ${esc(m.tier)}${m.belts ? ' · 🏆' : ''}</div><div class="sub">Age ${m.age} · ${esc(m.when)}</div></div></div>
      <div class="gx-row"><button class="btn" data-act="load" data-n="${n}">${m.retired ? 'View' : 'Continue'}</button><button class="btn ghost sm" data-act="del" data-n="${n}">Delete</button></div>`
      : `<p class="gx-label">Slot ${n}</p><p class="gx-muted">Empty slot.</p><button class="btn" data-act="new" data-n="${n}">New career</button>`}</div>`;
  }).join('')}</div>
  <div class="gx-card"><h2>How it works</h2><ul class="ticks">
    <li>Build a fictional fighter and start on the regional circuit. Win to earn contracts with bigger promotions.</li>
    <li>Every fight: pick a training camp, cut weight, talk trash (or don't), then call the strategy between rounds.</li>
    <li>The world moves without you: prospects rise, veterans retire, fighters switch divisions and the rankings change every week.</li>
    <li>No endless rematches: you can fight someone at most 3 times, and only when the story calls for it.</li></ul></div>
  <div class="gx-card"><h2>Hall of Fame</h2>${hof.length ? `<div class="tscroll"><table class="gx-table"><thead><tr><th>Fighter</th><th>Record</th><th>Titles</th><th>Legacy</th></tr></thead><tbody>${hof.slice(0, 15).map(h => `<tr><td>${fl(h.cc)} ${esc(h.name)}</td><td>${esc(h.rec)}</td><td>${h.titles}</td><td><b>${h.score}</b> <span class="gx-dim">${esc(h.tier)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="gx-muted">Retire a fighter to see their legacy here. Score 1050+ to be inducted into the Hall of Fame.</p>'}</div>`;
}
// ---------- create ----------
let draft = null;
function renderCreate(n) {
  slot = n;
  draft = draft || { first: '', last: '', nick: '', cc: 'US', div: 'LW', style: 'allround', arch: '', age: 22, col: ['#e5132b', '#f6c343'], extra: {} };
  const base = C.baseAttrs(draft.style, draft.arch);
  const spent = Object.values(draft.extra).reduce((s, x) => s + x, 0);
  const left = C.START_POINTS - spent;
  const prev = { first: draft.first || 'Your', last: draft.last || 'Name', col: draft.col };
  app.innerHTML = `<div class="gx-layout"><div>
  <div class="gx-card"><h2>Create your fighter</h2>
   <div class="gx-grid two">
    <label class="fld"><span>First name</span><input id="cf-first" maxlength="18" value="${esc(draft.first)}" placeholder="First name" autocomplete="off"></label>
    <label class="fld"><span>Last name</span><input id="cf-last" maxlength="20" value="${esc(draft.last)}" placeholder="Last name" autocomplete="off"></label>
    <label class="fld"><span>Nickname (optional)</span><input id="cf-nick" maxlength="20" value="${esc(draft.nick)}" placeholder="The Hammer" autocomplete="off"></label>
    <label class="fld"><span>Country</span><select id="cf-cc">${COUNTRIES.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.cc}" ${c.cc === draft.cc ? 'selected' : ''}>${flag(c.cc)} ${esc(c.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>Weight class</span><select id="cf-div">${DIVISIONS.map(d => `<option value="${d.id}" ${d.id === draft.div ? 'selected' : ''}>${esc(d.name)} (${d.lbs} lb)</option>`).join('')}</select></label>
    <label class="fld"><span>Starting age ${tip('Younger fighters have more years to grow. Older fighters start more polished but peak sooner.')}</span><select id="cf-age">${[19, 21, 23, 25, 27].map(a => `<option value="${a}" ${a === draft.age ? 'selected' : ''}>${a}${a <= 21 ? ' (raw, long runway)' : a >= 25 ? ' (polished, +points)' : ''}</option>`).join('')}</select></label>
   </div>
   <p class="gx-label">Base style</p>
   <div class="choice two">${STYLE_KEYS.map(k => `<label><input type="radio" name="cf-style" value="${k}" ${k === draft.style ? 'checked' : ''}><span><b>${esc(STYLES[k].name)}</b><small>${esc(STYLES[k].tip)}</small></span></label>`).join('')}</div>
   <label class="fld" style="margin-top:12px"><span>Inspired-by archetype (optional) ${tip('A style template like "pressure boxer with an iron chin". It adds small bonuses. No real fighters are used.')}</span><select id="cf-arch"><option value="">None</option>${ARCHETYPES.filter(a => a.style === draft.style).map(a => `<option value="${a.id}" ${a.id === draft.arch ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
  </div>
  <div class="gx-card"><div class="gx-row gx-sp"><h2 style="margin:0">Attributes</h2><span class="tag ${left ? 'gold' : 'green'}">${left} points left</span></div>
   <p class="gx-small gx-muted">Spend ${C.START_POINTS} points. Max ${C.ATTR_MAX_START} at the start. You'll grow through training camps.</p>
   ${ATTRS.map(([k, nm, d]) => { const v = base[k] + (draft.extra[k] || 0); return `<div class="attr-row"><span>${esc(nm)} ${tip(d)}</span>${bar(v, 100)}<span class="ctl2"><button type="button" class="ghost btn" data-act="att" data-k="${k}" data-d="-1" aria-label="Lower ${esc(nm)}" ${draft.extra[k] ? '' : 'disabled'}>−</button><b>${v}</b><button type="button" class="btn" data-act="att" data-k="${k}" data-d="1" aria-label="Raise ${esc(nm)}" ${left > 0 && v < C.ATTR_MAX_START ? '' : 'disabled'}>+</button></span></div>`; }).join('')}
   <div class="gx-row" style="margin-top:8px"><button class="btn ghost sm" data-act="att-rand">Auto-assign</button><button class="btn ghost sm" data-act="att-reset">Reset</button></div>
  </div></div>
  <div class="gx-side"><div class="gx-card"><p class="gx-label">Appearance</p>
   <div class="gx-row">${avatar(prev, 72, 'you').replace('class="av', 'id="cf-prev" class="av')}<div><div class="nm" id="cf-pname" style="font:700 20px/1.1 var(--head);text-transform:uppercase">${esc(prev.first)} ${esc(prev.last)}</div><div class="gx-dim gx-small">${esc(STYLES[draft.style].name)} · ${esc(DIVISIONS.find(d => d.id === draft.div).name)}</div></div></div>
   <p class="gx-small gx-muted" style="margin:12px 0 6px">Primary color</p><div class="swatches">${COLS.map(c => `<button type="button" aria-label="Color ${c}" class="${draft.col[0] === c ? 'sel' : ''}" style="background:${c}" data-act="col" data-i="0" data-c="${c}"></button>`).join('')}</div>
   <p class="gx-small gx-muted" style="margin:12px 0 6px">Secondary color</p><div class="swatches">${COLS.map(c => `<button type="button" aria-label="Color ${c}" class="${draft.col[1] === c ? 'sel' : ''}" style="background:${c}" data-act="col" data-i="1" data-c="${c}"></button>`).join('')}</div>
   <div class="gx-row" style="margin-top:16px"><button class="btn" data-act="start">Start career</button><button class="btn ghost" data-act="title">Back</button></div>
  </div></div></div>`;
  const sync = () => { draft.first = $('#cf-first').value.trim(); draft.last = $('#cf-last').value.trim(); draft.nick = $('#cf-nick').value.trim(); };
  ['#cf-first', '#cf-last', '#cf-nick'].forEach(s => $(s).addEventListener('input', () => {
    sync();
    const pv = $('#cf-prev'); if (pv) pv.outerHTML = avatar({ first: draft.first || 'Your', last: draft.last || 'Name', col: draft.col }, 72, 'you').replace('class="av', 'id="cf-prev" class="av');
    const nm = $('#cf-pname'); if (nm) nm.textContent = (draft.first || 'Your') + ' ' + (draft.last || 'Name');
  }));
  $('#cf-cc').onchange = (e) => { sync(); draft.cc = e.target.value; };
  $('#cf-div').onchange = (e) => { sync(); draft.div = e.target.value; renderCreate(n); };
  $('#cf-age').onchange = (e) => { sync(); draft.age = +e.target.value; renderCreate(n); };
  $('#cf-arch').onchange = (e) => { sync(); draft.arch = e.target.value; draft.extra = {}; renderCreate(n); };
  $$('input[name=cf-style]').forEach(r => r.onchange = () => { sync(); draft.style = r.value; draft.arch = ''; draft.extra = {}; renderCreate(n); });
}
function startCareer() {
  draft.first = $('#cf-first').value.trim(); draft.last = $('#cf-last').value.trim(); draft.nick = $('#cf-nick').value.trim();
  if (!draft.first || !draft.last) { toast('Give your fighter a first and last name.', 'bad'); ($('#cf-first').value ? $('#cf-last') : $('#cf-first')).focus(); return; }
  const base = C.baseAttrs(draft.style, draft.arch);
  const attrs = {}; for (const k of ATTR_KEYS) attrs[k] = base[k] + (draft.extra[k] || 0);
  const ageBonus = Math.max(0, draft.age - 22);
  for (const k of ATTR_KEYS) attrs[k] = Math.min(80, attrs[k] + Math.round(ageBonus * 0.6));
  app.innerHTML = '<p class="gx-muted">Building the fight world…</p>';
  setTimeout(() => {
    save = C.newCareer({ ...draft, attrs });
    draft = null; tab = 'home'; persist(); renderHub();
    toast('Welcome to the fight game. Pick your first fight!', 'good');
  }, 30);
}
// ---------- hub ----------
function header() {
  const p = C.player(save), w = save.world, c = save.c;
  const belts = C.beltsOf(save);
  const st = p.tier === 2 ? (C.rankOf(w, p.id) === 0 ? 'Champion' : C.rankOf(w, p.id) ? '#' + C.rankOf(w, p.id) + ' ranked' : 'Unranked') : `#${C.tierStanding(w, p.id)} on ${TIERS[p.tier].short}`;
  return `<div class="gx-card hl"><div class="gx-row gx-sp"><div class="who">${avatar(p, 60, 'you')}<div>
    <div class="nm" style="font:700 22px/1.1 var(--head);text-transform:uppercase">${fl(p.cc)} ${esc(p.first)} ${p.nick ? '<span class="gx-gold">"' + esc(p.nick) + '"</span> ' : ''}${esc(p.last)}</div>
    <div class="sub">${esc(C.recStr(p))} · ${esc(C.divName(p.div))} · ${esc(TIERS[p.tier].name)} · ${esc(st)}</div>
    <div class="sub">Age ${p.age} · ${esc(STYLES[p.style].name)} · ${esc(C.gymById(c.gym).name)} · ${esc(weekLabel(w.wk))}</div></div></div>
    <div class="gx-row">${belts.map(d => `<span class="belt">🏆 ${esc(C.divName(d))}</span>`).join('')}${c.doubleChamp ? '<span class="tag gold">Double champ</span>' : ''}</div></div>
    <div class="stats4" style="margin-top:12px">
     <div class="stat"><small>Money ${tip('Purses minus 10% manager fee. Spend it on better gyms and rehab.')}</small><b>${fmtMoney(c.money)}</b></div>
     <div class="stat"><small>Hype ${tip('Short-term buzz. Raises purses and wins negotiations. Fades if you sit out.')}</small><b>${Math.round(p.hype)}</b>${bar(p.hype, 100, 'gold')}</div>
     <div class="stat"><small>Popularity ${tip('Long-term fan base. Unlocks sponsors and big-money grudge matches.')}</small><b>${Math.round(p.pop)}</b>${bar(p.pop, 100, 'blue')}</div>
     <div class="stat"><small>Condition</small><b>${p.inj > 0 ? `<span class="gx-red">Injured ${p.inj}w</span>` : '<span class="gx-green">Healthy</span>'}</b><span class="gx-dim gx-small">Contract: ${c.contract.left} fight${c.contract.left === 1 ? '' : 's'} left</span></div>
    </div></div>`;
}
function renderHub() {
  if (!save) return renderTitle();
  document.body.classList.add('ingame');
  const c = save.c;
  if (c.retired) return renderRetired();
  if (c.phase === 'camp' && c.booked) return renderCamp();
  if (c.phase === 'media' && c.booked) return renderMedia();
  if (c.phase === 'fight' && c.booked) return renderFight();
  if (c.phase !== 'hub') c.phase = 'hub';
  const tabs = [['home', 'Fight HQ'], ['record', 'Record'], ['rivals', 'Rivals'], ['rank', 'Rankings'], ['news', 'News']];
  app.innerHTML = header() + `<div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${tab === k}" data-act="tab" data-t="${k}">${n}</button>`).join('')}</div><div id="tabp"></div>`;
  const tp = $('#tabp');
  if (tab === 'home') tp.innerHTML = homeTab();
  if (tab === 'record') tp.innerHTML = recordTab();
  if (tab === 'rivals') tp.innerHTML = rivalsTab();
  if (tab === 'rank') tp.innerHTML = rankTab();
  if (tab === 'news') tp.innerHTML = newsTab();
  if (tab === 'rank') { const s = $('#rk-div'); if (s) s.onchange = () => { rkDiv = s.value; renderHub(); }; }
}
function homeTab() {
  const c = save.c, w = save.world, p = C.player(save);
  let h = '<div class="gx-layout"><div>';
  if (c.pending) {
    h += `<div class="gx-card event-card"><p class="gx-label">Contract</p><h2>${esc(c.pending.text)}</h2>${c.pending.offers.map((o, i) => `<div class="gx-card" style="background:#0f0f14"><div class="gx-row gx-sp"><div><b>${esc(o.label)}</b><div class="gx-dim gx-small">${esc(TIERS[o.tier].name)} · ${o.fights} fights · ${fmtMoney(o.show)} to show / ${fmtMoney(o.win)} to win</div></div></div>
      <div class="gx-row" style="margin-top:10px"><button class="btn sm" data-act="neg" data-i="${i}" data-a="0">Sign it</button><button class="btn ghost sm" data-act="neg" data-i="${i}" data-a="1">Ask +25% ${tip('Works more often with high hype.')}</button><button class="btn ghost sm" data-act="neg" data-i="${i}" data-a="2">Demand +60% ${tip('Risky. They may walk away and you fall back to your safest option.')}</button></div></div>`).join('')}</div>`;
  } else if (c.event) {
    const e = C.eventView(save);
    h += `<div class="gx-card event-card"><p class="gx-label">Breaking</p><h2>${esc(e.title)}</h2><p>${esc(e.text)}</p><div class="gx-row">${e.choices.map((x, i) => `<button class="btn ${i ? 'ghost' : ''}" data-act="evt" data-i="${i}">${esc(x.label)}</button>${tip(x.tip)}`).join('')}</div></div>`;
  } else if (C.mustRetire(save)) {
    h += `<div class="gx-card event-card"><h2>Your body says it's time</h2><p>At ${p.age}, the doctors will not clear you to fight any more.</p><button class="btn gold" data-act="retire">Retire and see your legacy</button></div>`;
  } else if (p.inj > 0) {
    h += `<div class="gx-card"><h2>Injured</h2><p>You're out for ${p.inj} more week${p.inj === 1 ? '' : 's'}.</p><div class="gx-row"><button class="btn" data-act="rest" data-w="${p.inj}">Rest and recover</button>${c.money > 2000 ? `<button class="btn ghost" data-act="rehab">Pay ${fmtMoney(1000 + p.tier * 3000)} for rehab (halve it)</button>` : ''}</div></div>`;
  } else {
    h += `<div class="gx-card"><div class="gx-row gx-sp"><h2 style="margin:0">Fight offers</h2><span class="gx-dim gx-small">${esc(weekLabel(w.wk))}</span></div><div class="gx-grid" style="margin-top:12px">`;
    if (!c.offers.length) h += '<p class="gx-muted">No offers right now. Give it a couple of weeks.</p>';
    c.offers.forEach((of, i) => {
      const o = w.f[of.opp]; const s = series(w.h2h, p.id, o.id);
      const labels = { title: ['Title shot', 'gold'], defense: ['Title defense', 'gold'], superfight: ['Champ vs champ', 'gold'], short: ['Short notice', 'red'], 'step-up': ['Step-up', 'green'], 'tune-up': ['Tune-up', ''], even: ['Even match', ''], rematch: ['Rematch', 'blue'], callout: ['Callout accepted', 'red'] };
      const lb = labels[of.type] || ['Fight', ''];
      h += `<div class="gx-card offer ${of.title ? 'hl' : ''}" style="margin:0;background:#0f0f14"><div class="top">${fighterLine(o, (C.rankOf(w, o.id) === 0 ? 'Champion' : C.rankOf(w, o.id) ? '#' + C.rankOf(w, o.id) : 'Unranked'))}</div>
        <div class="gx-row"><span class="tag ${lb[1]}">${lb[0]}</span>${of.short ? '' : ''}${of.title ? `<span class="tag gold">${esc(C.divName(of.div))} title · 5 rounds</span>` : ''}${reasonTag(of.reason)}${s.n ? `<span class="tag">H2H: ${s.aw}-${s.bw}${s.dn ? '-' + s.dn : ''} · meeting ${s.n + 1} of 3 max</span>` : ''}</div>
        <div class="gx-row gx-sp"><span class="gx-small"><b>${fmtMoney(of.show)}</b> show + <b>${fmtMoney(of.win)}</b> win · ${of.weeks}-week camp</span><span class="gx-row"><button class="btn ghost sm" data-act="scout" data-id="${o.id}">Scout</button><button class="btn sm" data-act="accept" data-i="${i}">Accept</button></span></div></div>`;
    });
    h += `</div><div class="gx-row" style="margin-top:12px"><button class="btn ghost sm" data-act="decline">Decline all · wait 2 weeks</button><button class="btn ghost sm" data-act="rest" data-w="4">Rest 4 weeks</button><button class="btn ghost sm" data-act="callout-m">Call someone out</button></div></div>`;
  }
  // attributes
  h += `<div class="gx-card"><div class="gx-row gx-sp"><h2 style="margin:0">Attributes</h2><span class="tag gold">OVR ${C.ovr(p.attrs)}</span></div>${ATTRS.map(([k, nm, d]) => `<div class="attr-row"><span>${esc(nm)} ${tip(d)}</span>${bar(p.attrs[k], 100, p.attrs[k] >= 80 ? 'gold' : '')}<b>${Math.round(p.attrs[k])}</b></div>`).join('')}</div>`;
  h += '</div><div class="gx-side">';
  h += `<div class="gx-card"><h3>Career</h3><div class="gx-small">
    <div class="gx-row gx-sp"><span class="gx-muted">Earnings</span><b>${fmtMoney(c.earned)}</b></div>
    <div class="gx-row gx-sp"><span class="gx-muted">Title wins / defenses</span><b>${c.titleWins} / ${c.defenses}</b></div>
    <div class="gx-row gx-sp"><span class="gx-muted">Peak ranking</span><b>${c.peakRank === 0 ? 'Champion' : c.peakRank ? '#' + c.peakRank : '—'}</b></div>
    <div class="gx-row gx-sp"><span class="gx-muted">Streak</span><b>${p.streak > 0 ? 'W' + p.streak : p.streak < 0 ? 'L' + -p.streak : '—'}</b></div>
    <div class="gx-row gx-sp"><span class="gx-muted">Sponsors</span><b>${c.sponsors.length ? c.sponsors.map(s => esc(s.name)).join(', ') : 'None'}</b></div>
    <div class="gx-row gx-sp"><span class="gx-muted">Legacy so far</span><b>${C.legacy(save).score}</b></div></div>
    <div class="gx-row" style="margin-top:12px"><button class="btn ghost sm" data-act="div-m">Change division</button><button class="btn ghost sm" data-act="gym-m">Gyms</button><button class="btn ghost sm" data-act="retire-m">Retire</button><button class="btn ghost sm" data-act="title">Save &amp; exit</button></div></div>`;
  h += `<div class="gx-card"><h3>Your story</h3><ul class="news">${c.log.slice(0, 8).map(l => `<li><time>${esc(weekLabel(l.wk))}</time>${esc(l.txt)}</li>`).join('')}</ul></div>`;
  h += '</div></div>';
  return h;
}
function recordTab() {
  const c = save.c, p = C.player(save);
  const W = c.recs.filter(r => r.res === 'W'), L = c.recs.filter(r => r.res === 'L');
  const by = (arr, m) => arr.filter(r => m === 'KO' ? (r.m === 'KO' || r.m === 'TKO') : r.m === m).length;
  let h = `<div class="gx-card"><h2>Pro record ${esc(C.recStr(p))}</h2><div class="stats4">
    <div class="stat"><small>Wins by KO/TKO</small><b>${by(W, 'KO')}</b></div><div class="stat"><small>Wins by sub</small><b>${by(W, 'SUB')}</b></div>
    <div class="stat"><small>Wins by decision</small><b>${by(W, 'DEC')}</b></div><div class="stat"><small>Losses (KO/SUB/DEC)</small><b>${by(L, 'KO')}/${by(L, 'SUB')}/${by(L, 'DEC')}</b></div></div></div>`;
  h += `<div class="gx-card"><div class="tscroll"><table class="gx-table"><thead><tr><th>Res.</th><th>Record</th><th>Opponent</th><th>Method</th><th>Rd</th><th>Time</th><th>Event</th><th>Date</th></tr></thead><tbody>`;
  let w = 0, l = 0, d = 0, nc = 0; const rows = [];
  for (const r of c.recs) {
    if (r.res === 'W') w++; else if (r.res === 'L') l++; else if (r.res === 'D') d++; else nc++;
    rows.push(`<tr><td><span class="res ${r.res}">${r.res}</span></td><td>${w}-${l}-${d}${nc ? ' (' + nc + ')' : ''}</td><td>${fl(r.cc)} ${esc(r.on)} <span class="gx-dim gx-small">${esc(r.orec)}</span>${r.title ? ` <span class="tag gold">${r.tn === 'defense' ? 'Title defense' : r.tn ? 'Title win' : 'Title fight'}</span>` : ''}${r.reason ? ' ' + `<span class="tag blue">${esc(REASONS[r.reason].label)}</span>` : ''}</td><td>${esc(methodLabel({ method: r.m, detail: r.det }))}</td><td>${r.r}</td><td>${esc(r.t)}</td><td class="gx-small">${esc(r.ev)}</td><td class="gx-small">${esc(weekLabel(r.wk))}</td></tr>`);
  }
  h += rows.reverse().join('') + '</tbody></table></div>' + (c.recs.length ? '' : '<p class="gx-muted">No pro fights yet.</p>') + '</div>';
  return h;
}
function rivalsTab() {
  const c = save.c, w = save.world, p = C.player(save);
  const opp = {};
  for (const r of c.recs) { (opp[r.opp] = opp[r.opp] || { name: r.on, cc: r.cc, list: [] }).list.push(r); }
  const rows = Object.entries(opp).sort((a, b) => b[1].list.length - a[1].list.length || b[1].list.at(-1).wk - a[1].list.at(-1).wk);
  let h = `<div class="gx-card"><h2>Rivalries & head-to-head ${tip('You can fight one opponent at most 3 times. A rematch needs a reason: a close or controversial result, a title rematch, a 1-1 trilogy, a draw or no contest, or a big-money grudge.')}</h2><div class="tscroll"><table class="gx-table"><thead><tr><th>Opponent</th><th>Meetings</th><th>Series</th><th>Results</th><th>Rematch status</th></tr></thead><tbody>`;
  for (const [id, o] of rows) {
    const s = series(w.h2h, p.id, id); const f = w.f[id];
    let status;
    if (!f || !f.act) status = '<span class="gx-dim">Retired</span>';
    else if (s.n >= 3) status = '<span class="gx-dim">Closed: 3 meetings</span>';
    else if (s.aw >= 2) status = '<span class="gx-dim">Closed: you beat them twice</span>';
    else if (s.bw >= 2) status = '<span class="gx-dim">Closed: they beat you twice</span>';
    else { const bc = bookCheck(w, p.id, id); status = bc.ok ? `<span class="gx-green">Open: ${esc(REASONS[bc.reason].label)}</span>` : `<span class="gx-muted">${esc(bc.why)}</span>`; }
    const heat = w.heat[[p.id, id].sort().join('|')] || 0;
    h += `<tr><td>${fl(o.cc)} ${esc(o.name)}${heat >= 30 ? ' <span class="tag red">Heat ' + heat + '</span>' : ''}</td><td>${s.n}</td><td>${s.aw}-${s.bw}${s.dn ? '-' + s.dn : ''}</td><td>${o.list.map(r => `<span class="res ${r.res}" title="${esc(methodLabel({ method: r.m, detail: r.det }))} R${r.r}">${r.res}</span>`).join(' ')}</td><td class="gx-small">${status}</td></tr>`;
  }
  h += '</tbody></table></div>' + (rows.length ? '' : '<p class="gx-muted">Fight someone first.</p>') + '</div>';
  return h;
}
function rankTab() {
  const w = save.world, p = C.player(save);
  const div = rkDiv && w.div[rkDiv] ? rkDiv : p.div;
  const D = w.div[div];
  const champ = D.champ && w.f[D.champ];
  const ranks = C.rankings(w, div).map(id => w.f[id]);
  let h = `<div class="gx-card"><div class="gx-row gx-sp"><h2 style="margin:0">Stormvale rankings</h2><select id="rk-div" aria-label="Division">${w.divs.map(d => `<option value="${d}" ${d === div ? 'selected' : ''}>${esc(C.divName(d))}</option>`).join('')}</select></div>
   <div class="gx-card hl" style="margin-top:12px;background:#0f0f14">${champ ? `<p class="gx-label">Champion · ${D.def} defense${D.def === 1 ? '' : 's'}</p>${fighterLine(champ)}` : '<p class="gx-muted">Title vacant</p>'}</div>
   <div class="tscroll"><table class="gx-table"><thead><tr><th>#</th><th>Fighter</th><th>Record</th><th>Streak</th><th>Age</th></tr></thead><tbody>${ranks.map((f, i) => `<tr class="${f.isP ? 'me' : ''}"><td>${i + 1}</td><td>${fl(f.cc)} ${esc(f.first)} ${esc(f.last)}</td><td>${esc(C.recStr(f))}</td><td>${f.streak > 0 ? 'W' + f.streak : f.streak < 0 ? 'L' + -f.streak : '—'}</td><td>${f.age}</td></tr>`).join('')}</tbody></table></div>
   <p class="gx-small gx-dim">Title lineage: ${D.hist.slice(-6).map(x => esc(x.name)).join(' → ')}</p></div>`;
  if (p.tier < 2 && div === p.div) {
    const list = activeIn(w, p.div, p.tier).sort((a, b) => b.rp - a.rp).slice(0, 12);
    h += `<div class="gx-card"><h2>${esc(TIERS[p.tier].name)} standings</h2><div class="tscroll"><table class="gx-table"><tbody>${list.map((f, i) => `<tr class="${f.isP ? 'me' : ''}"><td>${i + 1}</td><td>${fl(f.cc)} ${esc(f.first)} ${esc(f.last)}</td><td>${esc(C.recStr(f))}</td><td>${f.streak > 0 ? 'W' + f.streak : f.streak < 0 ? 'L' + -f.streak : '—'}</td></tr>`).join('')}</tbody></table></div>${list.some(f => f.isP) ? '' : `<p class="gx-small gx-muted">You: #${C.tierStanding(w, p.id)}</p>`}</div>`;
  }
  return h;
}
function newsTab() {
  const w = save.world;
  return `<div class="gx-grid two"><div class="gx-card"><h2>Around the sport</h2><ul class="news">${w.news.slice(0, 30).map(n => `<li><time>${esc(weekLabel(n.wk))}</time>${esc(n.txt)}</li>`).join('') || '<li class="gx-muted">Quiet week.</li>'}</ul></div>
   <div class="gx-card"><h2>Year-end awards</h2>${w.awards.length ? w.awards.slice(0, 6).map(a => `<div style="margin-bottom:10px"><p class="gx-label">${a.year}</p><div class="gx-small">Fighter of the Year: <b>${esc(a.foy ? a.foy.name : '—')}</b><br>Knockout of the Year: ${esc(a.koy ? a.koy.txt : '—')}<br>Fight of the Year: ${esc(a.fotn ? a.fotn.txt : '—')}<br>Upset of the Year: ${esc(a.upset ? a.upset.txt : '—')}</div></div>`).join('') : '<p class="gx-muted">Awards are handed out at the end of each year.</p>'}</div></div>`;
}
function scoutHtml(o) {
  const p = C.player(save), w = save.world, s = series(w.h2h, p.id, o.id);
  return `<p class="gx-label">Scouting report</p>${fighterLine(o, C.divName(o.div))}
   <p class="gx-small gx-muted" style="margin-top:8px">${esc(STYLES[o.style].tip)}${o.arch ? ' Archetype: ' + esc(ARCHETYPES.find(a => a.id === o.arch).name) + '.' : ''} Age ${o.age}. Last fights: ${o.recent.slice(-5).map(r => `<span class="res ${r === 'N' ? 'NC' : r}">${r}</span>`).join(' ') || '—'}</p>
   <div class="tape" style="margin-top:10px"><b class="l">You</b><span class="c"></span><b>${esc(o.last)}</b>
   ${ATTRS.map(([k, nm]) => { const a = Math.round(p.attrs[k]), b = Math.round(o.attrs[k]); return `<b class="l ${a > b + 3 ? 'win' : ''}">${a}</b><span class="c">${esc(nm)}</span><b class="${b > a + 3 ? 'win' : ''}">${b}</b>`; }).join('')}</div>
   ${s.n ? `<p class="gx-small">Head-to-head: ${s.aw}-${s.bw}${s.dn ? '-' + s.dn : ''}</p>` : ''}`;
}
// ---------- camp ----------
function renderCamp() {
  const c = save.c, w = save.world, b = c.booked, o = w.f[b.opp], p = C.player(save);
  if (campRep) {
    const g = campRep.gains;
    app.innerHTML = header() + `<div class="gx-card"><p class="gx-label">Camp report</p><h2>Fight week: ${esc(b.ev)}</h2>${campRep.lines.map(l => `<p>${esc(l)}</p>`).join('')}
     ${campRep.injury ? `<p class="gx-red">${esc(campRep.injury)}</p>` : ''}
     <div class="gx-row">${Object.entries(g).filter(([, v]) => v > 0).map(([k, v]) => `<span class="tag green">${esc(ATTRS.find(a => a[0] === k)[1])} +${v}</span>`).join('') || '<span class="gx-muted">No attribute gains this camp.</span>'}</div>
     <div class="gx-row" style="margin-top:14px"><button class="btn" data-act="to-media">On to fight week</button></div></div>`;
    return;
  }
  const allowed = (g) => C.gymAllowed(save, g) || g.id === c.gym;
  app.innerHTML = header() + `<div class="gx-layout"><div><div class="gx-card hl"><p class="gx-label">${b.title ? 'Title fight · ' : ''}${esc(b.ev)} · ${esc(weekLabel(b.wk))}</p><h2>Training camp vs ${esc(o.first)} ${esc(o.last)}</h2>
   ${b.short ? '<p class="gx-gold">Short notice! Smaller gains and you will not be at 100% cardio.</p>' : ''}
   <p class="gx-label" style="margin-top:12px">Gym / head coach</p><div class="choice two">${GYMS.map(g => `<label><input type="radio" name="gym" value="${g.id}" ${g.id === c.gym ? 'checked' : ''} ${allowed(g) ? '' : 'disabled'}><span><b>${esc(g.name)}</b> <span class="gx-dim">${'★'.repeat(g.q)}</span><small>${esc(g.tip)} ${g.cost ? fmtMoney(g.cost) + ' per camp' : 'Free'}${allowed(g) ? '' : ' · locked (' + (c.money < g.cost ? 'not enough money' : 'needs a bigger contract') + ')'}</small></span></label>`).join('')}</div>
   <p class="gx-label" style="margin-top:14px">Camp focus</p><div class="choice two">${Object.entries(CAMP_FOCUS).map(([k, f], i) => `<label><input type="radio" name="focus" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${esc(f.name)}</b><small>${esc(f.tip)}</small></span></label>`).join('')}</div>
   <p class="gx-label" style="margin-top:14px">Intensity</p><div class="choice two">${Object.entries(C.INTENSITY).map(([k, f]) => `<label><input type="radio" name="int" value="${k}" ${k === 'normal' ? 'checked' : ''}><span><b>${esc(f.name)}</b><small>${esc(f.tip)}</small></span></label>`).join('')}</div>
   <div class="choice" style="margin-top:10px"><label><input type="checkbox" id="spar" checked><span><b>Hard sparring</b><small>+25% gains, but injury risk goes way up.</small></span></label></div>
   <p class="gx-label" style="margin-top:14px">Weight cut</p><div class="choice two">${Object.entries(C.CUTS).map(([k, f]) => `<label><input type="radio" name="cut" value="${k}" ${k === 'normal' ? 'checked' : ''}><span><b>${esc(f.name)}</b><small>${esc(f.tip)}</small></span></label>`).join('')}</div>
   <div class="gx-row" style="margin-top:16px"><button class="btn" data-act="camp">Start camp</button></div></div></div>
   <div class="gx-side"><div class="gx-card">${scoutHtml(o)}</div></div></div>`;
}
function renderMedia() {
  const c = save.c, w = save.world, b = c.booked, o = w.f[b.opp], p = C.player(save);
  const ranked = C.rankOf(w, p.id) != null && C.rankOf(w, p.id) > 0;
  app.innerHTML = header() + `<div class="gx-card hl"><p class="gx-label">Fight week · press conference</p><h2>${esc(p.last)} vs ${esc(o.last)}</h2>
   ${mediaOut ? mediaOut.map(l => `<p>${esc(l)}</p>`).join('') + '<button class="btn" data-act="to-fight">Walk out</button>' :
    `<p class="gx-muted">The mics are on. How do you sell this fight?</p><div class="gx-grid two">${Object.entries(C.MEDIA).filter(([k]) => k !== 'callout' || ranked).map(([k, m]) => `<button class="btn ghost" data-act="media" data-k="${k}" style="flex-direction:column;align-items:flex-start;text-transform:none;font-family:var(--body);letter-spacing:0;min-height:64px"><b>${esc(m.name)}</b><small class="gx-muted">${esc(m.tip)}</small></button>`).join('')}</div>`}</div>`;
}
// ---------- fight ----------
function renderFight() {
  document.body.classList.add('ingame');
  const c = save.c, w = save.world, b = c.booked;
  if (!fs) fs = C.startFight(save);
  const A = fs.A, B = fs.B;
  const momPos = 50 + fs.mom / 2;
  const allLogs = fs.roundLogs.map((l, i) => `<p class="rd"><span>Round ${i + 1}</span></p>` + l.map(x => `<p class="${x.cls}"><time>${esc(x.t)}</time><span>${esc(x.txt)}</span></p>`).join('')).join('');
  const corner = fs.cards[0].reduce((s, x) => [s[0] + x[0], s[1] + x[1]], [0, 0]);
  const statRow = (nm, a, bb) => `<b class="l ${a > bb ? 'win' : ''}">${a}</b><span class="c">${nm}</span><b class="${bb > a ? 'win' : ''}">${bb}</b>`;
  let ctl;
  if (!fs.over) {
    const last = fs.roundLogs[fs.r - 1];
    const recap = last ? last.filter(x => x.cls === 'big' || x.cls === 'warn').concat(last.filter(x => !x.cls)).slice(0, 4) : [];
    const rs = fs.roundStats[fs.r - 1];
    ctl = (last ? `<p class="gx-label">Round ${fs.r} recap</p><p class="gx-small">You landed <b>${rs.A.sig}</b> sig. strikes to <b>${rs.B.sig}</b>${rs.A.td || rs.B.td ? `, takedowns ${rs.A.td}-${rs.B.td}` : ''}${rs.A.kd || rs.B.kd ? `, knockdowns ${rs.A.kd}-${rs.B.kd}` : ''}.</p><ul class="ticks">${recap.map(x => `<li>${esc(x.txt)}</li>`).join('')}</ul>` : '') + `<p class="gx-label">Corner advice before round ${fs.r + 1} of ${fs.rounds}</p><ul class="ticks">${cornerAdvice(fs, 'A').map(t => `<li>${esc(t)}</li>`).join('')}</ul>
     <p class="gx-label" style="margin-top:12px">Strategy for round ${fs.r + 1}</p>
     <div class="strats">${STRAT_KEYS.map(k => `<button class="btn ghost ${strat === k ? 'sel' : ''}" data-act="strat" data-k="${k}" aria-pressed="${strat === k}"><b>${esc(STRATEGIES[k].name)}</b><small>${esc(STRATEGIES[k].tip)}</small></button>`).join('')}</div>
     <div class="gx-row" style="margin-top:12px"><button class="btn" data-act="round">Fight round ${fs.r + 1}</button><button class="btn ghost sm" data-act="simall">Sim to the end</button></div>`;
  } else {
    const r = fs.result; const res = r.winner === 'A' ? 'W' : r.winner === 'B' ? 'L' : r.method === 'NC' ? 'NC' : 'D';
    ctl = `<div class="big-res ${res}">${res === 'W' ? 'Victory' : res === 'L' ? 'Defeat' : r.method === 'NC' ? 'No contest' : 'Draw'}</div><p><b>${esc(methodLabel(r))}</b> · Round ${r.round}, ${esc(r.time)}</p>
     ${r.totals ? `<div class="scard">${r.totals.map((t, i) => `<div>Judge ${i + 1}<b>${t[0]}-${t[1]}</b></div>`).join('')}</div>` : ''}
     <div class="gx-row" style="margin-top:14px"><button class="btn" data-act="post">Continue</button></div>`;
  }
  app.innerHTML = `<div class="gx-card hl"><p class="gx-label">${esc(b.ev)}${b.title ? ' · ' + esc(C.divName(b.div)) + ' title' : ''} · ${fs.rounds} rounds</p>
   <div class="gx-row gx-sp">${fighterLine(A.f)}<span class="gx-dim" style="font:700 18px var(--head)">VS</span>${fighterLine(B.f)}</div>
   <div style="margin:12px 0 4px" class="gx-row gx-sp gx-small"><span>Momentum: you</span><span>${esc(B.name)}</span></div>
   <div class="mom" role="img" aria-label="Momentum"><i style="left:${100 - momPos}%"></i></div>
   <div class="tape" style="margin-top:12px">${statRow('Sig. strikes', A.st.sig, B.st.sig)}${statRow('Knockdowns', A.st.kd, B.st.kd)}${statRow('Takedowns', A.st.td + '/' + A.st.tdAtt, B.st.td + '/' + B.st.tdAtt)}${statRow('Sub attempts', A.st.sub, B.st.sub)}${statRow('Control', Math.floor(A.st.ctrl / 60) + ':' + String(Math.round(A.st.ctrl % 60)).padStart(2, '0'), Math.floor(B.st.ctrl / 60) + ':' + String(Math.round(B.st.ctrl % 60)).padStart(2, '0'))}${statRow('Gas tank', Math.round(A.gas) + '%', Math.round(B.gas) + '%')}</div>
   ${fs.r && !fs.over ? `<p class="gx-small gx-muted" style="margin-top:8px">Your corner's unofficial card: ${corner[0]}-${corner[1]}</p>` : ''}</div>
   <div class="gx-layout"><div class="gx-card">${ctl}</div><div class="gx-side"><div class="gx-card"><h3>Play-by-play</h3><div class="pbp" id="pbp">${allLogs || '<p class="dim"><span>The fighters touch gloves…</span></p>'}</div></div></div></div>`;
  const pbp = $('#pbp'); if (pbp) pbp.scrollTop = pbp.scrollHeight;
}
function renderPost() {
  const s = post, r = s.rec;
  app.innerHTML = header() + `<div class="gx-card hl"><div class="big-res ${r.res}">${r.res === 'W' ? 'You win' : r.res === 'L' ? 'You lose' : r.res === 'NC' ? 'No contest' : 'Draw'}</div>
   <p>${esc(r.on)} · ${esc(methodLabel({ method: r.m, detail: r.det }))} · R${r.r} ${esc(r.t)}${r.tn === 'new' || r.tn === 'vacant' ? ' · <b class="gx-gold">AND NEW CHAMPION!</b>' : r.tn === 'defense' ? ' · <b class="gx-gold">Title retained</b>' : ''}</p>
   ${s.lines.map(l => `<p class="gx-gold">${esc(l)}</p>`).join('')}
   <div class="tscroll"><table class="gx-table" style="max-width:420px"><tbody>
    <tr><td>Show money</td><td>${fmtMoney(s.money.show)}</td></tr><tr><td>Win bonus</td><td>${fmtMoney(s.money.win)}</td></tr>
    ${s.money.bonus ? `<tr><td>Bonuses</td><td>${fmtMoney(s.money.bonus)}</td></tr>` : ''}${s.money.sponsor ? `<tr><td>Sponsors</td><td>${fmtMoney(s.money.sponsor)}</td></tr>` : ''}
    ${s.money.fine ? `<tr><td>Missed-weight fine</td><td class="gx-red">-${fmtMoney(s.money.fine)}</td></tr>` : ''}<tr><td>Manager (10%)</td><td class="gx-red">-${fmtMoney(s.money.mgr)}</td></tr>
    ${s.money.medical ? `<tr><td>Medical</td><td class="gx-red">-${fmtMoney(s.money.medical)}</td></tr>` : ''}<tr><td><b>Take-home</b></td><td><b>${fmtMoney(s.money.net)}</b></td></tr></tbody></table></div>
   <div class="gx-row" style="margin-top:14px"><button class="btn" data-act="hub">Back to Fight HQ</button></div></div>`;
}
function renderRetired() {
  const c = save.c, p = C.player(save), L = c.legacy || C.legacy(save);
  app.innerHTML = header() + `<div class="gx-card hl"><p class="gx-label">Retired · ${esc(weekLabel(save.world.wk))}</p><h2>${esc(L.tier)}</h2><div class="big-res W">${L.score} legacy points</div>
   ${L.hof ? '<p class="gx-gold"><b>Inducted into the Stormvale Hall of Fame.</b></p>' : '<p class="gx-muted">Hall of Fame needs 1050+ legacy points.</p>'}
   <table class="gx-table" style="max-width:460px"><tbody>${L.parts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table>
   <div class="gx-row" style="margin-top:14px"><button class="btn ghost" data-act="tab" data-t="record">Full record</button><button class="btn" data-act="title">Main menu</button></div></div>
   <div id="tabp">${tab === 'record' ? recordTab() : tab === 'rivals' ? rivalsTab() : ''}</div>`;
}
// ---------- actions ----------
function act(e) {
  const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
  const a = t.dataset.act;
  const busy = (fn) => { fn(); persist(); renderHub(); };
  switch (a) {
    case 'new': draft = null; renderCreate(+t.dataset.n); break;
    case 'load': { const s = store.get(KEY(+t.dataset.n)); if (!s) { toast('That save could not be loaded.', 'bad'); return; } save = s; slot = +t.dataset.n; tab = 'home'; fs = null; campRep = null; mediaOut = null; if (save.c.phase === 'fight') toast('Fight night restarts from round 1.'); renderHub(); break; }
    case 'del': if (confirm('Delete this career? This cannot be undone.')) { store.del(KEY(+t.dataset.n)); const m = store.get(META, {}); delete m[t.dataset.n]; store.set(META, m); renderTitle(); } break;
    case 'title': persist(); renderTitle(); break;
    case 'att': { const k = t.dataset.k, d = +t.dataset.d; draft.extra[k] = Math.max(0, (draft.extra[k] || 0) + d); renderCreate(slot); break; }
    case 'att-reset': draft.extra = {}; renderCreate(slot); break;
    case 'att-rand': { draft.extra = {}; const base = C.baseAttrs(draft.style, draft.arch); const sorted = ATTR_KEYS.slice().sort((x, y) => base[y] - base[x]); let pts = C.START_POINTS, i = 0; while (pts > 0 && i < 400) { const k = sorted[i % 5 + (i % 3 === 0 ? 5 : 0)]; i++; if (base[k] + (draft.extra[k] || 0) < C.ATTR_MAX_START) { draft.extra[k] = (draft.extra[k] || 0) + 1; pts--; } } renderCreate(slot); break; }
    case 'col': draft.col[+t.dataset.i] = t.dataset.c; renderCreate(slot); break;
    case 'start': startCareer(); break;
    case 'tab': tab = t.dataset.t; save.c.retired ? renderRetired() : renderHub(); break;
    case 'hub': post = null; renderHub(); break;
    case 'accept': { const b = C.acceptOffer(save, +t.dataset.i); if (!b) toast('That fight fell through. New offers are in.', 'bad'); campRep = null; persist(); renderHub(); break; }
    case 'decline': busy(() => { const ev = C.declineOffers(save); if (ev) toast('Something happened: ' + esc(ev.title)); }); break;
    case 'rest': busy(() => { C.rest(save, +t.dataset.w || 4); toast('You rest up.'); }); break;
    case 'rehab': busy(() => { const p = C.player(save); save.c.money -= 1000 + p.tier * 3000; p.inj = Math.floor(p.inj / 2); toast('Sports-science rehab speeds things up.', 'good'); }); break;
    case 'neg': busy(() => toast(esc(C.negotiate(save, +t.dataset.i, +t.dataset.a)), 'good')); break;
    case 'evt': busy(() => toast(esc(C.resolveEvent(save, +t.dataset.i)))); break;
    case 'scout': modal(scoutHtml(save.world.f[t.dataset.id])); break;
    case 'callout-m': {
      const p = C.player(save), w = save.world;
      const list = activeIn(w, p.div, p.tier).filter(o => o.id !== p.id && o.rp >= p.rp - 40 && !o.bk).sort((a, b) => b.rp - a.rp).slice(0, 8);
      modal(`<h2>Call someone out</h2><p class="gx-muted gx-small">Builds heat and hype. If they accept, they show up in your offers. Rematch rules still apply.</p>${list.map(o => { const bc = bookCheck(w, p.id, o.id); return `<div class="gx-row gx-sp" style="padding:8px 0;border-bottom:1px solid var(--line)">${fighterLine(o)}<button class="btn sm" data-act="callout" data-id="${o.id}" ${bc.ok ? '' : 'disabled title="' + esc(bc.why) + '"'}>Call out</button></div>`; }).join('') || '<p>No one worth calling out yet.</p>'}`);
      break;
    }
    case 'callout': { const msg = C.callout(save, t.dataset.id); closeModal(); persist(); renderHub(); toast(esc(msg)); break; }
    case 'div-m': {
      const p = C.player(save), adj = adjacentDivs(p.div);
      modal(`<h2>Change division</h2><p class="gx-muted">Moving up adds power but costs speed. Moving down makes you faster but the cut hurts your cardio. ${C.beltsOf(save).includes(p.div) ? '<b class="gx-gold">You will vacate your title.</b>' : 'Champions can also chase a second belt through champ-vs-champ offers.'}</p><div class="gx-row">${[adj.down, adj.up].filter(Boolean).map(d => `<button class="btn" data-act="div" data-d="${d}">${esc(C.divName(d))}</button>`).join('')}</div>`);
      break;
    }
    case 'div': { const msg = C.changeDivision(save, t.dataset.d); closeModal(); persist(); renderHub(); toast(esc(msg)); break; }
    case 'gym-m': modal(`<h2>Gyms</h2><p class="gx-muted gx-small">You pick your gym at the start of each camp. Better gyms unlock with bigger contracts.</p>${GYMS.map(g => `<p><b>${esc(g.name)}</b> ${'★'.repeat(g.q)}<br><span class="gx-small gx-muted">${esc(g.tip)} ${g.cost ? fmtMoney(g.cost) : 'Free'}</span></p>`).join('')}`); break;
    case 'retire-m': modal(`<h2>Retire?</h2><p>Hang up the gloves and lock in your legacy score. This can't be undone.</p><p class="gx-muted">Legacy right now: <b>${C.legacy(save).score}</b> (${esc(C.legacy(save).tier)})</p><button class="btn gold" data-act="retire">Retire</button>`); break;
    case 'retire': {
      closeModal(); const L = C.retire(save); const p = C.player(save);
      const hof = store.get(HOF, []); hof.push({ name: C.fullName(p), cc: p.cc, rec: C.recStr(p), titles: save.c.titleWins + save.c.defenses, score: L.score, tier: L.tier }); hof.sort((a, b) => b.score - a.score); store.set(HOF, hof.slice(0, 30));
      persist(); tab = 'home'; renderRetired(); break;
    }
    case 'camp': {
      const ch = { gym: ($('input[name=gym]:checked') || {}).value, focus: $('input[name=focus]:checked').value, intensity: $('input[name=int]:checked').value, spar: $('#spar').checked, cut: $('input[name=cut]:checked').value };
      const rep = C.runCamp(save, ch);
      persist();
      if (rep.pulled) { toast(esc(rep.injury), 'bad'); campRep = null; renderHub(); break; }
      campRep = rep; renderCamp(); break;
    }
    case 'to-media': campRep = null; mediaOut = null; renderMedia(); break;
    case 'media': mediaOut = C.media(save, t.dataset.k); persist(); renderMedia(); break;
    case 'to-fight': mediaOut = null; fs = null; strat = defaultStrat(); renderFight(); app.scrollIntoView({ block: 'start' }); break;
    case 'strat': strat = t.dataset.k; renderFight(); break;
    case 'round': C.playRound(save, fs, strat); renderFight(); app.scrollIntoView({ block: 'start' }); break;
    case 'simall': while (!fs.over) C.playRound(save, fs, strat); renderFight(); app.scrollIntoView({ block: 'start' }); break;
    case 'post': { post = C.finishFight(save, fs); fs = null; persist(); renderPost(); break; }
  }
}
function defaultStrat() { const st = C.player(save).style; return ['wrestler', 'sambo', 'judo', 'bjj'].includes(st) ? 'wrestle' : st === 'karate' ? 'counter' : 'pressure'; }
app.addEventListener('click', act);
initTips();
renderTitle();
window.__ct = { get save() { return save; } };
