'use strict';
// app.js: layout measurement, the particle name, cursor, chapters, navigation and start-up.
// Loaded as a classic script; top-level bindings are shared with the files that follow.

/* =====================================================================
   STATE / LAYOUT
   ===================================================================== */
const fctx = fx.getContext('2d');
const qs = new URLSearchParams(location.search);
// phones and tablets start the raymarched world at a lower resolution and may drop further
const coarse = matchMedia('(pointer:coarse)').matches, small = innerWidth < 760;
const lite = coarse || small;
const dprCap = () => Math.min(devicePixelRatio || 1, lite ? 1.25 : 1.5);
let W = Math.max(innerWidth, 1), H = Math.max(innerHeight, 1), DPR = dprCap();
let q = qs.has('q') ? parseFloat(qs.get('q')) : (lite ? .42 : .6);
const qMin = qs.has('q') ? q : (lite ? .24 : .3);
let started = false, startT = 0;
const secs = [...document.querySelectorAll('section.sec')];
const projIds = ['icsp','rjl','wolban','earlier'];           // scene 1..4 anchors
let anchors = [];   // document y of each scene anchor (h2 top)
let secTops = [];
const secBox = new Map();   // section -> { top, h }, so the frame loop never reads layout
let docMax = 1;
// all layout reads happen here, a few times a second at most, never inside the frame loop
function measure(){
  const sy = scrollY;
  anchors = projIds.map(id => { const el = document.getElementById(id); const h = el.querySelector('h2'); return (h||el).getBoundingClientRect().top + sy; });
  secTops = secs.map(s => { const h = s.querySelector('h2'); return { top: (h||s).getBoundingClientRect().top + sy, el: s }; });
  secs.forEach(s => { const r = s.getBoundingClientRect(); secBox.set(s, { top: r.top + sy, h: r.height }); });
  docMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
}
function resize(){
  W = innerWidth; H = innerHeight; DPR = dprCap();
  if (W < 2 || H < 2) return;   // hidden or prerendered tab: wait for a real size
  // the post pass is grain, bloom and aberration over a low-res scene, so it runs at 1x and the browser upscales
  if (hasGL) { canvas.width = W; canvas.height = H; makeRT(Math.max(2, Math.round(W*q)), Math.max(2, Math.round(H*q))); }
  fx.width = Math.round(W*DPR); fx.height = Math.round(H*DPR);
  buildParticles(); measure();
  if (T3.ok) T3.resize();
}

/* =====================================================================
   PARTICLE NAME
   ===================================================================== */
let parts = [];
function buildParticles(){
  if (!hasGL || W < 2 || H < 2) { parts = []; return; }
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const c = off.getContext('2d', { willReadFrequently:true });
  const lines = ['TOFARATI','FARINU'];
  const family = '800 100px "Syne","Helvetica Neue",Arial,sans-serif';
  c.font = family;
  const widest = Math.max(...lines.map(l => c.measureText(l).width));
  const portrait = W/H < .85;
  const fs = Math.min(100*(W*.86)/widest, H*(portrait?.17:.26));
  c.font = family.replace('100px', fs + 'px');
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
  const lh = fs*.9, y0 = H*.44 - (lines.length-1)*lh/2;
  lines.forEach((l,i) => c.fillText(l, W/2, y0 + i*lh));
  const img = c.getImageData(0,0,W,H).data;
  let n2 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (img[(y*W + x)*4 + 3] > 128) n2++;
  const gap = Math.max(2, Math.round(Math.sqrt(n2*4/(W < 700 ? 4200 : 8500))));
  parts = [];
  const R0 = Math.min(W,H);
  for (let y = 0; y < H; y += gap) for (let x = 0; x < W; x += gap) {
    if (img[(y*W + x)*4 + 3] > 128) {
      const ang = Math.random()*Math.PI*2, rad = (.1 + Math.sqrt(Math.random())*.55)*R0;
      parts.push({ hx:x + (Math.random()-.5)*gap*.5, hy:y + (Math.random()-.5)*gap*.5,
        x:W/2 + Math.cos(ang)*rad*2, y:H/2 + Math.sin(ang)*rad*2, vx:0, vy:0, ang, rad,
        sp:(.6 + Math.random()*.9)*(Math.random()<.5?-1:1), seed:Math.random() });
    }
  }
  parts.gap = gap;
}
let PCOL = ['255,236,220','255,140,66','255,110,60','255,45,79','255,179,71','255,244,210'];
function hexRGB(h){ h = h.trim().replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join(''); const n = parseInt(h,16); return [n>>16&255, n>>8&255, n&255]; }
function drawParticles(T, dt, heroP, mx, my, A){
  fctx.setTransform(1,0,0,1,0,0); fctx.clearRect(0,0,fx.width,fx.height);
  if (heroP >= .995 || !parts.length) return;
  fctx.setTransform(DPR,0,0,DPR,0,0);
  fctx.globalCompositeOperation = 'lighter';
  const alpha = Math.pow(1 - heroP, .7) * (started ? 1 : .55);
  const cols = PCOL.map(c => 'rgba(' + c + ',' + alpha.toFixed(3) + ')');
  const cx = W/2, cy = H/2, sz = Math.max(1.3, parts.gap*.6);
  const mr = Math.min(170, W*.2), mr2 = mr*mr;
  const k = (.045 + heroP*.12) * Math.min(dt*60, 2.2);
  const damp = Math.pow(.86, Math.min(dt*60, 2.2));
  const rp = heroP*heroP;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]; let tx, ty;
    const sx = cx + Math.cos(p.ang + T*.12*p.sp)*p.rad, sy = cy + Math.sin(p.ang + T*.12*p.sp)*p.rad*.62;
    if (A < 1) { tx = lerp(sx, p.hx, A); ty = lerp(sy, p.hy, A); } else { tx = p.hx; ty = p.hy; }
    if (heroP > 0) {
      const dx = tx - cx, dy = ty - cy;
      const a = rp*5.5 + p.seed*heroP*3, ca = Math.cos(a), sa = Math.sin(a), sc = 1 - heroP*.96;
      tx = cx + (dx*ca - dy*sa)*sc; ty = cy + (dx*sa + dy*ca)*sc;
    }
    const mdx = p.x - mx, mdy = p.y - my, d2 = mdx*mdx + mdy*mdy;
    if (d2 < mr2 && d2 > .01) {
      const d = Math.sqrt(d2), f = Math.pow(1 - d/mr, 2)*9*Math.min(dt*60, 2.2);
      p.vx += mdx/d*f + (-mdy/d)*f*.35; p.vy += mdy/d*f + (mdx/d)*f*.35;
    }
    p.vx += (tx - p.x)*k; p.vy += (ty - p.y)*k; p.vx *= damp; p.vy *= damp;
    p.x += p.vx; p.y += p.vy;
    const sp = Math.abs(p.vx) + Math.abs(p.vy);
    fctx.fillStyle = cols[Math.min(5, (sp*.55)|0)];
    fctx.fillRect(p.x - sz/2, p.y - sz/2, sz, sz);
  }
  fctx.globalCompositeOperation = 'source-over';
}

/* =====================================================================
   INPUT: cursor, click ripple, magnetic buttons
   ===================================================================== */
let mx = 0, my = 0, mxs = 0, mys = 0, pxx = -9999, pyy = -9999, lastMove = -99;
const ring = $('.ring');
let cx = -100, cy = -100;
let clickX = 0, clickY = 0, clickT = -99;
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
if (fine) document.body.classList.add('fine');
addEventListener('pointermove', e => { cx = e.clientX; cy = e.clientY; pxx = cx; pyy = cy; mx = (cx/W)*2-1; my = -((cy/H)*2-1); lastMove = performance.now()/1000; if (fine) ring.style.transform = `translate3d(${cx}px,${cy}px,0)`; }, { passive:true });
addEventListener('pointerdown', e => {
  ring.classList.add('down');
  clickX = (e.clientX - W/2)/H; clickY = -(e.clientY - H/2)/H; clickT = performance.now()/1000;
  if (e.pointerType !== 'mouse') { mx = (e.clientX/W)*2-1; my = -((e.clientY/H)*2-1); pxx = e.clientX; pyy = e.clientY; lastMove = clickT; }
});
addEventListener('pointerup', () => ring.classList.remove('down'));
if (fine) {
  document.addEventListener('pointerover', e => ring.classList.toggle('hot', !!(e.target.closest && e.target.closest('button,a,[data-hover]'))));
  // magnetic buttons, mouse only: on touch they would jump under the finger
  document.querySelectorAll('.btn').forEach(b => {
    let r = null;
    b.addEventListener('pointerenter', () => { r = b.getBoundingClientRect(); });
    b.addEventListener('pointermove', e => { if (!r) return; b.style.transform = `translate(${(e.clientX - r.left - r.width/2)*.22}px,${(e.clientY - r.top - r.height/2)*.35}px)`; });
    b.addEventListener('pointerleave', () => { r = null; b.style.transform = ''; });
  });
}

/* =====================================================================
   CHAPTERS, DOTS, FLY-TO, SCRAMBLE
   ===================================================================== */
const CHAP = [
  { id:'top', name:'THRESHOLD' }, { id:'icsp', name:'CIVIC PLATFORM' }, { id:'rjl', name:'COMMERCE REBUILD' },
  { id:'wolban', name:'THE STUDIO' }, { id:'earlier', name:'EARLIER ORBITS' }, { id:'contact', name:'OUTSIDE' }
];
const dots = $('#dots');
CHAP.forEach((c, i) => {
  const a = document.createElement('a'); a.href = '#' + c.id; a.dataset.hover = ''; a.setAttribute('aria-label', c.name);
  a.innerHTML = '<span>0' + i + ' / ' + c.name + '</span>';
  a.addEventListener('click', e => { e.preventDefault(); goTo(c.id); });
  dots.appendChild(a);
});
let flying = null;
function flyTo(y, dur){
  const y0 = scrollY, t0 = performance.now(), dist = Math.abs(y - y0);
  dur = dur*clamp(dist/(H*3), .5, 1.6)*1000;
  flying = { y0, y, t0, dur };
}
function goTo(id){
  const el = document.getElementById(id); if (!el) return;
  const sec = el.closest('section') || el;
  const y = id === 'top' ? 0 : sec.getBoundingClientRect().top + scrollY;
  if (reduce) scrollTo(0, y); else flyTo(y, 2.2);
  try { history.replaceState(null, '', '#' + id); } catch(e) {}
}
addEventListener('wheel', () => { flying = null; }, { passive:true });
addEventListener('touchstart', () => { flying = null; }, { passive:true });
document.querySelectorAll('a[href^="#"]').forEach(a => {
  if (a.closest('#dots')) return;
  a.addEventListener('click', e => { const id = a.getAttribute('href').slice(1); if (!document.getElementById(id)) return; e.preventDefault(); if (!started) begin(); goTo(id); });
});
$('#again').addEventListener('click', () => flyTo(0, 3.4));

const GLYPH = '▓▒░█/\\|<>-_+*#01234567';
function scramble(el, final, dur){
  cancelAnimationFrame(el._r);
  if (reduce) { el.textContent = final; return; }
  const t0 = performance.now();
  const step = () => {
    const t = clamp((performance.now() - t0)/dur, 0, 1);
    const reveal = Math.floor(t*final.length*1.15);
    let out = '';
    for (let i = 0; i < final.length; i++) out += (final[i] === ' ' || final[i] === '\u200b' || i < reveal) ? final[i] : GLYPH[Math.random()*GLYPH.length|0];
    el.textContent = out;
    if (t < 1) el._r = requestAnimationFrame(step); else el.textContent = final;
  };
  step();
}
const chapEl = $('#chap');
let activeSec = null, activeCh = -1;
const menuLinks = [...document.querySelectorAll('.menu a')];
const menuMap = { top:'', about:'about', icsp:'work', rjl:'work', wolban:'work', earlier:'work', skills:'skills', path:'path', contact:'contact' };
function setSection(sec){
  if (sec === activeSec) return;
  activeSec = sec;
  document.documentElement.setAttribute('data-theme', sec.dataset.theme);
  const ch = +sec.dataset.ch;
  if (ch !== activeCh) { activeCh = ch; [...dots.children].forEach((d,k) => d.classList.toggle('on', k === ch)); }
  document.body.classList.toggle('hud-on', ch === 0 || ch === 5);
  document.body.classList.toggle('pcb-on', ch === 0 || ch === 5);
  scramble(chapEl, '0' + ch + ' / ' + sec.dataset.name, 700);
  const h = sec.querySelector('h2[data-f]');
  if (h && !h._done) { h._done = true; scramble(h, h.dataset.f, 900); }
  menuLinks.forEach(a => { const on = a.dataset.m === menuMap[sec.id]; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  // read the theme colours once per chapter change; the frame loop eases toward these
  const cs = getComputedStyle(document.documentElement);
  const ice = hexRGB(cs.getPropertyValue('--ice')), vio = hexRGB(cs.getPropertyValue('--vio'));
  tintA = ice.map(v => v/255); tintB = vio.map(v => v/255);
  PCOL[1] = ice.join(','); PCOL[3] = vio.join(',');
}
let tintA = [1,.55,.26], tintB = [1,.18,.31];

/* =====================================================================
   START
   ===================================================================== */
function begin(){
  if (started) return;
  started = true; startT = performance.now()/1000;
  document.body.classList.remove('locked');
  $('#gate').classList.add('gone');
  if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 300);
  if (window.gsap && !reduce) gsap.from('.hero .inner > *', { y: 30, opacity: 0, duration: 1.2, stagger: .18, delay: .6, ease: 'power3.out' });
}
// auto-start: as soon as fonts are in and the first frame has rendered, or at 1.4s at the latest
(function(){ let done = false; const go = () => { if (done) return; done = true; begin(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(go, 450)); setTimeout(go, 1400); })();
addEventListener('keydown', e => {
  if (!started || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(CHAP[clamp(activeCh+1,0,CHAP.length-1)].id); }
  if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(CHAP[clamp(activeCh-1,0,CHAP.length-1)].id); }
});

