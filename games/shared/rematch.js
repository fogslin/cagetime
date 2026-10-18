// Anti-repetition rules. Every booking in both games goes through canBook().
// - max 3 meetings per pair, ever
// - never a rematch with someone who has beaten the other twice
// - a 3rd fight only if the series is 1-1 or contains a draw / no contest
// - a 2nd fight needs a narrative reason: immediate rematch after a close or
//   controversial result, a title rematch after a loss, unfinished business
//   (draw / NC), or a big-money grudge match.
export const MAX_MEETINGS = 3;
export const REASONS = {
  immediate: { label: 'Immediate rematch', tip: 'The first fight ended in a close or controversial decision, so both camps want it run back.' },
  title: { label: 'Title rematch', tip: 'The loser of their last meeting has earned another shot with the belt on the line.' },
  trilogy: { label: 'Trilogy decider', tip: 'The series is tied 1-1. This settles it.' },
  unfinished: { label: 'Unfinished business', tip: 'Their last meeting ended in a draw or no contest.' },
  grudge: { label: 'Grudge match', tip: 'Real bad blood and big money. The fans demanded this one.' },
};
export const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
export function series(h2h, a, b) {
  const list = h2h[pairKey(a, b)] || [];
  let aw = 0, bw = 0, dn = 0;
  for (const m of list) { if (m.w === a) aw++; else if (m.w === b) bw++; else dn++; }
  return { list, n: list.length, aw, bw, dn, last: list[list.length - 1] || null };
}
// ctx: { title, champ, heat, sinceA, sinceB, wk, rankA, rankB }
// sinceX = number of fights X has had since the pair's last meeting
export function canBook(h2h, a, b, ctx = {}) {
  if (a === b) return { ok: false, why: 'same fighter' };
  const s = series(h2h, a, b);
  if (s.n === 0) return { ok: true, reason: null };
  if (s.n >= MAX_MEETINGS) return { ok: false, why: 'They have already fought three times.' };
  if (s.aw >= 2 || s.bw >= 2) return { ok: false, why: 'One of them has already beaten the other twice.' };
  if (s.n === 2) {
    // after the 2-wins check, a 2-fight series is 1-1 or contains a draw/NC
    if (s.aw === 1 && s.bw === 1) return { ok: true, reason: 'trilogy' };
    return { ok: true, reason: 'unfinished' };
  }
  const last = s.last;
  if (!last.w) return { ok: true, reason: 'unfinished' };
  const loser = last.w === a ? b : a;
  const loserSince = loser === a ? (ctx.sinceA ?? 0) : (ctx.sinceB ?? 0);
  const winnerSince = loser === a ? (ctx.sinceB ?? 0) : (ctx.sinceA ?? 0);
  if ((last.close || last.contro) && loserSince <= 1 && winnerSince <= 1 && (ctx.wk == null || ctx.wk - last.wk <= 80)) return { ok: true, reason: 'immediate' };
  if (ctx.title && ctx.champ === last.w && (last.title || (ctx.challengerRank != null && ctx.challengerRank <= 3))) return { ok: true, reason: 'title' };
  if ((ctx.heat || 0) >= 60 && (ctx.money || 0) >= 1) return { ok: true, reason: 'grudge' };
  return { ok: false, why: 'No narrative reason for a rematch yet.' };
}
// Independent checker used by the tests: given the history BEFORE a fight and the
// recorded reason + context, is this rematch legitimate?
export function validateBooking(prev, a, b, rec) {
  const list = prev || [];
  const aw = list.filter(m => m.w === a).length, bw = list.filter(m => m.w === b).length, dn = list.length - aw - bw;
  if (list.length === 0) return rec.reason == null ? null : 'first fight should not carry a rematch reason';
  if (list.length >= 3) return 'fourth meeting';
  if (aw >= 2 || bw >= 2) return 'rematch after beating someone twice';
  if (list.length === 2 && !(aw === 1 && bw === 1) && dn === 0) return 'third fight without 1-1 or draw/NC';
  if (!rec.reason || !REASONS[rec.reason]) return 'rematch without reason';
  const last = list[list.length - 1];
  const c = rec.ctx || {};
  switch (rec.reason) {
    case 'trilogy': return aw === 1 && bw === 1 ? null : 'trilogy reason but series not 1-1';
    case 'unfinished': return dn > 0 ? null : 'unfinished reason without draw/NC';
    case 'immediate': return list.length === 1 && (last.close || last.contro) && (c.sinceA ?? 9) <= 1 && (c.sinceB ?? 9) <= 1 ? null : 'immediate rematch without close/controversial result';
    case 'title': return list.length === 1 && c.title && c.champ === last.w ? null : 'title rematch without title context';
    case 'grudge': return list.length === 1 && (c.heat || 0) >= 60 ? null : 'grudge match without heat';
  }
  return 'unknown';
}
