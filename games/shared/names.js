// Procedural fictional names. Surnames are built from syllables so they read as
// plausible for a region without copying any real fighter.
const R = {
  anglo: { m: 'Cody Travis Brent Wyatt Colt Dalton Reese Garrett Shane Tanner Bryce Kyle Dane Jesse Logan Rory Callum Declan Owen Mason Grady Beau Heath Jace Kellan Darius Malik Tyrell Andre Marcus', f: 'Kayla Brooke Shelby Paige Tessa Raven Jordyn Kendra Leah Maddie Erin Siobhan Ashlyn Tori Dana Nia Kiara', pre: 'Hart Brack Stan Whit Kell Thorn Ash Mar Red Hollo Black Cran Dun Fair Gar Hol Pen Ross Wex Ald Brid Carr Colt Hal', suf: 'ford ley ton well ridge wick by more den sby ham worth lock son man field ker croft' },
  luso: { m: 'Thiago Caio Rafael Joao Vinicius Diego Matheus Gilberto Renan Wellington Jailton Edmilson Rodrigo Leandro Anderson Francisco Gabriel Iuri Davi Ronaldo', f: 'Larissa Bianca Jessica Thais Amanda Priscila Karine Luana Rayanne Mayra Talita', pre: 'Bar Cor Fer Mor Ar Pi Ma Ca Va Tei Ri Sou Bra Gou Lou Mal Fon Que Cam Ser', suf: 'reira valho anda ruda ntes raes ssis bosa queira leiro ntos rado tinho xeira sario' },
  wslav: { m: 'Jakub Tomasz Michal Lukasz Kamil Pawel Marcin Bartosz Wojciech Ondrej Radek Patrik Filip Matej Damian Szymon Adrian Mateusz Krystian', f: 'Karolina Agnieszka Klaudia Martyna Tereza Barbora Natalia Zuzana Weronika', pre: 'Kow Nowa Wis Zaj Krol Rad Sob Jabl Pior Grab Dud Mich Kub Pel Sto Brz Wal Dvor Hor Mar', suf: 'alski icki niak czyk owski arek ewicz ecki ak acek ik ina an' },
  eslav: { m: 'Artem Dmitri Nikita Ruslan Yaroslav Kirill Maksim Bogdan Oleg Vadim Stanislav Timur Denis Gleb Anton Roman Igor Sergei', f: 'Daria Anastasia Yulia Ksenia Valeria Alina Irina Polina Viktoria', pre: 'Vol Kras Mor Sok Dub Pav Zhur Lag Kuz Tik Bel Gor Pron Sav Ryab Zay Shev Tkach Fil Bar', suf: 'kov enko chuk ov in ev ich nev anov arenko ishin uk ets' },
  german: { m: 'Lukas Niklas Jonas Florian Dominik Tobias Kevin Marvin Pascal Fabian Sven Jannik Timo Stefan Daan Ruben', f: 'Lena Jana Miriam Sophie Lara Anke Femke Svenja', pre: 'Hof Wein Kraus Brenn Stein Lind Ack Holz Mar Eisen Falk Roth Wald Berg Kessel Schaf', suf: 'mann berger ner hardt meier bach feld ler hoven stra er dorf' },
  jp: { m: 'Takumi Ren Haruto Kaito Shota Daiki Ryo Yuki Kenta Sora Hiroki Tsubasa Kazuki Shun', f: 'Yui Aoi Rina Mio Saki Haruka Ayaka Nanami', pre: 'Taka Naka Yama Ishi Mori Ka Fuji Haya Kuro Mae Shira Tsu Oka Hira Kita Mizu', suf: 'hashi mura moto da gawa saki zawa no shima yama kubo ta ki' },
  french: { m: 'Mathis Theo Bastien Yanis Quentin Florent Nathan Kylian Romain Axel Loic Moussa Sofiane Cedric', f: 'Manon Chloe Ines Oceane Lea Margaux Elodie', pre: 'Du Mar Ber Lam Fon Gar Leb Mor Rou Cha Gir Del Bel Vau Ro', suf: 'ville tier rand ard bert ois enne eau quet oux ier at elle' },
  italian: { m: 'Lorenzo Matteo Davide Simone Alessio Federico Nicolo Riccardo Andrea Giacomo Marco', f: 'Giulia Chiara Martina Alessia Sara Federica', pre: 'Ross Bian Fer Esp Gal Rom Mar Con Viv Pell Sant Cast Lom Rin', suf: 'elli ini etti ardi ucci ano oni azzo esi ato ieri' },
  hisp: { m: 'Alejandro Diego Mateo Santiago Emiliano Javier Rodrigo Brandon Erick Ulises Gael Ivan Adrian Joel', f: 'Valeria Ximena Camila Daniela Paola Lucia Fernanda', pre: 'Var Mend Sal Car Mor Esp Fuen Agu Cerv Oroz Vill Gal Pad Ruiz Cas Bel', suf: 'gas oza azar ranza ales ino tes ilar antes co ela ega ado illo' },
  thai: { m: 'Somchai Kittisak Anan Thanawat Prasert Nattapong Chaiya Wichai Sakda', f: 'Pimchanok Siriporn Kanya Ratana Malee', pre: 'Sor Kiat Petch Sing Por Chai Saen Lom Rat Wong', suf: 'sakul phet chai wiset pong rak siri thong kul' },
  cn: { m: 'Weiran Junhao Haoyu Leiming Taoran Yongjie Bowen Kaixin Pengfei Zhenyu Zihan Yuxuan', f: 'Meiling Linxi Yanqiu Xueer Jingyi Fangfei', ln: 'Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma Zhu Hu Guo Lin He Gao Luo' },
  kr: { m: 'Min-jun Ji-hoon Seung-woo Dong-hyun Tae-yang Jae-won Hyun-woo Sung-min Do-yun', f: 'Seo-yeon Ji-woo Ha-eun Min-ji Yu-na', ln: 'Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon' },
  cauc: { m: 'Giorgi Levan Nika Davit Rashad Elnur Tural Zviad Beka Shamil Ramazan Magomed', f: 'Nino Salome Aysel Mariam', pre: 'Bera Tsik Kva Gel Mamed Abas Hasan Gogo Lom Tsat Dzh Khal', suf: 'shvili dze ia ov li adze aev ov' },
  turk: { m: 'Emre Burak Kerem Mert Ozan Baran Arda Kaan Reza Arash Dariush', f: 'Elif Zeynep Defne Sanaz', pre: 'Yil Kar Ak Demir Oz Tas Kaya Cel Gul Moh Teh Raz', suf: 'maz ci han kan dag gul en ik ayi ani' },
  balkan: { m: 'Luka Marko Nikola Stefan Ardit Besnik Ilir Dario Ivan Filip', f: 'Ana Jelena Elira Mia', pre: 'Pet Jov Mil Kraj Hox Gash Bab Kov Stoj Tom', suf: 'rovic anovic ic ha aj ani evic ovski' },
  casia: { m: 'Nurlan Askar Bekzat Daulet Sanjar Jasur Aibek Timur Rustam Ulan', f: 'Aigerim Madina Dilnoza Asel', pre: 'Seit Nur Tok Abd Kar Bek Ism Sultan Zhum Erk', suf: 'bekov aliev ov ullaev imov aev ayev' },
  ng: { m: 'Chidi Emeka Tunde Obinna Kelechi Segun Ifeanyi Uche', f: 'Ngozi Adaeze Funmi Chioma', pre: 'Okon Ad Nwa Oye Ade Obi Eze Olu', suf: 'kwo eyemi chukwu dele wale ora nna bode' },
  nordic: { m: 'Elias Oskar Viktor Leo Mathias Sander Henrik Jonas Emil', f: 'Ingrid Saga Freja Maja', pre: 'Lind Berg Holm Strand Dahl Sand Eng Lund Fjell Nord', suf: 'qvist gren berg strom heim vik sen ner' },
};
const split = (s) => s.split(' ');
const P = {};
for (const k in R) P[k] = { m: split(R[k].m), f: split(R[k].f), pre: R[k].pre ? split(R[k].pre) : null, suf: R[k].suf ? split(R[k].suf) : null, ln: R[k].ln ? split(R[k].ln) : null };
const NICKS = ['The Hammer', 'Silent Storm', 'Wolfpack', 'The Surgeon', 'Mad Dog', 'Bonecrusher', 'The Comet', 'Lights Out', 'Smooth', 'The Viper',
  'Mountain', 'Little Tank', 'The Professor', 'Pitbull', 'Dynamite', 'The Saint', 'Raptor', 'Iceman', 'Sledge', 'The Ghost', 'Thunder', 'Cobra',
  'Night Train', 'The Anvil', 'Hurricane', 'Golden Boy', 'Scrapper', 'The Python', 'Jackal', 'Red Fox', 'Bulldozer', 'Tsunami', 'The Monk',
  'Wildfire', 'Razor', 'Slick', 'Gravedigger', 'The Arrow', 'Black Ice', 'Showtime', 'Atlas', 'Lumberjack', 'Hitman', 'The Hornet', 'Diesel',
  'Quicksilver', 'Mongoose', 'The Butcher', 'Spider Monkey', 'Avalanche', 'Lynx', 'The Chemist', 'Stone Cold', 'Rocket', 'Bad Moon'];
function surname(rng, p) {
  if (p.ln) return rng.pick(p.ln);
  const a = rng.pick(p.pre), b = rng.pick(p.suf);
  let s = a + b;
  s = s.replace(/(.)\1\1/g, '$1$1');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
export function genName(rng, region, gender = 'm', used) {
  const p = P[region] || P.anglo;
  for (let i = 0; i < 20; i++) {
    const first = rng.pick(gender === 'f' ? p.f : p.m);
    let last = surname(rng, p);
    const full = first + ' ' + last;
    if (!used || !used.has(full)) { if (used) used.add(full); return { first, last }; }
  }
  return { first: rng.pick(p.m), last: surname(rng, p) + 'a' };
}
export function genNick(rng) { return rng.chance(0.55) ? rng.pick(NICKS) : ''; }
