'use strict';
// relics.js: three.js objects that assemble and disintegrate per chapter, and GSAP entrances.
// Loaded as a classic script; top-level bindings are shared with the files that follow.

/* =====================================================================
   THREE.JS RELICS: one 3D object per world, assembled from dust, then disintegrated
   ===================================================================== */
const T3 = { ok:false };
(function(){
  if (!window.THREE || !hasGL) return;
  const c = $('#t3');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas:c, alpha:true, antialias:false, powerPreference:'high-performance' }); } catch(e) { return; }
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, W/H, .1, 60); cam.position.set(0,0,7.5);
  const PV = `attribute vec3 aTarget; attribute float aSeed; uniform float uP,uSize,uTime,uDpr; varying float vA;
    void main(){ float e = smoothstep(aSeed*.7, aSeed*.7+.3, uP); vec3 p = mix(position, aTarget, e);
      p += vec3(sin(uTime*1.3+aSeed*20.), cos(uTime*1.1+aSeed*13.), sin(uTime*.9+aSeed*7.))*.025*(1.+e*5.);
      vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
      gl_PointSize = uSize*(1.2-e*.9)*(13./-mv.z)*uDpr; vA = (1.-e*.85)*(.55+.45*aSeed); }`;
  const PF = `precision mediump float; uniform vec3 uColor; varying float vA;
    void main(){ vec2 q = gl_PointCoord-.5; float d = length(q); if(d>.5) discard; float a = smoothstep(.5,.08,d)*vA; gl_FragColor = vec4(uColor*(1.+a*.6), a); }`;
  function surfacePoints(geo, N){
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.getAttribute('position'); const nT = pos.count/3;
    const cum = new Float32Array(nT); let tot = 0;
    const a=new THREE.Vector3(), b=new THREE.Vector3(), cc=new THREE.Vector3(), ab=new THREE.Vector3(), ac=new THREE.Vector3(), n=new THREE.Vector3();
    for (let i=0;i<nT;i++){ a.fromBufferAttribute(pos,i*3); b.fromBufferAttribute(pos,i*3+1); cc.fromBufferAttribute(pos,i*3+2); ab.subVectors(b,a); ac.subVectors(cc,a); tot += ab.cross(ac).length()*.5; cum[i]=tot; }
    const P = new Float32Array(N*3), Tg = new Float32Array(N*3), S = new Float32Array(N);
    for (let k=0;k<N;k++){
      const r = Math.random()*tot; let lo=0, hi=nT-1; while(lo<hi){ const m=(lo+hi)>>1; if(cum[m]<r) lo=m+1; else hi=m; }
      a.fromBufferAttribute(pos,lo*3); b.fromBufferAttribute(pos,lo*3+1); cc.fromBufferAttribute(pos,lo*3+2);
      let u=Math.random(), v=Math.random(); if(u+v>1){u=1-u;v=1-v;}
      const px=a.x+(b.x-a.x)*u+(cc.x-a.x)*v, py=a.y+(b.y-a.y)*u+(cc.y-a.y)*v, pz=a.z+(b.z-a.z)*u+(cc.z-a.z)*v;
      ab.subVectors(b,a); ac.subVectors(cc,a); n.crossVectors(ab,ac).normalize();
      const d = .6+Math.random()*2.4;
      P[k*3]=px; P[k*3+1]=py; P[k*3+2]=pz;
      Tg[k*3]=px+n.x*d+(Math.random()-.5)*2.4; Tg[k*3+1]=py+n.y*d+(Math.random()-.5)*2.4+.6; Tg[k*3+2]=pz+n.z*d+(Math.random()-.5)*2.4;
      S[k]=Math.random();
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(P,3)); bg.setAttribute('aTarget', new THREE.BufferAttribute(Tg,3)); bg.setAttribute('aSeed', new THREE.BufferAttribute(S,1));
    return bg;
  }
  function relic(geo, hex, N, size){
    const grp = new THREE.Group();
    const col = new THREE.Color(hex);
    const pm = new THREE.ShaderMaterial({ vertexShader:PV, fragmentShader:PF, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ uP:{value:1}, uSize:{value:size}, uTime:{value:0}, uDpr:{value:Math.min(devicePixelRatio||1,1.5)}, uColor:{value:col} } });
    grp.add(new THREE.Points(surfacePoints(geo, N), pm));
    const lm = new THREE.LineBasicMaterial({ color:col, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending });
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lm));
    grp.userData = { pm, lm, p:1 }; grp.visible = false; scene.add(grp); return grp;
  }
  function boxes(cells, s){   // merged non-indexed cubes
    const box = new THREE.BoxGeometry(s,s,s).toNonIndexed(); const bp = box.getAttribute('position');
    const out = new Float32Array(cells.length*bp.count*3); let o=0;
    cells.forEach(([x,y,z,sy]) => { for(let i=0;i<bp.count;i++){ out[o++]=bp.getX(i)+x; out[o++]=bp.getY(i)*(sy||1)+y; out[o++]=bp.getZ(i)+z; } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out,3)); return g;
  }
  // 00 / core: an internet sphere, nodes on a globe joined by network arcs
  const R = {};
  R.core = relic(new THREE.IcosahedronGeometry(2.05,3), 0xff8a4a, 7000, 1.5);
  { const arcs = new THREE.Group(); const am = new THREE.LineBasicMaterial({ color:0xffc48a, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
    const onSphere = r => { const u=Math.random()*2-1, t=Math.random()*Math.PI*2, q=Math.sqrt(1-u*u); return new THREE.Vector3(q*Math.cos(t)*r, u*r, q*Math.sin(t)*r); };
    for (let i=0;i<42;i++){ const a=onSphere(2.05), b=onSphere(2.05); const d=a.distanceTo(b); if (d < .8 || d > 3.4) { i--; continue; }
      const mid = a.clone().add(b).multiplyScalar(.5).normalize().multiplyScalar(2.05 + d*.42);
      const g = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(30));
      arcs.add(new THREE.Line(g, am)); }
    const nodes = new THREE.Group(); const nm = new THREE.PointsMaterial({ color:0xffe0b0, size:.07, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
    const np = []; for (let i=0;i<120;i++){ const v=onSphere(2.08); np.push(v.x,v.y,v.z); }
    nodes.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(np,3)), nm));
    R.core.add(arcs); R.core.add(nodes); R.core.userData.extra = arcs; R.core.userData.extra2 = nodes; }
  // 01 / ICSP: a QR-like cube lattice
  { const cells=[]; let sd=7; const rnd=()=>{ sd=(sd*1103515245+12345)&0x7fffffff; return sd/0x7fffffff; };
    for(let x=-3;x<=3;x++)for(let y=-3;y<=3;y++)for(let z=-3;z<=3;z++){ const edge = Math.abs(x)===3||Math.abs(y)===3||Math.abs(z)===3; if(edge && rnd()>.45) cells.push([x*.46,y*.46,z*.46]); }
    R.icsp = relic(boxes(cells,.34), 0x7fe8a6, 7000, 1.7); }
  // 02 / RJL: a vinyl record with grooves
  { const g = new THREE.CylinderGeometry(2.1,2.1,.07,128,1,false); g.rotateX(Math.PI/2);
    R.rjl = relic(g, 0xffa050, 9000, 1.6);
    const grooves = new THREE.Group();
    for(let i=0;i<9;i++){ const rg = new THREE.RingGeometry(.65+i*.17,.66+i*.17,128); grooves.add(new THREE.Line(rg, new THREE.LineBasicMaterial({color:0xffb070,transparent:true,opacity:0,blending:THREE.AdditiveBlending}))); }
    R.rjl.add(grooves); R.rjl.userData.extra = grooves; }
  // 03 / Wolban: an icosahedral shell
  R.wolban = relic(new THREE.IcosahedronGeometry(2.1,2), 0xb8e6c6, 7000, 1.6);
  const place = { core:[0,0], icsp:[1,1], rjl:[-1,1], wolban:[1,1] };
  let active = null, posX = 0, posY = 0, baseX = 0;
  T3.ok = true;
  T3.resize = () => { renderer.setPixelRatio(Math.min(devicePixelRatio||1, 1.5)); renderer.setSize(W,H,false); cam.aspect = W/H; cam.updateProjectionMatrix(); };
  T3.resize();
  T3.frame = (key, p, t, dt, mx, my, par) => {
    const g = R[key] || null;
    if (g !== active) { if (active) active.visible = false; active = g; if (g) g.visible = true; }
    if (!g) { renderer.clear(); return; }
    const u = g.userData;
    u.p += (p - u.p)*(1 - Math.exp(-dt*5));
    u.pm.uniforms.uP.value = u.p; u.pm.uniforms.uTime.value = t;
    u.lm.opacity = Math.pow(1-u.p, 2)*.55;
    if (u.extra) u.extra.children.forEach(l => l.material.opacity = Math.pow(1-u.p,2)*.5);
    if (u.extra2) u.extra2.children.forEach(l => l.material.opacity = Math.pow(1-u.p,2)*.9);
    const side = W > 980 ? place[key][0] : 0;
    baseX = side*(W > 1300 ? 2.6 : 2.1);
    const ty = (key === 'core' ? (W > 980 ? -.1 : 1.9) : (W > 980 ? .9 : 1.3)) + par;
    posX += (baseX - posX)*(1 - Math.exp(-dt*3)); posY += (ty - posY)*(1 - Math.exp(-dt*3));
    g.position.set(posX + mx*.25, posY + my*.2, 0);
    g.rotation.y = t*.18 + mx*.5; g.rotation.x = Math.sin(t*.13)*.25 + my*.3;
    if (key === 'rjl') { g.rotation.set(1.05 + my*.3, t*.9, 0); }
    const sc = W > 980 ? .95 : (key === 'core' ? .5 : .62);
    g.scale.setScalar(sc*(1-u.p*.15));
    renderer.render(scene, cam);
  };
})();

/* =====================================================================
   GSAP: cinematic entrances
   ===================================================================== */
if (window.gsap && window.ScrollTrigger && !reduce) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ overwrite:'auto' });
  secs.forEach(sec => {
    if (sec.classList.contains('hero')) return;
    const heads = sec.querySelectorAll('.tag, h2, .lede, .about p, .facts');
    const bits = sec.querySelectorAll('.chips .chip, .proof div, .row .btn, .note, .ecard, .group, .tlr, .way, .credit');
    const shell = sec.querySelectorAll('.shell, .caption');
    const num = sec.querySelector('.num');
    const st = { trigger: sec, start: 'top 72%', once: true };
    if (heads.length) gsap.from(heads, { y: 54, opacity: 0, filter: 'blur(14px)', duration: 1.2, ease: 'power3.out', stagger: .09, scrollTrigger: st });
    if (bits.length) gsap.from(bits, { y: 34, opacity: 0, scale: .92, duration: .9, ease: 'back.out(1.7)', stagger: .045, delay: .25, scrollTrigger: st });
    if (shell.length) gsap.from(shell, { y: 60, opacity: 0, rotateY: -18, rotateX: 8, transformPerspective: 1200, duration: 1.4, ease: 'power3.out', delay: .15, scrollTrigger: st });
    if (num) gsap.from(num, { scale: .7, opacity: 0, x: 80, duration: 1.6, ease: 'power3.out', scrollTrigger: st });
  });
  gsap.utils.toArray('.proof b').forEach(b => gsap.from(b, { scale: .4, opacity: 0, duration: 1, ease: 'elastic.out(1,.45)', delay: .5, scrollTrigger: { trigger: b, start: 'top 85%', once: true } }));
}

