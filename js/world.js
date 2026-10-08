'use strict';
// world.js: helpers, the WebGL2 scene and post-process shaders, and the GL setup.
// Loaded as a classic script; top-level bindings are shared with the files that follow.

const $ = s => document.querySelector(s);
const clamp = (x,a,b) => Math.min(b, Math.max(a,x));
const lerp = (a,b,t) => a + (b-a)*t;
const smooth = (a,b,x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
try { history.scrollRestoration = 'manual'; } catch(e) {}

/* =====================================================================
   SHADERS
   ===================================================================== */
const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0., 1.); }`;

const FS_SCENE = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2  uRes;
uniform float uTime, uScene, uProg, uTravel, uStretch;
uniform vec2  uMouse;
uniform vec3  uClick, uA, uB;
const float PI = 3.14159265359;
const float TAU = 6.28318530718;
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float h31(vec3 p){ p = fract(p*.1031); p += dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float noise3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z);
}
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s += a*noise3(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= .5; } return s; }
float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<3;i++){ s += a*noise3(p); p = p*2.1 + vec3(1.7,9.2,3.1); a *= .5; } return s; }

/* ---------- sky ---------- */
vec3 nebula(vec3 d, vec3 ca, vec3 cb){
  float t = uTime*.01;
  float n  = fbm(d*2.2 + vec3(0.,t,0.));
  float n2 = fbm(d*4.5 - vec3(t,0.,0.) + n*1.5);
  float band = exp(-pow(dot(d, normalize(vec3(.35,.9,.25)))*2.6, 2.));
  vec3 c = mix(vec3(.01,.012,.04), cb*.38, smoothstep(.35,.85,n));
  c = mix(c, ca*.42, smoothstep(.5,.9,n2)*.7);
  c += ca*pow(n2,4.)*band*.6;
  return c*(.25+band*1.1)*.9;
}
vec3 starsDir(vec3 d, vec3 tintA, vec3 tintB){
  vec3 col = vec3(0.);
  for(int l=0;l<3;l++){
    float sc = 26.+float(l)*32.;
    vec3 p = d*sc; vec3 id = floor(p); vec3 f = fract(p)-.5;
    float r = h31(id+float(l)*17.);
    if(r > .68){
      vec3 off = (vec3(h31(id+1.3),h31(id+7.1),h31(id+3.7))-.5)*.6;
      float dd = length(f-off);
      float size = .04 + .1*h31(id+9.);
      float b = smoothstep(size,0.,dd);
      vec3 tint = mix(tintA, tintB, h31(id+5.));
      col += tint*b*(.6+2.2*h31(id+2.))*(1.-float(l)*.22);
    }
  }
  return col;
}

/* ---------- 0 / 5 : DRIFT, warp tunnel of stars ---------- */
vec3 sceneDrift(vec2 uv, vec3 ca, vec3 cb, float calm){
  vec2 p = uv - uMouse*.05;
  vec3 d = normalize(vec3(p,1.1));
  d.xz *= rot(uTime*.015 + uMouse.x*.25); d.yz *= rot(-.3 + uMouse.y*.15);
  vec3 col = nebula(d, ca, cb)*1.15 + starsDir(d, vec3(1.,.85,.7), ca)*.75;
  float ang = atan(p.y,p.x), r = length(p);
  float st = mix(uStretch, 1., calm);
  for(int i=0;i<4;i++){
    float fi = float(i);
    float K = 34. + fi*22.;
    vec2 g = vec2(ang/TAU*K, log(r+1e-4)*K/TAU - uTravel*(.35+fi*.2)*(1.-calm*.7) - fi*3.7);
    vec2 id = floor(g), gv = fract(g)-.5;
    float n = h21(id+fi*19.19);
    if(n < .6) continue;
    vec2 off = (vec2(h21(id+3.3),h21(id+8.8))-.5)*.5;
    gv -= off; gv.y /= st;
    float sz = .04 + .05*h21(id+1.7);
    float m = smoothstep(sz,0.,length(gv));
    m *= smoothstep(.015,.22,r) * (.4 + min(r,.55)*1.4) / sqrt(st);
    m *= .65 + .35*sin(uTime*(2.+h21(id)*4.)+h21(id+2.)*6.);
    vec3 tint = mix(vec3(1.,.9,.8), cb, h21(id+5.5));
    col += tint*m*1.4;
  }
  col += ca*exp(-r*4.)*clamp((st-1.)*.06,0.,.7);
  return col;
}

/* ---------- 1 : LATTICE, a neural grid you fly through (ICSP) ---------- */
float dLat(vec3 p, out float which){
  vec3 q = mod(p+1.,2.)-1.;
  float s = length(q)-.15;
  float r = min(length(q.yz), min(length(q.xz), length(q.xy)))-.024;
  which = s < r ? 1. : 0.;
  return min(s,r);
}
vec3 sceneLattice(vec2 uv){
  float t = uTime*.35;
  vec3 ro = vec3(sin(t*.5)*.55, cos(t*.41)*.45, t*1.1 + uProg*3.);
  vec3 rd = normalize(vec3(uv,1.35));
  rd.xy *= rot(t*.08 + uMouse.x*.35); rd.yz *= rot(uMouse.y*.25);
  float tt = 0., glow = 0., w = 0.; vec3 col = vec3(0.);
  bool hit = false;
  for(int i=0;i<64;i++){
    vec3 p = ro + rd*tt;
    float d = dLat(p, w);
    float pulse = .55 + .45*sin(p.x*1.7 + p.y*1.3 - uTime*2.2 + p.z*.9);
    glow += .0006/(.02+d*d)*pulse;
    if(d < .0025){ hit = true; break; }
    if(tt > 26.) break;
    tt += d*.92;
  }
  vec3 bg = vec3(.004,.022,.013);
  vec3 green = vec3(.38,.9,.55), khaki = vec3(.9,.82,.58);
  if(hit){
    vec3 p = ro + rd*tt;
    vec2 k = vec2(1.,-1.)*.0015; float dummy;
    vec3 n = normalize(k.xyy*dLat(p+k.xyy,dummy) + k.yyx*dLat(p+k.yyx,dummy) + k.yxy*dLat(p+k.yxy,dummy) + k.xxx*dLat(p+k.xxx,dummy));
    vec3 l = normalize(vec3(.4,.8,-.3));
    float df = clamp(dot(n,l),0.,1.), rim = pow(1.-clamp(dot(n,-rd),0.,1.),3.);
    float flow = .5+.5*sin(p.z*4. - uTime*5. + p.x*2.);
    vec3 alb = w > .5 ? khaki : mix(green*.35, green, flow);
    col = alb*(.08 + df*.6) + rim*green*.5 + (w > .5 ? khaki*pow(df,6.)*.4 : vec3(0.));
    col = mix(col, bg, 1.-exp(-tt*.11));
  } else col = bg;
  col += green*min(glow,1.6)*.3;
  return col;
}

/* ---------- 2 : THE RECORD, a vinyl singularity (RapJointLagos) ---------- */
vec3 sceneVinyl(vec2 uv){
  float az = uTime*.06 + uMouse.x*.6, el = .62 + uMouse.y*.3 - uProg*.25;
  vec3 ro = 6.8*vec3(cos(el)*sin(az), sin(el), cos(el)*cos(az));
  vec3 fw = normalize(-ro), rt = normalize(cross(fw,vec3(0.,1.,0.))), up = cross(rt,fw);
  vec3 rd = normalize(uv.x*rt + uv.y*up + 1.3*fw);
  vec3 orange = vec3(.85,.42,.12), white = vec3(.96,.96,.96);
  vec3 col = nebula(rd, orange, vec3(.25,.08,.02))*.55 + starsDir(rd, vec3(1.,.8,.6), white)*.6;
  float tt = -ro.y/rd.y;
  if(rd.y < 0. && tt > 0.){
    vec3 hp = ro + rd*tt;
    float rad = length(hp.xz), ang = atan(hp.z,hp.x);
    float R = 4.3;
    if(rad < R){
      float spin = ang + uTime*1.25;
      float groove = .5+.5*sin(rad*95.);
      float wob = fbm3(vec3(cos(spin)*rad*.9, sin(spin)*rad*.9, uTime*.08));
      vec3 disc = vec3(.035) + vec3(.045)*groove;
      disc += orange*pow(wob,2.4)*1.3*smoothstep(1.35,1.7,rad)*smoothstep(R,R-.9,rad);
      float sheen = pow(max(0., cos(ang - 1.1 + sin(uTime*.3)*.4)), 26.)*.75*smoothstep(1.45,2.1,rad);
      disc += vec3(1.,.82,.62)*sheen;
      float seg = step(.5, fract(spin/TAU*6.));
      vec3 lab = mix(orange*.95, white, seg*.18);
      lab += white*pow(max(0.,sin(spin*3.+uTime)),8.)*.08;
      float label = smoothstep(1.36,1.33,rad), hole = smoothstep(.2,.17,rad);
      col = mix(disc, lab, label);
      col = mix(col, vec3(0.), hole);
    }
    float rim = exp(-abs(rad-R)*9.)*1.6 + exp(-abs(rad-R)*1.4)*.25;
    col += mix(orange, vec3(1.,.72,.4), .4)*rim;
    col = mix(col, col*.35, 1.-exp(-tt*.025));
  }
  float gl = exp(-length(uv+vec2(0.,.1))*2.2)*.15;
  col += orange*gl;
  return col;
}

/* ---------- 3 : GYROID, a living structure (Wolban Tech) ---------- */
float dGy(vec3 p){ p *= 1.25; float g = dot(sin(p), cos(p.yzx)); return (abs(g)-.32)/1.25*.6; }
vec3 sceneGyroid(vec2 uv){
  float t = uTime*.28;
  vec3 ro = vec3(sin(t*.37)*.8, cos(t*.29)*.6, t*1.4 + uProg*2.);
  vec3 rd = normalize(vec3(uv,1.3));
  rd.xy *= rot(t*.12 + uMouse.x*.4); rd.yz *= rot(uMouse.y*.3 + sin(t*.2)*.1);
  float tt = 0.; bool hit = false; float st = 0.;
  for(int i=0;i<56;i++){
    float d = dGy(ro+rd*tt); st += 1.;
    if(d < .003){ hit = true; break; }
    if(tt > 22.) break;
    tt += d;
  }
  vec3 forest = vec3(.025,.11,.07), sage = vec3(.62,.82,.68), mint = vec3(.78,.95,.84);
  vec3 col = forest*.7;
  if(hit){
    vec3 p = ro+rd*tt;
    vec2 k = vec2(1.,-1.)*.002;
    vec3 n = normalize(k.xyy*dGy(p+k.xyy) + k.yyx*dGy(p+k.yyx) + k.yxy*dGy(p+k.yxy) + k.xxx*dGy(p+k.xxx));
    vec3 l1 = normalize(vec3(.5,.9,-.4)), l2 = normalize(vec3(-.6,-.3,.7));
    float d1 = clamp(dot(n,l1),0.,1.), d2 = clamp(dot(n,l2),0.,1.);
    float rim = pow(1.-clamp(dot(n,-rd),0.,1.), 2.5);
    float ao = clamp(1.-st/56.*1.4, .15, 1.);
    float sweep = pow(.5+.5*sin(p.z*1.2 - uTime*1.6), 10.);
    col = mix(forest*1.1, sage*.45, d1)*ao + mint*d2*.08*ao + rim*mint*.3*ao + sweep*mint*.2;
    col = mix(col, forest*.6, 1.-exp(-tt*.2));
  }
  col += sage*pow(st/56., 2.)*.07;
  return col;
}

vec3 scene(int i, vec2 uv){
  if(i==0) return sceneDrift(uv, uA, uB, 0.);
  if(i==1) return sceneLattice(uv);
  if(i==2) return sceneVinyl(uv);
  if(i==3) return sceneGyroid(uv);
  return sceneDrift(uv*1.15 + vec2(0.,.12), vec3(1.,.72,.4), vec3(1.,.35,.3), .75);
}
vec2 shock(vec2 uv){
  if(uClick.z < 0. || uClick.z > 3.2) return uv;
  vec2 d = uv - uClick.xy; float r = length(d);
  float w = exp(-pow((r - uClick.z*.85)*7., 2.));
  return uv - normalize(d + 1e-5)*w*.06*exp(-uClick.z*.9);
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes)/uRes.y;
  uv = shock(uv);
  uv /= min(1., uRes.x/uRes.y*1.1);
  float s = clamp(uScene, 0., 4.);
  float i0 = min(floor(s), 4.);
  float f = s - i0;
  float m = i0 < 3.5 ? smoothstep(.55, 1., f) : 0.;
  vec3 col; float r = length(uv);
  if(m <= .001) col = scene(int(i0), uv);
  else {
    float R = m*1.7, edge = .07;
    float w = smoothstep(R, R-edge, r);
    vec3 a = vec3(0.), b = vec3(0.);
    if(w < .999) a = scene(int(i0), uv);
    if(w > .001) b = scene(int(i0)+1, uv);
    col = mix(a, b, w);
    float ring = exp(-pow((r - R + edge*.5)*20., 2.)) * smoothstep(0.,.08,m) * (1. - smoothstep(.93,1.,m));
    col += ring*vec3(1.,.9,.75)*1.7;
  }
  col = pow(aces(col*1.05), vec3(1./2.2));
  fragColor = vec4(col, 1.);
}`;

const FS_POST = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime, uVel, uFade;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec2 c = uv - .5;
  float asp = uRes.x/uRes.y;
  float ca = .0016 + dot(c,c)*.010 + min(uVel,3.)*.005;
  vec3 col;
  col.r = texture(uTex, uv + c*ca*2.).r;
  col.g = texture(uTex, uv).g;
  col.b = texture(uTex, uv - c*ca*2.).b;
  vec3 bl = vec3(0.);
  for(int i=0;i<12;i++){
    float fi = float(i)+.5;
    float a = fi*2.3999632;
    float rr = sqrt(fi/12.);
    vec2 o = vec2(cos(a)/asp, sin(a))*rr;
    bl += max(texture(uTex, uv + o*.03).rgb - .5, 0.) + max(texture(uTex, uv + o*.10).rgb - .55, 0.)*.9;
  }
  col += bl/12.*1.2;
  col *= 1. - dot(c,c)*1.3;
  col += (h21(gl_FragCoord.xy + fract(uTime)*97.) - .5)*.04;
  fragColor = vec4(col*uFade, 1.);
}`;

/* =====================================================================
   WEBGL
   ===================================================================== */
const canvas = $('#gl'), fx = $('#fx');
const gl = canvas.getContext('webgl2', { antialias:false, alpha:false, powerPreference:'high-performance' });
let P1, P2, rt = { tex:null, fbo:null, w:0, h:0 };
function compile(type, src){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); throw new Error('shader'); }
  return s;
}
function makeProgram(fs){
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); throw new Error('link'); }
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function makeRT(w, h){
  if (rt.tex) gl.deleteTexture(rt.tex); if (rt.fbo) gl.deleteFramebuffer(rt.fbo);
  rt.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, rt.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  rt.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt.tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); rt.w = w; rt.h = h;
}
let hasGL = !!gl;
if (hasGL) { try { P1 = makeProgram(FS_SCENE); P2 = makeProgram(FS_POST); } catch(e) { hasGL = false; } }
if (!hasGL) document.body.classList.add('nogl');
