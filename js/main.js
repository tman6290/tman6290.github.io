'use strict';
// main.js: the frame loop that drives everything.
// Loaded as a classic script; top-level bindings are shared with the files that follow.

/* =====================================================================
   MAIN LOOP
   ===================================================================== */
resize();
let lastW = innerWidth, lastH = innerHeight;
addEventListener('resize', () => { if (innerWidth === lastW && Math.abs(innerHeight - lastH) < lastH*.25) return; lastW = innerWidth; lastH = innerHeight; resize(); });
addEventListener('load', measure);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildParticles(); measure(); });
// re-measure whenever the page's height changes (fonts, lazy images, orientation), not on a timer
if (window.ResizeObserver) new ResizeObserver(() => measure()).observe(document.querySelector('main'));
scrollTo(0, 0);
$('#load').textContent = hasGL ? 'ORBIT CALIBRATED: READY' : 'WEBGL2 UNAVAILABLE: STATIC MODE';

let last = performance.now()/1000, T = 0, sm = 0, prevSm = 0, sVel = 0, travel = 0, stretch = 1, fade = 0, sceneS = 0;
let frameAcc = 0, frameN = 0, cool = 0, hidden = false, measT = 0;
const tV = $('#tV'), tD = $('#tD'), tL = $('#tL'), bar = $('#bar'), pcbEl = $('#pcb');
const uA = [1.,.55,.26], uB = [1.,.18,.31];
function readTint(){
  for (let i = 0; i < 3; i++) { uA[i] += (tintA[i] - uA[i])*.02; uB[i] += (tintB[i] - uB[i])*.02; }
}
// DOM writes are skipped when the value has not changed, so idle frames touch nothing
const last$ = new WeakMap();
function put(el, prop, val){ if (last$.get(el) === val) return; last$.set(el, val); if (prop === 'text') el.textContent = val; else el.style[prop] = val; }
let scrolledOn = false;
document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (!hidden) { last = performance.now()/1000; requestAnimationFrame(frame); } });

function frame(nowMs){
  if (hidden) return;
  requestAnimationFrame(frame);
  const now = nowMs/1000;
  let dt = Math.min(.1, now - last); last = now; if (dt <= 0) return;
  if (!reduce) T += dt;
  if (now - measT > 4) { measure(); measT = now; }

  if (flying) { const t = clamp((performance.now() - flying.t0)/flying.dur, 0, 1); scrollTo(0, lerp(flying.y0, flying.y, ease(t))); if (t >= 1) flying = null; }
  const target = scrollY;
  sm += (target - sm)*(1 - Math.exp(-dt*6));
  if ((target > 40) !== scrolledOn) { scrolledOn = target > 40; document.body.classList.toggle('scrolled', scrolledOn); }
  const vel = (sm - prevSm)/dt/H; prevSm = sm;
  sVel += (vel - sVel)*(1 - Math.exp(-dt*8));
  stretch += ((1 + Math.min(Math.abs(sVel)*7, 10)) - stretch)*(1 - Math.exp(-dt*6));
  travel += dt*(.05 + Math.min(Math.abs(sVel), 4)*.9);

  // active section: the last one whose title has risen past 70% of the viewport
  const line = sm + H*.7;
  let act = secs[0];
  for (let i = 0; i < secTops.length; i++) if (secTops[i].top <= line) act = secTops[i].el;
  if (sm < H*.3) act = secs[0];
  if (started) setSection(act);
  readTint();

  // scene value: the wipe runs while a project title travels from 72% to 40% of the viewport
  let sv = 0;
  for (let k = 0; k < anchors.length; k++) {
    const g = clamp((sm + H*.72 - anchors[k])/(H*.32), 0, 1);
    if (g > 0) sv = Math.max(sv, k + .55 + .45*g);
  }
  sceneS = sv;
  // progress inside the active chapter
  const box = activeSec && secBox.get(activeSec);
  const aTop = box ? box.top : 0, aH = box ? box.h : H;
  const prog = clamp((sm - aTop + H*.5)/Math.max(1, aH), 0, 1);

  // pointer smoothing + idle wander
  let tmx = mx, tmy = my;
  if (now - lastMove > 3.5) { tmx = Math.sin(T*.27)*.45; tmy = Math.cos(T*.21)*.28; }
  mxs += (tmx - mxs)*(1 - Math.exp(-dt*3.5)); mys += (tmy - mys)*(1 - Math.exp(-dt*3.5));

  // particles
  const heroP = clamp(sm/H, 0, 1);
  const assemble = reduce ? 1 : (started ? ease(clamp((now - startT + .4)/2.4, 0, 1)) : 0);
  drawParticles(T, dt, heroP, pxx, pyy, assemble);
  fade += ((started ? 1 : .55) - fade)*(1 - Math.exp(-dt*1.6));
  const dim = 1 - .38*smooth(.5, 1.3, sm/H);

  if (hasGL && rt.fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo); gl.viewport(0, 0, rt.w, rt.h); gl.useProgram(P1.p);
    gl.uniform2f(P1.u.uRes, rt.w, rt.h); gl.uniform1f(P1.u.uTime, T); gl.uniform1f(P1.u.uScene, sceneS); gl.uniform1f(P1.u.uProg, prog);
    gl.uniform1f(P1.u.uTravel, travel); gl.uniform1f(P1.u.uStretch, reduce ? 1 : stretch);
    gl.uniform2f(P1.u.uMouse, mxs, mys); gl.uniform3f(P1.u.uClick, clickX, clickY, now - clickT);
    gl.uniform3f(P1.u.uA, uA[0], uA[1], uA[2]); gl.uniform3f(P1.u.uB, uB[0], uB[1], uB[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(P2.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rt.tex);
    gl.uniform1i(P2.u.uTex, 0); gl.uniform2f(P2.u.uRes, canvas.width, canvas.height); gl.uniform1f(P2.u.uTime, T);
    gl.uniform1f(P2.u.uVel, Math.abs(sVel)); gl.uniform1f(P2.u.uFade, fade*dim);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // circuit layer parallax
  if (activeCh === 0 || activeCh === 5) put(pcbEl, 'transform', `translate3d(${(mxs*-18).toFixed(1)}px,${(mys*14 - (sm%H)*.04).toFixed(1)}px,0)`);

  // relics + screen tilt
  if (T3.ok) {
    const key = activeSec ? ({top:'core',about:'core',icsp:'icsp',rjl:'rjl',wolban:'wolban',contact:'core'})[activeSec.id] : 'core';
    let p = 1;
    if (key === 'core') p = activeSec && activeSec.id === 'contact' ? 1 - smooth(0, .35, prog) : (started ? Math.max(smooth(.1, .75, sm/H), 1 - assemble) : 1);
    else p = (1 - smooth(0, .3, prog)) + smooth(.74, 1, prog);
    const par = box ? -((sm + H*.5) - (aTop + aH*.5))/H*1.6 : 0;
    T3.frame(key, clamp(p,0,1), T, dt, mxs, mys, clamp(par,-2,2));
  }
  // screenshot tilt follows the mouse; touch devices keep it flat
  if (fine && activeSec) { const core = activeSec.querySelector('.core'); if (core) put(core, 'transform', `rotateY(${(mxs*7).toFixed(1)}deg) rotateX(${(-mys*5).toFixed(1)}deg)`); }

  // HUD
  const pr = clamp(sm/docMax, 0, 1);
  put(bar, 'transform', 'scaleX(' + pr.toFixed(4) + ')');
  if ((activeCh === 0 || activeCh === 5) && W > 760) {   // the telemetry box is only on screen here
    const v = .9995*smooth(0, 1, pr)*(1 - .02*Math.min(1, Math.abs(sVel)));
    const gam = 1/Math.sqrt(1 - v*v);
    put(tV, 'text', v.toFixed(4) + ' c'); put(tD, 'text', '×' + gam.toFixed(2));
    put(tL, 'text', Math.round(Math.pow(pr, 2.2)*4.2e6 + pr*9000).toLocaleString('en-US') + ' ly');
  }

  // adaptive resolution
  if (hasGL) {
    if (dt < .08) { frameAcc += dt; frameN++; }
    if (cool > 0) cool--;
    if (frameN >= 24) {
      const avg = frameAcc/frameN; frameAcc = 0; frameN = 0;
      if (avg > .09 && window.gsap && !window.__gsapOff) {   // very slow device: drop the entrance tweens so nothing stays hidden
        window.__gsapOff = true;
        if (window.ScrollTrigger) ScrollTrigger.getAll().forEach(t => t.kill());
        gsap.globalTimeline.clear();
        gsap.set('.sec *', { clearProps: 'opacity,transform,filter' });
      }
      if (cool === 0) {
        let nq = q;
        if (avg > .026 && q > qMin) nq = q*.86; else if (avg < .0175 && q < 1.05) nq = q*1.07;
        if (Math.abs(nq - q) > .001) { q = nq; makeRT(Math.max(2, Math.round(W*q)), Math.max(2, Math.round(H*q))); cool = 40; }
      }
    }
  }
}
requestAnimationFrame(t => { last = t/1000; requestAnimationFrame(frame); });
