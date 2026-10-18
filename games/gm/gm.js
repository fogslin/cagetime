// GM Mode UI
import * as G from './gm-core.js';
import { STYLES, TIERS, GYMS, weekLabel, DIVISIONS } from '../shared/data.js';
import { $, $$, esc, avatar, fl, tip, toast, modal, closeModal, initTips, bar, store } from '../shared/ui.js';
import { fmtMoney } from '../shared/rng.js';
import { REASONS } from '../shared/rematch.js';

const app = $('#app');
const KEY = (n) => 'ct-gm-slot-' + n, META = 'ct-gm-meta';
let slot = null, save = null, tab = 'desk', rkDiv = null, busy = false;

function persist() {
  if (!save) return;
  if (store.set(KEY(slot), save)) {
    const m = store.get(META, {});
    m[slot] = { name: save.g.name, wk: weekLabel(save.world.wk), money: save.g.money, clients: save.g.clients.length, belts: save.g.beltsWon, seasons: save.g.seasons.length };
    store.set(META, m);
  }
}
const W = () => save.world;
const belts = () => W().divs.filter(d => save.g.clients.includes(W().div[d].champ));
const rk = (f) => { const r = G.rankOf(W(), f.id); return r === 0 ? 'Champion' : r ? '#' + r : f.tier === 2 ? 'Unranked' : TIERS[f.tier].short + ' #' + G.tierStanding(W(), f.id); };
const mgrTag = (f) => { if (f.mgr === 'you') return '<span class="tag gold">Your client</span>'; const rv = f.mgr && save.g.rivals.find(x => x.id === f.mgr); return rv ? `<span class="tag" style="border-color:${rv.col};color:${rv.col}">${esc(rv.short)}</span>` : ''; };
function who(f, sub = '') { return `<div class="who">${avatar(f, 40, f.mgr === 'you' ? 'you' : '')}<div><div class="nm">${fl(f.cc)} ${esc(f.first)} ${esc(f.last)}</div><div class="sub">${esc(G.recStr(f))} · ${esc(STYLES[f.style].name)} · ${esc(G.divName(f.div))}${sub ? ' · ' + sub : ''}</div></div></div>`; }

function renderSlots() {
  save = null;
  document.body.classList.remove('ingame');
  const m = store.get(META, {});
  app.innerHTML = `<div class="gx-grid two">${[1, 2].map(n => m[n] ? `<div class="gx-card slot"><p class="gx-label">Slot ${n}</p><h2>${esc(m[n].name)}</h2><p class="gx-muted gx-small">${esc(m[n].wk)} · ${m[n].clients} fighters · ${fmtMoney(m[n].money)} · ${m[n].belts} titles won · ${m[n].seasons} seasons</p><div class="gx-row"><button class="btn" data-act="load" data-n="${n}">Continue</button><button class="btn ghost sm" data-act="del" data-n="${n}">Delete</button></div></div>`
    : `<div class="gx-card slot"><p class="gx-label">Slot ${n}</p><label class="fld"><span>Agency name</span><input id="nm-${n}" maxlength="32" placeholder="e.g. Northside Fight Management" autocomplete="off"></label><button class="btn" data-act="new" data-n="${n}">Start agency</button></div>`).join('')}</div>
  <div class="gx-card"><h2>How it works</h2><ul class="ticks">
   <li>You manage a stable of fictional fighters. You take a cut of every purse, and pay for camps, scouting and staff.</li>
   <li>Scout prospects to reveal their hidden ceiling, sign them, then book the right fights. Accept, negotiate or decline offers.</li>
   <li>Keep fighters active and happy: unhappy fighters with low loyalty leave, and rival agencies will try to poach them.</li>
   <li>Every week the world moves: rankings update, champions change, prospects rise and veterans retire. Win belts across divisions and chase Manager of the Year.</li>
   <li>Same rematch rules as Career Mode: max 3 meetings, and every rematch needs a real reason.</li></ul></div>`;
}
function top() {
  const g = save.g; const nxt = G.nextFightWk(save);
  return `<div class="gx-card hl"><div class="gx-row gx-sp"><div><p class="gx-label">${esc(weekLabel(W().wk))} · Season ${g.seasons.length + 1}</p><h2 style="margin:0">${esc(g.name)}</h2></div>
   <div class="gx-row"><button class="btn" data-act="adv" ${busy ? 'disabled' : ''}>Next week</button><button class="btn ghost" data-act="adv-n" ${busy ? 'disabled' : ''}>Sim to next fight ${tip('Advances week by week until one of your fighters competes, or something needs your attention (max 12 weeks).')}</button></div></div>
   <div class="stats4" style="margin-top:12px"><div class="stat"><small>Bank ${tip('Your cut of purses, minus weekly overhead (staff), camps and scouting.')}</small><b class="${g.money < 0 ? 'gx-red' : ''}">${fmtMoney(g.money)}</b></div>
   <div class="stat"><small>Reputation ${tip('Helps you sign prospects, win negotiations and get fights approved.')}</small><b>${Math.round(g.rep)}</b>${bar(g.rep, 100, 'gold')}</div>
   <div class="stat"><small>Stable</small><b>${g.clients.length}/8</b><span class="gx-dim gx-small">${nxt != null ? 'Next fight ' + esc(weekLabel(nxt)) : 'No fights booked'}</span></div>
   <div class="stat"><small>Belts held</small><b>${belts().length}</b><span class="gx-dim gx-small">${g.beltsWon} titles won all-time</span></div></div></div>`;
}
function render() {
  if (!save) return renderSlots();
  document.body.classList.add('ingame');
  const tabs = [['desk', 'Desk'], ['stable', 'Stable'], ['scout', 'Scouting'], ['rank', 'Rankings'], ['rivals', 'Rivals'], ['troph', 'Trophies'], ['news', 'News']];
  const n = save.g.events.length + save.g.offers.length;
  app.innerHTML = top() + `<div class="tabs" role="tablist">${tabs.map(([k, nm]) => `<button role="tab" aria-selected="${tab === k}" data-act="tab" data-t="${k}">${nm}${k === 'desk' && n ? ` <span class="tag red">${n}</span>` : ''}</button>`).join('')}</div><div id="tabp">${({ desk, stable, scout: scouting, rank, rivals, troph, news })[tab]()}</div>`;
  const s = $('#rk-div'); if (s) s.onchange = () => { rkDiv = s.value; render(); };
  $$('[data-gym]').forEach(el => el.onchange = () => { G.setGym(save, el.dataset.gym, el.value); persist(); render(); });
  $$('[data-plan]').forEach(el => el.onchange = () => { G.setPlan(save, el.dataset.plan, el.value); persist(); });
}
function desk() {
  const g = save.g, w = W();
  let h = '<div class="gx-layout"><div>';
  if (!g.clients.length) h += `<div class="gx-card event-card"><h2>Your stable is empty</h2><p>Head to Scouting and sign a fighter to get back in business.</p><button class="btn" data-act="tab" data-t="scout">Go scouting</button></div>`;
  for (const e of g.events) {
    const v = G.eventView(save, e); const f = e.fid && w.f[e.fid];
    h += `<div class="gx-card event-card"><p class="gx-label">${esc(v.title)}</p>${f ? who(f, rk(f)) : ''}<p>${esc(v.text)}</p><div class="gx-row">${v.choices.map(([l, t], i) => `<button class="btn ${i ? 'ghost' : ''} sm" data-act="evt" data-id="${e.id}" data-i="${i}">${esc(l)}</button>${t ? tip(t) : ''}`).join('')}</div></div>`;
  }
  h += `<div class="gx-card"><h2>Fight offers ${tip('Offers expire after two weeks. Your cut is taken from the show money plus the win bonus.')}</h2>`;
  if (!g.offers.length) h += '<p class="gx-muted">No offers on the table. Advance the calendar, or request a fight from the Stable tab.</p>';
  for (const of of g.offers) {
    const f = w.f[of.fid], o = w.f[of.opp]; if (!f || !o) continue;
    const s = G.series(w.h2h, f.id, o.id);
    const lab = { title: 'Title shot', defense: 'Title defense', superfight: 'Champ vs champ', short: 'Short notice', 'step-up': 'Step-up', 'tune-up': 'Tune-up', even: 'Even match', rematch: 'Rematch' }[of.type] || 'Fight';
    h += `<div class="gx-card ${of.title ? 'hl' : ''}" style="background:#0f0f14"><div class="gx-grid two">${who(f, rk(f))}${who(o, rk(o))}</div>
     <div class="gx-row" style="margin-top:8px"><span class="tag ${of.title ? 'gold' : of.short ? 'red' : ''}">${lab}</span>${of.title ? `<span class="tag gold">${esc(G.divName(of.div))} title</span>` : ''}${of.reason ? `<span class="tag blue">${esc(REASONS[of.reason].label)}</span>${tip(REASONS[of.reason].tip)}` : ''}${of.stable ? `<span class="tag red">Stable rivalry</span>${tip('The opponent is managed by a rival agency. Bigger purse, more heat.')}` : ''}${mgrTag(o)}${s.n ? `<span class="tag">H2H ${s.aw}-${s.bw}${s.dn ? '-' + s.dn : ''}</span>` : ''}</div>
     <div class="gx-row gx-sp" style="margin-top:8px"><span class="gx-small">${fmtMoney(of.show)} + ${fmtMoney(of.win)} · your ${f.mc.cut}%: <b>${fmtMoney((of.show) * f.mc.cut / 100)}–${fmtMoney((of.show + of.win) * f.mc.cut / 100)}</b> · ${of.weeks}-week camp · expires ${esc(weekLabel(of.exp))}</span>
     <span class="gx-row"><button class="btn sm" data-act="acc" data-id="${of.id}">Accept</button><button class="btn ghost sm" data-act="ask" data-id="${of.id}">Ask +20%</button><button class="btn ghost sm" data-act="dec" data-id="${of.id}">Decline</button></span></div></div>`;
  }
  h += '</div>';
  h += `<div class="gx-card"><h2>Recent results</h2>${g.fights.slice(0, 8).map(x => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="gx-row gx-sp"><span><span class="res ${x.res}">${x.res}</span> <b>${esc(x.fn)}</b> vs ${fl(x.oc)} ${esc(x.on)}${x.title ? ' <span class="tag gold">Title</span>' : ''}${x.tn === 'new' || x.tn === 'vacant' ? ' <span class="belt">New champ</span>' : ''}</span><span class="gx-dim gx-small">${esc(weekLabel(x.wk))}</span></div>
    <div class="gx-small gx-muted">${esc(x.m)} · R${x.r} ${esc(x.t)} · ${esc(x.ev)} · your cut ${fmtMoney(x.cut)}</div><div class="gx-small">${x.highlight.map(t => '“' + esc(t) + '”').join(' ')}</div>${x.log ? `<button class="btn ghost sm" style="margin-top:6px" data-act="watch" data-id="${x.id}">Watch the fight</button>` : ''}</div>`).join('') || '<p class="gx-muted">No fights yet.</p>'}</div>`;
  h += '</div><div class="gx-side">';
  h += `<div class="gx-card"><h3>Upcoming</h3>${(g.bookings || []).slice().sort((a, b) => a.wk - b.wk).map(b => `<p class="gx-small"><b>${esc(w.f[b.fid].last)}</b> vs ${esc(w.f[b.opp].first)} ${esc(w.f[b.opp].last)}${b.title ? ' 🏆' : ''}<br><span class="gx-dim">${esc(b.ev)} · ${esc(weekLabel(b.wk))}</span></p>`).join('') || '<p class="gx-muted gx-small">Nothing booked.</p>'}</div>`;
  const s = g.season;
  h += `<div class="gx-card"><h3>This season</h3><p class="gx-small">Record ${s.wins}-${s.losses} · ${s.titles} titles · ${fmtMoney(s.earned)} earned</p></div>`;
  h += `<div class="gx-card"><h3>Agency log</h3><ul class="news">${g.log.slice(0, 8).map(l => `<li><time>${esc(weekLabel(l.wk))}</time>${esc(l.txt)}</li>`).join('')}</ul></div></div></div>`;
  return h;
}
function stable() {
  const g = save.g, w = W();
  if (!g.clients.length) return '<div class="gx-card"><p class="gx-muted">No fighters. Sign some in Scouting.</p></div>';
  return `<div class="gx-grid two">${G.clients(save).map(f => {
    const b = (g.bookings || []).find(x => x.fid === f.id);
    const idle = w.wk - f.lw;
    const status = b ? `Booked vs ${esc(w.f[b.opp].last)}, ${esc(weekLabel(b.wk))}` : f.inj > 0 ? `<span class="gx-red">Injured (${f.inj}w)</span>` : idle > 18 ? `<span class="gx-gold">Restless: ${idle} weeks idle</span>` : `Idle ${Math.max(0, idle)} weeks`;
    return `<div class="gx-card">${who(f, rk(f))}
     <div class="gx-small gx-muted" style="margin:8px 0">Age ${f.age} · OVR ${G.ovr(f.attrs)} · ${esc(TIERS[f.tier].name)} · ${status}</div>
     <div class="attr-row"><span>Morale ${tip('Wins, activity, good camps and accepted title shots raise it. Morale gives a small in-fight edge.')}</span>${bar(f.mor, 100, f.mor < 35 ? '' : 'green')}<b>${Math.round(f.mor)}</b></div>
     <div class="attr-row"><span>Loyalty ${tip('Drifts toward morale. Low-loyalty fighters leave when their deal ends or when a rival comes calling.')}</span>${bar(f.loy, 100, 'blue')}<b>${Math.round(f.loy)}</b></div>
     <p class="gx-small">Contract: ${f.mc.cut}% cut · ${Math.max(0, f.mc.wk - w.wk)} weeks left</p>
     <div class="gx-grid two"><label class="fld"><span>Camp ${tip('Paid by your agency each fight. Better camps = sharper fighter and faster growth.')}</span><select data-gym="${f.id}">${GYMS.map(x => `<option value="${x.id}" ${x.id === f.gym ? 'selected' : ''}>${esc(x.name)} (${x.cost ? fmtMoney(x.cost) : 'free'})</option>`).join('')}</select></label>
     <label class="fld"><span>Game plan</span><select data-plan="${f.id}">${Object.entries(G.PLAN_NAMES).map(([k, v]) => `<option value="${k}" ${k === (f.plan || 'auto') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></div>
     <div class="gx-row"><button class="btn sm" data-act="req" data-id="${f.id}" ${f.bk || f.inj > 0 ? 'disabled' : ''}>Request fight</button><button class="btn ghost sm" data-act="info" data-id="${f.id}">Profile</button><button class="btn ghost sm" data-act="divm" data-id="${f.id}" ${f.bk ? 'disabled' : ''}>Division</button><button class="btn ghost sm" data-act="rel" data-id="${f.id}">Release</button></div></div>`;
  }).join('')}</div>`;
}
function scouting() {
  const g = save.g, w = W();
  return `<div class="gx-card"><h2>Prospects & free agents ${tip('Potential is hidden. Each scouting level narrows the estimate. Prospects with a rival tag are being courted by another agency.')}</h2><p class="gx-small gx-muted">Stable ${g.clients.length}/8. The board refreshes every few weeks.</p>
   <div class="gx-grid two">${g.pool.map(p => { const f = w.f[p.id]; if (!f) return ''; const e = G.potEstimate(save, p); const rv = p.interest && g.rivals.find(x => x.id === p.interest);
    return `<div class="gx-card" style="background:#0f0f14">${who(f, TIERS[f.tier].short)}<div class="gx-row" style="margin:8px 0">${p.fa ? '<span class="tag green">Free agent</span>' : '<span class="tag">Prospect</span>'}<span class="tag">Age ${f.age}</span><span class="tag">OVR ~${e.ovr}</span><span class="tag gold">Potential ${e.lo === e.hi ? e.lo : e.lo + '–' + e.hi}</span>${rv ? `<span class="tag red">${esc(rv.short)} interested</span>` : ''}</div>
    <div class="gx-row"><button class="btn ghost sm" data-act="scout" data-id="${p.id}" ${p.lv >= 3 ? 'disabled' : ''}>${p.lv >= 3 ? 'Fully scouted' : 'Scout (' + fmtMoney(G.SCOUT_COST[p.lv]) + ')'}</button><button class="btn sm" data-act="offer" data-id="${p.id}">Make offer</button></div></div>`; }).join('')}</div></div>`;
}
function rank() {
  const w = W(); const div = rkDiv && w.div[rkDiv] ? rkDiv : (G.clients(save)[0] || {}).div || 'LW';
  const D = w.div[div]; const c = D.champ && w.f[D.champ];
  return `<div class="gx-card"><div class="gx-row gx-sp"><h2 style="margin:0">Stormvale rankings</h2><select id="rk-div" aria-label="Division">${w.divs.map(d => `<option value="${d}" ${d === div ? 'selected' : ''}>${esc(G.divName(d))}${w.div[d].champ && save.g.clients.includes(w.div[d].champ) ? ' 🏆' : ''}</option>`).join('')}</select></div>
   <div class="gx-card hl" style="margin-top:12px;background:#0f0f14">${c ? `<p class="gx-label">Champion · ${D.def} defenses</p><div class="gx-row gx-sp">${who(c)}${mgrTag(c)}</div>` : '<p class="gx-muted">Vacant</p>'}</div>
   <div class="tscroll"><table class="gx-table"><thead><tr><th>#</th><th>Fighter</th><th>Record</th><th>Streak</th><th>Manager</th></tr></thead><tbody>${G.rankings(w, div).map((id, i) => { const f = w.f[id]; return `<tr class="${f.mgr === 'you' ? 'me' : ''}"><td>${i + 1}</td><td>${fl(f.cc)} ${esc(f.first)} ${esc(f.last)}</td><td>${esc(G.recStr(f))}</td><td>${f.streak > 0 ? 'W' + f.streak : f.streak < 0 ? 'L' + -f.streak : '—'}</td><td>${mgrTag(f)}</td></tr>`; }).join('')}</tbody></table></div>
   <p class="gx-small gx-dim">Title lineage: ${D.hist.slice(-6).map(x => esc(x.name)).join(' → ')}</p></div>`;
}
function rivals() {
  const g = save.g, w = W();
  const rows = g.rivals.map(rv => { const fs = Object.values(w.f).filter(f => f.mgr === rv.id && f.act); return { rv, n: fs.length, b: w.divs.filter(d => fs.some(f => w.div[d].champ === f.id)).length, top: fs.filter(f => G.rankOf(w, f.id) != null).length }; });
  return `<div class="gx-card"><h2>Rival agencies ${tip('Heat rises when you trash-talk or beat their fighters. Their fighters pay more to face, and they will try to poach your unhappy clients.')}</h2><div class="tscroll"><table class="gx-table"><thead><tr><th>Agency</th><th>Rep</th><th>Fighters</th><th>Ranked</th><th>Belts</th><th>Heat</th></tr></thead><tbody>
   <tr class="me"><td><b>${esc(g.name)}</b> (you)</td><td>${Math.round(g.rep)}</td><td>${g.clients.length}</td><td>${G.clients(save).filter(f => G.rankOf(w, f.id) != null).length}</td><td>${belts().length}</td><td>—</td></tr>
   ${rows.map(x => `<tr><td><span style="color:${x.rv.col}">●</span> ${esc(x.rv.name)}</td><td>${Math.round(x.rv.rep)}</td><td>${x.n}</td><td>${x.top}</td><td>${x.b}</td><td>${x.rv.heat >= 40 ? `<span class="tag red">${Math.round(x.rv.heat)}</span>` : Math.round(x.rv.heat)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function troph() {
  const g = save.g;
  return `<div class="gx-grid two"><div class="gx-card"><h2>Trophy cabinet</h2>${g.trophies.length ? `<ul class="news">${g.trophies.map(t => `<li><time>${esc(weekLabel(t.wk))}</time>${t.kind === 'belt' ? '🏆' : t.kind === 'award' ? '🥇' : '👋'} ${esc(t.txt)}</li>`).join('')}</ul>` : '<p class="gx-muted">Win titles and awards to fill this up.</p>'}</div>
   <div class="gx-card"><h2>Seasons</h2>${g.seasons.length ? `<div class="tscroll"><table class="gx-table"><thead><tr><th>Year</th><th>W-L</th><th>Titles</th><th>Earned</th><th>Manager of the Year</th></tr></thead><tbody>${g.seasons.map(s => `<tr class="${s.mgr === g.name ? 'me' : ''}"><td>${s.year}</td><td>${s.wins}-${s.losses}</td><td>${s.titles}</td><td>${fmtMoney(s.earned)}</td><td>${esc(s.mgr)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="gx-muted">Season awards are handed out at the end of each year.</p>'}
   ${W().awards.length ? `<p class="gx-label" style="margin-top:12px">${W().awards[0].year} league awards</p><p class="gx-small">Fighter of the Year: <b>${esc(W().awards[0].foy ? W().awards[0].foy.name : '—')}</b><br>Knockout of the Year: ${esc(W().awards[0].koy ? W().awards[0].koy.txt : '—')}<br>Fight of the Year: ${esc(W().awards[0].fotn ? W().awards[0].fotn.txt : '—')}<br>Upset of the Year: ${esc(W().awards[0].upset ? W().awards[0].upset.txt : '—')}</p>` : ''}</div></div>`;
}
function news() {
  return `<div class="gx-grid two"><div class="gx-card"><h2>Around the sport</h2><ul class="news">${W().news.slice(0, 30).map(n => `<li><time>${esc(weekLabel(n.wk))}</time>${esc(n.txt)}</li>`).join('')}</ul></div><div class="gx-card"><h2>Agency log</h2><ul class="news">${save.g.log.slice(0, 30).map(n => `<li><time>${esc(weekLabel(n.wk))}</time>${esc(n.txt)}</li>`).join('')}</ul></div></div>`;
}
function watch(id) {
  const x = save.g.fights.find(f => f.id === id); if (!x || !x.log) return;
  const m = modal(`<p class="gx-label">${esc(x.ev)}</p><h2>${esc(x.fn)} vs ${esc(x.on)}</h2><div class="pbp" id="wpbp" style="max-height:55vh"></div><div class="gx-row" style="margin-top:10px"><button class="btn sm" data-act="w-all">Show it all</button></div><p id="wres" class="hidden"><b>${esc(x.m)}</b> · R${x.r} ${esc(x.t)}${x.cards ? ' · Cards: ' + x.cards.map(c => c.join('-')).join(', ') : ''}</p>`, { wide: true });
  const lines = []; x.log.forEach((r, i) => { lines.push(['', 'Round ' + (i + 1), 'rd']); r.forEach(l => lines.push(l)); });
  const box = m.querySelector('#wpbp'); let i = 0;
  const step = () => { if (!document.body.contains(box)) return; if (i >= lines.length) { m.querySelector('#wres').classList.remove('hidden'); return; } const [t, txt, cls] = lines[i++]; box.insertAdjacentHTML('beforeend', `<p class="${cls}"><time>${esc(t)}</time><span>${esc(txt)}</span></p>`); box.scrollTop = box.scrollHeight; setTimeout(step, cls === 'rd' ? 500 : 260); };
  m.querySelector('[data-act=w-all]').onclick = () => { i = lines.length; box.innerHTML = lines.map(([t, txt, cls]) => `<p class="${cls}"><time>${esc(t)}</time><span>${esc(txt)}</span></p>`).join(''); m.querySelector('#wres').classList.remove('hidden'); box.scrollTop = box.scrollHeight; };
  step();
}
function showOut(out) {
  for (const r of out.results) toast(`${r.res === 'W' ? '✅' : r.res === 'L' ? '❌' : '➖'} ${esc(r.fn)} ${r.res === 'W' ? 'beats' : r.res === 'L' ? 'loses to' : 'vs'} ${esc(r.on)} (${esc(r.m)})`, r.res === 'W' ? 'good' : 'bad');
  if (out.season) modal(`<p class="gx-label">Season ${out.season.year} wrap-up</p><h2>${out.season.mgr === save.g.name ? '🥇 Manager of the Year!' : 'Season complete'}</h2><p>Record ${out.season.wins}-${out.season.losses} · ${out.season.titles} titles · ${fmtMoney(out.season.earned)} earned · ${out.season.belts} belts held.</p><p class="gx-muted">Manager of the Year: ${esc(out.season.mgr)}. Fighter of the Year: ${esc(out.season.foy)}${out.season.myFoy ? ' (your client!)' : ''}.</p>`);
}
function act(e) {
  const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
  const a = t.dataset.act, id = t.dataset.id;
  const done = (msg, kind) => { if (msg) toast(esc(msg), kind); persist(); render(); };
  switch (a) {
    case 'new': { const n = +t.dataset.n; const nm = ($('#nm-' + n).value || '').trim() || 'Northside Fight Management'; app.innerHTML = '<p class="gx-muted">Building the fight world…</p>'; setTimeout(() => { save = G.newGM({ name: nm }); slot = n; tab = 'desk'; persist(); render(); toast('Welcome, manager. You have two fighters and offers on the desk.', 'good'); }, 30); break; }
    case 'load': { const s = store.get(KEY(+t.dataset.n)); if (!s) { toast('Save could not be loaded.', 'bad'); return; } save = s; slot = +t.dataset.n; tab = 'desk'; render(); break; }
    case 'del': if (confirm('Delete this agency save?')) { store.del(KEY(+t.dataset.n)); const m = store.get(META, {}); delete m[t.dataset.n]; store.set(META, m); renderSlots(); } break;
    case 'tab': tab = t.dataset.t; closeModal(); render(); break;
    case 'adv': { const out = G.advance(save); showOut(out); persist(); render(); break; }
    case 'adv-n': {
      busy = true; render();
      let out = { results: [] }; let k = 0;
      const tick = () => {
        out = G.advance(save); k++;
        if (out.results.length || out.season || save.g.events.length || save.g.offers.some(o => o.title) || k >= 12) { busy = false; showOut(out); persist(); render(); }
        else setTimeout(tick, 0);
      };
      setTimeout(tick, 0); break;
    }
    case 'acc': { const r = G.acceptOffer(save, id); done(r.msg, r.ok ? 'good' : 'bad'); break; }
    case 'ask': { const of = save.g.offers.find(o => o.id === id); const r = G.acceptOffer(save, id, 1); if (r.mor && of) { const f = W().f[of.fid]; f.mor = Math.max(0, f.mor + r.mor); } done(r.msg, r.ok ? 'good' : 'bad'); break; }
    case 'dec': done(G.declineOffer(save, id)); break;
    case 'evt': done(G.resolveEvent(save, id, +t.dataset.i)); break;
    case 'watch': watch(id); break;
    case 'scout': done(G.scout(save, id)); break;
    case 'offer': {
      const f = W().f[id];
      const body = () => { const cut = +$('#of-cut').value, bonus = +$('#of-bonus').value; $('#of-ch').textContent = Math.round(G.signChance(save, id, cut, bonus) * 100) + '%'; $('#of-cutv').textContent = cut + '%'; };
      modal(`<h2>Offer: ${esc(f.first)} ${esc(f.last)}</h2>${who(f)}<label class="fld" style="margin-top:12px"><span>Your cut: <b id="of-cutv">15%</b> ${tip('Higher cut = more money for you, but harder to sign and lower loyalty.')}</span><input type="range" id="of-cut" min="8" max="30" value="15"></label>
       <label class="fld"><span>Signing bonus</span><select id="of-bonus">${[0, 2000, 5000, 10000, 25000, 50000].map(v => `<option value="${v}">${fmtMoney(v)}</option>`).join('')}</select></label>
       <p>Chance they sign: <b id="of-ch">—</b></p><button class="btn" data-act="sign" data-id="${id}">Send offer</button>`);
      $('#of-cut').oninput = body; $('#of-bonus').onchange = body; body(); break;
    }
    case 'sign': { const cut = +$('#of-cut').value, bonus = +$('#of-bonus').value; const r = G.trySign(save, id, cut, bonus); const f = W().f[id]; if (r.ok && f) f.loy = Math.max(20, 75 - (cut - 10) * 2.5); closeModal(); done(r.msg, r.ok ? 'good' : 'bad'); break; }
    case 'req': {
      const f = W().f[id]; const list = G.fightTargets(save, id);
      modal(`<h2>Request a fight for ${esc(f.last)}</h2><p class="gx-small gx-muted">The matchmaker is more likely to say yes to step-ups and to fights with a story. Rematch rules apply: max 3 meetings, and a rematch needs a reason.</p>${list.map(x => `<div class="gx-row gx-sp" style="padding:8px 0;border-bottom:1px solid var(--line)">${who(x.o, rk(x.o))}<span class="gx-row"><span class="gx-small ${x.ok ? 'gx-green' : 'gx-dim'}">${esc(x.why)}</span><button class="btn sm" data-act="req2" data-id="${id}" data-o="${x.o.id}" ${x.ok ? '' : 'disabled'}>Request</button></span></div>`).join('')}`, { wide: true });
      break;
    }
    case 'req2': { const r = G.requestFight(save, id, t.dataset.o); closeModal(); done(r.msg, r.ok ? 'good' : 'bad'); break; }
    case 'info': {
      const f = W().f[id];
      modal(`${who(f, rk(f))}<p class="gx-small gx-muted" style="margin-top:8px">${esc(STYLES[f.style].tip)} Age ${f.age}. Ceiling ~${f.pot}. Last 5: ${f.recent.slice(-5).map(r => `<span class="res ${r === 'N' ? 'NC' : r}">${r}</span>`).join(' ')}</p>${Object.entries(f.attrs).map(([k, v]) => `<div class="attr-row"><span>${esc(({ str: 'Striking', pow: 'Power', spd: 'Speed', chin: 'Chin', cardio: 'Cardio', wre: 'Wrestling', tdd: 'TD Defense', bjj: 'Submissions', subd: 'Sub Defense', iq: 'Fight IQ' })[k])}</span>${bar(v)}<b>${Math.round(v)}</b></div>`).join('')}`);
      break;
    }
    case 'divm': { const f = W().f[id]; const adj = G.adjacentDivs(f.div); modal(`<h2>Move ${esc(f.last)}</h2><p class="gx-muted">Changing division resets their spot in the rankings a bit. Champions vacate their belt.</p><div class="gx-row">${[adj.down, adj.up].filter(Boolean).map(d => `<button class="btn" data-act="div2" data-id="${id}" data-d="${d}">${esc(G.divName(d))}</button>`).join('')}</div>`); break; }
    case 'div2': { const msg = G.moveDivision(save, id, t.dataset.d); closeModal(); done(msg); break; }
    case 'rel': if (confirm('Release this fighter? Your reputation takes a small hit.')) done(G.releaseClient(save, id)); break;
  }
}
app.addEventListener('click', act);
initTips();
renderSlots();
window.__ct = { get save() { return save; } };
