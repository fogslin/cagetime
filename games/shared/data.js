// Static game data for CageTime sim games. Everything here is fictional.
export const LEAGUE = { name: 'Stormvale Fighting League', short: 'Stormvale' };
export const TIERS = [
  { id: 0, name: 'Cinder Regional Circuit', short: 'Cinder', event: 'Cinder Circuit', basePurse: 3000, winBonus: 3000, size: 18 },
  { id: 1, name: 'Harborline Fight Series', short: 'Harborline', event: 'Harborline', basePurse: 12000, winBonus: 12000, size: 16 },
  { id: 2, name: 'Stormvale Fighting League', short: 'Stormvale', event: 'Stormvale', basePurse: 40000, winBonus: 40000, size: 26 },
];
export const DIVISIONS = [
  { id: 'FLW', name: 'Flyweight', lbs: 125, g: 'm' },
  { id: 'BW', name: 'Bantamweight', lbs: 135, g: 'm' },
  { id: 'FW', name: 'Featherweight', lbs: 145, g: 'm' },
  { id: 'LW', name: 'Lightweight', lbs: 155, g: 'm' },
  { id: 'WW', name: 'Welterweight', lbs: 170, g: 'm' },
  { id: 'MW', name: 'Middleweight', lbs: 185, g: 'm' },
  { id: 'LHW', name: 'Light Heavyweight', lbs: 205, g: 'm' },
  { id: 'HW', name: 'Heavyweight', lbs: 265, g: 'm' },
  { id: 'WSW', name: "Women's Strawweight", lbs: 115, g: 'f' },
  { id: 'WFLW', name: "Women's Flyweight", lbs: 125, g: 'f' },
  { id: 'WBW', name: "Women's Bantamweight", lbs: 135, g: 'f' },
];
// neighbours for moving up/down (same gender only)
export function adjacentDivs(divId) {
  const d = DIVISIONS.find(x => x.id === divId);
  const same = DIVISIONS.filter(x => x.g === d.g);
  const i = same.indexOf(d);
  return { down: same[i - 1] ? same[i - 1].id : null, up: same[i + 1] ? same[i + 1].id : null };
}
export const ATTRS = [
  ['str', 'Striking', 'Accuracy and technique on the feet'],
  ['pow', 'Power', 'How much damage each clean shot does'],
  ['spd', 'Speed', 'Hand and foot speed; helps land first and slip shots'],
  ['chin', 'Chin', 'Ability to absorb shots without being dropped'],
  ['cardio', 'Cardio', 'Gas tank; low cardio fades in later rounds'],
  ['wre', 'Wrestling', 'Takedowns and top control'],
  ['tdd', 'TD Defense', 'Stuffing takedowns and getting back up'],
  ['bjj', 'Submissions', 'Jiu-jitsu offense: chokes, locks, sweeps'],
  ['subd', 'Sub Defense', 'Escaping and defending submissions'],
  ['iq', 'Fight IQ', 'Shot selection, defense, adjusting between rounds'],
];
export const ATTR_KEYS = ATTRS.map(a => a[0]);
export const STYLES = {
  wrestler: { name: 'Wrestler', tip: 'Elite takedowns and top control. Weaker on the feet early.', b: { wre: 16, tdd: 10, cardio: 6, str: -6, pow: -2 } },
  boxer: { name: 'Boxer', tip: 'Sharp hands and head movement. Vulnerable to takedowns.', b: { str: 12, spd: 6, pow: 5, iq: 2, wre: -8, bjj: -6 } },
  kickboxer: { name: 'Kickboxer', tip: 'Long-range kicks and combos. Average ground game.', b: { str: 11, pow: 5, spd: 4, bjj: -6, wre: -6 } },
  muaythai: { name: 'Muay Thai', tip: 'Elbows, knees and a tough chin. Punishing in the clinch.', b: { str: 8, pow: 8, chin: 5, wre: -6, bjj: -5 } },
  bjj: { name: 'BJJ', tip: 'Submission threat from anywhere. Needs to get it to the mat.', b: { bjj: 18, subd: 10, str: -8, pow: -3 } },
  sambo: { name: 'Sambo', tip: 'Throws, top pressure and leg locks. A grinding style.', b: { wre: 9, bjj: 8, tdd: 5, cardio: 3, str: -5, spd: -3 } },
  judo: { name: 'Judo', tip: 'Trips and throws from the clinch, great balance.', b: { tdd: 10, wre: 7, bjj: 4, str: -4, spd: -2 } },
  karate: { name: 'Karate', tip: 'In-and-out movement and counters from distance.', b: { spd: 10, str: 7, iq: 4, wre: -6, chin: -2 } },
  brawler: { name: 'Brawler', tip: 'Big power and a bigger heart. Low fight IQ.', b: { pow: 13, chin: 8, iq: -6, str: 2, subd: -4 } },
  allround: { name: 'All-rounder', tip: 'No real weaknesses, no single elite weapon.', b: { str: 3, wre: 3, bjj: 3, tdd: 3, iq: 3, cardio: 2 } },
};
export const STYLE_KEYS = Object.keys(STYLES);
// "Inspired by" archetypes: describe a style of fighter, never a real person.
export const ARCHETYPES = [
  { id: 'chain', name: 'Relentless chain-wrestler', style: 'wrestler', b: { wre: 6, cardio: 6 } },
  { id: 'elusive', name: 'Elusive counter-striker', style: 'karate', b: { spd: 6, iq: 6 } },
  { id: 'iron', name: 'Pressure boxer with an iron chin', style: 'boxer', b: { chin: 8, cardio: 4 } },
  { id: 'legkick', name: 'Leg-kick specialist', style: 'kickboxer', b: { str: 6, iq: 4 } },
  { id: 'guard', name: 'Submission wizard off the back', style: 'bjj', b: { bjj: 8, subd: 4 } },
  { id: 'onepunch', name: 'One-punch knockout artist', style: 'brawler', b: { pow: 8, spd: 4 } },
  { id: 'volume', name: 'Volume striker with endless cardio', style: 'kickboxer', b: { cardio: 8, str: 4 } },
  { id: 'grinder', name: 'Patient sambo grinder', style: 'sambo', b: { wre: 5, tdd: 5 } },
  { id: 'clinch', name: 'Clinch-heavy Muay Thai veteran', style: 'muaythai', b: { pow: 4, chin: 4, iq: 4 } },
  { id: 'thrower', name: 'Olympic-level judoka', style: 'judo', b: { tdd: 6, wre: 4 } },
];
export const STRATEGIES = {
  pressure: { name: 'Pressure', tip: 'Walk them down. More output and damage, burns more gas, eats a few more counters.', out: 1.25, def: 0.92, td: 0.9, gas: 1.25, fin: 1.05 },
  counter: { name: 'Counter', tip: 'Make them miss and make them pay. Fewer strikes, better accuracy and defense.', out: 0.8, def: 1.15, td: 0.7, gas: 0.85, fin: 1.0, cnt: 1.3 },
  wrestle: { name: 'Wrestle', tip: 'Shoot for takedowns and grind on top. Strong vs strikers, risky vs elite BJJ.', out: 0.75, def: 1.0, td: 2.3, gas: 1.15, fin: 1.0 },
  finish: { name: 'Go for the finish', tip: 'Swing for the fences and hunt subs. Big finish chance both ways.', out: 1.35, def: 0.8, td: 1.0, gas: 1.45, fin: 1.6 },
  safe: { name: 'Play it safe', tip: 'Jab, move, defend takedowns, bank the round. Low risk, low reward.', out: 0.85, def: 1.25, td: 0.5, gas: 0.75, fin: 0.7, tdd: 1.25 },
};
export const STRAT_KEYS = Object.keys(STRATEGIES);
// Nationalities, weighted roughly like the real-world roster distribution in fighters.json
// (aggregate counts only; names are generated, never taken from real people).
export const COUNTRIES = [
  ['US', 'United States', 'anglo', 120], ['BR', 'Brazil', 'luso', 60], ['PL', 'Poland', 'wslav', 30], ['RU', 'Russia', 'eslav', 22],
  ['DE', 'Germany', 'german', 16], ['JP', 'Japan', 'jp', 16], ['GB', 'United Kingdom', 'anglo', 20], ['FR', 'France', 'french', 16],
  ['CZ', 'Czechia', 'wslav', 12], ['CA', 'Canada', 'anglo', 12], ['IT', 'Italy', 'italian', 10], ['AU', 'Australia', 'anglo', 10],
  ['IE', 'Ireland', 'anglo', 7], ['SK', 'Slovakia', 'wslav', 5], ['MX', 'Mexico', 'hisp', 10], ['TH', 'Thailand', 'thai', 6],
  ['CN', 'China', 'cn', 6], ['GE', 'Georgia', 'cauc', 5], ['TR', 'Turkey', 'turk', 4], ['BE', 'Belgium', 'french', 3],
  ['MD', 'Moldova', 'eslav', 3], ['AL', 'Albania', 'balkan', 3], ['KZ', 'Kazakhstan', 'casia', 4], ['ES', 'Spain', 'hisp', 4],
  ['AZ', 'Azerbaijan', 'cauc', 3], ['NZ', 'New Zealand', 'anglo', 4], ['UA', 'Ukraine', 'eslav', 4], ['AT', 'Austria', 'german', 3],
  ['KR', 'South Korea', 'kr', 4], ['PE', 'Peru', 'hisp', 3], ['UZ', 'Uzbekistan', 'casia', 3], ['RS', 'Serbia', 'balkan', 3],
  ['AR', 'Argentina', 'hisp', 3], ['PT', 'Portugal', 'luso', 2], ['HR', 'Croatia', 'balkan', 3], ['KG', 'Kyrgyzstan', 'casia', 2],
  ['NG', 'Nigeria', 'ng', 4], ['SE', 'Sweden', 'nordic', 3], ['NO', 'Norway', 'nordic', 2], ['NL', 'Netherlands', 'german', 3],
  ['PH', 'Philippines', 'hisp', 2], ['ZA', 'South Africa', 'anglo', 2], ['CM', 'Cameroon', 'french', 2], ['IR', 'Iran', 'turk', 2],
].map(([cc, name, region, w]) => ({ cc, name, region, w }));
export function flag(cc) {
  if (!cc || cc.length !== 2) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
export const GYMS = [
  { id: 'garage', name: 'Garage Boxing Co.', q: 1, cost: 0, focus: 'str', tip: 'Free. Good boxing coach, not much else.', inj: 0.9 },
  { id: 'ironbark', name: 'Ironbark Wrestling Club', q: 2, cost: 2500, focus: 'wre', tip: 'College-style grind. Wrestling and cardio gains.', inj: 1.1 },
  { id: 'copperline', name: 'Copperline Jiu-Jitsu', q: 2, cost: 2500, focus: 'bjj', tip: 'Submission-heavy. Great for grapplers.', inj: 0.95 },
  { id: 'seventhgate', name: 'Seventh Gate Muay Thai', q: 3, cost: 6000, focus: 'pow', tip: 'Hard sparring, big power gains, higher injury risk.', inj: 1.3 },
  { id: 'redpines', name: 'Red Pines Sambo Academy', q: 3, cost: 6000, focus: 'tdd', tip: 'Mountain camp: wrestling, sambo, brutal conditioning.', inj: 1.15 },
  { id: 'northfield', name: 'Northfield Combat Lab', q: 4, cost: 15000, focus: 'iq', tip: 'Elite all-round camp with sports science. Expensive.', inj: 0.8 },
  { id: 'summit', name: 'Summit Performance Institute', q: 5, cost: 35000, focus: 'cardio', tip: 'World-class everything. Lowest injury risk. Champions only.', inj: 0.7 },
];
export const CAMP_FOCUS = {
  striking: { name: 'Striking', attrs: ['str', 'spd'], tip: 'Sharpen technique and hand speed.' },
  power: { name: 'Power & S&C', attrs: ['pow', 'chin'], tip: 'Strength work; more pop, a sturdier frame.' },
  wrestling: { name: 'Wrestling', attrs: ['wre', 'tdd'], tip: 'Shots, scrambles and getting back up.' },
  grappling: { name: 'Grappling', attrs: ['bjj', 'subd'], tip: 'Rolls, chokes and escapes.' },
  cardio: { name: 'Conditioning', attrs: ['cardio'], tip: 'Build a five-round gas tank.' },
  gameplan: { name: 'Opponent study', attrs: ['iq'], tip: 'Film study. Fight IQ plus a game-plan edge for this fight.' },
};
export const SPONSORS = [
  'Voltcan Energy', 'Grizzly Grip Tape', 'Mako Mouthguards', 'Kindle & Oak Barbers', 'Bluefin Hydration', 'Tundra Apparel',
  'Lockstep Fight Shorts', 'Halcyon Meal Prep', 'Crestline Auto', 'Ninefold Supplements', 'Quarry Gym Gear', 'Sablewave Headphones',
];
export const CITIES = ['Las Vegas', 'Sao Paulo', 'Warsaw', 'Abu Dhabi', 'London', 'Paris', 'Tokyo', 'Toronto', 'Sydney', 'Mexico City', 'Prague', 'Dublin',
  'Chicago', 'Newark', 'Houston', 'Manchester', 'Berlin', 'Milan', 'Perth', 'Lisbon', 'Seoul', 'Tbilisi', 'Almaty', 'Rio de Janeiro', 'Denver', 'Nashville'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const START_YEAR = 2027;
export function weekLabel(wk) {
  const y = START_YEAR + Math.floor(wk / 52);
  const m = Math.min(11, Math.floor((wk % 52) / 4.34));
  return MONTHS[m] + ' ' + y;
}
export const FOOTER_NOTE = 'Unofficial fan game. Fictional fighters and promotions. Not affiliated with or endorsed by the UFC or any promotion.';
