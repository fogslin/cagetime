const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
const guess={US:/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage)/,CA:/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal|Regina)/,UK:/^Europe\/London/,IE:/^Europe\/Dublin/,AU:/^Australia\//,IN:/^Asia\/(Kolkata|Calcutta)/,DE:/^Europe\/Berlin/,BR:/^America\/(Sao_Paulo|Fortaleza|Recife|Manaus|Bahia)/};
// AFFILIATE PLACEHOLDERS — replace href with real tracked links once approved. No real IDs here.
const AFF={"Paramount+":"#aff-paramount-PLACEHOLDER","DAZN":"#aff-dazn-PLACEHOLDER","UFC Fight Pass":"#aff-fightpass-PLACEHOLDER","Prime Video":"#aff-prime-PLACEHOLDER"};
const $=s=>document.querySelector(s);
fetch('events.json').then(r=>r.json()).then(d=>{
  const cs=$('#country'),ps=$('#promo');
  let def=localStorage.ct||Object.keys(guess).find(k=>guess[k].test(tz))||'US';
  for(const[k,v] of Object.entries(d.countries))cs.add(new Option(v,k,false,k===def));
  [...new Set(d.events.map(e=>e.promotion))].forEach(p=>ps.add(new Option(p,p)));
  $('#tz').textContent='Times shown in your time zone: '+tz;$('#upd').textContent=d.updated;
  const render=()=>{localStorage.ct=cs.value;const c=cs.value;let html='',last='';
    const fd=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}),ft=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'});
    d.events.filter(e=>!ps.value||e.promotion===ps.value).forEach(e=>{
      const dt=e.startUTC?new Date(e.startUTC):null;
      if(dt&&dt<Date.now()-6*3600e3)return;
      const day=dt?fd.format(dt):fd.format(new Date(e.date+'T12:00:00'))+' (venue date)';
      if(day!==last){html+=`<div class="day">${day}</div>`;last=day}
      const b=e.broadcasters[c]||'TBA',aff=Object.keys(AFF).find(k=>b.includes(k));
      html+=`<article class="card"><span class="tag">${e.promotion}</span><h3>${e.name}</h3>
      <div class="time">${dt?ft.format(dt):'<span class="tba">Start time TBA</span>'}</div>
      <div class="meta">${e.venue}</div>
      <div class="watch">Watch in ${d.countries[c]}: ${b==='TBA'?'<span class="tba">TBA</span>':'<b>'+b+'</b>'}</div>
      ${aff?`<a class="aff" href="${AFF[aff]}" rel="sponsored nofollow">Get ${aff} → [affiliate slot]</a>`:''}
      ${e.notes?`<div class="meta">${e.notes}</div>`:''}
      <div class="meta">Sources: ${e.sources.map((s,i)=>`<a href="${s}" target="_blank" rel="noopener">[${i+1}]</a>`).join(' ')}</div></article>`});
    $('#list').innerHTML=html||'<p>No upcoming events.</p>'};
  cs.onchange=ps.onchange=render;render();});
