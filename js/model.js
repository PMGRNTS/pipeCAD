// Klamp Studio — pure model logic (no three.js). Units: millimetres. Y is up.
// Pipes may point in any direction; fittings are chosen from the angles between pipes.

export const AXES = ['x', 'y', 'z'];
export const DIRS = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0],
  '+y': [0, 1, 0], '-y': [0, -1, 0],
  '+z': [0, 0, 1], '-z': [0, 0, -1],
};
const EPS = 0.05;   // mm, coordinate tolerance
const ON = 0.3;     // mm, "lies on a pipe" tolerance
const PAR = 0.9995; // cos of ~1.8°: parallel
const ORTH = 0.0175; // |cos| below this (~1°): square

// ---------- vector helpers ----------
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export const vnorm = (a) => { const l = vlen(a); return l > 1e-12 ? vscale(a, 1 / l) : [0, 0, 0]; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const angleBetween = (u, v) => deg(Math.acos(clamp(vdot(vnorm(u), vnorm(v)), -1, 1)));

// Rotate v about unit axis k by angle a (Rodrigues).
export function rotVec(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const kv = vcross(k, v), kd = vdot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
}
export function anyPerp(v) {
  const t = Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return vnorm(vcross(v, t));
}

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
  '12': { name: '45° Single Socket Tee', use: 'One pipe passes through; a branch ends in the socket at 45°.' },
  '14': { name: 'Straight Coupling', use: 'Joins two pipes end-to-end in a straight line.' },
  '15': { name: '90° Elbow', use: 'Corner where two pipe ends meet at 90°.' },
  '20': { name: 'Side Outlet Elbow', use: 'Three-way corner: three pipe ends at right angles (box corners).' },
  '21': { name: '90° Side Outlet Tee', use: 'One pipe passes through; two pipes end at 90° to each other.' },
  '25': { name: 'Three Socket Tee', use: 'Tee where all three pipes end in the fitting.' },
  '26': { name: 'Two Socket Cross', use: 'One pipe passes through; two pipes end opposite each other.' },
  '29': { name: '30°–60° Single Socket Tee', use: 'Adjustable tee: one pipe passes through, a branch at 30° to 60°.' },
  '35': { name: 'Three Socket Cross', use: 'One pipe passes through; three pipes end in it.' },
  '40': { name: 'Four Socket Cross', use: 'One pipe passes through; four pipes end in it.' },
  '55': { name: 'Obtuse Angle Elbow', use: 'Two pipe ends meeting at a shallow bend (about 125°–178°).' },
  '61': { name: 'Flange', use: 'Bolts a pipe end to the floor or a wall.' },
  '84': { name: 'Malleable Plug', use: 'Caps an open pipe end.' },
  '86': { name: 'Angle Tee', use: 'Like Type 10, for a branch within ±11° of square (sloped rails).' },
  '87': { name: 'Angle Elbow', use: 'Like Type 15, for a corner within ±11° of square.' },
  '89': { name: 'Two Socket Angle Cross', use: 'Like Type 26, for branches within ±11° of square.' },
  'C50': { name: 'Single Swivel Socket', use: 'F50 + M50 swivel pair for braces and other angles fixed fittings can’t make.', dual: true },
  'C58': { name: 'Swivel Flange', use: 'Flange with a swivel socket, for an angled pipe meeting the floor.' },
};
export const partNo = (code, size) => (FITTINGS[code]?.dual ? `${code}-${size}${size}` : `${code}-${size}`);
const codeOrder = (c) => { const n = parseFloat(String(c).replace(/^\D+/, '')); return (/^\d/.test(c) ? 0 : 1000) + (isNaN(n) ? 999 : n); };

// ---------- basics ----------
export function newModel(units = 'in') {
  const inch = units === 'in';
  return {
    app: 'klamp-studio', version: 2, name: 'Untitled design', nextId: 1,
    nodes: [], pipes: [],
    settings: {
      units, size: '7',
      snap: inch ? 25.4 : 10,
      angleSnap: 15,
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
const setP = (n, p) => { n.x = p[0]; n.y = p[1]; n.z = p[2]; };
const keyOf = (x, y, z) => `${Math.round(x * 10)},${Math.round(y * 10)},${Math.round(z * 10)}`;
const nid = (m) => m.nextId++;

// Index of the world axis a pipe runs along, or -1 if it is angled.
export function axisIndex(A, B) {
  const d = vnorm(vsub(P(B), P(A)));
  for (let i = 0; i < 3; i++) if (Math.abs(d[i]) > PAR) return i;
  return -1;
}
export function pipeDir(A, B) { return vnorm(vsub(P(B), P(A))); }

export function pipeLen(m, p, byId) {
  const map = byId || new Map(m.nodes.map((n) => [n.id, n]));
  const A = map.get(p.a), B = map.get(p.b);
  return Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
}

export function findNodeAt(m, x, y, z) {
  const k = keyOf(r2(x), r2(y), r2(z));
  const hit = m.nodes.find((n) => keyOf(n.x, n.y, n.z) === k);
  if (hit) return hit;
  return m.nodes.find((n) => Math.hypot(n.x - x, n.y - y, n.z - z) < ON) || null;
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

// Merge coincident nodes, split pipes at junctions and crossings, remove duplicates.
export function normalize(m) {
  for (const n of m.nodes) { n.x = r2(n.x); n.y = r2(n.y); n.z = r2(n.z); }
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
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pipes = [];
  for (const p of m.pipes) {
    const a = remap.get(p.a), b = remap.get(p.b);
    if (a == null || b == null || a === b) continue;
    if (pipeLen(m, { a, b }, byId) < EPS * 2) continue;
    pipes.push({ id: p.id, a, b });
  }

  const seg = (p) => {
    const A = P(byId.get(p.a)), B = P(byId.get(p.b));
    const d = vsub(B, A), L = vlen(d);
    return { p, A, B, L, u: vscale(d, 1 / L),
      lo: [Math.min(A[0], B[0]) - ON, Math.min(A[1], B[1]) - ON, Math.min(A[2], B[2]) - ON],
      hi: [Math.max(A[0], B[0]) + ON, Math.max(A[1], B[1]) + ON, Math.max(A[2], B[2]) + ON] };
  };
  const nearNode = (pt) => {
    const k = keyOf(r2(pt[0]), r2(pt[1]), r2(pt[2]));
    if (byKey.has(k)) return byKey.get(k);
    for (const n of m.nodes) if (Math.hypot(n.x - pt[0], n.y - pt[1], n.z - pt[2]) < ON) return n;
    return null;
  };

  // crossings → junction node
  let segs = pipes.map(seg);
  const found = [];
  for (let i = 0; i < segs.length; i++) {
    const S1 = segs[i];
    for (let j = i + 1; j < segs.length; j++) {
      const S2 = segs[j];
      if (S1.lo[0] > S2.hi[0] || S2.lo[0] > S1.hi[0] || S1.lo[1] > S2.hi[1] || S2.lo[1] > S1.hi[1] || S1.lo[2] > S2.hi[2] || S2.lo[2] > S1.hi[2]) continue;
      const b = vdot(S1.u, S2.u);
      if (Math.abs(b) > PAR) continue;
      const w0 = vsub(S1.A, S2.A);
      const d = vdot(S1.u, w0), e = vdot(S2.u, w0), den = 1 - b * b;
      const s = (b * e - d) / den, t = (e - b * d) / den;
      if (s < -ON || s > S1.L + ON || t < -ON || t > S2.L + ON) continue;
      const p1 = vadd(S1.A, vscale(S1.u, s)), p2 = vadd(S2.A, vscale(S2.u, t));
      if (vlen(vsub(p1, p2)) > ON) continue;
      const atEnd1 = s < ON || s > S1.L - ON, atEnd2 = t < ON || t > S2.L - ON;
      if (atEnd1 && atEnd2) continue;
      found.push(vscale(vadd(p1, p2), 0.5));
    }
  }
  for (const pt of found) {
    if (nearNode(pt)) continue;
    const n = { id: nid(m), x: r2(pt[0]), y: r2(pt[1]), z: r2(pt[2]) };
    byKey.set(keyOf(n.x, n.y, n.z), n); m.nodes.push(n); byId.set(n.id, n);
  }

  // split pipes at nodes lying on their interior
  segs = pipes.map(seg);
  const out = [];
  for (const S of segs) {
    const inner = [];
    for (const n of m.nodes) {
      if (n.x < S.lo[0] || n.x > S.hi[0] || n.y < S.lo[1] || n.y > S.hi[1] || n.z < S.lo[2] || n.z > S.hi[2]) continue;
      const w = vsub(P(n), S.A);
      const t = vdot(w, S.u);
      if (t <= ON || t >= S.L - ON) continue;
      if (vlen(vsub(w, vscale(S.u, t))) > ON) continue;
      inner.push([t, n]);
    }
    if (!inner.length) { out.push(S.p); continue; }
    inner.sort((a, b) => a[0] - b[0]);
    const chain = [byId.get(S.p.a), ...inner.map((x) => x[1]), byId.get(S.p.b)];
    for (let i = 0; i < chain.length - 1; i++) {
      out.push({ id: i === 0 ? S.p.id : nid(m), a: chain[i].id, b: chain[i + 1].id });
    }
  }
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
    const u = pipeDir(A, B);
    adj.get(p.a).push({ pipe: p, other: p.b, vec: u });
    adj.get(p.b).push({ pipe: p, other: p.a, vec: vscale(u, -1) });
  }
  return { byId, adj };
}

// ---------- fitting detection ----------
function chooseThru(node, pairs, vecs) {
  if (Array.isArray(node.thru)) {
    const hit = pairs.find((pr) => Math.abs(vdot(vecs[pr[0]], node.thru)) > PAR);
    if (hit) return vecs[hit[0]];
  }
  let best = pairs[0];
  for (const pr of pairs) if (Math.abs(vecs[pr[0]][1]) > Math.abs(vecs[best[0]][1]) + 1e-6) best = pr;
  return vecs[best[0]];
}

function findPairs(vecs) {
  const pairs = [];
  for (let i = 0; i < vecs.length; i++) for (let j = i + 1; j < vecs.length; j++) if (vdot(vecs[i], vecs[j]) < -PAR) pairs.push([i, j]);
  return pairs;
}
const compatible = (u, v) => { const d = vdot(u, v); return Math.abs(d) < ORTH || d < -PAR; };

// Square joints: every pair of pipes is at 90° or 180°.
function squareJoint(node, vecs) {
  const n = vecs.length;
  const pairs = findPairs(vecs);
  const base = { n, vecs, pairs, thru: null, thruOptions: [], canSplit: false };
  if (n === 1) return { ...base, code: null };
  if (n === 2) {
    if (pairs.length === 1) return node.split ? { ...base, code: '14', canSplit: true } : { ...base, code: null, inline: true, thru: vecs[0], canSplit: true };
    return { ...base, code: '15' };
  }
  if (n === 3) {
    if (pairs.length === 1) {
      return node.split ? { ...base, code: '25', canSplit: true } : { ...base, code: '10', thru: vecs[pairs[0][0]], canSplit: true };
    }
    return { ...base, code: '20' };
  }
  const opts = pairs.length > 1 ? pairs.map((p) => vecs[p[0]]) : [];
  if (n === 4) {
    if (pairs.length === 2) return { ...base, code: '26', thru: chooseThru(node, pairs, vecs), thruOptions: opts };
    return { ...base, code: '21', thru: vecs[pairs[0][0]] };
  }
  if (n === 5) return { ...base, code: '35', thru: chooseThru(node, pairs, vecs), thruOptions: opts };
  return { ...base, code: '40', thru: chooseThru(node, pairs, vecs), thruOptions: opts };
}

export function classify(m, node, links) {
  const s = m.settings;
  const vecs = [];
  for (const l of links) if (!vecs.some((v) => vdot(v, l.vec) > PAR)) vecs.push(l.vec);
  const n = vecs.length;
  const base = { kind: 'none', code: null, thru: null, vecs, n, pairs: [], canSplit: false, thruOptions: [], extras: [], note: '', angled: false };
  if (n === 0) return { ...base, kind: 'point' };
  if (n === 1) {
    const v = vecs[0];
    const onFloor = Math.abs(node.y) < 0.5 && v[1] > 0.05;
    if (onFloor) {
      const upright = v[1] > PAR;
      if (s.floorEnd === 'flange') return upright ? { ...base, kind: 'flange', code: '61', floor: true } : { ...base, kind: 'flange', code: 'C58', floor: true, angled: true, note: `Pipe leans ${Math.round(angleBetween(v, [0, 1, 0]))}° from vertical.` };
      if (s.floorEnd === 'plug') return { ...base, kind: 'plug', code: '84', floor: true };
      return { ...base, kind: 'open', floor: true };
    }
    return s.capEnds ? { ...base, kind: 'plug', code: '84' } : { ...base, kind: 'open' };
  }

  // all square?
  let allSquare = true;
  for (let i = 0; i < n && allSquare; i++) for (let j = i + 1; j < n; j++) if (!compatible(vecs[i], vecs[j])) { allSquare = false; break; }
  if (allSquare) {
    const q = squareJoint(node, vecs);
    if (q.inline) return { ...base, ...q, kind: 'inline' };
    return { ...base, ...q, kind: 'fitting' };
  }

  // angled joints with a matching Kee Klamp fitting
  const pairs = findPairs(vecs);
  const A = { ...base, kind: 'fitting', pairs, angled: true };
  if (n === 2) {
    const t = angleBetween(vecs[0], vecs[1]);
    const note = `Pipes meet at ${Math.round(t)}°.`;
    if (t >= 125) return { ...A, code: '55', note };
    if (Math.abs(t - 90) <= 11) return { ...A, code: '87', note };
    return { ...A, code: 'C50', note: `${note} No fixed fitting makes this angle; use a swivel socket.`, custom: true };
  }
  if (n === 3 && pairs.length === 1) {
    const thru = vecs[pairs[0][0]];
    const b = vecs.find((_, i) => !pairs[0].includes(i));
    let phi = angleBetween(b, thru);
    phi = Math.min(phi, 180 - phi);
    const note = `Branch at ${Math.round(phi)}° to the through pipe.`;
    if (phi >= 79) return { ...A, code: '86', thru, note };
    if (Math.abs(phi - 45) <= 1) return { ...A, code: '12', thru, note };
    if (phi >= 30 && phi <= 60) return { ...A, code: '29', thru, note };
    return { ...A, code: 'C50', thru, note: `${note} Use a swivel socket on the through pipe.`, custom: true };
  }
  if (n === 4 && pairs.length === 2) {
    const thru = chooseThru(node, pairs, vecs);
    const other = pairs.find((pr) => Math.abs(vdot(vecs[pr[0]], thru)) < PAR);
    let phi = angleBetween(vecs[other[0]], thru);
    phi = Math.min(phi, 180 - phi);
    if (phi >= 79) return { ...A, code: '89', thru, thruOptions: pairs.map((p) => vecs[p[0]]), note: `Branches at ${Math.round(phi)}° to the through pipe.` };
  }

  // general case: biggest square group gets a normal fitting, other pipes get swivel sockets
  let best = [0];
  const lim = Math.min(n, 12);
  for (let mask = 1; mask < 1 << lim; mask++) {
    const idx = [];
    for (let i = 0; i < lim; i++) if (mask & (1 << i)) idx.push(i);
    if (idx.length <= best.length) continue;
    let ok = true;
    for (let i = 0; i < idx.length && ok; i++) for (let j = i + 1; j < idx.length; j++) if (!compatible(vecs[idx[i]], vecs[idx[j]])) { ok = false; break; }
    if (ok) best = idx;
  }
  const core = squareJoint(node, best.map((i) => vecs[i]));
  const extra = n - best.length;
  const note = `${extra} angled pipe${extra > 1 ? 's' : ''} at this joint need swivel sockets.`;
  if (core.code && !core.inline) {
    return { ...A, code: core.code, thru: core.thru, thruOptions: core.thruOptions, extras: [{ code: 'C50', qty: extra }], note, custom: true };
  }
  return { ...A, code: 'C50', thru: core.inline ? core.thru : null, extras: extra > 1 ? [{ code: 'C50', qty: extra - 1 }] : [], note, custom: true };
}

export function classifyAll(m) {
  const { byId, adj } = buildAdj(m);
  const cls = new Map();
  for (const n of m.nodes) cls.set(n.id, classify(m, n, adj.get(n.id)));
  return { byId, adj, cls };
}

// Directions for the drawing arrows at a joint: a square frame lined up with as many of its pipes as possible.
export function nodeFrame(m, nodeId, adjIn) {
  const adj = adjIn || buildAdj(m).adj;
  const vecs = (adj.get(nodeId) || []).map((l) => l.vec);
  const frames = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]]];
  const fromTwo = (a, b) => { const x = vnorm(a); const z = vnorm(vcross(x, b)); const y = vcross(z, x); return [x, y, z]; };
  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) if (Math.abs(vdot(vecs[i], vecs[j])) < PAR) frames.push(fromTwo(vecs[i], vecs[j]));
  }
  for (const v of vecs) {
    const up = Math.abs(v[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    const side = vnorm(vcross(v, up));
    frames.push([v, vcross(side, v), side]);
  }
  const score = (f) => vecs.filter((v) => f.some((a) => Math.abs(vdot(a, v)) > PAR)).length;
  let best = frames[0], bs = score(best);
  for (const f of frames.slice(1)) { const sc = score(f); if (sc > bs) { best = f; bs = sc; } }
  return best;
}

// ---------- editing operations ----------
export function extend(m, nodeId, dir, len) {
  const n = m.nodes.find((q) => q.id === nodeId);
  if (!n || !(len > EPS)) return null;
  const v = vnorm(Array.isArray(dir) ? dir : DIRS[dir]);
  const t = vadd(P(n), vscale(v, len));
  const b = addNode(m, ...t);
  addPipe(m, nodeId, b);
  normalize(m);
  const end = findNodeAt(m, ...t);
  return end ? end.id : null;
}

// Join two joints with a straight pipe at whatever angle that takes.
export function connect(m, a, b) {
  if (a === b) return false;
  if (m.pipes.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) return false;
  addPipe(m, a, b);
  normalize(m);
  return true;
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

export function rotateNodes(m, ids, pivot, axis, ang) {
  const k = vnorm(axis);
  for (const n of m.nodes) {
    if (!ids.has(n.id)) continue;
    setP(n, vadd(pivot, rotVec(vsub(P(n), pivot), k, ang)));
    if (Array.isArray(n.thru)) n.thru = rotVec(n.thru, k, ang);
  }
  normalize(m);
}

export function centerOf(m, ids) {
  const b = bounds(m, ids);
  return b ? [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2] : [0, 0, 0];
}

export function dropToFloor(m, ids) {
  const b = bounds(m, ids);
  if (!b || Math.abs(b.min[1]) < EPS) return false;
  translate(m, ids, [0, -b.min[1], 0]);
  return true;
}

// Nodes that swing with a pipe when it pivots about one end.
// If the pipe is part of a closed loop, only its far end moves (connected pipes stretch to follow).
export function swingSet(m, pipeId, pivotId) {
  const { adj } = buildAdj(m);
  const p = m.pipes.find((q) => q.id === pipeId);
  if (!p) return { ids: new Set(), loop: false, far: null };
  const far = p.a === pivotId ? p.b : p.a;
  const seen = new Set([far]);
  const stack = [far];
  while (stack.length) {
    const id = stack.pop();
    for (const l of adj.get(id) || []) {
      if (l.other === pivotId || seen.has(l.other)) continue;
      seen.add(l.other); stack.push(l.other);
    }
  }
  const loop = (adj.get(pivotId) || []).some((l) => l.other !== far && seen.has(l.other));
  return { ids: loop ? new Set([far]) : seen, loop, far };
}

// Point a pipe in a new direction by swinging it about its pivot end.
export function setPipeDir(m, pipeId, pivotId, newDir) {
  const p = m.pipes.find((q) => q.id === pipeId);
  if (!p) return;
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const far = p.a === pivotId ? p.b : p.a;
  const piv = P(byId.get(pivotId));
  const cur = vnorm(vsub(P(byId.get(far)), piv));
  const nd = vnorm(newDir);
  const d = clamp(vdot(cur, nd), -1, 1);
  if (d > 0.999999) return;
  let axis = vcross(cur, nd);
  if (vlen(axis) < 1e-6) { axis = vcross(cur, [0, 1, 0]); if (vlen(axis) < 1e-6) axis = [0, 0, 1]; }
  rotateNodes(m, swingSet(m, pipeId, pivotId).ids, piv, vnorm(axis), Math.acos(d));
}

// Tilt from vertical (0 = straight up) and heading (0 = +X, counter-clockwise seen from above).
export function tiltHeading(v) {
  const u = vnorm(v);
  const tilt = angleBetween(u, [0, 1, 0]);
  const h = Math.hypot(u[0], u[2]);
  let heading = h < 1e-6 ? 0 : deg(Math.atan2(-u[2], u[0]));
  if (heading < 0) heading += 360;
  return { tilt, heading, vertical: h < 1e-6 };
}
export function dirFrom(tilt, heading) {
  const t = rad(tilt), h = rad(heading);
  return [Math.sin(t) * Math.cos(h), Math.cos(t), -Math.sin(t) * Math.sin(h)];
}

// Change a pipe's length by moving one end. If that end is a junction,
// everything in the same structure beyond that end shifts along the pipe.
export function stretchPipe(m, pipeId, endId, delta, minLen = 1) {
  const { byId, adj } = buildAdj(m);
  const p = m.pipes.find((q) => q.id === pipeId);
  if (!p) return;
  const E = byId.get(endId), O = byId.get(p.a === endId ? p.b : p.a);
  const d = pipeDir(O, E);
  const cur = pipeLen(m, p, byId);
  const next = Math.max(minLen, cur + delta);
  const dd = next - cur;
  if (Math.abs(dd) < EPS) return;
  if (adj.get(E.id).length === 1) {
    setP(E, vadd(P(E), vscale(d, dd)));
  } else {
    const comp = componentOf(m, E.id);
    const e = P(E);
    for (const n of m.nodes) {
      if (!comp.has(n.id)) continue;
      if (vdot(vsub(P(n), e), d) >= -EPS) setP(n, vadd(P(n), vscale(d, dd)));
    }
  }
  normalize(m);
}

export function preferredEnd(m, pipeId) {
  const { byId, adj } = buildAdj(m);
  const p = m.pipes.find((q) => q.id === pipeId);
  const A = byId.get(p.a), B = byId.get(p.b);
  const d = pipeDir(A, B);
  if (Math.abs(d[1]) > 0.7) return B.y > A.y ? B.id : A.id; // steep pipes grow upward
  const la = adj.get(A.id).length, lb = adj.get(B.id).length;
  if (la === 1 && lb > 1) return A.id;
  if (lb === 1 && la > 1) return B.id;
  return d[0] + d[2] >= 0 ? B.id : A.id;
}

// The end that stays put when a pipe is swung: the more connected (or lower) end.
export function anchorEnd(m, pipeId) {
  const { byId, adj } = buildAdj(m);
  const p = m.pipes.find((q) => q.id === pipeId);
  const la = adj.get(p.a).length, lb = adj.get(p.b).length;
  if (la !== lb) return la > lb ? p.a : p.b;
  return byId.get(p.a).y <= byId.get(p.b).y ? p.a : p.b;
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
  const L = pipeLen(m, p, byId);
  let t = Math.round(L / 2 / snap) * snap;
  if (t <= EPS || t >= L - EPS) t = L / 2;
  const pt = vadd(P(A), vscale(pipeDir(A, B), t));
  const n = { id: nid(m), x: r2(pt[0]), y: r2(pt[1]), z: r2(pt[2]) };
  m.nodes.push(n);
  normalize(m);
  return findNodeAt(m, ...pt)?.id ?? null;
}

export function deletePipe(m, pipeId) {
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
  if (L.length !== 2 || vdot(L[0].vec, L[1].vec) > -PAR) return false;
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
    m.nodes.push({ ...n, id, x: n.x + dx });
  }
  for (const p of m.pipes.filter((q) => comp.has(q.a))) addPipe(m, map.get(p.a), map.get(p.b));
  normalize(m);
  return [...map.values()].find((id) => m.nodes.some((n) => n.id === id)) ?? null;
}

// ---------- shapes library ----------
const IN = 25.4;
export const SHAPES = [
  { id: 'table', name: 'Table', params: [['w', 'Width', 60 * IN, 1500], ['d', 'Depth', 30 * IN, 750], ['h', 'Height', 30 * IN, 750], ['s', 'Lower shelf height (0 = none)', 8 * IN, 200]] },
  { id: 'shelf', name: 'Shelving', params: [['w', 'Width', 48 * IN, 1200], ['d', 'Depth', 18 * IN, 450], ['h', 'Height', 72 * IN, 1800], ['n', 'Shelf levels', 4, 4, 'count'], ['b', 'Bottom shelf height', 4 * IN, 100]] },
  { id: 'bench', name: 'Workbench', params: [['w', 'Width', 72 * IN, 1800], ['d', 'Depth', 30 * IN, 750], ['h', 'Height', 36 * IN, 900], ['s', 'Lower shelf height (0 = none)', 8 * IN, 200], ['t', 'Back upright height (0 = none)', 66 * IN, 1650]] },
  { id: 'aframe', name: 'A-frame', params: [['l', 'Length', 48 * IN, 1200], ['h', 'Height', 30 * IN, 750], ['b', 'Width at the feet', 30 * IN, 750], ['c', 'Crossbar height (0 = none)', 10 * IN, 250]] },
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

export function buildShape(m, id, vIn, origin = [0, 0, 0]) {
  const shape = SHAPES.find((s) => s.id === id);
  if (!shape) return null;
  const snap = m.settings.snap || 1;
  const v = { ...vIn };
  for (const [k, , , , type] of shape.params) if (type !== 'count') v[k] = Math.round(v[k] / snap) * snap;
  const segs = [];
  const seg = (a, b) => segs.push([a, b]);
  const rect = (w, d, y) => {
    seg([0, y, 0], [w, y, 0]); seg([w, y, 0], [w, y, d]);
    seg([w, y, d], [0, y, d]); seg([0, y, d], [0, y, 0]);
  };
  const legs = (h) => { for (const [x, z] of [[0, 0], [v.w, 0], [v.w, v.d], [0, v.d]]) seg([x, 0, z], [x, h, z]); };
  const cnt = (x, min) => Math.max(min, Math.round(x || 0));
  switch (id) {
    case 'box': legs(v.h); rect(v.w, v.d, 0); rect(v.w, v.d, v.h); break;
    case 'table': legs(v.h); rect(v.w, v.d, v.h); if (v.s > 0 && v.s < v.h) rect(v.w, v.d, v.s); break;
    case 'bench': {
      seg([0, 0, 0], [0, v.h, 0]); seg([v.w, 0, 0], [v.w, v.h, 0]);
      const top = v.t > v.h ? v.t : v.h;
      seg([0, 0, v.d], [0, top, v.d]); seg([v.w, 0, v.d], [v.w, top, v.d]);
      rect(v.w, v.d, v.h);
      if (v.s > 0 && v.s < v.h) rect(v.w, v.d, v.s);
      if (v.t > v.h) seg([0, top, v.d], [v.w, top, v.d]);
      break;
    }
    case 'aframe': {
      const hb = v.b / 2;
      for (const x of [0, v.l]) {
        seg([x, 0, -hb], [x, v.h, 0]); seg([x, 0, hb], [x, v.h, 0]);
        if (v.c > 0 && v.c < v.h) { const z = hb * (1 - v.c / v.h); seg([x, v.c, -z], [x, v.c, z]); }
      }
      seg([0, v.h, 0], [v.l, v.h, 0]);
      break;
    }
    case 'shelf': {
      legs(v.h);
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
      legs(v.h); rect(v.w, v.d, v.h);
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
  let firstPos = null;
  for (const [a, b] of segs) {
    const A = vadd(a, origin), B = vadd(b, origin);
    const ia = addNode(m, ...A), ib = addNode(m, ...B);
    if (!firstPos) firstPos = A;
    addPipe(m, ia, ib);
  }
  normalize(m);
  return firstPos ? findNodeAt(m, ...firstPos)?.id ?? null : null;
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
    const p1 = L.find((l) => vdot(l.vec, k.thru) > PAR), p2 = L.find((l) => vdot(l.vec, k.thru) < -PAR);
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
  const bump = (code, q = 1) => fit.set(code, (fit.get(code) || 0) + q);
  let custom = 0;
  for (const n of m.nodes) {
    const k = cls.get(n.id);
    if (k.code) bump(k.code);
    for (const e of k.extras || []) bump(e.code, e.qty);
    if (k.custom) custom++;
  }
  if (couplings) bump('14', couplings);
  const fittings = [...fit.entries()]
    .sort((a, b) => codeOrder(a[0]) - codeOrder(b[0]))
    .map(([code, qty]) => ({ code, part: partNo(code, size.code), name: FITTINGS[code].name, use: FITTINGS[code].use, qty }));
  if (custom) warnings.push(`${custom} angled joint${custom > 1 ? 's use' : ' uses'} swivel sockets (C50). Check the exact arrangement with your supplier; swivel pairs usually clamp a short distance from the joint.`);

  const unit = s.units === 'in' ? IN / 16 : 1;
  const cuts = new Map();
  for (const p of pieces) {
    const k = Math.round(p.len / unit) * unit;
    cuts.set(k, (cuts.get(k) || 0) + 1);
  }
  const cutList = [...cuts.entries()].sort((a, b) => b[0] - a[0]).map(([len, qty]) => ({ len, qty }));

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
  if (!(m.settings.angleSnap > 0)) m.settings.angleSnap = 15;
  m.version = 2;
  m.nodes = obj.nodes.filter((n) => [n.x, n.y, n.z].every(Number.isFinite)).map((n) => ({
    id: Number(n.id), x: n.x, y: n.y, z: n.z,
    ...(AXES.includes(n.thru) ? { thru: DIRS['+' + n.thru] } : Array.isArray(n.thru) && n.thru.length === 3 && n.thru.every(Number.isFinite) ? { thru: n.thru } : {}),
    ...(n.split ? { split: true } : {}),
  }));
  const ids = new Set(m.nodes.map((n) => n.id));
  m.pipes = obj.pipes.filter((p) => ids.has(Number(p.a)) && ids.has(Number(p.b))).map((p) => ({ id: Number(p.id), a: Number(p.a), b: Number(p.b) }));
  m.nextId = Math.max(1, ...m.nodes.map((n) => n.id + 1), ...m.pipes.map((p) => p.id + 1));
  normalize(m);
  return m;
}
