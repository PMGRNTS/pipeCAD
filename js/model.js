// Klamp Studio — pure model logic (no three.js). Units: millimetres. Y is up.

export const AXES = ['x', 'y', 'z'];
export const DIRS = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0],
  '+y': [0, 1, 0], '-y': [0, -1, 0],
  '+z': [0, 0, 1], '-z': [0, 0, -1],
};
const EPS = 0.05; // mm

// Kee Klamp size codes → pipe outside diameter
export const SIZES = {
  '4': { code: '4', nps: '1/2"', od: 21.3, odIn: '0.84"' },
  '5': { code: '5', nps: '3/4"', od: 26.9, odIn: '1.05"' },
  '6': { code: '6', nps: '1"', od: 33.7, odIn: '1.315"' },
  '7': { code: '7', nps: '1-1/4"', od: 42.4, odIn: '1.66"' },
  '8': { code: '8', nps: '1-1/2"', od: 48.3, odIn: '1.9"' },
  '9': { code: '9', nps: '2"', od: 60.3, odIn: '2.375"' },
};

export const FITTINGS = {
  '10': { name: 'Single Socket Tee', use: 'One pipe passes through; a second pipe ends in the socket at 90°.' },
  '14': { name: 'Straight Coupling', use: 'Joins two pipes end-to-end in a straight line.' },
  '15': { name: '90° Elbow', use: 'Corner where two pipe ends meet at 90°.' },
  '20': { name: 'Side Outlet Elbow', use: 'Three-way corner: three pipe ends at right angles (box corners).' },
  '21': { name: '90° Side Outlet Tee', use: 'One pipe passes through; two pipes end at 90° to each other.' },
  '25': { name: 'Three Socket Tee', use: 'Tee where all three pipes end in the fitting.' },
  '26': { name: 'Two Socket Cross', use: 'One pipe passes through; two pipes end opposite each other.' },
  '35': { name: 'Three Socket Cross', use: 'One pipe passes through; three pipes end in it.' },
  '40': { name: 'Four Socket Cross', use: 'One pipe passes through; four pipes end in it.' },
  '61': { name: 'Flange', use: 'Bolts a pipe end to the floor or a wall.' },
  '84': { name: 'Malleable Plug', use: 'Caps an open pipe end.' },
};

// ---------- basics ----------
export function newModel(units = 'in') {
  const inch = units === 'in';
  return {
    app: 'klamp-studio', version: 1, name: 'Untitled design', nextId: 1,
    nodes: [], pipes: [],
    settings: {
      units, size: '7',
      snap: inch ? 25.4 : 10,
      defaultLen: inch ? 304.8 : 300,
      stock: inch ? 6400.8 : 6000, // 21 ft / 6 m
      floorEnd: 'flange', // flange | plug | open
      capEnds: false,
      deduct: true,
    },
  };
}

export const clone = (m) => JSON.parse(JSON.stringify(m));
const r2 = (v) => Math.round(v * 100) / 100;
export const P = (n) => [n.x, n.y, n.z];
const keyOf = (x, y, z) => `${Math.round(x * 10)},${Math.round(y * 10)},${Math.round(z * 10)}`;
const nid = (m) => m.nextId++;

export function axisIndex(A, B) {
  const d = [Math.abs(A.x - B.x), Math.abs(A.y - B.y), Math.abs(A.z - B.z)];
  const moving = d.filter((v) => v > EPS).length;
  if (moving !== 1) return -1;
  return d.findIndex((v) => v > EPS);
}
const c = (n, i) => (i === 0 ? n.x : i === 1 ? n.y : n.z);
const setC = (n, i, v) => { if (i === 0) n.x = v; else if (i === 1) n.y = v; else n.z = v; };

export function pipeLen(m, p, byId) {
  const map = byId || new Map(m.nodes.map((n) => [n.id, n]));
  const A = map.get(p.a), B = map.get(p.b);
  return Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
}

export function findNodeAt(m, x, y, z) {
  const k = keyOf(r2(x), r2(y), r2(z));
  return m.nodes.find((n) => keyOf(n.x, n.y, n.z) === k) || null;
}

export function addNode(m, x, y, z) {
  const ex = findNodeAt(m, x, y, z);
  if (ex) return ex.id;
  const n = { id: nid(m), x: r2(x), y: r2(y), z: r2(z) };
  m.nodes.push(n);
  return n.id;
}

export function addPipe(m, a, b) {
  if (a === b) return null;
  const p = { id: nid(m), a, b };
  m.pipes.push(p);
  return p.id;
}

// Merge coincident nodes, split pipes at junctions/crossings, remove duplicates.
export function normalize(m) {
  for (const n of m.nodes) { n.x = r2(n.x); n.y = r2(n.y); n.z = r2(n.z); }
  // merge duplicate nodes
  const byKey = new Map();
  const remap = new Map();
  const nodes = [];
  for (const n of m.nodes) {
    const k = keyOf(n.x, n.y, n.z);
    const keep = byKey.get(k);
    if (keep) {
      remap.set(n.id, keep.id);
      if (n.thru && !keep.thru) keep.thru = n.thru;
      if (n.split) keep.split = true;
    } else { byKey.set(k, n); remap.set(n.id, n.id); nodes.push(n); }
  }
  m.nodes = nodes;
  let byId = new Map(nodes.map((n) => [n.id, n]));
  let pipes = [];
  for (const p of m.pipes) {
    const a = remap.get(p.a), b = remap.get(p.b);
    if (a == null || b == null || a === b) continue;
    if (axisIndex(byId.get(a), byId.get(b)) < 0) continue;
    pipes.push({ id: p.id, a, b });
  }

  // perpendicular crossings → add junction node
  const info = pipes.map((p) => {
    const A = byId.get(p.a), B = byId.get(p.b);
    const ax = axisIndex(A, B);
    return { p, ax, A, lo: Math.min(c(A, ax), c(B, ax)), hi: Math.max(c(A, ax), c(B, ax)) };
  });
  const addAt = (x, y, z) => {
    const k = keyOf(x, y, z);
    if (byKey.has(k)) return;
    const n = { id: nid(m), x: r2(x), y: r2(y), z: r2(z) };
    byKey.set(k, n); m.nodes.push(n); byId.set(n.id, n);
  };
  for (let i = 0; i < info.length; i++) {
    const P1 = info[i];
    for (let j = i + 1; j < info.length; j++) {
      const P2 = info[j];
      if (P1.ax === P2.ax) continue;
      const k = 3 - P1.ax - P2.ax;
      if (Math.abs(c(P1.A, k) - c(P2.A, k)) > EPS) continue;
      const xi = c(P2.A, P1.ax); // P2 is fixed along P1's axis
      const xj = c(P1.A, P2.ax);
      if (xi < P1.lo - EPS || xi > P1.hi + EPS) continue;
      if (xj < P2.lo - EPS || xj > P2.hi + EPS) continue;
      const pt = [0, 0, 0];
      pt[P1.ax] = xi; pt[P2.ax] = xj; pt[k] = c(P1.A, k);
      addAt(pt[0], pt[1], pt[2]);
    }
  }

  // split pipes at nodes lying on their interior
  const lines = new Map(); // `${axis}|${o1}|${o2}` → nodes
  const lineKey = (ax, n) => {
    const o = [0, 1, 2].filter((i) => i !== ax).map((i) => Math.round(c(n, i) * 10));
    return `${ax}|${o[0]}|${o[1]}`;
  };
  for (const n of m.nodes) {
    for (let ax = 0; ax < 3; ax++) {
      const k = lineKey(ax, n);
      if (!lines.has(k)) lines.set(k, []);
      lines.get(k).push(n);
    }
  }
  const out = [];
  for (const p of pipes) {
    const A = byId.get(p.a), B = byId.get(p.b);
    const ax = axisIndex(A, B);
    const lo = Math.min(c(A, ax), c(B, ax)), hi = Math.max(c(A, ax), c(B, ax));
    const inner = (lines.get(lineKey(ax, A)) || [])
      .filter((n) => c(n, ax) > lo + EPS && c(n, ax) < hi - EPS)
      .sort((u, v) => c(u, ax) - c(v, ax));
    if (!inner.length) { out.push(p); continue; }
    const start = c(A, ax) < c(B, ax) ? A : B;
    const end = start === A ? B : A;
    const chain = [start, ...inner, end];
    for (let i = 0; i < chain.length - 1; i++) {
      out.push({ id: i === 0 ? p.id : nid(m), a: chain[i].id, b: chain[i + 1].id });
    }
  }
  // dedupe
  const seen = new Set();
  m.pipes = out.filter((p) => {
    const k = p.a < p.b ? `${p.a}-${p.b}` : `${p.b}-${p.a}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  return remap;
}

export function pruneOrphans(m, keep = []) {
  const used = new Set();
  for (const p of m.pipes) { used.add(p.a); used.add(p.b); }
  m.nodes = m.nodes.filter((n) => used.has(n.id) || keep.includes(n.id));
}

export function buildAdj(m) {
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const adj = new Map(m.nodes.map((n) => [n.id, []]));
  for (const p of m.pipes) {
    const A = byId.get(p.a), B = byId.get(p.b);
    if (!A || !B) continue;
    const ax = axisIndex(A, B);
    if (ax < 0) continue;
    const plus = c(B, ax) > c(A, ax);
    adj.get(p.a).push({ pipe: p, other: p.b, dir: (plus ? '+' : '-') + AXES[ax] });
    adj.get(p.b).push({ pipe: p, other: p.a, dir: (plus ? '-' : '+') + AXES[ax] });
  }
  return { byId, adj };
}

// ---------- fitting detection ----------
function chooseThru(node, pairs) {
  if (node.thru && pairs.includes(node.thru)) return node.thru;
  if (pairs.includes('y')) return 'y';
  return pairs[0];
}

export function classify(m, node, links) {
  const s = m.settings;
  const dirs = [...new Set(links.map((l) => l.dir))];
  const n = dirs.length;
  const pairs = AXES.filter((a) => dirs.includes('+' + a) && dirs.includes('-' + a));
  const base = { kind: 'none', code: null, thru: null, dirs, n, pairs, canSplit: false, thruOptions: [] };
  if (n === 0) return { ...base, kind: 'point' };
  if (n === 1) {
    const onFloor = dirs[0] === '+y' && Math.abs(node.y) < 0.5;
    if (onFloor) {
      if (s.floorEnd === 'flange') return { ...base, kind: 'flange', code: '61', floor: true };
      if (s.floorEnd === 'plug') return { ...base, kind: 'plug', code: '84', floor: true };
      return { ...base, kind: 'open', floor: true };
    }
    return s.capEnds ? { ...base, kind: 'plug', code: '84' } : { ...base, kind: 'open' };
  }
  if (n === 2) {
    if (pairs.length === 1) {
      return node.split
        ? { ...base, kind: 'fitting', code: '14', canSplit: true }
        : { ...base, kind: 'inline', thru: pairs[0], canSplit: true };
    }
    return { ...base, kind: 'fitting', code: '15' };
  }
  if (n === 3) {
    if (pairs.length === 1) {
      return node.split
        ? { ...base, kind: 'fitting', code: '25', canSplit: true }
        : { ...base, kind: 'fitting', code: '10', thru: pairs[0], canSplit: true };
    }
    return { ...base, kind: 'fitting', code: '20' };
  }
  const opts = pairs.length > 1 ? pairs : [];
  if (n === 4) {
    if (pairs.length === 2) return { ...base, kind: 'fitting', code: '26', thru: chooseThru(node, pairs), thruOptions: opts };
    return { ...base, kind: 'fitting', code: '21', thru: pairs[0] };
  }
  if (n === 5) return { ...base, kind: 'fitting', code: '35', thru: chooseThru(node, pairs), thruOptions: opts };
  return { ...base, kind: 'fitting', code: '40', thru: chooseThru(node, pairs), thruOptions: opts };
}

export function classifyAll(m) {
  const { byId, adj } = buildAdj(m);
  const cls = new Map();
  for (const n of m.nodes) cls.set(n.id, classify(m, n, adj.get(n.id)));
  return { byId, adj, cls };
}

// ---------- editing operations ----------
export function extend(m, nodeId, dir, len) {
  const n = m.nodes.find((q) => q.id === nodeId);
  if (!n || !(len > EPS)) return null;
  const v = DIRS[dir];
  const tx = n.x + v[0] * len, ty = n.y + v[1] * len, tz = n.z + v[2] * len;
  const b = addNode(m, tx, ty, tz);
  addPipe(m, nodeId, b);
  normalize(m);
  const end = findNodeAt(m, tx, ty, tz);
  return end ? end.id : null;
}

export function componentOf(m, nodeId) {
  const { adj } = buildAdj(m);
  const seen = new Set([nodeId]);
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop();
    for (const l of adj.get(id) || []) if (!seen.has(l.other)) { seen.add(l.other); stack.push(l.other); }
  }
  return seen;
}

export function translate(m, ids, d) {
  for (const n of m.nodes) if (ids.has(n.id)) { n.x += d[0]; n.y += d[1]; n.z += d[2]; }
  normalize(m);
}

// Change a pipe's length by moving one end. If that end is a junction,
// everything in the same structure beyond that end is shifted, so all pipes stay square.
export function stretchPipe(m, pipeId, endId, delta, minLen = 1) {
  const { byId, adj } = buildAdj(m);
  const p = m.pipes.find((q) => q.id === pipeId);
  if (!p) return;
  const E = byId.get(endId), O = byId.get(p.a === endId ? p.b : p.a);
  const ax = axisIndex(E, O);
  if (ax < 0) return;
  const sign = c(E, ax) > c(O, ax) ? 1 : -1;
  const cur = Math.abs(c(E, ax) - c(O, ax));
  const next = Math.max(minLen, cur + delta);
  const d = next - cur;
  if (Math.abs(d) < EPS) return;
  if (adj.get(E.id).length === 1) {
    setC(E, ax, c(E, ax) + sign * d);
  } else {
    const comp = componentOf(m, E.id);
    const plane = c(E, ax);
    for (const n of m.nodes) {
      if (!comp.has(n.id)) continue;
      const v = c(n, ax);
      if (sign > 0 ? v >= plane - EPS : v <= plane + EPS) setC(n, ax, v + sign * d);
    }
  }
  normalize(m);
}

export function preferredEnd(m, pipeId) {
  const { byId, adj } = buildAdj(m);
  const p = m.pipes.find((q) => q.id === pipeId);
  const A = byId.get(p.a), B = byId.get(p.b);
  const ax = axisIndex(A, B);
  const hiEnd = c(B, ax) > c(A, ax) ? B.id : A.id;
  if (ax === 1) return hiEnd; // vertical pipes grow upward, never through the floor
  const la = adj.get(A.id).length, lb = adj.get(B.id).length;
  if (la === 1 && lb > 1) return A.id;
  if (lb === 1 && la > 1) return B.id;
  return hiEnd;
}

export function setPipeLength(m, pipeId, newLen, minLen = 1) {
  const p = m.pipes.find((q) => q.id === pipeId);
  if (!p) return;
  const cur = pipeLen(m, p);
  stretchPipe(m, pipeId, preferredEnd(m, pipeId), newLen - cur, minLen);
}

export function splitPipe(m, pipeId, snap = 1) {
  const p = m.pipes.find((q) => q.id === pipeId);
  if (!p) return null;
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const A = byId.get(p.a), B = byId.get(p.b);
  const ax = axisIndex(A, B);
  const lo = Math.min(c(A, ax), c(B, ax)), hi = Math.max(c(A, ax), c(B, ax));
  let mid = Math.round(((lo + hi) / 2 - lo) / snap) * snap + lo;
  if (mid <= lo + EPS || mid >= hi - EPS) mid = (lo + hi) / 2;
  const pt = [A.x, A.y, A.z];
  pt[ax] = mid;
  const id = addNode(m, ...pt);
  normalize(m);
  return id;
}

export function deletePipe(m, pipeId) {
  const p = m.pipes.find((q) => q.id === pipeId);
  if (!p) return;
  m.pipes = m.pipes.filter((q) => q.id !== pipeId);
  pruneOrphans(m);
}

export function deleteNode(m, nodeId) {
  m.pipes = m.pipes.filter((p) => p.a !== nodeId && p.b !== nodeId);
  m.nodes = m.nodes.filter((n) => n.id !== nodeId);
  pruneOrphans(m);
}

// Remove an in-line joint, joining its two pipes into one.
export function mergeAt(m, nodeId) {
  const { adj } = buildAdj(m);
  const L = adj.get(nodeId) || [];
  if (L.length !== 2) return false;
  const a = L[0].other, b = L[1].other;
  m.pipes = m.pipes.filter((p) => p.id !== L[0].pipe.id && p.id !== L[1].pipe.id);
  m.nodes = m.nodes.filter((n) => n.id !== nodeId);
  addPipe(m, a, b);
  normalize(m);
  return true;
}

export function deleteComponent(m, nodeId) {
  const comp = componentOf(m, nodeId);
  m.pipes = m.pipes.filter((p) => !comp.has(p.a));
  m.nodes = m.nodes.filter((n) => !comp.has(n.id));
}

export function bounds(m, ids) {
  const ns = ids ? m.nodes.filter((n) => ids.has(n.id)) : m.nodes;
  if (!ns.length) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const n of ns) {
    const q = P(n);
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], q[i]); max[i] = Math.max(max[i], q[i]); }
  }
  return { min, max };
}

export function duplicateComponent(m, nodeId, gap) {
  const comp = componentOf(m, nodeId);
  const b = bounds(m, comp);
  const dx = b.max[0] - b.min[0] + gap;
  const map = new Map();
  for (const n of m.nodes.filter((q) => comp.has(q.id))) {
    const id = nid(m);
    map.set(n.id, id);
    const copy = { ...n, id, x: n.x + dx };
    m.nodes.push(copy);
  }
  for (const p of m.pipes.filter((q) => comp.has(q.a))) addPipe(m, map.get(p.a), map.get(p.b));
  normalize(m);
  const first = [...map.values()].find((id) => m.nodes.some((n) => n.id === id));
  return first ?? null;
}

// ---------- shapes library ----------
const IN = 25.4;
export const SHAPES = [
  { id: 'table', name: 'Table', params: [['w', 'Width', 60 * IN, 1500], ['d', 'Depth', 30 * IN, 750], ['h', 'Height', 30 * IN, 750], ['s', 'Lower shelf height (0 = none)', 8 * IN, 200]] },
  { id: 'shelf', name: 'Shelving', params: [['w', 'Width', 48 * IN, 1200], ['d', 'Depth', 18 * IN, 450], ['h', 'Height', 72 * IN, 1800], ['n', 'Shelf levels', 4, 4, 'count'], ['b', 'Bottom shelf height', 4 * IN, 100]] },
  { id: 'bench', name: 'Workbench', params: [['w', 'Width', 72 * IN, 1800], ['d', 'Depth', 30 * IN, 750], ['h', 'Height', 36 * IN, 900], ['s', 'Lower shelf height (0 = none)', 8 * IN, 200], ['t', 'Back upright height (0 = none)', 66 * IN, 1650]] },
  { id: 'railing', name: 'Railing', params: [['l', 'Length', 120 * IN, 3000], ['h', 'Height', 42 * IN, 1100], ['n', 'Posts', 3, 3, 'count'], ['m', 'Middle rail (1 = yes, 0 = no)', 1, 1, 'count']] },
  { id: 'box', name: 'Box frame', params: [['w', 'Width', 36 * IN, 900], ['d', 'Depth', 36 * IN, 900], ['h', 'Height', 36 * IN, 900]] },
  { id: 'canopy', name: 'Canopy', params: [['w', 'Width', 120 * IN, 3000], ['d', 'Depth', 96 * IN, 2400], ['h', 'Height', 96 * IN, 2400], ['n', 'Roof cross rails', 3, 3, 'count']] },
  { id: 'frame', name: 'Flat frame', params: [['w', 'Width', 48 * IN, 1200], ['h', 'Height', 36 * IN, 900], ['n', 'Middle rails', 1, 1, 'count']] },
  { id: 'post', name: 'Post', params: [['h', 'Height', 36 * IN, 900]] },
];

export function shapeDefaults(shape, units) {
  const o = {};
  for (const [k, , vin, vmm] of shape.params) o[k] = units === 'in' ? vin : vmm;
  return o;
}

export function buildShape(m, id, v, origin = [0, 0, 0]) {
  const segs = [];
  const seg = (a, b) => segs.push([a, b]);
  const rect = (w, d, y) => {
    seg([0, y, 0], [w, y, 0]); seg([w, y, 0], [w, y, d]);
    seg([w, y, d], [0, y, d]); seg([0, y, d], [0, y, 0]);
  };
  const legs = (w, d, h) => {
    for (const [x, z] of [[0, 0], [v.w, 0], [v.w, v.d], [0, v.d]]) seg([x, 0, z], [x, h, z]);
  };
  const cnt = (x, min) => Math.max(min, Math.round(x || 0));
  switch (id) {
    case 'box': legs(v.w, v.d, v.h); rect(v.w, v.d, 0); rect(v.w, v.d, v.h); break;
    case 'table': legs(v.w, v.d, v.h); rect(v.w, v.d, v.h); if (v.s > 0 && v.s < v.h) rect(v.w, v.d, v.s); break;
    case 'bench': {
      seg([0, 0, 0], [0, v.h, 0]); seg([v.w, 0, 0], [v.w, v.h, 0]);
      const top = v.t > v.h ? v.t : v.h;
      seg([0, 0, v.d], [0, top, v.d]); seg([v.w, 0, v.d], [v.w, top, v.d]);
      rect(v.w, v.d, v.h);
      if (v.s > 0 && v.s < v.h) rect(v.w, v.d, v.s);
      if (v.t > v.h) seg([0, top, v.d], [v.w, top, v.d]);
      break;
    }
    case 'shelf': {
      legs(v.w, v.d, v.h);
      const n = cnt(v.n, 2);
      const b = Math.min(Math.max(0, v.b), v.h);
      for (let i = 0; i < n; i++) rect(v.w, v.d, b + ((v.h - b) * i) / (n - 1));
      break;
    }
    case 'railing': {
      const n = cnt(v.n, 2);
      for (let i = 0; i < n; i++) { const x = (v.l * i) / (n - 1); seg([x, 0, 0], [x, v.h, 0]); }
      seg([0, v.h, 0], [v.l, v.h, 0]);
      if (v.m >= 1) seg([0, v.h / 2, 0], [v.l, v.h / 2, 0]);
      break;
    }
    case 'canopy': {
      legs(v.w, v.d, v.h); rect(v.w, v.d, v.h);
      const n = cnt(v.n, 0);
      for (let i = 1; i <= n; i++) { const x = (v.w * i) / (n + 1); seg([x, v.h, 0], [x, v.h, v.d]); }
      break;
    }
    case 'frame': {
      seg([0, 0, 0], [0, v.h, 0]); seg([v.w, 0, 0], [v.w, v.h, 0]);
      seg([0, 0, 0], [v.w, 0, 0]); seg([0, v.h, 0], [v.w, v.h, 0]);
      const n = cnt(v.n, 0);
      for (let i = 1; i <= n; i++) { const y = (v.h * i) / (n + 1); seg([0, y, 0], [v.w, y, 0]); }
      break;
    }
    case 'post': seg([0, 0, 0], [0, v.h, 0]); break;
    default: return null;
  }
  const snap = m.settings.snap || 1;
  const sn = (x) => Math.round(x / snap) * snap;
  let firstId = null;
  for (const [a, b] of segs) {
    const A = a.map((q, i) => sn(q) + origin[i]);
    const B = b.map((q, i) => sn(q) + origin[i]);
    const ia = addNode(m, ...A), ib = addNode(m, ...B);
    if (firstId == null) firstId = ia;
    addPipe(m, ia, ib);
  }
  const at = m.nodes.find((n) => n.id === firstId);
  const pos = at ? P(at) : null;
  normalize(m);
  return pos ? findNodeAt(m, ...pos)?.id : null;
}

// ---------- bill of materials ----------
export function computeBOM(m) {
  const s = m.settings;
  const size = SIZES[s.size] || SIZES['7'];
  const { byId, adj, cls } = classifyAll(m);
  const parent = new Map(m.pipes.map((p) => [p.id, p.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const n of m.nodes) {
    const k = cls.get(n.id);
    if (!k.thru) continue;
    const L = adj.get(n.id);
    const p1 = L.find((l) => l.dir === '+' + k.thru), p2 = L.find((l) => l.dir === '-' + k.thru);
    if (p1 && p2) union(p1.pipe.id, p2.pipe.id);
  }
  const groups = new Map();
  for (const p of m.pipes) {
    const r = find(p.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(p);
  }
  const socketDeduct = s.deduct ? size.od / 2 : 0;
  const flangeDeduct = s.deduct ? 6 : 0;
  const pieces = [];
  const warnings = [];
  let couplings = 0;
  let total = 0;
  for (const ps of groups.values()) {
    const count = new Map();
    let len = 0;
    for (const p of ps) {
      len += pipeLen(m, p, byId);
      count.set(p.a, (count.get(p.a) || 0) + 1);
      count.set(p.b, (count.get(p.b) || 0) + 1);
    }
    let ded = 0;
    for (const [id, k] of count) {
      if (k !== 1) continue;
      const cl = cls.get(id);
      if (cl.kind === 'fitting') ded += socketDeduct;
      else if (cl.kind === 'flange') ded += flangeDeduct;
    }
    const cut = Math.max(0, len - ded);
    total += cut;
    if (cut > s.stock) {
      const k = Math.ceil(cut / s.stock);
      couplings += k - 1;
      for (let i = 0; i < k; i++) pieces.push({ len: cut / k, members: ps.map((p) => p.id), long: true });
      warnings.push(`A ${fmtLen(cut, s.units)} run is longer than your stock length, so it is split into ${k} pieces with ${k - 1} straight coupling(s) (Type 14).`);
    } else {
      pieces.push({ len: cut, members: ps.map((p) => p.id) });
    }
  }

  const fit = new Map();
  for (const n of m.nodes) {
    const k = cls.get(n.id);
    if (k.code) fit.set(k.code, (fit.get(k.code) || 0) + 1);
  }
  if (couplings) fit.set('14', (fit.get('14') || 0) + couplings);
  const fittings = [...fit.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([code, qty]) => ({ code, part: `${code}-${size.code}`, name: FITTINGS[code].name, use: FITTINGS[code].use, qty }));

  // group cut list
  const unit = s.units === 'in' ? IN / 16 : 1;
  const cuts = new Map();
  for (const p of pieces) {
    const k = Math.round(p.len / unit) * unit;
    cuts.set(k, (cuts.get(k) || 0) + 1);
  }
  const cutList = [...cuts.entries()].sort((a, b) => b[0] - a[0]).map(([len, qty]) => ({ len, qty }));

  // stock packing: first-fit decreasing
  const kerf = 3.2;
  const sticks = [];
  for (const p of [...pieces].sort((a, b) => b.len - a.len)) {
    let placed = false;
    for (const st of sticks) {
      if (st.used + p.len + (st.cuts.length ? kerf : 0) <= s.stock + 0.01) {
        st.used += p.len + (st.cuts.length ? kerf : 0); st.cuts.push(p.len); placed = true; break;
      }
    }
    if (!placed) sticks.push({ used: p.len, cuts: [p.len] });
  }

  const unknown = m.nodes.filter((n) => cls.get(n.id).kind === 'point').length;
  if (unknown) warnings.push(`${unknown} loose point(s) with no pipes are ignored.`);

  return {
    size, fittings, cutList, pieces, sticks, totalLen: total,
    fittingCount: fittings.reduce((a, f) => a + f.qty, 0),
    pipeCount: pieces.length, warnings,
  };
}

// ---------- units ----------
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

export function fmtLen(mm, units, opts = {}) {
  if (!isFinite(mm)) return '—';
  if (units === 'mm') {
    const v = Math.round(mm * 10) / 10;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}${opts.bare ? '' : ' mm'}`;
  }
  const neg = mm < 0;
  const six = Math.round(Math.abs(mm) / IN * 16);
  const whole = Math.floor(six / 16);
  let num = six % 16, den = 16;
  let s;
  if (num) { const g = gcd(num, den); num /= g; den /= g; s = whole ? `${whole}-${num}/${den}` : `${num}/${den}`; }
  else s = `${whole}`;
  return `${neg ? '-' : ''}${s}${opts.bare ? '' : '"'}`;
}

export function fmtFeet(mm) {
  const inches = Math.round(mm / IN * 16) / 16;
  const ft = Math.floor(inches / 12);
  const rem = inches - ft * 12;
  return rem ? `${ft}' ${fmtLen(rem * IN, 'in')}` : `${ft}'`;
}

export function parseLen(str, units) {
  if (str == null) return NaN;
  const s = String(str).trim().toLowerCase().replace(/[″”“]/g, '"').replace(/[′’‘]/g, "'");
  if (!s) return NaN;
  let m;
  if ((m = s.match(/^(-?\d*\.?\d+)\s*(mm|cm|m)$/))) {
    const v = +m[1];
    return m[2] === 'mm' ? v : m[2] === 'cm' ? v * 10 : v * 1000;
  }
  let feet = 0, rest = s;
  if ((m = s.match(/^(-?\d*\.?\d+)\s*(?:'|ft|feet|foot)\s*(.*)$/))) { feet = +m[1]; rest = m[2]; }
  rest = rest.replace(/\s*("|in|inch|inches)$/, '').trim();
  let inches = 0;
  if (rest) {
    m = rest.match(/^(\d*\.?\d+)?\s*-?\s*(?:(\d+)\/(\d+))?$/);
    if (!m || (!m[1] && !m[2])) return NaN;
    inches = (m[1] ? +m[1] : 0) + (m[2] ? m[2] / m[3] : 0);
  }
  const explicitImperial = /["']|in|ft|feet|foot/.test(s);
  if (units === 'mm' && !explicitImperial) return inches;
  return (feet * 12 + inches) * IN;
}

export function validate(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.nodes) || !Array.isArray(obj.pipes)) return null;
  const base = newModel(obj.settings?.units === 'mm' ? 'mm' : 'in');
  const m = { ...base, name: String(obj.name || 'Imported design').slice(0, 80) };
  m.settings = { ...base.settings, ...(obj.settings || {}) };
  if (!SIZES[m.settings.size]) m.settings.size = '7';
  m.nodes = obj.nodes.filter((n) => [n.x, n.y, n.z].every(Number.isFinite)).map((n) => ({
    id: Number(n.id), x: n.x, y: n.y, z: n.z,
    ...(AXES.includes(n.thru) ? { thru: n.thru } : {}), ...(n.split ? { split: true } : {}),
  }));
  const ids = new Set(m.nodes.map((n) => n.id));
  m.pipes = obj.pipes.filter((p) => ids.has(Number(p.a)) && ids.has(Number(p.b))).map((p) => ({ id: Number(p.id), a: Number(p.a), b: Number(p.b) }));
  m.nextId = Math.max(1, ...m.nodes.map((n) => n.id + 1), ...m.pipes.map((p) => p.id + 1));
  normalize(m);
  return m;
}
