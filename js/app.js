// Klamp Studio — 3D editor for Kee Klamp-style pipe structures.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as M from './model.js';

const S = 0.001; // mm → scene metres
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// ---------------------------------------------------------------- icons
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  more: '<circle cx="12" cy="12" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  cube: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  pipe: '<path d="M5 21V11a6 6 0 0 1 6-6h10"/><path d="M2 21h6M21 2v6"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
  merge: '<path d="M4 12h16"/><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  open: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  socket: '<circle cx="12" cy="12" r="4"/><path d="M12 2v6M12 16v6M2 12h6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  logo: '<path d="M4 20V8M4 8h16M20 8v12M4 14h16"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

// ---------------------------------------------------------------- storage
const LS_INDEX = 'klamp.index', LS_CUR = 'klamp.current', LS_SEEN = 'klamp.seenHelp';
const LS_DESIGN = (id) => 'klamp.d.' + id;
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
const loadIndex = () => { try { return JSON.parse(lsGet(LS_INDEX)) || []; } catch { return []; } };
const saveIndex = (ix) => lsSet(LS_INDEX, JSON.stringify(ix));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const guessUnits = () => (/^en-(US|LR|MM)/i.test(navigator.language || 'en-US') ? 'in' : 'mm');

// ---------------------------------------------------------------- state
let designId = null;
let model = M.newModel(guessUnits());
let undoStack = [], redoStack = [];
let sel = null; // { t: 'node'|'pipe', id }
let mode = 'extend'; // node selection: 'extend' (draw) | 'move'
let tool = 'select'; // 'select' | 'point'
let labelsOn = false;
let preview = null; // model shown while dragging
let lastCls = new Map(), lastById = new Map();
let dirty = true;

const fmt = (mm) => M.fmtLen(mm, model.settings.units);
const sizeInfo = () => M.SIZES[model.settings.size] || M.SIZES['7'];
const sizeLabel = (u = model.settings.units) => {
  const z = sizeInfo();
  return u === 'in' ? `Size ${z.code} · ${z.nps} pipe (${z.odIn} OD)` : `Size ${z.code} · ${z.od} mm OD`;
};

// ---------------------------------------------------------------- three.js setup
const canvas = $('c');
// Registered before OrbitControls so gizmo drags can stop the camera from orbiting.
canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerCancel);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef2f7);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 300);
camera.position.set(2.6, 2.0, 3.2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.14;
controls.rotateSpeed = 0.9;
controls.target.set(0, 0.4, 0);
controls.minDistance = 0.15;
controls.maxDistance = 80;
controls.maxPolarAngle = Math.PI * 0.97;
controls.addEventListener('change', () => { dirty = true; });

const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c6d4, 0.9);
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.015;
scene.add(hemi, sun, sun.target);

const mats = {
  pipe: new THREE.MeshStandardMaterial({ color: 0xc9cfd5, metalness: 0.8, roughness: 0.3 }),
  pipeSel: new THREE.MeshStandardMaterial({ color: 0x8fbaff, metalness: 0.5, roughness: 0.35, emissive: 0x1f5fd6, emissiveIntensity: 0.45 }),
  pipeHi: new THREE.MeshStandardMaterial({ color: 0xffc9a6, metalness: 0.5, roughness: 0.35, emissive: 0xb84a00, emissiveIntensity: 0.25 }),
  fit: new THREE.MeshStandardMaterial({ color: 0x9ea7b0, metalness: 0.65, roughness: 0.48 }),
  fitSel: new THREE.MeshStandardMaterial({ color: 0x6fa3ff, metalness: 0.4, roughness: 0.4, emissive: 0x1f5fd6, emissiveIntensity: 0.5 }),
  fitHi: new THREE.MeshStandardMaterial({ color: 0xffb27f, metalness: 0.45, roughness: 0.45, emissive: 0xb84a00, emissiveIntensity: 0.25 }),
  screw: new THREE.MeshStandardMaterial({ color: 0x2c3238, metalness: 0.6, roughness: 0.4 }),
  plug: new THREE.MeshStandardMaterial({ color: 0x41474e, metalness: 0.4, roughness: 0.55 }),
  point: new THREE.MeshStandardMaterial({ color: 0x1f6feb, metalness: 0.1, roughness: 0.5 }),
  marker: new THREE.MeshBasicMaterial({ color: 0x1f6feb, transparent: true, opacity: 0.28, depthWrite: false }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
};
const G = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 28, 1),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 12, 1),
  sph: new THREE.SphereGeometry(1, 24, 16),
  sleeve: new THREE.LatheGeometry([[0.82, 0], [0.97, 0.05], [1, 0.12], [1, 0.88], [0.97, 0.95], [0.82, 1]].map(([x, y]) => new THREE.Vector2(x, y - 0.5)), 32),
  hitCyl: new THREE.CylinderGeometry(1, 1, 1, 8, 1),
  hitSph: new THREE.SphereGeometry(1, 10, 8),
  cone: new THREE.ConeGeometry(0.17, 0.42, 20),
};

const world = new THREE.Group();
const modelG = new THREE.Group();
const hitG = new THREE.Group();
const gridG = new THREE.Group();
world.add(gridG, modelG, hitG);
scene.add(world);

const Yup = new THREE.Vector3(0, 1, 0);
const vecOf = (d) => new THREE.Vector3(...M.DIRS[d]);
const v3 = (n) => new THREE.Vector3(n.x * S, n.y * S, n.z * S);
const AXIS_COLORS = { x: 0xe5484d, y: 0x2f9e5b, z: 0x1f6feb };

function part(group, geom, mat, pos, axis, sx, sy, sz, shadow = true) {
  const m = new THREE.Mesh(geom, mat);
  m.position.copy(pos);
  if (axis) m.quaternion.setFromUnitVectors(Yup, axis);
  m.scale.set(sx, sy, sz);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  group.add(m);
  return m;
}

// ---------------------------------------------------------------- scene building
function buildFitting(n, k, R, mat, isSel) {
  const o = v3(n);
  const sr = R * 1.32, sl = R * 2.1, off = R * 0.35;
  const perpOf = (v) => (Math.abs(v.y) > 0.5 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
  const screw = (at, v) => {
    const p = perpOf(v);
    part(modelG, G.cylLo, mats.screw, at.clone().addScaledVector(p, sr * 0.97), p, R * 0.3, R * 0.42, R * 0.3);
  };
  const socket = (d) => {
    const v = vecOf(d);
    part(modelG, G.sleeve, mat, o.clone().addScaledVector(v, off + sl / 2), v, sr, sl, sr);
    screw(o.clone().addScaledVector(v, off + sl * 0.6), v);
  };
  const through = (axis, len) => {
    const v = vecOf('+' + axis);
    part(modelG, G.sleeve, mat, o, v, sr, len, sr);
    screw(o.clone().addScaledVector(v, len * 0.3), v);
    screw(o.clone().addScaledVector(v, -len * 0.3), v);
  };

  if (k.kind === 'fitting') {
    if (k.code === '14') { through(k.pairs[0], sl * 2.2); return; }
    part(modelG, G.sph, mat, o, null, sr * 1.12, sr * 1.12, sr * 1.12);
    for (const d of k.dirs) if (!(k.thru && d[1] === k.thru)) socket(d);
    if (k.thru) through(k.thru, (off + sl) * 2);
  } else if (k.kind === 'flange') {
    const t = R * 0.36;
    part(modelG, G.cyl, mat, o.clone().add(new THREE.Vector3(0, t / 2, 0)), Yup, R * 3.1, t, R * 3.1);
    part(modelG, G.sleeve, mat, o.clone().add(new THREE.Vector3(0, t + sl / 2, 0)), Yup, sr, sl, sr);
    screw(o.clone().add(new THREE.Vector3(0, t + sl * 0.6, 0)), Yup);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      part(modelG, G.cylLo, mats.screw, o.clone().add(new THREE.Vector3(Math.cos(a) * R * 2.3, t + R * 0.02, Math.sin(a) * R * 2.3)), Yup, R * 0.32, R * 0.06, R * 0.32, false);
    }
  } else if (k.kind === 'plug') {
    const v = vecOf(k.dirs[0]).negate();
    part(modelG, G.cyl, mats.plug, o.clone().addScaledVector(v, R * 0.1), v, R * 1.07, R * 0.22, R * 1.07);
    part(modelG, G.sph, mats.plug, o.clone().addScaledVector(v, R * 0.2), v, R * 1.0, R * 0.32, R * 1.0);
  } else if (k.kind === 'point') {
    part(modelG, G.sph, isSel ? mats.fitSel : mats.point, o, null, R * 1.5, R * 1.5, R * 1.5);
  }
  if (isSel && (k.kind === 'open' || k.kind === 'inline' || k.kind === 'point')) {
    part(modelG, G.sph, mats.marker, o, null, R * 2.4, R * 2.4, R * 2.4, false);
  }
}

function rebuild() {
  const m = preview || model;
  modelG.clear();
  hitG.clear();
  const { byId, cls } = M.classifyAll(m);
  lastCls = cls; lastById = byId;
  const R = (M.SIZES[m.settings.size] || M.SIZES['7']).od / 2 * S;
  let hl = null;
  if (!preview && sel?.t === 'node' && mode === 'move' && byId.has(sel.id)) hl = M.componentOf(m, sel.id);

  for (const p of m.pipes) {
    const A = byId.get(p.a), B = byId.get(p.b);
    const a = v3(A), b = v3(B);
    const len = a.distanceTo(b);
    if (len <= 0) continue;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const axis = b.clone().sub(a).normalize();
    const isSel = !preview && sel?.t === 'pipe' && sel.id === p.id;
    const mat = isSel ? mats.pipeSel : hl && hl.has(p.a) ? mats.pipeHi : mats.pipe;
    part(modelG, G.cyl, mat, mid, axis, R, len, R).userData = { t: 'pipe', id: p.id };
    const h = part(hitG, G.hitCyl, mats.hit, mid, axis, Math.max(R * 2.4, 0.028), Math.max(len - R * 6, len * 0.4), Math.max(R * 2.4, 0.028), false);
    h.userData = { t: 'pipe', id: p.id };
  }
  for (const n of m.nodes) {
    const k = cls.get(n.id);
    const isSel = !preview && sel?.t === 'node' && sel.id === n.id;
    const mat = isSel ? mats.fitSel : hl && hl.has(n.id) ? mats.fitHi : mats.fit;
    buildFitting(n, k, R, mat, isSel);
    const h = part(hitG, G.hitSph, mats.hit, v3(n), null, Math.max(R * 3, 0.034), Math.max(R * 3, 0.034), Math.max(R * 3, 0.034), false);
    h.userData = { t: 'node', id: n.id };
  }
  updateGrid(m);
  updateSun(m);
  updateGizmo();
  buildLabels(m);
  updateEmpty();
  dirty = true;
}

// ---------------------------------------------------------------- workplane grid
let gridKey = '';
function updateGrid(m) {
  const units = m.settings.units;
  const b = M.bounds(m);
  let ext = 1500;
  if (b) ext = Math.max(1500, Math.abs(b.min[0]), Math.abs(b.max[0]), Math.abs(b.min[2]), Math.abs(b.max[2])) + 900;
  const minor = units === 'in' ? 76.2 : 100;
  const major = units === 'in' ? 304.8 : 1000;
  const half = Math.ceil(ext / major) * major;
  const key = `${units}|${half}`;
  if (key === gridKey) return;
  gridKey = key;
  gridG.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  gridG.clear();
  const H = half * S;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2),
    new THREE.MeshLambertMaterial({ color: 0xd9e7f6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  gridG.add(plane);
  const minorPts = [], majorPts = [];
  const steps = Math.round(half / minor);
  for (let i = -steps; i <= steps; i++) {
    const v = i * minor * S;
    const isMajor = Math.abs((i * minor) % major) < 0.01 || Math.abs(Math.abs((i * minor) % major) - major) < 0.01;
    const arr = isMajor ? majorPts : minorPts;
    arr.push(v, 0, -H, v, 0, H, -H, 0, v, H, 0, v);
  }
  const lines = (pts, color) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
    l.position.y = 0.0004;
    return l;
  };
  gridG.add(lines(minorPts, 0xbcd0e6), lines(majorPts, 0x8eacd0));
  const ax = (to, color) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), to]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
    l.position.y = 0.0008;
    return l;
  };
  gridG.add(ax(new THREE.Vector3(H, 0, 0), AXIS_COLORS.x), ax(new THREE.Vector3(0, 0, H), AXIS_COLORS.z));
}

function updateSun(m) {
  const b = M.bounds(m);
  const c = new THREE.Vector3(), size = new THREE.Vector3(1.5, 1.5, 1.5);
  if (b) {
    c.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2).multiplyScalar(S);
    size.set(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]).multiplyScalar(S);
  }
  const r = Math.max(0.6, size.length() / 2) * 1.3;
  sun.position.set(c.x + r * 0.9, c.y + r * 2.2, c.z + r * 0.6);
  sun.target.position.copy(c);
  const sc = sun.shadow.camera;
  sc.left = -r * 1.6; sc.right = r * 1.6; sc.top = r * 1.6; sc.bottom = -r * 1.6;
  sc.near = 0.05; sc.far = r * 6;
  sc.updateProjectionMatrix();
}

// ---------------------------------------------------------------- gizmo (arrows)
const gizmo = new THREE.Group();
scene.add(gizmo);
const arrows = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.95 });
  const shaft = new THREE.Mesh(G.cylLo, mat); shaft.scale.set(0.05, 0.62, 0.05); shaft.position.y = 0.31;
  const cone = new THREE.Mesh(G.cone, mat); cone.position.y = 0.8;
  const hit = new THREE.Mesh(G.hitCyl, mats.hit); hit.scale.set(0.34, 1.3, 0.34); hit.position.y = 0.55;
  shaft.renderOrder = cone.renderOrder = 10;
  g.add(shaft, cone, hit);
  g.userData = { hit, mat, data: null };
  g.visible = false;
  gizmo.add(g);
  arrows.push(g);
}

function updateGizmo() {
  arrows.forEach((a) => { a.visible = false; a.userData.data = null; });
  if (!sel || drag || preview) return;
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  let i = 0;
  const set = (data, color) => {
    const a = arrows[i++];
    a.visible = true;
    a.userData.data = data;
    a.userData.mat.color.setHex(color);
  };
  if (sel.t === 'node') {
    const n = byId.get(sel.id);
    if (!n) return;
    const k = lastCls.get(n.id);
    for (const d of Object.keys(M.DIRS)) {
      if (mode === 'extend' && k && k.dirs.includes(d)) continue;
      set({ action: mode, dir: d, nodeId: n.id, origin: [n.x, n.y, n.z] }, AXIS_COLORS[d[1]]);
    }
  } else if (sel.t === 'pipe') {
    const p = model.pipes.find((q) => q.id === sel.id);
    if (!p) return;
    const A = byId.get(p.a), B = byId.get(p.b);
    const ax = M.axisIndex(A, B);
    const name = M.AXES[ax];
    const cA = M.P(A)[ax], cB = M.P(B)[ax];
    set({ action: 'stretch', dir: (cA > cB ? '+' : '-') + name, nodeId: A.id, pipeId: p.id, origin: M.P(A) }, 0xff6a13);
    set({ action: 'stretch', dir: (cB > cA ? '+' : '-') + name, nodeId: B.id, pipeId: p.id, origin: M.P(B) }, 0xff6a13);
  }
  dirty = true;
}

const tmpV = new THREE.Vector3();
function updateGizmoScale() {
  const R = sizeInfo().od / 2 * S;
  const portrait = innerHeight > innerWidth;
  for (const a of arrows) {
    if (!a.visible) continue;
    const d = a.userData.data;
    tmpV.set(d.origin[0] * S, d.origin[1] * S, d.origin[2] * S);
    const s = camera.position.distanceTo(tmpV) * (portrait ? 0.095 : 0.075);
    const v = vecOf(d.dir);
    a.scale.setScalar(s);
    a.position.copy(tmpV).addScaledVector(v, R * 2.6 + s * 0.06);
    a.quaternion.setFromUnitVectors(Yup, v);
  }
}

// ---------------------------------------------------------------- labels
const labelsEl = $('labels');
let labelItems = [];
let dragLabel = null;
function buildLabels(m) {
  labelsEl.querySelectorAll('.lbl:not(.big)').forEach((e) => e.remove());
  labelItems = [];
  const u = m.settings.units;
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const add = (text, pos, cls = '') => {
    const el = document.createElement('div');
    el.className = 'lbl ' + cls;
    el.textContent = text;
    labelsEl.appendChild(el);
    labelItems.push({ el, pos });
  };
  const pipeLbl = (p) => {
    const A = byId.get(p.a), B = byId.get(p.b);
    add(M.fmtLen(M.pipeLen(m, p, byId), u), v3(A).add(v3(B)).multiplyScalar(0.5));
  };
  if (labelsOn) {
    for (const p of m.pipes) pipeLbl(p);
    for (const n of m.nodes) {
      const k = lastCls.get(n.id);
      if (k?.code) add(`${k.code}-${m.settings.size}`, v3(n), 'f');
    }
  } else if (!preview && sel?.t === 'pipe') {
    const p = m.pipes.find((q) => q.id === sel.id);
    if (p) pipeLbl(p);
  }
}
function placeLabel(el, pos) {
  tmpV.copy(pos).project(camera);
  if (tmpV.z > 1 || tmpV.z < -1) { el.style.visibility = 'hidden'; return; }
  el.style.visibility = '';
  const x = (tmpV.x + 1) / 2 * innerWidth, y = (1 - tmpV.y) / 2 * innerHeight;
  el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
}
function updateLabelPositions() {
  for (const it of labelItems) placeLabel(it.el, it.pos);
  if (dragLabel) placeLabel(dragLabel.el, dragLabel.pos);
}
function showDragLabel(text, pos) {
  if (!dragLabel) {
    const el = document.createElement('div');
    el.className = 'lbl big';
    labelsEl.appendChild(el);
    dragLabel = { el, pos: new THREE.Vector3() };
  }
  dragLabel.el.textContent = text;
  dragLabel.pos.copy(pos);
  dirty = true;
}
function hideDragLabel() { if (dragLabel) { dragLabel.el.remove(); dragLabel = null; } }

// ---------------------------------------------------------------- render loop & camera
let anim = null;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  dirty = true;
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

function loop(t) {
  requestAnimationFrame(loop);
  if (anim) {
    const k = Math.min(1, (t - anim.t0) / anim.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camera.position.lerpVectors(anim.p0, anim.p1, e);
    controls.target.lerpVectors(anim.t0v, anim.t1, e);
    if (k >= 1) anim = null;
    dirty = true;
  }
  const changed = controls.update();
  if (changed || dirty) {
    updateGizmoScale();
    renderer.render(scene, camera);
    updateLabelPositions();
    dirty = false;
  }
}

function viewTo(name, instant = false) {
  const b = M.bounds(model);
  const c = new THREE.Vector3(0, 0.4, 0);
  let r = 0.9;
  if (b) {
    c.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2).multiplyScalar(S);
    r = Math.max(0.35, Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) * S / 2);
  }
  const dirs = { home: [1, 0.78, 1.3], top: [0, 1, 0.0001], front: [0, 0.0001, 1], right: [1, 0.0001, 0] };
  const dir = name === 'fit' ? camera.position.clone().sub(controls.target).normalize() : new THREE.Vector3(...dirs[name]).normalize();
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const dist = (r / Math.sin(Math.min(vf, hf))) * 1.08 + 0.1;
  const p1 = c.clone().addScaledVector(dir, dist);
  if (instant) { camera.position.copy(p1); controls.target.copy(c); controls.update(); dirty = true; return; }
  anim = { t0: performance.now(), dur: 380, p0: camera.position.clone(), p1, t0v: controls.target.clone(), t1: c };
}

// ---------------------------------------------------------------- pointer interaction
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointers = new Set();
let down = null;
let drag = null;

function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
// Parameter along line (origin + s*dir) closest to the ray.
function lineParam(origin, dir, ray) {
  const w0 = origin.clone().sub(ray.origin);
  const b = dir.dot(ray.direction), d = dir.dot(w0), e = ray.direction.dot(w0);
  const den = 1 - b * b;
  if (den < 0.002) return null;
  return (b * e - d) / den;
}

function onPointerDown(e) {
  pointers.add(e.pointerId);
  if (pointers.size > 1) { down = null; if (drag) cancelDrag(); return; }
  down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, id: e.pointerId };
  const vis = arrows.filter((a) => a.visible);
  if (!vis.length) return;
  updateGizmoScale();
  gizmo.updateMatrixWorld(true);
  setRay(e);
  const hits = raycaster.intersectObjects(vis.map((a) => a.userData.hit), false);
  if (!hits.length) return;
  const arrow = hits[0].object.parent;
  const d = arrow.userData.data;
  e.stopImmediatePropagation();
  controls.enabled = false;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  const origin = new THREE.Vector3(...d.origin).multiplyScalar(S);
  const dir = vecOf(d.dir);
  const dist = camera.position.distanceTo(origin);
  drag = {
    d, origin, dir, pointerId: e.pointerId, moved: false, delta: 0,
    s0: lineParam(origin, dir, raycaster.ray), x0: e.clientX, y0: e.clientY,
    pxToM: (dist * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / innerHeight,
    comp: d.action === 'move' ? M.componentOf(model, d.nodeId) : null,
  };
  arrows.forEach((a) => { if (a !== arrow) a.visible = false; });
  dirty = true;
}

function onPointerMove(e) {
  if (down && e.pointerId === down.id && !down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 9) down.moved = true;
  if (!drag || e.pointerId !== drag.pointerId) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
  drag.moved = true;
  setRay(e);
  const s = drag.s0 != null ? lineParam(drag.origin, drag.dir, raycaster.ray) : null;
  const meters = s != null ? s - drag.s0 : (drag.y0 - e.clientY) * drag.pxToM;
  const snap = model.settings.snap || 1;
  const mm = Math.round(meters / S / snap) * snap;
  if (mm === drag.delta && preview) return;
  drag.delta = mm;
  applyDragPreview();
}

function applyDragPreview() {
  const d = drag.d;
  const m = M.clone(model);
  const tip = drag.origin.clone();
  let text = '';
  if (d.action === 'extend') {
    const len = Math.max(0, drag.delta);
    if (len > 0) { drag.result = M.extend(m, d.nodeId, d.dir, len); preview = m; } else { preview = null; drag.result = null; }
    tip.addScaledVector(drag.dir, len * S);
    text = fmt(len);
  } else if (d.action === 'move') {
    const v = M.DIRS[d.dir];
    M.translate(m, drag.comp, v.map((x) => x * drag.delta));
    preview = m;
    tip.addScaledVector(drag.dir, drag.delta * S);
    text = (drag.delta > 0 ? '+' : '') + fmt(drag.delta);
  } else if (d.action === 'stretch') {
    const p = model.pipes.find((q) => q.id === d.pipeId);
    const cur = M.pipeLen(model, p);
    const snap = model.settings.snap || 1;
    const next = Math.max(snap, cur + drag.delta);
    M.stretchPipe(m, d.pipeId, d.nodeId, next - cur, snap);
    preview = m;
    tip.addScaledVector(drag.dir, (next - cur) * S);
    text = fmt(next);
  }
  rebuild();
  showDragLabel(text, tip);
}

function finishDrag() {
  const d = drag.d;
  const moved = drag.moved;
  const s = model.settings;
  controls.enabled = true;
  hideDragLabel();
  let next = null, newSel = sel;
  if (!moved) {
    next = M.clone(model);
    if (d.action === 'extend') {
      const end = M.extend(next, d.nodeId, d.dir, s.defaultLen);
      newSel = end ? { t: 'node', id: end } : sel;
    } else if (d.action === 'move') {
      const v = M.DIRS[d.dir];
      M.translate(next, M.componentOf(next, d.nodeId), v.map((x) => x * s.snap));
      const o = d.origin;
      const n = M.findNodeAt(next, o[0] + v[0] * s.snap, o[1] + v[1] * s.snap, o[2] + v[2] * s.snap);
      newSel = n ? { t: 'node', id: n.id } : null;
    } else {
      M.stretchPipe(next, d.pipeId, d.nodeId, s.snap, s.snap);
    }
  } else if (preview && drag.delta !== 0) {
    next = preview;
    if (d.action === 'extend' && drag.result) newSel = { t: 'node', id: drag.result };
    if (d.action === 'move') {
      const v = M.DIRS[d.dir], o = d.origin;
      const n = M.findNodeAt(next, o[0] + v[0] * drag.delta, o[1] + v[1] * drag.delta, o[2] + v[2] * drag.delta);
      newSel = n ? { t: 'node', id: n.id } : null;
    }
  }
  drag = null;
  preview = null;
  if (next) { sel = newSel; commit(next); } else { rebuild(); }
}

function cancelDrag() {
  controls.enabled = true;
  drag = null;
  preview = null;
  hideDragLabel();
  rebuild();
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (drag && e.pointerId === drag.pointerId) { finishDrag(); down = null; return; }
  if (down && e.pointerId === down.id && !down.moved && performance.now() - down.t < 650 && e.target === canvas) handleTap(e);
  if (down && e.pointerId === down.id) down = null;
}
function onPointerCancel(e) {
  pointers.delete(e.pointerId);
  if (drag && e.pointerId === drag.pointerId) cancelDrag();
  down = null;
}

function handleTap(e) {
  setRay(e);
  world.updateMatrixWorld(true);
  const hits = raycaster.intersectObjects(hitG.children, false);
  const s = model.settings;
  if (hits.length) {
    let h = hits[0];
    const nh = hits.find((x) => x.object.userData.t === 'node' && x.distance < h.distance + 0.06);
    if (nh) h = nh;
    const ud = h.object.userData;
    if (tool === 'point' && ud.t === 'pipe') { addJointOnPipe(ud.id); return; }
    if (tool === 'point') setTool('select');
    if (ud.t === 'node' && !(sel?.t === 'node' && sel.id === ud.id)) mode = 'extend';
    select(ud.t, ud.id);
    return;
  }
  if (tool === 'point') {
    const pt = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
    if (!pt) return;
    const sn = (v) => Math.round(v / S / s.snap) * s.snap;
    const m = M.clone(model);
    const id = M.addNode(m, sn(pt.x), 0, sn(pt.z));
    sel = { t: 'node', id };
    mode = 'extend';
    setTool('select');
    commit(m);
    toast('Tap an arrow to add a pipe, or drag it to set the length');
    return;
  }
  select(null);
}

function addJointOnPipe(pipeId) {
  const p = model.pipes.find((q) => q.id === pipeId);
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const A = byId.get(p.a), B = byId.get(p.b);
  const a = v3(A), dir = v3(B).sub(a);
  const len = dir.length();
  dir.normalize();
  const s = lineParam(a, dir, raycaster.ray);
  const snap = model.settings.snap;
  let mm = Math.round(((s ?? len / 2) / S) / snap) * snap;
  setTool('select');
  mode = 'extend';
  if (mm <= 0) { select('node', A.id); return; }
  if (mm >= len / S - 0.01) { select('node', B.id); return; }
  const m = M.clone(model);
  const pt = [A.x + dir.x * mm, A.y + dir.y * mm, A.z + dir.z * mm];
  M.addNode(m, ...pt);
  M.normalize(m);
  const n = M.findNodeAt(m, ...pt);
  sel = n ? { t: 'node', id: n.id } : null;
  commit(m);
  toast('Joint added — tap an arrow to branch off');
}

// ---------------------------------------------------------------- commands
function commit(next) {
  undoStack.push(JSON.stringify(model));
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
  model = next;
  afterChange();
}
function afterChange() {
  if (sel) {
    const ok = sel.t === 'node' ? model.nodes.some((n) => n.id === sel.id) : model.pipes.some((p) => p.id === sel.id);
    if (!ok) sel = null;
  }
  rebuild();
  renderPanel();
  updateUndo();
  $('titleText').textContent = model.name;
  scheduleSave();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(model));
  model = JSON.parse(undoStack.pop());
  afterChange();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(model));
  model = JSON.parse(redoStack.pop());
  afterChange();
}
function updateUndo() {
  $('bUndo').disabled = !undoStack.length;
  $('bRedo').disabled = !redoStack.length;
}
function select(t, id) {
  sel = t ? { t, id } : null;
  rebuild();
  renderPanel();
}
function edit(fn) {
  const m = M.clone(model);
  const r = fn(m);
  if (r === false) return;
  commit(m);
}
function deleteSelection() {
  if (!sel) return;
  const s = sel;
  sel = null;
  edit((m) => (s.t === 'node' ? M.deleteNode(m, s.id) : M.deletePipe(m, s.id)));
}
function setTool(t) {
  tool = t;
  $('tPipe').classList.toggle('on', t === 'point');
  if (t === 'point') {
    sel = null;
    rebuild();
    renderPanel();
    toast('Tap the workplane to start a pipe, or tap a pipe to add a joint', 3200);
  }
  updateEmpty();
}

// ---------------------------------------------------------------- panel
const LEN_PRESETS = { in: [6, 12, 18, 24, 30, 36, 48, 60, 72].map((x) => x * 25.4), mm: [100, 150, 250, 300, 500, 750, 1000, 1500] };

function fittingInfo(k, n) {
  const z = model.settings.size;
  if (k.code) {
    const f = M.FITTINGS[k.code];
    return { badge: k.code, cls: '', title: `Type ${k.code}-${z} · ${f.name}`, sub: f.use };
  }
  if (k.kind === 'point') return { badge: '+', cls: 'blue', title: 'Start point', sub: 'Tap an arrow to add a pipe, or drag it to set the length.' };
  if (k.kind === 'inline') return { badge: '—', cls: 'gray', title: 'Point on a pipe', sub: 'The pipe runs straight through here. Branch off with an arrow.' };
  if (k.kind === 'open') return { badge: 'END', cls: 'gray', title: k.floor ? 'Pipe end on the floor' : 'Open pipe end', sub: k.floor ? 'Floor ends are set to "open" in Settings.' : 'Turn on "Cap open ends" in Settings to add Type 84 plugs.' };
  return { badge: '?', cls: 'gray', title: 'Joint', sub: '' };
}

function renderPanel() {
  const el = $('panel');
  if (!sel) { el.classList.add('hidden'); return; }
  const s = model.settings, u = s.units;
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  let html = '';
  if (sel.t === 'node') {
    const n = byId.get(sel.id);
    const k = lastCls.get(sel.id);
    if (!n || !k) { el.classList.add('hidden'); return; }
    const fi = fittingInfo(k, n);
    html += `<div class="ph"><div class="badge ${fi.cls}">${esc(fi.badge)}</div><div class="grow"><h3>${esc(fi.title)}</h3><p>${esc(fi.sub)}</p></div><button class="round" data-a="close" aria-label="Close">${icon('x')}</button></div>`;
    html += `<div class="row"><div class="seg"><button data-a="mode-extend" class="${mode === 'extend' ? 'on' : ''}">Draw</button><button data-a="mode-move" class="${mode === 'move' ? 'on' : ''}">Move</button></div>
      <div class="xyz"><span class="x"><b>X</b>${fmt(n.x)}</span><span class="y"><b>Y</b>${fmt(n.y)}</span><span class="z"><b>Z</b>${fmt(n.z)}</span></div></div>`;
    if (mode === 'extend') {
      html += `<div class="row scroll">${LEN_PRESETS[u].map((v) => `<button class="chip ${Math.abs(v - s.defaultLen) < 0.01 ? 'on' : ''}" data-a="len" data-v="${v}">${fmt(v)}</button>`).join('')}
        <button class="chip ${LEN_PRESETS[u].some((v) => Math.abs(v - s.defaultLen) < 0.01) ? '' : 'on'}" data-a="len-custom">${LEN_PRESETS[u].some((v) => Math.abs(v - s.defaultLen) < 0.01) ? 'Custom…' : fmt(s.defaultLen)}</button></div>`;
      const acts = [];
      if (k.thruOptions.length) acts.push(`<button class="chip" data-a="thru">${icon('rotate')}Through pipe: ${k.thru.toUpperCase()}</button>`);
      if (k.canSplit && k.n === 3) acts.push(`<button class="chip" data-a="split">${icon('socket')}${n.split ? 'Use Type 10 (pipe passes through)' : 'Use Type 25 (all sockets)'}</button>`);
      if (k.canSplit && k.n === 2) acts.push(`<button class="chip" data-a="split">${icon('socket')}${n.split ? 'Remove coupling' : 'Break pipe here (Type 14)'}</button>`);
      if (k.n === 2 && k.pairs.length === 1) acts.push(`<button class="chip" data-a="merge">${icon('merge')}Remove point</button>`);
      acts.push(`<button class="chip danger" data-a="del-node">${icon('trash')}Delete joint</button>`);
      html += `<div class="row scroll">${acts.join('')}</div>`;
      html += `<div class="hint">Tap an arrow to add ${fmt(s.defaultLen)} of pipe. Drag an arrow for any length (snaps to ${fmt(s.snap)}).</div>`;
    } else {
      html += `<div class="row scroll"><button class="chip" data-a="dup">${icon('copy')}Duplicate</button><button class="chip danger" data-a="del-comp">${icon('trash')}Delete structure</button></div>`;
      html += `<div class="hint">Drag an arrow to move the whole connected structure (highlighted). Tap an arrow to nudge ${fmt(s.snap)}.</div>`;
    }
  } else {
    const p = model.pipes.find((q) => q.id === sel.id);
    if (!p) { el.classList.add('hidden'); return; }
    const A = byId.get(p.a), B = byId.get(p.b);
    const len = M.pipeLen(model, p, byId);
    const ax = M.AXES[M.axisIndex(A, B)];
    const dirTxt = ax === 'y' ? 'Vertical' : `Horizontal, along ${ax.toUpperCase()}`;
    html += `<div class="ph"><div class="badge blue">${icon('pipe')}</div><div class="grow"><h3>Pipe · ${fmt(len)}</h3><p>${esc(dirTxt)} · ${esc(sizeLabel())}</p></div><button class="round" data-a="close" aria-label="Close">${icon('x')}</button></div>`;
    html += `<div class="row"><div class="len"><button class="chip" data-a="minus" aria-label="Shorter">−</button><input id="lenIn" type="text" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" value="${esc(fmt(len))}"><button class="chip" data-a="plus" aria-label="Longer">+</button></div></div>`;
    html += `<div class="row scroll"><button class="chip" data-a="split-pipe">${icon('scissors')}Add joint in middle</button><button class="chip" data-a="struct">${icon('move')}Move structure</button><button class="chip danger" data-a="del-pipe">${icon('trash')}Delete pipe</button></div>`;
    html += `<div class="hint">Drag the orange arrows to stretch. Lengths are center-to-center; the Parts list gives cut lengths.</div>`;
  }
  el.innerHTML = html;
  el.classList.remove('hidden');
  const inp = $('lenIn');
  if (inp) {
    const apply = () => {
      const v = M.parseLen(inp.value, model.settings.units);
      if (!(v > 0)) { renderPanel(); toast('Enter a length like 36, 36-1/2" or 3\' 6"'); return; }
      const id = sel.id;
      edit((m) => M.setPipeLength(m, id, v, 1));
    };
    inp.addEventListener('change', apply);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    inp.addEventListener('focus', () => inp.select());
  }
}

$('panel').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]');
  if (!b || !sel) return;
  const a = b.dataset.a;
  const s = model.settings;
  const id = sel.id;
  switch (a) {
    case 'close': select(null); break;
    case 'mode-extend': mode = 'extend'; rebuild(); renderPanel(); break;
    case 'mode-move': mode = 'move'; rebuild(); renderPanel(); break;
    case 'len': edit((m) => { m.settings.defaultLen = Number(b.dataset.v); }); break;
    case 'len-custom': {
      const v = M.parseLen(prompt('Pipe length added when you tap an arrow:', fmt(s.defaultLen)), s.units);
      if (v > 0) edit((m) => { m.settings.defaultLen = v; });
      break;
    }
    case 'thru': {
      const k = lastCls.get(id);
      const i = k.thruOptions.indexOf(k.thru);
      const nx = k.thruOptions[(i + 1) % k.thruOptions.length];
      edit((m) => { m.nodes.find((n) => n.id === id).thru = nx; });
      break;
    }
    case 'split': edit((m) => { const n = m.nodes.find((q) => q.id === id); if (n.split) delete n.split; else n.split = true; }); break;
    case 'merge': sel = null; edit((m) => M.mergeAt(m, id)); break;
    case 'del-node': case 'del-pipe': deleteSelection(); break;
    case 'dup': {
      const m = M.clone(model);
      const nid = M.duplicateComponent(m, id, Math.max(300, s.snap * 4));
      sel = nid != null ? { t: 'node', id: nid } : null;
      commit(m);
      toast('Duplicated — drag the arrows to position the copy');
      break;
    }
    case 'del-comp': sel = null; edit((m) => M.deleteComponent(m, id)); break;
    case 'minus': case 'plus': {
      const p = model.pipes.find((q) => q.id === id);
      const cur = M.pipeLen(model, p);
      const nx = cur + (a === 'plus' ? s.snap : -s.snap);
      if (nx <= 0) return;
      edit((m) => M.setPipeLength(m, id, nx, 1));
      break;
    }
    case 'split-pipe': {
      const m = M.clone(model);
      const nid = M.splitPipe(m, id, s.snap);
      const n = m.nodes.find((q) => q.id === nid);
      sel = n ? { t: 'node', id: nid } : null;
      mode = 'extend';
      commit(m);
      break;
    }
    case 'struct': {
      const p = model.pipes.find((q) => q.id === id);
      mode = 'move';
      select('node', p.a);
      break;
    }
  }
});

// ---------------------------------------------------------------- modal helpers
const modal = $('modal');
let modalOnClose = null;
function openModal(title, html, onClose) {
  $('mTitle').textContent = title;
  $('mBody').innerHTML = html;
  $('mBody').scrollTop = 0;
  modal.classList.add('open');
  modalOnClose = onClose || null;
}
function closeModal() {
  modal.classList.remove('open');
  const f = modalOnClose;
  modalOnClose = null;
  if (f) f();
}
$('mClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

let toastTimer;
function toast(msg, ms = 2400) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function updateEmpty() {
  $('empty').classList.toggle('hidden', model.nodes.length > 0 || tool === 'point' || !!preview);
}

// ---------------------------------------------------------------- shapes library
function shapeThumb(shape) {
  const m = M.newModel('in');
  M.buildShape(m, shape.id, M.shapeDefaults(shape, 'in'));
  const { cls } = M.classifyAll(m);
  const pr = (n) => [(n.x - n.z) * 0.866, (n.x + n.z) * 0.5 - n.y];
  const pts = m.nodes.map(pr);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 140, H = 96, pad = 12;
  const sc = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1));
  const tx = (p) => [(p[0] - minX) * sc + (W - (maxX - minX) * sc) / 2, (p[1] - minY) * sc + (H - (maxY - minY) * sc) / 2];
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  let svg = `<svg viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="10" fill="#eaf2fb"/>`;
  for (const p of m.pipes) {
    const [x1, y1] = tx(pr(byId.get(p.a))), [x2, y2] = tx(pr(byId.get(p.b)));
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#7d8a97" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  for (const n of m.nodes) {
    if (!cls.get(n.id).code) continue;
    const [x, y] = tx(pr(n));
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#ff6a13"/>`;
  }
  return svg + '</svg>';
}

function openShapes() {
  setTool('select');
  const html = `<div class="muted" style="margin:0 4px 12px">Fittings are picked for you automatically. You can change any size after adding.</div>
    <div class="grid">${M.SHAPES.map((sh) => `<button class="shape" data-shape="${sh.id}">${shapeThumb(sh)}<div style="margin-top:6px">${esc(sh.name)}</div></button>`).join('')}</div>`;
  openModal('Shapes', html);
  $('mBody').querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => openShapeForm(M.SHAPES.find((s) => s.id === b.dataset.shape))));
}

function openShapeForm(shape) {
  const u = model.settings.units;
  const def = M.shapeDefaults(shape, u);
  const fields = shape.params.map(([k, label, , , type]) => `<div class="field"><label for="sp_${k}">${esc(label)}</label>
    <input id="sp_${k}" type="text" ${type === 'count' ? 'inputmode="numeric"' : ''} autocomplete="off" autocorrect="off" spellcheck="false" value="${esc(type === 'count' ? def[k] : fmt(def[k]))}"></div>`).join('');
  openModal(shape.name, `<div class="card" style="padding:8px 0;margin-bottom:12px;text-align:center">${shapeThumb(shape)}</div>
    <div class="card">${fields}</div>
    <div class="muted" style="margin:10px 4px 14px">Sizes are center-to-center of the pipes. Type 36, 36-1/2", 3' 6" or 900mm.</div>
    <button class="btn block" id="spAdd">${icon('plus')}Add to workplane</button>
    <button class="btn sec block" id="spBack" style="margin-top:8px">Back to shapes</button>`);
  $('spBack').onclick = openShapes;
  $('spAdd').onclick = () => {
    const v = {};
    for (const [k, label, , , type] of shape.params) {
      const raw = $('sp_' + k).value;
      const val = type === 'count' ? parseInt(raw, 10) : M.parseLen(raw, u);
      if (!Number.isFinite(val) || val < 0 || (type !== 'count' && val === 0 && !/0 =/.test(label))) { toast(`Check “${label}”`); return; }
      v[k] = val;
    }
    // build in a scratch model to measure, then place it
    const tmp = M.newModel(u);
    tmp.settings = { ...model.settings };
    M.buildShape(tmp, shape.id, v);
    const tb = M.bounds(tmp);
    const snap = model.settings.snap;
    const sn = (x) => Math.round(x / snap) * snap;
    const mb = M.bounds(model);
    let origin;
    if (!mb) origin = [sn(-(tb.max[0] - tb.min[0]) / 2), 0, sn(-(tb.max[2] - tb.min[2]) / 2)];
    else origin = [sn(mb.max[0] + Math.max(300, snap * 4) - tb.min[0]), 0, sn(mb.min[2] - tb.min[2])];
    const m = M.clone(model);
    const first = M.buildShape(m, shape.id, v, origin);
    sel = first != null ? { t: 'node', id: first } : null;
    mode = 'move';
    closeModal();
    commit(m);
    viewTo(mb ? 'fit' : 'home');
    toast(mb ? 'Added — drag the arrows to move it into place' : `${shape.name} added`);
  };
}

// ---------------------------------------------------------------- parts list
function bomData() { return M.computeBOM(model); }

function openParts(tab = 'fittings') {
  const b = bomData();
  const s = model.settings, u = s.units;
  const total = u === 'in' ? M.fmtFeet(b.totalLen) : `${(b.totalLen / 1000).toFixed(2)} m`;
  let html = `<div class="muted" style="margin:0 4px 10px">${esc(sizeLabel())}</div>
    <div class="stats"><div class="stat"><b>${b.fittingCount}</b><small>fittings</small></div><div class="stat"><b>${b.pipeCount}</b><small>pipe cuts</small></div><div class="stat"><b style="font-size:16px;line-height:24px">${esc(total)}</b><small>total pipe</small></div></div>
    <div class="row" style="justify-content:center;margin-top:14px"><div class="seg">
      <button data-tab="fittings" class="${tab === 'fittings' ? 'on' : ''}">Fittings</button>
      <button data-tab="cuts" class="${tab === 'cuts' ? 'on' : ''}">Cut list</button>
      <button data-tab="buy" class="${tab === 'buy' ? 'on' : ''}">Buy pipe</button></div></div>`;
  if (!model.pipes.length) {
    html += `<div class="card muted" style="padding:18px;margin-top:14px;text-align:center">No pipes yet. Add a shape or draw some pipes.</div>`;
  } else if (tab === 'fittings') {
    html += `<div class="card list" style="margin-top:14px">${b.fittings.map((f) => `<div><div class="legend"><div class="code">${f.code}</div></div><div class="t"><b>${esc(f.name)}</b><small>Part ${esc(f.part)} · ${esc(f.use)}</small></div><div class="q">×${f.qty}</div></div>`).join('') || '<div class="muted">No fittings needed.</div>'}</div>`;
  } else if (tab === 'cuts') {
    html += `<div class="card list" style="margin-top:14px">${b.cutList.map((c) => `<div><div class="t"><b>${esc(M.fmtLen(c.len, u))}</b><small>${u === 'in' ? esc(M.fmtFeet(c.len)) : `${(c.len / 1000).toFixed(3)} m`}</small></div><div class="q">×${c.qty}</div></div>`).join('')}</div>
      <div class="muted" style="margin:10px 4px">${s.deduct ? `Estimated cut lengths: ½ pipe OD (${M.fmtLen(b.size.od / 2, u)}) is taken off each end that sits in a socket. Measure your fittings and test-fit before cutting.` : 'Cut lengths are center-to-center (no deduction). Turn on “Cut deduction” in Settings for estimated cut sizes.'} Where a pipe passes straight through a fitting it stays one piece.</div>`;
  } else {
    html += `<div class="card" style="margin-top:14px;padding:14px"><b style="font-size:17px">${b.sticks.length} × ${esc(M.fmtLen(s.stock, u))}${u === 'in' ? ` (${esc(M.fmtFeet(s.stock))})` : ''} stock pipe</b><div class="muted">Pipe cuts packed onto stock lengths, allowing ⅛" (3 mm) per saw cut.</div></div>
      <div class="card list" style="margin-top:10px">${b.sticks.map((st, i) => `<div><div class="t"><b>Stick ${i + 1}</b><small>${st.cuts.map((c) => esc(M.fmtLen(c, u))).join(' + ')}</small></div><div class="muted">${esc(M.fmtLen(Math.max(0, s.stock - st.used), u))} left</div></div>`).join('')}</div>`;
  }
  for (const w of b.warnings) html += `<div class="warn">${esc(w)}</div>`;
  html += `<div class="row" style="margin-top:16px"><button class="btn" id="pShare" style="flex:1">${icon('share')}Share CSV</button><button class="btn sec" id="pCopy" style="flex:1">${icon('copy')}Copy list</button></div>`;
  openModal('Parts list', html);
  $('mBody').querySelectorAll('[data-tab]').forEach((x) => x.addEventListener('click', () => openParts(x.dataset.tab)));
  $('pShare').onclick = () => shareFile(new Blob([bomCSV(b)], { type: 'text/csv' }), `${safeName(model.name)}-parts.csv`, 'Parts list');
  $('pCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(bomText(b)); toast('Parts list copied'); } catch { toast('Copy not allowed here'); }
  };
}

function bomText(b) {
  const u = model.settings.units;
  let t = `${model.name}\n${sizeLabel()}\n\nFITTINGS\n`;
  for (const f of b.fittings) t += `${f.qty} × ${f.part}  ${f.name}\n`;
  t += `\nPIPE CUTS\n`;
  for (const c of b.cutList) t += `${c.qty} × ${M.fmtLen(c.len, u)}\n`;
  t += `\nBUY: ${b.sticks.length} × ${M.fmtLen(model.settings.stock, u)} pipe\n`;
  return t;
}
function bomCSV(b) {
  const u = model.settings.units;
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['Section', 'Part', 'Description', 'Qty', u === 'in' ? 'Length (in)' : 'Length (mm)']];
  for (const f of b.fittings) rows.push(['Fitting', f.part, f.name, f.qty, '']);
  for (const c of b.cutList) rows.push(['Pipe cut', `Pipe size ${model.settings.size}`, M.fmtLen(c.len, u), c.qty, u === 'in' ? (c.len / 25.4).toFixed(3) : c.len.toFixed(1)]);
  rows.push(['Stock pipe', `Pipe size ${model.settings.size}`, `${M.fmtLen(model.settings.stock, u)} length`, b.sticks.length, '']);
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

// ---------------------------------------------------------------- settings
function openSettings() {
  const s = model.settings, u = s.units;
  const snaps = u === 'in' ? [3.175, 6.35, 12.7, 25.4, 50.8, 76.2, 152.4, 304.8] : [1, 5, 10, 25, 50, 100];
  const sizeOpts = Object.values(M.SIZES).map((z) => `<option value="${z.code}" ${z.code === s.size ? 'selected' : ''}>${u === 'in' ? `${z.code} · ${z.nps} pipe` : `${z.code} · ${z.od} mm`}</option>`).join('');
  const html = `<div class="sect">Design</div><div class="card">
    <div class="field"><label>Units</label><div class="seg"><button data-units="in" class="${u === 'in' ? 'on' : ''}">inches</button><button data-units="mm" class="${u === 'mm' ? 'on' : ''}">mm</button></div></div>
    <div class="field"><label for="stSize">Kee Klamp size</label><select id="stSize">${sizeOpts}</select></div>
    <div class="field"><label for="stSnap">Snap to</label><select id="stSnap">${snaps.map((v) => `<option value="${v}" ${Math.abs(v - s.snap) < 0.01 ? 'selected' : ''}>${esc(M.fmtLen(v, u))}</option>`).join('')}</select></div>
    <div class="field"><label for="stLen">Arrow tap adds</label><input id="stLen" type="text" value="${esc(M.fmtLen(s.defaultLen, u))}"></div>
  </div>
  <div class="sect">Fittings</div><div class="card">
    <div class="field"><label for="stFloor">Pipe ends on the floor</label><select id="stFloor">
      <option value="flange" ${s.floorEnd === 'flange' ? 'selected' : ''}>Flange (61)</option>
      <option value="plug" ${s.floorEnd === 'plug' ? 'selected' : ''}>Plug / foot (84)</option>
      <option value="open" ${s.floorEnd === 'open' ? 'selected' : ''}>Open</option></select></div>
    <div class="field"><label for="stCap">Cap other open ends (84)</label><label class="switch"><input type="checkbox" id="stCap" ${s.capEnds ? 'checked' : ''}><span></span></label></div>
  </div>
  <div class="sect">Parts list</div><div class="card">
    <div class="field"><label for="stStock">Stock pipe length</label><input id="stStock" type="text" value="${esc(M.fmtLen(s.stock, u))}"></div>
    <div class="field"><label for="stDed">Cut deduction (½ OD per socket)</label><label class="switch"><input type="checkbox" id="stDed" ${s.deduct ? 'checked' : ''}><span></span></label></div>
  </div>
  <div class="muted" style="margin:12px 4px">Settings are saved with this design.</div>`;
  openModal('Settings', html);
  const body = $('mBody');
  const set = (fn, rerender) => { edit((m) => { fn(m.settings); }); if (rerender) openSettings(); };
  body.querySelectorAll('[data-units]').forEach((b) => b.addEventListener('click', () => {
    const nu = b.dataset.units;
    if (nu === model.settings.units) return;
    set((st) => {
      st.units = nu;
      st.snap = nu === 'in' ? 25.4 : 10;
      if (Math.abs(st.defaultLen - 304.8) < 0.1 || Math.abs(st.defaultLen - 300) < 0.1) st.defaultLen = nu === 'in' ? 304.8 : 300;
      if (Math.abs(st.stock - 6400.8) < 0.1 || Math.abs(st.stock - 6000) < 0.1) st.stock = nu === 'in' ? 6400.8 : 6000;
    }, true);
  }));
  $('stSize').onchange = (e) => set((st) => { st.size = e.target.value; });
  $('stSnap').onchange = (e) => set((st) => { st.snap = Number(e.target.value); });
  $('stFloor').onchange = (e) => set((st) => { st.floorEnd = e.target.value; });
  $('stCap').onchange = (e) => set((st) => { st.capEnds = e.target.checked; });
  $('stDed').onchange = (e) => set((st) => { st.deduct = e.target.checked; });
  const lenField = (id, key, min) => {
    $(id).onchange = (e) => {
      const v = M.parseLen(e.target.value, model.settings.units);
      if (!(v >= min)) { toast('Enter a valid length'); e.target.value = M.fmtLen(model.settings[key], model.settings.units); return; }
      set((st) => { st[key] = v; });
      e.target.value = M.fmtLen(v, model.settings.units);
    };
  };
  lenField('stLen', 'defaultLen', 1);
  lenField('stStock', 'stock', 100);
}

// ---------------------------------------------------------------- designs (gallery)
let saveTimer;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700); }
function saveNow() {
  clearTimeout(saveTimer);
  if (!designId) designId = newId();
  if (!lsSet(LS_DESIGN(designId), JSON.stringify(model))) { toast('Storage is full — share the design file to keep it'); return; }
  const ix = loadIndex().filter((d) => d.id !== designId);
  ix.unshift({ id: designId, name: model.name, updated: Date.now(), thumb: makeThumb(), count: model.pipes.length });
  if (!saveIndex(ix)) { ix[0].thumb = ''; saveIndex(ix); }
  lsSet(LS_CUR, designId);
}
function makeThumb() {
  try {
    const gv = gizmo.visible;
    gizmo.visible = false;
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 240; c.height = 180;
    const sc = Math.max(240 / src.width, 180 / src.height);
    const w = 240 / sc, h = 180 / sc;
    c.getContext('2d').drawImage(src, (src.width - w) / 2, (src.height - h) / 2, w, h, 0, 0, 240, 180);
    gizmo.visible = gv;
    dirty = true;
    return c.toDataURL('image/jpeg', 0.7);
  } catch { return ''; }
}
function loadDesign(id) {
  let m = null;
  try { m = M.validate(JSON.parse(lsGet(LS_DESIGN(id)))); } catch { m = null; }
  if (!m) return false;
  designId = id;
  model = m;
  undoStack = []; redoStack = [];
  sel = null; mode = 'extend';
  gridKey = '';
  rebuild(); renderPanel(); updateUndo();
  $('titleText').textContent = model.name;
  lsSet(LS_CUR, id);
  viewTo('home', true);
  return true;
}
function newDesign(m) {
  if (designId) saveNow();
  designId = newId();
  model = m || M.newModel(model?.settings?.units || guessUnits());
  undoStack = []; redoStack = [];
  sel = null; mode = 'extend';
  gridKey = '';
  rebuild(); renderPanel(); updateUndo();
  $('titleText').textContent = model.name;
  viewTo('home', true);
  saveNow();
}
function openDesigns() {
  if (designId) saveNow();
  const ix = loadIndex();
  const fmtDate = (t) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const html = `<div class="card list">
      <button data-new>${icon('plus')}<div class="t"><b>New design</b><small>Start with an empty workplane</small></div></button>
    </div>
    <div class="sect">Saved on this device</div>
    <div class="card list">${ix.map((d) => `<div class="design ${d.id === designId ? 'cur' : ''}">
        <button data-open="${d.id}" style="display:flex;gap:12px;align-items:center;flex:1;min-width:0;text-align:left">${d.thumb ? `<img src="${d.thumb}" alt="">` : '<span class="ph0"></span>'}
        <span class="t"><b>${esc(d.name)}</b><small>${fmtDate(d.updated)} · ${d.count || 0} pipes</small></span></button>
        <button class="round" data-dupd="${d.id}" aria-label="Duplicate" style="width:38px;height:38px">${icon('copy')}</button>
        <button class="round" data-deld="${d.id}" aria-label="Delete" style="width:38px;height:38px;color:#d4312b">${icon('trash')}</button>
      </div>`).join('') || '<div class="muted">No saved designs yet.</div>'}</div>
    <div class="muted" style="margin:12px 4px">Designs are stored in this browser. Use ⋯ → Share design file to back up or move a design to another device.</div>`;
  openModal('My designs', html);
  const body = $('mBody');
  body.querySelector('[data-new]').onclick = () => { closeModal(); newDesign(); };
  body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
    closeModal();
    if (!loadDesign(b.dataset.open)) toast('Could not open that design');
  }));
  body.querySelectorAll('[data-dupd]').forEach((b) => b.addEventListener('click', () => {
    try {
      const m = M.validate(JSON.parse(lsGet(LS_DESIGN(b.dataset.dupd))));
      if (!m) return;
      m.name = `${m.name} copy`;
      closeModal();
      newDesign(m);
      toast('Design duplicated');
    } catch { toast('Could not duplicate'); }
  }));
  body.querySelectorAll('[data-deld]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.deld;
    const d = ix.find((x) => x.id === id);
    if (!confirm(`Delete “${d?.name || 'design'}”? This can’t be undone.`)) return;
    lsDel(LS_DESIGN(id));
    saveIndex(loadIndex().filter((x) => x.id !== id));
    if (id === designId) {
      const rest = loadIndex();
      designId = null;
      if (!(rest.length && loadDesign(rest[0].id))) newDesign();
    }
    openDesigns();
  }));
}

// ---------------------------------------------------------------- menu, files, export
const safeName = (s) => (s || 'design').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'design';
async function shareFile(blob, filename, title) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function openMenu() {
  const items = [
    ['rename', 'edit', 'Rename design'],
    ['share', 'share', 'Share design file'],
    ['import', 'open', 'Open design file'],
    ['png', 'camera', 'Save picture'],
    ['stl', 'cube', 'Export STL (3D model)'],
    ['clear', 'trash', 'Clear workplane'],
    ['help', 'help', 'How to use'],
  ];
  openModal('Menu', `<div class="card list">${items.map(([k, ic, t]) => `<button data-m="${k}">${icon(ic)}<div class="t"><b>${t}</b></div></button>`).join('')}</div>
    <div class="muted" style="margin:14px 4px">Klamp Studio is an independent tool and is not affiliated with Kee Safety. Kee Klamp® is a registered trademark of Kee Safety Ltd. Always check fitting choices and load ratings with your supplier.</div>`);
  $('mBody').querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => menuAction(b.dataset.m)));
}

async function menuAction(k) {
  if (k === 'rename') { closeModal(); rename(); return; }
  if (k === 'share') {
    closeModal();
    shareFile(new Blob([JSON.stringify(model, null, 1)], { type: 'application/json' }), `${safeName(model.name)}.klamp.json`, model.name);
    return;
  }
  if (k === 'import') { closeModal(); $('fileIn').value = ''; $('fileIn').click(); return; }
  if (k === 'png') {
    closeModal();
    const gv = gizmo.visible;
    gizmo.visible = false;
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    gizmo.visible = gv; dirty = true;
    const blob = await (await fetch(url)).blob();
    shareFile(blob, `${safeName(model.name)}.png`, model.name);
    return;
  }
  if (k === 'stl') { closeModal(); exportSTL(); return; }
  if (k === 'clear') {
    closeModal();
    if (!model.nodes.length) return;
    if (!confirm('Remove everything from the workplane? You can undo this.')) return;
    sel = null;
    edit((m) => { m.nodes = []; m.pipes = []; });
    return;
  }
  if (k === 'help') openHelp();
}

async function exportSTL() {
  if (!model.pipes.length) { toast('Nothing to export yet'); return; }
  toast('Preparing STL…');
  try {
    const { STLExporter } = await import('three/addons/exporters/STLExporter.js');
    world.scale.setScalar(1000);
    world.rotation.x = Math.PI / 2; // Y-up → Z-up for slicers & CAD
    world.updateMatrixWorld(true);
    const data = new STLExporter().parse(modelG, { binary: true });
    world.scale.setScalar(1);
    world.rotation.x = 0;
    world.updateMatrixWorld(true);
    shareFile(new Blob([data], { type: 'model/stl' }), `${safeName(model.name)}.stl`, model.name);
  } catch (e) {
    world.scale.setScalar(1); world.rotation.x = 0;
    toast('STL export needs a connection the first time');
  }
}

$('fileIn').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const m = M.validate(JSON.parse(await f.text()));
    if (!m) throw new Error('bad');
    newDesign(m);
    toast(`Opened “${m.name}”`);
  } catch { toast('That file is not a Klamp Studio design'); }
});

function rename() {
  const n = prompt('Design name', model.name);
  if (n == null) return;
  const name = n.trim().slice(0, 80) || 'Untitled design';
  edit((m) => { m.name = name; });
}

function openHelp() {
  const legend = Object.entries(M.FITTINGS).map(([c, f]) => `<div class="legend" style="padding:10px 14px"><div class="code">${c}</div><div class="t"><b>${esc(f.name)}</b><small style="display:block;color:var(--ink3)">${esc(f.use)}</small></div></div>`).join('');
  openModal('How to use', `<div class="card" style="padding:14px 16px">
      <b>Moving around</b>
      <div class="muted" style="margin:4px 0 10px">One finger: orbit. Two fingers: pan and pinch to zoom. Buttons on the right jump to Top, Front and Side views.</div>
      <b>Building</b>
      <div class="muted" style="margin:4px 0 10px">Add a ready-made frame from <b>Shapes</b>, or tap <b>Pipe</b> and then tap the workplane to place a start point. Tap an arrow to add a pipe, or drag an arrow to choose the length. The new end is selected, so you can keep tapping arrows to draw.</div>
      <b>Editing</b>
      <div class="muted" style="margin:4px 0 10px">Tap a pipe to type a length or drag its orange arrows. Tap a joint and switch to <b>Move</b> to slide a whole structure. With <b>Pipe</b> on, tapping an existing pipe adds a joint you can branch from.</div>
      <b>Fittings &amp; parts</b>
      <div class="muted" style="margin:4px 0 0">Wherever pipes meet, the matching Kee Klamp fitting is picked from how many pipes meet and at what angles. <b>Parts</b> lists fittings, cut lengths and how much stock pipe to buy. Tap the tag button to label every fitting and pipe.</div>
    </div>
    <div class="sect">Fittings this app uses</div><div class="card">${legend}</div>
    <div class="muted" style="margin:12px 4px">Tip: in Safari tap Share → Add to Home Screen to use Klamp Studio full screen and offline.</div>`);
}

// ---------------------------------------------------------------- wiring
$('bDesigns').innerHTML = icon('grid');
$('bUndo').innerHTML = icon('undo');
$('bRedo').innerHTML = icon('redo');
$('bMenu').innerHTML = icon('more');
document.querySelector('#title .logo').innerHTML = icon('logo');
document.querySelector('[data-view="home"]').innerHTML = icon('home');
document.querySelector('[data-view="fit"]').innerHTML = icon('fit');
$('bLabels').innerHTML = icon('tag');
$('mClose').innerHTML = icon('x');
$('tShapes').querySelector('span').outerHTML = icon('cube');
$('tPipe').querySelector('span').outerHTML = icon('pipe');
$('tParts').querySelector('span').outerHTML = icon('list');
$('tSettings').querySelector('span').outerHTML = icon('sliders');

$('bUndo').onclick = undo;
$('bRedo').onclick = redo;
$('bMenu').onclick = openMenu;
$('bDesigns').onclick = openDesigns;
$('title').onclick = rename;
document.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => viewTo(b.dataset.view); });
$('bLabels').onclick = () => {
  labelsOn = !labelsOn;
  $('bLabels').classList.toggle('on', labelsOn);
  buildLabels(preview || model);
  dirty = true;
};
$('tShapes').onclick = openShapes;
$('eShapes').onclick = openShapes;
$('tPipe').onclick = () => setTool(tool === 'point' ? 'select' : 'point');
$('ePipe').onclick = () => setTool('point');
$('tParts').onclick = () => { setTool('select'); openParts(); };
$('tSettings').onclick = () => { setTool('select'); openSettings(); };

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { if (sel) { e.preventDefault(); deleteSelection(); } }
  else if (e.key === 'Escape') { if (modal.classList.contains('open')) closeModal(); else { setTool('select'); select(null); } }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && designId) saveNow(); });
window.addEventListener('pagehide', () => { if (designId) saveNow(); });

// ---------------------------------------------------------------- start
resize();
const cur = lsGet(LS_CUR);
const ix = loadIndex();
let opened = false;
if (cur && ix.some((d) => d.id === cur)) opened = loadDesign(cur);
if (!opened && ix.length) opened = loadDesign(ix[0].id);
if (!opened) {
  designId = newId();
  rebuild(); renderPanel(); updateUndo();
  viewTo('home', true);
}
requestAnimationFrame(loop);
$('boot').style.display = 'none';
if (!lsGet(LS_SEEN)) { lsSet(LS_SEEN, '1'); setTimeout(openHelp, 400); }

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
