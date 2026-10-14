(() => {
'use strict';
const API='https://rps-server.heyboernathan.workers.dev';
const $=id=>document.getElementById(id);
const STORE='rpsCompetitiveLab.v1';
const MOVES=['rock','paper','scissors'];
const ICON={rock:'✊',paper:'✋',scissors:'✌️'};
const BEATS={rock:'scissors',paper:'rock',scissors:'paper'};
const token=()=>{try{return localStorage.getItem('token')}catch{return null}};
let tier='free', state={rounds:[],sessions:[],daily:{day:'',goal:'wins',wins:0,streak:0,used:[]}}, series={you:0,ai:0,rounds:0,done:false};
const dayKey=()=>new Date().toLocaleDateString('en-CA');
function load(){try{const x=JSON.parse(localStorage.getItem(STORE)||'{}');state={...state,...x};if(!Array.isArray(state.rounds))state.rounds=[];if(!Array.isArray(state.sessions))state.sessions=[];if(!state.daily||state.daily.day!==dayKey())state.daily={day:dayKey(),goal:'wins',wins:0,streak:0,used:[]}}catch{}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch{}}
function safeText(el,value){if(el)el.textContent=String(value)}
function outcome(a,b){return a===b?'tie':BEATS[a]===b?'win':'loss'}
function randomMove(){return MOVES[Math.floor(Math.random()*MOVES.length)]}
function tierLabel(t){return t==='family'?'Ultra Plus':t==='duo'?'Ultra':t==='individual'?'Premium':'Free'}
function levelFor(t){return t==='family'?2:t==='duo'?1:0}
async function checkTier(){
 const pill=$('tier-pill'); const t=token();
 if(!t){tier='free';safeText(pill,'Free account · practice preview');applyLocks();return}
 try{
  const res=await fetch(API+'/account/premium',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t}),cache:'no-store'});
  const d=await res.json().catch(()=>({}));
  if(!res.ok||!d.premium){tier='free'}else{
   const p=String(d.plan||d.premiumPlan||d.groupPlan||'individual').toLowerCase();
   tier=p==='family'||p==='ultra plus'? 'family':p==='duo'||p==='ultra'?'duo':'individual';
  }
 }catch{tier='unknown'}
 safeText(pill,tier==='unknown'?'Membership check unavailable':tierLabel(tier)+' membership');
 applyLocks();
}
function applyLocks(){
 const ultra=levelFor(tier)>=1,plus=levelFor(tier)>=2;
 ['format','opponent','new-match','reset-match','export-csv','clear-history'].forEach(id=>{const el=$(id);if(el)el.disabled=!ultra});
 ['training-style','daily-goal','start-challenge','export-report','plus-reset'].forEach(id=>{const el=$(id);if(el)el.disabled=!plus});
 document.querySelectorAll('.move').forEach(b=>b.disabled=!ultra);
 $('analytics-panel').classList.toggle('locked',!ultra);$('plus-panel').classList.toggle('locked',!plus);
 safeText($('match-result'),ultra?'Start a match, then choose rock, paper, or scissors.':'Match formats and move analytics unlock with Ultra or Ultra Plus.');
 safeText($('plus-status'),plus?'Ultra Plus tools are active. Challenge progress and reports are saved locally on this device.':'Advanced training styles, daily challenge ladder, and downloadable reports unlock with Ultra Plus.');
}
function aiMove(){
 const style=$('opponent').value, previous=state.rounds.slice(-8);
 if(style==='random')return randomMove();
 if(style==='counter'&&previous.length)return BEATS[previous[previous.length-1].you]||randomMove();
 if(style==='pattern'&&previous.length>=2){const last=previous[previous.length-1].you;const prev=previous[previous.length-2].you;if(last===prev)return BEATS[last];}
 if(levelFor(tier)>=2){
  const plusStyle=$('training-style').value;
  if(plusStyle==='bluffer'&&Math.random()<.35)return MOVES[(MOVES.indexOf(previous.at(-1)?.you||'rock')+1)%3];
  if(plusStyle==='streak'&&series.you>series.ai)return BEATS[previous.at(-1)?.you||'rock'];
  if(plusStyle==='chaos'&&Math.random()<.5)return randomMove();
  if(plusStyle==='adaptive'&&previous.length>=3){const counts={rock:0,paper:0,scissors:0};previous.forEach(x=>counts[x.you]++);const common=MOVES.slice().sort((a,b)=>counts[b]-counts[a])[0];return BEATS[common]}
 }
 if(style==='counter'||style==='pattern')return randomMove();
 return randomMove();
}
function needed(){return Math.floor(Number($('format').value)/2)+1}
function renderSeries(){
 safeText($('series-you'),series.you);safeText($('series-ai'),series.ai);safeText($('series-round'),series.rounds);safeText($('series-needed'),needed());
}
function startMatch(){series={you:0,ai:0,rounds:0,done:false};renderSeries();safeText($('match-result'),'New series started. Choose your first move.');}
function play(move){
 if(!levelFor(tier)||series.done)return;
 const ai=aiMove(),result=outcome(move,ai);series.rounds++;
 if(result==='win')series.you++;else if(result==='loss')series.ai++;
 state.rounds.push({at:new Date().toISOString(),you:move,opponent:ai,result});state.rounds=state.rounds.slice(-500);
 state.daily.used=[...new Set([...state.daily.used,move])];
 if(result==='win'){state.daily.wins++;state.daily.streak++}else if(result==='loss')state.daily.streak=0;
 const target=3,goal=$('daily-goal')?.value||state.daily.goal;
 safeText($('match-result'),'You: '+ICON[move]+' '+move+' · Opponent: '+ICON[ai]+' '+ai+'\n'+(result==='tie'?'Tie round.':result==='win'?'You won the round!':'Opponent won the round.') );
 if(series.you>=needed()||series.ai>=needed()){
  series.done=true;const winner=series.you>series.ai?'Victory':'Defeat';
  state.sessions.unshift({at:new Date().toISOString(),format:'Best of '+$('format').value,score:series.you+'–'+series.ai,winner,rounds:series.rounds,opponent:$('opponent').selectedOptions[0].textContent});
  state.sessions=state.sessions.slice(0,60);
  safeText($('match-result'),winner+' — final score '+series.you+'–'+series.ai+'. Start a new match to play again.');
 }
 state.daily.goal=goal;save();renderSeries();renderAll();
}
function renderAll(){
 const rounds=state.rounds, wins=rounds.filter(r=>r.result==='win').length, losses=rounds.filter(r=>r.result==='loss').length;
 safeText($('stat-played'),rounds.length);safeText($('stat-winrate'),rounds.length?Math.round(wins/rounds.length*100)+'%':'—');
 let best=0,run=0;rounds.forEach(r=>{run=r.result==='win'?run+1:0;best=Math.max(best,run)});safeText($('stat-streak'),best);
 const counts={rock:0,paper:0,scissors:0};rounds.forEach(r=>counts[r.you]++);const favorite=MOVES.slice().sort((a,b)=>counts[b]-counts[a])[0];safeText($('stat-favorite'),rounds.length?ICON[favorite]+' '+favorite:'—');
 const box=$('move-analytics');box.replaceChildren();
 MOVES.forEach(m=>{const data=rounds.filter(r=>r.you===m),w=data.filter(r=>r.result==='win').length;const row=document.createElement('div');row.className='log';const left=document.createElement('span');left.textContent=ICON[m]+' '+m+' · '+data.length+' uses';const right=document.createElement('strong');right.textContent=(data.length?Math.round(w/data.length*100):0)+'% wins';row.append(left,right);box.append(row)});
 const list=$('history-list');list.replaceChildren();
 if(!state.sessions.length){const p=document.createElement('p');p.className='muted';p.textContent='Your completed series will appear here.';list.append(p)}
 state.sessions.slice(0,12).forEach(s=>{const row=document.createElement('div');row.className='log';const a=document.createElement('span');a.textContent=new Date(s.at).toLocaleString()+' · '+s.format+' · '+s.opponent;const b=document.createElement('strong');b.textContent=s.winner+' '+s.score;row.append(a,b);list.append(row)});
 const goal=$('daily-goal')?.value||state.daily.goal||'wins';const progress=goal==='wins'?Math.min(3,state.daily.wins):goal==='streak'?Math.min(3,state.daily.streak):state.daily.used.length;
 safeText($('goal-progress'),progress+' / 3');safeText($('goal-label'),goal==='wins'?'Win 3 rounds':goal==='streak'?'Get a 3-win streak':'Use all three moves');$('goal-bar').style.width=(progress/3*100)+'%';
}
function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function csv(){const rows=[['Date','Your move','Opponent move','Result'],...state.rounds.map(r=>[r.at,r.you,r.opponent,r.result])];download('rps-lab-history.csv',rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8')}
function report(){const data={generatedAt:new Date().toISOString(),scope:'Local practice only',tier:tierLabel(tier),rounds:state.rounds.length,sessions:state.sessions,moveStats:MOVES.map(m=>({move:m,uses:state.rounds.filter(r=>r.you===m).length,wins:state.rounds.filter(r=>r.you===m&&r.result==='win').length}))};download('rps-ultra-plus-practice-report.json',JSON.stringify(data,null,2),'application/json')}
load();
$('new-match').addEventListener('click',startMatch);$('reset-match').addEventListener('click',startMatch);
document.querySelectorAll('.move').forEach(b=>b.addEventListener('click',()=>play(b.dataset.move)));
$('format').addEventListener('change',renderSeries);$('daily-goal').addEventListener('change',()=>{state.daily.goal=$('daily-goal').value;save();renderAll()});
$('start-challenge').addEventListener('click',()=>{state.daily.goal=$('daily-goal').value;save();safeText($('plus-status'),'Daily challenge active. Progress updates as you play Lab rounds.');renderAll()});
$('export-csv').addEventListener('click',csv);$('export-report').addEventListener('click',report);
$('clear-history').addEventListener('click',()=>{if(confirm('Clear all Competitive Lab practice history on this device?')){state.rounds=[];state.sessions=[];save();renderAll()}});
$('plus-reset').addEventListener('click',()=>{state.daily={day:dayKey(),goal:$('daily-goal').value,wins:0,streak:0,used:[]};save();renderAll()});
renderAll();renderSeries();checkTier();
})();