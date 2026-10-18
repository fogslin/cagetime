// Round-by-round MMA fight engine shared by Career Mode and GM Mode.
// Attributes + per-round strategy drive every exchange; judges score each round with noise.
import { STRATEGIES } from './data.js';
import { clamp } from './rng.js';

const SUBS = ['rear-naked choke', 'guillotine', 'arm-triangle', 'armbar', 'triangle choke', 'kimura', "d'arce choke", 'heel hook', 'anaconda choke', 'kneebar'];
const PUNCH = ['jab', 'straight right', 'left hook', 'right hook', 'uppercut', 'overhand right', 'body shot', 'one-two'];
const KICK = ['leg kick', 'body kick', 'calf kick', 'head kick', 'teep to the body', 'switch kick'];
const SPECIAL = ['spinning back fist', 'flying knee', 'spinning wheel kick', 'question-mark kick', 'step-in elbow'];
export const K = { kd: 0.0042, ko: 0.2, sub: 0.035, subw: 0.12, dmg: 0.5, tko: 0.42, foul: 0.0003, jn: 3.2, jn2: 0.18 };
const fmtT = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

function side(f, mods = {}) {
  const a = { ...f.attrs };
  if (mods.add) for (const k in mods.add) a[k] = clamp(a[k] + mods.add[k], 15, 105);
  return {
    f, name: f.last, full: f.first + ' ' + f.last, style: f.style, a,
    hp: 100, gas: 100 * (mods.gasStart || 1), hurt: 0, cut: 0, plan: mods.plan || 0, home: mods.home || 0,
    st: { sig: 0, sigAtt: 0, td: 0, tdAtt: 0, sub: 0, kd: 0, ctrl: 0, dmg: 0 },
  };
}
export function createFight(fa, fb, opts = {}) {
  return {
    rounds: opts.rounds || 3, title: !!opts.title, r: 0, over: false, result: null, verbose: opts.verbose !== false,
    A: side(fa, opts.modsA), B: side(fb, opts.modsB), mom: 0, cards: [[], [], []], roundLogs: [], roundStats: [],
    judgeBias: [0, 0, 0].map(() => (opts.rng() - 0.5) * 0.6), rng: opts.rng,
  };
}
// stamina-adjusted attribute
const E = (s, k) => s.a[k] * (0.6 + 0.4 * s.gas / 100) * (s.hurt > 0 ? 0.82 : 1) * (1 + s.plan * 0.02);

export function aiStrategy(fs, me, opp) {
  const rng = fs.rng; const st = me.f.style;
  const last = fs.r === fs.rounds - 1;
  let lead = 0;
  for (let j = 0; j < 3; j++) for (const c of fs.cards[j]) lead += (me === fs.A ? c[0] - c[1] : c[1] - c[0]);
  if (opp.hurt > 0 || opp.hp < 35) return 'finish';
  if (last && lead < -1) return 'finish';
  if (last && lead > 2 && rng.chance(0.6)) return 'safe';
  const wrestleBias = (me.a.wre - opp.a.tdd) + (opp.a.str - me.a.str) * 0.5;
  if ((st === 'wrestler' || st === 'sambo' || st === 'judo' || st === 'bjj') && wrestleBias > -10 && rng.chance(0.7)) return 'wrestle';
  if (wrestleBias > 15 && rng.chance(0.5)) return 'wrestle';
  if (me.gas < 45) return rng.chance(0.5) ? 'safe' : 'counter';
  if (st === 'karate' || st === 'boxer') return rng.chance(0.55) ? 'counter' : 'pressure';
  if (st === 'brawler') return rng.chance(0.7) ? 'pressure' : 'finish';
  return rng.pick(['pressure', 'pressure', 'counter', 'safe']);
}

function line(fs, t, txt, cls) { if (fs.verbose) fs.log.push({ t: fmtT(t), txt, cls: cls || '' }); }

function finish(fs, winner, method, detail, t) {
  fs.over = true;
  const w = winner === 'A' ? fs.A : fs.B, l = winner === 'A' ? fs.B : fs.A;
  fs.result = { winner, method, detail, round: fs.r + 1, time: fmtT(t), close: false, contro: false };
  line(fs, t, `${method === 'SUB' ? 'TAP! ' : 'IT IS ALL OVER! '}${w.full} wins by ${method === 'SUB' ? 'submission (' + detail + ')' : method + ' (' + detail + ')'} at ${fmtT(t)} of round ${fs.r + 1}.`, 'end');
  void l;
}

// Simulate one round. sA / sB are strategy keys.
export function simRound(fs, sA, sB) {
  if (fs.over) return;
  const rng = fs.rng;
  fs.log = [];
  const S = { A: STRATEGIES[sA], B: STRATEGIES[sB] };
  const rs = { A: { sig: 0, td: 0, kd: 0, ctrl: 0, dmg: 0, sub: 0, sigAtt: 0 }, B: { sig: 0, td: 0, kd: 0, ctrl: 0, dmg: 0, sub: 0, sigAtt: 0 } };
  let pos = 'stand', top = null, groundTime = 0, t = 0;
  const other = (k) => (k === 'A' ? 'B' : 'A');
  const sideOf = (k) => fs[k];
  const hurtCheck = (atk, dk, dmg, tm, from) => {
    const d = sideOf(dk), a = sideOf(atk);
    // knockdown chance scales with power vs chin and accumulated damage
    const pKD = K.kd * dmg * Math.pow(E(a, 'pow') / 70, 2.2) * Math.pow(70 / Math.max(25, E(d, 'chin')), 1.6) * (1 + (100 - d.hp) / 70) * S[atk].fin;
    if (rng() < pKD) {
      rs[atk].kd++; a.st.kd++; d.hurt = 2; d.hp -= 8;
      fs.mom += atk === 'A' ? 30 : -30;
      line(fs, tm, `${a.name} DROPS ${d.name} with a ${from}!`, 'big');
      const pKO = K.ko * Math.pow(E(a, 'pow') / 75, 1.5) * Math.pow(65 / Math.max(25, E(d, 'chin')), 1.3) * (1 + (100 - d.hp) / 90) * S[atk].fin;
      if (rng() < pKO) { finish(fs, atk, 'KO', from.replace(/^a /, ''), tm); return true; }
      if (rng() < K.tko * S[atk].fin * (1 + (100 - d.hp) / 120)) { finish(fs, atk, 'TKO', 'punches', tm + rng.int(3, 12)); return true; }
      line(fs, tm + 2, `${d.name} survives the follow-up and gets back to the feet.`);
      return false;
    }
    if (d.hp < 22 && rng() < (22 - d.hp) / 30 * S[atk].fin) { finish(fs, atk, 'TKO', 'punches', tm); return true; }
    if (dmg > 3 && rng() < 0.12) { d.hurt = 1; line(fs, tm, `${d.name} is rocked by the ${from}!`, 'warn'); fs.mom += atk === 'A' ? 10 : -10; }
    return false;
  };
  while (t < 300 && !fs.over) {
    const dt = rng.int(10, 22); t = Math.min(300, t + dt);
    for (const k of ['A', 'B']) {
      const s = sideOf(k);
      s.gas = clamp(s.gas - (dt / 15) * S[k].gas * (1.65 - s.a.cardio / 100) * (pos !== 'stand' ? 1.15 : 1), 5, 100);
      if (s.hurt > 0 && rng.chance(0.25)) s.hurt--;
    }
    if (pos === 'stand') {
      const wTD = { A: 0.13 * S.A.td * Math.pow(E(fs.A, 'wre') / 70, 2), B: 0.13 * S.B.td * Math.pow(E(fs.B, 'wre') / 70, 2) };
      const r = rng() * (1 + wTD.A + wTD.B + 0.08);
      if (r > 1 + 0.08) {
        const atk = r > 1 + 0.08 + wTD.A ? 'B' : 'A', dk = other(atk), a = sideOf(atk), d = sideOf(dk);
        a.st.tdAtt++;
        const p = clamp(0.4 + 0.0085 * (E(a, 'wre') - E(d, 'tdd') * (S[dk].tdd || 1)), 0.08, 0.86);
        if (rng() < p) {
          pos = 'ground'; top = atk; groundTime = 0; a.st.td++; rs[atk].td++; fs.mom += atk === 'A' ? 6 : -6;
          line(fs, t, `${a.name} ${rng.pick(['changes levels and completes the double-leg', 'hits a slick trip against the fence', 'drags ' + d.name + ' down with a single-leg', 'lands a big throw', 'scoops the leg and finishes'])}.`);
        } else { a.gas -= 2; line(fs, t, `${d.name} stuffs the takedown attempt from ${a.name}.`, 'dim'); }
      } else if (r > 1) {
        // clinch work
        const atk = E(fs.A, 'str') + E(fs.A, 'pow') + rng.range(-25, 25) > E(fs.B, 'str') + E(fs.B, 'pow') ? 'A' : 'B';
        const a = sideOf(atk), dk = other(atk), d = sideOf(dk);
        const n = rng.int(1, 3) + (a.style === 'muaythai' ? 1 : 0);
        const dmg = n * (0.7 + E(a, 'pow') / 110);
        d.hp -= K.dmg * dmg * (1.6 - E(d, 'chin') / 100); a.st.sig += n; a.st.sigAtt += n + 1; rs[atk].sig += n; rs[atk].sigAtt += n + 1; rs[atk].dmg += dmg; a.st.dmg += dmg;
        line(fs, t, `${a.name} lands ${n > 2 ? 'a series of knees' : rng.pick(['a knee to the body', 'short elbows', 'dirty boxing uppercuts'])} in the clinch.`);
        if (hurtCheck(atk, dk, dmg, t, 'knee')) break;
      } else {
        // striking exchange
        let best = null;
        for (const k of ['A', 'B']) {
          const a = sideOf(k), d = sideOf(other(k));
          const def = (E(d, 'spd') * 0.4 + E(d, 'iq') * 0.4 + E(d, 'str') * 0.2) * S[other(k)].def;
          let acc = clamp(0.3 + 0.006 * (E(a, 'str') * 0.7 + E(a, 'spd') * 0.3 - def) + a.home * 0.01, 0.12, 0.68);
          if (S[k].cnt && S[other(k)].out > 1) acc *= S[k].cnt;
          const thrown = Math.max(1, Math.round(rng.range(2, 7) * S[k].out * (0.55 + 0.45 * a.gas / 100)));
          let landed = 0; for (let i = 0; i < thrown; i++) if (rng() < acc) landed++;
          a.st.sigAtt += thrown; rs[k].sigAtt += thrown; a.st.sig += landed; rs[k].sig += landed;
          const dmg = landed * (0.45 + E(a, 'pow') / 95) * rng.range(0.6, 1.4);
          d.hp -= K.dmg * dmg * (1.55 - E(d, 'chin') / 110); rs[k].dmg += dmg; a.st.dmg += dmg;
          fs.mom += (k === 'A' ? 1 : -1) * landed * 1.5;
          if (!best || landed > best.landed) best = { k, landed, dmg };
          if (landed > 0 && hurtCheck(k, other(k), dmg, t, rng.chance(0.03) ? rng.pick(SPECIAL) : rng.chance(0.3) ? rng.pick(KICK) : rng.pick(PUNCH))) break;
        }
        if (fs.over) break;
        if (best && best.landed > 0 && fs.verbose && rng.chance(0.75)) {
          const a = sideOf(best.k), d = sideOf(other(best.k));
          const blow = rng.chance(0.35) ? rng.pick(KICK) : rng.pick(PUNCH);
          line(fs, t, best.landed >= 4 ? `${a.name} puts together a ${best.landed}-strike combination, finishing with a ${blow}.` : rng.pick([`${a.name} lands a clean ${blow}.`, `${a.name} finds the mark with a ${blow}.`, `Good ${blow} from ${a.name}.`, `${d.name} eats a ${blow}.`]));
        } else if (fs.verbose && rng.chance(0.25)) line(fs, t, rng.pick(['Both fighters feint and circle, looking for an opening.', 'Big swings, nothing clean.', 'Measured pace on the feet.', 'The crowd wants more action.']), 'dim');
      }
    } else {
      const tk = top, bk = other(top), T = sideOf(tk), Bt = sideOf(bk);
      T.st.ctrl += dt; rs[tk].ctrl += dt; groundTime += dt;
      const wGnp = 1 * S[tk].out, wSubT = K.subw * Math.pow(E(T, 'bjj') / 70, 2.2) * S[tk].fin, wSubB = 0.07 * Math.pow(E(Bt, 'bjj') / 70, 2.5) * S[bk].fin;
      const wUp = 0.22 * Math.pow((E(Bt, 'tdd') + E(Bt, 'wre') * 0.5) / Math.max(30, E(T, 'wre') * 1.3), 1.5) * (S[bk].tdd || 1) + (groundTime > 120 ? 0.25 : 0);
      const r = rng() * (wGnp + wSubT + wSubB + wUp);
      if (r < wGnp) {
        const n = rng.int(0, 4); const dmg = n * (0.55 + E(T, 'pow') / 110);
        Bt.hp -= K.dmg * dmg * (1.5 - E(Bt, 'chin') / 120); T.st.sig += n; T.st.sigAtt += n + 1; rs[tk].sig += n; rs[tk].sigAtt += n + 1; rs[tk].dmg += dmg; T.st.dmg += dmg;
        if (rng.chance(0.08) && n > 1) Bt.cut += rng.int(1, 3);
        if (n > 0 && rng.chance(0.5)) line(fs, t, `${T.name} ${n > 2 ? 'unloads ground-and-pound' : rng.pick(['lands short elbows from the top', 'postures up and drops a punch', 'controls and chips away'])}.`);
        if (Bt.hp < 28 && rng() < (28 - Bt.hp) / 40 * S[tk].fin) { finish(fs, tk, 'TKO', 'ground and pound', t); break; }
      } else if (r < wGnp + wSubT || r < wGnp + wSubT + wSubB) {
        const ak = r < wGnp + wSubT ? tk : bk, dk = other(ak), a = sideOf(ak), d = sideOf(dk);
        const sub = rng.pick(SUBS); a.st.sub++; rs[ak].sub++;
        const p = clamp(K.sub + 0.0075 * (E(a, 'bjj') - E(d, 'subd')) + (100 - d.gas) / 450 + (d.hurt ? 0.08 : 0), 0.03, 0.62) * (S[ak].fin > 1 ? 1.15 : 1);
        line(fs, t, `${a.name} locks up a ${sub}!`, 'warn');
        if (rng() < p) { finish(fs, ak, 'SUB', sub, t + rng.int(4, 15)); break; }
        line(fs, t + 3, `${d.name} defends and escapes the ${sub}.`);
        if (ak === bk && rng.chance(0.35)) { top = bk; line(fs, t + 4, `${a.name} sweeps into top position.`); }
        fs.mom += ak === 'A' ? 4 : -4;
      } else {
        pos = 'stand'; top = null;
        line(fs, t, groundTime > 120 ? 'The referee stands them up.' : `${Bt.name} ${rng.pick(['scrambles back to the feet', 'wall-walks up', 'hip-escapes and stands'])}.`, 'dim');
      }
    }
    // rare accidental foul
    if (!fs.over && rng() < K.foul) {
      const vk = rng.chance(0.5) ? 'A' : 'B', v = sideOf(vk);
      line(fs, t, `Accidental ${rng.pick(['eye poke', 'clash of heads', 'low blow'])} on ${v.name}. The doctor is called in...`, 'warn');
      if (rng.chance(0.55)) {
        if (fs.r < 2) { fs.over = true; fs.result = { winner: null, method: 'NC', detail: 'accidental foul', round: fs.r + 1, time: fmtT(t), close: true, contro: true }; line(fs, t, 'The fight is waved off. NO CONTEST.', 'end'); }
        else { scoreRound(fs, rs); fs.over = true; decide(fs, true, t); }
        break;
      }
      line(fs, t + 10, `${v.name} is good to continue.`);
    }
    fs.mom = clamp(fs.mom * 0.97, -100, 100);
  }
  for (const k of ['A', 'B']) rs[k].ctrl = Math.round(rs[k].ctrl);
  fs.roundStats.push(rs);
  if (!fs.over) {
    scoreRound(fs, rs);
    // doctor check on a bad cut between rounds
    for (const k of ['A', 'B']) {
      const s = sideOf(k);
      if (!fs.over && s.cut >= 4 && rng() < 0.07 * (s.cut - 3)) {
        fs.over = true; fs.result = { winner: other(k), method: 'TKO', detail: 'doctor stoppage', round: fs.r + 1, time: '5:00', close: false, contro: false };
        line(fs, 300, `The doctor stops the fight because of a bad cut on ${s.name}! ${sideOf(other(k)).full} wins by TKO (doctor stoppage).`, 'end');
      }
    }
    // recover between rounds
    for (const k of ['A', 'B']) { const s = sideOf(k); s.gas = clamp(s.gas + 12 + s.a.cardio / 8, 0, 100); s.hp = clamp(s.hp + 4, 0, 100); s.hurt = 0; }
    fs.mom *= 0.5;
  }
  fs.roundLogs.push(fs.log);
  fs.r++;
  if (!fs.over && fs.r >= fs.rounds) { fs.over = true; decide(fs, false, 300); }
}

function scoreRound(fs, rs) {
  const rng = fs.rng;
  const sc = (k) => rs[k].sig * 1 + rs[k].dmg * 0.6 + rs[k].kd * 10 + rs[k].td * 2.5 + rs[k].ctrl / 35 + rs[k].sub * 1.8;
  const a = sc('A'), b = sc('B');
  fs.cards.forEach((card, j) => {
    const noise = rng.gauss(0, K.jn + K.jn2 * (a + b) / 2);
    const diff = a - b + noise + fs.judgeBias[j] * 3 + (fs.A.home - fs.B.home) * 0.8;
    let ca = 10, cb = 10;
    if (Math.abs(diff) < 0.2 && rng.chance(0.15)) { /* 10-10 */ } else if (diff >= 0) {
      cb = (rs.A.kd >= 2 || (diff > 30 && rs.B.sig < rs.A.sig / 4)) ? 8 : 9;
    } else ca = (rs.B.kd >= 2 || (-diff > 30 && rs.A.sig < rs.B.sig / 4)) ? 8 : 9;
    card.push([ca, cb]);
  });
  fs.lastRoundScore = [a, b];
}

function decide(fs, technical, t) {
  const tot = fs.cards.map(c => c.reduce((s, x) => [s[0] + x[0], s[1] + x[1]], [0, 0]));
  let a = 0, b = 0, e = 0;
  for (const [x, y] of tot) { if (x > y) a++; else if (y > x) b++; else e++; }
  let winner = null, detail;
  if (a === 3 || b === 3) { winner = a === 3 ? 'A' : 'B'; detail = 'unanimous'; }
  else if ((a === 2 && b === 1) || (b === 2 && a === 1)) { winner = a > b ? 'A' : 'B'; detail = 'split'; }
  else if ((a === 2 && e === 1) || (b === 2 && e === 1)) { winner = a > b ? 'A' : 'B'; detail = 'majority'; }
  else detail = (a === 1 && b === 1) ? 'split draw' : e === 3 ? 'unanimous draw' : 'majority draw';
  const statA = fs.A.st.sig + fs.A.st.td * 3 + fs.A.st.kd * 8, statB = fs.B.st.sig + fs.B.st.td * 3 + fs.B.st.kd * 8;
  const margin = Math.min(...tot.map(([x, y]) => Math.abs(x - y)));
  const close = !winner || detail !== 'unanimous' || margin <= 1;
  const contro = !winner || detail === 'split' || (winner === 'A' ? statB > statA * 1.15 : statA > statB * 1.15);
  fs.result = { winner, method: winner ? 'DEC' : 'DRAW', detail: (technical ? 'technical ' : '') + detail, round: fs.r, time: technical ? fmtT(t) : '5:00', close, contro, totals: tot };
  const w = winner ? fs[winner] : null;
  const cards = tot.map(([x, y]) => x + '-' + y).join(', ');
  if (fs.verbose) fs.log.push({ t: '', txt: w ? `We go to the judges' scorecards: ${cards}. ${w.full} wins by ${detail} decision${contro && detail !== 'unanimous' ? ' — and the crowd is not happy!' : '.'}` : `We go to the scorecards: ${cards}. This one is a ${detail}!`, cls: 'end' });
}

export function cornerAdvice(fs, k) {
  const me = fs[k], op = fs[k === 'A' ? 'B' : 'A'];
  let lead = 0; for (const c of fs.cards[0]) lead += k === 'A' ? c[0] - c[1] : c[1] - c[0];
  const tips = [];
  if (op.hp < 45) tips.push(`${op.name} is badly hurt. One more big push could end it.`);
  if (me.hp < 45) tips.push('You are taking too much damage. Tighten up or get it to the mat.');
  if (me.gas < 45) tips.push('Your gas tank is low. Pressure and finishing attempts will drain you fast.');
  if (op.a.tdd < me.a.wre - 8) tips.push(`Your takedowns are working: ${op.name}'s defense is weak.`);
  if (op.a.bjj > me.a.bjj + 12) tips.push(`Careful on the ground. ${op.name} is dangerous off the back.`);
  if (op.a.pow > me.a.chin + 10) tips.push(`${op.name} hits hard. Counter and stay off the line.`);
  const left = fs.rounds - fs.r;
  if (lead <= -2 && left <= 2) tips.push('You are probably down on the cards. You need a big round, or a finish.');
  if (lead >= 2 && left <= 2) tips.push('You are likely ahead. Play it safe and bank the rounds.');
  if (!tips.length) tips.push('Close fight. Stick to the game plan.');
  return tips.slice(0, 3);
}

// Run a full fight with AI strategies on both sides (or fixed strategy fn).
export function quickFight(fa, fb, opts) {
  const fs = createFight(fa, fb, { ...opts, verbose: opts.verbose ?? false });
  while (!fs.over) simRound(fs, opts.stratA ? opts.stratA(fs) : aiStrategy(fs, fs.A, fs.B), aiStrategy(fs, fs.B, fs.A));
  return fs;
}
export function methodLabel(res) {
  if (!res) return '';
  if (res.method === 'DEC') return 'Decision (' + res.detail + ')';
  if (res.method === 'SUB') return 'Submission (' + res.detail + ')';
  if (res.method === 'DRAW') return 'Draw (' + res.detail + ')';
  if (res.method === 'NC') return 'No contest (' + res.detail + ')';
  return res.method + ' (' + res.detail + ')';
}
