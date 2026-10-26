// Fighter generation, ratings, aging. All fighters are fictional.
import { STYLES, STYLE_KEYS, ARCHETYPES, ATTR_KEYS, COUNTRIES, DIVISIONS, TIERS } from './data.js?v=20261026a';
import { genName, genNick } from './names.js?v=20261026a';
import { clamp } from './rng.js?v=20261026a';

const W = { str: .14, pow: .1, spd: .1, chin: .1, cardio: .1, wre: .12, tdd: .1, bjj: .08, subd: .06, iq: .1 };
export function ovr(a) { let s = 0; for (const k in W) s += (a[k] || 0) * W[k]; return Math.round(s); }
export const TIER_BASE = [47, 57, 60, 66, 70];
const COLORS = ['#e5132b', '#f6c343', '#46d39a', '#6aa8ff', '#b06cff', '#ff8a3d', '#ff5fa2', '#3dd6d0', '#e8e8f0', '#8bd346'];

export function pickCountry(rng) { return rng.weighted(COUNTRIES, c => c.w); }

export function genFighter(rng, { div, tier = 0, age, used, quality, id }) {
  const d = DIVISIONS.find(x => x.id === div);
  const c = pickCountry(rng);
  const nm = genName(rng, c.region, d.g, used);
  // regional style tendencies make the world feel real (wrestlers from the Caucasus, Muay Thai from Thailand...)
  const lean = { cauc: ['wrestler', 'sambo'], eslav: ['sambo', 'wrestler', 'boxer'], casia: ['wrestler', 'sambo'], luso: ['bjj', 'muaythai'], thai: ['muaythai'], jp: ['judo', 'karate'], wslav: ['kickboxer', 'boxer'], hisp: ['boxer', 'brawler'], anglo: ['wrestler', 'boxer', 'allround'], ng: ['wrestler', 'kickboxer'], kr: ['allround', 'kickboxer'], german: ['kickboxer', 'allround'] }[c.region];
  const style = lean && rng.chance(0.45) ? rng.pick(lean) : rng.pick(STYLE_KEYS);
  const arch = rng.chance(0.35) ? rng.pick(ARCHETYPES.filter(a => a.style === style)) || null : null;
  const lvl = TIERS[tier].lvl;
  age = age ?? Math.round(rng.range(20, 26) + lvl * 2.5 + rng.range(0, 4));
  const base = quality ?? (TIER_BASE[tier] + rng.gauss(0, 5));
  const attrs = {};
  for (const k of ATTR_KEYS) {
    const b = (STYLES[style].b[k] || 0) + (arch && arch.b[k] || 0);
    attrs[k] = clamp(Math.round(base + b + rng.gauss(0, 6)), 20, 97);
  }
  const cur = ovr(attrs);
  const youth = clamp(29 - age, 0, 10);
  // a few hidden gems with a sky-high ceiling: scouting them is the GM's edge, and they keep the top fresh
  const gem = youth > 3 && rng.chance(0.1) ? rng.range(10, 20) : 0;
  const pot = clamp(Math.round(cur + youth * rng.range(0.6, 2.6) + gem + rng.gauss(0, 3)), cur, 96);
  // records match the level: the majors are full of proven winners, the regional scene is a mixed bag
  const exp = Math.max(0, Math.round((age - 19) * rng.range(1.2, 2.4) + lvl * 4));
  const wr = [[0.5, 0.82], [0.62, 0.86], [0.72, 0.92]][lvl];
  const w = Math.round(exp * rng.range(wr[0], wr[1])), l = Math.max(0, exp - w);
  const ko = Math.round(w * rng.range(0.2, 0.5)), sub = Math.round(w * rng.range(0.05, 0.35) * (style === 'bjj' ? 1.6 : 1));
  return {
    id, first: nm.first, last: nm.last, nick: genNick(rng), cc: c.cc, country: c.name, g: d.g,
    div, style, arch: arch ? arch.id : null, age, attrs, pot, tier,
    w, l, d: rng.chance(0.15) ? 1 : 0, nc: 0, ko: Math.min(ko, w), sub: Math.min(sub, Math.max(0, w - ko)),
    streak: 0, rp: Math.round(1000 + (cur - TIER_BASE[tier]) * 12), hype: clamp(Math.round(10 + lvl * 15 + tier * 2 + rng.range(0, 20)), 0, 100), pop: clamp(Math.round(5 + lvl * 18 + tier * 2 + rng.range(0, 15)), 0, 100),
    act: 1, inj: 0, avail: 0, lw: -99, recent: [], kol: 0, qw: 0, col: [rng.pick(COLORS), rng.pick(COLORS)],
    rest: rng.int(10, 20),
  };
}
export function fullName(f) { return f.first + ' ' + f.last; }
export function recStr(f) { return f.w + '-' + f.l + '-' + f.d + (f.nc ? ' (' + f.nc + ' NC)' : ''); }
export function initials(f) { return ((f.first || '?')[0] + (f.last || '?')[0]).toUpperCase(); }

// One year of aging. Young fighters grow toward hidden potential, veterans slow down.
export function ageOneYear(rng, f, extraGrowth = 0) {
  f.age += 1;
  const a = f.attrs;
  const cur = ovr(a);
  if (f.age <= 28) {
    const room = Math.max(0, f.pot - cur);
    const g = Math.min(room, rng.range(1.5, 4.5) + extraGrowth + (room > 12 ? 1.5 : 0));
    for (const k of ATTR_KEYS) a[k] = clamp(Math.round(a[k] + g * rng.range(0.4, 1.6)), 20, 99);
  } else if (f.age >= 32) {
    const d = (f.age - 31) * 0.8 + rng.range(0, 1.5);
    a.spd = clamp(Math.round(a.spd - d * 1.2), 20, 99);
    a.cardio = clamp(Math.round(a.cardio - d), 20, 99);
    a.chin = clamp(Math.round(a.chin - d * (1 + f.kol * 0.15)), 20, 99);
    a.pow = clamp(Math.round(a.pow - d * 0.5), 20, 99);
    a.str = clamp(Math.round(a.str - d * 0.3), 20, 99);
    a.wre = clamp(Math.round(a.wre - d * 0.4), 20, 99);
    a.iq = clamp(Math.round(a.iq + rng.range(0, 1.2)), 20, 99);
  } else {
    for (const k of ATTR_KEYS) a[k] = clamp(Math.round(a[k] + rng.range(-0.6, 0.9)), 20, 99);
  }
}
export function retireChance(f) {
  if (f.age < 31) return 0.01;
  const loss = f.recent.slice(-3).filter(r => r === 'L').length;
  return clamp(0.04 + (f.age - 31) * 0.07 + loss * 0.08 + f.kol * 0.02, 0, 0.95);
}
