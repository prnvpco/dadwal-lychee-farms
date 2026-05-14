import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
gsap.registerPlugin(ScrollTrigger);

// ─── RENDERER ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 5);

const clearColor = new THREE.Color(0x110403);
renderer.setClearColor(clearColor);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  mobileScale = window.innerWidth < 768 ? 0.55 : 1;
}, { passive: true });

// ─── POST-PROCESSING (BLOOM) ───────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.14,   // strength — whisper-light glow
  0.28,   // radius — stays on the model, won't flood background
  0.95    // threshold — only absolute specular highlights (95%+ brightness)
);
composer.addPass(bloomPass);

// ─── LIGHTS ────────────────────────────────────────────────────────────────

const ambientLight = new THREE.AmbientLight(0xffe0cc, 0.55);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffc060, 4.5);
keyLight.position.set(3, 4, 3);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xff4422, 2.8);
rimLight.position.set(-4, 0.5, -2);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0xffaa44, 2.5, 14);
fillLight.position.set(0, -3, 4);
scene.add(fillLight);

const topLight = new THREE.PointLight(0xffd080, 1.5, 10);
topLight.position.set(0, 5, 2);
scene.add(topLight);

// ─── PARTICLES ─────────────────────────────────────────────────────────────

const pCount = 280;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(pCount * 3);
for (let i = 0; i < pCount; i++) {
  pPos[i * 3]     = (Math.random() - 0.5) * 18;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  color: 0xffcc88, size: 0.03, transparent: true, opacity: 0.5, sizeAttenuation: true,
}));
scene.add(particles);

// ─── SECTION CONFIGS ───────────────────────────────────────────────────────

const panels = [...document.querySelectorAll('.panel')];
const configs = panels.map(p => ({
  lx:  parseFloat(p.dataset.lx  ?? 0),
  ly:  parseFloat(p.dataset.ly  ?? 0),
  ls:  parseFloat(p.dataset.ls  ?? 1),
  bgR: parseInt(p.dataset.br ?? 17),
  bgG: parseInt(p.dataset.bg ?? 4),
  bgB: parseInt(p.dataset.bb ?? 3),
}));

const bgColors = [
  ...configs.map(c => ({ r: c.bgR, g: c.bgG, b: c.bgB })),
  { r: 5, g: 2, b: 1 },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── LYCHEE PROXY ──────────────────────────────────────────────────────────

const proxy = { x: configs[0].lx, y: configs[0].ly, s: configs[0].ls };
const TARGET_DIAMETER = 3.5;
let baseScale = 1;
let loaded = false;
let autoRotY = 0;
let targetMX = 0, targetMY = 0;
let mouseX = 0, mouseY = 0;
let mobileScale = window.innerWidth < 768 ? 0.55 : 1;

// ─── PRELOADER ─────────────────────────────────────────────────────────────
const preStartTime = Date.now();
function updatePreloader(pct) {
  const bar = document.getElementById('pre-bar');
  if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
}
function hidePreloader() {
  const pre = document.getElementById('preloader');
  if (!pre) return;
  const delay = Math.max(0, 900 - (Date.now() - preStartTime));
  setTimeout(() => {
    pre.classList.add('hidden');
    setTimeout(() => pre.remove(), 750);
  }, delay);
}

const lycheeWrapper = new THREE.Group();
scene.add(lycheeWrapper);

// ─── LOAD MODEL ────────────────────────────────────────────────────────────

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load('./lychee_1.glb',
  (gltf) => {
    const model = gltf.scene;

    model.scale.setScalar(1);
    const box0 = new THREE.Box3().setFromObject(model);
    const size0 = box0.getSize(new THREE.Vector3());
    baseScale = 1 / Math.max(size0.x, size0.y, size0.z);
    model.scale.setScalar(baseScale);

    const box1 = new THREE.Box3().setFromObject(model);
    const center = box1.getCenter(new THREE.Vector3());
    model.position.sub(center);

    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    lycheeWrapper.add(model);
    loaded = true;

    // Set initial position immediately
    lycheeWrapper.position.set(proxy.x, proxy.y, 0);
    lycheeWrapper.scale.setScalar(TARGET_DIAMETER * proxy.s * mobileScale);

    setupScrollAnimations();
    hidePreloader();
  },
  (xhr) => { updatePreloader(xhr.loaded / xhr.total); },
  (err) => console.error('GLB error', err)
);

// ─── SCROLL ANIMATIONS (lychee zig-zag) ───────────────────────────────────
// Single timeline driven by one ScrollTrigger — the only correct GSAP
// pattern for multi-step scrub. Separate per-panel tweens all captured
// proxy.x at creation time (= hero value), causing instant snaps.

function setupScrollAnimations() {
  // Build a timeline where each "step" = one section transition.
  // scrub: 2.5 means the lychee lags 2.5s behind scroll — creates
  // the floating, floaty feel instead of mechanical 1:1 tracking.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 2.5,
    },
  });

  // Each segment has equal duration so they share the scroll distance evenly.
  // ease: 'sine.inOut' gives a smooth slow-in / slow-out through each position.
  panels.slice(1).forEach((_, i) => {
    const cfg = configs[i + 1];
    tl.to(proxy, {
      x: cfg.lx,
      y: cfg.ly,
      s: cfg.ls,
      duration: 1,
      ease: 'sine.inOut',
    });
  });
}

// ─── CONTENT REVEAL ANIMATIONS ─────────────────────────────────────────────
// These are pure HTML/CSS animations — run immediately, independent of model load

function initAnimations() {
  // Hero text is handled by CSS @keyframes (compositor-thread, never throttled).

  // Wrap h2 elements for clip-path reveal
  document.querySelectorAll('.panel-card h2, .quality-header h2, .gallery-intro h2').forEach(h2 => {
    h2.classList.add('h2-reveal');
  });

  // ── IntersectionObserver for all content reveals ──
  // CSS transitions do the animation; IntersectionObserver triggers them.
  // This works regardless of RAF throttling in background tabs.
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;

      if (el.classList.contains('q-item')) {
        // Stagger siblings within the quality grid
        const siblings = [...document.querySelectorAll('.q-item')];
        const idx = siblings.indexOf(el);
        el.style.transitionDelay = `${idx * 0.08}s`;
      }

      el.classList.add('revealed');
      io.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  // Panel cards — mark direction class before observing
  document.querySelectorAll('.panel-card').forEach(card => {
    if (card.dataset.from === 'left') card.classList.add('from-left');
    io.observe(card);
  });

  // Quality header
  io.observe(document.querySelector('.quality-header'));

  // Quality items
  document.querySelectorAll('.q-item').forEach(item => {
    if (item.dataset.from === 'left') item.classList.add('from-left');
    io.observe(item);
  });

  // Gallery section
  const galleryIntro = document.querySelector('.gallery-intro');
  if (galleryIntro) io.observe(galleryIntro);
  document.querySelectorAll('.pm-featured, .pm-card').forEach(el => io.observe(el));

  // ── Stat counters (GSAP number animation, triggered by IO) ──
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const isYear = target > 100;
      const obj = { v: isYear ? target - 8 : 0 };
      gsap.to(obj, {
        v: target, duration: 1.6, ease: 'power2.out',
        onUpdate() { el.textContent = Math.round(obj.v) + suffix; },
      });
      counterIO.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => counterIO.observe(el));
}

// ─── NAV + PROGRESS ────────────────────────────────────────────────────────

const nav = document.getElementById('nav');
const progressFill = document.getElementById('progress-fill');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
  const p = window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  if (progressFill) progressFill.style.transform = `scaleX(${p})`;
}, { passive: true });

window.addEventListener('mousemove', e => {
  mouseX =  (e.clientX / window.innerWidth  - 0.5) * 2;
  mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

// ─── RENDER LOOP ────────────────────────────────────────────────────────────

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Smooth mouse
  targetMX += (mouseX * 0.25 - targetMX) * 0.04;
  targetMY += (mouseY * 0.12 - targetMY) * 0.04;

  // Background colour blend across sections
  const scrolled = window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const sp = clamp(scrolled * bgColors.length, 0, bgColors.length - 1);
  const si = Math.min(Math.floor(sp), bgColors.length - 2);
  const sf = sp - si;
  clearColor.setRGB(
    lerp(bgColors[si].r, bgColors[si + 1].r, sf) / 255,
    lerp(bgColors[si].g, bgColors[si + 1].g, sf) / 255,
    lerp(bgColors[si].b, bgColors[si + 1].b, sf) / 255,
  );
  renderer.setClearColor(clearColor);

  // Apply proxy → lychee wrapper
  if (loaded) {
    autoRotY += 0.0045;
    const floatY = Math.sin(t * 0.55) * 0.07;

    lycheeWrapper.position.x = proxy.x + targetMX * 0.18;
    lycheeWrapper.position.y = proxy.y + floatY + targetMY * 0.08;
    lycheeWrapper.rotation.y = autoRotY + targetMX * 0.22;
    lycheeWrapper.rotation.x = Math.sin(t * 0.35) * 0.04 + targetMY * 0.1;
    lycheeWrapper.rotation.z = targetMX * 0.04;
    lycheeWrapper.scale.setScalar(TARGET_DIAMETER * proxy.s * mobileScale);
  }

  particles.rotation.y = t * 0.014;
  particles.rotation.x = t * 0.007;

  fillLight.intensity = 2.5 + Math.sin(t * 0.7) * 0.5;
  fillLight.position.x = Math.sin(t * 0.4) * 1.5;
  fillLight.position.z = Math.cos(t * 0.3) * 1.5 + 3;

  composer.render();
}

animate();

// ─── KICK OFF CONTENT ANIMATIONS ───────────────────────────────────────────
// Run after DOM is ready (module scripts are deferred, so DOM is already parsed)
initAnimations();
