// Compact save format (v2): fighters as positional arrays, compact head-to-head entries,
// then deflate + base64 when the browser supports CompressionStream (all current browsers),
// plain JSON otherwise. Old v1 saves are detected and reported, never crash the page.
import { ATTR_KEYS, COUNTRIES, DIVISIONS } from './data.js?v=20261026a';
import { WORLD_VERSION, touch } from './world.js?v=20261026a';

export const SAVE_VERSION = 2;
const F = ['id', 'first', 'last', 'nick', 'cc', 'div', 'style', 'arch', 'age', 'pot', 'tier', 'w', 'l', 'd', 'nc', 'ko', 'sub', 'kol', 'streak', 'rp', 'hype', 'pop', 'act', 'inj', 'avail', 'lw', 'rest', 'fc', 'bk', 'mgr', 'qw', 'retWk', 'fy'];
const SKIP = new Set([...F, 'attrs', 'recent', 'col', 'country', 'g']);
const R1 = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);
function packFighter(f) {
  const a = F.map(k => (f[k] === undefined ? null : R1(f[k])));
  a.push(ATTR_KEYS.map(k => R1(f.attrs[k])), f.recent.join(''), f.col);
  const x = {}; let any = false;
  for (const k in f) if (!SKIP.has(k)) { x[k] = f[k]; any = true; }
  if (any) a.push(x);
  return a;
}
const CN = Object.fromEntries(COUNTRIES.map(c => [c.cc, c.name]));
const GD = Object.fromEntries(DIVISIONS.map(d => [d.id, d.g]));
function unpackFighter(a) {
  const f = {};
  F.forEach((k, i) => { if (a[i] !== null) f[k] = a[i]; else if (k === 'bk' || k === 'mgr' || k === 'arch') f[k] = null; });
  const n = F.length;
  f.attrs = {}; ATTR_KEYS.forEach((k, i) => { f.attrs[k] = a[n][i]; });
  f.recent = a[n + 1] ? a[n + 1].split('') : [];
  f.col = a[n + 2];
  if (a[n + 3]) Object.assign(f, a[n + 3]);
  f.country = CN[f.cc] || f.cc; f.g = GD[f.div] || 'm';
  if (f.nick == null) f.nick = '';
  return f;
}
export function pack(save) {
  const w = save.world;
  const { f, h2h, ...rest } = w;
  const H = {};
  for (const k in h2h) H[k] = h2h[k].map(e => [e.wk, e.m, e.fc[0], e.fc[1], e.w || 0, (e.close ? 1 : 0) | (e.contro ? 2 : 0) | (e.title ? 4 : 0)]);
  return { ...save, v: SAVE_VERSION, world: { ...rest, F: Object.values(f).map(packFighter), H } };
}
export function unpack(p) {
  const { F: arr, H, ...rest } = p.world;
  const world = { ...rest, f: {}, h2h: {} };
  for (const a of arr) { const f = unpackFighter(a); world.f[f.id] = f; }
  for (const k in H) world.h2h[k] = H[k].map(([wk, m, a, b, w, fl]) => { const e = { wk, m, fc: [a, b] }; if (w) e.w = w; if (fl & 1) e.close = 1; if (fl & 2) e.contro = 1; if (fl & 4) e.title = 1; return e; });
  touch(world);
  return { ...p, world };
}
// ---- compression ----
const hasCS = typeof CompressionStream !== 'undefined';
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const bin = atob(s); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }
async function pipe(data, stream) { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer()); }
export async function encode(save) {
  const json = JSON.stringify(pack(save));
  if (hasCS) { try { return 'z2:' + b64(await pipe(json, new CompressionStream('deflate-raw'))); } catch { /* fall through */ } }
  return 'j2:' + json;
}
// returns { save } | { old: true, info } | { error }
export async function decode(str) {
  if (!str) return { error: 'empty' };
  try {
    if (str.startsWith('z2:')) return { save: unpack(JSON.parse(new TextDecoder().decode(await pipe(unb64(str.slice(3)), new DecompressionStream('deflate-raw'))))) };
    if (str.startsWith('j2:')) return { save: unpack(JSON.parse(str.slice(3))) };
    const o = JSON.parse(str);
    if (o && (o.v || 1) < SAVE_VERSION) return { old: true, info: o };
    return { error: 'unknown format' };
  } catch (e) { return { error: String(e && e.message || e) }; }
}
// localStorage helpers; writes are serialized per key so a slow compress never overwrites a newer save
const seq = {};
export async function writeSlot(key, save) {
  const my = seq[key] = (seq[key] || 0) + 1;
  const str = await encode(save);
  if (my !== seq[key]) return true;
  try { localStorage.setItem(key, str); return true; } catch { return false; }
}
export async function readSlot(key) {
  let s = null; try { s = localStorage.getItem(key); } catch { /* storage blocked */ }
  if (!s) return { error: 'missing' };
  return decode(s);
}
export { WORLD_VERSION };
