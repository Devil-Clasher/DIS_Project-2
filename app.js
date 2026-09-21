'use strict';

const NS = 'http://www.w3.org/2000/svg';

const $ = (id) => document.getElementById(id);
const inputEl = $('input');
const analysisEl = $('analysis');
const animateBtn = $('animateBtn');
const loadBtn = $('loadBtn');
const resetBtn = $('resetBtn');
const speedEl = $('speed');
const speedVal = $('speedVal');
const circuitEl = $('circuit');
const svg = $('svg');
const logList = $('logList');

const PRESETS = {
  triangle: 'A-B\nB-C\nC-A',
  k5: 'A-B, A-C, A-D, A-E, B-C, B-D, B-E, C-D, C-E, D-E',
  trail: 'A-B, B-C, C-D, D-A, B-E, C-E',
  star: 'A-B, A-C, A-D, A-E',
};

let g = null;        // parsed graph
let analysis = null; // analyze() result
let stepResult = null;
let pos = [];
let nodeR = 20;
let degree = [];
let oddSet = new Set();
let usedSet = new Set();     // edges consumed by the algorithm
let activeEdge = null;
let running = false;

function el(name, attrs) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function delay() { return Number(speedEl.value); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- layout ----------
function layout(n) {
  const cx = 410, cy = 320;
  const R = Math.max(90, Math.min(300, n * 34));
  pos = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
    pos.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  nodeR = n <= 8 ? 20 : n <= 16 ? 14 : 11;
}

function clip(a, b, r) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  return { x: a.x + (dx / L) * r, y: a.y + (dy / L) * r };
}

// ---------- rendering ----------
function render() {
  svg.textContent = '';
  const { labels } = g;

  for (let i = 0; i < g.edges.length; i++) {
    const e = g.edges[i];
    const p1 = clip(pos[e.a], pos[e.b], nodeR);
    const p2 = clip(pos[e.b], pos[e.a], nodeR);
    const isActive = activeEdge === i;
    const cls = isActive
      ? 'edge active'
      : usedTrailEdge(i)
        ? 'edge trail'
        : usedSet.has(i)
          ? 'edge used'
          : 'edge base';
    svg.appendChild(el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: cls }));
  }

  for (let i = 0; i < g.n; i++) {
    const p = pos[i];
    const odd = oddSet.has(i);
    const head = stateHead === i;
    const grp = el('g', { class: 'node' + (odd ? ' odd' : '') + (head ? ' head' : '') });

    if (head) grp.appendChild(el('circle', { cx: p.x, cy: p.y, r: nodeR + 6, class: 'pulse' }));
    grp.appendChild(el('circle', { cx: p.x, cy: p.y, r: nodeR, class: 'disc' }));

    const t = el('text', { x: p.x, y: p.y, class: 'label' });
    t.textContent = labels[i];
    grp.appendChild(t);

    const d = el('text', { x: p.x, y: p.y + nodeR + 15, class: 'deg' + (odd ? ' odd' : '') });
    d.textContent = degree[i] + (odd ? ' *' : '');
    grp.appendChild(d);

    svg.appendChild(grp);
  }
}

let stateHead = null;
let stateTrail = [];

function usedTrailEdge(i) { return stateTrail.includes(i); }

function pathStr(order) {
  if (!order.length) return '';
  const verts = [];
  let cur = null;
  for (const id of order) {
    const e = g.edges[id];
    if (cur === null) { cur = e.a; verts.push(g.labels[cur]); }
    const next = cur === e.a ? e.b : e.a;
    verts.push(g.labels[next]);
    cur = next;
  }
  return verts.join('  →  ');
}

function isCircuit() {
  if (!stepResult || !stepResult.final.length) return false;
  return stepResult.final[0] === stepResult.final[stepResult.final.length - 1];
}

function updatePath() {
  const p = pathStr(stateTrail);
  circuitEl.innerHTML =
    '<span class="title">Working path</span><br>' +
    (p ? esc(p) : '—') +
    (stateTrail.length ? `<br><span style="color:var(--muted)">${stateTrail.length} edge${stateTrail.length > 1 ? 's' : ''} used</span>` : '');
}

function log(msg, cls) {
  const li = document.createElement('li');
  li.className = cls || '';
  li.innerHTML = msg;
  logList.appendChild(li);
  logList.scrollTop = logList.scrollHeight;
}

function clearLog() { logList.textContent = ''; }

// ---------- loading ----------
function loadGraph() {
  running = false;
  g = euler.parseGraph(inputEl.value);

  if (!g.n || g.edges.length === 0) {
    analysisEl.className = 'analysis bad';
    analysisEl.innerHTML = esc('No edges parsed. Use the form <code>A-B</code>, one per line.');
    animateBtn.disabled = true;
    circuitEl.innerHTML = '';
    clearLog();
    svg.textContent = '';
    return;
  }

  analysis = euler.analyze(g);
  degree = g.adj.map((a) => a.length);
  oddSet = new Set(analysis.odd);
  layout(g.n);
  stateHead = null;
  stateTrail = [];
  usedSet = new Set();
  activeEdge = null;
  clearLog();
  updatePath();
  render();

  const degTxt = g.labels.map((l, i) => `${l}${degree[i]}`).join(', ');
  const oddTxt = analysis.odd.length
    ? `<br><span class="odd-note">odd-degree: ${analysis.odd.map((i) => esc(g.labels[i])).join(', ')}</span>`
    : '';
  analysisEl.className = 'analysis ' + (analysis.valid ? 'ok' : 'bad');
  analysisEl.innerHTML =
    `<span class="deg">${esc(degTxt)}</span>${oddTxt}<br>${esc(analysis.msg)}`;

  if (analysis.valid && g.n > 0) {
    stepResult = euler.computeSteps(g, analysis.start);
    animateBtn.disabled = false;
  } else {
    stepResult = null;
    animateBtn.disabled = true;
  }
}

// ---------- animation ----------
function animateTraverse(step) {
  return new Promise((resolve) => {
    const from = pos[step.from], to = pos[step.to];
    const t = Math.max(140, delay() * 0.7);
    const t0 = performance.now();
    const dot = el('circle', { class: 'dot', r: Math.max(6, nodeR * 0.45) });
    svg.appendChild(dot);
    dot.setAttribute('cx', from.x);
    dot.setAttribute('cy', from.y);
    function frame(now) {
      const k = Math.min(1, (now - t0) / t);
      dot.setAttribute('cx', from.x + (to.x - from.x) * k);
      dot.setAttribute('cy', from.y + (to.y - from.y) * k);
      if (k < 1) {
        requestAnimationFrame(frame);
      } else {
        dot.remove();
        usedSet.add(step.eid);
        activeEdge = null;
        render();
        log(`Traverse <span class="hl">${esc(g.labels[step.from])} → ${esc(g.labels[step.to])}</span>`);
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

async function animateTour() {
  running = true;
  animateBtn.disabled = true;
  clearLog();
  const { steps, final } = stepResult;

  log(`<i>Starting at vertex <b>${esc(g.labels[analysis.start])}</b>. Stack-based search (work path) in amber; when a vertex has no unused edges left, it's popped onto the circuit (in green).</i>`, '');

  for (let i = 0; i < steps.length; i++) {
    if (!running) return;
    const s = steps[i];
    const d = delay();

    if (s.type === 'traverse') {
      stateHead = s.to;
      stateTrail = s.trail;
      activeEdge = s.eid;
      render();
      await animateTraverse(s);
      updatePath();
      await sleep(Math.max(0, d * 0.35));
    } else {
      stateHead = s.stack.length ? s.stack[s.stack.length - 1] : null;
      stateTrail = s.trail;
      render();
      log(`Pop <span class="hl">${esc(g.labels[s.v])}</span> — no unused edge remains, append to circuit`);
      updatePath();
      await sleep(d * 0.8);
    }
  }

  if (!running) return;
  running = false;
  stateHead = null;
  render();

  const ok = final.length === g.edges.length + 1;
  circuitEl.innerHTML =
    '<span class="title">Euler tour found</span><br>' +
    `<span class="tour">${final.map((i) => esc(g.labels[i])).join('  →  ')}</span><br>` +
    `<span style="color:var(--muted)">${final.length} vertices = ${g.edges.length} edges + 1` +
    (isCircuit() ? ' — a closed circuit' : ' — an open trail') + '</span>';

  log(ok
    ? `Done! Euler tour has ${final.length} vertices (${final.length - 1} edges), exactly covering every edge${isCircuit() ? ', and it closes back to the start' : ''}.`
    : '<span class="err">Warning: produced tour does not cover every edge exactly once — check the graph.</span>',
    ok ? 'done' : 'err');

  animateBtn.disabled = false;
}

// ---------- wiring ----------
speedEl.addEventListener('input', () => {
  speedVal.textContent = speedEl.value + ' ms';
});
loadBtn.addEventListener('click', () => { running = false; loadGraph(); });
resetBtn.addEventListener('click', () => {
  running = false;
  stateHead = null;
  stateTrail = [];
  usedSet = new Set();
  activeEdge = null;
  clearLog();
  updatePath();
  render();
  animateBtn.disabled = !(stepResult && analysis.valid);
});
animateBtn.addEventListener('click', () => {
  if (stepResult) animateTour();
});

document.querySelectorAll('.presets button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.presets button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    inputEl.value = PRESETS[btn.dataset.preset];
    loadGraph();
  });
});

// show a sample immediately
inputEl.value = PRESETS.triangle;
loadGraph();