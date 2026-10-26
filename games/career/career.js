// Career Mode UI
import * as C from './career-core.js?v=20261026a';
import { STYLES, STYLE_KEYS, ARCHETYPES, ATTRS, ATTR_KEYS, COUNTRIES, DIVISIONS, TIERS, TOP, BELT_PROMOS, CHAMP_CAP, MAX_BELTS, GYMS, CAMP_FOCUS, STRATEGIES, STRAT_KEYS, weekLabel, flag, adjacentDivs } from '../shared/data.js?v=20261026a';
import { $, $$, esc, avatar, fl, tip, toast, modal, closeModal, initTips, bar, store } from '../shared/ui.js?v=20261026a';
import { writeSlot, readSlot } from '../shared/save.js?v=20261026a';
import { fmtMoney } from '../shared/rng.js?v=20261026a';
import { bookCheck, activeIn, capInfo, belt, undefended } from '../shared/world.js?v=20261026a';
import { series, REASONS } from '../shared/rematch.js?v=20261026a';
import { methodLabel, cornerAdvice } from '../shared/fight.js?v=20261026a';

const app = $('#app');
const SLOTS = [1, 2, 3];
const KEY = (n) => 'ct-career-slot-' + n;
const META = 'ct-career-meta', HOF = 'ct-career-hof';
let slot = null, save = null, tab = 'home', fs = null, strat = 'pressure', post = null, campRep = null, mediaOut = null, rkDiv = null, rkPid = null, sTrain = 'balanced', sPlan = 'auto';
const COLS = ['#e5132b', '#f6c343', '#46d39a', '#6aa8ff', '#b06cff', '#ff8a3d', '#ff5fa2', '#3dd6d0', '#e8e8f0', '#8bd346'];

function persist() {
  if (!save || !slot) return;
  save.c.lastPlayed = Date.now();
  const p = C.player(save);
  const meta = store.get(META, {});
  meta[slot] = { v: 2, mode: save.c.mode, name: C.fullName(p), rec: C.recStr(p), age: p.age, div: C.divName(p.div), tier: TIERS[p.tier].short, belts: C.beltsOf(save).length, retired: save.c.retired, when: weekLabel(save.world.wk), col: p.col, first: p.first, last: p.last };
  const s0 = slot;
  writeSlot(KEY(s0), save).then(ok => { if (ok) store.set(META, meta); else toast('Could not save: browser storage is full. Delete an old save slot.', 'bad'); });
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
    if (m && !(m.v >= 2)) return `<div class="gx-card slot"><p class="gx-label">Slot ${n} · older version</p><div class="who">${avatar(m, 44)}<div><div class="nm">${esc(m.name)}</div><div class="sub">${esc(m.rec)} · ${esc(m.div)}</div></div></div>
      <p class="gx-small gx-muted">New version! The fight world now has 5 promotions, deep rosters and yearly fight limits, so this older career can't continue. Your Hall of Fame is kept.</p>
      <div class="gx-row"><button class="btn" data-act="old-new" data-n="${n}">Start a new career here</button></div></div>`;
    return `<div class="gx-card slot">${m ? `<p class="gx-label">Slot ${n}${m.retired ? ' · retired' : ''} · ${m.mode === 'simple' ? 'Simple' : 'Full'} mode</p>
      <div class="who">${avatar(m, 44)}<div><div class="nm">${esc(m.name)}</div><div class="sub">${esc(m.rec)} · ${esc(m.div)} · ${esc(m.tier)}${m.belts ? ' · 🏆' : ''}</div><div class="sub">Age ${m.age} · ${esc(m.when)}</div></div></div>
      <div class="gx-row"><button class="btn" data-act="load" data-n="${n}">${m.retired ? 'View' : 'Continue'}</button><button class="btn ghost sm" data-act="del" data-n="${n}">Delete</button></div>`
      : `<p class="gx-label">Slot ${n}</p><p class="gx-muted">Empty slot.</p><button class="btn" data-act="new" data-n="${n}">New career</button>`}</div>`;
  }).join('')}</div>
  <div class="gx-card"><h2>How it works</h2><ul class="ticks">
    <li>Build a fictional fighter and start on the regional circuit. Five promotions compete for talent: win to earn bigger contracts, all the way to the ${esc(TIERS[TOP].name)}.</li>
    <li><b>Simple mode</b>: one tap per fight, automatic management. <b>Full mode</b>: camps, weight cuts, contracts and round-by-round strategy. Switch any time.</li>
    <li>Real schedules: at most ${TIERS[0].cap} fights a year on the regional scene, ${TIERS[TOP].cap} in the majors, ${CHAMP_CAP} as champion. Champions can hold ${MAX_BELTS} belts and must defend each one every year.</li>
    <li>Every fight: pick a training camp, cut weight, talk trash (or don't), then call the strategy between rounds.</li>
    <li>The world moves without you: prospects rise, veterans retire, fighters switch divisions and the rankings change every week.</li>
    <li>No endless rematches: you can fight someone at most 3 times, and only when the story calls for it.</li></ul></div>
  <div class="gx-card"><h2>Hall of Fame</h2>${hof.length ? `<div class="tscroll"><table class="gx-table"><thead><tr><th>Fighter</th><th>Record</th><th>Titles</th><th>Legacy</th></tr></thead><tbody>${hof.slice(0, 15).map(h => `<tr><td>${fl(h.cc)} ${esc(h.name)}</td><td>${esc(h.rec)}</td><td>${h.titles}</td><td><b>${h.score}</b> <span class="gx-dim">${esc(h.tier)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="gx-muted">Retire a fighter to see their legacy here. Score 1050+ to be inducted into the Hall of Fame.</p>'}</div>`;
}
// ---------- create ----------
let draft = null;
function renderCreate(n) {
  slot = n;
  draft = draft || { mode: 'simple', first: '', last: '', nick: '', cc: 'US', div: 'LW', style: 'allround', arch: '', age: 22, col: ['#e5132b', '#f6c343'], extra: {} };
  if (draft.mode === 'simple') return renderCreateSimple(n);
  const base = C.baseAttrs(draft.style, draft.arch);
  const spent = Object.values(draft.extra).reduce((s, x) => s + x, 0);
  const left = C.START_POINTS - spent;
  const prev = { first: draft.first || 'Your', last: draft.last || 'Name', col: draft.col };
  app.innerHTML = `<div class="gx-layout"><div>
  ${modePick()}
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
  bindModePick(n);
  $('#cf-div').onchange = (e) => { sync(); draft.div = e.target.value; renderCreate(n); };
  $('#cf-age').onchange = (e) => { sync(); draft.age = +e.target.value; renderCreate(n); };
  $('#cf-arch').onchange = (e) => { sync(); draft.arch = e.target.value; draft.extra = {}; renderCreate(n); };
  $$('input[name=cf-style]').forEach(r => r.onchange = () => { sync(); draft.style = r.value; draft.arch = ''; draft.extra = {}; renderCreate(n); });
}
function modePick() {
  return `<div class="gx-card"><p class="gx-label">Game mode</p><div class="choice two">${[['simple', 'Simple', 'One big Next Fight button, one training choice, one game plan. Contracts, gyms and weight cuts run themselves. Great on a phone.'], ['full', 'Full', 'Every lever: gyms, sparring, weight cuts, media, contract talks and round-by-round strategy.']].map(([k, nm, d]) => `<label><input type="radio" name="cf-mode" value="${k}" ${draft.mode === k ? 'checked' : ''}><span><b>${nm}</b><small>${d}</small></span></label>`).join('')}</div><p class="gx-small gx-dim" style="margin:8px 0 0">Same world and rules either way. You can switch later in Fight HQ.</p></div>`;
}
function bindModePick(n) { $$('input[name=cf-mode]').forEach(r => r.onchange = () => { const f = $('#cf-first'), l = $('#cf-last'); if (f) draft.first = f.value.trim(); if (l) draft.last = l.value.trim(); draft.mode = r.value; renderCreate(n); }); }
function renderCreateSimple(n) {
  app.innerHTML = `<div class="gx-layout"><div>${modePick()}
  <div class="gx-card"><h2>Quick fighter</h2>
   <div class="gx-grid two">
    <label class="fld"><span>First name</span><input id="cf-first" maxlength="18" value="${esc(draft.first)}" placeholder="First name" autocomplete="off"></label>
    <label class="fld"><span>Last name</span><input id="cf-last" maxlength="20" value="${esc(draft.last)}" placeholder="Last name" autocomplete="off"></label>
    <label class="fld"><span>Weight class</span><select id="cf-div">${DIVISIONS.map(d => `<option value="${d.id}" ${d.id === draft.div ? 'selected' : ''}>${esc(d.name)} (${d.lbs} lb)</option>`).join('')}</select></label>
    <label class="fld"><span>Country</span><select id="cf-cc">${COUNTRIES.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.cc}" ${c.cc === draft.cc ? 'selected' : ''}>${flag(c.cc)} ${esc(c.name)}</option>`).join('')}</select></label>
   </div>
   <p class="gx-label">Style ${tip('Your style sets your strengths. Attributes are assigned automatically.')}</p>
   <div class="choice two">${STYLE_KEYS.map(k => `<label><input type="radio" name="cf-style" value="${k}" ${k === draft.style ? 'checked' : ''}><span><b>${esc(STYLES[k].name)}</b><small>${esc(STYLES[k].tip)}</small></span></label>`).join('')}</div>
   <div class="gx-row" style="margin-top:16px"><button class="btn" data-act="start">Start career</button><button class="btn ghost" data-act="title">Back</button></div>
  </div></div></div>`;
  bindModePick(n);
  $('#cf-div').onchange = (e) => { draft.div = e.target.value; };
  $('#cf-cc').onchange = (e) => { draft.cc = e.target.value; };
  $$('input[name=cf-style]').forEach(r => r.onchange = () => { draft.style = r.value; });
}
function autoExtra() { const ex = {}; const base = C.baseAttrs(draft.style, draft.arch); const sorted = ATTR_KEYS.slice().sort((x, y) => base[y] - base[x]); let pts = C.START_POINTS, i = 0; while (pts > 0 && i < 400) { const k = sorted[i % 5 + (i % 3 === 0 ? 5 : 0)]; i++; if (base[k] + (ex[k] || 0) < C.ATTR_MAX_START) { ex[k] = (ex[k] || 0) + 1; pts--; } } return ex; }
function startCareer() {
  draft.first = $('#cf-first').value.trim(); draft.last = $('#cf-last').value.trim(); draft.nick = $('#cf-nick') ? $('#cf-nick').value.trim() : '';
  if (draft.mode === 'simple') { draft.arch = ''; draft.age = 22; draft.extra = autoExtra(); }
  if (!draft.first || !draft.last) { toast('Give your fighter a first and last name.', 'bad'); ($('#cf-first').value ? $('#cf-last') : $('#cf-first')).focus(); return; }
  const base = C.baseAttrs(draft.style, draft.arch);
  const attrs = {}; for (const k of ATTR_KEYS) attrs[k] = base[k] + (draft.extra[k] || 0);
  const ageBonus = Math.max(0, draft.age - 22);
  for (const k of ATTR_KEYS) attrs[k] = Math.min(80, attrs[k] + Math.round(ageBonus * 0.6));
  app.innerHTML = '<p class="gx-muted">Building the fight world…</p>';
  setTimeout(() => {
    save = C.newCareer({ ...draft, attrs });
    draft = null; tab = 'home'; persist(); renderHub();
    toast(save.c.mode === 'simple' ? 'Welcome! Tap a fight to get started.' : 'Welcome to the fight game. Pick your first fight!', 'good');
  }, 30);
}
// ---------- hub ----------
function header() {
  const p = C.player(save), w = save.world, c = save.c;
  const belts = C.beltsOf(save);
  const st = TIERS[p.tier].belts ? (C.rankOf(w, p.id) === 0 ? 'Champion' : C.rankOf(w, p.id) ? '#' + C.rankOf(w, p.id) + ' ranked' : 'Unranked') : `#${C.tierStanding(w, p.id)} on ${TIERS[p.tier].short}`;
  const ci = capInfo(w, p);
  return `<div class="gx-card hl"><div class="gx-row gx-sp"><div class="who">${avatar(p, 60, 'you')}<div>
    <div class="nm" style="font:700 22px/1.1 var(--head);text-transform:uppercase">${fl(p.cc)} ${esc(p.first)} ${p.nick ? '<span class="gx-gold">"' + esc(p.nick) + '"</span> ' : ''}${esc(p.last)}</div>
    <div class="sub">${esc(C.recStr(p))} · ${esc(C.divName(p.div))} · ${esc(TIERS[p.tier].name)} · ${esc(st)}</div>
    <div class="sub">Age ${p.age} · ${esc(STYLES[p.style].name)} · ${esc(C.gymById(c.gym).name)} · ${esc(weekLabel(w.wk))}</div></div></div>
    <div class="gx-row">${belts.map(d => `<span class="belt">🏆 ${esc(TIERS[p.tier].short)} ${esc(C.divName(d))}</span>`).join('')}${c.doubleChamp ? '<span class="tag gold">Double champ</span>' : ''}<span class="tag ${ci.hit ? 'red' : ''}">Fights in ${esc(weekLabel(w.wk).slice(-4))}: ${ci.n}/${ci.cap}</span>${tip(`Yearly limit: ${TIERS.map(t => t.short + ' ' + t.cap).join(', ')}; champions ${CHAMP_CAP}. When you hit it, skip to January.`)}</div></div>
    <div class="stats4" style="margin-top:12px">
     <div class="stat"><small>Money ${tip('Purses minus 10% manager fee. Spend it on better gyms and rehab.')}</small><b>${fmtMoney(c.money)}</b></div>
     <div class="stat"><small>Hype ${tip('Short-term buzz. Raises purses and wins negotiations. Fades if you sit out.')}</small><b>${Math.round(p.hype)}</b>${bar(p.hype, 100, 'gold')}</div>
     <div class="stat"><small>Popularity ${tip('Long-term fan base. Unlocks sponsors and big-money grudge matches.')}</small><b>${Math.round(p.pop)}</b>${bar(p.pop, 100, 'blue')}</div>
     <div class="stat"><small>Condition</small><b>${p.inj > 0 ? `<span class="gx-red">Injured ${p.inj}w</span>` : '<span class="gx-green">Healthy</span>'}</b><span class="gx-dim gx-small">${esc(TIERS[p.tier].short)} contract: ${c.contract.left} fight${c.contract.left === 1 ? '' : 's'} left</span></div>
    </div></div>`;
}
function renderHub() {
  if (!save) return renderTitle();
  document.body.classList.add('ingame');
  const c = save.c;
  if (c.retired) return renderRetired();
  if (C.isSimple(save) && c.booked && ['camp', 'media', 'fight'].includes(c.phase)) return renderSimpleCamp();
  if (c.phase === 'camp' && c.booked) return renderCamp();
  if (c.phase === 'media' && c.booked) return renderMedia();
  if (c.phase === 'fight' && c.booked) return renderFight();
  if (c.phase !== 'hub') c.phase = 'hub';
  const tabs = [['home', 'Fight HQ'], ['record', 'Record'], ['rivals', 'Rivals'], ['rank', 'Rankings'], ['news', 'News']];
  app.innerHTML = header() + `<div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${tab === k}" data-act="tab" data-t="${k}">${n}</button>`).join('')}</div><div id="tabp"></div>`;
  const tp = $('#tabp');
  if (tab === 'home') tp.innerHTML = C.isSimple(save) ? simpleHome() : homeTab();
  if (tab === 'record') tp.innerHTML = recordTab();
  if (tab === 'rivals') tp.innerHTML = rivalsTab();
  if (tab === 'rank') tp.innerHTML = rankTab();
  if (tab === 'news') tp.innerHTML = newsTab();
  if (tab === 'rank') { const s = $('#rk-div'); if (s) s.onchange = () => { rkDiv = s.value; renderHub(); }; const s2 = $('#rk-pid'); if (s2) s2.onchange = () => { rkPid = +s2.value; renderHub(); }; }
}
function homeTab() {
  const c = save.c, w = save.world, p = C.player(save);
  let h = '<div class="gx-layout"><div>';
  if (c.pending) {
    h += `<div class="gx-card event-card"><p class="gx-label">Contract</p><h2>${esc(c.pending.text)}</h2>${c.pending.offers.map((o, i) => `<div class="gx-card" style="background:#0f0f14"><div class="gx-row gx-sp"><div><b>${esc(o.label)}</b><div class="gx-dim gx-small">${esc(TIERS[o.tier].name)} · ${o.fights} fights · ${fmtMoney(o.show)} to show / ${fmtMoney(o.win)} to win${o.sign ? ' · ' + fmtMoney(o.sign) + ' signing bonus' : ''}</div><div class="gx-dim gx-small">${esc(TIERS[o.tier].style)}</div></div></div>
      <div class="gx-row" style="margin-top:10px"><button class="btn sm" data-act="neg" data-i="${i}" data-a="0">Sign it</button><button class="btn ghost sm" data-act="neg" data-i="${i}" data-a="1">Ask +25% ${tip('Works more often with high hype.')}</button><button class="btn ghost sm" data-act="neg" data-i="${i}" data-a="2">Demand +60% ${tip('Risky. They may walk away and you fall back to your safest option.')}</button></div></div>`).join('')}</div>`;
  } else if (c.event) {
    const e = C.eventView(save);
    h += `<div class="gx-card event-card"><p class="gx-label">Breaking</p><h2>${esc(e.title)}</h2><p>${esc(e.text)}</p><div class="gx-row">${e.choices.map((x, i) => `<button class="btn ${i ? 'ghost' : ''}" data-act="evt" data-i="${i}">${esc(x.label)}</button>${tip(x.tip)}`).join('')}</div></div>`;
  } else if (C.mustRetire(save)) {
    h += `<div class="gx-card event-card"><h2>Your body says it's time</h2><p>At ${p.age}, the doctors will not clear you to fight any more.</p><button class="btn gold" data-act="retire">Retire and see your legacy</button></div>`;
  } else if (p.inj > 0) {
    h += `<div class="gx-card"><h2>Injured</h2><p>You're out for ${p.inj} more week${p.inj === 1 ? '' : 's'}.</p><div class="gx-row"><button class="btn" data-act="rest" data-w="${p.inj}">Rest and recover</button>${c.money > 2000 ? `<button class="btn ghost" data-act="rehab">Pay ${fmtMoney(rehabCost())} for rehab (halve it)</button>` : ''}</div></div>`;
  } else if (c.capped) {
    h += capCard();
  } else {
    h += `<div class="gx-card"><div class="gx-row gx-sp"><h2 style="margin:0">Fight offers</h2><span class="gx-dim gx-small">${esc(weekLabel(w.wk))}</span></div><div class="gx-grid" style="margin-top:12px">`;
    if (!c.offers.length) h += '<p class="gx-muted">No offers right now. Give it a couple of weeks.</p>';
    c.offers.forEach((of, i) => {
      const o = w.f[of.opp]; const s = series(w.h2h, p.id, o.id);
      const labels = { title: ['Title shot', 'gold'], defense: ['Title defense', 'gold'], superfight: ['Champ vs champ', 'gold'], short: ['Short notice', 'red'], 'step-up': ['Step-up', 'green'], 'tune-up': ['Tune-up', ''], even: ['Even match', ''], rematch: ['Rematch', 'blue'], callout: ['Callout accepted', 'red'] };
      const lb = labels[of.type] || ['Fight', ''];
      h += `<div class="gx-card offer ${of.title ? 'hl' : ''}" style="margin:0;background:#0f0f14"><div class="top">${fighterLine(o, (C.rankOf(w, o.id) === 0 ? 'Champion' : C.rankOf(w, o.id) ? '#' + C.rankOf(w, o.id) : 'Unranked'))}</div>
        <div class="gx-row"><span class="tag ${lb[1]}">${lb[0]}</span>${of.short ? '' : ''}${of.title ? `<span class="tag gold">${esc(C.divName(of.div))} title · 5 rounds</span>` : ''}${reasonTag(of.reason)}${of.vacate ? `<span class="tag red">Vacates your ${esc(C.divName(of.vacate))} belt</span>` : ''}${s.n ? `<span class="tag">H2H: ${s.aw}-${s.bw}${s.dn ? '-' + s.dn : ''} · meeting ${s.n + 1} of 3 max</span>` : ''}</div>
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
    <div class="gx-row" style="margin-top:12px"><button class="btn ghost sm" data-act="div-m">Change division</button><button class="btn ghost sm" data-act="gym-m">Gyms</button><button class="btn ghost sm" data-act="mode">Switch to Simple mode</button><button class="btn ghost sm" data-act="retire-m">Retire</button><button class="btn ghost sm" data-act="title">Save &amp; exit</button></div></div>`;
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
  const div = rkDiv && w.divs.includes(rkDiv) ? rkDiv : p.div;
  const pid = rkPid != null ? rkPid : (TIERS[p.tier].belts ? p.tier : TOP);
  const D = belt(w, div, pid);
  const champ = D.champ && w.f[D.champ];
  const ranks = C.rankings(w, div, pid).map(id => w.f[id]);
  let h = `<div class="gx-card"><div class="gx-row gx-sp"><h2 style="margin:0">${esc(TIERS[pid].short)} rankings ${tip('Top 15 needs a proven record: at least 7 wins, a 65%+ win rate and 5 more wins than losses. Then recent form, win rate and quality of opposition decide the order.')}</h2><span class="gx-row"><select id="rk-pid" aria-label="Promotion">${BELT_PROMOS.slice().reverse().map(x => `<option value="${x}" ${x === pid ? 'selected' : ''}>${esc(TIERS[x].name)}</option>`).join('')}</select><select id="rk-div" aria-label="Division">${w.divs.map(d => `<option value="${d}" ${d === div ? 'selected' : ''}>${esc(C.divName(d))}</option>`).join('')}</select></span></div>
   <div class="gx-card hl" style="margin-top:12px;background:#0f0f14">${champ ? `<p class="gx-label">Champion · ${D.def} defense${D.def === 1 ? '' : 's'}</p>${fighterLine(champ)}` : '<p class="gx-muted">Title vacant</p>'}</div>
   <div class="tscroll"><table class="gx-table"><thead><tr><th>#</th><th>Fighter</th><th>Record</th><th>Streak</th><th>Age</th></tr></thead><tbody>${ranks.map((f, i) => `<tr class="${f.isP ? 'me' : ''}"><td>${i + 1}</td><td>${fl(f.cc)} ${esc(f.first)} ${esc(f.last)}</td><td>${esc(C.recStr(f))}</td><td>${f.streak > 0 ? 'W' + f.streak : f.streak < 0 ? 'L' + -f.streak : '—'}</td><td>${f.age}</td></tr>`).join('')}</tbody></table></div>
   <p class="gx-small gx-dim">Title lineage: ${D.hist.slice(-6).map(x => esc(x.name)).join(' → ')} · Roster: ${activeIn(w, div, pid).length} signed fighters</p></div>`;
  if (!TIERS[p.tier].belts && div === p.div) {
    const list = activeIn(w, p.div, p.tier).sort((a, b) => b.rp - a.rp).slice(0, 12);
    h += `<div class="gx-card"><h2>${esc(TIERS[p.tier].name)} standings <span class="gx-dim gx-small">${activeIn(w, p.div, p.tier).length} fighters</span></h2><div class="tscroll"><table class="gx-table"><tbody>${list.map((f, i) => `<tr class="${f.isP ? 'me' : ''}"><td>${i + 1}</td><td>${fl(f.cc)} ${esc(f.first)} ${esc(f.last)}</td><td>${esc(C.recStr(f))}</td><td>${f.streak > 0 ? 'W' + f.streak : f.streak < 0 ? 'L' + -f.streak : '—'}</td></tr>`).join('')}</tbody></table></div>${list.some(f => f.isP) ? '' : `<p class="gx-small gx-muted">You: #${C.tierStanding(w, p.id)}</p>`}</div>`;
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
  const focusList = Object.entries(CAMP_FOCUS).filter(([k]) => k !== 'grapple2' && k !== 'balanced');
  app.innerHTML = header() + `<div class="gx-layout"><div><div class="gx-card hl"><p class="gx-label">${b.title ? 'Title fight · ' : ''}${esc(b.ev)} · ${esc(weekLabel(b.wk))}</p><h2>Training camp vs ${esc(o.first)} ${esc(o.last)}</h2>
   ${b.short ? '<p class="gx-gold">Short notice! Smaller gains and you will not be at 100% cardio.</p>' : ''}
   <p class="gx-label" style="margin-top:12px">Gym / head coach</p><div class="choice two">${GYMS.map(g => `<label><input type="radio" name="gym" value="${g.id}" ${g.id === c.gym ? 'checked' : ''} ${allowed(g) ? '' : 'disabled'}><span><b>${esc(g.name)}</b> <span class="gx-dim">${'★'.repeat(g.q)}</span><small>${esc(g.tip)} ${g.cost ? fmtMoney(g.cost) + ' per camp' : 'Free'}${allowed(g) ? '' : ' · locked (' + (c.money < g.cost ? 'not enough money' : 'needs a bigger contract') + ')'}</small></span></label>`).join('')}</div>
   <p class="gx-label" style="margin-top:14px">Camp focus</p><div class="choice two">${focusList.map(([k, f], i) => `<label><input type="radio" name="focus" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${esc(f.name)}</b><small>${esc(f.tip)}</small></span></label>`).join('')}</div>
   <p class="gx-label" style="margin-top:14px">Intensity</p><div class="choice two">${Object.entries(C.INTENSITY).map(([k, f]) => `<label><input type="radio" name="int" value="${k}" ${k === 'normal' ? 'checked' : ''}><span><b>${esc(f.name)}</b><small>${esc(f.tip)}</small></span></label>`).join('')}</div>
   <div class="choice" style="margin-top:10px"><label><input type="checkbox" id="spar" checked><span><b>Hard sparring</b><small>+25% gains, but injury risk goes way up.</small></span></label></div>
   <p class="gx-label" style="margin-top:14px">Weight cut</p><div class="choice two">${Object.entries(C.CUTS).map(([k, f]) => `<label><input type="radio" name="cut" value="${k}" ${k === 'normal' ? 'checked' : ''}><span><b>${esc(f.name)}</b><small>${esc(f.tip)}</small></span></label>`).join('')}</div>
   <div class="gx-row" style="margin-top:16px"><button class="btn" data-act="camp">Start camp</button><button class="btn ghost sm" data-act="retire-m">Withdraw &amp; retire</button></div></div></div>
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
   ${L.hof ? `<p class="gx-gold"><b>Inducted into the CageTime Hall of Fame.</b></p>` : '<p class="gx-muted">Hall of Fame needs 1050+ legacy points. Your career is still listed on the Hall of Fame board on the main menu.</p>'}
   <p class="gx-small">Final record <b>${esc(C.recStr(p))}</b> · ${c.titleWins} title win${c.titleWins === 1 ? '' : 's'}, ${c.defenses} defense${c.defenses === 1 ? '' : 's'} · last promotion: ${esc(TIERS[p.tier].name)}</p>
   <table class="gx-table" style="max-width:460px"><tbody>${L.parts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table>
   <div class="gx-row" style="margin-top:14px"><button class="btn ghost" data-act="tab" data-t="record">Full record</button><button class="btn" data-act="title">Main menu</button></div></div>
   <div id="tabp">${tab === 'record' ? recordTab() : tab === 'rivals' ? rivalsTab() : ''}</div>`;
}

// ---------- shared bits ----------
const rehabCost = () => 1000 + TIERS[C.player(save).tier].lvl * 3000;
function capCard() {
  const ci = save.c.capped || capInfo(save.world, C.player(save));
  return `<div class="gx-card event-card"><p class="gx-label">Schedule full</p><h2>That's your ${ci.n} fights for ${esc(weekLabel(save.world.wk).slice(-4))}</h2>
   <p>${ci.champ ? `Champions fight at most ${CHAMP_CAP} times a year.` : `${esc(TIERS[C.player(save).tier].name)} books at most ${ci.cap} fights a year per fighter.`} New offers open in January.</p>
   <div class="gx-row"><button class="btn" data-act="skip-year">Skip to January ${esc(weekLabel(ci.nextWk).slice(-4))}</button>${tip('Time passes, the world keeps fighting, you heal up and age. Nothing else is lost.')}</div></div>`;
}
function retireModal() {
  const L = C.legacy(save), bl = C.retireBlockers(save);
  modal(`<h2>Retire ${esc(C.player(save).first)}?</h2><p>Hang up the gloves and lock in your legacy. This can't be undone.</p>
   ${bl.length ? `<ul class="ticks">${bl.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
   <p class="gx-muted">Legacy right now: <b>${L.score}</b> (${esc(L.tier)})${L.hof ? ' · Hall of Fame' : ''}</p>
   <div class="gx-row"><button class="btn gold" data-act="retire">${save.c.booked ? 'Withdraw and retire' : 'Retire now'}</button><button class="btn ghost" data-act="close-m">Keep fighting</button></div>`);
}
function doRetire() {
  closeModal();
  const L = C.retire(save); const p = C.player(save);
  const hof = store.get(HOF, []); hof.push({ name: C.fullName(p), cc: p.cc, rec: C.recStr(p), titles: save.c.titleWins + save.c.defenses, score: L.score, tier: L.tier });
  hof.sort((a, b) => b.score - a.score); store.set(HOF, hof.slice(0, 30));
  fs = null; campRep = null; mediaOut = null; post = null;
  persist(); tab = 'home'; renderRetired(); app.scrollIntoView({ block: 'start' });
  toast(`Retired with ${L.score} legacy points.${L.hof ? ' Hall of Famer!' : ''}`, 'good');
}
// accept an offer, asking first when a belt has to be vacated
function tryAccept(i) {
  const need = C.offerNeeds(save, i);
  if (need) {
    const belts = C.beltsOf(save);
    const of = save.c.offers[i];
    const choices = belts.filter(d => d !== of.div && (of.type !== 'defense' || d === need.vacate));
    modal(`<h2>Vacate a title?</h2><p>${esc(need.text)}</p><div class="gx-row">${choices.map(d => `<button class="btn gold" data-act="accept-v" data-i="${i}" data-d="${d}">Vacate ${esc(C.divName(d))} and take the fight</button>`).join('')}<button class="btn ghost" data-act="close-m">Cancel</button></div>`);
    return;
  }
  const b = C.acceptOffer(save, i);
  if (!b) toast('That fight fell through. New offers are in.', 'bad');
  campRep = null; persist(); renderHub();
}
function watchModal(fsx) {
  const lines = fsx.roundLogs.flatMap((l, i) => [['', `Round ${i + 1}`, 'rd'], ...l.map(x => [x.t, x.txt, x.cls])]);
  const m = modal(`<h2>Round by round</h2><div class="pbp" id="wpbp" style="max-height:60vh">${lines.map(([t, txt, cls]) => cls === 'rd' ? `<p class="rd"><span>${esc(txt)}</span></p>` : `<p class="${cls}"><time>${esc(t)}</time><span>${esc(txt)}</span></p>`).join('')}</div>`, { wide: true });
  void m;
}
// ---------- Simple mode ----------
const OFFER_LABEL = { title: ['Title shot', 'gold'], defense: ['Title defense', 'gold'], superfight: ['Champ vs champ', 'gold'], short: ['Short notice', 'red'], 'step-up': ['Step-up', 'green'], 'tune-up': ['Tune-up', ''], even: ['Even match', ''], rematch: ['Rematch', 'blue'], callout: ['Callout accepted', 'red'] };
function simpleHome() {
  const c = save.c, w = save.world, p = C.player(save);
  const ms = C.milestone(save);
  let h = `<div class="gx-card hl simple-goal"><p class="gx-label">Next goal</p><p class="goal"><span aria-hidden="true">${ms.icon}</span> ${esc(ms.text)}</p></div>`;
  if (c.autoMsgs && c.autoMsgs.length) { h += `<div class="gx-card"><p class="gx-label">Handled for you</p><ul class="ticks">${c.autoMsgs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`; c.autoMsgs = null; }
  if ((c.pending || c.event) && !simpleHome.d) { simpleHome.d = 1; try { C.autoManage(save); persist(); return simpleHome(); } finally { simpleHome.d = 0; } }
  if (C.mustRetire(save)) return h + `<div class="gx-card event-card"><h2>Your body says it's time</h2><p>At ${p.age}, the doctors will not clear you to fight any more.</p><button class="btn gold big" data-act="retire">Retire and see your legacy</button></div>`;
  if (p.inj > 0) return h + `<div class="gx-card"><h2>Injured: ${p.inj} week${p.inj === 1 ? '' : 's'}</h2><p class="gx-muted">Rest up and come back stronger.</p><button class="btn big" data-act="rest" data-w="${p.inj}">Heal up</button></div>` + simpleSide();
  if (c.capped) return h + capCard() + simpleSide();
  if (!c.offers.length) return h + `<div class="gx-card"><h2>No offers this week</h2><button class="btn big" data-act="decline">Wait for offers</button></div>` + simpleSide();
  h += `<div class="gx-card"><div class="gx-row gx-sp"><h2 style="margin:0">Next fight</h2><span class="gx-dim gx-small">${esc(weekLabel(w.wk))} · pick one</span></div><div class="s-offers">`;
  c.offers.forEach((of, i) => {
    const o = w.f[of.opp]; const lb = OFFER_LABEL[of.type] || ['Fight', ''];
    const rk = C.rankOf(w, o.id);
    const edge = C.ovr(p.attrs) - C.ovr(o.attrs);
    const odds = edge >= 4 ? ['Favorite', 'green'] : edge <= -4 ? ['Underdog', 'red'] : ['Toss-up', ''];
    h += `<button class="s-offer ${of.title ? 'hl' : ''}" data-act="accept" data-i="${i}">
      <span class="gx-row"><span class="tag ${lb[1]}">${lb[0]}</span><span class="tag ${odds[1]}">${odds[0]}</span>${of.reason ? `<span class="tag blue">${esc(REASONS[of.reason].label)}</span>` : ''}${of.vacate ? `<span class="tag red">Vacates ${esc(C.divName(of.vacate))}</span>` : ''}</span>
      <span class="who">${avatar(o, 40)}<span><span class="nm">${fl(o.cc)} ${esc(o.first)} ${esc(o.last)}</span><span class="sub">${esc(C.recStr(o))} · ${esc(STYLES[o.style].name)}${rk === 0 ? ' · Champion' : rk ? ' · #' + rk : ''}</span></span></span>
      <span class="gx-small"><b>${fmtMoney(of.show + of.win)}</b> if you win · ${of.weeks} weeks${of.title ? ' · ' + esc(C.divName(of.div)) + ' title' : ''}</span>
      <span class="s-go">Take this fight →</span></button>`;
  });
  h += `</div><div class="gx-row" style="margin-top:10px"><button class="btn ghost sm" data-act="decline">None of these · wait 2 weeks</button></div></div>`;
  return h + simpleSide();
}
function simpleSide() {
  const c = save.c, p = C.player(save);
  return `<div class="gx-card"><div class="gx-row gx-sp"><h3 style="margin:0">Career</h3><span class="tag gold">OVR ${C.ovr(p.attrs)}</span></div><div class="gx-small">
    <div class="gx-row gx-sp"><span class="gx-muted">Earnings</span><b>${fmtMoney(c.earned)}</b></div>
    <div class="gx-row gx-sp"><span class="gx-muted">Titles won / defenses</span><b>${c.titleWins} / ${c.defenses}</b></div>
    <div class="gx-row gx-sp"><span class="gx-muted">Legacy</span><b>${C.legacy(save).score}</b></div></div>
    <ul class="news" style="margin-top:10px">${c.log.slice(0, 4).map(l => `<li><time>${esc(weekLabel(l.wk))}</time>${esc(l.txt)}</li>`).join('')}</ul>
    <div class="gx-row" style="margin-top:10px"><button class="btn ghost sm" data-act="mode">Switch to Full mode</button>${tip('Full mode adds gyms, sparring, weight cuts, media, contract talks and round-by-round strategy. Same career.')}<button class="btn ghost sm" data-act="retire-m">Retire</button><button class="btn ghost sm" data-act="title">Save &amp; exit</button></div></div>`;
}
function renderSimpleCamp() {
  const c = save.c, w = save.world, b = c.booked, o = w.f[b.opp];
  app.innerHTML = header() + `<div class="gx-card hl"><p class="gx-label">${b.title ? esc(C.divName(b.div)) + ' title · ' : ''}${esc(b.ev)}</p><h2>You vs ${esc(o.first)} ${esc(o.last)} <span class="gx-dim gx-small">${esc(C.recStr(o))}</span></h2>
   <p class="gx-label" style="margin-top:12px">1. Training camp ${tip('One focus for the whole camp. Gym, sparring and weight cut are handled for you.')}</p>
   <div class="s-pick">${Object.entries(C.SIMPLE_TRAIN).map(([k, t]) => `<button class="s-chip ${sTrain === k ? 'sel' : ''}" data-act="s-train" data-k="${k}" aria-pressed="${sTrain === k}"><b>${t.icon} ${esc(t.name)}</b><small>${esc(t.tip)}</small></button>`).join('')}</div>
   <p class="gx-label" style="margin-top:12px">2. Game plan ${tip('Your corner follows this plan most of the time and adapts when needed.')}</p>
   <div class="s-pick">${Object.entries(C.PLANS).map(([k, t]) => `<button class="s-chip ${sPlan === k ? 'sel' : ''}" data-act="s-plan" data-k="${k}" aria-pressed="${sPlan === k}"><b>${esc(t.name)}</b><small>${esc(t.tip)}</small></button>`).join('')}</div>
   <div class="gx-row" style="margin-top:16px"><button class="btn big" data-act="s-fight">Fight! ▶</button><button class="btn ghost sm" data-act="scout" data-id="${o.id}">Scout ${esc(o.last)}</button><button class="btn ghost sm" data-act="retire-m">Withdraw &amp; retire</button></div></div>`;
}
function renderSimplePost() {
  const s = post, r = s.rec;
  const ms = C.milestone(save);
  app.innerHTML = header() + `<div class="gx-card hl"><div class="big-res ${r.res}">${r.res === 'W' ? 'You win' : r.res === 'L' ? 'You lose' : r.res === 'NC' ? 'No contest' : 'Draw'}</div>
   <p>${esc(r.on)} · ${esc(methodLabel({ method: r.m, detail: r.det }))} · R${r.r} ${esc(r.t)}${r.tn === 'new' || r.tn === 'vacant' ? ' · <b class="gx-gold">AND NEW CHAMPION!</b>' : r.tn === 'defense' ? ' · <b class="gx-gold">Title retained</b>' : ''}</p>
   ${s.campLines && s.campLines.length ? `<p class="gx-small gx-muted">${s.campLines.map(esc).join(' ')}</p>` : ''}
   <p class="gx-label">Highlights</p><ul class="ticks">${(s.highlights || []).map(x => `<li><b>R${x.r} ${esc(x.t)}</b> ${esc(x.txt)}</li>`).join('') || '<li>A tactical, close fight.</li>'}</ul>
   ${r.cards ? `<div class="scard">${r.cards.map((t, i) => `<div>Judge ${i + 1}<b>${t[0]}-${t[1]}</b></div>`).join('')}</div>` : ''}
   ${s.lines.map(l => `<p class="gx-gold">${esc(l)}</p>`).join('')}
   <p>Take-home: <b>${fmtMoney(s.money.net)}</b> ${tip(`Show ${fmtMoney(s.money.show)} + win ${fmtMoney(s.money.win)}${s.money.bonus ? ' + bonus ' + fmtMoney(s.money.bonus) : ''}${s.money.sponsor ? ' + sponsors ' + fmtMoney(s.money.sponsor) : ''}, minus manager 10%${s.money.medical ? ' and medical' : ''}.`)}</p>
   <p class="goal"><span aria-hidden="true">${ms.icon}</span> ${esc(ms.text)}</p>
   <div class="gx-row" style="margin-top:14px"><button class="btn big" data-act="hub">Continue</button>${s.fs ? '<button class="btn ghost sm" data-act="s-watch">Watch round by round</button>' : ''}</div></div>`;
}
// ---------- actions ----------
function act(e) {
  const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
  const a = t.dataset.act;
  const busy = (fn) => { fn(); persist(); renderHub(); };
  switch (a) {
    case 'new': draft = null; renderCreate(+t.dataset.n); break;
    case 'load': {
      const n = +t.dataset.n; t.disabled = true;
      readSlot(KEY(n)).then(res => {
        if (res.old) { const m = store.get(META, {}); if (m[n]) { m[n].v = 1; store.set(META, m); } renderTitle(); toast('That career was saved by an older version. Start a new one in this slot.', 'bad'); return; }
        if (!res.save || !res.save.c || !res.save.world) { toast('That save could not be loaded.', 'bad'); renderTitle(); return; }
        save = res.save; slot = n; tab = 'home'; fs = null; campRep = null; mediaOut = null; post = null;
        if (save.c.phase === 'fight' && !C.isSimple(save)) toast('Fight night restarts from round 1.');
        renderHub();
      });
      break;
    }
    case 'del': modal(`<h2>Delete this career?</h2><p>This cannot be undone. Retired fighters stay in the Hall of Fame.</p><div class="gx-row"><button class="btn" data-act="del-ok" data-n="${t.dataset.n}">Delete</button><button class="btn ghost" data-act="close-m">Cancel</button></div>`); break;
    case 'del-ok': case 'old-new': { const n = +t.dataset.n; store.del(KEY(n)); const m = store.get(META, {}); delete m[n]; store.set(META, m); closeModal(); if (a === 'old-new') { draft = null; renderCreate(n); } else renderTitle(); break; }
    case 'close-m': closeModal(); break;
    case 'skip-year': busy(() => { const n = C.skipToNextYear(save); toast(`Skipped ${n} weeks. Happy new year!`, 'good'); }); break;
    case 'mode': { const m = C.setMode(save, C.isSimple(save) ? 'full' : 'simple'); fs = null; campRep = null; mediaOut = null; persist(); renderHub(); toast(m === 'simple' ? 'Simple mode: management is automatic now.' : 'Full mode: every lever is yours.', 'good'); break; }
    case 'accept-v': { closeModal(); const b = C.acceptOffer(save, +t.dataset.i, { confirmVacate: true, vacateDiv: t.dataset.d }); if (!b) toast('That fight fell through. New offers are in.', 'bad'); else toast('Title vacated. Fight booked.', 'good'); campRep = null; persist(); renderHub(); break; }
    case 's-train': sTrain = t.dataset.k; renderSimpleCamp(); break;
    case 's-plan': sPlan = t.dataset.k; renderSimpleCamp(); break;
    case 's-fight': {
      const c = save.c; let campLines = [];
      if (c.phase === 'camp') { const rep = C.simpleCamp(save, sTrain); persist(); if (rep.pulled) { toast(esc(rep.injury), 'bad'); renderHub(); break; } campLines = rep.lines.slice(1); }
      post = C.simpleFight(save, sPlan); post.campLines = campLines; persist(); renderSimplePost(); app.scrollIntoView({ block: 'start' }); break;
    }
    case 's-watch': if (post && post.fs) watchModal(post.fs); break;
    case 'title': persist(); closeModal(); renderTitle(); break;
    case 'att': { const k = t.dataset.k, d = +t.dataset.d; draft.extra[k] = Math.max(0, (draft.extra[k] || 0) + d); renderCreate(slot); break; }
    case 'att-reset': draft.extra = {}; renderCreate(slot); break;
    case 'att-rand': { draft.extra = {}; const base = C.baseAttrs(draft.style, draft.arch); const sorted = ATTR_KEYS.slice().sort((x, y) => base[y] - base[x]); let pts = C.START_POINTS, i = 0; while (pts > 0 && i < 400) { const k = sorted[i % 5 + (i % 3 === 0 ? 5 : 0)]; i++; if (base[k] + (draft.extra[k] || 0) < C.ATTR_MAX_START) { draft.extra[k] = (draft.extra[k] || 0) + 1; pts--; } } renderCreate(slot); break; }
    case 'col': draft.col[+t.dataset.i] = t.dataset.c; renderCreate(slot); break;
    case 'start': startCareer(); break;
    case 'tab': tab = t.dataset.t; save.c.retired ? renderRetired() : renderHub(); break;
    case 'hub': post = null; renderHub(); break;
    case 'accept': tryAccept(+t.dataset.i); break;
    case 'decline': busy(() => { const ev = C.declineOffers(save); if (ev) toast('Something happened: ' + esc(ev.title)); }); break;
    case 'rest': busy(() => { C.rest(save, +t.dataset.w || 4); toast('You rest up.'); }); break;
    case 'rehab': busy(() => { const p = C.player(save); save.c.money -= rehabCost(); p.inj = Math.floor(p.inj / 2); toast('Sports-science rehab speeds things up.', 'good'); }); break;
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
      modal(`<h2>Change division</h2><p class="gx-muted">Moving up adds power but costs speed. Moving down makes you faster but the cut hurts your cardio. ${C.beltsOf(save).includes(p.div) ? '<b class="gx-gold">You will vacate your title.</b>' : `Champions can also chase a second belt through champ-vs-champ offers (max ${MAX_BELTS} belts).`}</p><div class="gx-row">${[adj.down, adj.up].filter(Boolean).map(d => `<button class="btn" data-act="div" data-d="${d}">${esc(C.divName(d))}</button>`).join('')}</div>`);
      break;
    }
    case 'div': { const msg = C.changeDivision(save, t.dataset.d); closeModal(); persist(); renderHub(); toast(esc(msg)); break; }
    case 'gym-m': modal(`<h2>Gyms</h2><p class="gx-muted gx-small">You pick your gym at the start of each camp. Better gyms unlock with bigger contracts.</p>${GYMS.map(g => `<p><b>${esc(g.name)}</b> ${'★'.repeat(g.q)}<br><span class="gx-small gx-muted">${esc(g.tip)} ${g.cost ? fmtMoney(g.cost) : 'Free'}</span></p>`).join('')}`); break;
    case 'retire-m': retireModal(); break;
    case 'retire': doRetire(); break;
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
    case 'hub-a': post = null; renderHub(); break;
  }
}
function defaultStrat() { const st = C.player(save).style; return ['wrestler', 'sambo', 'judo', 'bjj'].includes(st) ? 'wrestle' : st === 'karate' ? 'counter' : 'pressure'; }
// one delegated listener on the whole document: buttons inside modals (appended to <body>) work too
document.addEventListener('click', act);
initTips();
renderTitle();
window.__ct = { get save() { return save; } };
