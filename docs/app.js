/* PurrTok v3.2 — только игра «Тыгыдык», без дополнительных экранов.
   Игровые результаты хранятся в браузере пользователя (localStorage). */
(() => {
  'use strict';

  const STORAGE_KEY = 'purrtok-v1';
  const defaultStats = { rounds: 0, best: 0, total: 0, chats: 0, sound: true };
  const stats = loadStats();
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const itemValues = { cup: 20, books: 25, plant: 30, vase: 40, lamp: 35, toy: 15 };
  let toastTimer;
  let context;
  let lastResult = null;
  const game = { status: 'idle', score: 0, multiplier: 1, streak: 0, bestStreak: 0, hits: 0, fishCaught: 0, goalReached: false, remaining: 60, lastHit: 0, endTime: 0, interval: null, pending: new Set() };

  function loadStats() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const safe = { ...defaultStats };
      for (const key of ['rounds','best','total','chats']) {
        if (Number.isSafeInteger(saved[key]) && saved[key] >= 0) safe[key] = Math.min(saved[key], 99999999);
      }
      if (typeof saved.sound === 'boolean') safe.sound = saved.sound;
      return safe;
    } catch (_) { return { ...defaultStats }; }
  }
  function saveStats() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) { /* приватный режим */ } }
  function renderStats() {
    $('#game-best').textContent = String(stats.best);
    const toggle = $('#sound-toggle');
    toggle.textContent = stats.sound ? '🔊' : '🔇';
    toggle.setAttribute('aria-label', stats.sound ? 'Выключить звуки' : 'Включить звуки');
    toggle.setAttribute('aria-pressed', String(stats.sound));
  }
  function showToast(message) {
    const toast = $('#toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function ensureAudio() {
    if (!stats.sound) return null;
    try {
      if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    } catch (_) { return null; }
  }
  function tone(freq = 300, duration = .12, type = 'sine', vol = .035, start = 0) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime + start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, freq * .72), ctx.currentTime + start + duration);
    gain.gain.setValueAtTime(.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(ctx.currentTime + start);
    oscillator.stop(ctx.currentTime + start + duration + .01);
  }
  function sound(type) {
    if (type === 'knock') { tone(520,.12,'triangle',.042); tone(270,.15,'sine',.035,.07); }
    if (type === 'start') { tone(360,.11,'sine',.035);tone(480,.13,'sine',.035,.12);tone(620,.16,'sine',.035,.25); }
    if (type === 'win') { [440,550,660,880].forEach((f,i) => tone(f,.2,'sine',.04,i*.12)); }

  }
  $('#sound-toggle').addEventListener('click', () => {
    stats.sound = !stats.sound; saveStats(); renderStats();
    if (stats.sound) sound('start');
    showToast(stats.sound ? 'Звук включён 🔊' : 'Звук выключен 🔇');
  });

  // Web Audio synthesizer. Distinct materials: glass/crystal, ceramic, paper,
  // pot/earth, golden fish, purr. No external files, network or copyrighted audio.
  function noiseHit({length=.15,cutoff=1700,volume=.09,start=0,band='highpass'}={}) {
    const ctx=ensureAudio();if(!ctx)return;
    const frames=Math.round(ctx.sampleRate*length);
    const buf=ctx.createBuffer(1,frames,ctx.sampleRate),data=buf.getChannelData(0);
    for(let i=0;i<frames;i++)data[i]=(Math.random()*2-1)*(1-i/frames);
    const src=ctx.createBufferSource();src.buffer=buf;
    const filter=ctx.createBiquadFilter();filter.type=band;filter.frequency.value=cutoff;
    const gain=ctx.createGain();const t=ctx.currentTime+start;
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+length);
    src.connect(filter).connect(gain).connect(ctx.destination);src.start(t);src.stop(t+length);
  }
  function playImpactSound(type) {
    if(!stats.sound)return;
    if(type==='cup'){
      tone(760,.23,'sine',.07);tone(1220,.16,'sine',.039,.025);tone(410,.19,'triangle',.035,.05);
      noiseHit({length:.24,cutoff:2400,volume:.1});
    } else if(type==='vase'){
      tone(1050,.34,'sine',.065);tone(1560,.24,'sine',.052,.025);tone(2420,.13,'sine',.022,.07);
      noiseHit({length:.31,cutoff:3200,volume:.12});
    } else if(type==='books'){
      tone(155,.18,'triangle',.095);tone(113,.16,'sine',.04,.02);
      noiseHit({length:.18,cutoff:1050,volume:.17,band:'lowpass'});
    } else if(type==='plant'){
      tone(195,.19,'triangle',.068);tone(490,.14,'sine',.043,.036);
      noiseHit({length:.24,cutoff:1450,volume:.14,band:'bandpass'});
    } else if(type==='lamp'){
      // Лампа: звон стекла, как у хрупкой колбы (развитие звуков v2).
      tone(880,.23,'sine',.061);tone(1380,.17,'sine',.034,.027);
      noiseHit({length:.22,cutoff:2850,volume:.11});
    } else if(type==='toy'){
      // Игрушка: мягкий удар, отличный от стекла и керамики.
      tone(225,.13,'triangle',.079);tone(160,.12,'sine',.032,.018);
      noiseHit({length:.13,cutoff:650,volume:.092,band:'lowpass'});
    } else if(type==='combo'){
      tone(700,.11,'sine',.04);tone(900,.11,'sine',.04,.09);tone(1250,.16,'sine',.045,.18);
    } else if(type==='fish'){
      [850,1040,1330,1640].forEach((v,i)=>tone(v,.2,'sine',.045,i*.075));noiseHit({length:.11,cutoff:2900,volume:.035});
    } else if(type==='fishappear'){
      tone(660,.15,'sine',.018);tone(990,.2,'sine',.023,.14);
    } else if(type==='purr'){
      // Без кошачьих звуков: только визуальная реакция.
    } else if(type==='start'){
      [350,450,590,810].forEach((v,i)=>tone(v,.13,'triangle',.04,i*.11));
    } else if(type==='finish'){
      [600,470,370].forEach((v,i)=>tone(v,.2,'triangle',.04,i*.14));
    } else if(type==='win'){
      [450,560,675,900,1120].forEach((v,i)=>tone(v,.23,'sine',.05,i*.1));
      noiseHit({length:.55,cutoff:1900,volume:.07,start:.15});
    }
  }

  // === PurrTok 2.0: arcade "Тыгыдык" ======================================
  const GOAL = 1500;
  const ROUND_SECONDS = 60;
  const COMBO_WINDOW = 2200; // ms between successful hits
  const itemPalette = {
    cup: ['#B9ECF6','#6FC6D4','#428B9B','#f1fcff'],
    books: ['#9b85e6','#f3b24b','#ec7d91','#f5eedf'],
    plant: ['#49b67b','#297d57','#d48e72','#f2bd90'],
    vase: ['#f9bdd7','#e88fbe','#ad6b9d','#fff0fa'],
    lamp: ['#fff4a3','#ff9c65','#fff','#ffe742'],
    toy: ['#ff89ac','#7ae3ff','#cc67fb','#fff9cb']
  };
  const effects = {particles: [], running: false, prev: 0, ctx: null, width: 0, height: 0};
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const room = $('#room');
  const impactLayer = $('#impact-layer');
  const fish = $('#bonus-fish');
  const blueFish = $('#bonus-fish-blue');
  const fishList = [fish, blueFish];
  const catZone = $('#cat-zone');
  const activeFish = new Map();
  const recentSlots = new Map();
  let catMessageTimer = null;
  let bannerTimer = null;

  function scheduleGame(fn, delay) {
    const timeout = setTimeout(() => {
      game.pending.delete(timeout);
      fn();
    }, delay);
    game.pending.add(timeout);
    return timeout;
  }
  function clearPendingGame() {
    for (const timeout of game.pending) clearTimeout(timeout);
    game.pending.clear();
    for (const [node,run] of activeFish) {run.finished=true;run.animation?.cancel();node.hidden=true;node.classList.remove('is-caught');}
    activeFish.clear();
    fishList.forEach(node=>{node.hidden=true;node.classList.remove('is-caught');});
  }
  function renderGameHud() {
    $('#score').textContent = game.score.toLocaleString('ru-RU');
    $('#combo').textContent = `x${game.multiplier}`;
    $('#streak-label').textContent = `${game.streak} подряд`;
    const comboLeft = game.status === 'playing' && game.streak > 0 ? Math.max(0, 1 - (performance.now() - game.lastHit) / COMBO_WINDOW) : 0;
    $('#streak-progress').style.width = `${(comboLeft * 100).toFixed(1)}%`;
    $('#time').textContent = `${String(Math.floor(game.remaining / 60)).padStart(2,'0')}:${String(game.remaining % 60).padStart(2,'0')}`;
    $('#timer-progress').style.width = `${100 * game.remaining / ROUND_SECONDS}%`;
    $('#goal-progress').style.width = `${Math.min(100, game.score / GOAL * 100)}%`;
    $('#goal-counter').textContent = `${game.score.toLocaleString('ru-RU')} / ${GOAL}`;
    $('#goal-track').setAttribute('aria-valuenow', String(Math.min(GOAL, game.score)));
    $('#goal-track').classList.toggle('is-complete', game.score >= GOAL);
    $('#mission-status').textContent = game.goalReached ? 'Миссия выполнена! Теперь бей рекорд.' : 'Заработай очки быстрыми сериями';
  }
  function makeOverlayButton(label, variant, click) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `btn ${variant === 'primary' ? 'btn-primary' : 'btn-light'}`;
    b.textContent = label; b.addEventListener('click',click);
    return b;
  }
  function setOverlay(mode) {
    const overlay = $('#game-overlay');
    if (mode === 'hide') { overlay.hidden = true; document.body.classList.remove('game-overlay-open'); return; }
    overlay.hidden = false;
    document.body.classList.add('game-overlay-open');
    const content = $('#overlay-content');
    content.replaceChildren();
    const icon = document.createElement('span'); icon.className = 'overlay-icon';
    const heading = document.createElement('h2');
    const text = document.createElement('p');
    const buttons = document.createElement('div'); buttons.className='overlay-buttons';
    if (mode === 'ready') {
      icon.textContent = '😼';
      heading.textContent = 'Готов к большому тыгыдыку?';
      text.textContent = 'Набери 1500 очков за минуту. Разбивай предметы, держи серию ударов и поймай золотую рыбку!';
      const d=document.createElement('div'); d.className='overlay-detail';
      for (const desc of ['🎯 Цель: 1500', '⚡ Комбо: x2–x4', '🐟 Бонус: +120']) {
        const span=document.createElement('span');span.textContent=desc;d.append(span);
      }
      content.append(icon, heading, text, d);
      buttons.append(makeOverlayButton('🐾 Начать шалить', 'primary', startGame));
      content.append(buttons);
      return;
    }
    const completed = game.score >= GOAL;
    icon.textContent = completed ? '🏆' : '🐾';
    heading.textContent = completed ? 'Миссия выполнена!' : 'Раунд окончен!';
    text.textContent = completed ? 'Кот Пиксель в восторге: комната не пережила твоего тыгыдыка!' : 'Немного практики — и кот Пиксель станет настоящей легендой хаоса.';
    const score = document.createElement('div');score.className='overlay-score';score.textContent=`${game.score.toLocaleString('ru-RU')} очков`;
    const details=document.createElement('div');details.className='overlay-detail';
    for (const d of [`🎯 ${Math.min(100, Math.round(game.score/GOAL*100))}% цели`, `💥 ${game.hits} ударов`, `🔥 Лучшая серия: ${game.bestStreak}`]) {
      const span=document.createElement('span');span.textContent=d;details.append(span);
    }
    const medal=document.createElement('div');medal.className='overlay-medal';medal.textContent=lastResult.title;
    content.append(icon, heading, score, text, details, medal);
    buttons.append(makeOverlayButton('↻ Ещё раунд', 'primary', startGame));
    buttons.append(makeOverlayButton('↗ Поделиться', 'light', shareResult));
    content.append(buttons);
  }

  function prepareCanvas() {
    const canvas=$('#effects-canvas');
    const rect=room.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio || 1,2);
    effects.width=rect.width;effects.height=rect.height;
    canvas.width=Math.ceil(rect.width*dpr);canvas.height=Math.ceil(rect.height*dpr);
    effects.ctx=canvas.getContext('2d');
    if(effects.ctx)effects.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function drawParticle(p,ctx) {
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);
    ctx.globalAlpha=Math.max(0,p.life/p.maxLife);
    ctx.fillStyle=p.color;
    if (p.shape==='shard') {
      ctx.beginPath();ctx.moveTo(-p.size,0);ctx.lineTo(p.size*.7,-p.size*.55);ctx.lineTo(p.size*.8,p.size);ctx.closePath();ctx.fill();
    } else if (p.shape==='spark') {
      ctx.fillRect(-p.size*.2,-p.size*1.6,p.size*.4,p.size*3.2);
      ctx.fillRect(-p.size*1.5,-p.size*.18,p.size*3,p.size*.36);
    } else {
      ctx.beginPath();ctx.arc(0,0,p.size,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function frameParticles(t) {
    if (!effects.ctx) { effects.running=false;return; }
    const dt=Math.min(.05,((t-effects.prev)||16)/1000);effects.prev=t;
    const ctx=effects.ctx;
    ctx.clearRect(0,0,effects.width,effects.height);
    for (let i=effects.particles.length-1;i>=0;i--) {
      const p=effects.particles[i];
      p.life-=dt;
      if(p.life<=0){effects.particles.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;
      p.vx*=Math.pow(.985,dt*60);p.rotation+=p.spin*dt;
      drawParticle(p,ctx);
    }
    if(effects.particles.length){requestAnimationFrame(frameParticles)}
    else{effects.running=false;ctx.clearRect(0,0,effects.width,effects.height)}
  }
  function particleBurst(x,y,colors,count=35,confetti=false) {
    if(reduceMotion)return;
    if(!effects.ctx)prepareCanvas();
    for(let i=0;i<count;i++){
      const a=(i/count)*Math.PI*2+Math.random()*.7;
      const power=(confetti?120:95)+Math.random()*(confetti?230:230);
      const lifespan=.45+Math.random()*(confetti?1.2:.65);
      effects.particles.push({x,y,vx:Math.cos(a)*power,vy:Math.sin(a)*power-(confetti?120:75),gravity:confetti?350:600,
        size:2.3+Math.random()*6,rotation:Math.random()*6,spin:(Math.random()-.5)*19,life:lifespan,maxLife:lifespan,
        color:colors[Math.floor(Math.random()*colors.length)],shape:confetti?'shard':(['shard','shard','spark','dot'][i%4])});
    }
    if(effects.particles.length>600)effects.particles.splice(0,effects.particles.length-600);
    if(!effects.running){effects.running=true;effects.prev=performance.now();requestAnimationFrame(frameParticles)}
  }
  // Four-by-four large, recognisable chunks of the actual cracked artwork.
  // Each fragment is a clip from the same picture, keeping visual continuity.
  function makeShards(x,y,w,h,src) {
    if (reduceMotion) return;
    const cols=4,rows=3;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const el=document.createElement('div');el.className='photo-shard';
      const cw=w/cols+.7, ch=h/rows+.7;
      el.style.left=`${x+c*w/cols}px`;el.style.top=`${y+r*h/rows}px`;
      el.style.width=`${cw}px`;el.style.height=`${ch}px`;
      el.style.backgroundImage=`url("${src}")`;
      el.style.backgroundSize=`${w}px ${h}px`;
      el.style.backgroundPosition=`${-c*w/cols}px ${-r*h/rows}px`;
      el.style.backgroundRepeat='no-repeat';
      const a=Math.atan2(r-1,c-1.5)+(.5-Math.random())*.5;
      const dx=Math.cos(a)*(75+Math.random()*135);
      const dy=Math.sin(a)*(90+Math.random()*105)-60;
      const rot=(Math.random()-.5)*800;
      impactLayer.appendChild(el);
      const animation=el.animate([
        {transform:'translate3d(0,0,0) rotate(0deg) scale(1)',opacity:1,filter:'brightness(1.6)'},
        {offset:.36,transform:`translate3d(${dx*.5}px,${dy*.5-35}px,0) rotate(${rot*.4}deg) scale(1.03)`,opacity:1,filter:'brightness(1.1)'},
        {offset:.78,transform:`translate3d(${dx*.83}px,${dy*.9+30}px,0) rotate(${rot*.75}deg) scale(.88)`,opacity:1},
        {transform:`translate3d(${dx}px,${dy+110}px,0) rotate(${rot}deg) scale(.6)`,opacity:0}
      ],{duration:950+Math.random()*340,easing:'cubic-bezier(.12,.6,.33,1)',fill:'forwards'});
      animation.finished.catch(()=>{}).finally(()=>el.remove());
    }
  }
  function impactCircle(x,y) {
    const wave=document.createElement('span');wave.className='impact-wave';wave.style.left=`${x}px`;wave.style.top=`${y}px`;
    impactLayer.append(wave);setTimeout(()=>wave.remove(),800);
    const cross=document.createElement('span');cross.className='impact-cross';cross.style.left=`${x}px`;cross.style.top=`${y}px`;
    cross.textContent='✦';impactLayer.append(cross);setTimeout(()=>cross.remove(),800);
  }
  function positionInRoom(element) {
    const er=element.getBoundingClientRect(),rr=room.getBoundingClientRect();
    return {x:er.left-rr.left,y:er.top-rr.top,w:er.width,h:er.height};
  }
  function popPoints(x,y,message,style='') {
    const pop=document.createElement('span');pop.className=`points-pop${style?' is-'+style:''}`;
    pop.textContent=message;pop.style.left=`${x}px`;pop.style.top=`${y}px`;
    $('#flying-points').append(pop);setTimeout(()=>pop.remove(),1100);
  }
  function slapPaw(x,y) {
    if(reduceMotion)return;
    const cat=positionInRoom(catZone);
    const paw=document.createElement('div');paw.textContent='🐾';paw.style.cssText=`position:absolute;left:0;top:0;font-size:42px;filter:drop-shadow(0 0 7px #fff);pointer-events:none;z-index:14`;
    impactLayer.append(paw);
    const sx=cat.x+cat.w*.55,sy=cat.y+cat.h*.62;
    paw.animate([{transform:`translate(${sx}px,${sy}px) scale(.3) rotate(-35deg)`,opacity:.1},
      {offset:.75,transform:`translate(${x}px,${y}px) scale(1.35) rotate(18deg)`,opacity:1},
      {transform:`translate(${x+14}px,${y-13}px) scale(.4) rotate(55deg)`,opacity:0}],{duration:390,easing:'ease-out'}).finished.catch(()=>{}).finally(()=>paw.remove());
  }
  function flashBanner(text) {
    const banner=$('#level-banner');banner.textContent=text;
    banner.classList.remove('is-showing');void banner.offsetWidth;banner.classList.add('is-showing');
    clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>banner.classList.remove('is-showing'),1100);
  }
  function shakeRoom() {
    if(reduceMotion)return;
    room.classList.remove('is-shaken');void room.offsetWidth;room.classList.add('is-shaken');
    setTimeout(()=>room.classList.remove('is-shaken'),260);
  }
  function speakCat(text,time=2200) {
    const bubble=$('#cat-speech');bubble.textContent=text;
    clearTimeout(catMessageTimer);catMessageTimer=setTimeout(()=>bubble.textContent='Мяу, ещё!',time);
  }
  function catReaction(combo,item) {
    const variants=['is-swatting','is-jumping','is-dancing','is-spinning','is-surprised'];
    // Some gestures are larger and play less frequently for a lively personality.
    const next=variants[Math.floor(Math.random()*variants.length)];
    variants.forEach(name=>catZone.classList.remove(name));
    void catZone.offsetWidth;
    catZone.classList.add(next);
    setTimeout(()=>catZone.classList.remove(next),780);
    const lines=combo>=10?['МЕГА-ТЫГЫДЫК!!!','ЛАПКИ — МОЛНИИ!']:combo>=6?['Это уже искусство!','Я великий разрушитель!']:combo>=3?['Комбо! Не тормози!','Усатое мастерство!']:['БДЫЩ!','Мяу-хаха!','Упс, снова я!','Ой… оно само!','Моя лапка — закон!'];
    speakCat(lines[Math.floor(Math.random()*lines.length)],1350);

  }
  function updateStreak(now) {
    game.streak=(now-game.lastHit<=COMBO_WINDOW)?game.streak+1:1;
    game.bestStreak=Math.max(game.bestStreak,game.streak);
    game.lastHit=now;
    const previous=game.multiplier;
    game.multiplier=game.streak>=10?4:game.streak>=6?3:game.streak>=3?2:1;
    if (game.multiplier>previous) {
      flashBanner(`КОМБО x${game.multiplier}!`);
      playImpactSound('combo');
      $('#combo').parentElement.classList.add('is-fired');
      setTimeout(()=>$('#combo').parentElement.classList.remove('is-fired'),200);
    }
  }
  function markGoal() {
    if(game.goalReached || game.score<GOAL)return;
    game.goalReached=true;
    flashBanner('МИССИЯ ВЫПОЛНЕНА!');
    room.classList.add('is-celebrating');setTimeout(()=>room.classList.remove('is-celebrating'),1400);
    particleBurst(effects.width*.5,effects.height*.26,['#fff7a6','#e39bfa','#9ceec3','#ffc0b8'],95,true);
    speakCat('Ты — ЛЕГЕНДА! 🏆',4000);
    playImpactSound('win');
  }
  // Все точки появления привязаны к опорной поверхности:
  // front = столешница на 74% высоты, back = две полки на 48.5%.
  // x измеряется по ширине комнаты; y — абсолютный уровень опоры, а не центр предмета.
  const slots=[
    {x:.085,y:.74,d:1,s:.94,surface:'desk'},
    {x:.235,y:.74,d:1,s:.94,surface:'desk'},
    {x:.765,y:.74,d:1,s:.94,surface:'desk'},
    {x:.915,y:.74,d:1,s:.94,surface:'desk'},
    {x:.145,y:.485,d:2,s:.69,surface:'shelf'},
    {x:.290,y:.485,d:2,s:.67,surface:'shelf'},
    {x:.710,y:.485,d:2,s:.67,surface:'shelf'},
    {x:.855,y:.485,d:2,s:.69,surface:'shelf'}
  ];
  function moveProp(button,initial=false) {
    const width=room.clientWidth||750;
    const height=room.clientHeight||470;
    const occupied=$$('.prop').filter(other=>other!==button && !other.disabled && !other.classList.contains('is-hit'));
    let candidates=slots.filter(slot=>!occupied.some(other=>{
      const ox=Number(other.dataset.sx),oy=Number(other.dataset.sy);
      return Number.isFinite(ox) && Math.abs(slot.x-ox)*width<Math.max(50,Math.min(73,width*.14)) && Math.abs(slot.y-oy)*height<40;
    }));
    if(!candidates.length)candidates=slots.filter(slot=>!occupied.some(other=>
      Math.abs(slot.x-Number(other.dataset.sx))*width<44 && Math.abs(slot.y-Number(other.dataset.sy))*height<35
    ));
    if(!candidates.length)candidates=slots;
    if(initial){
      const surfaceForItem={cup:'desk',books:'shelf',plant:'desk',vase:'desk',lamp:'shelf',toy:'desk'};
      const favored=candidates.filter(slot=>slot.surface===surfaceForItem[button.dataset.item]);
      if(favored.length)candidates=favored;
    }
    const previous=recentSlots.get(button);
    if(candidates.length>1)candidates=candidates.filter(slot=>slot!==previous);
    const slot=candidates[Math.floor(Math.random()*candidates.length)];
    recentSlots.set(button,slot);
    const size=Math.max(43,Math.min(width*.115,86))*slot.s;
    button.dataset.difficulty=String(slot.d);
    button.dataset.surface=slot.surface;
    button.dataset.sx=String(slot.x);button.dataset.sy=String(slot.y);
    // Левая координата = центр предмета, верхняя = поверхность (стол/полка).
    // CSS translate(-50%,-100%) ставит его основание точно на опору.
    button.style.left=`${(slot.x*100).toFixed(2)}%`;
    button.style.top=`calc(${(slot.y*100).toFixed(2)}% + 8px)`;
    button.style.right='auto';button.style.bottom='auto';
    button.style.width=`${size.toFixed(1)}px`;
    button.style.height=`${(size*1.06).toFixed(1)}px`;
    button.style.zIndex=slot.surface==='shelf'?'6':'12';
    const bonus=slot.surface==='shelf'?30:0;
    button.dataset.bonus=String(bonus);
    const tag=button.querySelector('.difficulty-tag');
    if(tag)tag.textContent=bonus?`+${bonus} 🎯`:'';
    button.setAttribute('aria-label',`${button.dataset.item}, ${itemValues[button.dataset.item]} очков${bonus?` и ${bonus} за сложность`:''}`);
    if(!initial){button.classList.remove('is-relocating');void button.offsetWidth;button.classList.add('is-relocating');}
  }
  function shuffleProps(){
    if(game.status!=='playing')return;
    const available=$$('.prop').filter(n=>!n.disabled);
    for(const button of available.sort(()=>Math.random()-.5).slice(0,2))moveProp(button);
    scheduleGame(shuffleProps,4300+Math.random()*2200);
  }
  function hitProp(button) {
    if(game.status!=='playing'||button.disabled||Date.now()>=game.endTime)return;
    button.disabled=true;
    const pos=positionInRoom(button),cx=pos.x+pos.w*.5,cy=pos.y+pos.h*.5;
    const type=button.dataset.item;
    const path=`./assets/objects/${type}`;
    const img=button.querySelector('img');
    // Explicit frame 1: cracked, 2: explosion, 3: large real image chunks.
    img.src=`${path}-cracked.svg`;
    button.classList.add('is-cracked');
    impactCircle(cx,cy);slapPaw(cx,cy);shakeRoom();
    particleBurst(cx,cy,itemPalette[type],65);
    updateStreak(performance.now());
    const value=itemValues[type]+Number(button.dataset.bonus||0);
    const gain=value*game.multiplier;
    game.score+=gain;game.hits++;
    popPoints(cx,cy-35,`+${gain} ${button.dataset.bonus>0?'🎯':'💥'}`,game.multiplier>1?'streak':'');
    catReaction(game.streak,type);
    playImpactSound(type);
    markGoal();renderGameHud();
    // Keep fractured object legible for a moment instead of hiding instantly.
    scheduleGame(()=>{
      img.src=`${path}-broken.svg`;
      makeShards(pos.x,pos.y,pos.w,pos.h,`${path}-cracked.svg`);
      button.classList.add('is-broken');
      particleBurst(cx,cy,itemPalette[type],33);
    },105);
    scheduleGame(()=>{
      button.classList.add('is-hit');
      button.classList.remove('is-cracked','is-broken');
      img.src=`${path}.svg`;
    },390);
    scheduleGame(()=>{
      moveProp(button);
      button.classList.remove('is-hit');
      button.classList.add('is-respawning');
      button.disabled=game.status!=='playing';
      scheduleGame(()=>button.classList.remove('is-respawning','is-relocating'),580);
    },1120+Math.random()*420);
  }
  function spawnFish(which) {
    if(game.status!=='playing')return;
    const node=which===0?fish:blueFish;
    if(activeFish.has(node))return;
    node.hidden=false;node.classList.remove('is-caught');
    node.classList.toggle('swim-right',which===0);
    const width=room.clientWidth,height=room.clientHeight;
    const direction=which===0?1:-1;
    const size=node.offsetWidth||80;
    const baseY=height*(.15+Math.random()*.43);
    const swing=20+Math.random()*65;
    const duration=which===0?3100+Math.random()*2400:2500+Math.random()*2600;
    const waves=11+Math.floor(Math.random()*5);
    const keyframes=[];
    for(let i=0;i<=waves;i++){
      const t=i/waves;
      const x=direction===1 ? -size+(width+2*size)*t : width+size-(width+2*size)*t;
      const wobble=Math.sin(t*Math.PI*(3+Math.random()*3)) * swing;
      const y=baseY+wobble+Math.sin(i*2.2)*10;
      keyframes.push({offset:t,transform:`translate3d(${x}px,${y}px,0) scaleX(${direction===1?'-1':'1'}) rotate(${Math.round((Math.random()-.5)*38)}deg)`});
    }
    const animation=node.animate(keyframes,{duration,easing:'linear',fill:'forwards'});
    const run={animation,finished:false};activeFish.set(node,run);
    animation.finished.catch(()=>{}).finally(()=>{
      if(run.finished)return;
      run.finished=true;activeFish.delete(node);node.hidden=true;
      if(game.status==='playing')scheduleGame(()=>spawnFish(which),which===0?2600+Math.random()*5000:3600+Math.random()*6200);
    });
    if(Math.random()>.6){speakCat(which===0?'Золотая рыбка!':'Лови синюю!',1450);playImpactSound('fishappear');}
  }
  function catchFish(node) {
    if(game.status!=='playing'||node.hidden||node.classList.contains('is-caught'))return;
    const pos=positionInRoom(node),cx=pos.x+pos.w/2,cy=pos.y+pos.h/2;
    node.classList.add('is-caught');
    const run=activeFish.get(node);
    if(run){run.finished=true;run.animation.cancel();activeFish.delete(node);}
    node.hidden=true;
    const value=node===blueFish?170:120;
    game.score+=value;game.fishCaught++;
    particleBurst(cx,cy,node===blueFish?['#97ffff','#627afa','#fff','#dca8ff']:['#fff5a2','#f6b65c','#ffd1ea'],80,true);
    impactCircle(cx,cy);popPoints(cx,cy,`+${value} 🐟`,'bonus');
    catReaction(game.streak,'fish');flashBanner(node===blueFish?'СИНЯЯ МОЛНИЯ!':'РЫБИЙ БОНУС!');
    playImpactSound('fish');markGoal();renderGameHud();
    scheduleGame(()=>spawnFish(node===blueFish?1:0),2000+Math.random()*4600);
  }
  function startGame() {
    clearInterval(game.interval);clearPendingGame();
    game.status='playing';game.score=0;game.remaining=ROUND_SECONDS;game.hits=0;
    game.streak=0;game.bestStreak=0;game.multiplier=1;game.lastHit=-10000;game.goalReached=false;game.fishCaught=0;
    game.endTime=Date.now()+ROUND_SECONDS*1000;
    effects.particles.length=0;
    if(effects.ctx)effects.ctx.clearRect(0,0,effects.width,effects.height);
    impactLayer.replaceChildren();$('#flying-points').replaceChildren();
    $$('.prop').forEach(btn=>{btn.disabled=false;btn.classList.remove('is-hit','is-respawning','is-cracked','is-broken');btn.querySelector('img').src=`./assets/objects/${btn.dataset.item}.svg`;moveProp(btn,true)});
    $('#restart-game').hidden=false;
    setOverlay('hide');prepareCanvas();renderGameHud();
    speakCat('Начинаем! БДЫЩ!',2200);playImpactSound('start');
    game.interval=setInterval(()=>{
      if(game.status!=='playing')return;
      game.remaining=Math.max(0,Math.ceil((game.endTime-Date.now())/1000));
      // Combo expires while waiting, not only on next click.
      if(game.multiplier>1&&performance.now()-game.lastHit>COMBO_WINDOW){game.streak=0;game.multiplier=1;}
      renderGameHud();
      if(game.remaining===0)endGame();
    },140);
    scheduleGame(()=>spawnFish(0),2700+Math.random()*1800);
    scheduleGame(()=>spawnFish(1),3900+Math.random()*2400);
    scheduleGame(shuffleProps,5200);
  }
  function endGame() {
    if(game.status!=='playing')return;
    game.status='ended';clearInterval(game.interval);game.interval=null;clearPendingGame();
    game.remaining=0;renderGameHud();
    stats.rounds+=1;stats.total+=game.score;stats.best=Math.max(stats.best,game.score);
    saveStats();renderStats();
    lastResult={score:game.score,title:game.score>=2500?'👑 Король тыгыдыка':game.score>=GOAL?'🏆 Легенда кошачьего хаоса':game.score>=900?'🥈 Мастер усатых шалостей':'🥉 Котик-стажёр'};
    $('#restart-game').hidden=true;
    $$('.prop').forEach(btn=>btn.disabled=true);
    speakCat(game.goalReached?'Ты это сделал! 🏆':'Мур, сыграем ещё?',3800);
    playImpactSound(game.goalReached?'win':'finish');
    setOverlay('ended');
  }
  function petCat() {
    catZone.classList.remove('is-purring');void catZone.offsetWidth;catZone.classList.add('is-purring');
    const pos=positionInRoom(catZone),cx=pos.x+pos.w*.5,cy=pos.y+pos.h*.3;
    particleBurst(cx,cy,['#ff98ad','#ffe5dd','#fff5aa'],16,true);
    popPoints(cx,cy-5,'♥ Мур-р-р');speakCat('Мрр… ещё за ушком! 💕',1900);

    setTimeout(()=>catZone.classList.remove('is-purring'),1900);
  }
  catZone.addEventListener('click',petCat);
  catZone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();petCat()}});
  fishList.forEach(node=>node.addEventListener('click',()=>catchFish(node)));
  $$('.prop').forEach(button=>button.addEventListener('click',()=>hitProp(button)));
  $('#restart-game').addEventListener('click',()=>{startGame();showToast('Новое испытание! 🐾')});
  $('#start-game').addEventListener('click',startGame);
  const canvasObserver=new ResizeObserver(()=>{if(room.clientWidth>0)prepareCanvas()});canvasObserver.observe(room);
  $$('.prop').forEach(btn=>moveProp(btn,true));
  setOverlay('ready');
  // === End arcade =========================================================

  async function shareResult() {
    if (!lastResult) return;
    const message = `🐾 Мой результат в PurrTok: ${lastResult.score} очков! ${lastResult.title}. Сможешь больше?`;
    const publicUrl = /^https?:/.test(location.protocol) ? location.href.split('#')[0] : '';
    try {
      if (navigator.share) { await navigator.share({ title: 'PurrTok — Тыгыдык', text: message, ...(publicUrl ? {url:publicUrl} : {}) });return; }
      if (navigator.clipboard && window.isSecureContext) {await navigator.clipboard.writeText([message,publicUrl].filter(Boolean).join('\n'));showToast('Результат скопирован! 📋');return;}
    } catch (error) { if (error.name === 'AbortError') return; }
    const field = document.createElement('textarea');field.value=[message,publicUrl].filter(Boolean).join('\n');
    field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
    const copied = document.execCommand('copy');field.remove();
    showToast(copied ? 'Результат скопирован! 📋' : message);
  }
  function initTelegram() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    try {tg.ready();tg.expand();tg.setHeaderColor?.('#fffdf7');
        // Показываем кнопку Назад в Telegram
      tg.BackButton.show();

      // Вешаем на нее отправку данных при клике
      tg.BackButton.onClick(function() {
          tg.sendData("Пользователь нажал назад");
          tg.close();
      });}
       
    catch (_) { /* обычный браузер, Telegram API не обязателен */ }
  }
   const tg = window.Telegram?.WebApp;
   function returnToBot() {
     if (tg) {
    tg.sendData("purrtok_return");
     }
   }
  window.addEventListener('telegram-ready',initTelegram);
  initTelegram();
  renderStats(); renderGameHud();
})();
