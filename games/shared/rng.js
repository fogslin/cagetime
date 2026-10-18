// Seeded RNG + small helpers shared by CageTime sim games.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const rng = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.state = () => s;
  rng.setState = (v) => { s = v >>> 0; };
  rng.int = (a, b) => a + Math.floor(rng() * (b - a + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.range = (a, b) => a + rng() * (b - a);
  rng.gauss = (m = 0, sd = 1) => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  rng.weighted = (items, wfn) => {
    let tot = 0;
    for (const it of items) tot += Math.max(0, wfn(it));
    let r = rng() * tot;
    for (const it of items) { r -= Math.max(0, wfn(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  };
  rng.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };
  return rng;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round1 = (v) => Math.round(v * 10) / 10;
export const fmtMoney = (n) => {
  const neg = n < 0; n = Math.abs(Math.round(n));
  const s = n >= 1e6 ? '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M' : n >= 1e4 ? '$' + Math.round(n / 1000) + 'K' : '$' + n.toLocaleString('en-US');
  return (neg ? '-' : '') + s;
};
