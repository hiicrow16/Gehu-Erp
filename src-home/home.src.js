import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { initHelp } from "./help.js";

/* ============================================================
   Helpers
   ============================================================ */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover:hover) and (pointer:fine)").matches;
const isMobile = () => innerWidth < 760;

document.documentElement.classList.add("js");
document.body.classList.add("is-loading");

/* ============================================================
   Loader progress (real asset progress + minimum time)
   ============================================================ */
const loaderNum = $("#loaderNum"), loaderBar = $("#loaderBar"), loaderEl = $("#loader");
let shown = 0, target = 0;
function setProgress(p) { target = Math.max(target, p); }
const loaderTick = setInterval(() => {
  shown += (target - shown) * 0.12 + 0.15;
  shown = Math.min(shown, target);
  loaderNum.textContent = Math.round(shown);
  loaderBar.style.transform = `scaleX(${shown / 100})`;
}, 30);

/* ============================================================
   Smooth scroll (Lenis) + GSAP
   ============================================================ */
gsap.registerPlugin(ScrollTrigger);
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothTouch: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollY = () => (lenis ? lenis.animatedScroll : window.scrollY);

/* ============================================================
   WebGL scene
   ============================================================ */
const canvas = $("#gl");
let gl = null;           // holds everything once the scene is built
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, loaded, total) => setProgress(10 + (loaded / total) * 80);
const assetsDone = new Promise((res) => { manager.onLoad = res; });

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) { return false; }
}

function buildGearGeometry({ teeth = 28, rOuter = 3.05, rRoot = 2.72, rHole = 1.62, depth = 0.62 } = {}) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [a + step * 0.04, rRoot],
      [a + step * 0.2, rOuter],
      [a + step * 0.46, rOuter],
      [a + step * 0.62, rRoot],
    ];
    pts.forEach(([ang, r], k) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      i === 0 && k === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, rHole, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 40,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,190,110,1)");
  grd.addColorStop(0.25, "rgba(255,110,30,.55)");
  grd.addColorStop(0.6, "rgba(229,48,31,.14)");
  grd.addColorStop(1, "rgba(229,48,31,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const flameVert = /* glsl */`
  uniform float uTime; uniform float uPx;
  attribute vec4 aSeed;
  varying float vLife;
  void main(){
    float t = fract(uTime * (0.16 + aSeed.x * 0.22) + aSeed.y);
    float spread = (aSeed.z * 2.0 - 1.0);
    float body = pow(1.0 - t, 0.85);
    vec3 p;
    p.x = spread * 0.78 * body + sin(t * 7.0 + aSeed.w * 25.0) * 0.14 * t;
    p.y = -1.15 + t * 2.75 + pow(abs(spread), 2.0) * -0.25;
    p.z = (aSeed.w * 2.0 - 1.0) * 0.28 * body;
    vLife = t;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (0.5 * (1.0 - t * 0.6) * (0.5 + aSeed.x * 0.8)) * uPx / (0.414 * -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const flameFrag = /* glsl */`
  uniform float uGlow; varying float vLife;
  void main(){
    vec2 q = gl_PointCoord - .5; float d = length(q);
    float a = smoothstep(.5, .0, d);
    a *= a * smoothstep(0.0, .1, vLife) * (1.0 - vLife);
    vec3 col = mix(vec3(1.0,.58,.18), vec3(.95,.16,.03), vLife) * 1.5;
    gl_FragColor = vec4(col, a * uGlow * 0.22);
  }`;

const dustVert = /* glsl */`
  uniform float uTime; uniform float uPx;
  attribute float aSeed; varying float vA; varying float vMix;
  void main(){
    vec3 p = position;
    p.y += sin(uTime * 0.25 + aSeed * 40.0) * 0.35;
    p.x += cos(uTime * 0.2 + aSeed * 30.0) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    vA = smoothstep(75.0, 8.0, dist) * smoothstep(0.4, 3.0, dist) * (0.35 + 0.65 * fract(aSeed * 91.7));
    vMix = fract(aSeed * 13.3);
    gl_PointSize = clamp((1.2 + fract(aSeed * 57.0) * 3.2) * uPx * 14.0 / dist, 1.0, 14.0);
    gl_Position = projectionMatrix * mv;
  }`;
const dustFrag = /* glsl */`
  varying float vA; varying float vMix;
  void main(){
    float d = length(gl_PointCoord - .5);
    float a = smoothstep(.5, .05, d) * vA;
    vec3 col = mix(vec3(1.0,.95,.88), vec3(1.0,.45,.12), step(.55, vMix));
    gl_FragColor = vec4(col * (1.0 + step(.55, vMix)), a);
  }`;

function makeFlame(count, px) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: flameVert, fragmentShader: flameFrag,
    uniforms: { uTime: { value: 0 }, uPx: { value: px }, uGlow: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}


/* ---------- 3D flame emblem (swirl from the GEHU logo) ---------- */
function ribbonShape(pts, width, n = 90) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "catmullrom", 0.5);
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t), tg = curve.getTangent(t);
    const w = width(t) / 2;
    L.push(new THREE.Vector2(p.x - tg.y * w, p.y + tg.x * w));
    R.push(new THREE.Vector2(p.x + tg.y * w, p.y - tg.x * w));
  }
  const sh = new THREE.Shape();
  sh.moveTo(L[0].x, L[0].y);
  L.forEach((v) => sh.lineTo(v.x, v.y));
  R.reverse().forEach((v) => sh.lineTo(v.x, v.y));
  sh.closePath();
  return sh;
}
function buildEmblem() {
  const g = new THREE.Group();
  const ex = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 24 });
  const mat = (c, e, i) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: i, metalness: 0.25, roughness: 0.35 });
  const tip = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.0)), 0.75);
  // outer red swirl
  const swirl = [[0.12, 1.12], [-0.38, 0.55], [-0.66, -0.05], [-0.5, -0.68], [0.05, -0.98], [0.62, -0.84], [0.98, -0.42], [0.95, -0.02]];
  const outer = new THREE.Mesh(ex(ribbonShape(swirl, (t) => 0.36 * tip(t)), 0.1), mat(0xe5301f, 0xe5301f, 0.9));
  // inner orange swirl
  const swirl2 = [[0.2, 0.78], [-0.18, 0.3], [-0.34, -0.2], [-0.2, -0.62], [0.2, -0.78], [0.62, -0.6], [0.74, -0.3]];
  const inner = new THREE.Mesh(ex(ribbonShape(swirl2, (t) => 0.22 * tip(t)), 0.1), mat(0xff8a1a, 0xff7a10, 1.1));
  inner.position.z = 0.06;
  // bright core tongue
  const tongue = [[0.16, 0.55], [-0.02, 0.18], [-0.06, -0.2], [0.1, -0.44]];
  const core = new THREE.Mesh(ex(ribbonShape(tongue, (t) => 0.12 * tip(t)), 0.08), mat(0xffc15a, 0xffb040, 1.4));
  core.position.z = 0.12;
  // base bars
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.12), mat(0xe5301f, 0xe5301f, 1.0)); bar1.position.set(0.05, -1.14, 0.05);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.12), mat(0xff6a1a, 0xff6a1a, 1.0)); bar2.position.set(0.05, -1.27, 0.05);
  g.add(outer, inner, core, bar1, bar2);
  g.position.set(-0.05, 0.1, -0.06);
  g.scale.setScalar(0.92);
  return g;
}

function initScene() {
  const mobile = isMobile();
  const weak = mobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!(navigator.connection && navigator.connection.saveData);
  const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0908);
  scene.fog = new THREE.FogExp2(0x0b0908, 0.017);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 220);
  camera.position.set(0, 0, 11);

  /* lights */
  scene.add(new THREE.AmbientLight(0xffe6d0, 0.25));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.6); key.position.set(4, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5a1a, 2.2); rim.position.set(-6, -2, -4); scene.add(rim);

  /* gear (shared geometry + materials, instanced twice: hero + finale) */
  const gearGeo = buildGearGeometry();
  const metal = new THREE.MeshStandardMaterial({ color: 0x5a4d45, metalness: 0.9, roughness: 0.3, envMapIntensity: 2.2 });
  const lightMetal = new THREE.MeshStandardMaterial({ color: 0xcfc6bd, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.6 });
  const emissive = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.42, 0.1) });
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.7, 0.3) });
  const halo = glowTexture();
  const px = dpr * innerHeight / 2;   // point-size scale

  function makeGear(zPos) {
    const root = new THREE.Group();       // tilt / position
    const spin = new THREE.Group();       // continuous rotation around its axis
    const body = new THREE.Mesh(gearGeo, metal);
    spin.add(body);
    // light half-ring on the face (nod to the logo's light/dark split)
    const half = new THREE.Mesh(new THREE.RingGeometry(1.78, 2.5, 96, 1, 0.2, Math.PI), lightMetal);
    half.position.z = 0.4; spin.add(half);
    const half2 = half.clone(); half2.position.z = -0.4; half2.rotation.y = Math.PI; spin.add(half2);
    // glowing rims
    [[1.64, 0.035, 0.0], [2.58, 0.022, 0.42]].forEach(([r, tube, z]) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 160), emissive);
      m.position.z = z; spin.add(m);
      if (z) { const m2 = m.clone(); m2.position.z = -z; spin.add(m2); }
    });
    const inner = new THREE.Mesh(new THREE.TorusGeometry(1.64, 0.035, 12, 160), emissive);
    spin.add(inner);
    root.add(spin);

    // flame + halo, stays upright inside the hole
    const emblem = buildEmblem();
    root.add(emblem);
    const flame = makeFlame(mobile ? 600 : 1200, px);
    flame.position.z = 0.0;
    root.add(flame);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    core.scale.set(3.8, 3.8, 1); core.position.z = -0.35; root.add(core);
    const light = new THREE.PointLight(0xff6a1a, 40, 22, 1.6); light.position.set(0, 0, 1.4); root.add(light);

    root.position.z = zPos;
    scene.add(root);
    return { root, spin, flame, core, light, emblem };
  }
  const gearA = makeGear(0);
  const gearB = makeGear(-92); gearB.root.scale.setScalar(1.3);

  /* dust / embers tunnel */
  const N = mobile ? 2600 : 6500;
  const pos = new Float32Array(N * 3), sd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 2.6 + Math.pow(Math.random(), 0.6) * 18;
    pos[i * 3] = Math.cos(ang) * r;
    pos[i * 3 + 1] = Math.sin(ang) * r * 0.75;
    pos[i * 3 + 2] = 16 - Math.random() * 120;
    sd[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(sd, 1));
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: dustVert, fragmentShader: dustFrag,
    uniforms: { uTime: { value: 0 }, uPx: { value: dpr } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);

  /* photo corridor */
  const photos = [
    { src: "img/campus.webp", x: -2.9, z: -15, ry: 0.32 },
    { src: "img/graf.webp",   x:  2.9, z: -25, ry: -0.32 },
    { src: "img/cer.webp",    x: -3.4, z: -35, ry: 0.32 },
    { src: "img/sport.webp",  x:  2.9, z: -45, ry: -0.32 },
  ];
  const loader = new THREE.TextureLoader(manager);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const photoGroup = new THREE.Group(); scene.add(photoGroup);
  const photoMeshes = photos.map((p, i) => {
    const grp = new THREE.Group();
    const frameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.4, 0.1), transparent: true, opacity: 0.9 });
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), frameMat);
    frame.position.z = -0.03;
    grp.add(frame, mesh);
    grp.position.set(innerWidth < innerHeight ? p.x * 0.42 : p.x, 0, p.z); grp.rotation.y = p.ry;
    photoGroup.add(grp);
    const portrait = innerWidth < innerHeight;
    const H = portrait ? 3.5 : 4.6;
    mesh.scale.set(H * 0.75, H, 1); frame.scale.set(H * 0.75 + 0.1, H + 0.1, 1);
    loader.load(p.src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
      mat.map = tex; mat.needsUpdate = true;
      const ar = tex.image.width / tex.image.height;
      const h = ar > 1 ? H * 0.78 : H;
      mesh.scale.set(h * ar, h, 1); frame.scale.set(h * ar + 0.1, h + 0.1, 1);
    });
    return { grp, base: p };
  });

  /* post-processing */
  let composer = null, bloom = null;
  const usePost = !weak;
  if (usePost) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(dpr, 1.5));
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.7, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  gl = { renderer, scene, camera, composer, bloom, gearA, gearB, dustMat, dustGeo, photoMeshes, photos, px, dpr, useBloom: usePost, pr: dpr };
  if (weak) applyTier(1); // start conservatively on constrained devices
}

/* ============================================================
   Camera keyframes driven by scroll through the page sections
   ============================================================ */
const sectionEls = $$("[data-section]");
let tops = [];
function measure() {
  tops = sectionEls.map((el) => {
    const host = el.parentElement && el.parentElement.classList.contains("pin-spacer") ? el.parentElement : el;
    return host.getBoundingClientRect().top + window.scrollY;
  });
  const foot = $("#contact");
  tops.push(foot.getBoundingClientRect().top + window.scrollY);
  tops[0] = 0;
}

// [camX, camY, camZ, lookX, lookY, lookZ, gearRotX, gearRotY, gearScale, flameGlow, bloom]
function keyframes() {
  const w = innerWidth, h = innerHeight, wide = w > h * 1.05;
  const ox = wide ? 2.35 : 0, oy = wide ? 0 : -4.6;
  const camBack = wide ? 11 : 23;
  const fy = wide ? 0 : -4.6;
  return [
    [-ox, 0.1, camBack, -ox, oy, 0,   0.22, -0.5, 1.0, 1.0, 0.62], // 0 hero
    [0, 0.6, 15, 0, 0, 0,             0.15, 0.7,  0.9, 0.7, 0.55], // 1 about
    [0, -0.8, 18, 0, 0, 0,            0.95, 0.25, 0.85, 0.5, 0.5], // 2 departments
    [0, 0, 8.5, 0, 0, -8,             0.0, 0.0,   1.0, 1.0, 0.7],  // 3 corridor start
    [0, 0, -52, 0, 0, -70,            0, 0, 1, 1, 0.7],            // 4 corridor end / programs
    [0.8, 0.5, -57, 0, 0, -80,        0, 0, 1, 1, 0.65],           // 5 journey
    [-0.8, 0, -61, 0, 0, -80,         0, 0, 1, 1, 0.65],           // 6 outcomes
    [0, 0.6, -65, 0, 0, -82,          0, 0, 1, 1, 0.65],           // 7 team
    [0, 0, -69, 0, 0, -84,            0, 0, 1, 1, 0.65],           // 8 help
    [-ox, 0, -79, -ox, fy, -92,       0, -0.1, 1, 1, 0.75],        // 9 admissions (arrival)
    [-ox, 0, -80, -ox, fy, -92,       0, -0.1, 1, 1, 0.75],        // 10 footer
  ];
}
const EASE = [smooth, smooth, smooth, (t) => t, (t) => t, smooth, smooth, smooth, smooth, smooth];
let KF = keyframes();

const cur = new Array(11).fill(0); let curInit = false;
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });

function sceneState() {
  if (tops.length < 3) return { v: KF[0], seg: 0, t: 0 };
  const y = scrollY();
  let i = 0;
  while (i < tops.length - 2 && y >= tops[i + 1]) i++;
  const span = Math.max(1, tops[i + 1] - tops[i]);
  const t = clamp((y - tops[i]) / span);
  const k = EASE[i](t);
  const a = KF[i], b = KF[i + 1];
  return { v: a.map((v, n) => lerp(v, b[n], k)), seg: i, t };
}

const corridorEl = $("#campus");
const caps = $$(".cap", $("#corridorCaps"));
const corNow = $("#corNow");
const corHead = $(".corridor-head");
let capIdx = -1;


/* ---------- adaptive quality ---------- */
const Q = { tier: 2, acc: 0, frames: 0, settled: 0 };
function applyTier(tier) {
  Q.tier = tier;
  if (!gl) return;
  const { renderer, composer, dustGeo, gearA, gearB } = gl;
  const base = Math.min(devicePixelRatio || 1, 1.75);
  const pr = tier >= 2 ? base : tier === 1 ? Math.min(base, 1.25) : 1;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  composer && composer.setPixelRatio(Math.min(pr, 1.5));
  composer && composer.setSize(innerWidth, innerHeight);
  gl.pr = pr;
  gl.useBloom = tier >= 2;
  const frac = tier >= 2 ? 1 : tier === 1 ? 0.6 : 0.3;
  dustGeo.setDrawRange(0, Math.floor(dustGeo.getAttribute("position").count * frac));
  [gearA, gearB].forEach((g) => g.flame.geometry.setDrawRange(0, Math.floor(g.flame.geometry.getAttribute("position").count * (tier >= 2 ? 1 : 0.5))));
}
function sampleFrame(dt) {
  // after intro settles, watch the average frame time; step quality down (never back up)
  if (!gl || Q.tier === 0 || document.hidden) return;
  Q.settled += dt;
  if (Q.settled < 2.5) return;
  Q.acc += dt; Q.frames++;
  if (Q.frames >= 50) {
    const avg = Q.acc / Q.frames;
    if (avg > 1 / 38) applyTier(Q.tier - 1);
    Q.acc = 0; Q.frames = 0; Q.settled = 1.5;
  }
}

const clock = new THREE.Clock();
function frame() {
  const rawDt = clock.getDelta();
  if (document.hidden) return;
  const dt = Math.min(rawDt, 0.05);
  sampleFrame(rawDt);
  const time = clock.elapsedTime;
  const st = sceneState();
  const damp = 1 - Math.exp(-dt * (reduceMotion ? 30 : 5.5));
  if (!curInit) { st.v.forEach((v, n) => (cur[n] = v)); curInit = true; }
  else st.v.forEach((v, n) => (cur[n] += (v - cur[n]) * damp));

  mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 3));
  mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 3));

  if (gl) {
    const { camera, gearA, gearB, dustMat, photoMeshes, composer, renderer, scene, bloom } = gl;
    const inCorridor = st.seg === 3;
    const sway = inCorridor ? Math.sin(cur[2] * 0.18) * 0.55 : 0;
    camera.position.set(cur[0] + mouse.sx * 0.9 + sway, cur[1] - mouse.sy * 0.6, cur[2]);
    camera.lookAt(cur[3] + mouse.sx * 0.5 + sway * 0.4, cur[4] - mouse.sy * 0.3, cur[5]);
    camera.rotation.z += (inCorridor ? Math.sin(cur[2] * 0.12) * 0.035 : 0);

    const spin = reduceMotion ? 0 : time * 0.12 + scrollY() * 0.0009;
    [gearA, gearB].forEach((g, n) => {
      g.spin.rotation.z = spin * (n ? -1 : 1);
      g.flame.material.uniforms.uTime.value = time;
    });
    gearA.root.rotation.set(cur[6] + mouse.sy * 0.25, cur[7] + mouse.sx * 0.4, 0);
    gearA.root.scale.setScalar(cur[8]);
    [gearA, gearB].forEach((g, n) => {
      g.emblem.rotation.y = Math.sin(time * 0.7 + n) * 0.38 + mouse.sx * 0.5;
      g.emblem.rotation.x = Math.sin(time * 0.5) * 0.08 - mouse.sy * 0.2;
      g.emblem.position.y = 0.1 + Math.sin(time * 1.1 + n) * 0.04;
    });
    gearA.flame.material.uniforms.uGlow.value = cur[9] * 0.8;
    gearA.core.material.opacity = 0.12 + cur[9] * 0.28;
    gearA.light.intensity = 40 * cur[9];
    gearB.root.rotation.set(cur[6] * 0 + mouse.sy * 0.25, cur[7] + mouse.sx * 0.4, 0);
    dustMat.uniforms.uTime.value = time;

    const pv = clamp((8 - camera.position.z) / 6);
    photoMeshes.forEach((p, n) => {
      p.grp.visible = pv > 0;
      p.grp.children.forEach((m) => { m.material.transparent = true; m.material.opacity = (m.position.z < 0 ? 0.9 : 1) * pv; });
      p.grp.position.y = (innerWidth < innerHeight ? 1.1 : 0) + Math.sin(time * 0.6 + n * 1.7) * 0.18;
      p.grp.rotation.y = p.base.ry + Math.sin(time * 0.35 + n) * 0.04 + mouse.sx * 0.12;
    });
    if (bloom) bloom.strength = cur[10];
    gearA.flame.material.uniforms.uPx.value = gearB.flame.material.uniforms.uPx.value = gl.dpr * innerHeight / 2;
    gl.useBloom && composer ? composer.render() : renderer.render(scene, camera);

    // corridor UI (captions follow where the camera is in 3D)
    const camZ = camera.position.z;
    let idx = 0;
    for (let n = 0; n < gl.photos.length; n++) if (camZ < gl.photos[n].z + 6) idx = n;
    if (idx !== capIdx) {
      capIdx = idx;
      caps.forEach((c, n) => c.classList.toggle("is-on", n === idx));
      corNow.textContent = String(idx + 1).padStart(2, "0");
    }
  }
  if (corHead) {
    const ct = st.seg === 3 ? st.t : st.seg < 3 ? 0 : 1;
    const o = 1 - smooth(clamp((ct - 0.04) / 0.1));
    corHead.style.opacity = o.toFixed(3);
    corHead.style.transform = `translateY(${(1 - o) * -30}px)`;
  }
}

function resize() {
  if (gl) {
    const { renderer, camera, composer } = gl;
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    composer && composer.setSize(innerWidth, innerHeight);
  }
  KF = keyframes();
  measure();
}

/* ============================================================
   DOM animation
   ============================================================ */
function splitWords() {
  $$(".split").forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(" ");
  });
}

function setupDOM() {
  splitWords();

  // headings
  $$(".split").forEach((el) => {
    gsap.from($$(".w > span", el), {
      yPercent: 115, duration: 1.1, ease: "power4.out", stagger: 0.06,
      scrollTrigger: { trigger: el, start: "top 86%", once: true },
    });
  });

  // fade-up (batched so grids stagger)
  ScrollTrigger.batch(".fade-up", {
    start: "top 90%", once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.1, overwrite: true, clearProps: "transform" }),
  });

  // counters
  $$("[data-count]").forEach((el) => {
    const end = +el.dataset.count, suf = el.dataset.suffix || "";
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: "power2.out", onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString("en-IN") + suf) }),
    });
  });

  // horizontal journey on desktop
  const mm = gsap.matchMedia();
  mm.add("(min-width: 961px)", () => {
    const track = $("#journeyTrack");
    const dist = () => Math.max(0, track.scrollWidth - innerWidth + 40);
    gsap.to(track, {
      x: () => -dist(), ease: "none",
      scrollTrigger: { trigger: ".journey", start: "top top", end: () => "+=" + dist(), pin: true, scrub: true, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    gsap.from(".step", { opacity: 0, y: 60, stagger: 0.12, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".journey", start: "top 70%", once: true } });
  });
  mm.add("(max-width: 960px)", () => {
    gsap.from(".step", { opacity: 0, y: 50, stagger: 0.1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".journey-track", start: "top 85%", once: true } });
  });

  // CTA title parallax
  gsap.from(".cta-inner > *", { opacity: 0, y: 50, stagger: 0.12, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: ".cta", start: "top 60%", once: true } });

  // progress bar
  const bar = $("#progress b");
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (s) => (bar.style.transform = `scaleX(${s.progress})`) });

  // nav: scrolled state + hide on scroll down
  const nav = $("#nav");
  let last = 0;
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (s) => {
      const y = s.scroll();
      nav.classList.toggle("scrolled", y > 40);
      nav.classList.toggle("hide", y > last && y > 400 && !$("#navLinks").classList.contains("open"));
      last = y;
    },
  });

  // active nav links
  $$("#navLinks a[href^='#']").forEach((a) => {
    const t = $(a.getAttribute("href"));
    if (!t) return;
    ScrollTrigger.create({ trigger: t, start: "top 55%", end: "bottom 55%", onToggle: (s) => a.classList.toggle("active", s.isActive) });
  });
}

/* tilt cards, magnetic buttons, cursor */
function setupInteractions() {
  if (finePointer && !reduceMotion) {
    $$(".tilt").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", ((px - 0.5) * 14).toFixed(2) + "deg");
        el.style.setProperty("--rx", ((0.5 - py) * 12).toFixed(2) + "deg");
        el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        el.classList.add("is-tilting");
      });
      el.addEventListener("pointerleave", () => {
        el.classList.remove("is-tilting");
        el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
      });
    });
    $$("[data-magnetic]").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
    const cur = $("#cursor");
    const cx = gsap.quickTo(cur, "x", { duration: 0.25, ease: "power3.out" });
    const cy = gsap.quickTo(cur, "y", { duration: 0.25, ease: "power3.out" });
    addEventListener("pointermove", (e) => { cur.classList.add("on"); cx(e.clientX); cy(e.clientY); }, { passive: true });
    document.addEventListener("pointerover", (e) => cur.classList.toggle("big", !!e.target.closest("a,button,.tilt")));
    document.addEventListener("pointerleave", () => cur.classList.remove("on"));
  }

  // anchors -> smooth scroll
  $$("a[href^='#']").forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const t = id === "#top" ? 0 : $(id);
      if (t === null) return;
      e.preventDefault();
      closeMenu();
      let target = t;
      if (t !== 0 && t.classList.contains("corridor")) target = t.getBoundingClientRect().top + window.scrollY;
      lenis ? lenis.scrollTo(target, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) }) : window.scrollTo({ top: typeof target === "number" ? target : target.getBoundingClientRect().top + scrollY(), behavior: "smooth" });
    });
  });

  // mobile menu
  const burger = $("#burger"), links = $("#navLinks");
  window.closeMenu = () => { burger.setAttribute("aria-expanded", "false"); links.classList.remove("open"); lenis && lenis.start(); };
  burger.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", String(open));
    links.classList.toggle("open", open);
    lenis && (open ? lenis.stop() : lenis.start());
  });

  // login button (nav-auth.js swaps it for a user menu when signed in)
  const sb = $("#studentBtn");
  if (sb && !$("#navUserDrop")) sb.addEventListener("click", () => (window.gehuGo ? window.gehuGo("login.html") : (location.href = "login.html")));
}
const closeMenu = () => window.closeMenu && window.closeMenu();

/* intro */
function playIntro() {
  document.body.classList.remove("is-loading");
  loaderEl.classList.add("done");
  const tl = gsap.timeline({ delay: 0.35 });
  tl.from(".hero-title .word", { yPercent: 118, duration: 1.4, ease: "power4.out", stagger: 0.12 }, 0)
    .to(".reveal-line", { opacity: 1, duration: 1, stagger: 0.12, ease: "power2.out" }, 0.25)
    .from(".nav", { yPercent: -100, duration: 1, ease: "power3.out", clearProps: "transform" }, 0.4);
}

/* ============================================================
   Boot
   ============================================================ */
(async function boot() {
  setProgress(8);
  const ok = webglOK();
  if (ok) {
    try { initScene(); } catch (err) { console.warn("WebGL scene failed:", err); gl = null; }
  }
  if (!gl) { document.documentElement.classList.add("no-gl"); canvas.style.display = "none"; setProgress(90); }

  setupDOM();
  setupInteractions();
  let rf; initHelp(() => { clearTimeout(rf); rf = setTimeout(() => ScrollTrigger.refresh(), 200); });
  measure();
  ScrollTrigger.addEventListener("refresh", measure);
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { resize(); ScrollTrigger.refresh(); }, 150); });
  gsap.ticker.add(frame);

  // wait for textures (manager) or timeout, plus a minimum splash time
  const minWait = new Promise((r) => setTimeout(r, reduceMotion ? 200 : 1400));
  const assets = new Promise((res) => {
    if (!gl) return res();
    assetsDone.then(res);
    setTimeout(res, 8000);
  });
  await Promise.all([minWait, assets]);
  setProgress(100);
  await new Promise((r) => setTimeout(r, 450));
  clearInterval(loaderTick);
  loaderNum.textContent = "100"; loaderBar.style.transform = "scaleX(1)";
  ScrollTrigger.refresh();
  resize();
  playIntro();
  if (location.hash && $(location.hash)) {
    const h = $(location.hash);
    setTimeout(() => { const y = h.getBoundingClientRect().top + window.scrollY; lenis ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y); }, 80);
  }
  window.__ready = true;
})();
