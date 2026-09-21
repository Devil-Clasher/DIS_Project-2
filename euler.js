'use strict';

// ---------- pure graph logic (no DOM) ----------

function tokenize(raw) {
  return raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
}

function parseGraph(raw) {
  const ids = new Map();
  const order = [];
  const get = (label) => {
    if (!ids.has(label)) {
      ids.set(label, ids.size);
      order.push(label);
    }
    return ids.get(label);
  };
  const edges = [];
  for (const tok of tokenize(raw)) {
    const m = tok.match(/^(.+?)\s*[-]\s*(.+)$/);
    if (!m) continue;
    const a = get(m[1].trim());
    const b = get(m[2].trim());
    if (a === b) continue;
    edges.push({ a, b });
  }
  const n = order.length;
  const adj = Array.from({ length: n }, () => []);
  edges.forEach((e, i) => {
    adj[e.a].push(i);
    adj[e.b].push(i);
  });
  return { n, edges, adj, labels: order };
}

function other(v, e) {
  return e.a === v ? e.b : e.a;
}

function analyze(g) {
  const { n, edges, adj } = g;
  const degree = adj.map((a) => a.length);
  const odd = [];
  for (let i = 0; i < n; i++) if (degree[i] % 2 === 1) odd.push(i);

  const start = adj.findIndex((a) => a.length > 0);
  if (start === -1) {
    return { degree, odd, valid: false, msg: 'Empty graph — add some edges first.' };
  }

  const seen = new Uint8Array(n);
  const q = [start];
  seen[start] = 1;
  while (q.length) {
    const v = q.pop();
    for (const eid of adj[v]) {
      const u = other(v, edges[eid]);
      if (!seen[u]) { seen[u] = 1; q.push(u); }
    }
  }
  for (let i = 0; i < n; i++) {
    if (adj[i].length > 0 && !seen[i]) {
      return {
        degree, odd, valid: false,
        msg: 'Graph is not connected — no single Eulerian tour can cover all edges.',
      };
    }
  }

  if (odd.length === 0) {
    return {
      degree, odd, valid: true, type: 'circuit',
      start: adj.findIndex((a) => a.length > 0),
      msg: 'Eulerian CIRCUIT exists — every vertex has even degree. You can start anywhere.',
    };
  }
  if (odd.length === 2) {
    return {
      degree, odd, valid: true, type: 'trail',
      start: odd[0],
      msg: "Eulerian TRAIL exists — exactly two odd vertices. Start at one odd vertex.",
    };
  }
  return {
    degree, odd, valid: false,
    msg: `No Eulerian tour — found ${odd.length} odd-degree vertices (allowed: 0 or 2).`,
  };
}

// Hierholzer's algorithm, emitted as a step list for animation.
function computeSteps(g, start) {
  const { n, edges, adj } = g;
  if (n === 0 || edges.length === 0) return { steps: [], final: [] };
  const used = new Array(edges.length).fill(false);
  const stack = [start];
  const circuit = [];
  const trail = [];
  const steps = [];

  while (stack.length) {
    const v = stack[stack.length - 1];
    let eid = -1;
    for (const e of adj[v]) {
      if (!used[e]) { eid = e; break; }
    }
    if (eid === -1) {
      stack.pop();
      circuit.push(v);
      if (trail.length) trail.pop();
      steps.push({ type: 'finish', v, trail: trail.slice(), circuit: circuit.slice(), stack: stack.slice() });
    } else {
      used[eid] = true;
      const u = other(v, edges[eid]);
      trail.push(eid);
      stack.push(u);
      steps.push({ type: 'traverse', from: v, to: u, eid, trail: trail.slice(), circuit: circuit.slice(), stack: stack.slice() });
    }
  }

  return { steps, final: circuit.slice().reverse() };
}

const euler = { parseGraph, analyze, computeSteps, other };

if (typeof module !== 'undefined' && module.exports) module.exports = euler;
if (typeof window !== 'undefined') window.euler = euler;